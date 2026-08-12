import { Dto, Field, t } from "adorn-api";

@Dto({ name: "CalculoEngine", description: "Registered deterministic calculation engine." })
export class CalculoEngineDto {
  @Field(t.string()) codigo!: string;
  @Field(t.string()) versao!: string;
  @Field(t.string()) rotulo!: string;
  @Field(t.string()) descricao!: string;
  @Field(t.enum(["PRECALCULO", "ATUARIAL"])) tipoResultado!: string;
  @Field(t.boolean()) requiresRegrasPlano!: boolean;
  @Field(t.array(t.enum(["BD", "CD", "CV"]), { minItems: 1 })) modalidadesSuportadas!: string[];
}

@Dto({ name: "ResumoExecucaoCalculo", description: "Immutable calculation run metadata." })
export class ResumoExecucaoCalculoDto {
  @Field(t.string({ format: "uuid" })) id!: string;
  @Field(t.integer({ minimum: 1 })) avaliacaoId!: number;
  @Field(t.string({ format: "uuid" })) parametrizacaoId!: string;
  @Field(t.nullable(t.string({ format: "uuid" }))) versaoRegrasPlanoId!: string | null;
  @Field(t.nullable(t.string())) impressaoDigitalRegrasPlano!: string | null;
  @Field(t.string()) codigoMotor!: string;
  @Field(t.string()) versaoMotor!: string;
  @Field(t.enum(["PROCESSANDO", "CONCLUIDO", "FALHO"])) situacao!: string;
  @Field(t.string()) impressaoDigitalEntrada!: string;
  @Field(t.nullable(t.string())) impressaoDigitalResultado!: string | null;
  @Field(t.integer({ minimum: 0 })) quantidadeImportacoesEntrada!: number;
  @Field(t.integer({ minimum: 0 })) quantidadeLinhasEntrada!: number;
  @Field(t.integer({ minimum: 0 })) quantidadeLinhasValidas!: number;
  @Field(t.integer({ minimum: 0 })) quantidadeLinhasInvalidas!: number;
  @Field(t.integer({ minimum: 0 })) quantidadeResultadosParticipantes!: number;
  @Field(t.string({ format: "date-time" })) criadoEm!: string;
  @Field(t.nullable(t.string({ format: "date-time" }))) concluidoEm!: string | null;
  @Field(t.nullable(t.string())) mensagemErro!: string | null;
}

@Dto({ name: "EntradaCalculo", description: "Frozen import selected as calculation input." })
export class EntradaCalculoDto {
  @Field(t.string({ format: "uuid" })) id!: string;
  @Field(t.string({ format: "uuid" })) importacaoId!: string;
  @Field(t.string()) populacao!: string;
  @Field(t.string()) arquivoSha256!: string;
  @Field(t.string()) impressaoDigitalEsquema!: string;
  @Field(t.string()) impressaoDigitalCanonica!: string;
  @Field(t.integer({ minimum: 0 })) quantidadeLinhas!: number;
  @Field(t.integer({ minimum: 0 })) linhasValidas!: number;
  @Field(t.integer({ minimum: 0 })) linhasInvalidas!: number;
  @Field(t.string({ format: "date-time" })) importadoEm!: string;
}

@Dto({ name: "MetricaResultadoCalculo", description: "Typed deterministic metric produced by a calculation engine." })
export class MetricaResultadoCalculoDto {
  @Field(t.string({ format: "uuid" })) id!: string;
  @Field(t.string()) codigo!: string;
  @Field(t.string()) categoria!: string;
  @Field(t.string()) rotulo!: string;
  @Field(t.enum(["NUMBER", "INTEGER", "TEXT", "BOOLEAN"])) tipoValor!: string;
  @Field(t.string()) jsonValor!: string;
  @Field(t.nullable(t.string())) unidade!: string | null;
  @Field(t.integer({ minimum: 0 })) ordinal!: number;
}

@Dto({ name: "ResultadoParticipanteCalculo", description: "Participante-level result for actuarial reconciliation." })
export class ResultadoParticipanteCalculoDto {
  @Field(t.string({ format: "uuid" })) id!: string;
  @Field(t.string({ format: "uuid" })) importacaoId!: string;
  @Field(t.string()) populacao!: string;
  @Field(t.integer({ minimum: 1 })) numeroLinhaOrigem!: number;
  @Field(t.nullable(t.string())) matriculaParticipante!: string | null;
  @Field(t.nullable(t.string())) campoUnicoLgpd!: string | null;
  @Field(t.string()) jsonResultado!: string;
  @Field(t.integer({ minimum: 0 })) ordinal!: number;
}

@Dto({ name: "ResultadoParticipanteCalculoPage", description: "Paged participant-level calculation results." })
export class ResultadoParticipanteCalculoPageDto {
  @Field(t.array(t.ref(ResultadoParticipanteCalculoDto))) items!: ResultadoParticipanteCalculoDto[];
  @Field(t.integer({ minimum: 0 })) totalItems!: number;
  @Field(t.integer({ minimum: 1 })) page!: number;
  @Field(t.integer({ minimum: 1, maximum: 200 })) pageSize!: number;
}

@Dto({ name: "ConsultaParticipantesCalculo" })
export class ConsultaParticipantesCalculoDto {
  @Field(t.optional(t.integer({ minimum: 1 }))) page?: number;
  @Field(t.optional(t.integer({ minimum: 1, maximum: 200 }))) pageSize?: number;
}

@Dto({ name: "ExecucaoCalculo", description: "Complete immutable calculation run with frozen inputs and aggregate metrics." })
export class ExecucaoCalculoDto extends ResumoExecucaoCalculoDto {
  @Field(t.string()) impressaoDigitalParametros!: string;
  @Field(t.string()) impressaoDigitalDados!: string;
  @Field(t.array(t.ref(EntradaCalculoDto))) inputs!: EntradaCalculoDto[];
  @Field(t.array(t.ref(MetricaResultadoCalculoDto))) metrics!: MetricaResultadoCalculoDto[];
}

@Dto({ name: "CriarExecucaoCalculo", description: "Execute one registered engine against approved immutable inputs." })
export class CriarExecucaoCalculoDto {
  @Field(t.string({ format: "uuid" })) parametrizacaoId!: string;
  @Field(t.optional(t.string({ format: "uuid" }))) versaoRegrasPlanoId?: string;
  @Field(t.optional(t.string({ minLength: 1 }))) codigoMotor?: string;
}

@Dto({ name: "ParametrosAvaliacaoCalculo" })
export class ParametrosAvaliacaoCalculoDto {
  @Field(t.integer({ minimum: 1 })) avaliacaoId!: number;
}

@Dto({ name: "ParametrosExecucaoCalculo" })
export class ParametrosExecucaoCalculoDto {
  @Field(t.string({ format: "uuid" })) id!: string;
}
