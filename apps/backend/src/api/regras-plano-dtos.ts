import { Dto, Field, t } from "adorn-api";

@Dto({ name: "ValorRegraPlano", description: "Typed rule captured inside a versioned pension plan rules snapshot." })
export class ValorRegraPlanoDto {
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

@Dto({ name: "VersaoRegrasPlanoSummary", description: "Versioned pension plan rules metadata." })
export class VersaoRegrasPlanoSummaryDto {
  @Field(t.string({ format: "uuid" })) id!: string;
  @Field(t.string({ format: "uuid" })) planoId!: string;
  @Field(t.integer({ minimum: 1 })) versao!: number;
  @Field(t.string()) nome!: string;
  @Field(t.enum(["BD", "CD", "CV"])) modalidade!: string;
  @Field(t.enum(["RASCUNHO", "APROVADO", "SUBSTITUIDO"])) situacao!: string;
  @Field(t.nullable(t.string({ format: "date" }))) vigenciaInicial!: string | null;
  @Field(t.nullable(t.string({ format: "date" }))) vigenciaFinal!: string | null;
  @Field(t.nullable(t.string())) impressaoDigitalRegras!: string | null;
  @Field(t.nullable(t.string())) observacoes!: string | null;
  @Field(t.string({ format: "date-time" })) criadoEm!: string;
  @Field(t.string({ format: "date-time" })) atualizadoEm!: string;
  @Field(t.nullable(t.string({ format: "date-time" }))) aprovadoEm!: string | null;
}

@Dto({ name: "VersaoRegrasPlano", description: "Complete immutable-ready pension plan rules snapshot." })
export class VersaoRegrasPlanoDto extends VersaoRegrasPlanoSummaryDto {
  @Field(t.array(t.ref(ValorRegraPlanoDto))) regras!: ValorRegraPlanoDto[];
}

@Dto({ name: "CriarVersaoRegrasPlano", description: "Create a new draft rules versao for a pension plan." })
export class CriarVersaoRegrasPlanoDto {
  @Field(t.optional(t.string({ minLength: 1, maxLength: 200 }))) nome?: string;
  @Field(t.optional(t.nullable(t.string({ format: "date" })))) vigenciaInicial?: string | null;
  @Field(t.optional(t.nullable(t.string({ format: "date" })))) vigenciaFinal?: string | null;
  @Field(t.optional(t.nullable(t.string({ maxLength: 4000 })))) observacoes?: string | null;
  @Field(t.optional(t.string({ format: "uuid" }))) copiarDeId?: string;
}

@Dto({ name: "AtualizarVersaoRegrasPlano", description: "Update metadata of a draft plan rules versao." })
export class AtualizarVersaoRegrasPlanoDto {
  @Field(t.optional(t.string({ minLength: 1, maxLength: 200 }))) nome?: string;
  @Field(t.optional(t.nullable(t.string({ format: "date" })))) vigenciaInicial?: string | null;
  @Field(t.optional(t.nullable(t.string({ format: "date" })))) vigenciaFinal?: string | null;
  @Field(t.optional(t.nullable(t.string({ maxLength: 4000 })))) observacoes?: string | null;
}

@Dto({ name: "DefinirValorRegraPlano", description: "One typed pension plan rule value." })
export class DefinirValorRegraPlanoDto {
  @Field(t.string({ minLength: 1, maxLength: 120 })) codigo!: string;
  @Field(t.string({ minLength: 1, maxLength: 120 })) categoria!: string;
  @Field(t.string({ minLength: 1, maxLength: 200 })) rotulo!: string;
  @Field(t.enum(["NUMBER", "INTEGER", "TEXT", "BOOLEAN"])) tipoValor!: string;
  @Field(t.string({ minLength: 1 })) jsonValor!: string;
  @Field(t.optional(t.nullable(t.string({ maxLength: 60 })))) unidade?: string | null;
  @Field(t.optional(t.nullable(t.string({ maxLength: 200 })))) origem?: string | null;
}

@Dto({ name: "DefinirValoresRegrasPlano", description: "Replace the active rule set of a draft plan rules versao." })
export class DefinirValoresRegrasPlanoDto {
  @Field(t.array(t.ref(DefinirValorRegraPlanoDto))) regras!: DefinirValorRegraPlanoDto[];
}

@Dto({ name: "RegrasPlanoPlanParams" })
export class RegrasPlanoPlanoParamsDto {
  @Field(t.string({ format: "uuid" })) planoId!: string;
}

@Dto({ name: "VersaoRegrasPlanoParams" })
export class VersaoRegrasPlanoParamsDto {
  @Field(t.string({ format: "uuid" })) id!: string;
}
