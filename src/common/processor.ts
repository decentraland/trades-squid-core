import { PrometheusServer } from '@subsquid/batch-processor'
import * as evmObjects from '@subsquid/evm-objects'
import { DataSourceBuilder, FieldSelection } from '@subsquid/evm-stream'
import { Store } from '@subsquid/typeorm-store'
import { OffchainMarketplaceAbi, OffchainMarketplaceAbiV3 } from './types'
import { portalSource } from './utils/portal'

type TradesProcessorOptions = {
  address: string
  addressV2: string
  fromBlockV2: number
  // V3 is not deployed on mainnet yet, so both are absent on those chains.
  addressV3?: string
  fromBlockV3?: number
  portalDataset: string
  fromBlock: number
  abi: OffchainMarketplaceAbi
  abiV3: OffchainMarketplaceAbiV3
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
  addressV3,
  fromBlockV3,
  portalDataset,
  fromBlock,
  abi,
  abiV3,
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
  // RPC client at all. See portalSource for which endpoint is used and why.
  // V3 only differs from V1/V2 in `Traded`, whose topic moved because the event gained an indexed
  // _tradeDigest. Every other topic is byte-identical, so only that one must come from the V3 module —
  // reusing `topic0` here would filter V3 logs on a topic no V3 log carries and match nothing, silently.
  const topic0V3 = [
    abiV3.events.Traded.topic,
    abi.events.SignatureCancelled.topic,
    abi.events.ContractSignatureIndexIncreased.topic,
    abi.events.SignerSignatureIndexIncreased.topic,
    abi.events.Paused.topic,
    abi.events.Unpaused.topic
  ]

  const builder = new DataSourceBuilder()
    .setPortal(portalSource(portalDataset))
    .setBlockRange({ from: fromBlock })
    .setFields(fields)
    .addLog({ where: { address: [address], topic0 } })
    .addLog({ where: { address: [addressV2], topic0 }, range: { from: fromBlockV2 } })

  // Explicit undefined checks rather than truthiness: a fromBlock of 0 is falsy but valid.
  if (addressV3 !== undefined && fromBlockV3 !== undefined) {
    builder.addLog({ where: { address: [addressV3], topic0: topic0V3 }, range: { from: fromBlockV3 } })
  }

  const dataSource = builder.build()

  // The squid management server scrapes /metrics on this port to tell whether the
  // processor is live (sqd_processor_last_block / chain_height). setPrometheusPort used
  // to do this on the batch processor; with the Portal run() we wire it explicitly.
  const prometheus = new PrometheusServer()
  prometheus.setPort(prometheusPort)

  return { dataSource, prometheus }
}
