export type UserRole = "master" | "user";
export type UserStatus = "active" | "blocked";
export type Language = "pt-BR" | "en-US" | "es-ES";

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
