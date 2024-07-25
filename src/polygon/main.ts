import * as polygonMarketplaceAbi from '../abi/DecentralandMarketplacePolygon'
import { getDb } from '../common/db'
import { getDataHandler } from '../common/handler'
import { createOffchainMarketplaceProcessor } from '../common/processor'
import { ProcessorConfig, processorConfig } from '../common/utils/config'
import { Network } from '../model'

const config: ProcessorConfig = processorConfig[Network.polygon][process.env.ETHEREUM_CHAIN_ID]

const processor = createOffchainMarketplaceProcessor({
  address: config.marketplaceAddress,
  fromBlock: config.fromBlock,
  gateway: `https://v2.archive.subsquid.io/network/${config.gatewayNetwork}`,
  rpcEndpoint: process.env.POLYGON_RPC_ENDPOINT,
  abi: polygonMarketplaceAbi
})

processor.run(getDb(Network.polygon), getDataHandler(polygonMarketplaceAbi, config.marketplaceAddress, Network.polygon))
