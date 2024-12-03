import * as polygonMarketplaceAbi from '../abi/DecentralandMarketplacePolygon'
import { getDb } from '../common/db'
import { getDataHandler } from '../common/handler'
import { createOffchainMarketplaceProcessor } from '../common/processor'
import { ProcessorConfig, processorConfig } from '../common/utils/config'
import { Network } from '../model'

const config: ProcessorConfig = processorConfig[Network.POLYGON][process.env.POLYGON_CHAIN_ID]

const processor = createOffchainMarketplaceProcessor({
  address: config.marketplaceAddress,
  fromBlock: config.fromBlock,
  gateway: `https://v2.archive.subsquid.io/network/${config.gatewayNetwork}`,
  rpcEndpoint: process.env.RPC_ENDPOINT_POLYGON,
  abi: polygonMarketplaceAbi,
  prometheusPort: parseInt(process.env.POLYGON_PROMETHEUS_PORT) || 3001
})

processor.run(getDb(Network.POLYGON), getDataHandler(polygonMarketplaceAbi, config.marketplaceAddress, Network.POLYGON))
