import { Store } from '@subsquid/typeorm-store'
import { In } from 'typeorm'
import { ContractStatus, Network, SignatureIndex, TradeAction, Trade } from '../model'
import { Context } from './processor'
import { OffchainMarketplaceAbi } from './types'
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

export function getDataHandler(marketplaceAbi: OffchainMarketplaceAbi, marketplaceContractAddress: string, network: Network) {
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
          case marketplaceAbi.events.Traded.topic: {
            const { _signature, _trade, _caller } = marketplaceAbi.events.Traded.decode(log)
            tradesToInsert.push(
              new Trade({
                id: tradeRowId(transactionHash, log.logIndex),
                network,
                action: TradeAction.executed,
                signature: _signature,
                timestamp,
                caller: _caller,
                txHash: transactionHash,
                logIndex: log.logIndex,
                // Leg [0] kept for existing consumers; the arrays carry every leg so a trade that splits
                // its proceeds across beneficiaries is not invisible to whoever filters on one address.
                sentBeneficiary: _trade.sent[0].beneficiary,
                receivedBeneficiary: _trade.received[0].beneficiary,
                sentBeneficiaries: _trade.sent.map(asset => asset.beneficiary),
                receivedBeneficiaries: _trade.received.map(asset => asset.beneficiary)
              })
            )
            break
          }
          case marketplaceAbi.events.ContractSignatureIndexIncreased.topic: {
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
            const { _signature, _caller } = marketplaceAbi.events.SignatureCancelled.decode(log)
            tradesToInsert.push(
              new Trade({
                id: tradeRowId(transactionHash, log.logIndex),
                network,
                action: TradeAction.cancelled,
                signature: _signature,
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
