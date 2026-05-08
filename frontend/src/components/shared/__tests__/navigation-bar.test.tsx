import { render, screen } from '@testing-library/react';
import { NavigationBar } from '../navigation-bar';

const pushMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => '/dashboard',
}));

vi.mock('@/hooks/useAlerts', () => ({
  useCriticalAlertsCount: () => ({ data: { count: 0 } }),
}));

vi.mock('@/hooks/useMessages', () => ({
  useUnassumedPatientIds: () => ({ data: { patientIds: [] as string[] } }),
}));

vi.mock('@/hooks/useReadPatients', () => ({
  useReadPatients: () => ({ readPatientIds: new Set<string>() }),
}));

vi.mock('@/stores/auth-store', () => ({
  useAuthStore: () => ({
    user: {
      role: 'ADMIN',
      name: 'Admin',
      tenant: { name: 'Hospital Teste' },
    },
    logout: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('@/components/shared/welcome-onboarding', () => ({
  WelcomeOnboarding: () => null,
}));

describe('NavigationBar', () => {
  beforeEach(() => {
    pushMock.mockClear();
    // `useNavCompactMode` depende de matchMedia.
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
  });

  it('does not render removed nav items', () => {
    render(<NavigationBar />);

    expect(
      screen.queryByRole('button', { name: 'Calculadora ROI' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Observabilidade' })
    ).not.toBeInTheDocument();
  });

  it('renders expected base items (smoke)', () => {
    render(<NavigationBar />);

    expect(screen.getByRole('navigation', { name: 'Navegação principal' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Navegação' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Agenda' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Chat' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pacientes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Integrações' })).toBeInTheDocument();
  });
});

