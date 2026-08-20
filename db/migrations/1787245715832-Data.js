module.exports = class Data1787245715832 {
    name = 'Data1787245715832'

    async up(db) {
        await db.query(`ALTER TABLE "trade" ADD "trade_digest" text`)
        await db.query(`CREATE INDEX "IDX_1785ec8d0a6cc461fef532550a" ON "trade" ("trade_digest") `)
    }

    async down(db) {
        await db.query(`ALTER TABLE "trade" DROP COLUMN "trade_digest"`)
        await db.query(`DROP INDEX "public"."IDX_1785ec8d0a6cc461fef532550a"`)
    }
}
