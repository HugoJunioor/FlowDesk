import { sha256 } from "js-sha256";
import type { FlowDeskUser, UserRole } from "@/types/auth";

const USERS_KEY = "fd_users_v2";
const GROUPS_KEY = "fd_groups";
const SESSION_KEY = "fd_session_v2";
const SESSION_DURATION = 8 * 60 * 60 * 1000;

// ── Crypto ────────────────────────────────────────────────────────────────────

/**
 * Gera SHA-256 em hex. Usa crypto.subtle (nativo) quando disponivel,
 * com fallback para js-sha256 em contextos nao-seguros (HTTP via IP de rede).
 * O output e identico em ambos os caminhos.
 */
export async function hashPassword(str: string): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    try {
      const data = new TextEncoder().encode(str);
      const buf = await crypto.subtle.digest("SHA-256", data);
      return Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    } catch { /* fall through */ }
  }
  return sha256(str);
}

/** Gera UUID v4. Usa crypto.randomUUID quando disponivel, com fallback puro JS. */
function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    try { return crypto.randomUUID(); } catch { /* fall through */ }
  }
  // Fallback RFC 4122 v4
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20,32)}`;
}

// ── Password generation ───────────────────────────────────────────────────────

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

function saveUsers(users: FlowDeskUser[]): void {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

// ── Initialization ────────────────────────────────────────────────────────────

export async function initializeAuth(): Promise<void> {
  const users = getUsers();
  if (users.length === 0) {
    const passwordHash = await hashPassword("Admin@1");
    const master: FlowDeskUser = {
      id: "master-001",
      login: "master",
      email: "admin@company.com",
      name: "Administrador",
      role: "master",
      status: "active",
      passwordHash,
      isFirstAccess: false,
      passwordResetRequested: false,
      groups: [],
      createdAt: new Date().toISOString(),
      createdBy: "system",
    };
    saveUsers([master]);
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

// ── CRUD ──────────────────────────────────────────────────────────────────────

export function getAllUsers(): FlowDeskUser[] {
  return getUsers();
}

export function getUserById(id: string): FlowDeskUser | undefined {
  return getUsers().find((u) => u.id === id);
}

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
  const users = getUsers();
  const login = generateLogin(
    data.name,
    users.map((u) => u.login)
  );
  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);

  const user: FlowDeskUser = {
    id: generateUUID(),
    login,
    email: data.email.toLowerCase().trim(),
    name: data.name.trim(),
    role: data.role,
    status: "active",
    passwordHash,
    isFirstAccess: true,
    passwordResetRequested: false,
    groups: data.groups,
    createdAt: new Date().toISOString(),
    createdBy: data.createdBy,
  };

  saveUsers([...users, user]);
  return { user, tempPassword };
}

export function updateUser(
  id: string,
  data: Partial<Omit<FlowDeskUser, "id" | "passwordHash" | "createdAt" | "createdBy">>
): boolean {
  const users = getUsers();
  const idx = users.findIndex((u) => u.id === id);
  if (idx === -1) return false;
  users[idx] = { ...users[idx], ...data, updatedAt: new Date().toISOString() };
  saveUsers(users);
  return true;
}

export function deleteUser(id: string): boolean {
  const users = getUsers();
  const filtered = users.filter((u) => u.id !== id && u.role !== "master");
  if (filtered.length === users.length) return false; // não encontrado ou é master
  const target = users.find((u) => u.id === id);
  if (target?.role === "master") return false; // protege master
  saveUsers(users.filter((u) => u.id !== id));
  return true;
}

export async function changeUserPassword(
  id: string,
  newPassword: string
): Promise<boolean> {
  const users = getUsers();
  const idx = users.findIndex((u) => u.id === id);
  if (idx === -1) return false;
  const passwordHash = await hashPassword(newPassword);
  users[idx] = {
    ...users[idx],
    passwordHash,
    isFirstAccess: false,
    passwordResetRequested: false,
    updatedAt: new Date().toISOString(),
  };
  saveUsers(users);
  return true;
}

export async function generateResetPassword(userId: string): Promise<string> {
  const users = getUsers();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx === -1) return "";
  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);
  users[idx] = {
    ...users[idx],
    passwordHash,
    isFirstAccess: true,
    passwordResetRequested: false,
    updatedAt: new Date().toISOString(),
  };
  saveUsers(users);
  return tempPassword;
}

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

export function getPasswordStrength(password: string): {
  level: PasswordStrengthLevel;
  label: string;
  isStrong: boolean;
} {
  if (!password) return { level: 0, label: "", isStrong: false };
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNum = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);
  const classes = [hasUpper, hasLower, hasNum, hasSpecial].filter(Boolean).length;

  if (password.length < 6 || classes <= 1) return { level: 1, label: "Fraca", isStrong: false };
  if (classes >= 4) return { level: 3, label: "Forte", isStrong: true };
  return { level: 2, label: "Média", isStrong: false };
}
