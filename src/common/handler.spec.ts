import * as marketplaceAbi from '../abi/DecentralandMarketplacePolygon'
import * as marketplaceAbiV3 from '../abi/DecentralandMarketplacePolygonV3'
import { Network, SignatureIndex, SignatureIndexIncrease, SignatureIndexKind } from '../model'
import { getDataHandler } from './handler'
import { Context } from './processor'

jest.mock('./utils/events', () => ({ sendEvents: jest.fn() }))

const MARKETPLACE = '0x540fb08edb56aae562864b390542c97f562825ba'
const MARKETPLACE_V2 = '0xa40b1d129b8906888720686f3a01921ddf37716f'
const MARKETPLACE_V3 = '0xe38ef22abe871513555cba89adfe45ab4f548ada'
const OWNER = '0x1111111111111111111111111111111111111111'
const SIGNER = '0x2222222222222222222222222222222222222222'
const TX_HASH = '0xabc'

type TestLog = { address: string; topics: string[]; data: string; transactionHash: string; logIndex: number }

function pad32(hex: string): string {
  return '0x' + hex.replace(/^0x/, '').padStart(64, '0')
}

function indexIncreasedLog(topic: string, caller: string, newValue: number, logIndex: number, address = MARKETPLACE): TestLog {
  return {
    address,
    topics: [topic, pad32(caller), pad32(newValue.toString(16))],
    data: '0x',
    transactionHash: TX_HASH,
    logIndex
  }
}

function upserted<T>(upsert: jest.Mock, entity: new (...args: never[]) => T): T[] {
  return upsert.mock.calls.flatMap(([rows]) => rows as unknown[]).filter((row): row is T => row instanceof entity)
}

describe('when handling a batch with signature index increases', () => {
  let upsert: jest.Mock
  let logs: TestLog[]
  let ctx: Context

  beforeEach(() => {
    upsert = jest.fn()
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('and the marketplace bumps its contract signature index', () => {
    beforeEach(async () => {
      logs = [indexIncreasedLog(marketplaceAbi.events.ContractSignatureIndexIncreased.topic, OWNER, 1, 3)]
      ctx = {
        store: { upsert },
        blocks: [{ header: { number: 100, timestamp: 1700000000000 }, logs }],
        isHead: false
      } as unknown as Context

      await getDataHandler(marketplaceAbi, marketplaceAbiV3, Network.POLYGON)(ctx)
    })

    it('should record the bump against the marketplace with its block, time and caller', () => {
      expect(upserted(upsert, SignatureIndexIncrease)).toEqual([
        {
          id: `${TX_HASH}-3`,
          kind: SignatureIndexKind.contract,
          address: MARKETPLACE,
          contract: MARKETPLACE,
          network: Network.POLYGON,
          newValue: 1,
          caller: OWNER,
          timestamp: BigInt(1700000000000),
          blockNumber: 100,
          txHash: TX_HASH,
          logIndex: 3
        }
      ])
    })

    it("should set the marketplace's current contract signature index to the new value", () => {
      expect(upserted(upsert, SignatureIndex)).toEqual([
        {
          id: `${MARKETPLACE}-${MARKETPLACE}-${Network.POLYGON}`,
          address: MARKETPLACE,
          contract: MARKETPLACE,
          network: Network.POLYGON,
          index: 1
        }
      ])
    })
  })

  describe('and a signer bumps their signature index twice in the same batch', () => {
    beforeEach(async () => {
      logs = [
        indexIncreasedLog(marketplaceAbi.events.SignerSignatureIndexIncreased.topic, SIGNER, 1, 0),
        indexIncreasedLog(marketplaceAbi.events.SignerSignatureIndexIncreased.topic, SIGNER, 2, 1)
      ]
      ctx = {
        store: { upsert },
        blocks: [{ header: { number: 200, timestamp: 1700000001000 }, logs }],
        isHead: false
      } as unknown as Context

      await getDataHandler(marketplaceAbi, marketplaceAbiV3, Network.POLYGON)(ctx)
    })

    it('should record one signer bump per log, held by the emitting marketplace', () => {
      expect(
        upserted(upsert, SignatureIndexIncrease).map(({ id, kind, address, contract, newValue }) => ({
          id,
          kind,
          address,
          contract,
          newValue
        }))
      ).toEqual([
        { id: `${TX_HASH}-0`, kind: SignatureIndexKind.signer, address: SIGNER, contract: MARKETPLACE, newValue: 1 },
        { id: `${TX_HASH}-1`, kind: SignatureIndexKind.signer, address: SIGNER, contract: MARKETPLACE, newValue: 2 }
      ])
    })

    it("should set the signer's current signature index to the last value only", () => {
      expect(upserted(upsert, SignatureIndex)).toEqual([
        { id: `${SIGNER}-${MARKETPLACE}-${Network.POLYGON}`, address: SIGNER, contract: MARKETPLACE, network: Network.POLYGON, index: 2 }
      ])
    })
  })

  describe('and a signer bumps their signature index on two marketplace versions in the same batch', () => {
    beforeEach(async () => {
      logs = [
        indexIncreasedLog(marketplaceAbi.events.SignerSignatureIndexIncreased.topic, SIGNER, 1, 0, MARKETPLACE),
        indexIncreasedLog(marketplaceAbi.events.SignerSignatureIndexIncreased.topic, SIGNER, 1, 1, MARKETPLACE_V2)
      ]
      ctx = {
        store: { upsert },
        blocks: [{ header: { number: 300, timestamp: 1700000002000 }, logs }],
        isHead: false
      } as unknown as Context

      await getDataHandler(marketplaceAbi, marketplaceAbiV3, Network.POLYGON)(ctx)
    })

    it('should record each bump against the marketplace version that holds the counter', () => {
      expect(upserted(upsert, SignatureIndexIncrease).map(({ address, contract, newValue }) => ({ address, contract, newValue }))).toEqual([
        { address: SIGNER, contract: MARKETPLACE, newValue: 1 },
        { address: SIGNER, contract: MARKETPLACE_V2, newValue: 1 }
      ])
    })

    it("should keep the signer's current signature index separately per marketplace version", () => {
      expect(upserted(upsert, SignatureIndex).map(({ id, contract, index }) => ({ id, contract, index }))).toEqual([
        { id: `${SIGNER}-${MARKETPLACE}-${Network.POLYGON}`, contract: MARKETPLACE, index: 1 },
        { id: `${SIGNER}-${MARKETPLACE_V2}-${Network.POLYGON}`, contract: MARKETPLACE_V2, index: 1 }
      ])
    })
  })

  describe('and the newest marketplace version bumps its contract signature index', () => {
    beforeEach(async () => {
      logs = [indexIncreasedLog(marketplaceAbi.events.ContractSignatureIndexIncreased.topic, OWNER, 1, 2, MARKETPLACE_V3)]
      ctx = {
        store: { upsert },
        blocks: [{ header: { number: 400, timestamp: 1700000003000 }, logs }],
        isHead: false
      } as unknown as Context

      await getDataHandler(marketplaceAbi, marketplaceAbiV3, Network.POLYGON, MARKETPLACE_V3)(ctx)
    })

    it('should record the bump against that version like any other', () => {
      expect(
        upserted(upsert, SignatureIndexIncrease).map(({ kind, address, contract, newValue }) => ({ kind, address, contract, newValue }))
      ).toEqual([{ kind: SignatureIndexKind.contract, address: MARKETPLACE_V3, contract: MARKETPLACE_V3, newValue: 1 }])
    })
  })
})
