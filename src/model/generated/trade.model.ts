import {
  Entity as Entity_,
  Column as Column_,
  PrimaryColumn as PrimaryColumn_,
  IntColumn as IntColumn_,
  StringColumn as StringColumn_,
  Index as Index_,
} from "@subsquid/typeorm-store";
import { Network } from "./_network";
import { TradeStatus } from "./_tradeStatus";

@Entity_()
export class Trade {
  constructor(props?: Partial<Trade>) {
    Object.assign(this, props);
  }

  @PrimaryColumn_()
  id!: string;

  @IntColumn_({ nullable: false })
  uses!: number;

  @Index_()
  @StringColumn_({ nullable: false })
  signature!: string;

  @Column_("varchar", { length: 8, nullable: false })
  network!: Network;

  @Column_("varchar", { length: 9, nullable: false })
  status!: TradeStatus;
}
