'use client';

import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  MessageSquare,
  LayoutDashboard,
  Navigation,
  Calculator,
  LogOut,
  Settings,
  Users,
  UserCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import { useUnassumedMessagesCount } from '@/hooks/useMessages';
import { useCriticalAlertsCount } from '@/hooks/useAlerts';

interface NavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

// Itens de navegação base (sem calculadora ROI)
const baseNavItems: NavItem[] = [
  {
    path: '/dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
  },
  {
    path: '/oncology-navigation',
    label: 'Navegação Oncológica',
    icon: Navigation,
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

// Item de calculadora ROI (não disponível para NURSE)
const roiNavItem: NavItem = {
  path: '/calculadora-roi',
  label: 'Calculadora ROI',
  icon: Calculator,
};

const adminNavItems: NavItem[] = [
  {
    path: '/dashboard/users',
    label: 'Usuários',
    icon: Users,
  },
];

export function NavigationBar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const { data: unassumedCount } = useUnassumedMessagesCount();
  const { data: criticalCount } = useCriticalAlertsCount();

  // Verificar se o usuário tem permissão para ver usuários
  const canManageUsers =
    user?.role === 'ADMIN' ||
    user?.role === 'NURSE_CHIEF' ||
    user?.role === 'COORDINATOR';

  // Verificar se o usuário pode ver calculadora ROI (não permitido para NURSE)
  const canSeeROI = user?.role !== 'NURSE';

  // Montar lista de itens de navegação baseada nas permissões
  const navItems = [...baseNavItems];
  if (canSeeROI) {
    navItems.push(roiNavItem);
  }

  const isActive = (itemPath: string): boolean => {
    if (!pathname) return false;

    // Match exato
    if (pathname === itemPath) return true;

    // Caso especial: /dashboard deve ser ativo para /dashboard e subrotas
    if (itemPath === '/dashboard') {
      return pathname === '/dashboard' || pathname.startsWith('/dashboard/');
    }

    // Caso especial: /patients deve ser ativo para /patients e subrotas
    if (itemPath === '/patients') {
      return pathname === '/patients' || pathname.startsWith('/patients/');
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

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const getBadge = (path: string) => {
    if (path === '/chat' && unassumedCount && unassumedCount.count > 0) {
      return unassumedCount.count;
    }
    if (path === '/dashboard' && criticalCount && criticalCount.count > 0) {
      return criticalCount.count;
    }
    return null;
  };

  return (
    <nav className="bg-white border-b px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            const badge = getBadge(item.path);

            return (
              <Button
                key={item.path}
                variant={active ? 'default' : 'ghost'}
                size="sm"
                onClick={() => router.push(item.path)}
                className={cn(
                  'relative flex items-center gap-2',
                  active && 'bg-indigo-600 text-white hover:bg-indigo-700'
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
                {badge !== null && (
                  <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white leading-none">
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </Button>
            );
          })}
          {canManageUsers &&
            adminNavItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);

              return (
                <Button
                  key={item.path}
                  variant={active ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => router.push(item.path)}
                  className={cn(
                    'flex items-center gap-2',
                    active && 'bg-indigo-600 text-white hover:bg-indigo-700'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Button>
              );
            })}
        </div>
        <div className="flex items-center gap-3">
          {user && (
            <>
              <div className="text-sm text-gray-600 hidden md:block">
                <span className="font-medium">{user.name}</span>
                <span className="text-gray-400 mx-1">·</span>
                <span className="text-xs text-gray-500">
                  {user?.tenant?.name || 'Hospital Teste'}
                </span>
              </div>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Sair
              </Button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

// Exportação de compatibilidade
export const NavigationButtons = NavigationBar;
