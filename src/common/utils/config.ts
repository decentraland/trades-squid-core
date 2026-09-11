import { ChainId } from '@dcl/schemas'
import { Network } from '../../model'

export type ProcessorConfig = { marketplaceAddress: string; fromBlock: number; gatewayNetwork: string }

export const processorConfigV1: Record<Network, Partial<Record<ChainId, ProcessorConfig>>> = {
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

export const processorConfigV2: Record<Network, Partial<Record<ChainId, ProcessorConfig>>> = {
  [Network.ETHEREUM]: {
    [ChainId.ETHEREUM_MAINNET]: {
      marketplaceAddress: '0x1b67d0e31eeb6b52d8eeed71d3616c2f5b33b8e7',
      fromBlock: 23598480,
      gatewayNetwork: 'ethereum-mainnet'
    },
    [ChainId.ETHEREUM_SEPOLIA]: {
      marketplaceAddress: '0x1b67d0e31eeb6b52d8eeed71d3616c2f5b33b8e7',
      fromBlock: 9455328,
      gatewayNetwork: 'ethereum-sepolia'
    }
  },
  [Network.POLYGON]: {
    [ChainId.MATIC_MAINNET]: {
      marketplaceAddress: '0xa40b1d129b8906888720686f3a01921ddf37716f',
      fromBlock: 62349044,
      gatewayNetwork: 'polygon-mainnet'
    },
    [ChainId.MATIC_AMOY]: {
      marketplaceAddress: '0x1b67d0e31eeb6b52d8eeed71d3616c2f5b33b8e7',
      fromBlock: 27973529,
      gatewayNetwork: 'polygon-amoy-testnet'
    }
  }
}

/**
 * V3 of the off-chain marketplace, deployed on every chain the other two run on.
 *
 * `Partial<Record<ChainId, ...>>` is kept rather than tightened: it makes an absent chain a lookup that
 * returns undefined instead of a wrong address, and the processor entrypoints already treat the whole
 * entry as optional. That is what let the mainnet chains stay unlisted until they were deployed.
 *
 * `fromBlock` is each contract's own deployment block, so a processor starts at the first block that can
 * carry one of its logs rather than replaying history that provably has none.
 */
export const processorConfigV3: Record<Network, Partial<Record<ChainId, ProcessorConfig>>> = {
  [Network.ETHEREUM]: {
    [ChainId.ETHEREUM_MAINNET]: {
      marketplaceAddress: '0x0f11d0d1671519683bd48abf3dbe779e300941cd',
      fromBlock: 25950329,
      gatewayNetwork: 'ethereum-mainnet'
    },
    [ChainId.ETHEREUM_SEPOLIA]: {
      marketplaceAddress: '0x257db44ac97789c16ab277eae87dcde0c246cc9f',
      fromBlock: 11419771,
      gatewayNetwork: 'ethereum-sepolia'
    }
  },
  [Network.POLYGON]: {
    [ChainId.MATIC_MAINNET]: {
      marketplaceAddress: '0xe38ef22abe871513555cba89adfe45ab4f548ada',
      fromBlock: 93588249,
      gatewayNetwork: 'polygon-mainnet'
    },
    [ChainId.MATIC_AMOY]: {
      marketplaceAddress: '0x36fd1434a6c4b8ade80c9847c1d15033ce34488c',
      fromBlock: 44057476,
      gatewayNetwork: 'polygon-amoy-testnet'
    }
  }
}
