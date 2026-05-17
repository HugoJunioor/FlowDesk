import { useState } from "react";
import { Cookie, Settings, X } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useCookieConsent } from "@/hooks/useCookieConsent";

interface PersonalizarModalProps {
  open: boolean;
  onClose: () => void;
  onSalvar: (funcionais: boolean, analitica: boolean) => void;
}

const PersonalizarModal = ({ open, onClose, onSalvar }: PersonalizarModalProps) => {
  const [funcionais, setFuncionais] = useState(true);
  const [analitica, setAnalitica] = useState(false);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings size={18} />
            Personalizar preferencias de cookies
          </DialogTitle>
          <DialogDescription className="text-xs">
            Escolha quais categorias de cookies voce aceita. Cookies necessarios nao podem
            ser desativados pois sao essenciais para o funcionamento do sistema.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Necessarios — sempre on */}
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <Label className="font-medium">Necessarios</Label>
              <p className="text-xs text-muted-foreground">
                Essenciais para autenticacao, seguranca e funcionamento basico (ex.: token
                de sessao JWT). Nao podem ser recusados.
              </p>
            </div>
            <Switch checked disabled aria-label="Cookies necessarios — sempre ativos" />
          </div>

          {/* Funcionais */}
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <Label htmlFor="toggle-funcionais" className="font-medium">
                Funcionais
              </Label>
              <p className="text-xs text-muted-foreground">
                Preferencias de interface como tema, idioma, estado do onboarding e
                notificacoes desktop. Melhoram sua experiencia sem rastrear voce.
              </p>
            </div>
            <Switch
              id="toggle-funcionais"
              checked={funcionais}
              onCheckedChange={setFuncionais}
              aria-label="Cookies funcionais"
            />
          </div>

          {/* Analitica */}
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <Label htmlFor="toggle-analitica" className="font-medium">
                Analitica
              </Label>
              <p className="text-xs text-muted-foreground">
                Dados anonimizados de uso que nos ajudam a melhorar o produto (ex.:
                navegacao entre paginas, erros de interface). Nenhum dado pessoal e
                compartilhado com terceiros.
              </p>
            </div>
            <Switch
              id="toggle-analitica"
              checked={analitica}
              onCheckedChange={setAnalitica}
              aria-label="Cookies de analitica"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button size="sm" onClick={() => onSalvar(funcionais, analitica)}>
            Salvar preferencias
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const CookieConsentBanner = () => {
  const { decidido, aceitarTodos, aceitarNecessarios, aceitar } = useCookieConsent();
  const [personalizarAberto, setPersonalizarAberto] = useState(false);

  if (decidido) return null;

  return (
    <>
      <div
        role="region"
        aria-label="Aviso de cookies"
        className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border shadow-lg px-4 py-4 sm:px-6"
      >
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <Cookie size={20} className="text-primary shrink-0 mt-0.5 sm:mt-0" />

          <p className="flex-1 text-sm text-foreground/90">
            Este sistema utiliza cookies para garantir seu funcionamento e melhorar sua
            experiencia, em conformidade com a{" "}
            <strong>Lei Geral de Protecao de Dados (Lei 13.709/2018 — LGPD)</strong>.
            Cookies necessarios sao sempre ativos. Os demais so sao ativados com seu
            consentimento.{" "}
            <Link
              to="/politica-cookies"
              className="text-primary underline underline-offset-2 hover:opacity-80 transition-opacity"
            >
              Politica de cookies
            </Link>
            .
          </p>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPersonalizarAberto(true)}
              className="gap-1.5"
            >
              <Settings size={14} />
              Personalizar
            </Button>
            <Button variant="outline" size="sm" onClick={aceitarNecessarios}>
              Apenas necessarios
            </Button>
            <Button size="sm" onClick={aceitarTodos}>
              Aceitar todos
            </Button>
          </div>

          {/* Botao fechar (acao equivale a "apenas necessarios") */}
          <button
            aria-label="Fechar aviso de cookies (aceitar apenas necessarios)"
            onClick={aceitarNecessarios}
            className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors sm:relative sm:top-auto sm:right-auto"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <PersonalizarModal
        open={personalizarAberto}
        onClose={() => setPersonalizarAberto(false)}
        onSalvar={(f, a) => {
          aceitar(f, a);
          setPersonalizarAberto(false);
        }}
      />
    </>
  );
};

export default CookieConsentBanner;
