import { ContractStatus, Network, SignatureIndex, TradeAction, Trade } from '../model'
import { Context } from './processor'
import { OffchainMarketplaceAbi, OffchainMarketplaceAbiV3 } from './types'
import { sendEvents } from './utils/events'

/**
 * `pausedByAddress` holds the final paused state per emitting contract for this batch, so each row is
 * upserted to that absolute value with no read of the stored one.
 *
 * Scoped per contract because the processor watches several marketplace versions and each has its own
 * Pausable state; attributing every Paused/Unpaused to one configured address let a pause on one version
 * describe another. Absolute rather than an action also drops two failure modes: a batch holding both a
 * Paused and an Unpaused used to net to "no action" and persist neither, leaving the row stale, and the
 * old code read the stored row then assigned to it, so a contract's FIRST pause dereferenced undefined
 * and threw inside the batch, which the processor treats as fatal.
 */
function getContractStatusToUpsert(network: Network, pausedByAddress: Map<string, boolean>): ContractStatus[] {
  return Array.from(pausedByAddress, ([address, paused]) => new ContractStatus({ id: `${address}-${network}`, address, network, paused }))
}

/**
 * `modifiedIndexes` holds the latest ABSOLUTE index seen per address in this batch, taken from the
 * event's `_newValue`, so the row is upserted to that value with no read of the stored one.
 *
 * The previous version accumulated instead, and did it wrongly: it keyed the lookup Map by `id`
 * (`${address}-${network}`) while querying it by the bare `address`, so the hit never landed and every
 * batch overwrote the row with only that batch's increment count. A counter bumped across two batches
 * therefore stayed at 1, and the server compared a still-revoked trade's signed index against it and
 * judged the trade valid. `_newValue` is authoritative, which removes the whole class of problem.
 */
type ModifiedIndex = { address: string; contract: string; index: number }

/** Identity of a counter: whose it is, and which deployment holds it. */
function indexKey(address: string, contract: string): string {
  return `${address}-${contract}`
}

function getIndexesToUpsert(network: Network, modifiedIndexes: Record<string, ModifiedIndex>): SignatureIndex[] {
  return Object.values(modifiedIndexes).map(
    ({ address, contract, index }) =>
      new SignatureIndex({
        id: `${address}-${contract}-${network}`,
        address,
        contract,
        network,
        index
      })
  )
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
  network: Network,
  // Absent on chains where V3 is not deployed yet.
  marketplaceAddressV3?: string
) {
  return async function (ctx: Context) {
    const tradesToInsert: Trade[] = []
    const modifiedIndexes: Record<string, ModifiedIndex> = {}
    // Keyed by emitting contract; a later event in the batch overwrites an earlier one, so what is
    // stored is the final state of each contract in this batch.
    const pausedByAddress = new Map<string, boolean>()
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
            // Keyed by the EMITTING contract, not by the configured one. Each marketplace version holds
            // its own independent counter, and a trade's signed `checks.contractSignatureIndex` was read
            // from the specific version it was signed against. Collapsing all versions onto one row let a
            // bump on one of them invalidate trades signed against another.
            const { _newValue } = marketplaceAbi.events.ContractSignatureIndexIncreased.decode(log)
            // The marketplace's own counter: subject and holder are the same contract.
            modifiedIndexes[indexKey(log.address, log.address)] = {
              address: log.address,
              contract: log.address,
              index: Number(_newValue)
            }
            break
          }
          case marketplaceAbi.events.SignerSignatureIndexIncreased.topic: {
            // Signer counters are per signer, not per marketplace, so the caller is the right key. Also
            // recorded as the absolute value the event carries — see getIndexesToUpsert.
            const { _caller, _newValue } = marketplaceAbi.events.SignerSignatureIndexIncreased.decode(log)
            // The signer's counter, but held per deployment: signerSignatureIndex is storage on the
            // emitting marketplace, so the same signer has an independent value on each version.
            modifiedIndexes[indexKey(_caller, log.address)] = {
              address: _caller,
              contract: log.address,
              index: Number(_newValue)
            }
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
            pausedByAddress.set(log.address, true)
            break
          }

          case marketplaceAbi.events.Unpaused.topic: {
            pausedByAddress.set(log.address, false)
            break
          }
        }
      }
    }

    const contractStatusToUpsert = getContractStatusToUpsert(network, pausedByAddress)
    const indexesToUpsert: SignatureIndex[] = getIndexesToUpsert(network, modifiedIndexes)

    await sendEvents(ctx.store, tradesToInsert, notifyTimestamp)

    await ctx.store.upsert(contractStatusToUpsert)
    await ctx.store.upsert(indexesToUpsert)
    await ctx.store.upsert(tradesToInsert)
  }
}
