import * as marketplaceAbi from '../abi/DecentralandMarketplacePolygon'
import * as marketplaceAbiV3 from '../abi/DecentralandMarketplacePolygonV3'
import { Network, SignatureIndex, SignatureIndexIncrease, SignatureIndexKind } from '../model'
import { getDataHandler } from './handler'
import { Context } from './processor'

jest.mock('./utils/events', () => ({ sendEvents: jest.fn() }))

const MARKETPLACE = '0x540fb08edb56aae562864b390542c97f562825ba'
const OWNER = '0x1111111111111111111111111111111111111111'
const SIGNER = '0x2222222222222222222222222222222222222222'
const TX_HASH = '0xabc'

type TestLog = { address: string; topics: string[]; data: string; transactionHash: string; logIndex: number }

function pad32(hex: string): string {
  return '0x' + hex.replace(/^0x/, '').padStart(64, '0')
}

function indexIncreasedLog(topic: string, caller: string, newValue: number, logIndex: number): TestLog {
  return {
    address: MARKETPLACE,
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
})
