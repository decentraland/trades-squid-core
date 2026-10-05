module.exports = class Data1791212615152 {
    name = 'Data1791212615152'

    async up(db) {
        await db.query(`CREATE TABLE "signature_index_increase" ("id" character varying NOT NULL, "kind" character varying(8) NOT NULL, "address" text NOT NULL, "contract" text NOT NULL, "network" character varying(8) NOT NULL, "new_value" integer NOT NULL, "caller" text NOT NULL, "timestamp" numeric NOT NULL, "block_number" integer NOT NULL, "tx_hash" text NOT NULL, "log_index" integer NOT NULL, CONSTRAINT "PK_e877ee6ef4c7ca0b88ef839f3a1" PRIMARY KEY ("id"))`)
        await db.query(`CREATE INDEX "IDX_ea22a799bbefd2206a8c414a49" ON "signature_index_increase" ("address", "contract", "network", "new_value") `)
    }

    async down(db) {
        // DROP TABLE takes its index with it; a separate DROP INDEX afterwards would fail the revert.
        await db.query(`DROP TABLE IF EXISTS "signature_index_increase"`)
    }
}
