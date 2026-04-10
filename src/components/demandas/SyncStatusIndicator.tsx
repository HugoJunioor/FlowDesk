import { useState, useEffect, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

const SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutos

const SyncStatusIndicator = () => {
  const [lastSync, setLastSync] = useState(new Date());
  const [isSyncing, setIsSyncing] = useState(false);
  const [minutesAgo, setMinutesAgo] = useState(0);

  const doSync = useCallback(async () => {
    setIsSyncing(true);
    // Simula sync (futuro: chamada real ao backend)
    await new Promise((r) => setTimeout(r, 800));
    setLastSync(new Date());
    setMinutesAgo(0);
    setIsSyncing(false);
  }, []);

  // Update "X min ago" every 30s
  useEffect(() => {
    const timer = setInterval(() => {
      setMinutesAgo(Math.floor((Date.now() - lastSync.getTime()) / 60000));
    }, 30000);
    return () => clearInterval(timer);
  }, [lastSync]);

  // Auto sync every 5 min
  useEffect(() => {
    const timer = setInterval(() => {
      doSync();
    }, SYNC_INTERVAL);
    return () => clearInterval(timer);
  }, [doSync]);

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-8 px-3 text-xs text-muted-foreground hover:text-foreground gap-1.5"
      onClick={doSync}
      disabled={isSyncing}
    >
      <span className="sm:hidden">Sincronizar</span>
      <RefreshCw size={13} className={isSyncing ? "animate-spin" : ""} />
      <span className="hidden sm:inline">
        {isSyncing
          ? "Sincronizando..."
          : minutesAgo === 0
          ? "Atualizado agora"
          : `Ha ${minutesAgo} min`}
      </span>
      <span className="w-1.5 h-1.5 rounded-full bg-success shrink-0" />
    </Button>
  );
};

export default SyncStatusIndicator;
