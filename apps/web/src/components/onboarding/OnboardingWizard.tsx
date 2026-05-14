import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  Circle,
  ExternalLink,
  RefreshCw,
  Zap,
  Hash,
  PartyPopper,
} from "lucide-react";

interface OnboardingWizardProps {
  currentStep: number;
  onStepChange: (step: number) => void;
  onDismiss: () => void;
}

const SCOPES = [
  "channels:history",
  "channels:read",
  "groups:read",
  "users:read",
  "reactions:read",
  "chat:write",
  "files:write",
];

const STEPS = ["Token Slack", "Convidar bot", "Pronto"];

const OnboardingWizard = ({ currentStep, onStepChange, onDismiss }: OnboardingWizardProps) => {
  const [slackStatus, setSlackStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [syncStatus, setSyncStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");

  const checkSlackConnection = async () => {
    setSlackStatus("loading");
    try {
      const res = await fetch("/api/health");
      if (res.ok) {
        const data = await res.json();
        const slackOk = data?.slack?.status === "ok" || data?.status === "ok";
        setSlackStatus(slackOk ? "ok" : "error");
        if (slackOk) setTimeout(() => onStepChange(1), 600);
      } else {
        setSlackStatus("error");
      }
    } catch {
      setSlackStatus("error");
    }
  };

  const triggerSync = async () => {
    setSyncStatus("loading");
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      setSyncStatus(res.ok ? "ok" : "error");
      if (res.ok) setTimeout(() => onStepChange(2), 600);
    } catch {
      setSyncStatus("error");
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-8">
      {/* Stepper */}
      <div className="flex items-center justify-between mb-8 px-2">
        {STEPS.map((label, idx) => (
          <div key={idx} className="flex items-center flex-1">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors ${
                  idx < currentStep
                    ? "bg-primary border-primary text-primary-foreground"
                    : idx === currentStep
                    ? "border-primary text-primary bg-primary/10"
                    : "border-muted text-muted-foreground bg-muted/30"
                }`}
              >
                {idx < currentStep ? (
                  <CheckCircle2 size={16} />
                ) : (
                  <span className="text-xs font-semibold">{idx + 1}</span>
                )}
              </div>
              <span
                className={`text-[11px] font-medium whitespace-nowrap ${
                  idx === currentStep ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-3 mb-5 transition-colors ${
                  idx < currentStep ? "bg-primary" : "bg-border"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <Card className="border border-border shadow-sm">
        {currentStep === 0 && (
          <>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Zap size={18} className="text-warning" />
                Configure o token do Slack
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/50 border border-border text-sm">
                <p className="font-mono text-xs text-muted-foreground mb-1">apps/api/.env</p>
                <p className="font-mono text-sm">
                  SLACK_BOT_TOKEN=<span className="text-primary">xoxb-...</span>
                </p>
              </div>

              <p className="text-sm text-muted-foreground">
                Crie ou selecione um Slack App e copie o{" "}
                <strong className="text-foreground">Bot User OAuth Token</strong>.
              </p>

              <a
                href="https://api.slack.com/apps"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                Abrir Slack API Console
                <ExternalLink size={13} />
              </a>

              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">
                  Scopes necessarios (OAuth &amp; Permissions):
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {SCOPES.map((s) => (
                    <Badge key={s} variant="secondary" className="font-mono text-[11px]">
                      {s}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Button
                  onClick={checkSlackConnection}
                  disabled={slackStatus === "loading"}
                  size="sm"
                >
                  {slackStatus === "loading" ? (
                    <RefreshCw size={14} className="mr-1.5 animate-spin" />
                  ) : slackStatus === "ok" ? (
                    <CheckCircle2 size={14} className="mr-1.5 text-success" />
                  ) : (
                    <Zap size={14} className="mr-1.5" />
                  )}
                  Verificar conexao
                </Button>
                {slackStatus === "ok" && (
                  <span className="text-xs text-success font-medium">Slack conectado!</span>
                )}
                {slackStatus === "error" && (
                  <span className="text-xs text-destructive">
                    Falha. Verifique o token e reinicie a API.
                  </span>
                )}
              </div>
            </CardContent>
          </>
        )}

        {currentStep === 1 && (
          <>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Hash size={18} className="text-primary" />
                Convide o bot nos canais
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                O bot precisa ser membro dos canais{" "}
                <strong className="text-foreground">#cliente-*</strong> para ler as mensagens.
              </p>

              <div className="p-3 rounded-lg bg-muted/50 border border-border">
                <p className="text-xs font-semibold text-muted-foreground mb-1">
                  Em cada canal Slack, execute:
                </p>
                <p className="font-mono text-sm text-foreground">/invite @justflow</p>
              </div>

              <div className="p-3 rounded-lg border border-border/60 bg-muted/20">
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Circle size={10} className="text-muted-foreground" />
                  Os canais sao detectados automaticamente apos o primeiro sync.
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Button
                  onClick={triggerSync}
                  disabled={syncStatus === "loading"}
                  size="sm"
                >
                  {syncStatus === "loading" ? (
                    <RefreshCw size={14} className="mr-1.5 animate-spin" />
                  ) : syncStatus === "ok" ? (
                    <CheckCircle2 size={14} className="mr-1.5 text-success" />
                  ) : (
                    <RefreshCw size={14} className="mr-1.5" />
                  )}
                  Tentar sync agora
                </Button>
                {syncStatus === "ok" && (
                  <span className="text-xs text-success font-medium">Sync iniciado!</span>
                )}
                {syncStatus === "error" && (
                  <span className="text-xs text-destructive">
                    Erro no sync. Verifique se o bot foi convidado.
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onStepChange(2)}
                >
                  Pular
                </Button>
              </div>
            </CardContent>
          </>
        )}

        {currentStep === 2 && (
          <>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <PartyPopper size={18} className="text-success" />
                Tudo configurado!
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                O FlowDesk esta pronto para sincronizar as demandas do Slack. Apos o primeiro sync,
                as demandas aparecerao automaticamente no dashboard.
              </p>
              <div className="flex items-center gap-3 pt-2">
                <Button onClick={() => window.location.reload()} size="sm">
                  <RefreshCw size={14} className="mr-1.5" />
                  Recarregar dashboard
                </Button>
                <Button variant="ghost" size="sm" onClick={onDismiss}>
                  Fechar
                </Button>
              </div>
            </CardContent>
          </>
        )}
      </Card>

      {/* Skip always available */}
      {currentStep < 2 && (
        <div className="text-center mt-4">
          <button
            onClick={onDismiss}
            className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline transition-colors"
          >
            Pular configuracao
          </button>
        </div>
      )}
    </div>
  );
};

export default OnboardingWizard;
