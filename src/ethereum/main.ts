import * as ethereumMarketplaceAbi from '../abi/DecentralandMarketplaceEthereum'
import { getDb } from '../common/db'
import { getDataHandler } from '../common/handler'
import { createOffchainMarketplaceProcessor } from '../common/processor'
import { ProcessorConfig, processorConfig } from '../common/utils/config'
import { Network } from '../model'

const config: ProcessorConfig = processorConfig[Network.ETHEREUM][process.env.ETHEREUM_CHAIN_ID]

const processor = createOffchainMarketplaceProcessor({
  network: Network.ETHEREUM,
  address: config.marketplaceAddress,
  fromBlock: config.fromBlock,
  gateway: `https://v2.archive.subsquid.io/network/${config.gatewayNetwork}`,
  rpcEndpoint: process.env.RPC_ENDPOINT_ETH,
  abi: ethereumMarketplaceAbi,
  prometheusPort: parseInt(process.env.ETH_PROMETHEUS_PORT) || 3000
})

processor.run(getDb(Network.ETHEREUM), getDataHandler(ethereumMarketplaceAbi, config.marketplaceAddress, Network.ETHEREUM))
