/**
 * Setup global do Playwright — executado UMA VEZ antes de todos os testes E2E.
 *
 * Faz login de cada role e salva o storageState (cookies + localStorage) em disco.
 * Os testes restauram esse estado em vez de chamar o endpoint de login repetidamente,
 * evitando o rate limit de 10 req/min configurado no backend.
 */
import { test as setup, expect } from '@playwright/test';
import * as path from 'path';

const AUTH_DIR = path.join(__dirname, '.auth');

async function saveAuthState(
  page: import('@playwright/test').Page,
  email: string,
  password: string,
  stateFile: string
) {
  // 'load' garante que o JS do Next.js carregou e React hidratou o formulário.
  // 'domcontentloaded' é cedo demais — o onSubmit não estaria registrado ainda.
  await page.goto('/login', { waitUntil: 'load' });
  await page.waitForSelector('#email', { state: 'visible', timeout: 10_000 });
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
  // Salvar cookies + localStorage para reutilização nos testes
  await page.context().storageState({ path: stateFile });
}

setup('verificar que a aplicação está acessível', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/(login|$)/);
});

setup('salvar estado de auth: enfermeira', async ({ page }) => {
  await saveAuthState(
    page,
    'enfermeira@hospitalteste.com',
    'senha123',
    path.join(AUTH_DIR, 'nurse.json')
  );
});

setup('salvar estado de auth: admin', async ({ page }) => {
  await saveAuthState(
    page,
    'admin@hospitalteste.com',
    'senha123',
    path.join(AUTH_DIR, 'admin.json')
  );
});

setup('salvar estado de auth: oncologista', async ({ page }) => {
  await saveAuthState(
    page,
    'oncologista@hospitalteste.com',
    'senha123',
    path.join(AUTH_DIR, 'oncologist.json')
  );
});
