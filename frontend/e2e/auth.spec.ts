import { test, expect } from '@playwright/test';
import { loginAs, TEST_CREDENTIALS } from './helpers';

test.describe('Autenticação', () => {
  // ── Página de Login ──────────────────────────────────────────────────────────

  test('exibe o formulário de login', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
  });

  test('não submete quando campos estão vazios (HTML5 required)', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Entrar' }).click();
    // O formulário não deve navegar — URL continua em /login
    await expect(page).toHaveURL(/\/login/);
    // Campos com required devem ser marcados como inválidos pelo browser
    await expect(page.locator('#email:invalid, #email[aria-invalid]')).toBeVisible();
  });

  test('credenciais inválidas não redirecionam para /dashboard', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'load' });
    await page.locator('#email').fill('usuario@inexistente.com');
    await page.locator('#password').fill('senhaErrada123');
    await page.getByRole('button', { name: 'Entrar' }).click();

    // Aguardar que o loading termine (botão volta para "Entrar" ou página re-carrega em /login)
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible({ timeout: 15_000 });

    // Login inválido nunca deve redirecionar para /dashboard
    await expect(page).toHaveURL(/\/login/);
  });

  test('redireciona para /login quando acessa rota protegida sem autenticação', async ({ page }) => {
    // Garantir que não há sessão ativa: limpar cookies e navegar para /login
    // (origin válida) antes de limpar localStorage
    await page.context().clearCookies();
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.evaluate((keys) => { keys.forEach((k) => localStorage.removeItem(k)); },
      ['auth_token', 'user', 'tenant_id', 'refresh_token']);

    // Agora tenta acessar rota protegida — deve redirecionar para /login
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  // ── Login bem-sucedido ───────────────────────────────────────────────────────

  test('login de enfermeira redireciona para /dashboard', async ({ page }) => {
    await loginAs(page, 'nurse');
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('login de oncologista redireciona para /dashboard', async ({ page }) => {
    await loginAs(page, 'oncologist');
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('exibe nome do usuário na navbar após login', async ({ page }) => {
    await loginAs(page, 'nurse');
    // Navbar exibe user.name (ex: "Maria Santos")
    await expect(
      page.getByText(TEST_CREDENTIALS.nurse.name, { exact: false })
    ).toBeVisible({ timeout: 8_000 });
  });

  // ── Logout ───────────────────────────────────────────────────────────────────

  test('logout redireciona para /login', async ({ page }) => {
    await loginAs(page, 'nurse');
    // Botão "Sair" na navbar
    await page.getByRole('button', { name: 'Sair' }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 8_000 });
  });

  test('após logout não consegue acessar rota protegida', async ({ page }) => {
    await loginAs(page, 'nurse');
    await page.getByRole('button', { name: 'Sair' }).click();
    await expect(page).toHaveURL(/\/login/);

    // Tentar acessar dashboard diretamente
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });
});
