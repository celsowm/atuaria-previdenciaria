import { Dto, Field, t } from "adorn-api";

@Dto({ name: "LinhaFechamentoAtuarial" })
export class LinhaFechamentoAtuarialDto {
  @Field(t.string({ format: "uuid" })) id!: string;
  @Field(t.string()) codigo!: string;
  @Field(t.string()) categoria!: string;
  @Field(t.string()) rotulo!: string;
  @Field(t.string()) jsonValor!: string;
  @Field(t.nullable(t.string())) unidade!: string | null;
  @Field(t.string()) origem!: string;
  @Field(t.integer({ minimum: 0 })) ordinal!: number;
}

@Dto({ name: "FechamentoAtuarial" })
export class FechamentoAtuarialDto {
  @Field(t.string({ format: "uuid" })) id!: string;
  @Field(t.integer({ minimum: 1 })) avaliacaoId!: number;
  @Field(t.string({ format: "uuid" })) execucaoCalculoId!: string;
  @Field(t.enum(["RASCUNHO", "FINALIZADO"])) situacao!: string;
  @Field(t.nullable(t.string())) observacoes!: string | null;
  @Field(t.string({ format: "date-time" })) criadoEm!: string;
  @Field(t.string({ format: "date-time" })) atualizadoEm!: string;
  @Field(t.nullable(t.string({ format: "date-time" }))) finalizadoEm!: string | null;
  @Field(t.array(t.ref(LinhaFechamentoAtuarialDto))) lines!: LinhaFechamentoAtuarialDto[];
}

@Dto({ name: "CriarFechamentoAtuarial" })
export class CriarFechamentoAtuarialDto { @Field(t.string({ format: "uuid" })) execucaoCalculoId!: string; @Field(t.optional(t.nullable(t.string()))) observacoes?: string | null; }
@Dto({ name: "AtualizarFechamentoAtuarial" })
export class AtualizarFechamentoAtuarialDto { @Field(t.optional(t.nullable(t.string()))) observacoes?: string | null; }
@Dto({ name: "FechamentoAtuarialParams" })
export class FechamentoAtuarialParamsDto { @Field(t.string({ format: "uuid" })) id!: string; }
@Dto({ name: "FechamentoAvaliacaoParams" })
export class FechamentoAvaliacaoParamsDto { @Field(t.integer({ minimum: 1 })) avaliacaoId!: number; }
