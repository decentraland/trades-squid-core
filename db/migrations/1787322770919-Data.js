module.exports = class Data1787322770919 {
    name = 'Data1787322770919'

    async up(db) {
        // NOT NULL with no default, so this expects an empty table. That is what it gets: the indexer
        // builds a fresh schema per commit hash and reindexes from scratch, and this change alters the
        // identity of a signature_index row anyway (id is now address-contract-network), so rows written
        // under the old two-part identity could not be carried forward.
        await db.query(`ALTER TABLE "signature_index" ADD "contract" text NOT NULL`)
        await db.query(`CREATE INDEX "IDX_a43b0cc9b8d7c3fbbf56af047a" ON "signature_index" ("contract") `)
    }

    async down(db) {
        // Index first: DROP COLUMN takes its dependent indexes with it, so the reverse order leaves the
        // following DROP INDEX with nothing to drop and the revert fails. IF EXISTS keeps it idempotent.
        await db.query(`DROP INDEX IF EXISTS "public"."IDX_a43b0cc9b8d7c3fbbf56af047a"`)
        await db.query(`ALTER TABLE "signature_index" DROP COLUMN IF EXISTS "contract"`)
    }
}
