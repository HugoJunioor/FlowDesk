import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getUserPermissions, hasPermission, canSeeModule } from "@/lib/permissionsStorage";
import { ModuleId, Permission } from "@/types/permissions";

/**
 * Hook para verificar permissoes do usuario atual.
 *
 * Uso:
 *   const { can, canSee, isMaster } = usePermissions();
 *   if (canSee("demandas_sql")) { ... }
 *   if (can("demandas", "edit")) { ... }
 */
export function usePermissions() {
  const { currentUser } = useAuth();

  const permissions = useMemo(() => getUserPermissions(currentUser), [currentUser]);

  const can = (module: ModuleId, permission: Permission): boolean => {
    return hasPermission(currentUser, module, permission);
  };

  const canSee = (module: ModuleId): boolean => {
    return canSeeModule(currentUser, module);
  };

  return {
    permissions,
    can,
    canSee,
    isMaster: currentUser?.role === "master",
    currentUser,
  };
}
