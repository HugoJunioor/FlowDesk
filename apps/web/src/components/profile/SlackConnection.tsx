/**
 * Card de conexao Slack do usuario logado.
 *
 * Quando conectado, mensagens enviadas via composer sao postadas com a
 * identidade real do usuario no Slack (nao como bot JustFlow).
 *
 * Fluxo:
 * 1. User clica "Conectar Slack" -> abre janela OAuth do Slack
 * 2. Slack redireciona pro callback /auth/slack/callback
 * 3. Backend salva o token user em data/slack-user-tokens.json
 * 4. Esse componente faz polling de status pra atualizar UI
 */
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CheckCircle2, AlertCircle, Loader2, Slack, LogOut } from "lucide-react";
import { apiClient } from "@/lib/apiClient";
import { useToast } from "@/hooks/use-toast";

interface SlackConnectionProps {
  email: string;
}

const SlackConnection = ({ email }: SlackConnectionProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [teamName, setTeamName] = useState<string | undefined>();
  const [connectedAt, setConnectedAt] = useState<string | undefined>();
  const [disconnecting, setDisconnecting] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const r = await apiClient.auth.slackStatus(email);
      setConnected(r.connected);
      setTeamName(r.teamName);
      setConnectedAt(r.connectedAt);
    } catch (e) {
      console.warn("[slack-connection] status check falhou:", e);
    } finally {
      setLoading(false);
    }
  }, [email]);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  // Quando user volta do OAuth (foco na janela), refaz check de status
  useEffect(() => {
    const onFocus = () => void fetchStatus();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchStatus]);

  const handleConnect = () => {
    // Abre Slack OAuth em popup. Quando user autoriza, Slack redireciona
    // pro callback que salva token. Polling no useEffect detecta mudanca.
    const url = apiClient.auth.slackStartUrl(email);
    const popup = window.open(
      url,
      "slack-oauth",
      "width=600,height=700,scrollbars=yes"
    );
    if (!popup) {
      toast({
        title: "Popup bloqueado",
        description: "Permita popups deste site pra conectar Slack",
        variant: "destructive",
      });
      return;
    }
    // Polling enquanto popup aberto — quando fecha, recarrega status
    const interval = setInterval(() => {
      if (popup.closed) {
        clearInterval(interval);
        void fetchStatus();
      }
    }, 800);
  };

  const handleDisconnect = async () => {
    if (!window.confirm("Desconectar Slack? Voce voltara a postar como bot JustFlow.")) {
      return;
    }
    setDisconnecting(true);
    try {
      await apiClient.auth.slackDisconnect(email);
      setConnected(false);
      setTeamName(undefined);
      setConnectedAt(undefined);
      toast({ title: "Slack desconectado" });
    } catch (e) {
      toast({
        title: "Erro ao desconectar",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Slack size={18} className="text-primary" />
          Integração Slack
        </CardTitle>
        <CardDescription>
          Conecte sua conta pessoal do Slack pra postar mensagens com sua identidade real.
          Sem isso, mensagens são postadas como bot JustFlow.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={14} className="animate-spin" />
            Verificando status...
          </div>
        ) : connected ? (
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-success/5 border border-success/20">
              <CheckCircle2 size={18} className="text-success shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-success">Conectado</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {teamName && <>Workspace: <span className="font-medium">{teamName}</span></>}
                  {connectedAt && (
                    <> · Desde {new Date(connectedAt).toLocaleDateString("pt-BR")}</>
                  )}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="gap-2"
            >
              {disconnecting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <LogOut size={14} />
              )}
              Desconectar
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/40 border border-border">
              <AlertCircle size={18} className="text-muted-foreground shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Não conectado</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Suas mensagens via Just Flow aparecerão como "JustFlow" no Slack.
                </p>
              </div>
            </div>
            <Button onClick={handleConnect} className="gap-2">
              <Slack size={14} />
              Conectar Slack
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SlackConnection;
