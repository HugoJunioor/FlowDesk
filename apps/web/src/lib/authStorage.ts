import type { FlowDeskUser, UserRole } from "@/types/auth";
import { isValidLanguage } from "@/types/auth";
import { hashPassword as cryptoHashPassword, verifyPassword, generateUUID } from "@/lib/crypto";
import { usuariosApi, type UsuarioApi } from "@/modules/auth/api";

const USERS_KEY = "fd_users_v2";
const GROUPS_KEY = "fd_groups";
const SESSION_KEY = "fd_session_v2";
const SESSION_DURATION = 8 * 60 * 60 * 1000;

/** Hash de senha usando PBKDF2 com salt + 150k iteracoes. Reexporta da lib central. */
export const hashPassword = cryptoHashPassword;

/**
 * Valida senha contra usuario armazenado, fazendo migracao transparente
 * de hashes legados (SHA-256) para PBKDF2.
 * Retorna true se a senha esta correta.
 */
export async function checkPasswordAndMigrate(user: FlowDeskUser, password: string): Promise<boolean> {
  const result = await verifyPassword(password, user.passwordHash);
  if (!result.valid) return false;
  if (result.needsRehash) {
    // Re-hash com algoritmo atual e atualiza o registro silenciosamente.
    try {
      const users = getUsers();
      const idx = users.findIndex((u) => u.id === user.id);
      if (idx !== -1) {
        users[idx] = { ...users[idx], passwordHash: await cryptoHashPassword(password) };
        saveUsers(users);
      }
    } catch {
      /* ignore — login continua valido mesmo se migracao falhar */
    }
  }
  return true;
}

// ── Password generation ───────────────────────────────────────────────────────

/**
 * Gera senha aleatoria forte (16 chars) pra bootstrap inicial do master.
 * Usado quando VITE_BOOTSTRAP_PASSWORD nao esta definido.
 */
export function generateRandomPassword(length = 16): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*";
  const arr = new Uint8Array(length);
  // Usa crypto.getRandomValues quando disponivel (browser e Node 19+)
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < length; i++) arr[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(arr, (b) => chars[b % chars.length]).join("");
}

export function generateTempPassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const nums = "23456789";
  const special = "!@#$%&*";
  const all = upper + lower + nums + special;

  const chars = [
    upper[Math.floor(Math.random() * upper.length)],
    lower[Math.floor(Math.random() * lower.length)],
    nums[Math.floor(Math.random() * nums.length)],
    special[Math.floor(Math.random() * special.length)],
  ];
  for (let i = 4; i < 10; i++) {
    chars.push(all[Math.floor(Math.random() * all.length)]);
  }
  // Fisher-Yates shuffle
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

// ── Login generation ──────────────────────────────────────────────────────────

function generateLogin(name: string, existingLogins: string[]): string {
  const normalized = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const base =
    normalized.length >= 2
      ? `${normalized[0]}.${normalized[normalized.length - 1]}`
      : normalized[0] || "usuario";

  let candidate = base;
  let i = 2;
  while (existingLogins.map((l) => l.toLowerCase()).includes(candidate)) {
    candidate = `${base}${i++}`;
  }
  return candidate;
}

// ── Storage helpers ───────────────────────────────────────────────────────────

function getUsers(): FlowDeskUser[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? (JSON.parse(raw) as FlowDeskUser[]) : [];
  } catch {
    return [];
  }
}

/**
 * Sync read of the local user cache. Use in code paths where async is not
 * an option (e.g. sync resolvers). Returns whatever was last hydrated by
 * `getAllUsers()` / `initializeAuth()`; may be stale or empty.
 */
export function getCachedUsers(): FlowDeskUser[] {
  return getUsers();
}

function saveUsers(users: FlowDeskUser[]): void {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

// ── Initialization ────────────────────────────────────────────────────────────

export async function initializeAuth(): Promise<void> {
  const users = getUsers();
  const isDemo = (typeof import.meta !== "undefined" && import.meta.env?.VITE_DEMO_MODE === "true");
  if (users.length === 0) {
    // Em demo mode mantem senha conhecida pro reviewer testar.
    // Em prod, a senha vem de VITE_BOOTSTRAP_PASSWORD ou eh gerada aleatoria
    // e printada no console (operador precisa anotar e trocar no 1o login).
    let bootstrapPassword: string;
    let logBootstrap = false;
    if (isDemo) {
      bootstrapPassword = "Admin@1";
    } else {
      const envPwd = (typeof import.meta !== "undefined")
        ? import.meta.env?.VITE_BOOTSTRAP_PASSWORD as string | undefined
        : undefined;
      if (envPwd && envPwd.length >= 8) {
        bootstrapPassword = envPwd;
      } else {
        // Senha aleatoria de 16 chars — operador precisa anotar do console
        bootstrapPassword = generateRandomPassword(16);
        logBootstrap = true;
      }
    }
    const passwordHash = await hashPassword(bootstrapPassword);
    const master: FlowDeskUser = {
      id: "master-001",
      login: "master",
      email: isDemo ? "demo@flowdesk.app" : "admin@company.com",
      name: isDemo ? "Demo Master" : "Administrador",
      role: "master",
      status: "active",
      passwordHash,
      // Forca troca de senha no primeiro login (exceto demo)
      isFirstAccess: !isDemo,
      passwordResetRequested: false,
      groups: [],
      createdAt: new Date().toISOString(),
      createdBy: "system",
    };
    saveUsers([master]);
    if (logBootstrap) {
       
      console.warn(
        `[FlowDesk] Master user criado.\n  Login: master\n  Senha: ${bootstrapPassword}\n  ANOTE AGORA — vai ser pedido pra trocar no 1o login.`,
      );
    }
    localStorage.setItem(
      GROUPS_KEY,
      JSON.stringify(["Suporte", "Desenvolvimento", "Gestão", "Comercial"])
    );
  } else {
    // Migration: update master login from "admin" to "master" if needed
    const idx = users.findIndex((u) => u.role === "master" && u.login === "admin");
    if (idx !== -1) {
      users[idx] = { ...users[idx], login: "master" };
      saveUsers(users);
    }
  }
}

// ── API ↔ local shape conversion ──────────────────────────────────────────────

function apiToLocal(u: UsuarioApi): FlowDeskUser {
  // API is the source of truth for prefs; fall back to local cache for compat
  // (e.g. when the API returns null because the user never set prefs via new API)
  const local = getUsers().find((l) => l.id === u.id);
  return {
    id: u.id,
    login: u.login,
    email: u.email,
    name: u.nome,
    role: u.perfil,
    status: u.status,
    passwordHash: local?.passwordHash ?? "",
    isFirstAccess: u.primeiroAcesso,
    passwordResetRequested: u.resetSenhaSolicitado,
    groups: local?.groups ?? [],
    themePreferences: u.themePreferences ?? local?.themePreferences,
    language: (() => { const lang = u.language ?? local?.language; return isValidLanguage(lang) ? lang : undefined; })(),
    createdAt: u.criadoEm,
    createdBy: local?.createdBy ?? "api",
    updatedAt: u.atualizadoEm,
  };
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

/**
 * Returns all users. Fetches from API (source of truth).
 * Falls back to the local legacy snapshot if the API call fails
 * (e.g., network offline) so the UI doesn't crash.
 */
export async function getAllUsers(): Promise<FlowDeskUser[]> {
  try {
    const apiUsers = await usuariosApi.list();
    return apiUsers.map(apiToLocal);
  } catch {
    return getUsers();
  }
}

/** Sync local cache lookup — used by AuthContext only after session restore. */
export function getUserById(id: string): FlowDeskUser | undefined {
  return getUsers().find((u) => u.id === id);
}

/** Removed from the API-first flow; kept for backward compat with legacy reads. */
export function getUserByLogin(login: string): FlowDeskUser | undefined {
  return getUsers().find((u) => u.login.toLowerCase() === login.trim().toLowerCase());
}

export function getUserByEmail(email: string): FlowDeskUser | undefined {
  return getUsers().find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
}

export async function createUser(data: {
  name: string;
  email: string;
  role: UserRole;
  groups: string[];
  createdBy: string;
}): Promise<{ user: FlowDeskUser; tempPassword: string }> {
  const { usuario, senhaTempOraria } = await usuariosApi.create({
    nome: data.name,
    email: data.email,
    perfil: data.role,
  });
  return { user: apiToLocal(usuario), tempPassword: senhaTempOraria };
}

export async function updateUser(
  id: string,
  data: Partial<Omit<FlowDeskUser, "id" | "passwordHash" | "createdAt" | "createdBy">>
): Promise<boolean> {
  try {
    await usuariosApi.update(id, {
      nome: data.name,
      perfil: data.role,
      status: data.status,
    });
    return true;
  } catch {
    return false;
  }
}

export async function deleteUser(id: string): Promise<boolean> {
  try {
    await usuariosApi.delete(id);
    return true;
  } catch {
    return false;
  }
}

export async function generateResetPassword(userId: string): Promise<string> {
  try {
    const { senhaTempOraria } = await usuariosApi.resetPassword(userId);
    return senhaTempOraria;
  } catch {
    return "";
  }
}

/** Legacy: kept for the forgot-password flow in Login.tsx (not yet migrated). */
export function requestPasswordReset(email: string): boolean {
  const users = getUsers();
  const idx = users.findIndex(
    (u) => u.email.toLowerCase() === email.trim().toLowerCase()
  );
  if (idx === -1) return false;
  users[idx] = { ...users[idx], passwordResetRequested: true };
  saveUsers(users);
  return true;
}

// ── Groups ────────────────────────────────────────────────────────────────────

export function getGroups(): string[] {
  try {
    const raw = localStorage.getItem(GROUPS_KEY);
    return raw ? JSON.parse(raw) : ["Suporte", "Desenvolvimento", "Gestão", "Comercial"];
  } catch {
    return [];
  }
}

export function saveGroups(groups: string[]): void {
  localStorage.setItem(GROUPS_KEY, JSON.stringify(groups));
}

// ── Session ───────────────────────────────────────────────────────────────────

export interface Session {
  userId: string;
  role: string;
  expires: number;
}

export function getSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    if (Date.now() > s.expires) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

export function setSession(user: FlowDeskUser): void {
  const session: Session = {
    userId: user.id,
    role: user.role,
    expires: Date.now() + SESSION_DURATION,
  };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  sessionStorage.removeItem(SESSION_KEY);
}

// ── Email validation ──────────────────────────────────────────────────────────

export function isJustEmail(email: string): boolean {
  // Domínio configurável via variável de ambiente ou aceita qualquer e-mail corporativo
  const domain = import.meta.env?.VITE_ALLOWED_EMAIL_DOMAIN || "";
  if (!domain) return email.includes("@") && email.includes(".");
  return email.trim().toLowerCase().endsWith(`@${domain}`);
}

// ── CPF validation ────────────────────────────────────────────────────────────

export function validateCPF(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  const calcDigit = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) {
      sum += parseInt(digits[i]) * (len + 1 - i);
    }
    const rem = sum % 11;
    return rem < 2 ? 0 : 11 - rem;
  };

  return calcDigit(9) === parseInt(digits[9]) && calcDigit(10) === parseInt(digits[10]);
}

// ── Password strength ─────────────────────────────────────────────────────────

export type PasswordStrengthLevel = 0 | 1 | 2 | 3;

/** Lista mínima de senhas obviamente fracas que NUNCA devem ser aceitas. */
const WEAK_PASSWORDS = new Set([
  "admin@1", "admin@123", "admin123", "admin1234", "password", "password1",
  "password@1", "senha@1", "senha123", "123456", "12345678", "qwerty",
  "qwerty123", "abc123", "111111", "000000", "master@1", "master123",
  "flowdesk", "flowdesk@1", "just@1", "just123", "mudar@1", "trocar@1",
]);

export function isWeakPassword(password: string): boolean {
  return WEAK_PASSWORDS.has(password.toLowerCase().trim());
}

export function getPasswordStrength(password: string): {
  level: PasswordStrengthLevel;
  label: string;
  isStrong: boolean;
} {
  if (!password) return { level: 0, label: "", isStrong: false };
  if (isWeakPassword(password)) return { level: 1, label: "Fraca (lista negra)", isStrong: false };
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNum = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);
  const classes = [hasUpper, hasLower, hasNum, hasSpecial].filter(Boolean).length;

  if (password.length < 8 || classes <= 1) return { level: 1, label: "Fraca", isStrong: false };
  if (password.length >= 10 && classes >= 4) return { level: 3, label: "Forte", isStrong: true };
  return { level: 2, label: "Média", isStrong: false };
}
