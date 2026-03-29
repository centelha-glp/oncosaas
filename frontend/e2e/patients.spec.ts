import { test, expect } from '@playwright/test';
import { loginAs } from './helpers';

test.describe('Gestão de Pacientes', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'nurse');
    await page.goto('/patients');
    // Aguardar heading da página
    await page.waitForSelector('h1', { timeout: 10_000 });
  });

  // ── Listagem ─────────────────────────────────────────────────────────────────

  test('exibe a página de lista de pacientes', async ({ page }) => {
    await expect(page).toHaveURL(/\/patients/);
    await expect(page.getByRole('heading', { name: 'Pacientes' })).toBeVisible();
  });

  test('exibe pelo menos um paciente na lista (após seed)', async ({ page }) => {
    // Aguarda a tabela ou mensagem de carregamento desaparecer
    await expect(page.getByText('Carregando pacientes...')).not.toBeVisible({ timeout: 10_000 });
    // Deve haver pelo menos uma linha na tabela
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 10_000 });
  });

  test('campo de busca filtra pacientes por nome', async ({ page }) => {
    // Aguardar carregamento
    await expect(page.getByText('Carregando pacientes...')).not.toBeVisible({ timeout: 10_000 });

    const searchInput = page.getByPlaceholder(/buscar|pesquisar|search/i);
    await expect(searchInput).toBeVisible();

    await searchInput.fill('zzznaoexistejamais999');
    await expect(page.getByText(/0 paciente/i)).toBeVisible({ timeout: 5_000 });
  });

  // ── Criação ───────────────────────────────────────────────────────────────────

  test('botão "Adicionar Paciente" abre o diálogo de criação', async ({ page }) => {
    await page.getByRole('button', { name: 'Adicionar Paciente' }).click();
    // Dialog com título "Adicionar Novo Paciente" deve aparecer
    await expect(page.getByText('Adicionar Novo Paciente')).toBeVisible({ timeout: 5_000 });
  });

  test('formulário valida campos obrigatórios ao tentar criar paciente', async ({ page }) => {
    await page.getByRole('button', { name: 'Adicionar Paciente' }).click();
    await expect(page.getByText('Adicionar Novo Paciente')).toBeVisible({ timeout: 5_000 });

    // Avançar pelas 3 etapas sem preencher nada
    await page.getByRole('button', { name: 'Próximo' }).click();
    await page.getByRole('button', { name: 'Próximo' }).click();

    // Tentar criar sem preencher campos obrigatórios
    await page.getByRole('button', { name: 'Criar Paciente' }).click();

    // O dialog deve permanecer aberto (form não é submetido com dados inválidos)
    await expect(page.getByText('Adicionar Novo Paciente')).toBeVisible({ timeout: 3_000 });
  });

  test('cria novo paciente com dados mínimos válidos', async ({ page }) => {
    const timestamp = Date.now();
    const patientName = `Paciente E2E ${timestamp}`;

    await page.getByRole('button', { name: 'Adicionar Paciente' }).click();
    await expect(page.getByText('Adicionar Novo Paciente')).toBeVisible({ timeout: 5_000 });

    // Etapa 1 — dados básicos
    await page.locator('#name, [name="name"]').fill(patientName);
    await page.locator('#phone, [name="phone"]').fill('11987654321');

    // Data de nascimento
    const birthDateInput = page.locator('#birthDate, [name="birthDate"]');
    await birthDateInput.fill('1980-05-15');

    // Avançar para etapa 2
    await page.getByRole('button', { name: 'Próximo' }).click();

    // Etapa 2 pode ter campos opcionais — avançar de novo ou criar
    const createBtn = page.getByRole('button', { name: 'Criar Paciente' });
    const nextBtn = page.getByRole('button', { name: 'Próximo' });

    if (await nextBtn.isVisible({ timeout: 2_000 })) {
      await nextBtn.click();
    }

    if (await createBtn.isVisible({ timeout: 3_000 })) {
      await createBtn.click();
    }

    // Aguarda feedback de sucesso (toast do sonner)
    await expect(
      page.getByText(/paciente criado com sucesso/i)
    ).toBeVisible({ timeout: 10_000 });
  });

  // ── Detalhe do Paciente ────────────────────────────────────────────────────

  test('clicar em "Ver detalhes" navega para a página de detalhes', async ({ page }) => {
    await expect(page.getByText('Carregando pacientes...')).not.toBeVisible({ timeout: 10_000 });

    const firstRow = page.locator('tbody tr').first();
    await expect(firstRow).toBeVisible({ timeout: 5_000 });
    // A navegação ocorre via botão "Ver detalhes" (ícone Eye), não via click na linha
    await firstRow.getByTitle('Ver detalhes').click();

    await expect(page).toHaveURL(/\/patients\/[a-z0-9-]+/, { timeout: 8_000 });
  });

  test('página de detalhes exibe tabs de informação clínica', async ({ page }) => {
    await expect(page.getByText('Carregando pacientes...')).not.toBeVisible({ timeout: 10_000 });

    const firstRow = page.locator('tbody tr').first();
    await expect(firstRow).toBeVisible({ timeout: 5_000 });
    await firstRow.getByTitle('Ver detalhes').click();
    await page.waitForURL(/\/patients\/[a-z0-9-]+/);

    // Aguardar loading terminar
    await expect(page.getByText('Carregando dados do paciente...')).not.toBeVisible({ timeout: 10_000 });

    // Deve haver pelo menos uma tab clínica (TabsTrigger aparece como button no ARIA)
    await expect(
      page.getByRole('button', { name: 'Visão Geral' })
    ).toBeVisible({ timeout: 8_000 });
  });
});

test.describe('Importação de Pacientes', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/patients');
    await page.waitForSelector('h1', { timeout: 10_000 });
  });

  test('botão "Importar CSV" está visível na página de pacientes', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Importar CSV' })).toBeVisible();
  });

  test('clique no botão "Importar CSV" abre o diálogo de importação', async ({ page }) => {
    await page.getByRole('button', { name: 'Importar CSV' }).click();
    // Dialog deve aparecer com opção de upload de arquivo
    await expect(
      page.getByText(/importar|upload|arquivo|xlsx|csv/i).first()
    ).toBeVisible({ timeout: 5_000 });
  });
});
