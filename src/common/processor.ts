import { EvmBatchProcessor } from '@subsquid/evm-processor'
import { Network } from '../model'
import { OffchainMarketplaceAbi } from './types'

type TradesProcessorOptions = {
  network: Network
  address: string
  addressV2: string
  fromBlockV2: number
  gateway: string
  rpcEndpoint: string
  fromBlock: number
  abi: OffchainMarketplaceAbi
  prometheusPort: number
}

export function createOffchainMarketplaceProcessor({
  network,
  address,
  addressV2,
  fromBlockV2,
  gateway,
  rpcEndpoint,
  fromBlock,
  abi,
  prometheusPort
}: TradesProcessorOptions) {
  const FINALITY_CONFIRMATION = parseInt(process.env[`FINALITY_CONFIRMATION_${network.toUpperCase()}`] || '75')

  return new EvmBatchProcessor()
    .setBlockRange({ from: fromBlock })
    .setPrometheusPort(prometheusPort)
    .setGateway(gateway)
    .setRpcEndpoint({
      url: rpcEndpoint,
      rateLimit: 10
    })
    .setFields({
      log: {
        transactionHash: true
      }
    })
    .setFinalityConfirmation(FINALITY_CONFIRMATION)
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
    .addLog({
      address: [addressV2],
      range: {
        from: fromBlockV2
      },
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
