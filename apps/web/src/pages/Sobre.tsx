import { useEffect, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ExternalLink, BookOpen, FileText, GitPullRequest, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Workflow } from "lucide-react";
import { branding } from "@/config/brandingLoader";

const APP_VERSION = __APP_VERSION__;
const BUILD_SHA = import.meta.env.VITE_BUILD_SHA || "dev";
const BUILD_DATE = import.meta.env.VITE_BUILD_DATE || "—";

const STACK = [
  "React 18",
  "TypeScript",
  "Vite",
  "Tailwind",
  "shadcn/ui",
  "Express",
  "PostgreSQL",
  "Knex",
  "Pino",
];

interface HealthData {
  status: "ok" | "degraded" | "error";
  uptime?: number;
  version?: string;
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min`;
}

const Sobre = () => {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/health", { signal: controller.signal, credentials: "include" })
      .then((r) => r.json())
      .then((data) => setHealth(data as HealthData))
      .catch(() => setHealth({ status: "error" }))
      .finally(() => setHealthLoading(false));
    return () => controller.abort();
  }, []);

  const isApiOk = health?.status === "ok";

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-8">
        {/* Hero */}
        <div className="flex flex-col items-center gap-3 text-center">
          {branding.logo ? (
            <img src={branding.logo} alt={branding.name} className="h-14 w-auto" />
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Workflow size={32} className="text-primary" />
            </div>
          )}
          <h1 className="text-2xl font-bold tracking-tight">{branding.name}</h1>
          <p className="text-muted-foreground text-sm">Gestao de demandas Slack centralizada</p>
        </div>

        {/* Build info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Versao e build</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Versao</span>
              <Badge variant="secondary">v{APP_VERSION}</Badge>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Build hash</span>
              <code className="font-mono text-xs bg-muted px-2 py-0.5 rounded">{BUILD_SHA}</code>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Build date</span>
              <span>{BUILD_DATE}</span>
            </div>
          </CardContent>
        </Card>

        {/* API status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status da API</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Conexao</span>
              <div className="flex items-center gap-2">
                {healthLoading ? (
                  <Loader2 size={16} className="animate-spin text-muted-foreground" />
                ) : isApiOk ? (
                  <>
                    <CheckCircle2 size={16} className="text-green-500" />
                    <span className="text-green-600 font-medium">Online</span>
                  </>
                ) : (
                  <>
                    <XCircle size={16} className="text-destructive" />
                    <span className="text-destructive font-medium">Offline</span>
                  </>
                )}
              </div>
            </div>
            {health?.uptime != null && (
              <>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Uptime</span>
                  <span>{formatUptime(health.uptime)}</span>
                </div>
              </>
            )}
            {health?.version && (
              <>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Versao da API</span>
                  <code className="font-mono text-xs bg-muted px-2 py-0.5 rounded">{health.version}</code>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Stack */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Stack</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {STACK.map((tech) => (
                <Badge key={tech} variant="outline">{tech}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Links */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Links</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <a
              href="https://github.com/base/estrutura/blob/main/CHANGELOG.md"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <FileText size={15} />
              CHANGELOG.md
              <ExternalLink size={12} className="ml-auto" />
            </a>
            <Separator />
            <a
              href="https://github.com/base/estrutura/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <GitPullRequest size={15} />
              Issues GitHub
              <ExternalLink size={12} className="ml-auto" />
            </a>
            <Separator />
            <a
              href="https://github.com/base/estrutura/blob/main/DEMO.md"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <BookOpen size={15} />
              DEMO.md
              <ExternalLink size={12} className="ml-auto" />
            </a>
            <Separator />
            <a
              href="https://github.com/base/estrutura/blob/main/DEV_FULL_STACK.md"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <BookOpen size={15} />
              DEV_FULL_STACK.md
              <ExternalLink size={12} className="ml-auto" />
            </a>
            <Separator />
            <a
              href="https://github.com/base/estrutura/blob/main/ARCHITECTURE.md"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <BookOpen size={15} />
              ARCHITECTURE.md
              <ExternalLink size={12} className="ml-auto" />
            </a>
          </CardContent>
        </Card>

        {/* Licenca */}
        <p className="text-center text-xs text-muted-foreground">
          Licenciado sob a{" "}
          <a
            href="https://opensource.org/licenses/MIT"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            Licenca MIT
          </a>
        </p>
      </div>
    </AppLayout>
  );
};

export default Sobre;
