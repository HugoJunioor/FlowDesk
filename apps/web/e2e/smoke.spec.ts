/**
 * Smoke tests — fluxos mais críticos do sistema.
 *
 * Estes testes rodam contra o build de produção via vite preview (com
 * VITE_DEMO_MODE=true). Não dependem da API Express estar rodando.
 *
 * Cobre:
 *   - Login legacy carrega
 *   - Login legacy aceita credenciais demo (Admin@1)
 *   - Dashboard renderiza após login
 *   - 404 em rota inexistente
 */
import { test, expect } from '@playwright/test';

test.describe('Login legacy + Dashboard', () => {
  test('tela de login renderiza com campos esperados', async ({ page }) => {
    await page.goto('/');
    // Login.tsx exibe campos de login/senha
    await expect(page.getByLabel(/usuário|login/i).first()).toBeVisible();
    await expect(page.getByLabel(/senha/i).first()).toBeVisible();
  });

  test('login com Admin@1 entra no dashboard', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel(/usuário|login/i).first().fill('master');
    await page.getByLabel(/senha/i).first().fill('Admin@1');
    await page.getByRole('button', { name: /entrar|login/i }).click();

    // Em demo mode, master + Admin@1 funciona direto. Aguarda
    // qualquer elemento que so aparece pos-login.
    await expect(
      page.getByRole('navigation').or(page.locator('[role="navigation"]'))
    ).toBeVisible({ timeout: 10_000 });
  });

  test('rota inexistente cai no NotFound', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel(/usuário|login/i).first().fill('master');
    await page.getByLabel(/senha/i).first().fill('Admin@1');
    await page.getByRole('button', { name: /entrar|login/i }).click();
    await expect(page.locator('[role="navigation"]')).toBeVisible({ timeout: 10_000 });

    await page.goto('/rota-que-nao-existe');
    await expect(page.getByText(/404|não.+encontrad/i).first()).toBeVisible();
  });
});
