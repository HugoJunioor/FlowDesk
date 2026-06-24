export type UserRole = "master" | "user";
export type UserStatus = "active" | "blocked";
export type Language = "pt-BR" | "en-US" | "es-ES";

export const VALID_LANGUAGES: readonly Language[] = ["pt-BR", "en-US", "es-ES"] as const;

/** Returns true and narrows to Language if value is a supported locale. */
export function isValidLanguage(value: unknown): value is Language {
  return VALID_LANGUAGES.includes(value as Language);
}

export interface UserThemePreferences {
  mode: "light" | "dark";
  colorTheme: string;
}

export interface FlowDeskUser {
  id: string;
  login: string;
  email: string;
  name: string;
  cpf?: string;
  phone?: string;
  role: UserRole;
  status: UserStatus;
  passwordHash: string;
  isFirstAccess: boolean;
  passwordResetRequested: boolean;
  groups: string[];
  themePreferences?: UserThemePreferences;
  /** Idioma preferencial. Default: pt-BR */
  language?: Language;
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
}
