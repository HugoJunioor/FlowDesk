/**
 * Sistema de permissoes por grupo.
 *
 * - Master: acesso total a tudo (nao afetado)
 * - User: recebe UNIAO das permissoes de todos os grupos em que participa
 * - Se um usuario NAO tem 'view' em um modulo, nao ve nem acessa
 */

export type ModuleId =
  | "dashboard"
  | "demandas"
  | "demandas_sql"
  | "usuarios"
  | "grupos"
  | "configuracoes"
  | "relatorios"
  | "sync";

export type Permission = "view" | "edit" | "create" | "delete" | "export";

export interface GroupPermissions {
  /** Nome do grupo (chave unica, case-sensitive) */
  name: string;
  /** Descricao livre */
  description?: string;
  /** Quando foi criado */
  createdAt?: string;
  /** Permissoes por modulo. Se modulo nao tem entrada, = sem acesso */
  modules: Partial<Record<ModuleId, Permission[]>>;
}

export const MODULES: { id: ModuleId; label: string; icon: string }[] = [
  { id: "dashboard", label: "Dashboard", icon: "LayoutDashboard" },
  { id: "demandas", label: "Demandas", icon: "MessageSquare" },
  { id: "demandas_sql", label: "Demandas SQL", icon: "Database" },
  { id: "usuarios", label: "Usuários", icon: "Users" },
  { id: "grupos", label: "Grupos", icon: "ShieldCheck" },
  { id: "configuracoes", label: "Configurações", icon: "Settings" },
  { id: "relatorios", label: "Relatórios / BI", icon: "FileBarChart" },
  { id: "sync", label: "Forçar sincronização", icon: "RefreshCw" },
];

export const PERMISSIONS: { id: Permission; label: string; description: string }[] = [
  { id: "view", label: "Visualizar", description: "Ver o módulo e seu conteúdo" },
  { id: "create", label: "Criar", description: "Criar novos registros" },
  { id: "edit", label: "Alterar", description: "Editar registros existentes" },
  { id: "delete", label: "Excluir", description: "Apagar registros" },
  { id: "export", label: "Exportar", description: "Gerar relatórios e BI" },
];

/** Grupos padrao com permissoes sugeridas. Usado na primeira migracao. */
export const DEFAULT_GROUP_PERMISSIONS: GroupPermissions[] = [
  {
    name: "Suporte",
    description: "Equipe de atendimento ao cliente",
    modules: {
      dashboard: ["view"],
      demandas: ["view", "edit"],
      demandas_sql: ["view"],
      configuracoes: ["view"],
    },
  },
  {
    name: "Desenvolvimento",
    description: "Time de desenvolvimento/TI",
    modules: {
      dashboard: ["view"],
      demandas: ["view", "edit"],
      demandas_sql: ["view", "edit"],
      sync: ["view"],
      configuracoes: ["view"],
    },
  },
  {
    name: "Gestão",
    description: "Gerência e coordenação",
    modules: {
      dashboard: ["view"],
      demandas: ["view", "edit", "create", "export"],
      demandas_sql: ["view", "export"],
      relatorios: ["view", "export"],
      usuarios: ["view"],
      configuracoes: ["view"],
    },
  },
  {
    name: "Comercial",
    description: "Time comercial",
    modules: {
      dashboard: ["view"],
      demandas: ["view"],
      relatorios: ["view"],
    },
  },
];
