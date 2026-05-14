/**
 * DesktopNotifications
 *
 * Componente "invisible" montado no AppLayout.
 * Gerencia permissao + opt-in do usuario pra notificacoes desktop.
 *
 * Nao renderiza nada visualmente — o botao "Ativar notificacoes" fica
 * no sidebar footer (AppSidebar), que acessa o contexto via prop drilling
 * ou pelo hook diretamente.
 *
 * Este componente serve como ponto de montagem do useDesktopNotifications
 * pro resto do app via export do hook — sem context extra.
 */
import { useEffect } from "react";
import { useDesktopNotifications } from "@/hooks/useDesktopNotifications";
import { getPermission } from "@/lib/browserNotifications";

/**
 * Montado uma vez no AppLayout. Nao emite JSX — efeito colateral apenas.
 * Registra handler pra quando a permissao muda de "default" pra "granted"
 * no browser (ex: user aceita o prompt ativado por outra parte da UI).
 */
const DesktopNotifications = () => {
  const { enabled, setEnabled } = useDesktopNotifications();

  // Se browser ja tem permissao e user nunca fez opt-in/out,
  // habilita automaticamente (fluxo: permissao foi dada fora do app).
  useEffect(() => {
    if (getPermission() === "granted" && enabled === false) {
      // Nao forca — respeita a preferencia salva. Se nunca foi salva
      // (localStorage nao tem a chave), loadEnabled() retorna false por
      // design (opt-in explicito). Nao auto-habilita aqui.
    }
    // Este effect eh intencional como documentacao do comportamento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
};

export default DesktopNotifications;

/**
 * Re-exporta o hook pra uso nos componentes de polling
 * (NotificationBellSidebar, etc.) sem duplicar instancias.
 *
 * Cada componente que importa o hook tem sua propria instancia — isso
 * eh esperado. O estado de enabled/permission vem do localStorage e
 * Notification.permission, entao todos ficam sincronizados.
 */
export { useDesktopNotifications };
