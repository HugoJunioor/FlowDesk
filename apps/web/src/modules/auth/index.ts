/**
 * Barrel exports do módulo Auth.
 *
 * Padrão Just: tudo público do módulo passa por aqui. Imports de fora
 * usam `@/modules/auth` ao invés de paths internos.
 */
export { authApi } from './api';
export {
  useMe,
  useLogin,
  useLogout,
  useChangePassword,
} from './hooks';
export {
  loginSchema,
  changePasswordSchema,
  type LoginFormValues,
  type ChangePasswordFormValues,
} from './schemas';
export type { AuthenticatedUser, AuthResponse } from './types';
