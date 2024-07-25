import { EvmBatchProcessor } from '@subsquid/evm-processor'
import { OffchainMarketplaceAbi } from './types'

type TradesProcessorOptions = {
  address: string
  gateway: string
  rpcEndpoint: string
  fromBlock: number
  abi: OffchainMarketplaceAbi
}

export function createOffchainMarketplaceProcessor({ address, gateway, rpcEndpoint, fromBlock, abi }: TradesProcessorOptions) {
  return new EvmBatchProcessor()
    .setBlockRange({ from: fromBlock })
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
