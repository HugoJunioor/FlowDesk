/**
 * LoginV2Page — template do padrão Just no frontend.
 *
 * Usa o módulo auth completo: React Query (useLogin) + RHF + Zod.
 * Substitui o Login.tsx legacy quando o backend estiver disponível
 * e o AuthContext for migrado.
 *
 * Esta página existe em paralelo à atual em /login-v2 para validar o
 * fluxo end-to-end sem quebrar o sistema atual.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLogin, loginSchema, type LoginFormValues } from '@/modules/auth';
import { setSentryUser } from '@/lib/observability/sentry';
import { toApiError } from '@/lib/api/client';

const LoginV2Page = () => {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const loginMutation = useLogin();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { login: '', senha: '' },
  });

  const onSubmit = async (values: LoginFormValues): Promise<void> => {
    try {
      const result = await loginMutation.mutateAsync(values);
      // Liga Sentry com o user (no-op sem DSN)
      setSentryUser({
        id: result.usuario.id,
        login: result.usuario.login,
        perfil: result.usuario.perfil,
      });
      // Se for primeiro acesso, fluxo de troca de senha será na próxima PR
      navigate('/', { replace: true });
    } catch (err) {
      // Erro tratado pela UI via loginMutation.error abaixo — só log local
      const e = toApiError(err);
      // eslint-disable-next-line no-console
      console.debug('login failed', { codigo: e.codigo, mensagem: e.message });
    }
  };

  const errorMessage = loginMutation.error
    ? toApiError(loginMutation.error).message
    : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 text-primary">
            <ShieldCheck size={24} />
          </div>
          <h1 className="text-2xl font-bold">FlowDesk</h1>
          <p className="text-xs text-muted-foreground">
            Login via API (v2 — JWT + HttpOnly cookie)
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label htmlFor="login" className="text-sm font-medium block mb-1.5">
              Login
            </label>
            <Input
              id="login"
              type="text"
              autoComplete="username"
              disabled={isSubmitting || loginMutation.isPending}
              {...register('login')}
              className={errors.login ? 'border-destructive' : ''}
            />
            {errors.login && (
              <p className="text-xs text-destructive mt-1">{errors.login.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="senha" className="text-sm font-medium block mb-1.5">
              Senha
            </label>
            <div className="relative">
              <Input
                id="senha"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                disabled={isSubmitting || loginMutation.isPending}
                {...register('senha')}
                className={errors.senha ? 'border-destructive pr-10' : 'pr-10'}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.senha && (
              <p className="text-xs text-destructive mt-1">{errors.senha.message}</p>
            )}
          </div>

          {errorMessage && (
            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
              {errorMessage}
            </div>
          )}

          <Button
            type="submit"
            className="w-full gap-2"
            disabled={isSubmitting || loginMutation.isPending}
          >
            {(isSubmitting || loginMutation.isPending) && <Loader2 size={14} className="animate-spin" />}
            Entrar
          </Button>
        </form>

        <p className="text-[10px] text-center text-muted-foreground">
          Esta tela usa a API Express em <code>{import.meta.env.VITE_API_URL || '/api/v1'}</code>.
          <br />
          Tela legacy continua em <code>/login</code>.
        </p>
      </div>
    </div>
  );
};

export default LoginV2Page;
