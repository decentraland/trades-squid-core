module.exports = class Data1785084434732 {
    name = 'Data1785084434732'

    async up(db) {
        await db.query(`CREATE TABLE "trade" ("id" character varying NOT NULL, "signature" text NOT NULL, "network" character varying(8) NOT NULL, "action" character varying(9) NOT NULL, "timestamp" numeric, "caller" text NOT NULL, "tx_hash" text NOT NULL, "log_index" integer NOT NULL, "sent_beneficiary" text, "received_beneficiary" text, "sent_beneficiaries" text array NOT NULL, "received_beneficiaries" text array NOT NULL, CONSTRAINT "PK_d4097908741dc408f8274ebdc53" PRIMARY KEY ("id"))`)
        await db.query(`CREATE INDEX "IDX_1897941180275e08180df10725" ON "trade" ("signature") `)
        await db.query(`CREATE INDEX "IDX_b7b7bf5b270d79c9793b97f353" ON "trade" ("timestamp", "tx_hash", "log_index") `)
        await db.query(`CREATE TABLE "signature_index" ("id" character varying NOT NULL, "address" text NOT NULL, "network" character varying(8) NOT NULL, "index" integer NOT NULL, CONSTRAINT "PK_ffa4422e3338f8a5632922e6d4e" PRIMARY KEY ("id"))`)
        await db.query(`CREATE INDEX "IDX_836f411c550ddeb130a661e9fe" ON "signature_index" ("address") `)
        await db.query(`CREATE TABLE "contract_status" ("id" character varying NOT NULL, "address" text NOT NULL, "network" character varying(8) NOT NULL, "paused" boolean NOT NULL, CONSTRAINT "PK_14a66107c6d68e6c40c80de1f86" PRIMARY KEY ("id"))`)
        await db.query(`CREATE INDEX "IDX_49869f2090a82818887ebb61ae" ON "contract_status" ("address") `)
    }

    async down(db) {
        await db.query(`DROP TABLE "trade"`)
        await db.query(`DROP INDEX "public"."IDX_1897941180275e08180df10725"`)
        await db.query(`DROP INDEX "public"."IDX_b7b7bf5b270d79c9793b97f353"`)
        await db.query(`DROP TABLE "signature_index"`)
        await db.query(`DROP INDEX "public"."IDX_836f411c550ddeb130a661e9fe"`)
        await db.query(`DROP TABLE "contract_status"`)
        await db.query(`DROP INDEX "public"."IDX_49869f2090a82818887ebb61ae"`)
    }
}
