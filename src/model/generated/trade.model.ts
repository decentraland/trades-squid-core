import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, StringColumn as StringColumn_, Index as Index_, BigIntColumn as BigIntColumn_} from "@subsquid/typeorm-store"
import {Network} from "./_network"
import {TradeAction} from "./_tradeAction"

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

    @StringColumn_({nullable: true})
    sentBeneficiary!: string | undefined | null

    @StringColumn_({nullable: true})
    receivedBeneficiary!: string | undefined | null
}
