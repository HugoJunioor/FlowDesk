export type UserRole = "master" | "user";
export type UserStatus = "active" | "blocked";

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
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
}
