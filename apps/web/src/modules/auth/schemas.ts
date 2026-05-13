/**
 * Zod schemas dos formulários do módulo auth (usados com react-hook-form
 * + zodResolver).
 */
import { z } from 'zod';

export const loginSchema = z.object({
  login: z.string().trim().min(1, 'Login obrigatório').max(100),
  senha: z.string().min(1, 'Senha obrigatória').max(200),
});
export type LoginFormValues = z.infer<typeof loginSchema>;

export const changePasswordSchema = z.object({
  senhaAtual: z.string().min(1, 'Senha atual obrigatória'),
  novaSenha: z.string().min(10, 'Mínimo 10 caracteres'),
  confirmacao: z.string(),
}).refine((data) => data.novaSenha === data.confirmacao, {
  message: 'Confirmação não confere',
  path: ['confirmacao'],
});
export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;
