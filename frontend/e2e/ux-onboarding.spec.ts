import { test, expect } from '@playwright/test';
import { loginAs } from './helpers';

test.describe('Onboarding de boas-vindas', () => {
  test('exibe o diálogo na primeira visita e fecha ao pular', async ({
    page,
  }) => {
    await loginAs(page, 'nurse');
    await page.evaluate(() =>
      localStorage.removeItem('onconav_welcome_onboarding_v1')
    );
    await page.reload({ waitUntil: 'load' });

    const dialog = page.getByTestId('welcome-onboarding');
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByRole('heading', { name: /Bem-vindo ao ONCONAV/i })
    ).toBeVisible();

    await page.getByRole('button', { name: 'Pular' }).click();
    await expect(dialog).not.toBeVisible({ timeout: 5_000 });

    await page.reload({ waitUntil: 'load' });
    await expect(dialog).not.toBeVisible({ timeout: 3_000 });
  });

  test('percorre os passos até Começar e não reabre', async ({ page }) => {
    await loginAs(page, 'nurse');
    await page.evaluate(() =>
      localStorage.removeItem('onconav_welcome_onboarding_v1')
    );
    await page.reload({ waitUntil: 'load' });

    await expect(page.getByTestId('welcome-onboarding')).toBeVisible({
      timeout: 10_000,
    });
    await page.getByRole('button', { name: 'Próximo' }).click();
    await expect(
      page.getByRole('heading', { name: /Chat em tempo real/i })
    ).toBeVisible();
    await page.getByRole('button', { name: 'Próximo' }).click();
    await expect(
      page.getByRole('heading', { name: /Pacientes e navegação/i })
    ).toBeVisible();
    await page.getByRole('button', { name: 'Começar' }).click();
    await expect(page.getByTestId('welcome-onboarding')).not.toBeVisible({
      timeout: 5_000,
    });
  });
});
