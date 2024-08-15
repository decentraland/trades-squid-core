import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, StringColumn as StringColumn_, Index as Index_, IntColumn as IntColumn_} from "@subsquid/typeorm-store"
import {Network} from "./_network"

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

    @Column_("varchar", {length: 8, nullable: false})
    network!: Network

    @IntColumn_({nullable: false})
    index!: number
}
