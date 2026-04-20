import type { Language } from "@/types/auth";

/**
 * Dicionario de traducoes.
 * Para adicionar uma nova string, adicione a chave em LANGUAGES['pt-BR']
 * e copie para os demais idiomas. Se uma chave faltar num idioma,
 * cai no pt-BR.
 */

export const AVAILABLE_LANGUAGES: { id: Language; label: string; flag: string; nativeName: string }[] = [
  { id: "pt-BR", label: "Português (Brasil)", flag: "🇧🇷", nativeName: "Português" },
  { id: "en-US", label: "English (US)", flag: "🇺🇸", nativeName: "English" },
  { id: "es-ES", label: "Español", flag: "🇪🇸", nativeName: "Español" },
];

export const DEFAULT_LANGUAGE: Language = "pt-BR";

type TranslationDict = Record<string, string>;
type Translations = Record<Language, TranslationDict>;

const TRANSLATIONS: Translations = {
  "pt-BR": {
    // Genericos
    "common.save": "Salvar",
    "common.cancel": "Cancelar",
    "common.delete": "Excluir",
    "common.edit": "Editar",
    "common.create": "Criar",
    "common.back": "Voltar",
    "common.loading": "Carregando...",
    "common.confirm": "Confirmar",
    "common.search": "Buscar",
    "common.language": "Idioma",

    // Navegacao / Sidebar
    "nav.dashboard": "Dashboard",
    "nav.demands": "Demandas",
    "nav.demands_sql": "Demandas SQL",
    "nav.users": "Usuários",
    "nav.groups": "Grupos",
    "nav.profile": "Meu perfil",
    "nav.settings": "Configurações",
    "nav.logout": "Sair",

    // Login
    "login.title": "Entrar",
    "login.description": "Use seu login e senha gerados pelo administrador",
    "login.username": "Login",
    "login.password": "Senha",
    "login.submit": "Entrar",
    "login.submitting": "Entrando...",
    "login.forgot": "Esqueci minha senha",

    // Configuracoes
    "settings.title": "Configurações",
    "settings.subtitle": "Ajustes e preferências do sistema",
    "settings.profile": "Perfil",
    "settings.profile.info": "Informações da sua conta",
    "settings.appearance": "Aparência",
    "settings.appearance.subtitle": "Personalize o visual do sistema",
    "settings.theme.mode": "Modo de exibição",
    "settings.theme.light": "Claro",
    "settings.theme.dark": "Escuro",
    "settings.theme.color": "Cor do tema",
    "settings.theme.color.description":
      "Escolha a cor principal que será aplicada na sidebar e nos elementos de destaque",
    "settings.notifications": "Notificações",
    "settings.notifications.description": "Configurar alertas e emails",
    "settings.security": "Segurança",
    "settings.security.description": "Senha e autenticação",
    "settings.language": "Idioma",
    "settings.language.description": "Idioma utilizado em todo o sistema para este usuário",
    "settings.soon": "Em breve",

    // Demandas
    "demands.title": "Demandas",
    "demands.subtitle": "Acompanhe as demandas recebidas via Slack",
    "demands.status.aberta": "Aberta",
    "demands.status.em_andamento": "Em andamento",
    "demands.status.concluida": "Concluída",
    "demands.status.expirada": "Expirada",
  },

  "en-US": {
    "common.save": "Save",
    "common.cancel": "Cancel",
    "common.delete": "Delete",
    "common.edit": "Edit",
    "common.create": "Create",
    "common.back": "Back",
    "common.loading": "Loading...",
    "common.confirm": "Confirm",
    "common.search": "Search",
    "common.language": "Language",

    "nav.dashboard": "Dashboard",
    "nav.demands": "Requests",
    "nav.demands_sql": "SQL Requests",
    "nav.users": "Users",
    "nav.groups": "Groups",
    "nav.profile": "My profile",
    "nav.settings": "Settings",
    "nav.logout": "Sign out",

    "login.title": "Sign in",
    "login.description": "Use the login and password provided by the administrator",
    "login.username": "Login",
    "login.password": "Password",
    "login.submit": "Sign in",
    "login.submitting": "Signing in...",
    "login.forgot": "Forgot my password",

    "settings.title": "Settings",
    "settings.subtitle": "System settings and preferences",
    "settings.profile": "Profile",
    "settings.profile.info": "Your account information",
    "settings.appearance": "Appearance",
    "settings.appearance.subtitle": "Customize the system look",
    "settings.theme.mode": "Display mode",
    "settings.theme.light": "Light",
    "settings.theme.dark": "Dark",
    "settings.theme.color": "Theme color",
    "settings.theme.color.description":
      "Choose the main color applied to the sidebar and highlights",
    "settings.notifications": "Notifications",
    "settings.notifications.description": "Configure alerts and emails",
    "settings.security": "Security",
    "settings.security.description": "Password and authentication",
    "settings.language": "Language",
    "settings.language.description": "Language used across the system for this user",
    "settings.soon": "Coming soon",

    "demands.title": "Requests",
    "demands.subtitle": "Track requests received via Slack",
    "demands.status.aberta": "Open",
    "demands.status.em_andamento": "In progress",
    "demands.status.concluida": "Completed",
    "demands.status.expirada": "Expired",
  },

  "es-ES": {
    "common.save": "Guardar",
    "common.cancel": "Cancelar",
    "common.delete": "Eliminar",
    "common.edit": "Editar",
    "common.create": "Crear",
    "common.back": "Volver",
    "common.loading": "Cargando...",
    "common.confirm": "Confirmar",
    "common.search": "Buscar",
    "common.language": "Idioma",

    "nav.dashboard": "Panel",
    "nav.demands": "Solicitudes",
    "nav.demands_sql": "Solicitudes SQL",
    "nav.users": "Usuarios",
    "nav.groups": "Grupos",
    "nav.profile": "Mi perfil",
    "nav.settings": "Configuración",
    "nav.logout": "Salir",

    "login.title": "Iniciar sesión",
    "login.description": "Use su usuario y contraseña generados por el administrador",
    "login.username": "Usuario",
    "login.password": "Contraseña",
    "login.submit": "Entrar",
    "login.submitting": "Entrando...",
    "login.forgot": "Olvidé mi contraseña",

    "settings.title": "Configuración",
    "settings.subtitle": "Ajustes y preferencias del sistema",
    "settings.profile": "Perfil",
    "settings.profile.info": "Información de su cuenta",
    "settings.appearance": "Apariencia",
    "settings.appearance.subtitle": "Personalice la apariencia del sistema",
    "settings.theme.mode": "Modo de visualización",
    "settings.theme.light": "Claro",
    "settings.theme.dark": "Oscuro",
    "settings.theme.color": "Color del tema",
    "settings.theme.color.description":
      "Elija el color principal aplicado a la barra lateral y destacados",
    "settings.notifications": "Notificaciones",
    "settings.notifications.description": "Configurar alertas y correos",
    "settings.security": "Seguridad",
    "settings.security.description": "Contraseña y autenticación",
    "settings.language": "Idioma",
    "settings.language.description": "Idioma usado en todo el sistema para este usuario",
    "settings.soon": "Próximamente",

    "demands.title": "Solicitudes",
    "demands.subtitle": "Acompañe las solicitudes recibidas por Slack",
    "demands.status.aberta": "Abierta",
    "demands.status.em_andamento": "En progreso",
    "demands.status.concluida": "Completada",
    "demands.status.expirada": "Expirada",
  },
};

/**
 * Traduz uma chave para o idioma indicado.
 * Se nao achar no idioma, cai no pt-BR. Se nem no pt-BR achar, retorna a chave.
 */
export function translate(key: string, lang: Language = DEFAULT_LANGUAGE): string {
  return TRANSLATIONS[lang]?.[key] ?? TRANSLATIONS[DEFAULT_LANGUAGE][key] ?? key;
}
