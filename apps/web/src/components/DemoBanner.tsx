/**
 * Banner exibido apenas em modo demo (Vercel preview/portfolio).
 * Mostra credenciais de acesso e avisa que dados sao ficticios.
 */
import { Sparkles, X } from "lucide-react";
import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";

export const isDemoMode = import.meta.env.VITE_DEMO_MODE === "true";

export const DemoBanner = () => {
  const { t } = useLanguage();
  const [hidden, setHidden] = useState(false);
  if (!isDemoMode || hidden) return null;
  return (
    <div className="bg-gradient-to-r from-primary/15 via-primary/10 to-primary/15 border-b border-primary/30 px-4 py-2 flex items-center justify-center gap-3 text-sm">
      <Sparkles size={14} className="text-primary shrink-0" />
      <span className="text-foreground/90">
        <strong className="text-primary">{t("demo.label")}</strong> · {t("demo.fake_data")} ·
        {" "}{t("demo.login_label")} <code className="px-1.5 py-0.5 rounded bg-background/60 font-mono text-xs">master</code> /
        {" "}{t("demo.password_label")} <code className="px-1.5 py-0.5 rounded bg-background/60 font-mono text-xs">Admin@1</code>
      </span>
      <button
        onClick={() => setHidden(true)}
        className="ml-2 opacity-60 hover:opacity-100 transition-opacity"
        aria-label={t("demo.close_banner")}
      >
        <X size={14} />
      </button>
    </div>
  );
};
