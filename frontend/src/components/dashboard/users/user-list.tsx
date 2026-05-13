'use client';

import { useState } from 'react';
import { useUsers, useDeleteUser } from '@/hooks/useUsers';
import { User, UserRole } from '@/lib/api/users';
import { useAuthStore } from '@/stores/auth-store';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Pencil, Trash2, Search, MailPlus } from 'lucide-react';
import { UserFormDialog } from './user-form-dialog';
import { InviteLinkDialog } from './invite-link-dialog';

const clinicalSubroleLabels: Record<string, string> = {
  NURSING: 'Subpapel: Enfermagem',
  MEDICAL: 'Subpapel: Médica',
};

const roleLabels: Record<UserRole, string> = {
  ADMIN: 'Administrador',
  ONCOLOGIST: 'Oncologista',
  DOCTOR: 'Médico',
  NURSE_CHIEF: 'Enfermeiro Chefe',
  NURSE: 'Enfermeiro',
  COORDINATOR: 'Coordenador',
  SECRETARY: 'Secretaria',
};

const roleColors: Record<UserRole, string> = {
  ADMIN: 'bg-red-100 text-red-800',
  ONCOLOGIST: 'bg-purple-100 text-purple-800',
  DOCTOR: 'bg-blue-100 text-blue-800',
  NURSE_CHIEF: 'bg-orange-100 text-orange-800',
  NURSE: 'bg-green-100 text-green-800',
  COORDINATOR: 'bg-indigo-100 text-indigo-800',
  SECRETARY: 'bg-slate-100 text-slate-800',
};

interface UserListProps {
  onEdit?: (user: User) => void;
}

export function UserList({ onEdit }: UserListProps) {
  const { data: users, isLoading } = useUsers();
  const deleteUserMutation = useDeleteUser();
  const currentUser = useAuthStore((s) => s.user);
  const canGenerateInvite =
    currentUser?.role === 'ADMIN' || currentUser?.role === 'COORDINATOR';
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const filteredUsers = users?.filter(
    (user) =>
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEdit = (user: User) => {
    setEditingUser(user);
    onEdit?.(user);
  };

  const handleDelete = async (id: string) => {
    if (
      !confirm(
        'Tem certeza que deseja excluir este usuário? Esta ação não pode ser desfeita.'
      )
    ) {
      return;
    }

    try {
      await deleteUserMutation.mutateAsync(id);
    } catch (error) {
      console.error('Erro ao excluir usuário:', error);
      alert('Erro ao excluir usuário. Tente novamente.');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header com busca e botão de criar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nome ou email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {canGenerateInvite && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsInviteDialogOpen(true)}
            >
              <MailPlus className="h-4 w-4 mr-2" />
              Link de convite
            </Button>
          )}
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Usuário
          </Button>
        </div>
      </div>

      {/* Lista de usuários */}
      {filteredUsers && filteredUsers.length > 0 ? (
        <div className="space-y-2">
          {filteredUsers.map((user) => (
            <Card key={user.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-gray-900">{user.name}</h3>
                    <Badge className={roleColors[user.role]}>
                      {roleLabels[user.role]}
                    </Badge>
                    {(user.role === 'COORDINATOR' || user.role === 'ADMIN') &&
                      user.clinicalSubrole && (
                      <Badge variant="outline" className="text-xs">
                        {clinicalSubroleLabels[user.clinicalSubrole]}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{user.email}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Criado em{' '}
                    {new Date(user.createdAt).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(user)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(user.id)}
                    disabled={deleteUserMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">
          <p>Nenhum usuário encontrado</p>
        </div>
      )}

      {/* Diálogos */}
      <InviteLinkDialog
        open={isInviteDialogOpen}
        onOpenChange={setIsInviteDialogOpen}
      />
      <UserFormDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      />
      {editingUser && (
        <UserFormDialog
          open={!!editingUser}
          onOpenChange={(open) => !open && setEditingUser(null)}
          user={editingUser}
        />
      )}
    </div>
  );
}
