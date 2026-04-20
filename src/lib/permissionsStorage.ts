import {
  GroupPermissions,
  ModuleId,
  Permission,
  DEFAULT_GROUP_PERMISSIONS,
} from "@/types/permissions";
import type { FlowDeskUser } from "@/types/auth";

const KEY = "fd_group_permissions";
const LEGACY_GROUPS_KEY = "fd_groups"; // lista antiga de strings

/** Carrega permissoes dos grupos do localStorage, com migracao dos grupos antigos. */
export function loadGroupPermissions(): GroupPermissions[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as GroupPermissions[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }

    // Migracao: se tiver o formato antigo (array de strings), cria estrutura nova
    const legacyRaw = localStorage.getItem(LEGACY_GROUPS_KEY);
    if (legacyRaw) {
      const legacyNames = JSON.parse(legacyRaw) as string[];
      const migrated: GroupPermissions[] = legacyNames.map((name) => {
        // Procura nas defaults se tem permissoes sugeridas
        const defaultMatch = DEFAULT_GROUP_PERMISSIONS.find(
          (d) => d.name.toLowerCase() === name.toLowerCase()
        );
        return (
          defaultMatch ?? {
            name,
            description: "",
            createdAt: new Date().toISOString(),
            modules: {
              dashboard: ["view"],
              demandas: ["view"],
            },
          }
        );
      });
      saveGroupPermissions(migrated);
      return migrated;
    }

    // Sem nada: retorna os defaults
    saveGroupPermissions(DEFAULT_GROUP_PERMISSIONS);
    return DEFAULT_GROUP_PERMISSIONS;
  } catch {
    return DEFAULT_GROUP_PERMISSIONS;
  }
}

export function saveGroupPermissions(groups: GroupPermissions[]): void {
  localStorage.setItem(KEY, JSON.stringify(groups));
}

export function createGroup(group: GroupPermissions): boolean {
  const all = loadGroupPermissions();
  if (all.some((g) => g.name.toLowerCase() === group.name.toLowerCase())) {
    return false; // ja existe
  }
  all.push({ ...group, createdAt: new Date().toISOString() });
  saveGroupPermissions(all);
  return true;
}

export function updateGroup(name: string, data: Partial<GroupPermissions>): boolean {
  const all = loadGroupPermissions();
  const idx = all.findIndex((g) => g.name.toLowerCase() === name.toLowerCase());
  if (idx === -1) return false;
  // Nao permite mudar o nome pra um que ja existe
  if (data.name && data.name !== name) {
    if (all.some((g) => g.name.toLowerCase() === data.name!.toLowerCase())) return false;
  }
  all[idx] = { ...all[idx], ...data };
  saveGroupPermissions(all);
  return true;
}

export function deleteGroup(name: string): boolean {
  const all = loadGroupPermissions();
  const filtered = all.filter((g) => g.name.toLowerCase() !== name.toLowerCase());
  if (filtered.length === all.length) return false;
  saveGroupPermissions(filtered);
  return true;
}

/**
 * Retorna as permissoes efetivas de um usuario (UNIAO de todos os grupos dele).
 * Master sempre tem acesso total.
 */
export function getUserPermissions(user: FlowDeskUser | null): Record<ModuleId, Set<Permission>> {
  const result: Record<ModuleId, Set<Permission>> = {} as Record<ModuleId, Set<Permission>>;

  if (!user) return result;

  // Master: acesso total
  if (user.role === "master") {
    const allPerms: Permission[] = ["view", "edit", "create", "delete", "export"];
    const modules: ModuleId[] = [
      "dashboard",
      "demandas",
      "demandas_sql",
      "usuarios",
      "grupos",
      "configuracoes",
      "relatorios",
      "sync",
    ];
    for (const m of modules) result[m] = new Set(allPerms);
    return result;
  }

  // User: uniao dos grupos
  const all = loadGroupPermissions();
  const userGroups = user.groups || [];
  for (const groupName of userGroups) {
    const group = all.find((g) => g.name.toLowerCase() === groupName.toLowerCase());
    if (!group) continue;
    for (const [moduleKey, perms] of Object.entries(group.modules)) {
      const key = moduleKey as ModuleId;
      if (!result[key]) result[key] = new Set<Permission>();
      for (const p of perms || []) result[key].add(p);
    }
  }

  return result;
}

export function hasPermission(
  user: FlowDeskUser | null,
  module: ModuleId,
  permission: Permission
): boolean {
  const perms = getUserPermissions(user);
  return perms[module]?.has(permission) ?? false;
}

export function canSeeModule(user: FlowDeskUser | null, module: ModuleId): boolean {
  return hasPermission(user, module, "view");
}
