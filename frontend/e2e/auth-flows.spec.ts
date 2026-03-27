import { expect, test } from '@playwright/test';

function createJwt(exp: number): string {
  const header = Buffer.from(
    JSON.stringify({ alg: 'HS256', typ: 'JWT' })
  ).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ exp })).toString('base64url');
  return `${header}.${payload}.signature`;
}

test.describe('Auth flows', () => {
  test('redirects unauthenticated users from protected routes while preserving destination', async ({
    page,
  }) => {
    await page.goto('/dashboard');

    await expect(page).toHaveURL(/\/login\?redirect=%2Fdashboard/);
    await expect(
      page.getByRole('heading', { name: /ONCONAV/i })
    ).toBeVisible();
  });

  test('allows users to access forgot-password and complete request flow', async ({
    page,
  }) => {
    await page.route('**/api/v1/auth/forgot-password', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    });

    await page.goto('/forgot-password');
    await expect(
      page.getByRole('heading', { name: /Recuperar senha/i })
    ).toBeVisible();

    await page.getByLabel('Email').fill('nurse@hospital.local');
    await page
      .getByRole('button', { name: /Enviar link de redefinição/i })
      .click();

    await expect(page.getByText(/Email enviado/i)).toBeVisible();
  });

  test('allows users to access reset-password route and submit new password', async ({
    page,
  }) => {
    await page.route('**/api/v1/auth/reset-password', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    });

    await page.goto('/reset-password/token-abc');
    await expect(page.getByRole('heading', { name: /Nova senha/i })).toBeVisible();

    await page.getByLabel('Nova senha').fill('novaSenha123');
    await page.getByLabel('Confirmar senha').fill('novaSenha123');
    await page.getByRole('button', { name: /Redefinir senha/i }).click();

    await expect(page).toHaveURL(/\/login\?reset=success/);
  });

  test('redirects to intended destination after successful login', async ({
    page,
  }) => {
    const validToken = createJwt(Math.floor(Date.now() / 1000) + 60 * 30);

    await page.route('**/api/v1/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: validToken,
          refresh_token: 'refresh-token-1',
          user: {
            id: 'u1',
            email: 'nurse@hospital.local',
            name: 'Nurse User',
            role: 'NURSE',
            tenantId: 'tenant-1',
          },
        }),
      });
    });

    // Prevent noisy backend calls on destination page from making test flaky.
    await page.route('**/api/v1/**', async (route) => {
      if (route.request().url().includes('/auth/login')) {
        await route.fallback();
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.goto('/login?redirect=/patients');

    await page.getByLabel('Email').fill('nurse@hospital.local');
    await page.getByLabel('Senha').fill('senha123');
    await page.getByRole('button', { name: /Entrar/i }).click();

    await expect(page).toHaveURL(/\/patients$/);
  });
});
