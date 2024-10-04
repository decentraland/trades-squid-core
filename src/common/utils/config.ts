import { ChainId } from '@dcl/schemas'
import { Network } from '../../model'

export type ProcessorConfig = { marketplaceAddress: string; fromBlock: number; gatewayNetwork: string }

export const processorConfig: Record<Network, Partial<Record<ChainId, ProcessorConfig>>> = {
  [Network.ETHEREUM]: {
    [ChainId.ETHEREUM_MAINNET]: {
      marketplaceAddress: '0x2d6b3508f9aca32d2550f92b2addba932e73c1ff',
      fromBlock: 20843699,
      gatewayNetwork: 'ethereum-mainnet'
    },
    [ChainId.ETHEREUM_SEPOLIA]: {
      marketplaceAddress: '0x54bdd3ffc1448bdab0251f05dd554eec803adb2f',
      fromBlock: 6770056,
      gatewayNetwork: 'ethereum-sepolia'
    }
  },
  [Network.POLYGON]: {
    [ChainId.MATIC_MAINNET]: {
      marketplaceAddress: '0x540fb08edb56aae562864b390542c97f562825ba',
      fromBlock: 62349044,
      gatewayNetwork: 'polygon-mainnet'
    },
    [ChainId.MATIC_AMOY]: {
      marketplaceAddress: '0x6ab20ae56673ed65f520b7be332aeb61b3ed727d',
      fromBlock: 12490079,
      gatewayNetwork: 'polygon-amoy-testnet'
    }
  }
}
