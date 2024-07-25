import * as decentralandMarketplaceEthereum from '../abi/DecentralandMarketplaceEthereum'
import * as decentralandMarketplacePolygon from '../abi/DecentralandMarketplacePolygon'

export type OffchainMarketplaceAbi = typeof decentralandMarketplaceEthereum | typeof decentralandMarketplacePolygon
