import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '../button';

describe('Button (smoke)', () => {
  it('renders children', () => {
    render(<Button>Salvar</Button>);
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeInTheDocument();
  });

  it('calls onClick when clicked', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Clique aqui</Button>);
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('does not call onClick when disabled', async () => {
    const onClick = vi.fn();
    render(<Button disabled onClick={onClick}>Desabilitado</Button>);
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('applies the destructive variant class', () => {
    render(<Button variant="destructive">Excluir</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toMatch(/bg-destructive/);
  });

  it('applies the outline variant class', () => {
    render(<Button variant="outline">Cancelar</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toMatch(/border/);
  });

  it('accepts and forwards a ref', () => {
    const ref = { current: null as HTMLButtonElement | null };
    render(<Button ref={ref}>Ref</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });
});
