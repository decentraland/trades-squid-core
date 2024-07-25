import { EvmBatchProcessor } from '@subsquid/evm-processor'
import { OffchainMarketplaceAbi } from './types'

type TradesProcessorOptions = {
  address: string
  gateway: string
  rpcEndpoint: string
  fromBlock: number
  abi: OffchainMarketplaceAbi
  prometheusPort: number
}

export function createOffchainMarketplaceProcessor({
  address,
  gateway,
  rpcEndpoint,
  fromBlock,
  abi,
  prometheusPort
}: TradesProcessorOptions) {
  return new EvmBatchProcessor()
    .setBlockRange({ from: fromBlock })
    .setPrometheusPort(prometheusPort)
    .setGateway(gateway)
    .setRpcEndpoint({
      url: rpcEndpoint,
      rateLimit: 10
    })
    .setFinalityConfirmation(75)
    .addLog({
      address: [address],
      topic0: [
        abi.events.Traded.topic,
        abi.events.SignatureCancelled.topic,
        abi.events.ContractSignatureIndexIncreased.topic,
        abi.events.SignerSignatureIndexIncreased.topic,
        abi.events.Paused.topic,
        abi.events.Unpaused.topic
      ]
    })
}
