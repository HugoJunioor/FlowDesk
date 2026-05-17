import { Cookie, ShieldCheck, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCookieConsent } from "@/hooks/useCookieConsent";
import { useToast } from "@/hooks/use-toast";
import { branding } from "@/config/brandingLoader";

const cookies = [
  {
    nome: "JWT (httpOnly)",
    chave: "Gerenciado pelo servidor (httpOnly cookie)",
    categoria: "Necessario",
    finalidade:
      "Autenticacao e autorizacao do usuario. Armazena o token de sessao de forma segura no servidor, inacessivel via JavaScript.",
    retencao: "Duracao da sessao / conforme configurado pelo administrador",
  },
  {
    nome: "Tema da interface",
    chave: "flowdesk:theme",
    categoria: "Funcional",
    finalidade:
      "Persistencia da preferencia de tema (claro/escuro/sistema) escolhida pelo usuario.",
    retencao: "Indefinido (ate limpeza manual ou revogar consentimento)",
  },
  {
    nome: "Idioma",
    chave: "flowdesk:language",
    categoria: "Funcional",
    finalidade: "Persistencia do idioma selecionado na interface.",
    retencao: "Indefinido (ate limpeza manual ou revogar consentimento)",
  },
  {
    nome: "Onboarding dispensado",
    chave: "flowdesk:onboarding:dismissed",
    categoria: "Funcional",
    finalidade:
      "Registra se o usuario ja dispensou o assistente de primeiros passos para nao exibi-lo novamente.",
    retencao: "Indefinido (ate limpeza manual ou revogar consentimento)",
  },
  {
    nome: "Notificacoes desktop",
    chave: "flowdesk:desktop-notifications-enabled",
    categoria: "Funcional",
    finalidade:
      "Armazena se o usuario habilitou notificacoes push no navegador para alertas de demandas.",
    retencao: "Indefinido (ate limpeza manual ou revogar consentimento)",
  },
  {
    nome: "Consentimento LGPD",
    chave: "flowdesk:cookie-consent:v1",
    categoria: "Necessario",
    finalidade:
      "Registra as preferencias de consentimento do usuario em relacao ao uso de cookies, incluindo data e hora da decisao, conforme exigido pela Lei 13.709/2018.",
    retencao: "Indefinido (revogavel a qualquer momento por esta pagina)",
  },
  {
    nome: "Sidebar recolhida",
    chave: "fd_sidebar_collapsed",
    categoria: "Funcional",
    finalidade: "Lembra o estado do menu lateral (aberto/recolhido) entre navegacoes.",
    retencao: "Indefinido (ate limpeza manual ou revogar consentimento)",
  },
];

const PoliticaCookies = () => {
  const { decidido, revogar } = useCookieConsent();
  const { toast } = useToast();

  const handleRevogar = () => {
    revogar();
    toast({
      title: "Consentimento revogado",
      description:
        "Suas preferencias foram removidas. O banner de cookies sera exibido novamente.",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header simples */}
      <header className="border-b border-border bg-background sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            &larr; Voltar
          </Link>
          <span className="text-sm font-medium text-foreground">{branding.name}</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        {/* Titulo */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Cookie size={28} className="text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Politica de Cookies</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Atualizado em maio de 2026 &middot; Em conformidade com a Lei 13.709/2018 (LGPD)
          </p>
        </div>

        {/* Introducao */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck size={18} className="text-primary" />
              O que sao cookies?
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-foreground/80 space-y-3">
            <p>
              Cookies sao pequenos arquivos de texto armazenados no seu navegador ou
              dispositivo quando voce acessa uma aplicacao web. Eles permitem que o sistema
              lembre suas preferencias, mantenha sua sessao ativa e colete informacoes sobre
              como voce utiliza a plataforma.
            </p>
            <p>
              O <strong>{branding.name}</strong> respeita sua privacidade e so utiliza
              cookies estritamente necessarios ao funcionamento do sistema sem consentimento
              previo. Cookies funcionais e de analitica so sao ativados apos sua aprovacao
              explicita, em cumprimento ao{" "}
              <strong>Art. 7o, I da Lei Geral de Protecao de Dados (Lei 13.709/2018)</strong>
              .
            </p>
          </CardContent>
        </Card>

        {/* Tabela de cookies */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cookies utilizados neste sistema</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-40">Nome</TableHead>
                    <TableHead className="w-32">Categoria</TableHead>
                    <TableHead>Finalidade</TableHead>
                    <TableHead className="w-44">Retencao</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cookies.map((c) => (
                    <TableRow key={c.chave}>
                      <TableCell className="font-medium align-top">
                        <div>{c.nome}</div>
                        <div className="text-xs text-muted-foreground font-mono mt-0.5">
                          {c.chave}
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                            c.categoria === "Necessario"
                              ? "bg-primary/10 text-primary"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {c.categoria}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-foreground/80 align-top">
                        {c.finalidade}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground align-top">
                        {c.retencao}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Como recusar / revogar */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Como recusar ou revogar seu consentimento</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-foreground/80 space-y-3">
            <p>
              Voce pode revogar seu consentimento a qualquer momento clicando no botao
              abaixo. Isso removera as preferencias salvas e o banner de cookies sera
              exibido novamente no proximo acesso.
            </p>
            <p>
              Voce tambem pode limpar todos os dados de navegacao diretamente pelo seu
              navegador (Configuracoes &rarr; Privacidade &rarr; Limpar dados de navegacao).
              Note que isso pode afetar outras preferencias salvas, como tema e idioma.
            </p>
            <p>
              Cookies necessarios (como o token JWT de autenticacao) nao podem ser
              desativados pois sao imprescindíveis para o funcionamento seguro do sistema.
              Desativa-los implicaria na impossibilidade de acesso autenticado.
            </p>

            {decidido ? (
              <Button
                variant="destructive"
                size="sm"
                className="mt-2 gap-2"
                onClick={handleRevogar}
              >
                <Trash2 size={14} />
                Revogar consentimento
              </Button>
            ) : (
              <p className="text-muted-foreground italic text-xs">
                Nenhum consentimento registrado para esta sessao.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Contato */}
        <p className="text-xs text-muted-foreground">
          Duvidas sobre o tratamento de dados? Entre em contato com o administrador do
          sistema ou pelo e-mail{" "}
          <a
            href="mailto:suporte@wearejust.it"
            className="text-primary underline underline-offset-2"
          >
            suporte@wearejust.it
          </a>
          .
        </p>
      </main>
    </div>
  );
};

export default PoliticaCookies;
