import {
  createHash,
  randomBytes,
  randomUUID,
  scrypt as scryptCallback,
  timingSafeEqual
} from "node:crypto";
import { promisify } from "node:util";
import type { AuthUser } from "adorn-api";
import { consultarSql, executarSql } from "../db.js";
import { Usuario } from "../domain/autenticacao-entities.js";

const scrypt = promisify(scryptCallback);
const passwordVersion = "scrypt-v1";
const allowedRoles = new Set(["admin", "actuary", "reviewer"]);

export type ApplicationUsuarioAutenticado = AuthUser & {
  id: string;
  email: string;
  nomeExibicao: string;
  perfil: string;
  roles: string[];
};

export type UsuarioView = {
  id: string;
  email: string;
  nomeExibicao: string;
  perfil: string;
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
  ultimoAcessoEm: string | null;
};

const camposUsuario = `id,email,nome_exibicao AS nomeExibicao,resumo_senha AS resumoSenha,perfil AS perfil,ativo AS ativo,criado_em AS criadoEm,atualizado_em AS atualizadoEm,ultimo_acesso_em AS ultimoAcessoEm`;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function validateEmail(email: string) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("E-mail inválido.");
  }
}

function validateRole(perfil: string) {
  if (!allowedRoles.has(perfil)) {
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
  const [versao, saltEncoded, hashEncoded] = encoded.split("$");
  if (versao !== passwordVersion || !saltEncoded || !hashEncoded) return false;
  const salt = Buffer.from(saltEncoded, "base64url");
  const esperado = Buffer.from(hashEncoded, "base64url");
  const actual = (await scrypt(password, salt, esperado.length)) as Buffer;
  return esperado.length === actual.length && timingSafeEqual(esperado, actual);
}

function resumoToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function sessionTtlMs() {
  const configured = Number(process.env.APP_SESSION_TTL_DAYS ?? 7);
  const days = Number.isFinite(configured) && configured > 0 ? configured : 7;
  return days * 24 * 60 * 60 * 1000;
}

function toView(user: Usuario): UsuarioView {
  return {
    id: user.id,
    email: user.email,
    nomeExibicao: user.nomeExibicao,
    perfil: user.perfil,
    ativo: user.ativo === 1,
    criadoEm: user.criadoEm,
    atualizadoEm: user.atualizadoEm,
    ultimoAcessoEm: user.ultimoAcessoEm ?? null
  };
}

function toUsuarioAutenticado(user: Usuario): ApplicationUsuarioAutenticado {
  return {
    id: user.id,
    email: user.email,
    nomeExibicao: user.nomeExibicao,
    perfil: user.perfil,
    roles: [user.perfil]
  };
}

async function allUsuarios() {
  return consultarSql<Usuario>(`SELECT ${camposUsuario} FROM usuarios`);
}

async function findUsuarioByEmail(email: string) {
  const [user] = await consultarSql<Usuario>(`SELECT ${camposUsuario} FROM usuarios WHERE email = ? LIMIT 1`, [email]);
  return user ?? null;
}

async function findSessionByTokenHash(hash: string) {
  const [record] = await consultarSql<{ id: string; usuarioId: string; resumoToken: string; criadoEm: string; expiraEm: string; revogadoEm: string | null }>(
    `SELECT id,usuario_id AS usuarioId,resumo_token AS resumoToken,criado_em AS criadoEm,expira_em AS expiraEm,revogado_em AS revogadoEm FROM sessoes_usuario WHERE resumo_token = ? LIMIT 1`,
    [hash]
  );
  return record ?? null;
}

async function findUsuarioById(id: string) {
  const [user] = await consultarSql<Usuario>(`SELECT ${camposUsuario} FROM usuarios WHERE id = ? LIMIT 1`, [id]);
  return user ?? null;
}

export async function bootstrapAdminFromEnvironment() {
  const usuarios = await allUsuarios();
  if (usuarios.length > 0) return;

  const email = process.env.APP_BOOTSTRAP_ADMIN_EMAIL?.trim();
  const password = process.env.APP_BOOTSTRAP_ADMIN_PASSWORD;
  if (!email && !password) {
    console.warn(
      "Application has no usuarios. Set APP_BOOTSTRAP_ADMIN_EMAIL and APP_BOOTSTRAP_ADMIN_PASSWORD to create the first administrator."
    );
    return;
  }
  if (!email || !password) {
    throw new Error(
      "APP_BOOTSTRAP_ADMIN_EMAIL and APP_BOOTSTRAP_ADMIN_PASSWORD must be configured together."
    );
  }

  await createUsuario({
    email,
    nomeExibicao: process.env.APP_BOOTSTRAP_ADMIN_NAME?.trim() || "Administrador",
    password,
    perfil: "admin"
  });
  console.log(`Bootstrap administrator created: ${normalizeEmail(email)}`);
}

export async function listUsuarios() {
  const usuarios = await allUsuarios();
  return usuarios
    .sort((a, b) => a.nomeExibicao.localeCompare(b.nomeExibicao, "pt-BR"))
    .map(toView);
}

export async function createUsuario(input: {
  email: string;
  nomeExibicao: string;
  password: string;
  perfil: string;
}) {
  const email = normalizeEmail(input.email);
  validateEmail(email);
  validateRole(input.perfil);
  const nomeExibicao = input.nomeExibicao.trim();
  if (!nomeExibicao) throw new Error("Nome do usuário é obrigatório.");

  if (await findUsuarioByEmail(email)) {
    throw new Error("Já existe um usuário com este e-mail.");
  }

  const now = new Date().toISOString();
  const user = new Usuario();
  user.id = randomUUID();
  user.email = email;
  user.nomeExibicao = nomeExibicao;
  user.resumoSenha = await hashPassword(input.password);
  user.perfil = input.perfil;
  user.ativo = 1;
  user.criadoEm = now;
  user.atualizadoEm = now;
  user.ultimoAcessoEm = null;

  await executarSql(
    "INSERT INTO usuarios (id,email,nome_exibicao,resumo_senha,perfil,ativo,criado_em,atualizado_em,ultimo_acesso_em) VALUES (?,?,?,?,?,?,?,?,?)",
    [user.id, user.email, user.nomeExibicao, user.resumoSenha, user.perfil, user.ativo, user.criadoEm, user.atualizadoEm, user.ultimoAcessoEm]
  );
  return toView(user);
}

export async function updateUsuario(
  id: string,
  input: {
    nomeExibicao?: string;
    perfil?: string;
    ativo?: boolean;
    password?: string;
  }
) {
  const shouldRevokeSessions = input.password !== undefined || input.ativo === false;
  const updated = await (async () => {
    const user = await findUsuarioById(id);
    if (!user) return null;

    if (input.perfil !== undefined) validateRole(input.perfil);
    if (input.nomeExibicao !== undefined && !input.nomeExibicao.trim()) {
      throw new Error("Nome do usuário é obrigatório.");
    }

    const removesAdmin =
      user.perfil === "admin" &&
      user.ativo === 1 &&
      ((input.perfil !== undefined && input.perfil !== "admin") || input.ativo === false);
    if (removesAdmin) {
      const usuarios = await allUsuarios();
      const activeAdmins = usuarios.filter((candidate) => candidate.perfil === "admin" && candidate.ativo === 1);
      if (activeAdmins.length <= 1) {
        throw new Error("Não é possível remover ou desativar o último administrador ativo.");
      }
    }

    if (input.nomeExibicao !== undefined) user.nomeExibicao = input.nomeExibicao.trim();
    if (input.perfil !== undefined) user.perfil = input.perfil;
    if (input.ativo !== undefined) user.ativo = input.ativo ? 1 : 0;
    if (input.password !== undefined) user.resumoSenha = await hashPassword(input.password);
    user.atualizadoEm = new Date().toISOString();
    await executarSql("UPDATE usuarios SET nome_exibicao=?, perfil=?, ativo=?, resumo_senha=?, atualizado_em=? WHERE id=?", [user.nomeExibicao, user.perfil, user.ativo, user.resumoSenha, user.atualizadoEm, id]);
    return toView(user);
  })();

  if (updated && shouldRevokeSessions) {
    await revokeSessaoUsuarios(id);
  }
  return updated;
}

export async function login(emailInput: string, password: string) {
  const email = normalizeEmail(emailInput);
  const user = await findUsuarioByEmail(email);
  if (!user || user.ativo !== 1 || !(await verifyPassword(password, user.resumoSenha))) {
    return null;
  }

  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  const sessionId = randomUUID();
  const sessionHash = resumoToken(token);
  const criadoEm = now.toISOString();
  const expiraEm = new Date(now.getTime() + sessionTtlMs()).toISOString();
  await executarSql("INSERT INTO sessoes_usuario (id,usuario_id,resumo_token,criado_em,expira_em,revogado_em) VALUES (?,?,?,?,?,?)", [sessionId, user.id, sessionHash, criadoEm, expiraEm, null]);
  await executarSql("UPDATE usuarios SET ultimo_acesso_em=?, atualizado_em=? WHERE id=?", [criadoEm, criadoEm, user.id]);

  return {
    token,
    expiraEm,
    user: toView({ ...user, ultimoAcessoEm: now.toISOString(), atualizadoEm: now.toISOString() } as Usuario)
  };
}

export async function verifyBearerToken(token: string): Promise<ApplicationUsuarioAutenticado | null> {
  const sessionRecord = await findSessionByTokenHash(resumoToken(token));
  if (
    !sessionRecord ||
    sessionRecord.revogadoEm ||
    Date.parse(sessionRecord.expiraEm) <= Date.now()
  ) {
    return null;
  }

  const user = await findUsuarioById(sessionRecord.usuarioId);
  if (!user || user.ativo !== 1) return null;
  return toUsuarioAutenticado(user);
}

export async function logout(token: string) {
  const sessionRecord = await findSessionByTokenHash(resumoToken(token));
  if (!sessionRecord || sessionRecord.revogadoEm) return;

  await executarSql("UPDATE sessoes_usuario SET revogado_em=? WHERE id=? AND revogado_em IS NULL", [new Date().toISOString(), sessionRecord.id]);
}

export async function revokeSessaoUsuarios(usuarioId: string) {
  await executarSql("UPDATE sessoes_usuario SET revogado_em=? WHERE usuario_id=? AND revogado_em IS NULL", [new Date().toISOString(), usuarioId]);
}
