import { Dto, Field, t } from "adorn-api";

@Dto({ name: "EntidadePrevidencia" })
export class EntidadePrevidenciaDto {
  @Field(t.string({ format: "uuid" })) id!: string;
  @Field(t.string()) codigo!: string;
  @Field(t.string()) nome!: string;
  @Field(t.nullable(t.string())) cnpj!: string | null;
  @Field(t.enum(["ATIVA", "INATIVA"])) situacao!: string;
  @Field(t.string({ format: "date-time" })) criadoEm!: string;
  @Field(t.string({ format: "date-time" })) atualizadoEm!: string;
}

@Dto({ name: "CriarEntidadePrevidencia" })
export class CriarEntidadePrevidenciaDto {
  @Field(t.string({ minLength: 1, maxLength: 40 })) codigo!: string;
  @Field(t.string({ minLength: 1, maxLength: 200 })) nome!: string;
  @Field(t.optional(t.nullable(t.string({ maxLength: 20 })))) cnpj?: string | null;
}

@Dto({ name: "Submassa" })
export class SubmassaDto {
  @Field(t.string({ format: "uuid" })) id!: string;
  @Field(t.string({ format: "uuid" })) planoId!: string;
  @Field(t.string()) codigo!: string;
  @Field(t.string()) nome!: string;
  @Field(t.string({ format: "date" })) vigenciaInicial!: string;
  @Field(t.nullable(t.string({ format: "date" }))) vigenciaFinal!: string | null;
  @Field(t.enum(["RASCUNHO", "APROVADA", "SUBSTITUIDA"])) situacao!: string;
  @Field(t.nullable(t.string())) impressaoDigitalRegras!: string | null;
  @Field(t.nullable(t.string())) observacoes!: string | null;
  @Field(t.string({ format: "date-time" })) criadoEm!: string;
  @Field(t.string({ format: "date-time" })) atualizadoEm!: string;
  @Field(t.nullable(t.string({ format: "date-time" }))) aprovadaEm!: string | null;
}

@Dto({ name: "CriarSubmassa" })
export class CriarSubmassaDto {
  @Field(t.string({ minLength: 1, maxLength: 40 })) codigo!: string;
  @Field(t.string({ minLength: 1, maxLength: 200 })) nome!: string;
  @Field(t.string({ format: "date" })) vigenciaInicial!: string;
  @Field(t.optional(t.nullable(t.string({ format: "date" })))) vigenciaFinal?: string | null;
  @Field(t.optional(t.nullable(t.string({ maxLength: 4000 })))) observacoes?: string | null;
}

@Dto({ name: "DefinirBeneficio" })
export class DefinirBeneficioDto {
  @Field(t.string({ minLength: 1, maxLength: 40 })) codigo!: string;
  @Field(t.string({ minLength: 1, maxLength: 200 })) nome!: string;
  @Field(t.enum(["APOSENTADORIA", "PENSAO", "PECULIO"])) tipoBeneficio!: string;
  @Field(t.string({ minLength: 2 })) regrasElegibilidadeJson!: string;
  @Field(t.string({ minLength: 2 })) formulaValorJson!: string;
  @Field(t.optional(t.nullable(t.string({ maxLength: 300 })))) origem?: string | null;
}

@Dto({ name: "DefinirBeneficios" })
export class DefinirBeneficiosDto {
  @Field(t.array(t.ref(DefinirBeneficioDto))) beneficios!: DefinirBeneficioDto[];
}

@Dto({ name: "ParametroPlano" })
export class ParametroPlanoDto { @Field(t.string({ format: "uuid" })) planoId!: string; }

@Dto({ name: "ParametroSubmassa" })
export class ParametroSubmassaDto { @Field(t.string({ format: "uuid" })) id!: string; }

@Dto({ name: "UnidadeReferencia" })
export class UnidadeReferenciaDto {
  @Field(t.string({ format: "uuid" })) id!: string;
  @Field(t.string()) codigo!: string;
  @Field(t.string()) nome!: string;
  @Field(t.enum(["ATIVA", "INATIVA"])) situacao!: string;
  @Field(t.string({ format: "date-time" })) criadoEm!: string;
  @Field(t.string({ format: "date-time" })) atualizadoEm!: string;
}

@Dto({ name: "CriarUnidadeReferencia" })
export class CriarUnidadeReferenciaDto { @Field(t.string({ minLength: 1, maxLength: 40 })) codigo!: string; @Field(t.string({ minLength: 1, maxLength: 200 })) nome!: string; }

@Dto({ name: "ValorUnidadeReferencia" })
export class ValorUnidadeReferenciaDto {
  @Field(t.string({ format: "uuid" })) id!: string;
  @Field(t.string({ format: "uuid" })) unidadeReferenciaId!: string;
  @Field(t.number({ minimum: 0 })) valor!: number;
  @Field(t.string({ format: "date" })) vigenciaInicial!: string;
  @Field(t.nullable(t.string({ format: "date" }))) vigenciaFinal!: string | null;
  @Field(t.string({ format: "date-time" })) criadoEm!: string;
}

@Dto({ name: "CriarValorUnidadeReferencia" })
export class CriarValorUnidadeReferenciaDto {
  @Field(t.number({ minimum: 0 })) valor!: number;
  @Field(t.string({ format: "date" })) vigenciaInicial!: string;
  @Field(t.optional(t.nullable(t.string({ format: "date" })))) vigenciaFinal?: string | null;
}

@Dto({ name: "AvaliarBeneficio" })
export class AvaliarBeneficioDto {
  @Field(t.string({ format: "date" })) dataReferencia!: string;
  @Field(t.number({ minimum: 0 })) idade!: number;
  @Field(t.optional(t.number({ minimum: 0 }))) tempoPlano?: number;
  @Field(t.optional(t.number({ minimum: 0 }))) tempoPatrocinador?: number;
  @Field(t.boolean()) aposentadoInss!: boolean;
  @Field(t.number({ minimum: 0 })) salarioContribuicao!: number;
  @Field(t.number({ minimum: 0 })) beneficioInss!: number;
}
