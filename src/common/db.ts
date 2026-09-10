import { TypeormDatabase } from '@subsquid/typeorm-store'
import { Network } from '../model'

// SQUID_SCHEMA, not DB_SCHEMA: typeorm-config would turn the latter into a
// per-connection search_path pin that promotion invalidates (see indexer.sh).
const schema = process.env.SQUID_SCHEMA

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
