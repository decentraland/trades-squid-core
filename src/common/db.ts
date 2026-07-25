import { TypeormDatabase } from '@subsquid/typeorm-store'
import { Network } from '../model'

const schema = process.env.DB_SCHEMA

export function getDb(network: Network) {
  return new TypeormDatabase({
    isolationLevel: 'READ COMMITTED',
    // Portal ingests from the finalized stream: a log-filtered stream yields
    // non-contiguous blocks, which the hot-block path rejects ("blocks must form a
    // continuous chain"). Only processing finalized blocks also means no reorg re-emits.
    supportHotBlocks: false,
    stateSchema: `${network.toLowerCase()}_processor_${schema}`
  })
}
