import * as ethereumMarketplaceAbi from '../abi/DecentralandMarketplaceEthereum'
import { getDb } from '../common/db'
import { getDataHandler } from '../common/handler'
import { createOffchainMarketplaceProcessor } from '../common/processor'
import { ProcessorConfig, processorConfig } from '../common/utils/config'
import { Network } from '../model'

const config: ProcessorConfig = processorConfig[Network.ethereum][process.env.ETHEREUM_CHAIN_ID]

const processor = createOffchainMarketplaceProcessor({
  address: config.marketplaceAddress,
  fromBlock: config.fromBlock,
  gateway: `https://v2.archive.subsquid.io/network/${config.gatewayNetwork}`,
  rpcEndpoint: process.env.ETHEREUM_RPC_ENDPOINT,
  abi: ethereumMarketplaceAbi,
  prometheusPort: parseInt(process.env.ETHEREUM_PROMETHEUS_PORT) || 4000
})

processor.run(getDb(Network.ethereum), getDataHandler(ethereumMarketplaceAbi, config.marketplaceAddress, Network.ethereum))
