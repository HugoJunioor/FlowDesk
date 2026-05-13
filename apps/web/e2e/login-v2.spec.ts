/**
 * E2E: LoginV2Page (template do padrao Just).
 *
 * Testa só comportamento da UI — não requer API rodando. Quando a API
 * estiver no ar em CI, dá pra estender com cenários de sucesso/erro
 * reais.
 */
import { test, expect } from '@playwright/test';

test.describe('LoginV2Page', () => {
  test('pagina /login-v2 renderiza com form', async ({ page }) => {
    await page.goto('/login-v2');
    await expect(page.getByRole('heading', { name: 'FlowDesk' })).toBeVisible();
    await expect(page.getByLabel('Login')).toBeVisible();
    await expect(page.getByLabel('Senha')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
  });

  test('validacao zod rejeita campos vazios', async ({ page }) => {
    await page.goto('/login-v2');
    await page.getByRole('button', { name: 'Entrar' }).click();
    // Mensagens de erro do zod aparecem
    await expect(page.getByText(/login obrigat/i).first()).toBeVisible();
  });

  test('toggle de mostrar senha funciona', async ({ page }) => {
    await page.goto('/login-v2');
    const senhaInput = page.getByLabel('Senha');
    await senhaInput.fill('teste-123');
    await expect(senhaInput).toHaveAttribute('type', 'password');

    await page.getByRole('button', { name: /mostrar senha/i }).click();
    await expect(senhaInput).toHaveAttribute('type', 'text');

    await page.getByRole('button', { name: /ocultar senha/i }).click();
    await expect(senhaInput).toHaveAttribute('type', 'password');
  });

  test('submit chama a API (com erro esperado se API offline)', async ({ page }) => {
    // Intercepta a request — sem API up, a chamada vai falhar.
    // Testamos só que o fetch foi disparado.
    let requestMade = false;
    page.on('request', (req) => {
      if (req.url().includes('/auth/login')) requestMade = true;
    });

    await page.goto('/login-v2');
    await page.getByLabel('Login').fill('master');
    await page.getByLabel('Senha').fill('senha-teste-123');
    await page.getByRole('button', { name: 'Entrar' }).click();

    // Espera a chamada de rede ou um indicador de erro
    await page.waitForTimeout(2_000);
    expect(requestMade).toBe(true);
  });
});
