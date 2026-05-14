import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient, ApiError } from "@/lib/apiClient";

/**
 * Hook para disparar sync Slack manualmente.
 *
 * Uso:
 *   const { trigger, isPending } = useSyncTrigger();
 *   <button onClick={trigger} disabled={isPending}>Sincronizar</button>
 *
 * Em prod (501): mostra toast informativo em vez de erro genérico.
 */
export function useSyncTrigger() {
  const mutation = useMutation({
    mutationFn: () => apiClient.sync.trigger(),
    onSuccess: (data) => {
      if (data.ok) {
        toast.success("Sync concluído", {
          description: "Demandas Slack atualizadas. Recarregue a página para ver.",
        });
      } else {
        toast.warning("Sync encerrou com avisos", {
          description: data.stderr?.slice(0, 200) || "Verifique o terminal.",
        });
      }
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError && err.status === 501) {
        toast.info("Sync não disponível aqui", {
          description: "Execute syncSlack.cjs localmente ou aguarde o ciclo automático (5min).",
        });
        return;
      }
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Erro ao sincronizar", { description: msg });
    },
  });

  return {
    trigger: mutation.mutate,
    isPending: mutation.isPending,
  };
}
