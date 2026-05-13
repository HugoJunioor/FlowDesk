/**
 * Smoke tests — fluxos mais críticos do sistema.
 *
 * Roda contra o build de produção via vite preview (VITE_DEMO_MODE=true).
 * Não depende da API Express. Em demo, master + Admin@1 funciona.
 *
 * Selectors: placeholder em vez de getByLabel porque o legacy Login
 * usa <label> sem htmlFor (gera ambiguidade).
 */
import { test, expect } from '@playwright/test';

test.describe('Login legacy + Dashboard', () => {
  test('tela de login renderiza com campos esperados', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByPlaceholder('seu.login')).toBeVisible();
    await expect(page.getByPlaceholder(/digite sua senha/i)).toBeVisible();
  });

  test('login com Admin@1 entra no dashboard', async ({ page }) => {
    await page.goto('/');
    await page.getByPlaceholder('seu.login').fill('master');
    await page.getByPlaceholder(/digite sua senha/i).fill('Admin@1');
    await page.getByRole('button', { name: /entrar/i }).click();

    // Em demo, master + Admin@1 entra direto. Aguarda elemento típico
    // pós-login (qualquer nav role).
    await expect(
      page.locator('[role="navigation"], aside nav, nav').first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test('rota inexistente cai no NotFound', async ({ page }) => {
    await page.goto('/');
    await page.getByPlaceholder('seu.login').fill('master');
    await page.getByPlaceholder(/digite sua senha/i).fill('Admin@1');
    await page.getByRole('button', { name: /entrar/i }).click();
    await expect(
      page.locator('[role="navigation"], aside nav, nav').first()
    ).toBeVisible({ timeout: 15_000 });

    await page.goto('/rota-que-nao-existe');
    await expect(page.getByText(/404|não.+encontrad|not found/i).first()).toBeVisible();
  });
});
