import { ChainId } from '@dcl/schemas'
import { Network } from '../../model'

export type ProcessorConfig = { marketplaceAddress: string; fromBlock: number; gatewayNetwork: string }

export const processorConfig: Record<Network, Partial<Record<ChainId, ProcessorConfig>>> = {
  [Network.ETHEREUM]: {
    [ChainId.ETHEREUM_MAINNET]: {
      marketplaceAddress: '', // @TODO: Add marketplace address for mainnet once contract is deployed
      fromBlock: 0, // @TODO: Add starting block for mainnet once contract is deployed
      gatewayNetwork: 'ethereum-mainnet'
    },
    [ChainId.ETHEREUM_SEPOLIA]: {
      marketplaceAddress: '0x347ECe82D01A2e7371fD3c1d2F6D4e85029B863f',
      fromBlock: 6481882,
      gatewayNetwork: 'ethereum-sepolia'
    }
  },
  [Network.POLYGON]: {
    [ChainId.MATIC_MAINNET]: {
      marketplaceAddress: '', // @TODO: Add marketplace address for mainnet once contract is deployed
      fromBlock: 0, // @TODO: Add starting block for mainnet once contract is deployed
      gatewayNetwork: 'polygon-mainnet'
    },
    [ChainId.MATIC_AMOY]: {
      marketplaceAddress: '0x55f4d82b0f6a105b9f1959f10a660a4395d755ab',
      fromBlock: 10608489,
      gatewayNetwork: 'polygon-amoy-testnet'
    }
  }
}
