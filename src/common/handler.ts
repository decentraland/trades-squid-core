import { DataHandlerContext, Log } from '@subsquid/evm-processor'
import { Store } from '@subsquid/typeorm-store'
import { v4 as uuidv4 } from 'uuid';
import { ContractStatus, Network, SignatureIndex, TradeAction, Trade } from '../model'
import { OffchainMarketplaceAbi } from './types'
import { sendEvents } from './utils/events'

function getContractStatusToUpsert(network: Network, pausedByAddress: Map<string, boolean>): ContractStatus[] {
  // `pausedByAddress` holds the final paused state per emitting contract for this batch (last event wins),
  // so the row is upserted to that absolute value. Status is keyed by the contract that actually emitted the
  // Paused/Unpaused log (the processor watches both the V1 and V2 marketplace addresses). This drops the old
  // single-action-per-batch netting, which left a stale state when a batch contained both a Paused and an
  // Unpaused, and it no longer reads the stored row, which removes the null dereference that crashed the
  // batch on a contract's first pause when no ContractStatus row existed yet.
  return Array.from(
    pausedByAddress,
    ([address, paused]) => new ContractStatus({ id: `${address}-${network}`, address, network, paused })
  )
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
    const pausedByAddress = new Map<string, boolean>()
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
            // NOTE: intentionally keyed by the configured marketplace address, not the emitting log address.
            // The marketplace-server's contract-index join matches these rows by network across the known
            // marketplace addresses, so writing one row per contract (V1 + V2) would make it produce
            // duplicate trade rows. Scoping V1/V2 correctly needs a matching server-side change and is
            // tracked as a separate follow-up.
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
            // Track the final paused state per emitting contract; the last event in the batch wins.
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
