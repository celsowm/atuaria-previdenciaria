import { Dto, Field, t } from "adorn-api";

@Dto({ name: "ValorParametroAtuarial", description: "Typed value captured inside a versioned actuarial parametrizacao snapshot." })
export class ValorParametroAtuarialDto {
  @Field(t.string({ format: "uuid" })) id!: string;
  @Field(t.string()) codigo!: string;
  @Field(t.string()) categoria!: string;
  @Field(t.string()) rotulo!: string;
  @Field(t.enum(["NUMBER", "INTEGER", "TEXT", "BOOLEAN"])) tipoValor!: string;
  @Field(t.string()) jsonValor!: string;
  @Field(t.nullable(t.string())) unidade!: string | null;
  @Field(t.string()) origem!: string;
  @Field(t.string({ format: "date-time" })) atualizadoEm!: string;
}

@Dto({ name: "SelecaoHipoteseAtuarial", description: "Aderencia-study candidato promoted into an actuarial parametrizacao snapshot." })
export class SelecaoHipoteseAtuarialDto {
  @Field(t.string({ format: "uuid" })) id!: string;
  @Field(t.string()) tipoHipotese!: string;
  @Field(t.string({ format: "uuid" })) estudoAderenciaId!: string;
  @Field(t.string({ format: "uuid" })) resultadoCandidatoId!: string;
  @Field(t.string({ format: "uuid" })) versaoBiometriaId!: string;
  @Field(t.string()) codigoTabua!: string;
  @Field(t.string()) nomeTabua!: string;
  @Field(t.string()) rotuloVersao!: string;
  @Field(t.integer({ minimum: 1 })) posicaoCandidato!: number;
  @Field(t.string({ format: "date-time" })) selecionadoEm!: string;
}

@Dto({ name: "ParametrizacaoAtuarialSummary", description: "Versioned actuarial parametrizacao metadata." })
export class ParametrizacaoAtuarialSummaryDto {
  @Field(t.string({ format: "uuid" })) id!: string;
  @Field(t.integer({ minimum: 1 })) avaliacaoId!: number;
  @Field(t.integer({ minimum: 1 })) versao!: number;
  @Field(t.string()) nome!: string;
  @Field(t.enum(["RASCUNHO", "APROVADO", "SUBSTITUIDO"])) situacao!: string;
  @Field(t.nullable(t.string())) observacoes!: string | null;
  @Field(t.string({ format: "date-time" })) criadoEm!: string;
  @Field(t.string({ format: "date-time" })) atualizadoEm!: string;
  @Field(t.nullable(t.string({ format: "date-time" }))) aprovadoEm!: string | null;
}

@Dto({ name: "ParametrizacaoAtuarial", description: "Complete immutable-ready actuarial parametrizacao snapshot." })
export class ParametrizacaoAtuarialDto {
  @Field(t.string({ format: "uuid" })) id!: string;
  @Field(t.integer({ minimum: 1 })) avaliacaoId!: number;
  @Field(t.integer({ minimum: 1 })) versao!: number;
  @Field(t.string()) nome!: string;
  @Field(t.enum(["RASCUNHO", "APROVADO", "SUBSTITUIDO"])) situacao!: string;
  @Field(t.nullable(t.string())) observacoes!: string | null;
  @Field(t.string({ format: "date-time" })) criadoEm!: string;
  @Field(t.string({ format: "date-time" })) atualizadoEm!: string;
  @Field(t.nullable(t.string({ format: "date-time" }))) aprovadoEm!: string | null;
  @Field(t.array(t.ref(ValorParametroAtuarialDto))) parametros!: ValorParametroAtuarialDto[];
  @Field(t.array(t.ref(SelecaoHipoteseAtuarialDto))) hipoteses!: SelecaoHipoteseAtuarialDto[];
}

@Dto({ name: "CriarParametrizacaoAtuarial", description: "Create a new draft parametrizacao versao for an evaluation." })
export class CriarParametrizacaoAtuarialDto {
  @Field(t.optional(t.string({ minLength: 1, maxLength: 200 }))) nome?: string;
  @Field(t.optional(t.nullable(t.string({ maxLength: 4000 })))) observacoes?: string | null;
  @Field(t.optional(t.string({ format: "uuid" }))) copiarDeId?: string;
}

@Dto({ name: "AtualizarParametrizacaoAtuarial", description: "Update draft-only parametrizacao metadata." })
export class AtualizarParametrizacaoAtuarialDto {
  @Field(t.optional(t.string({ minLength: 1, maxLength: 200 }))) nome?: string;
  @Field(t.optional(t.nullable(t.string({ maxLength: 4000 })))) observacoes?: string | null;
}

@Dto({ name: "DefinirValorParametroAtuarial", description: "Upsert one typed actuarial parameter value." })
export class DefinirValorParametroAtuarialDto {
  @Field(t.string({ minLength: 1, maxLength: 120 })) codigo!: string;
  @Field(t.string({ minLength: 1, maxLength: 120 })) categoria!: string;
  @Field(t.string({ minLength: 1, maxLength: 200 })) rotulo!: string;
  @Field(t.enum(["NUMBER", "INTEGER", "TEXT", "BOOLEAN"])) tipoValor!: string;
  @Field(t.string({ minLength: 1 })) jsonValor!: string;
  @Field(t.optional(t.nullable(t.string({ maxLength: 60 })))) unidade?: string | null;
  @Field(t.optional(t.nullable(t.string({ maxLength: 120 })))) origem?: string | null;
}

@Dto({ name: "DefinirParametrosAtuariais", description: "Upsert parameter values into a draft parametrizacao." })
export class DefinirParametrosAtuariaisDto {
  @Field(t.array(t.ref(DefinirValorParametroAtuarialDto), { minItems: 1 })) parametros!: DefinirValorParametroAtuarialDto[];
}

@Dto({ name: "PromoverCandidatoAderencia", description: "Promote one adherence candidato into the draft parametrizacao." })
export class PromoverCandidatoAderenciaDto {
  @Field(t.string({ format: "uuid" })) resultadoCandidatoId!: string;
}

@Dto({ name: "RemoverSelecaoHipoteseAtuarial", description: "Deactivate one selected hypothesis in a draft parametrizacao." })
export class RemoverSelecaoHipoteseAtuarialDto {
  @Field(t.string({ format: "uuid" })) selecaoId!: string;
}

@Dto({ name: "AvaliacaoParametrizacaoParams" })
export class AvaliacaoParametrizacaoParamsDto {
  @Field(t.integer({ minimum: 1 })) avaliacaoId!: number;
}

@Dto({ name: "ParametrizacaoAtuarialParams" })
export class ParametrizacaoAtuarialParamsDto {
  @Field(t.string({ format: "uuid" })) id!: string;
}
