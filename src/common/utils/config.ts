import { ChainId } from '@dcl/schemas'
import { Network } from '../../model'

export type ProcessorConfig = { marketplaceAddress: string; fromBlock: number; gatewayNetwork: string }

export const processorConfig: Record<Network, Partial<Record<ChainId, ProcessorConfig>>> = {
  [Network.ethereum]: {
    [ChainId.ETHEREUM_MAINNET]: {
      marketplaceAddress: '', // @TODO: Add marketplace address for mainnet once contract is deployed
      fromBlock: 0, // @TODO: Add starting block for mainnet once contract is deployed
      gatewayNetwork: 'ethereum-mainnet'
    },
    [ChainId.ETHEREUM_SEPOLIA]: {
      marketplaceAddress: '0x868BD98613a5C7f6e67C23BD0A4b14E4663ACF71',
      fromBlock: 6335092,
      gatewayNetwork: 'ethereum-sepolia'
    }
  },
  [Network.polygon]: {
    [ChainId.MATIC_MAINNET]: {
      marketplaceAddress: '', // @TODO: Add marketplace address for mainnet once contract is deployed
      fromBlock: 0, // @TODO: Add starting block for mainnet once contract is deployed
      gatewayNetwork: 'polygon-mainnet'
    },
    [ChainId.MATIC_AMOY]: {
      marketplaceAddress: '0xeeaf5d2dd4b8930039770285aa9be2cf6a9836b4',
      fromBlock: 9643542,
      gatewayNetwork: 'polygon-amoy-testnet'
    }
  }
}
