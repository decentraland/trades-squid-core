import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, Index as Index_, StringColumn as StringColumn_, BigIntColumn as BigIntColumn_, IntColumn as IntColumn_} from "@subsquid/typeorm-store"
import {Network} from "./_network"
import {TradeAction} from "./_tradeAction"

/**
 * One row per Traded / SignatureCancelled LOG (not per transaction, and not per signature).
 * 
 * `id` is derived from the log's on-chain coordinates (`txHash-logIndex`) rather than generated, which is
 * what makes a row identifiable across reindexes. See the handler for why that matters.
 * 
 * The composite index matches the `(timestamp, txHash, logIndex)` keyset that consumers paginate this table
 * by — the same tuple as their ORDER BY, so a scan resuming from a watermark is an index range read instead
 * of a sequential scan plus a sort of the whole table on every pass.
 * 
 * That tuple, not `timestamp` alone: `timestamp` is block time and repeats across every trade in a block (and
 * across blocks mined in the same second), so a single-column index still leaves the tie-break columns to be
 * sorted. Ordering all three the same way the consumers do makes the resume position directly seekable.
 */
@Index_(["timestamp", "txHash", "logIndex"], {unique: false})
@Entity_()
export class Trade {
    constructor(props?: Partial<Trade>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Index_()
    @StringColumn_({nullable: false})
    signature!: string

    @Column_("varchar", {length: 8, nullable: false})
    network!: Network

    @Column_("varchar", {length: 9, nullable: false})
    action!: TradeAction

    @BigIntColumn_({nullable: true})
    timestamp!: bigint | undefined | null

    @StringColumn_({nullable: false})
    caller!: string

    @StringColumn_({nullable: false})
    txHash!: string

    /**
     * Index of the log within its transaction. Combined with `txHash` it uniquely and STABLY identifies this
     * event, which `signature` alone does not: one transaction can execute the same multi-use trade more than
     * once (a cart buying 2 units of one listing), emitting several Traded logs that are identical in every
     * other column. Consumers that must process each fill exactly once need this to tell them apart.
     */
    @IntColumn_({nullable: false})
    logIndex!: number

    @StringColumn_({nullable: true})
    sentBeneficiary!: string | undefined | null

    @StringColumn_({nullable: true})
    receivedBeneficiary!: string | undefined | null

    /**
     * Beneficiaries of ALL `sent` / `received` legs, in trade order. The singular `sentBeneficiary` /
     * `receivedBeneficiary` above only ever carry leg `[0]`, so a trade routing its price to one address and
     * a fee/royalty to another is invisible to anyone filtering on them — the money moves and the consumer
     * never sees it. These arrays are additive; the singular fields are kept for existing consumers.
     */
    @StringColumn_({array: true, nullable: false})
    sentBeneficiaries!: (string)[]

    @StringColumn_({array: true, nullable: false})
    receivedBeneficiaries!: (string)[]
}
