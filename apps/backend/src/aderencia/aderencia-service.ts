import { randomUUID } from "node:crypto";
import { getTableDefFromEntity, selectFromEntity } from "metal-orm";
import { createSession } from "../db.js";
import {
  AdherenceCandidatePoint,
  AdherenceCandidateResult,
  AdherenceObservation,
  AdherenceStudy
} from "../domain/adherence-entities.js";
import {
  BiometricTable,
  BiometricTablePoint,
  BiometricTableVersion
} from "../domain/biometric-entities.js";
import { evaluateCandidate, type AdherenceCell } from "./statistics.js";

export const ADHERENCE_ENGINE_VERSION = "adherence-engine-v1";

type Sex = "MALE" | "FEMALE" | "UNISEX";

export type ObservationInput = {
  year: number;
  age: number;
  sex: Sex;
  exposure: number;
  observedEvents: number;
};

export type CreateStudyInput = {
  evaluationId?: number;
  name: string;
  hypothesisType: string;
  periodStart: number;
  periodEnd: number;
  sexScope: "BOTH" | Sex;
  alpha: number;
  fisherSplitAge: number;
  candidateVersionIds: string[];
  observations: ObservationInput[];
};

async function withSession<T>(handler: (session: ReturnType<typeof createSession>) => Promise<T>) {
  const session = createSession();
  try {
    return await handler(session);
  } finally {
    await session.dispose();
  }
}

function tableOf(entity: typeof AdherenceStudy | typeof AdherenceObservation | typeof AdherenceCandidateResult | typeof AdherenceCandidatePoint) {
  const table = getTableDefFromEntity(entity);
  if (!table) throw new Error(`Metal ORM metadata not bootstrapped for ${entity.name}`);
  return table;
}

function validateInput(input: CreateStudyInput) {
  if (!input.name.trim()) throw new Error("Nome do estudo é obrigatório.");
  if (!input.hypothesisType.trim()) throw new Error("Hipótese é obrigatória.");
  if (!Number.isInteger(input.periodStart) || !Number.isInteger(input.periodEnd) || input.periodStart > input.periodEnd) {
    throw new Error("Período do estudo é inválido.");
  }
  if (!Number.isFinite(input.alpha) || input.alpha <= 0 || input.alpha >= 1) {
    throw new Error("Nível de significância deve estar entre 0 e 1.");
  }
  if (!Number.isInteger(input.fisherSplitAge) || input.fisherSplitAge < 0 || input.fisherSplitAge > 130) {
    throw new Error("Idade de corte do Fisher deve estar entre 0 e 130.");
  }
  const candidates = new Set(input.candidateVersionIds);
  if (!candidates.size) throw new Error("Selecione ao menos uma versão biométrica candidata.");
  if (candidates.size !== input.candidateVersionIds.length) throw new Error("Existem versões candidatas duplicadas.");
  if (!input.observations.length) throw new Error("O estudo precisa possuir observações de exposição e eventos.");
  for (const observation of input.observations) {
    if (!Number.isInteger(observation.year) || observation.year < input.periodStart || observation.year > input.periodEnd) {
      throw new Error(`Ano ${observation.year} está fora do período do estudo.`);
    }
    if (!Number.isInteger(observation.age) || observation.age < 0 || observation.age > 130) {
      throw new Error(`Idade inválida: ${observation.age}.`);
    }
    if (!["MALE", "FEMALE", "UNISEX"].includes(observation.sex)) {
      throw new Error(`Sexo inválido: ${observation.sex}.`);
    }
    if (input.sexScope !== "BOTH" && observation.sex !== input.sexScope) {
      throw new Error(`A observação ${observation.year}/${observation.age}/${observation.sex} não pertence ao escopo ${input.sexScope}.`);
    }
    if (!Number.isFinite(observation.exposure) || observation.exposure <= 0) {
      throw new Error(`Exposição inválida em ${observation.year}/${observation.age}/${observation.sex}.`);
    }
    if (!Number.isInteger(observation.observedEvents) || observation.observedEvents < 0) {
      throw new Error(`Eventos observados inválidos em ${observation.year}/${observation.age}/${observation.sex}.`);
    }
  }
}

function aggregateObservations(observations: ObservationInput[]) {
  const aggregated = new Map<string, { age: number; sex: Sex; exposure: number; observed: number }>();
  for (const observation of observations) {
    const key = `${observation.sex}:${observation.age}`;
    const current = aggregated.get(key) ?? { age: observation.age, sex: observation.sex, exposure: 0, observed: 0 };
    current.exposure += observation.exposure;
    current.observed += observation.observedEvents;
    aggregated.set(key, current);
  }
  return [...aggregated.values()].sort((a, b) => a.age - b.age || a.sex.localeCompare(b.sex));
}

async function loadBiometricCatalog() {
  return withSession(async (session) => {
    const [tables, versions, points] = await Promise.all([
      selectFromEntity(BiometricTable).execute(session),
      selectFromEntity(BiometricTableVersion).execute(session),
      selectFromEntity(BiometricTablePoint).execute(session)
    ]);
    return { tables, versions, points };
  });
}

function buildCandidateCells(
  aggregated: ReturnType<typeof aggregateObservations>,
  points: BiometricTablePoint[],
  versionId: string
): AdherenceCell[] {
  const ownPoints = points.filter((point) => point.versionId === versionId);
  const qxByKey = new Map(ownPoints.map((point) => [`${point.sex}:${point.age}`, Number(point.qx)]));
  return aggregated.map((observation) => {
    const exact = qxByKey.get(`${observation.sex}:${observation.age}`);
    const unisex = qxByKey.get(`UNISEX:${observation.age}`);
    const qx = exact ?? unisex;
    if (qx === undefined) {
      throw new Error(`A versão biométrica ${versionId} não possui qx para ${observation.sex}, idade ${observation.age}.`);
    }
    return {
      age: observation.age,
      sex: observation.sex,
      exposure: observation.exposure,
      observed: observation.observed,
      qx,
      expected: observation.exposure * qx
    };
  });
}

export async function createAdherenceStudy(input: CreateStudyInput) {
  validateInput(input);
  const catalog = await loadBiometricCatalog();
  const versionsById = new Map(catalog.versions.map((version) => [version.id, version]));
  const tablesById = new Map(catalog.tables.map((table) => [table.id, table]));
  const aggregated = aggregateObservations(input.observations);

  const computed = input.candidateVersionIds.map((versionId) => {
    const version = versionsById.get(versionId);
    if (!version) throw new Error(`Versão biométrica ${versionId} não encontrada.`);
    const table = tablesById.get(version.tableId);
    if (!table) throw new Error(`Tábua da versão ${versionId} não encontrada.`);
    const cells = buildCandidateCells(aggregated, catalog.points, versionId);
    const metrics = evaluateCandidate(cells, input.alpha, input.fisherSplitAge);
    return { version, table, cells, metrics };
  });

  computed.sort((a, b) =>
    a.metrics.rejectedTests - b.metrics.rejectedTests ||
    a.metrics.dqm - b.metrics.dqm ||
    b.metrics.chiSquareP - a.metrics.chiSquareP
  );

  const now = new Date().toISOString();
  const study = new AdherenceStudy();
  study.id = randomUUID();
  study.evaluationId = input.evaluationId ?? null;
  study.name = input.name.trim();
  study.hypothesisType = input.hypothesisType.trim();
  study.periodStart = input.periodStart;
  study.periodEnd = input.periodEnd;
  study.sexScope = input.sexScope;
  study.alpha = input.alpha;
  study.fisherSplitAge = input.fisherSplitAge;
  study.status = "COMPLETED";
  study.engineVersion = ADHERENCE_ENGINE_VERSION;
  study.observationCount = input.observations.length;
  study.candidateCount = computed.length;
  study.createdAt = now;
  study.completedAt = now;

  await withSession(async (session) => {
    session.trackNew(tableOf(AdherenceStudy), study, study.id);
    for (const observation of input.observations) {
      const entity = new AdherenceObservation();
      entity.id = randomUUID();
      entity.studyId = study.id;
      entity.year = observation.year;
      entity.age = observation.age;
      entity.sex = observation.sex;
      entity.exposure = observation.exposure;
      entity.observedEvents = observation.observedEvents;
      session.trackNew(tableOf(AdherenceObservation), entity, entity.id);
    }
    for (let index = 0; index < computed.length; index += 1) {
      const candidate = computed[index];
      const result = new AdherenceCandidateResult();
      result.id = randomUUID();
      result.studyId = study.id;
      result.biometricVersionId = candidate.version.id;
      result.tableCode = candidate.table.code;
      result.tableName = candidate.table.name;
      result.versionLabel = candidate.version.version;
      result.rank = index + 1;
      result.observedEvents = candidate.metrics.observedEvents;
      result.expectedEvents = candidate.metrics.expectedEvents;
      result.chiSquare = candidate.metrics.chiSquare;
      result.chiSquareDf = candidate.metrics.chiSquareDf;
      result.chiSquareCritical = candidate.metrics.chiSquareCritical;
      result.chiSquareP = candidate.metrics.chiSquareP;
      result.chiSquarePass = candidate.metrics.chiSquarePass ? 1 : 0;
      result.ksD = candidate.metrics.ksD;
      result.ksCritical = candidate.metrics.ksCritical;
      result.ksP = candidate.metrics.ksP;
      result.ksPass = candidate.metrics.ksPass ? 1 : 0;
      result.zStatistic = candidate.metrics.zStatistic;
      result.zCritical = candidate.metrics.zCritical;
      result.zP = candidate.metrics.zP;
      result.zPass = candidate.metrics.zPass ? 1 : 0;
      result.fisherP = candidate.metrics.fisherP;
      result.fisherPass = candidate.metrics.fisherPass ? 1 : 0;
      result.dqm = candidate.metrics.dqm;
      result.rejectedTests = candidate.metrics.rejectedTests;
      result.createdAt = now;
      session.trackNew(tableOf(AdherenceCandidateResult), result, result.id);

      for (const cell of candidate.cells) {
        const point = new AdherenceCandidatePoint();
        point.id = randomUUID();
        point.candidateResultId = result.id;
        point.age = cell.age;
        point.sex = cell.sex;
        point.exposure = cell.exposure;
        point.observedEvents = cell.observed;
        point.qx = cell.qx;
        point.expectedEvents = cell.expected;
        point.residual = cell.observed - cell.expected;
        session.trackNew(tableOf(AdherenceCandidatePoint), point, point.id);
      }
    }
    await session.commit();
  });

  return getAdherenceStudy(study.id);
}

function summarizeCandidate(result: AdherenceCandidateResult) {
  return {
    id: result.id,
    biometricVersionId: result.biometricVersionId,
    tableCode: result.tableCode,
    tableName: result.tableName,
    versionLabel: result.versionLabel,
    rank: result.rank,
    observedEvents: Number(result.observedEvents),
    expectedEvents: Number(result.expectedEvents),
    chiSquare: Number(result.chiSquare),
    chiSquareDf: result.chiSquareDf,
    chiSquareCritical: Number(result.chiSquareCritical),
    chiSquareP: Number(result.chiSquareP),
    chiSquarePass: result.chiSquarePass === 1,
    ksD: Number(result.ksD),
    ksCritical: Number(result.ksCritical),
    ksP: Number(result.ksP),
    ksPass: result.ksPass === 1,
    zStatistic: Number(result.zStatistic),
    zCritical: Number(result.zCritical),
    zP: Number(result.zP),
    zPass: result.zPass === 1,
    fisherP: Number(result.fisherP),
    fisherPass: result.fisherPass === 1,
    dqm: Number(result.dqm),
    rejectedTests: result.rejectedTests
  };
}

export async function listAdherenceStudies() {
  return withSession(async (session) => {
    const studies = await selectFromEntity(AdherenceStudy).execute(session);
    return studies.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((study) => ({
      id: study.id,
      evaluationId: study.evaluationId ?? null,
      name: study.name,
      hypothesisType: study.hypothesisType,
      periodStart: study.periodStart,
      periodEnd: study.periodEnd,
      sexScope: study.sexScope,
      alpha: Number(study.alpha),
      status: study.status,
      engineVersion: study.engineVersion,
      observationCount: study.observationCount,
      candidateCount: study.candidateCount,
      createdAt: study.createdAt,
      completedAt: study.completedAt ?? null
    }));
  });
}

export async function getAdherenceStudy(studyId: string) {
  return withSession(async (session) => {
    const study = await session.find(AdherenceStudy, studyId);
    if (!study) return null;
    const candidates = (await selectFromEntity(AdherenceCandidateResult).execute(session))
      .filter((result) => result.studyId === study.id)
      .sort((a, b) => a.rank - b.rank);
    return {
      id: study.id,
      evaluationId: study.evaluationId ?? null,
      name: study.name,
      hypothesisType: study.hypothesisType,
      periodStart: study.periodStart,
      periodEnd: study.periodEnd,
      sexScope: study.sexScope,
      alpha: Number(study.alpha),
      fisherSplitAge: study.fisherSplitAge,
      status: study.status,
      engineVersion: study.engineVersion,
      observationCount: study.observationCount,
      candidateCount: study.candidateCount,
      createdAt: study.createdAt,
      completedAt: study.completedAt ?? null,
      candidates: candidates.map(summarizeCandidate)
    };
  });
}

export async function getAdherenceCandidatePoints(candidateResultId: string) {
  return withSession(async (session) => {
    const result = await session.find(AdherenceCandidateResult, candidateResultId);
    if (!result) return null;
    const points = (await selectFromEntity(AdherenceCandidatePoint).execute(session))
      .filter((point) => point.candidateResultId === result.id)
      .sort((a, b) => a.age - b.age || a.sex.localeCompare(b.sex))
      .map((point) => ({
        age: point.age,
        sex: point.sex,
        exposure: Number(point.exposure),
        observedEvents: point.observedEvents,
        qx: Number(point.qx),
        expectedEvents: Number(point.expectedEvents),
        residual: Number(point.residual)
      }));
    return { candidate: summarizeCandidate(result), points };
  });
}
