'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  MessageSquare,
  LayoutDashboard,
  Navigation,
  CalendarDays,
  LogOut,
  Settings,
  Users,
  UserCircle,
  Bug,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import { useCriticalAlertsCount } from '@/hooks/useAlerts';
import { useUnassumedPatientIds } from '@/hooks/useMessages';
import { useReadPatients } from '@/hooks/useReadPatients';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { WelcomeOnboarding } from '@/components/shared/welcome-onboarding';

/** Viewport ≤1023px: rótulos da barra em modo compacto (só ícone + tooltip). */
function useNavCompactMode() {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    const apply = () => setCompact(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  return compact;
}

interface NavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

// Itens de navegação base.
const baseNavItems: NavItem[] = [
  {
    path: '/dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
  },
  {
    path: '/oncology-navigation',
    label: 'Navegação',
    icon: Navigation,
  },
  {
    path: '/agenda',
    label: 'Agenda',
    icon: CalendarDays,
  },
  {
    path: '/chat',
    label: 'Chat',
    icon: MessageSquare,
  },
  {
    path: '/patients',
    label: 'Pacientes',
    icon: UserCircle,
  },
  {
    path: '/integrations',
    label: 'Integrações',
    icon: Settings,
  },
];

const adminNavItems: NavItem[] = [
  {
    path: '/dashboard/users',
    label: 'Usuários',
    icon: Users,
  },
];

/** Listagem de feedbacks de produto — só ADMIN (não confundir com gestão de utilizadores). */
const adminOnlyNavItems: NavItem[] = [
  {
    path: '/dashboard/product-feedback',
    label: 'Feedbacks',
    icon: Bug,
  },
];

export function NavigationBar() {
  const compactNav = useNavCompactMode();
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const { data: criticalCount } = useCriticalAlertsCount();
  const { data: unassumedPatientIds } = useUnassumedPatientIds();
  const { readPatientIds } = useReadPatients();

  // Chat: conversas não lidas (não assumidas que ainda não foram abertas)
  const unreadChatCount =
    unassumedPatientIds?.patientIds && readPatientIds
      ? unassumedPatientIds.patientIds.filter((id) => !readPatientIds.has(id))
          .length
      : 0;

  // Verificar se o usuário tem permissão para ver usuários
  const canManageUsers =
    user?.role === 'ADMIN' ||
    user?.role === 'NURSE_CHIEF' ||
    user?.role === 'COORDINATOR';

  const isSecretary = user?.role === 'SECRETARY';

  const secretaryNavItems: NavItem[] = [
    {
      path: '/agenda',
      label: 'Agenda',
      icon: CalendarDays,
    },
    {
      path: '/patients',
      label: 'Pacientes',
      icon: UserCircle,
    },
    {
      path: '/integrations',
      label: 'Integrações',
      icon: Settings,
    },
    {
      path: '/chat',
      label: 'Chat',
      icon: MessageSquare,
    },
  ];

  // Montar lista de itens de navegação baseada nas permissões
  const navItems = isSecretary ? secretaryNavItems : [...baseNavItems];

  const isActive = (itemPath: string): boolean => {
    if (!pathname) return false;

    // Match exato
    if (pathname === itemPath) return true;

    // Caso especial: /dashboard ativo para /dashboard e subrotas (exceto página dedicada de feedback)
    if (itemPath === '/dashboard') {
      if (pathname?.startsWith('/dashboard/product-feedback')) {
        return false;
      }
      return pathname === '/dashboard' || pathname.startsWith('/dashboard/');
    }

    // Caso especial: /patients deve ser ativo para /patients e subrotas
    if (itemPath === '/patients') {
      return pathname === '/patients' || pathname.startsWith('/patients/');
    }

    if (itemPath === '/oncology-navigation') {
      return (
        pathname === '/oncology-navigation' ||
        pathname.startsWith('/oncology-navigation/')
      );
    }

    // Para outras rotas, verificar se começa com o path
    if (
      itemPath !== '/dashboard' &&
      itemPath !== '/patients' &&
      pathname.startsWith(itemPath)
    ) {
      return true;
    }

    return false;
  };

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const getBadge = (path: string) => {
    // Chat: conversas não lidas (não assumidas que ainda não foram abertas)
    if (path === '/chat' && unreadChatCount > 0) {
      return unreadChatCount;
    }
    if (path === '/dashboard' && criticalCount && criticalCount.count > 0) {
      return criticalCount.count;
    }
    return null;
  };

  const renderMainNavButton = (item: NavItem) => {
    const Icon = item.icon;
    const active = isActive(item.path);
    const badge = getBadge(item.path);

    const button = (
      <Button
        variant={active ? 'default' : 'ghost'}
        size="sm"
        onClick={() => router.push(item.path)}
        aria-label={item.label}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'relative flex shrink-0 items-center gap-2',
          active && 'bg-indigo-600 text-white hover:bg-indigo-700'
        )}
      >
        <Icon className="h-4 w-4 shrink-0" aria-hidden />
        <span className="hidden lg:inline">{item.label}</span>
        {badge !== null && (
          <span
            className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white"
            aria-hidden
          >
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </Button>
    );

    if (compactNav) {
      return (
        <Tooltip key={item.path}>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent side="bottom">{item.label}</TooltipContent>
        </Tooltip>
      );
    }

    return <div key={item.path}>{button}</div>;
  };

  return (
    <>
    <nav
      className="bg-white border-b px-3 py-3 sm:px-4"
      aria-label="Navegação principal"
    >
      <div className="flex flex-col gap-3 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:gap-4">
        <div className="hidden sm:block" aria-hidden />
        <div className="flex min-w-0 flex-wrap items-center justify-center gap-1">
          {navItems.map((item) => renderMainNavButton(item))}
          {canManageUsers &&
            adminNavItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);

              const button = (
                <Button
                  variant={active ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => router.push(item.path)}
                  aria-label={item.label}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex shrink-0 items-center gap-2',
                    active && 'bg-indigo-600 text-white hover:bg-indigo-700'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="hidden lg:inline">{item.label}</span>
                </Button>
              );

              if (compactNav) {
                return (
                  <Tooltip key={item.path}>
                    <TooltipTrigger asChild>{button}</TooltipTrigger>
                    <TooltipContent side="bottom">{item.label}</TooltipContent>
                  </Tooltip>
                );
              }

              return <div key={item.path}>{button}</div>;
            })}
          {user?.role === 'ADMIN' &&
            adminOnlyNavItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);

              const button = (
                <Button
                  variant={active ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => router.push(item.path)}
                  aria-label={item.label}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex shrink-0 items-center gap-2',
                    active && 'bg-indigo-600 text-white hover:bg-indigo-700'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="hidden lg:inline">{item.label}</span>
                </Button>
              );

              if (compactNav) {
                return (
                  <Tooltip key={item.path}>
                    <TooltipTrigger asChild>{button}</TooltipTrigger>
                    <TooltipContent side="bottom">{item.label}</TooltipContent>
                  </Tooltip>
                );
              }

              return <div key={item.path}>{button}</div>;
            })}
        </div>
        <div className="flex shrink-0 items-center justify-end gap-2 sm:gap-3">
          {user && (
            <>
              <div className="text-sm text-gray-600 hidden md:block max-w-[200px] truncate lg:max-w-none">
                <span className="font-medium">{user.name}</span>
                <span className="text-gray-400 mx-1">·</span>
                <span className="text-xs text-gray-500">
                  {user?.tenant?.name || 'Hospital Teste'}
                </span>
              </div>
              {compactNav ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push('/profile')}
                      className={cn(
                        isActive('/profile') && 'bg-indigo-50 text-indigo-700'
                      )}
                      aria-label="Meu perfil"
                      aria-current={
                        isActive('/profile') ? 'page' : undefined
                      }
                    >
                      <Settings className="h-4 w-4" aria-hidden />
                      <span className="hidden lg:inline">Perfil</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Meu perfil</TooltipContent>
                </Tooltip>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push('/profile')}
                  className={cn(
                    isActive('/profile') && 'bg-indigo-50 text-indigo-700'
                  )}
                  aria-label="Meu perfil"
                  aria-current={isActive('/profile') ? 'page' : undefined}
                >
                  <Settings className="h-4 w-4 lg:mr-1" aria-hidden />
                  <span className="hidden lg:inline">Perfil</span>
                </Button>
              )}
              {compactNav ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleLogout}
                      aria-label="Sair"
                    >
                      <LogOut className="h-4 w-4" aria-hidden />
                      <span className="hidden lg:inline">Sair</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Sair</TooltipContent>
                </Tooltip>
              ) : (
                <Button variant="outline" size="sm" onClick={handleLogout}>
                  <LogOut className="h-4 w-4 lg:mr-2" aria-hidden />
                  <span className="hidden lg:inline">Sair</span>
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </nav>
    <WelcomeOnboarding />
    </>
  );
}

// Exportação de compatibilidade
export const NavigationButtons = NavigationBar;
