/**
 * E2E pras telas v2 (consumindo a API Express).
 *
 * Estes specs testam só a UI sem precisar da API rodando — login no
 * sistema legacy (Admin@1) e depois acessa as rotas v2. As paginas
 * mostram estados de erro graciosamente quando a API nao responde.
 *
 * Quando a API estiver up no CI, dá pra estender com fluxos completos.
 */
import { test, expect, type Page } from '@playwright/test';

/** Login no sistema legacy (master / Admin@1 em VITE_DEMO_MODE=true) */
async function loginAsMaster(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByPlaceholder('seu.login').fill('master');
  await page.getByPlaceholder(/digite sua senha/i).fill('Admin@1');
  await page.getByRole('button', { name: /entrar/i }).click();
  await expect(
    page.locator('[role="navigation"], aside nav, nav').first()
  ).toBeVisible({ timeout: 15_000 });
}

test.describe('Telas v2 — render', () => {
  test('AuditoriaPage carrega', async ({ page }) => {
    await loginAsMaster(page);
    await page.goto('/auditoria');
    await expect(page.getByRole('heading', { name: /Auditoria/i })).toBeVisible({ timeout: 10_000 });
    // Pelo menos um dos botoes ou o input de filtro renderiza
    await expect(page.getByPlaceholder(/Recurso/i)).toBeVisible();
  });

  test('NotasV2Page carrega', async ({ page }) => {
    await loginAsMaster(page);
    await page.goto('/notas-v2');
    // Heading was updated from "Notas (v2)" to "Bloco de Notas"
    await expect(page.getByRole('heading', { name: /Bloco de Notas/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: /Nova nota/i })).toBeVisible();
  });

  test('NotificacoesV2Page carrega', async ({ page }) => {
    await loginAsMaster(page);
    await page.goto('/notificacoes-v2');
    // Heading is translated via i18n key "notif_page.title" which resolves to "Notificações"
    await expect(page.getByRole('heading', { name: /Notificações/i })).toBeVisible({ timeout: 10_000 });
  });

  test('ConfiguracoesV2Page carrega', async ({ page }) => {
    await loginAsMaster(page);
    await page.goto('/configuracoes-v2');
    await expect(
      page.getByRole('heading', { name: /Configurações \(v2\)/i }).or(page.getByText(/Carregando preferências/i))
    ).toBeVisible({ timeout: 10_000 });
  });

  test('DemandasV2Page carrega', async ({ page }) => {
    await loginAsMaster(page);
    await page.goto('/demandas-v2');
    await expect(page.getByRole('heading', { name: /Demandas \(v2\)/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByPlaceholder(/Buscar título/i)).toBeVisible();
  });

  test('NotasV2Page abre form de criar', async ({ page }) => {
    await loginAsMaster(page);
    await page.goto('/notas-v2');
    await page.getByRole('button', { name: /Nova nota/i }).click();
    // Dialog opens — detect by its title rather than a placeholder that may change
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('heading', { name: /Nova nota/i })).toBeVisible();
    // Cancela
    await page.getByRole('button', { name: /Cancelar/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });
});

test.describe('Sidebar BETA', () => {
  test('master ve menu padrao (BETA removido)', async ({ page }) => {
    await loginAsMaster(page);
    // Auditoria/v2 sairam do sidebar — sobra o menu padrao
    await expect(
      page.getByText(/Notas|Demandas|Dashboard/i).first()
    ).toBeVisible();
  });
});
