import { TypeormDatabase } from '@subsquid/typeorm-store'
import { Network } from '../model'

// SQUID_SCHEMA, not DB_SCHEMA: typeorm-config would turn the latter into a
// per-connection search_path pin that promotion invalidates (see indexer.sh).
const schema = process.env.SQUID_SCHEMA

export function getDb(network: Network) {
  return new TypeormDatabase({
    isolationLevel: 'READ COMMITTED',
    // Index the unfinalized tip, and roll it back if the chain reorganises.
    //
    // With this false the processor reads Portal's FINALIZED stream, which left every L1
    // listing cancellation and bid retract ~20 minutes behind the user's transaction, two
    // Ethereum epochs. It also parks the squid at whatever the Portal last finalized, so a
    // stalled dataset stops the squid silently: the progress metric divides by the finalized
    // head, so it still reads 100% while the squid falls hours behind the chain.
    //
    // The comment this replaces claimed the hot path rejects the non-contiguous blocks a
    // log-filtered stream yields. It does not: the continuity check only requires block
    // numbers to increase, never adjacency. Hot blocks do need typeorm-store >= 1.9.2, which
    // relaxed that check from `prev.height + 1` to `> prev.height`.
    //
    // This restores the pre-Portal behaviour: before the migration nothing was set here, and
    // the default is on.
    supportHotBlocks: true,
    stateSchema: `${network.toLowerCase()}_processor_${schema}`
  })
}
