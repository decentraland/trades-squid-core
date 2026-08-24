module.exports = class Data1787245715832 {
    name = 'Data1787245715832'

    async up(db) {
        await db.query(`ALTER TABLE "trade" ADD "trade_digest" text`)
        await db.query(`CREATE INDEX "IDX_1785ec8d0a6cc461fef532550a" ON "trade" ("trade_digest") `)
    }

    async down(db) {
        // Index first: DROP COLUMN takes its dependent indexes with it, so the reverse order leaves the
        // following DROP INDEX with nothing to drop and the revert fails. IF EXISTS keeps it idempotent.
        await db.query(`DROP INDEX IF EXISTS "public"."IDX_1785ec8d0a6cc461fef532550a"`)
        await db.query(`ALTER TABLE "trade" DROP COLUMN IF EXISTS "trade_digest"`)
    }
}
