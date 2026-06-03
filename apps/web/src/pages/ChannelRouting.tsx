/**
 * Página de Gerenciamento de Grupos de Demandas (canais Slack -> modulos).
 *
 * Permite ao master configurar pra qual modulo cada canal Slack envia
 * suas demandas:
 *  - Demandas Geral (kanban principal)
 *  - Operacoes SQL (modulo isolado)
 *  - Ignorar (nao sincroniza)
 *
 * Detecta automaticamente canais ja em uso (a partir das demandas
 * carregadas) e sugere cadastrar.
 */
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Hash, Plus, Trash2, Inbox, Database, Ban, Sparkles, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  loadChannelRouting,
  upsertChannelRule,
  removeChannelRule,
  setDefaultRoute,
  detectChannelsFromDemands,
  type ChannelRoute,
  type ChannelRoutingConfig,
} from "@/lib/channelRouting";
import { getProcessedDemands, subscribeToSync } from "@/data/demandsLoader";
import { getProcessedSqlDemands } from "@/data/sqlDemandsLoader";

const ROUTE_LABELS: Record<ChannelRoute, { label: string; icon: typeof Inbox; color: string }> = {
  demandas: { label: "Demandas Geral", icon: Inbox, color: "text-info" },
  sql: { label: "Operações SQL", icon: Database, color: "text-warning" },
  ignore: { label: "Ignorar (não sincroniza)", icon: Ban, color: "text-muted-foreground" },
};

const ChannelRouting = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [config, setConfig] = useState<ChannelRoutingConfig>(() => loadChannelRouting());
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelRoute, setNewChannelRoute] = useState<ChannelRoute>("demandas");
  const [filter, setFilter] = useState("");
  const [scanCount, setScanCount] = useState(0); // forca re-scan de canais
  const [lastScanAt, setLastScanAt] = useState(() => new Date());

  // Master only
  useEffect(() => {
    if (currentUser && currentUser.role !== "master") {
      toast.error("Acesso restrito ao master");
      navigate("/");
    }
  }, [currentUser, navigate]);

  // Sync polling: ao detectar novo realDemands.ts, refaz scan de canais
  useEffect(() => {
    return subscribeToSync(() => setScanCount((c) => c + 1));
  }, []);

  // Canais detectados nas demandas atuais (sugestao de cadastro).
  // Inclui AMBOS realDemands (geral) e sqlDemands (SQL) — assim novos
  // canais sincronizados pra qualquer modulo aparecem aqui pra serem
  // categorizados.
  const suggestedChannels = useMemo(() => {
    try {
      const general = getProcessedDemands();
      let sql: typeof general = [];
      try { sql = getProcessedSqlDemands(); } catch { /* sem dados sql */ }
      const all = [...general, ...sql];
      const channels = Array.from(new Set(all.map((d) => d.slackChannel)));
      return detectChannelsFromDemands(channels);
    } catch {
      return [];
    }
  }, [config, scanCount]);

  const handleScanRefresh = () => {
    setScanCount((n) => n + 1);
    setLastScanAt(new Date());
    toast.success("Canais re-escaneados", {
      description: "Buscando novos canais nas demandas sincronizadas.",
    });
  };

  const handleBulkAdd = (route: ChannelRoute) => {
    if (suggestedChannels.length === 0) return;
    let updated = config;
    for (const ch of suggestedChannels) {
      updated = upsertChannelRule(ch, route, { source: "slack" });
    }
    setConfig({ ...updated });
    toast.success(
      `${suggestedChannels.length} canais cadastrados como ${ROUTE_LABELS[route].label}`
    );
  };

  const handleAdd = () => {
    const name = newChannelName.trim().replace(/^#/, "");
    if (!name) return;
    const updated = upsertChannelRule(name, newChannelRoute);
    setConfig({ ...updated });
    setNewChannelName("");
    toast.success(`Canal #${name} configurado pra ${ROUTE_LABELS[newChannelRoute].label}`);
  };

  const handleRouteChange = (channelName: string, route: ChannelRoute) => {
    const updated = upsertChannelRule(channelName, route);
    setConfig({ ...updated });
    toast.success(`#${channelName} → ${ROUTE_LABELS[route].label}`);
  };

  const handleRemove = (channelName: string) => {
    const updated = removeChannelRule(channelName);
    setConfig({ ...updated });
    toast.success(`#${channelName} removido`);
  };

  const handleDefaultChange = (route: ChannelRoute) => {
    const updated = setDefaultRoute(route);
    setConfig({ ...updated });
    toast.success("Rota padrão atualizada");
  };

  const handleAddSuggested = (channelName: string, route: ChannelRoute) => {
    const updated = upsertChannelRule(channelName, route, { source: "slack" });
    setConfig({ ...updated });
    toast.success(`#${channelName} adicionado`);
  };

  const filteredChannels = config.channels.filter((c) =>
    c.name.toLowerCase().includes(filter.toLowerCase())
  );

  // Estatisticas
  const stats = {
    demandas: config.channels.filter((c) => c.routeTo === "demandas").length,
    sql: config.channels.filter((c) => c.routeTo === "sql").length,
    ignore: config.channels.filter((c) => c.routeTo === "ignore").length,
  };

  return (
    <div className="container max-w-5xl py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-2 -ml-2">
            <ArrowLeft size={14} className="mr-1" /> Voltar
          </Button>
          <h1 className="text-2xl font-bold">Grupos de Demandas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Defina para qual módulo cada canal Slack envia suas demandas.
          </p>
        </div>
      </div>

      {/* Stats + rota default */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs flex items-center gap-1.5">
              <Inbox size={14} className="text-info" /> Demandas Geral
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.demandas}</p>
            <p className="text-[10px] text-muted-foreground">canais</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs flex items-center gap-1.5">
              <Database size={14} className="text-warning" /> Operações SQL
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.sql}</p>
            <p className="text-[10px] text-muted-foreground">canais</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs flex items-center gap-1.5">
              <Ban size={14} className="text-muted-foreground" /> Ignorados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.ignore}</p>
            <p className="text-[10px] text-muted-foreground">canais</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs">Rota padrão</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={config.defaultRoute} onValueChange={(v) => handleDefaultChange(v as ChannelRoute)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="demandas">Demandas Geral</SelectItem>
                <SelectItem value="sql">Operações SQL</SelectItem>
                <SelectItem value="ignore">Ignorar</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground mt-1">
              Aplicada a canais não cadastrados.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Canais detectados (sugestoes) — sempre visivel pra clarificar
          que detecta auto, mesmo se vazio agora. */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles size={16} className="text-primary" />
              Canais detectados {suggestedChannels.length > 0 && `(${suggestedChannels.length})`}
            </CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground">
                escaneado {lastScanAt.toLocaleTimeString("pt-BR")}
              </span>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1"
                onClick={handleScanRefresh}
                title="Re-escanear demandas pra detectar canais novos"
              >
                <RefreshCw size={12} /> Atualizar
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {suggestedChannels.length > 0
              ? "Canais sincronizados que ainda não foram cadastrados aqui. Use os botões pra categorizar."
              : "Tudo cadastrado! Quando você sincronizar canais novos via npm run sync, eles aparecem aqui automaticamente."}
          </p>
        </CardHeader>
        {suggestedChannels.length > 0 && (
          <CardContent className="space-y-1.5">
            {/* Bulk actions */}
            <div className="flex items-center gap-2 pb-2 border-b border-border mb-1.5">
              <span className="text-[11px] text-muted-foreground">Cadastrar todos como:</span>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleBulkAdd("demandas")}>
                <Inbox size={11} className="mr-1" /> Geral ({suggestedChannels.length})
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleBulkAdd("sql")}>
                <Database size={11} className="mr-1" /> SQL ({suggestedChannels.length})
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs ml-auto" onClick={() => handleBulkAdd("ignore")}>
                <Ban size={11} className="mr-1" /> Ignorar todos
              </Button>
            </div>
            {suggestedChannels.map((channel) => (
              <div
                key={channel}
                className="flex items-center justify-between p-2 rounded-md bg-muted/30 border border-dashed border-border"
              >
                <div className="flex items-center gap-1.5 text-sm">
                  <Hash size={14} className="text-muted-foreground" />
                  <span className="font-medium">{channel}</span>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleAddSuggested(channel, "demandas")}>
                    <Inbox size={11} className="mr-1" /> Geral
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleAddSuggested(channel, "sql")}>
                    <Database size={11} className="mr-1" /> SQL
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => handleAddSuggested(channel, "ignore")}>
                    <Ban size={11} />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        )}
      </Card>

      {/* Adicionar canal manual */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Adicionar canal manualmente</CardTitle>
          <p className="text-xs text-muted-foreground">
            Caso o canal ainda não tenha demandas sincronizadas.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <div className="flex-1 flex items-center gap-1 rounded-md border border-input bg-background px-3 h-9">
              <Hash size={14} className="text-muted-foreground" />
              <Input
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
                placeholder="cliente-novo (sem #)"
                className="border-0 h-7 px-0 focus-visible:ring-0"
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              />
            </div>
            <Select value={newChannelRoute} onValueChange={(v) => setNewChannelRoute(v as ChannelRoute)}>
              <SelectTrigger className="w-44 h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="demandas">Demandas Geral</SelectItem>
                <SelectItem value="sql">Operações SQL</SelectItem>
                <SelectItem value="ignore">Ignorar</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleAdd} disabled={!newChannelName.trim()} className="h-9">
              <Plus size={14} className="mr-1" /> Adicionar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Lista de canais cadastrados */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Canais cadastrados ({config.channels.length})</CardTitle>
            </div>
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filtrar..."
              className="h-8 text-sm w-48"
            />
          </div>
        </CardHeader>
        <CardContent>
          {filteredChannels.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              {config.channels.length === 0
                ? "Nenhum canal cadastrado. Use a seção acima pra adicionar."
                : "Nenhum canal corresponde ao filtro."}
            </p>
          ) : (
            <div className="space-y-1.5">
              {filteredChannels.map((channel) => {
                const RouteIcon = ROUTE_LABELS[channel.routeTo].icon;
                return (
                  <div
                    key={channel.name}
                    className="flex items-center justify-between p-2.5 rounded-md border border-border hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <Hash size={14} className="text-muted-foreground shrink-0" />
                      <span className="font-medium text-sm truncate">{channel.name}</span>
                      {channel.source === "slack" && (
                        <Badge variant="secondary" className="text-[9px] h-4">auto</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Select
                        value={channel.routeTo}
                        onValueChange={(v) => handleRouteChange(channel.name, v as ChannelRoute)}
                      >
                        <SelectTrigger className="w-44 h-8 text-xs">
                          <span className="flex items-center gap-1.5">
                            <RouteIcon size={12} className={ROUTE_LABELS[channel.routeTo].color} />
                            {ROUTE_LABELS[channel.routeTo].label}
                          </span>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="demandas">Demandas Geral</SelectItem>
                          <SelectItem value="sql">Operações SQL</SelectItem>
                          <SelectItem value="ignore">Ignorar</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        onClick={() => handleRemove(channel.name)}
                        title="Remover"
                      >
                        <Trash2 size={13} />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ChannelRouting;
