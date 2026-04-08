import { DEFAULT_BRANDING } from "./branding";

const localModules = import.meta.glob<{ LOCAL_BRANDING: typeof DEFAULT_BRANDING }>("./branding.local.ts", { eager: true });
const localModule = Object.values(localModules)[0];

export const branding = localModule?.LOCAL_BRANDING ?? DEFAULT_BRANDING;
