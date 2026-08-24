import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, StringColumn as StringColumn_, Index as Index_, IntColumn as IntColumn_} from "@subsquid/typeorm-store"
import {Network} from "./_network"

/**
 * One counter, scoped to the marketplace contract that holds it.
 * 
 * Both counters the marketplace keeps live here: `contractSignatureIndex`, where `address` is the
 * marketplace itself, and `signerSignatureIndex(signer)`, where `address` is the signer. Both are storage on
 * a specific deployment, so V1, V2 and V3 each keep their own and they start at zero independently.
 * 
 * `contract` is therefore part of the identity, not decoration: keyed on `address + network` alone, a signer
 * bumping their index on V3 overwrote their V2 row, which let a bump on one version cancel trades signed
 * against another, and let a lower counter from a later version make a genuinely revoked trade look valid.
 */
@Entity_()
export class SignatureIndex {
    constructor(props?: Partial<SignatureIndex>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Index_()
    @StringColumn_({nullable: false})
    address!: string

    /**
     * The marketplace deployment whose storage this counter came from.
     */
    @Index_()
    @StringColumn_({nullable: false})
    contract!: string

    @Column_("varchar", {length: 8, nullable: false})
    network!: Network

    @IntColumn_({nullable: false})
    index!: number
}
