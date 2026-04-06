import { RefreshCw } from "lucide-react";

const SyncStatusIndicator = () => {
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <RefreshCw size={12} />
      <span>Sincronizado ha 3 min</span>
      <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
    </div>
  );
};

export default SyncStatusIndicator;
