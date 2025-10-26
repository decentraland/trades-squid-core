import * as polygonMarketplaceAbi from '../abi/DecentralandMarketplacePolygon'
import { getDb } from '../common/db'
import { getDataHandler } from '../common/handler'
import { createOffchainMarketplaceProcessor } from '../common/processor'
import { ProcessorConfig, processorConfigV1, processorConfigV2 } from '../common/utils/config'
import { Network } from '../model'

const config: ProcessorConfig = processorConfigV1[Network.POLYGON][process.env.POLYGON_CHAIN_ID]
const configV2: ProcessorConfig = processorConfigV2[Network.POLYGON][process.env.POLYGON_CHAIN_ID]

const processor = createOffchainMarketplaceProcessor({
  network: Network.POLYGON,
  address: config.marketplaceAddress,
  addressV2: configV2.marketplaceAddress,
  fromBlock: config.fromBlock,
  fromBlockV2: configV2.fromBlock,
  gateway: `https://v2.archive.subsquid.io/network/${config.gatewayNetwork}`,
  rpcEndpoint: process.env.RPC_ENDPOINT_POLYGON,
  abi: polygonMarketplaceAbi,
  prometheusPort: parseInt(process.env.POLYGON_PROMETHEUS_PORT) || 3001
})

processor.run(getDb(Network.POLYGON), getDataHandler(polygonMarketplaceAbi, config.marketplaceAddress, Network.POLYGON))
