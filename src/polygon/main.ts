import { run } from '@subsquid/batch-processor'
import * as evmObjects from '@subsquid/evm-objects'
import * as polygonMarketplaceAbi from '../abi/DecentralandMarketplacePolygon'
import * as polygonMarketplaceAbiV3 from '../abi/DecentralandMarketplacePolygonV3'
import { getDb } from '../common/db'
import { getDataHandler } from '../common/handler'
import { createOffchainMarketplaceProcessor } from '../common/processor'
import { ProcessorConfig, processorConfigV1, processorConfigV2, processorConfigV3 } from '../common/utils/config'
import { Network } from '../model'

const config: ProcessorConfig = processorConfigV1[Network.POLYGON][process.env.POLYGON_CHAIN_ID]
const configV2: ProcessorConfig = processorConfigV2[Network.POLYGON][process.env.POLYGON_CHAIN_ID]
// Optional on purpose: V3 has no mainnet deployment, so this is undefined there. Dereferencing it
// the way configV1/configV2 are dereferenced would crash the processor at module load on mainnet.
const configV3: ProcessorConfig | undefined = processorConfigV3[Network.POLYGON][process.env.POLYGON_CHAIN_ID]

const { dataSource, prometheus } = createOffchainMarketplaceProcessor({
  address: config.marketplaceAddress,
  addressV2: configV2.marketplaceAddress,
  fromBlock: config.fromBlock,
  fromBlockV2: configV2.fromBlock,
  addressV3: configV3?.marketplaceAddress,
  fromBlockV3: configV3?.fromBlock,
  portalDataset: config.gatewayNetwork,
  abi: polygonMarketplaceAbi,
  abiV3: polygonMarketplaceAbiV3,
  prometheusPort: parseInt(process.env.POLYGON_PROMETHEUS_PORT) || 3001
})

const handler = getDataHandler(polygonMarketplaceAbi, polygonMarketplaceAbiV3, Network.POLYGON, configV3?.marketplaceAddress)

run(
  dataSource,
  getDb(Network.POLYGON),
  // run() hands over a bare {store, blocks, isHead}; augment the blocks so the handler
  // sees the block.logs / log.transaction back-references it relies on.
  ctx => handler({ ...ctx, blocks: ctx.blocks.map(evmObjects.augmentBlock) }),
  { prometheus }
)
