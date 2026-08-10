import {
  createHash,
  randomBytes,
  randomUUID,
  scrypt as scryptCallback,
  timingSafeEqual
} from "node:crypto";
import { promisify } from "node:util";
import type { AuthUser } from "adorn-api";
import { entityRef, eq, getTableDefFromEntity, selectFromEntity } from "metal-orm";
import { createSession } from "../db.js";
import { User, UserSession } from "../domain/auth-entities.js";

const scrypt = promisify(scryptCallback);
const passwordVersion = "scrypt-v1";
const allowedRoles = new Set(["admin", "actuary", "reviewer"]);
const userRef = entityRef(User);
const userSessionRef = entityRef(UserSession);

export type ApplicationAuthUser = AuthUser & {
  id: string;
  email: string;
  displayName: string;
  role: string;
  roles: string[];
};

export type UserView = {
  id: string;
  email: string;
  displayName: string;
  role: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
};

type Session = ReturnType<typeof createSession>;

async function withSession<T>(handler: (session: Session) => Promise<T>) {
  const session = createSession();
  try {
    return await handler(session);
  } finally {
    await session.dispose();
  }
}

function tableFor<T extends typeof User | typeof UserSession>(entity: T) {
  const table = getTableDefFromEntity(entity);
  if (!table) throw new Error(`Metal ORM metadata not bootstrapped for ${entity.name}`);
  return table;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function validateEmail(email: string) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("E-mail inválido.");
  }
}

function validateRole(role: string) {
  if (!allowedRoles.has(role)) {
    throw new Error("Perfil inválido. Use admin, actuary ou reviewer.");
  }
}

function validatePassword(password: string) {
  if (password.length < 10) {
    throw new Error("A senha deve possuir ao menos 10 caracteres.");
  }
}

async function hashPassword(password: string) {
  validatePassword(password);
  const salt = randomBytes(16);
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `${passwordVersion}$${salt.toString("base64url")}$${derived.toString("base64url")}`;
}

async function verifyPassword(password: string, encoded: string) {
  const [version, saltEncoded, hashEncoded] = encoded.split("$");
  if (version !== passwordVersion || !saltEncoded || !hashEncoded) return false;
  const salt = Buffer.from(saltEncoded, "base64url");
  const expected = Buffer.from(hashEncoded, "base64url");
  const actual = (await scrypt(password, salt, expected.length)) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function sessionTtlMs() {
  const configured = Number(process.env.APP_SESSION_TTL_DAYS ?? 7);
  const days = Number.isFinite(configured) && configured > 0 ? configured : 7;
  return days * 24 * 60 * 60 * 1000;
}

function toView(user: User): UserView {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    active: user.active === 1,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastLoginAt: user.lastLoginAt ?? null
  };
}

function toAuthUser(user: User): ApplicationAuthUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    roles: [user.role]
  };
}

async function allUsers() {
  return withSession((session) => selectFromEntity(User).execute(session));
}

async function findUserByEmail(email: string) {
  return withSession(async (session) => {
    const [user] = await selectFromEntity(User)
      .where(eq(userRef.email, email))
      .limit(1)
      .execute(session);
    return user ?? null;
  });
}

async function findSessionByTokenHash(hash: string) {
  return withSession(async (session) => {
    const [record] = await selectFromEntity(UserSession)
      .where(eq(userSessionRef.tokenHash, hash))
      .limit(1)
      .execute(session);
    return record ?? null;
  });
}

export async function bootstrapAdminFromEnvironment() {
  const users = await allUsers();
  if (users.length > 0) return;

  const email = process.env.APP_BOOTSTRAP_ADMIN_EMAIL?.trim();
  const password = process.env.APP_BOOTSTRAP_ADMIN_PASSWORD;
  if (!email && !password) {
    console.warn(
      "Application has no users. Set APP_BOOTSTRAP_ADMIN_EMAIL and APP_BOOTSTRAP_ADMIN_PASSWORD to create the first administrator."
    );
    return;
  }
  if (!email || !password) {
    throw new Error(
      "APP_BOOTSTRAP_ADMIN_EMAIL and APP_BOOTSTRAP_ADMIN_PASSWORD must be configured together."
    );
  }

  await createUser({
    email,
    displayName: process.env.APP_BOOTSTRAP_ADMIN_NAME?.trim() || "Administrador",
    password,
    role: "admin"
  });
  console.log(`Bootstrap administrator created: ${normalizeEmail(email)}`);
}

export async function listUsers() {
  const users = await allUsers();
  return users
    .sort((a, b) => a.displayName.localeCompare(b.displayName, "pt-BR"))
    .map(toView);
}

export async function createUser(input: {
  email: string;
  displayName: string;
  password: string;
  role: string;
}) {
  const email = normalizeEmail(input.email);
  validateEmail(email);
  validateRole(input.role);
  const displayName = input.displayName.trim();
  if (!displayName) throw new Error("Nome do usuário é obrigatório.");

  if (await findUserByEmail(email)) {
    throw new Error("Já existe um usuário com este e-mail.");
  }

  const now = new Date().toISOString();
  const user = new User();
  user.id = randomUUID();
  user.email = email;
  user.displayName = displayName;
  user.passwordHash = await hashPassword(input.password);
  user.role = input.role;
  user.active = 1;
  user.createdAt = now;
  user.updatedAt = now;
  user.lastLoginAt = null;

  await withSession(async (session) => {
    session.trackNew(tableFor(User), user, user.id);
    await session.commit();
  });
  return toView(user);
}

export async function updateUser(
  id: string,
  input: {
    displayName?: string;
    role?: string;
    active?: boolean;
    password?: string;
  }
) {
  const shouldRevokeSessions = input.password !== undefined || input.active === false;
  const updated = await withSession(async (session) => {
    const user = await session.find(User, id);
    if (!user) return null;

    if (input.role !== undefined) validateRole(input.role);
    if (input.displayName !== undefined && !input.displayName.trim()) {
      throw new Error("Nome do usuário é obrigatório.");
    }

    const removesAdmin =
      user.role === "admin" &&
      user.active === 1 &&
      ((input.role !== undefined && input.role !== "admin") || input.active === false);
    if (removesAdmin) {
      const users = await selectFromEntity(User).execute(session);
      const activeAdmins = users.filter((candidate) => candidate.role === "admin" && candidate.active === 1);
      if (activeAdmins.length <= 1) {
        throw new Error("Não é possível remover ou desativar o último administrador ativo.");
      }
    }

    if (input.displayName !== undefined) user.displayName = input.displayName.trim();
    if (input.role !== undefined) user.role = input.role;
    if (input.active !== undefined) user.active = input.active ? 1 : 0;
    if (input.password !== undefined) user.passwordHash = await hashPassword(input.password);
    user.updatedAt = new Date().toISOString();
    session.markDirty(user);
    await session.commit();
    return toView(user);
  });

  if (updated && shouldRevokeSessions) {
    await revokeUserSessions(id);
  }
  return updated;
}

export async function login(emailInput: string, password: string) {
  const email = normalizeEmail(emailInput);
  const user = await findUserByEmail(email);
  if (!user || user.active !== 1 || !(await verifyPassword(password, user.passwordHash))) {
    return null;
  }

  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  const sessionRecord = new UserSession();
  sessionRecord.id = randomUUID();
  sessionRecord.userId = user.id;
  sessionRecord.tokenHash = tokenHash(token);
  sessionRecord.createdAt = now.toISOString();
  sessionRecord.expiresAt = new Date(now.getTime() + sessionTtlMs()).toISOString();
  sessionRecord.revokedAt = null;

  await withSession(async (session) => {
    session.trackNew(tableFor(UserSession), sessionRecord, sessionRecord.id);
    const storedUser = await session.find(User, user.id);
    if (!storedUser) throw new Error("Usuário desapareceu durante a autenticação.");
    storedUser.lastLoginAt = now.toISOString();
    storedUser.updatedAt = now.toISOString();
    session.markDirty(storedUser);
    await session.commit();
  });

  return {
    token,
    expiresAt: sessionRecord.expiresAt,
    user: toView({ ...user, lastLoginAt: now.toISOString(), updatedAt: now.toISOString() } as User)
  };
}

export async function verifyBearerToken(token: string): Promise<ApplicationAuthUser | null> {
  const sessionRecord = await findSessionByTokenHash(tokenHash(token));
  if (
    !sessionRecord ||
    sessionRecord.revokedAt ||
    Date.parse(sessionRecord.expiresAt) <= Date.now()
  ) {
    return null;
  }

  return withSession(async (session) => {
    const user = await session.find(User, sessionRecord.userId);
    if (!user || user.active !== 1) return null;
    return toAuthUser(user);
  });
}

export async function logout(token: string) {
  const sessionRecord = await findSessionByTokenHash(tokenHash(token));
  if (!sessionRecord || sessionRecord.revokedAt) return;

  return withSession(async (session) => {
    const stored = await session.find(UserSession, sessionRecord.id);
    if (!stored || stored.revokedAt) return;
    stored.revokedAt = new Date().toISOString();
    session.markDirty(stored);
    await session.commit();
  });
}

export async function revokeUserSessions(userId: string) {
  return withSession(async (session) => {
    const sessions = await selectFromEntity(UserSession)
      .where(eq(userSessionRef.userId, userId))
      .execute(session);
    const now = new Date().toISOString();
    let changed = false;
    for (const sessionRecord of sessions) {
      if (sessionRecord.revokedAt) continue;
      sessionRecord.revokedAt = now;
      session.markDirty(sessionRecord);
      changed = true;
    }
    if (changed) await session.commit();
  });
}
