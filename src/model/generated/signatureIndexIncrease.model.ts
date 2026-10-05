import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, Index as Index_, StringColumn as StringColumn_, IntColumn as IntColumn_, BigIntColumn as BigIntColumn_} from "@subsquid/typeorm-store"
import {SignatureIndexKind} from "./_signatureIndexKind"
import {Network} from "./_network"

/**
 * One row per ContractSignatureIndexIncreased / SignerSignatureIndexIncreased LOG.
 * 
 * `SignatureIndex` keeps only the latest value of each counter. This keeps every bump with its block time,
 * so a consumer can tell which counter invalidated a signed trade and when — e.g. a trade cancelled by a
 * contract-wide bump versus one its signer revoked.
 * 
 * The index serves "the bump that moved this counter past a signed value": counters only ever increase,
 * so that is the lowest `newValue` above it. For a contract bump `address` equals `contract`.
 */
@Index_(["address", "contract", "network", "newValue"], {unique: false})
@Entity_()
export class SignatureIndexIncrease {
    constructor(props?: Partial<SignatureIndexIncrease>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Column_("varchar", {length: 8, nullable: false})
    kind!: SignatureIndexKind

    /**
     * The marketplace itself for a contract bump, the signer for a signer bump.
     */
    @StringColumn_({nullable: false})
    address!: string

    /**
     * The marketplace deployment whose counter was bumped.
     */
    @StringColumn_({nullable: false})
    contract!: string

    @Column_("varchar", {length: 8, nullable: false})
    network!: Network

    @IntColumn_({nullable: false})
    newValue!: number

    @StringColumn_({nullable: false})
    caller!: string

    @BigIntColumn_({nullable: false})
    timestamp!: bigint

    @IntColumn_({nullable: false})
    blockNumber!: number

    @StringColumn_({nullable: false})
    txHash!: string

    @IntColumn_({nullable: false})
    logIndex!: number
}
