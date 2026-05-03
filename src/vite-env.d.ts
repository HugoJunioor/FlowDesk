/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEMO_MODE?: string;
  readonly VITE_ALLOWED_EMAIL_DOMAIN?: string;
  readonly VITE_DISABLE_HTTPS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
