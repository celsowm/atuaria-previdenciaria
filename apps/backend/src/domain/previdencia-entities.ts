import { Entity, col } from "metal-orm";
import { Column, PrimaryKey } from "./colunas-portuguesas.js";

@Entity({ tableName: "entidades_previdencia" })
export class EntidadePrevidencia {
  @PrimaryKey(col.text())
  id!: string;

  @Column(col.notNull(col.unique(col.text())))
  codigo!: string;

  @Column(col.notNull(col.text()))
  nome!: string;

  @Column(col.text())
  cnpj?: string | null;

  @Column(col.notNull(col.text()))
  situacao!: string;

  @Column(col.notNull(col.text()))
  criadoEm!: string;

  @Column(col.notNull(col.text()))
  atualizadoEm!: string;
}

@Entity({ tableName: "submassas" })
export class Submassa {
  @PrimaryKey(col.text())
  id!: string;

  @Column(col.notNull(col.references(col.text(), {
    table: "planos",
    column: "id",
    onDelete: "RESTRICT"
  })))
  planoId!: string;

  @Column(col.notNull(col.text()))
  codigo!: string;

  @Column(col.notNull(col.text()))
  nome!: string;

  @Column(col.notNull(col.text()))
  vigenciaInicial!: string;

  @Column(col.text())
  vigenciaFinal?: string | null;

  @Column(col.notNull(col.text()))
  situacao!: string;

  @Column(col.text())
  impressaoDigitalRegras?: string | null;

  @Column(col.text())
  observacoes?: string | null;

  @Column(col.notNull(col.text()))
  criadoEm!: string;

  @Column(col.notNull(col.text()))
  atualizadoEm!: string;

  @Column(col.text())
  aprovadaEm?: string | null;
}

@Entity({ tableName: "beneficios" })
export class Beneficio {
  @PrimaryKey(col.text())
  id!: string;

  @Column(col.notNull(col.references(col.text(), {
    table: "submassas",
    column: "id",
    onDelete: "CASCADE"
  })))
  submassaId!: string;

  @Column(col.notNull(col.text()))
  codigo!: string;

  @Column(col.notNull(col.text()))
  nome!: string;

  @Column(col.notNull(col.text()))
  tipoBeneficio!: string;

  @Column(col.notNull(col.text()))
  situacao!: string;

  @Column(col.notNull(col.text()))
  regrasElegibilidadeJson!: string;

  @Column(col.notNull(col.text()))
  formulaValorJson!: string;

  @Column(col.text())
  origem?: string | null;

  @Column(col.notNull(col.text()))
  criadoEm!: string;

  @Column(col.notNull(col.text()))
  atualizadoEm!: string;
}

@Entity({ tableName: "unidades_referencia" })
export class UnidadeReferencia {
  @PrimaryKey(col.text())
  id!: string;

  @Column(col.notNull(col.unique(col.text())))
  codigo!: string;

  @Column(col.notNull(col.text()))
  nome!: string;

  @Column(col.notNull(col.text()))
  situacao!: string;

  @Column(col.notNull(col.text()))
  criadoEm!: string;

  @Column(col.notNull(col.text()))
  atualizadoEm!: string;
}

@Entity({ tableName: "valores_unidade_referencia" })
export class ValorUnidadeReferencia {
  @PrimaryKey(col.text())
  id!: string;

  @Column(col.notNull(col.references(col.text(), {
    table: "unidades_referencia",
    column: "id",
    onDelete: "CASCADE"
  })))
  unidadeReferenciaId!: string;

  @Column(col.notNull(col.decimal(18, 6)))
  valor!: number;

  @Column(col.notNull(col.text()))
  vigenciaInicial!: string;

  @Column(col.text())
  vigenciaFinal?: string | null;

  @Column(col.notNull(col.text()))
  criadoEm!: string;
}
