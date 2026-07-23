import { DataHandlerContext, Log } from '@subsquid/evm-processor'
import { Store } from '@subsquid/typeorm-store'
import { v4 as uuidv4 } from 'uuid';
import { ContractStatus, Network, SignatureIndex, TradeAction, Trade } from '../model'
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
    contractStatusToUpsert.paused = true
  } else if (contractStatusAction === 'unpause') {
    contractStatusToUpsert.paused = false
  }

  return [contractStatusToUpsert]
}

function getIndexesToUpsert(network: Network, modifiedIndexes: Record<string, number>): SignatureIndex[] {
  // `modifiedIndexes` holds the latest absolute on-chain index (the event's `_newValue`) seen for each
  // address in this batch. Upserting the row (keyed by `${address}-${network}`) to that value is correct
  // without reading the stored row, because the signature index is a monotonically increasing counter and
  // `_newValue` is authoritative. The previous implementation keyed the lookup Map by `id`
  // (`${address}-${network}`) but queried it by the bare `address`, so it never matched: every batch
  // overwrote the row with only that batch's increment count, losing the cumulative value and making the
  // server mark still-valid trades as cancelled once an index was bumped in more than one batch.
  return Object.entries(modifiedIndexes).map(
    ([address, index]) =>
      new SignatureIndex({
        id: `${address}-${network}`,
        address,
        network,
        index
      })
  )
}

export function getDataHandler(marketplaceAbi: OffchainMarketplaceAbi, marketplaceContractAddress: string, network: Network) {
  return async function (ctx: DataHandlerContext<Store, unknown>) {
    const tradesToInsert: Trade[] = []
    const modifiedIndexes: Record<string, number> = {}
    let contractStatusAction: ContractStatusAction = undefined
    let notifyTimestamp: bigint = BigInt(0)

    for (const block of ctx.blocks) {
      const timestamp = BigInt(block.header.timestamp)
      notifyTimestamp = timestamp
      for (const log of block.logs) {
        const transactionHash = (log as Log & { transactionHash: string }).transactionHash
        const topic = log.topics[0]
        switch (topic) {
          case marketplaceAbi.events.Traded.topic: {
            const { _signature, _trade, _caller } = marketplaceAbi.events.Traded.decode(log)
            tradesToInsert.push(
              new Trade({
                id: uuidv4(),
                network,
                action: TradeAction.executed,
                signature: _signature,
                timestamp,
                caller: _caller,
                txHash: transactionHash,
                sentBeneficiary: _trade.sent[0].beneficiary,
                receivedBeneficiary: _trade.received[0].beneficiary
              })
            )
            break
          }
          case marketplaceAbi.events.ContractSignatureIndexIncreased.topic: {
            // Record the authoritative post-increment value carried by the event, not a running count.
            // The index is an absolute monotonic counter the server compares exactly against a trade's
            // signed contractSignatureIndex, so it must reflect the true on-chain value.
            const { _newValue } = marketplaceAbi.events.ContractSignatureIndexIncreased.decode(log)
            modifiedIndexes[marketplaceContractAddress] = Number(_newValue)
            break
          }
          case marketplaceAbi.events.SignerSignatureIndexIncreased.topic: {
            // Record the authoritative post-increment value carried by the event (see the contract-index case).
            const { _caller, _newValue } = marketplaceAbi.events.SignerSignatureIndexIncreased.decode(log)
            modifiedIndexes[_caller] = Number(_newValue)
            break
          }

          case marketplaceAbi.events.SignatureCancelled.topic: {
            const { _signature, _caller } = marketplaceAbi.events.SignatureCancelled.decode(log)
            tradesToInsert.push(
              new Trade({
                id: uuidv4(),
                network,
                action: TradeAction.cancelled,
                signature: _signature,
                timestamp,
                txHash: transactionHash,
                sentBeneficiary: null,
                caller: _caller,
                receivedBeneficiary: null
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
    const indexesToUpsert: SignatureIndex[] = getIndexesToUpsert(network, modifiedIndexes)

    await sendEvents(ctx.store, tradesToInsert, notifyTimestamp)

    await ctx.store.upsert(contractStatusToUpsert)
    await ctx.store.upsert(indexesToUpsert)
    await ctx.store.upsert(tradesToInsert)
  }
}
