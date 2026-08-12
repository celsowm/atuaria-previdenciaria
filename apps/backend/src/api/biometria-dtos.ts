import { Dto, Field, t } from "adorn-api";

@Dto({ name: "PontoBiometria", description: "Single qx ponto of a biometric table versao." })
export class PontoBiometriaDto {
  @Field(t.integer({ minimum: 0, maximum: 130 })) idade!: number;
  @Field(t.enum(["MASCULINO", "FEMININO", "UNISSEX"])) sexo!: string;
  @Field(t.number({ minimum: 0, maximum: 1 })) qx!: number;
}

@Dto({ name: "CriarTabuaBiometria", description: "Create an immutable first versao of a biometric table." })
export class CriarTabuaBiometriaDto {
  @Field(t.string({ minLength: 1 })) codigo!: string;
  @Field(t.string({ minLength: 1 })) nome!: string;
  @Field(t.string({ minLength: 1 })) tipo!: string;
  @Field(t.enum(["AMBOS", "MASCULINO", "FEMININO", "UNISSEX"])) escopoSexo!: string;
  @Field(t.optional(t.string())) origem?: string;
  @Field(t.optional(t.string())) descricao?: string;
  @Field(t.optional(t.string({ minLength: 1 }))) versao?: string;
  @Field(t.optional(t.string({ format: "date" }))) vigenciaInicial?: string;
  @Field(t.array(t.ref(PontoBiometriaDto), { minItems: 1 })) pontos!: PontoBiometriaDto[];
}

@Dto({ name: "TabuaBiometriaSummary", description: "Biometria table library summary." })
export class TabuaBiometriaSummaryDto {
  @Field(t.string({ format: "uuid" })) id!: string;
  @Field(t.string()) codigo!: string;
  @Field(t.string()) nome!: string;
  @Field(t.string()) tipo!: string;
  @Field(t.string()) escopoSexo!: string;
  @Field(t.nullable(t.string())) origem!: string | null;
  @Field(t.nullable(t.string())) descricao!: string | null;
  @Field(t.integer({ minimum: 0 })) quantidadeVersoes!: number;
  @Field(t.nullable(t.string({ format: "uuid" }))) ultimaVersaoId!: string | null;
  @Field(t.nullable(t.string())) ultimaVersao!: string | null;
  @Field(t.integer({ minimum: 0 })) quantidadePontos!: number;
  @Field(t.nullable(t.integer())) idadeMinima!: number | null;
  @Field(t.nullable(t.integer())) idadeMaxima!: number | null;
  @Field(t.string({ format: "date-time" })) atualizadoEm!: string;
}

@Dto({ name: "VersaoBiometria", description: "Version metadata with derivation provenance." })
export class VersaoBiometriaDto {
  @Field(t.string({ format: "uuid" })) id!: string;
  @Field(t.string()) versao!: string;
  @Field(t.string()) situacao!: string;
  @Field(t.nullable(t.string({ format: "date" }))) vigenciaInicial!: string | null;
  @Field(t.nullable(t.string({ format: "date" }))) vigenciaFinal!: string | null;
  @Field(t.nullable(t.string({ format: "uuid" }))) versaoOrigemId!: string | null;
  @Field(t.nullable(t.string())) tipoDerivacao!: string | null;
  @Field(t.string()) parametrosDerivacaoJson!: string;
  @Field(t.integer({ minimum: 0 })) idadeMinima!: number;
  @Field(t.integer({ minimum: 0 })) idadeMaxima!: number;
  @Field(t.integer({ minimum: 0 })) quantidadePontos!: number;
  @Field(t.string({ format: "date-time" })) criadoEm!: string;
}

@Dto({ name: "TabuaBiometriaDetail", description: "Biometria table and all of its immutable versions." })
export class TabuaBiometriaDetailDto {
  @Field(t.string({ format: "uuid" })) id!: string;
  @Field(t.string()) codigo!: string;
  @Field(t.string()) nome!: string;
  @Field(t.string()) tipo!: string;
  @Field(t.string()) escopoSexo!: string;
  @Field(t.nullable(t.string())) origem!: string | null;
  @Field(t.nullable(t.string())) descricao!: string | null;
  @Field(t.boolean()) habilitada!: boolean;
  @Field(t.string({ format: "date-time" })) criadoEm!: string;
  @Field(t.string({ format: "date-time" })) atualizadoEm!: string;
  @Field(t.array(t.ref(VersaoBiometriaDto))) versions!: VersaoBiometriaDto[];
}

@Dto({ name: "VersaoBiometriaPoints", description: "Biometria versao including all qx pontos." })
export class VersaoBiometriaPointsDto {
  @Field(t.ref(VersaoBiometriaDto)) versao!: VersaoBiometriaDto;
  @Field(t.array(t.ref(PontoBiometriaDto))) pontos!: PontoBiometriaDto[];
}

@Dto({ name: "TabuaBiometriaParams" })
export class TabuaBiometriaParamsDto {
  @Field(t.string({ format: "uuid" })) id!: string;
}

@Dto({ name: "VersaoBiometriaParams" })
export class VersaoBiometriaParamsDto {
  @Field(t.string({ format: "uuid" })) id!: string;
}

@Dto({ name: "DerivarVersaoBiometria", description: "Create a derived immutable biometric versao." })
export class DerivarVersaoBiometriaDto {
  @Field(t.string({ format: "uuid" })) versaoOrigemId!: string;
  @Field(t.string({ minLength: 1 })) versao!: string;
  @Field(t.enum(["QX_SCALE", "AGE_SHIFT"])) transformacao!: string;
  @Field(t.optional(t.number({ exclusiveMinimum: 0, maximum: 5 }))) fator?: number;
  @Field(t.optional(t.integer({ minimum: -20, maximum: 20 }))) anos?: number;
  @Field(t.optional(t.string({ format: "date" }))) vigenciaInicial?: string;
}
