/**
 * E2E: LoginV2Page (template do padrao Just).
 *
 * Testa só comportamento da UI — não requer API rodando. Quando a API
 * estiver no ar em CI, dá pra estender com cenários de sucesso/erro
 * reais.
 *
 * Selectors por id evitam ambiguidade com o botao "Mostrar senha"
 * (aria-label contem "Senha").
 */
import { test, expect, type Page } from '@playwright/test';

const loginInput = (page: Page) => page.locator('#login');
const senhaInput = (page: Page) => page.locator('#senha');

test.describe('LoginV2Page', () => {
  test('pagina /login-v2 renderiza com form', async ({ page }) => {
    await page.goto('/login-v2');
    await expect(page.getByRole('heading', { name: 'FlowDesk' })).toBeVisible();
    await expect(loginInput(page)).toBeVisible();
    await expect(senhaInput(page)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
  });

  test('validacao zod rejeita campos vazios', async ({ page }) => {
    await page.goto('/login-v2');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByText(/login obrigat/i).first()).toBeVisible();
  });

  test('toggle de mostrar senha funciona', async ({ page }) => {
    await page.goto('/login-v2');
    const senha = senhaInput(page);
    await senha.fill('teste-123');
    await expect(senha).toHaveAttribute('type', 'password');

    await page.getByRole('button', { name: /mostrar senha/i }).click();
    await expect(senha).toHaveAttribute('type', 'text');

    await page.getByRole('button', { name: /ocultar senha/i }).click();
    await expect(senha).toHaveAttribute('type', 'password');
  });

  test('submit chama a API (com erro esperado se API offline)', async ({ page }) => {
    let requestMade = false;
    page.on('request', (req) => {
      if (req.url().includes('/auth/login')) requestMade = true;
    });

    await page.goto('/login-v2');
    await loginInput(page).fill('master');
    await senhaInput(page).fill('senha-teste-123');
    await page.getByRole('button', { name: 'Entrar' }).click();

    await page.waitForTimeout(2_000);
    expect(requestMade).toBe(true);
  });
});
