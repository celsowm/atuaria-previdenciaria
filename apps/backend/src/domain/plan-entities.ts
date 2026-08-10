import { Column, Entity, PrimaryKey, col } from "metal-orm";

@Entity({ tableName: "plans" })
export class Plan {
  @PrimaryKey(col.text())
  id!: string;

  @Column(col.notNull(col.unique(col.text())))
  code!: string;

  @Column(col.notNull(col.text()))
  name!: string;

  @Column(col.notNull(col.text()))
  modality!: string;

  @Column(col.text())
  sponsorName?: string | null;

  @Column(col.text())
  cnpj?: string | null;

  @Column(col.notNull(col.text()))
  status!: string;

  @Column(col.notNull(col.text()))
  createdAt!: string;

  @Column(col.notNull(col.text()))
  updatedAt!: string;
}
