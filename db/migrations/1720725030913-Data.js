module.exports = class Data1720725030913 {
    name = 'Data1720725030913'

    async up(db) {
        await db.query(`CREATE TABLE "trade" ("id" character varying NOT NULL, "uses" integer NOT NULL, "signature" text NOT NULL, "network" character varying(8) NOT NULL, "status" character varying(9) NOT NULL, CONSTRAINT "PK_d4097908741dc408f8274ebdc53" PRIMARY KEY ("id"))`)
        await db.query(`CREATE INDEX "IDX_1897941180275e08180df10725" ON "trade" ("signature") `)
        await db.query(`CREATE TABLE "signature_index" ("id" character varying NOT NULL, "address" text NOT NULL, "network" character varying(8) NOT NULL, "index" integer NOT NULL, CONSTRAINT "PK_ffa4422e3338f8a5632922e6d4e" PRIMARY KEY ("id"))`)
        await db.query(`CREATE INDEX "IDX_836f411c550ddeb130a661e9fe" ON "signature_index" ("address") `)
        await db.query(`CREATE TABLE "contract_status" ("id" character varying NOT NULL, "address" text NOT NULL, "network" character varying(8) NOT NULL, "paused" boolean NOT NULL, CONSTRAINT "PK_14a66107c6d68e6c40c80de1f86" PRIMARY KEY ("id"))`)
        await db.query(`CREATE INDEX "IDX_49869f2090a82818887ebb61ae" ON "contract_status" ("address") `)
    }

    async down(db) {
        await db.query(`DROP TABLE "trade"`)
        await db.query(`DROP INDEX "public"."IDX_1897941180275e08180df10725"`)
        await db.query(`DROP TABLE "signature_index"`)
        await db.query(`DROP INDEX "public"."IDX_836f411c550ddeb130a661e9fe"`)
        await db.query(`DROP TABLE "contract_status"`)
        await db.query(`DROP INDEX "public"."IDX_49869f2090a82818887ebb61ae"`)
    }
}
