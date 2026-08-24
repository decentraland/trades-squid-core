import * as decentralandMarketplaceEthereum from '../abi/DecentralandMarketplaceEthereum'
import * as decentralandMarketplaceEthereumV3 from '../abi/DecentralandMarketplaceEthereumV3'
import * as decentralandMarketplacePolygon from '../abi/DecentralandMarketplacePolygon'
import * as decentralandMarketplacePolygonV3 from '../abi/DecentralandMarketplacePolygonV3'

export type OffchainMarketplaceAbi = typeof decentralandMarketplaceEthereum | typeof decentralandMarketplacePolygon

/**
 * V3 is a separate alias rather than another member of `OffchainMarketplaceAbi`: its `Traded` decodes to a
 * different shape (it carries `_tradeDigest`), so folding it into that union would make every existing
 * destructuring of a decoded trade a type error.
 */
export type OffchainMarketplaceAbiV3 = typeof decentralandMarketplaceEthereumV3 | typeof decentralandMarketplacePolygonV3
