import { Dto, Field, t } from "adorn-api";

@Dto({ name: "ObservacaoAderencia", description: "Historical exposicao and observado events by year, age and sex." })
export class ObservacaoAderenciaDto {
  @Field(t.integer({ minimum: 1900, maximum: 2200 })) ano!: number;
  @Field(t.integer({ minimum: 0, maximum: 130 })) idade!: number;
  @Field(t.enum(["MASCULINO", "FEMININO", "UNISSEX"])) sexo!: string;
  @Field(t.number({ exclusiveMinimum: 0 })) exposicao!: number;
  @Field(t.integer({ minimum: 0 })) eventosObservados!: number;
}

@Dto({ name: "CriarEstudoAderencia", description: "Execute and persist an adherence study against biometric table versions." })
export class CriarEstudoAderenciaDto {
  @Field(t.optional(t.integer({ minimum: 1 }))) avaliacaoId?: number;
  @Field(t.string({ minLength: 1 })) nome!: string;
  @Field(t.string({ minLength: 1 })) tipoHipotese!: string;
  @Field(t.integer({ minimum: 1900, maximum: 2200 })) periodoInicial!: number;
  @Field(t.integer({ minimum: 1900, maximum: 2200 })) periodoFinal!: number;
  @Field(t.enum(["AMBOS", "MASCULINO", "FEMININO", "UNISSEX"])) escopoSexo!: string;
  @Field(t.number({ exclusiveMinimum: 0, exclusiveMaximum: 1 })) alpha!: number;
  @Field(t.integer({ minimum: 0, maximum: 130 })) idadeDivisaoFisher!: number;
  @Field(t.array(t.string({ format: "uuid" }), { minItems: 1, uniqueItems: true })) idsVersoesCandidatas!: string[];
  @Field(t.array(t.ref(ObservacaoAderenciaDto), { minItems: 1 })) observacoes!: ObservacaoAderenciaDto[];
}

@Dto({ name: "EstudoAderenciaSummary", description: "Persisted adherence study summary." })
export class EstudoAderenciaSummaryDto {
  @Field(t.string({ format: "uuid" })) id!: string;
  @Field(t.nullable(t.integer())) avaliacaoId!: number | null;
  @Field(t.string()) nome!: string;
  @Field(t.string()) tipoHipotese!: string;
  @Field(t.integer()) periodoInicial!: number;
  @Field(t.integer()) periodoFinal!: number;
  @Field(t.string()) escopoSexo!: string;
  @Field(t.number()) alpha!: number;
  @Field(t.string()) situacao!: string;
  @Field(t.string()) versaoMotor!: string;
  @Field(t.integer({ minimum: 0 })) quantidadeObservacoes!: number;
  @Field(t.integer({ minimum: 0 })) quantidadeCandidatos!: number;
  @Field(t.string({ format: "date-time" })) criadoEm!: string;
  @Field(t.nullable(t.string({ format: "date-time" }))) concluidoEm!: string | null;
}

@Dto({ name: "ResultadoCandidatoAderencia", description: "Statistical adherence result for one immutable biometric versao." })
export class ResultadoCandidatoAderenciaDto {
  @Field(t.string({ format: "uuid" })) id!: string;
  @Field(t.string({ format: "uuid" })) versaoBiometriaId!: string;
  @Field(t.string()) codigoTabua!: string;
  @Field(t.string()) nomeTabua!: string;
  @Field(t.string()) rotuloVersao!: string;
  @Field(t.integer({ minimum: 1 })) rank!: number;
  @Field(t.number({ minimum: 0 })) eventosObservados!: number;
  @Field(t.number({ minimum: 0 })) eventosEsperados!: number;
  @Field(t.number({ minimum: 0 })) quiQuadrado!: number;
  @Field(t.integer({ minimum: 1 })) quiQuadradoDf!: number;
  @Field(t.number({ minimum: 0 })) quiQuadradoCritical!: number;
  @Field(t.number({ minimum: 0, maximum: 1 })) quiQuadradoP!: number;
  @Field(t.boolean()) quiQuadradoPass!: boolean;
  @Field(t.number({ minimum: 0, maximum: 1 })) ksD!: number;
  @Field(t.number({ minimum: 0, maximum: 1 })) ksCritico!: number;
  @Field(t.number({ minimum: 0, maximum: 1 })) pKs!: number;
  @Field(t.boolean()) pKsass!: boolean;
  @Field(t.number()) estatisticaZ!: number;
  @Field(t.number({ minimum: 0 })) zCritico!: number;
  @Field(t.number({ minimum: 0, maximum: 1 })) pZ!: number;
  @Field(t.boolean()) pZass!: boolean;
  @Field(t.number({ minimum: 0, maximum: 1 })) pFisher!: number;
  @Field(t.boolean()) pFisherass!: boolean;
  @Field(t.number({ minimum: 0 })) dqm!: number;
  @Field(t.integer({ minimum: 0, maximum: 4 })) testesRejeitados!: number;
}

@Dto({ name: "EstudoAderenciaDetail", description: "Study metadata and ranked candidato results." })
export class EstudoAderenciaDetailDto {
  @Field(t.string({ format: "uuid" })) id!: string;
  @Field(t.nullable(t.integer())) avaliacaoId!: number | null;
  @Field(t.string()) nome!: string;
  @Field(t.string()) tipoHipotese!: string;
  @Field(t.integer()) periodoInicial!: number;
  @Field(t.integer()) periodoFinal!: number;
  @Field(t.string()) escopoSexo!: string;
  @Field(t.number()) alpha!: number;
  @Field(t.integer()) idadeDivisaoFisher!: number;
  @Field(t.string()) situacao!: string;
  @Field(t.string()) versaoMotor!: string;
  @Field(t.integer({ minimum: 0 })) quantidadeObservacoes!: number;
  @Field(t.integer({ minimum: 0 })) quantidadeCandidatos!: number;
  @Field(t.string({ format: "date-time" })) criadoEm!: string;
  @Field(t.nullable(t.string({ format: "date-time" }))) concluidoEm!: string | null;
  @Field(t.array(t.ref(ResultadoCandidatoAderenciaDto))) candidatos!: ResultadoCandidatoAderenciaDto[];
}

@Dto({ name: "PontoCandidatoAderencia", description: "Observed versus esperado cell used by the statistical engine." })
export class PontoCandidatoAderenciaDto {
  @Field(t.integer()) idade!: number;
  @Field(t.string()) sexo!: string;
  @Field(t.number({ exclusiveMinimum: 0 })) exposicao!: number;
  @Field(t.integer({ minimum: 0 })) eventosObservados!: number;
  @Field(t.number({ minimum: 0, maximum: 1 })) qx!: number;
  @Field(t.number({ minimum: 0 })) eventosEsperados!: number;
  @Field(t.number()) residuo!: number;
}

@Dto({ name: "PontosCandidatoAderencia", description: "Candidato result with complete observado-versus-esperado detail." })
export class PontosCandidatoAderenciaDto {
  @Field(t.ref(ResultadoCandidatoAderenciaDto)) candidato!: ResultadoCandidatoAderenciaDto;
  @Field(t.array(t.ref(PontoCandidatoAderenciaDto))) pontos!: PontoCandidatoAderenciaDto[];
}

@Dto({ name: "EstudoAderenciaParams" })
export class EstudoAderenciaParamsDto {
  @Field(t.string({ format: "uuid" })) id!: string;
}

@Dto({ name: "AderenciaCandidatoParams" })
export class AderenciaCandidatoParamsDto {
  @Field(t.string({ format: "uuid" })) id!: string;
}
