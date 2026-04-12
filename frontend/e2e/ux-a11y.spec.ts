import { test, expect } from '@playwright/test';
import { loginAs } from './helpers';

test.describe('UX / Acessibilidade superficial', () => {
  test('login exibe rótulos visíveis para Email e Senha', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'load' });
    await expect(page.getByLabel('Email')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByLabel('Senha')).toBeVisible();
  });

  test('navbar tem landmark de navegação principal', async ({ page }) => {
    await loginAs(page, 'nurse');
    await expect(
      page.getByRole('navigation', { name: 'Navegação principal' })
    ).toBeVisible({ timeout: 10_000 });
  });

  test('página Chat exibe nota contextual sobre Dashboard', async ({
    page,
  }) => {
    await loginAs(page, 'nurse');
    await page.goto('/chat', { waitUntil: 'load' });
    const note = page.getByRole('note').filter({ hasText: /Chat:/ });
    await expect(note).toBeVisible({ timeout: 10_000 });
    await expect(note).toContainText(/Dashboard/i);
  });
});
