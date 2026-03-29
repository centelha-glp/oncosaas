import { type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/** Credenciais de teste (após `npm run db:seed` no backend) */
export const TEST_CREDENTIALS = {
  nurse: { email: 'enfermeira@hospitalteste.com', password: 'senha123', name: 'Maria Santos' },
  oncologist: { email: 'oncologista@hospitalteste.com', password: 'senha123', name: 'Dr. João' },
  admin: { email: 'admin@hospitalteste.com', password: 'senha123', name: 'Admin' },
  coordinator: { email: 'coordenador@hospitalteste.com', password: 'senha123', name: 'Coordenador' },
} as const;

const AUTH_DIR = path.join(__dirname, '.auth');

/**
 * Restaura o estado de autenticação salvo pelo setup global e navega para o dashboard.
 *
 * Em vez de fazer um novo login (que consome o rate limit de 10 req/min do backend),
 * restaura os cookies e localStorage gravados durante o `global.setup.ts`.
 *
 * Fallback: se o arquivo de estado não existir ainda, faz login via UI normalmente.
 */
export async function loginAs(
  page: Page,
  role: keyof typeof TEST_CREDENTIALS = 'nurse'
) {
  const stateFile = path.join(AUTH_DIR, `${role}.json`);

  if (fs.existsSync(stateFile)) {
    // ── Caminho rápido: restaurar estado salvo ────────────────────────────────
    const state = JSON.parse(fs.readFileSync(stateFile, 'utf-8')) as {
      cookies: { name: string; value: string; domain: string; path: string; expires: number; httpOnly: boolean; secure: boolean; sameSite: 'Lax' | 'None' | 'Strict' }[];
      origins: { origin: string; localStorage: { name: string; value: string }[] }[];
    };

    // Limpar estado anterior
    await page.context().clearCookies();

    // Navegar para o app ANTES de restaurar localStorage (precisa de origin válida)
    await page.goto('/login', { waitUntil: 'domcontentloaded' });

    // Restaurar cookies (inclui session_active que o middleware verifica)
    if (state.cookies?.length) {
      await page.context().addCookies(state.cookies);
    }

    // Restaurar localStorage (inclui auth_token, user, tenant_id)
    const origin = state.origins?.find((o) => o.origin.includes('localhost:3000'));
    if (origin?.localStorage?.length) {
      await page.evaluate((items) => {
        items.forEach(({ name, value }) => localStorage.setItem(name, value));
      }, origin.localStorage);
    }

    // Navegar para o dashboard com a sessão restaurada
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForURL(/\/dashboard/, { timeout: 10_000 });
    return;
  }

  // ── Fallback: login via UI (quando setup ainda não rodou) ────────────────────
  const { email, password } = TEST_CREDENTIALS[role];

  await page.context().clearCookies();
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.evaluate((keys) => { keys.forEach((k) => localStorage.removeItem(k)); },
    ['auth_token', 'user', 'tenant_id', 'refresh_token']);
  await page.goto('/login', { waitUntil: 'networkidle' });
  await page.waitForSelector('#email', { state: 'visible', timeout: 10_000 });
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
}
