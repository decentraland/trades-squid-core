import { PrometheusServer } from '@subsquid/batch-processor'
import * as evmObjects from '@subsquid/evm-objects'
import { DataSourceBuilder, FieldSelection } from '@subsquid/evm-stream'
import { Store } from '@subsquid/typeorm-store'
import { OffchainMarketplaceAbi } from './types'

type TradesProcessorOptions = {
  address: string
  addressV2: string
  fromBlockV2: number
  portalDataset: string
  fromBlock: number
  abi: OffchainMarketplaceAbi
  prometheusPort: number
}

// Field selection for the Portal stream. Portal fetches ONLY these fields (unlike the
// v2 gateway it does not merge a default set), so everything the handler reads must be
// listed here. This squid is log-only: it needs the block timestamp plus the log
// topics/data to decode events, and the transaction hash to record on each trade.
export const fields = {
  block: { timestamp: true },
  log: { address: true, topics: true, data: true, transactionHash: true }
} satisfies FieldSelection

export type Fields = typeof fields

// Blocks and logs as seen by the handler, i.e. after evmObjects.augmentBlock has
// restored the block.logs / log.transaction back-references.
export type BlockData = evmObjects.Block<Fields>
export type Log = evmObjects.Log<Fields>

// The batch context the handler receives. run() provides a bare {store, blocks,
// isHead}; the blocks are augmented in each processor entrypoint.
export type Context = {
  store: Store
  blocks: BlockData[]
  isHead: boolean
}

export function createOffchainMarketplaceProcessor({
  address,
  addressV2,
  fromBlockV2,
  portalDataset,
  fromBlock,
  abi,
  prometheusPort
}: TradesProcessorOptions) {
  const topic0 = [
    abi.events.Traded.topic,
    abi.events.SignatureCancelled.topic,
    abi.events.ContractSignatureIndexIncreased.topic,
    abi.events.SignerSignatureIndexIncreased.topic,
    abi.events.Paused.topic,
    abi.events.Unpaused.topic
  ]

  // SQD Network Portal replaces the deprecated v2 archive gateway. Portal serves
  // real-time data and handles finality itself, so the RPC endpoint and the finality
  // confirmation setting are gone: this squid reads no contract state, so it needs no
  // RPC client at all.
  const dataSource = new DataSourceBuilder()
    .setPortal(`https://portal.sqd.dev/datasets/${portalDataset}`)
    .setBlockRange({ from: fromBlock })
    .setFields(fields)
    .addLog({ where: { address: [address], topic0 } })
    .addLog({ where: { address: [addressV2], topic0 }, range: { from: fromBlockV2 } })
    .build()

  // The squid management server scrapes /metrics on this port to tell whether the
  // processor is live (sqd_processor_last_block / chain_height). setPrometheusPort used
  // to do this on the batch processor; with the Portal run() we wire it explicitly.
  const prometheus = new PrometheusServer()
  prometheus.setPort(prometheusPort)

  return { dataSource, prometheus }
}
