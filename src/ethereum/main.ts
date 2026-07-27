import { run } from '@subsquid/batch-processor'
import * as evmObjects from '@subsquid/evm-objects'
import * as ethereumMarketplaceAbi from '../abi/DecentralandMarketplaceEthereum'
import { getDb } from '../common/db'
import { getDataHandler } from '../common/handler'
import { createOffchainMarketplaceProcessor } from '../common/processor'
import { ProcessorConfig, processorConfigV1, processorConfigV2 } from '../common/utils/config'
import { Network } from '../model'

const config: ProcessorConfig = processorConfigV1[Network.ETHEREUM][process.env.ETHEREUM_CHAIN_ID]
const configV2: ProcessorConfig = processorConfigV2[Network.ETHEREUM][process.env.ETHEREUM_CHAIN_ID]

const { dataSource, prometheus } = createOffchainMarketplaceProcessor({
  address: config.marketplaceAddress,
  addressV2: configV2.marketplaceAddress,
  fromBlock: config.fromBlock,
  fromBlockV2: configV2.fromBlock,
  portalDataset: config.gatewayNetwork,
  abi: ethereumMarketplaceAbi,
  prometheusPort: parseInt(process.env.ETH_PROMETHEUS_PORT) || 3000
})

const handler = getDataHandler(ethereumMarketplaceAbi, config.marketplaceAddress, Network.ETHEREUM)

run(
  dataSource,
  getDb(Network.ETHEREUM),
  // run() hands over a bare {store, blocks, isHead}; augment the blocks so the handler
  // sees the block.logs / log.transaction back-references it relies on.
  ctx => handler({ ...ctx, blocks: ctx.blocks.map(evmObjects.augmentBlock) }),
  { prometheus }
)
