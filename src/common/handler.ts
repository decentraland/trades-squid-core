import { Store } from '@subsquid/typeorm-store'
import { In } from 'typeorm'
import { ContractStatus, Network, SignatureIndex, TradeAction, Trade } from '../model'
import { Context } from './processor'
import { OffchainMarketplaceAbi, OffchainMarketplaceAbiV3 } from './types'
import { sendEvents } from './utils/events'

type ContractStatusAction = 'pause' | 'unpause' | undefined

async function getContractStatusToUpsert(
  store: Store,
  address: string,
  network: Network,
  contractStatusAction: ContractStatusAction
): Promise<ContractStatus[]> {
  if (!contractStatusAction) {
    return []
  }

  const storedContractStatus = await store.get(ContractStatus, {
    where: { address, network }
  })

  const contractStatusToUpsert =
    storedContractStatus || new ContractStatus({ id: `${address}-${network}`, address, network, paused: false })

  if (contractStatusAction === 'pause') {
    storedContractStatus.paused = true
  } else if (contractStatusAction === 'unpause') {
    storedContractStatus.paused = false
  }

  return [contractStatusToUpsert]
}

async function getIndexesToUpsert(store: Store, network: Network, modifiedIndexes: Record<string, number>): Promise<SignatureIndex[]> {
  const modifiedIndexesAddresses = Object.keys(modifiedIndexes)

  if (!modifiedIndexesAddresses.length) {
    return []
  }

  const storedIndexes = await store
    .findBy(SignatureIndex, {
      address: In(modifiedIndexesAddresses),
      network
    })
    .then(q => new Map(q.map(i => [i.id, i])))

  return Object.entries(modifiedIndexes).map(([address, index]) => {
    if (storedIndexes.has(address)) {
      const indexEntity = storedIndexes.get(address)
      indexEntity.index += index
      return indexEntity
    }
    return new SignatureIndex({
      id: `${address}-${network}`,
      address,
      network,
      index
    })
  })
}

/**
 * Stable, content-addressed row id: the log's own on-chain coordinates.
 *
 * This REPLACED `uuidv4()`, and the difference is not cosmetic:
 *
 *  - A generated id is not derived from the event, so re-processing the same log — a reorg rollback, or
 *    the routine full reindex a schema change forces — yields a DIFFERENT id. Any downstream consumer
 *    that treats a row as "one unit of work already done" is then unable to recognise it. For the
 *    treasury consumer that credits sellers, re-crediting the entire indexed history is a direct loss.
 *  - It also makes `store.upsert` genuinely idempotent: re-processing a log now writes the SAME primary
 *    key instead of inserting a second row for one on-chain event.
 *
 * `(txHash, logIndex)` is unique and immutable for a log on a canonical chain, which is exactly the
 * property an id needs. Note that `signature` is NOT unique per row: one transaction can execute the
 * same multi-use trade several times, emitting several Traded logs that differ only by log index.
 */
function tradeRowId(txHash: string, logIndex: number): string {
  return `${txHash}-${logIndex}`
}

export function getDataHandler(
  marketplaceAbi: OffchainMarketplaceAbi,
  marketplaceAbiV3: OffchainMarketplaceAbiV3,
  marketplaceContractAddress: string,
  network: Network,
  // Absent on chains where V3 is not deployed yet.
  marketplaceAddressV3?: string
) {
  return async function (ctx: Context) {
    const tradesToInsert: Trade[] = []
    const modifiedIndexes: Record<string, number> = {}
    let contractStatusAction: ContractStatusAction = undefined
    let notifyTimestamp: bigint = BigInt(0)

    for (const block of ctx.blocks) {
      const timestamp = BigInt(block.header.timestamp)
      notifyTimestamp = timestamp
      for (const log of block.logs) {
        const transactionHash = log.transactionHash
        const topic = log.topics[0]
        switch (topic) {
          case marketplaceAbi.events.Traded.topic:
          case marketplaceAbiV3.events.Traded.topic: {
            // V3's Traded carries an extra indexed _tradeDigest, which moves topic0, so it decodes with
            // its own module. `_signature` is unchanged across versions: still keccak256 of the raw
            // signature bytes, so existing consumers joining executed trades on it keep working.
            const decodedV3 = topic === marketplaceAbiV3.events.Traded.topic ? marketplaceAbiV3.events.Traded.decode(log) : null
            const { _signature, _trade, _caller } = decodedV3 ?? marketplaceAbi.events.Traded.decode(log)
            const tradeDigest = decodedV3?._tradeDigest ?? null
            tradesToInsert.push(
              new Trade({
                id: tradeRowId(transactionHash, log.logIndex),
                network,
                action: TradeAction.executed,
                signature: _signature,
                tradeDigest,
                timestamp,
                caller: _caller,
                txHash: transactionHash,
                logIndex: log.logIndex,
                // Leg [0] kept for existing consumers; the arrays carry every leg so a trade that splits
                // its proceeds across beneficiaries is not invisible to whoever filters on one address.
                //
                // Both legs are OPTIONAL. A trade with nothing in `received` is a giveaway — the signer
                // hands over an asset and takes no payment — and the contract accepts it, so the event is
                // valid on-chain data, not a malformed log. Indexing `[0]` unguarded read `undefined` and
                // threw inside the batch transaction, which the processor treats as fatal: it crash-looped
                // on that block and stopped indexing every trade behind it (prod, 2026-08-07).
                sentBeneficiary: _trade.sent[0]?.beneficiary ?? null,
                receivedBeneficiary: _trade.received[0]?.beneficiary ?? null,
                sentBeneficiaries: _trade.sent.map(asset => asset.beneficiary),
                receivedBeneficiaries: _trade.received.map(asset => asset.beneficiary)
              })
            )
            break
          }
          case marketplaceAbi.events.ContractSignatureIndexIncreased.topic: {
            // Still attributed to the configured address rather than the emitting one, so V1, V2 and now
            // V3 share a single row. Scoping it per contract needs a matching change to the server's
            // index join, which matches these rows by network across the known marketplace addresses.
            if (!modifiedIndexes[marketplaceContractAddress]) {
              modifiedIndexes[marketplaceContractAddress] = 0
            }
            modifiedIndexes[marketplaceContractAddress] += 1
            break
          }
          case marketplaceAbi.events.SignerSignatureIndexIncreased.topic: {
            const { _caller } = marketplaceAbi.events.SignerSignatureIndexIncreased.decode(log)
            if (!modifiedIndexes[_caller]) {
              modifiedIndexes[_caller] = 0
            }
            modifiedIndexes[_caller] += 1
            break
          }

          case marketplaceAbi.events.SignatureCancelled.topic: {
            // Identical event shape and topic across every version, so the emitting address is the only
            // thing that says what the bytes32 MEANS. V1/V2 cancel by keccak256 of the raw signature
            // bytes; V3 cancels by the trade's EIP-712 digest, because keying on the signature bytes made
            // cancellation defeatable by re-encoding the same signature (malleability). Recording the V3
            // value as `tradeDigest` as well gives consumers a column with one consistent meaning —
            // joining a V3 cancellation on `signature` matches a hashed-signature column nowhere.
            const { _signature, _caller } = marketplaceAbi.events.SignatureCancelled.decode(log)
            const cancelledByDigest = !!marketplaceAddressV3 && log.address === marketplaceAddressV3
            tradesToInsert.push(
              new Trade({
                id: tradeRowId(transactionHash, log.logIndex),
                network,
                action: TradeAction.cancelled,
                signature: _signature,
                tradeDigest: cancelledByDigest ? _signature : null,
                timestamp,
                txHash: transactionHash,
                logIndex: log.logIndex,
                sentBeneficiary: null,
                caller: _caller,
                receivedBeneficiary: null,
                sentBeneficiaries: [],
                receivedBeneficiaries: []
              })
            )
            break
          }

          case marketplaceAbi.events.Paused.topic: {
            if (contractStatusAction === 'unpause') {
              contractStatusAction = undefined
            } else {
              contractStatusAction = 'pause'
            }
            break
          }

          case marketplaceAbi.events.Unpaused.topic: {
            if (contractStatusAction === 'pause') {
              contractStatusAction = undefined
            } else {
              contractStatusAction = 'unpause'
            }
            break
          }
        }
      }
    }

    const contractStatusToUpsert = await getContractStatusToUpsert(ctx.store, marketplaceContractAddress, network, contractStatusAction)
    const indexesToUpsert: SignatureIndex[] = await getIndexesToUpsert(ctx.store, network, modifiedIndexes)

    await sendEvents(ctx.store, tradesToInsert, notifyTimestamp)

    await ctx.store.upsert(contractStatusToUpsert)
    await ctx.store.upsert(indexesToUpsert)
    await ctx.store.upsert(tradesToInsert)
  }
}
