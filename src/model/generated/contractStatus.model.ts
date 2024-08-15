import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, StringColumn as StringColumn_, Index as Index_, BooleanColumn as BooleanColumn_} from "@subsquid/typeorm-store"
import {Network} from "./_network"

@Entity_()
export class ContractStatus {
    constructor(props?: Partial<ContractStatus>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Index_()
    @StringColumn_({nullable: false})
    address!: string

    @Column_("varchar", {length: 8, nullable: false})
    network!: Network

    @BooleanColumn_({nullable: false})
    paused!: boolean
}
