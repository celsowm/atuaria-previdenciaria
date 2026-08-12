import { randomUUID } from "node:crypto";
import { getTableDefFromEntity, selectFromEntity } from "metal-orm";
import { createSession } from "../db.js";
import {
  BiometricTable,
  BiometricTablePoint,
  BiometricTableVersion
} from "../domain/biometric-entities.js";

export type BiometricPointInput = {
  age: number;
  sex: "MALE" | "FEMALE" | "UNISEX";
  qx: number;
};

export type CreateBiometricTableInput = {
  code: string;
  name: string;
  kind: string;
  sexScope: string;
  source?: string;
  description?: string;
  version?: string;
  effectiveFrom?: string;
  points: BiometricPointInput[];
};

export type DeriveBiometricVersionInput = {
  parentVersionId: string;
  version: string;
  transform: "QX_SCALE" | "AGE_SHIFT";
  factor?: number;
  years?: number;
  effectiveFrom?: string;
};

async function withSession<T>(handler: (session: ReturnType<typeof createSession>) => Promise<T>) {
  const session = createSession();
  try {
    return await handler(session);
  } finally {
    await session.dispose();
  }
}

function tableOf(entity: typeof BiometricTable | typeof BiometricTableVersion | typeof BiometricTablePoint) {
  const table = getTableDefFromEntity(entity);
  if (!table) throw new Error(`Metal ORM metadata not bootstrapped for ${entity.name}`);
  return table;
}

function validatePoints(points: BiometricPointInput[]) {
  if (!points.length) throw new Error("A tábua precisa possuir ao menos um ponto.");
  const seen = new Set<string>();
  for (const point of points) {
    if (!Number.isInteger(point.age) || point.age < 0 || point.age > 130) {
      throw new Error(`Idade inválida: ${point.age}.`);
    }
    if (!["MALE", "FEMALE", "UNISEX"].includes(point.sex)) {
      throw new Error(`Sexo inválido na idade ${point.age}: ${point.sex}.`);
    }
    if (!Number.isFinite(point.qx) || point.qx < 0 || point.qx > 1) {
      throw new Error(`qx inválido na idade ${point.age}: ${point.qx}.`);
    }
    const key = `${point.sex}:${point.age}`;
    if (seen.has(key)) throw new Error(`Ponto duplicado para ${point.sex}, idade ${point.age}.`);
    seen.add(key);
  }
}

function summarizeVersion(version: BiometricTableVersion) {
  return {
    id: version.id,
    version: version.version,
    status: version.status,
    effectiveFrom: version.effectiveFrom ?? null,
    effectiveTo: version.effectiveTo ?? null,
    parentVersionId: version.parentVersionId ?? null,
    derivationType: version.derivationType ?? null,
    derivationParametersJson: version.derivationParametersJson,
    minAge: version.minAge,
    maxAge: version.maxAge,
    pointCount: version.pointCount,
    createdAt: version.createdAt
  };
}

export async function createBiometricTable(input: CreateBiometricTableInput) {
  const code = input.code.trim();
  const name = input.name.trim();
  if (!code || !name) throw new Error("Código e nome da tábua são obrigatórios.");
  validatePoints(input.points);

  const existing = await withSession((session) => selectFromEntity(BiometricTable).execute(session));
  if (existing.some((item) => item.code.toUpperCase() === code.toUpperCase())) {
    throw new Error(`Já existe uma tábua com o código ${code}.`);
  }

  const now = new Date().toISOString();
  const table = new BiometricTable();
  table.id = randomUUID();
  table.code = code;
  table.name = name;
  table.kind = input.kind.trim();
  table.sexScope = input.sexScope.trim();
  table.source = input.source?.trim() || null;
  table.description = input.description?.trim() || null;
  table.enabled = 1;
  table.createdAt = now;
  table.updatedAt = now;

  const version = new BiometricTableVersion();
  version.id = randomUUID();
  version.tableId = table.id;
  version.version = input.version?.trim() || "v1";
  version.status = "ACTIVE";
  version.effectiveFrom = input.effectiveFrom?.trim() || null;
  version.effectiveTo = null;
  version.parentVersionId = null;
  version.derivationType = null;
  version.derivationParametersJson = "{}";
  version.minAge = Math.min(...input.points.map((point) => point.age));
  version.maxAge = Math.max(...input.points.map((point) => point.age));
  version.pointCount = input.points.length;
  version.createdAt = now;

  await withSession(async (session) => {
    session.trackNew(tableOf(BiometricTable), table, table.id);
    session.trackNew(tableOf(BiometricTableVersion), version, version.id);
    for (const point of input.points) {
      const entity = new BiometricTablePoint();
      entity.id = randomUUID();
      entity.versionId = version.id;
      entity.age = point.age;
      entity.sex = point.sex;
      entity.qx = point.qx;
      session.trackNew(tableOf(BiometricTablePoint), entity, entity.id);
    }
    await session.commit();
  });

  return getBiometricTable(table.id);
}

export async function listBiometricTables() {
  return withSession(async (session) => {
    const [tables, versions] = await Promise.all([
      selectFromEntity(BiometricTable).execute(session),
      selectFromEntity(BiometricTableVersion).execute(session)
    ]);
    return tables
      .filter((table) => table.enabled === 1)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((table) => {
        const ownVersions = versions
          .filter((version) => version.tableId === table.id)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        const latest = ownVersions[0];
        return {
          id: table.id,
          code: table.code,
          name: table.name,
          kind: table.kind,
          sexScope: table.sexScope,
          source: table.source ?? null,
          description: table.description ?? null,
          versionCount: ownVersions.length,
          latestVersionId: latest?.id ?? null,
          latestVersion: latest?.version ?? null,
          pointCount: latest?.pointCount ?? 0,
          minAge: latest?.minAge ?? null,
          maxAge: latest?.maxAge ?? null,
          updatedAt: table.updatedAt
        };
      });
  });
}

export async function getBiometricTable(tableId: string) {
  return withSession(async (session) => {
    const table = await session.find(BiometricTable, tableId);
    if (!table) return null;
    const versions = (await selectFromEntity(BiometricTableVersion).execute(session))
      .filter((version) => version.tableId === table.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return {
      id: table.id,
      code: table.code,
      name: table.name,
      kind: table.kind,
      sexScope: table.sexScope,
      source: table.source ?? null,
      description: table.description ?? null,
      enabled: table.enabled === 1,
      createdAt: table.createdAt,
      updatedAt: table.updatedAt,
      versions: versions.map(summarizeVersion)
    };
  });
}

export async function getBiometricVersionPoints(versionId: string) {
  return withSession(async (session) => {
    const version = await session.find(BiometricTableVersion, versionId);
    if (!version) return null;
    const points: BiometricPointInput[] = (await selectFromEntity(BiometricTablePoint).execute(session))
      .filter((point) => point.versionId === version.id)
      .sort((a, b) => a.sex.localeCompare(b.sex) || a.age - b.age)
      .map((point) => ({
        age: point.age,
        sex: point.sex as BiometricPointInput["sex"],
        qx: Number(point.qx)
      }));
    return { version: summarizeVersion(version), points };
  });
}

export async function deriveBiometricVersion(tableId: string, input: DeriveBiometricVersionInput) {
  const [table, parentBundle] = await Promise.all([
    withSession((session) => session.find(BiometricTable, tableId)),
    getBiometricVersionPoints(input.parentVersionId)
  ]);
  if (!table) throw new Error("Tábua não encontrada.");
  if (!parentBundle) throw new Error("Versão de origem não encontrada.");

  const parentVersion = await withSession((session) => session.find(BiometricTableVersion, input.parentVersionId));
  if (!parentVersion || parentVersion.tableId !== table.id) {
    throw new Error("A versão de origem não pertence à tábua selecionada.");
  }

  const allVersions = await withSession((session) => selectFromEntity(BiometricTableVersion).execute(session));
  if (allVersions.some((version) => version.tableId === table.id && version.version.toUpperCase() === input.version.trim().toUpperCase())) {
    throw new Error(`A versão ${input.version} já existe nesta tábua.`);
  }

  let derived: BiometricPointInput[];
  let parameters: Record<string, number>;
  if (input.transform === "QX_SCALE") {
    const factor = input.factor;
    if (factor === undefined || !Number.isFinite(factor) || factor <= 0 || factor > 5) {
      throw new Error("factor deve ser maior que zero e menor ou igual a 5.");
    }
    derived = parentBundle.points.map((point) => ({
      age: point.age,
      sex: point.sex,
      qx: Math.min(1, Math.max(0, point.qx * factor))
    }));
    parameters = { factor };
  } else {
    const years = input.years;
    if (years === undefined || !Number.isInteger(years) || years < -20 || years > 20) {
      throw new Error("years deve ser um inteiro entre -20 e 20.");
    }
    const bySexAge = new Map(parentBundle.points.map((point) => [`${point.sex}:${point.age}`, point]));
    derived = parentBundle.points.flatMap((point) => {
      const source = bySexAge.get(`${point.sex}:${point.age + years}`);
      return source ? [{ age: point.age, sex: point.sex, qx: source.qx }] : [];
    });
    parameters = { years };
  }
  validatePoints(derived);

  const now = new Date().toISOString();
  const version = new BiometricTableVersion();
  version.id = randomUUID();
  version.tableId = table.id;
  version.version = input.version.trim();
  version.status = "ACTIVE";
  version.effectiveFrom = input.effectiveFrom?.trim() || null;
  version.effectiveTo = null;
  version.parentVersionId = parentVersion.id;
  version.derivationType = input.transform;
  version.derivationParametersJson = JSON.stringify(parameters);
  version.minAge = Math.min(...derived.map((point) => point.age));
  version.maxAge = Math.max(...derived.map((point) => point.age));
  version.pointCount = derived.length;
  version.createdAt = now;

  await withSession(async (session) => {
    session.trackNew(tableOf(BiometricTableVersion), version, version.id);
    for (const point of derived) {
      const entity = new BiometricTablePoint();
      entity.id = randomUUID();
      entity.versionId = version.id;
      entity.age = point.age;
      entity.sex = point.sex;
      entity.qx = point.qx;
      session.trackNew(tableOf(BiometricTablePoint), entity, entity.id);
    }
    const storedTable = await session.find(BiometricTable, table.id);
    if (storedTable) storedTable.updatedAt = now;
    await session.commit();
  });

  return getBiometricVersionPoints(version.id);
}
