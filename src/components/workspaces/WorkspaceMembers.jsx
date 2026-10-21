import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Plus, MoreVertical, Edit2, Trash2, Mail, Clock, X } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

import workspaceService from '@/services/workspaceService';
import { useActiveWorkspace } from '@/hooks/useActiveWorkspace';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { DropdownMenu } from '@/components/ui/DropdownMenu';
import { ConfirmDeleteDialog } from '@/components/ui/ConfirmDeleteDialog';
import WorkspaceMemberModal from './WorkspaceMemberModal';

export default function WorkspaceMembers() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { activeWorkspaceId, activeWorkspace } = useActiveWorkspace();
  const [modalState, setModalState] = useState({ isOpen: false, mode: 'invite', member: null });
  const [removeMemberTarget, setRemoveMemberTarget] = useState(null);
  const [cancelInvTarget, setCancelInvTarget] = useState(null);

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['workspace-members', activeWorkspaceId],
    queryFn: () => workspaceService.getMembers(activeWorkspaceId),
    enabled: !!activeWorkspaceId,
  });

  const { data: invitations = [] } = useQuery({
    queryKey: ['workspace-invitations', activeWorkspaceId],
    queryFn: () => workspaceService.getInvitations(activeWorkspaceId),
    enabled: !!activeWorkspaceId,
  });

  const removeMutation = useMutation({
    mutationFn: (userId) => workspaceService.removeMember(activeWorkspaceId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries(['workspace-members', activeWorkspaceId]);
      toast.success(t('workspace.member_removed'));
    },
    onError: () => toast.error(t('common.error')),
  });

  const cancelInvMutation = useMutation({
    mutationFn: (inviteId) => workspaceService.cancelInvitation(activeWorkspaceId, inviteId),
    onSuccess: () => {
      queryClient.invalidateQueries(['workspace-invitations', activeWorkspaceId]);
      toast.success(t('workspace.invitation_cancelled', { defaultValue: 'Invitation cancelled' }));
    },
    onError: () => toast.error(t('common.error')),
  });

  const openInviteModal = () => setModalState({ isOpen: true, mode: 'invite', member: null });
  const openEditModal = (member) => setModalState({ isOpen: true, mode: 'edit', member });

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">{t('common.loading')}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{t('workspace.members')}</h2>
          <p className="text-sm text-muted-foreground">{t('workspace.members_desc')}</p>
        </div>
        <Button onClick={openInviteModal} className="gap-2 bg-[color:var(--color-primary)] hover:bg-[color:var(--color-primary)]/90 text-primary-foreground">
          <Plus className="w-4 h-4" />
          {t('workspace.invite_member')}
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/50 border-b border-border">
            <tr>
              <th className="p-4 font-semibold text-muted-foreground">{t('common.user')}</th>
              <th className="p-4 font-semibold text-muted-foreground">{t('workspace.role')}</th>
              <th className="p-4 font-semibold text-muted-foreground">{t('common.joined')}</th>
              <th className="p-4 font-semibold text-muted-foreground w-[80px]"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {members.map((member) => {
              const isOwner = member.user_id === activeWorkspace?.owner_id;
              
              return (
                <tr key={member.user_id} className="hover:bg-muted/10 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[11px]">
                        {member.user?.full_name?.charAt(0).toUpperCase() || 'U'}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{member.user?.full_name}</p>
                        <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] mt-0.5">
                          <Mail className="w-3 h-3" /> {member.user?.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-medium capitalize text-[10px] px-2 py-0.5">
                        {member.role?.name || member.workspace_role}
                      </Badge>
                      {isOwner && (
                        <Badge variant="glass" className="bg-primary/10 text-primary border-primary/20 text-[9px]">
                          {t('workspace.owner')}
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="p-4 text-muted-foreground text-xs">
                    {member.joined_at ? format(new Date(member.joined_at), 'MMM d, yyyy') : '-'}
                  </td>
                  <td className="p-4 text-right">
                    {!isOwner && (
                      <DropdownMenu
                        mode="click"
                        align="end"
                        trigger={
                          <Button variant="ghost" size="icon" className="w-8 h-8 rounded-md text-muted-foreground hover:text-foreground">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        }
                        content={
                          <div className="w-40 p-1">
                            <button
                              onClick={() => openEditModal(member)}
                              className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded-md transition-colors hover:bg-muted text-foreground font-medium"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              {t('common.edit')}
                            </button>
                            <div className="h-px bg-border my-1" />
                            <button
                              onClick={() => setRemoveMemberTarget(member)}
                              className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded-md transition-colors hover:bg-rose-500/10 text-rose-500 font-medium"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              {t('common.remove')}
                            </button>
                          </div>
                        }
                      />
                    )}
                  </td>
                </tr>
              );
            })}
            {members.length === 0 && (
              <tr>
                <td colSpan={4} className="p-8 text-center text-muted-foreground">
                  {t('workspace.no_members')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {invitations.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
            <Clock className="w-4 h-4" />
            {t('workspace.pending_invitations', { defaultValue: 'Pending Invitations' })}
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">{invitations.length}</Badge>
          </h3>
          <div className="rounded-xl border border-border bg-card shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="p-4 font-semibold text-muted-foreground">{t('common.email', { defaultValue: 'Email' })}</th>
                  <th className="p-4 font-semibold text-muted-foreground">{t('workspace.role', { defaultValue: 'Role' })}</th>
                  <th className="p-4 font-semibold text-muted-foreground">{t('workspace.expires', { defaultValue: 'Expires' })}</th>
                  <th className="p-4 font-semibold text-muted-foreground w-[80px]"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invitations.map((inv) => (
                  <tr key={inv.id} className="hover:bg-muted/10 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center">
                          <Mail className="w-4 h-4" />
                        </div>
                        <span className="font-medium text-foreground">{inv.email}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <Badge variant="outline" className="font-medium capitalize text-[10px] px-2 py-0.5">
                        {inv.role?.name || '-'}
                      </Badge>
                    </td>
                    <td className="p-4 text-muted-foreground text-xs">
                      {inv.expires_at ? format(new Date(inv.expires_at), 'MMM d, yyyy') : '-'}
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => setCancelInvTarget(inv)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 px-2 py-1 rounded-md transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                        {t('common.cancel', { defaultValue: 'Cancel' })}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modalState.isOpen && (
        <WorkspaceMemberModal
          isOpen={modalState.isOpen}
          mode={modalState.mode}
          member={modalState.member}
          onClose={() => setModalState({ isOpen: false, mode: 'invite', member: null })}
        />
      )}

      <ConfirmDeleteDialog
        isOpen={!!removeMemberTarget}
        onClose={() => setRemoveMemberTarget(null)}
        onConfirm={() => {
          removeMutation.mutate(removeMemberTarget.user_id);
          setRemoveMemberTarget(null);
        }}
        title={t('workspace.remove_member_title', 'Remove member')}
        description={t('workspace.remove_member_desc', { name: removeMemberTarget?.user?.full_name, defaultValue: '"{{name}}" will be removed from the workspace.' })}
        isDeleting={removeMutation.isPending}
      />

      <ConfirmDeleteDialog
        isOpen={!!cancelInvTarget}
        onClose={() => setCancelInvTarget(null)}
        onConfirm={() => {
          cancelInvMutation.mutate(cancelInvTarget.id);
          setCancelInvTarget(null);
        }}
        title={t('workspace.cancel_invite_title', 'Cancel invitation')}
        description={t('workspace.cancel_invite_desc', { email: cancelInvTarget?.email, defaultValue: 'The invitation sent to {{email}} will be cancelled.' })}
        confirmWord="cancel"
        isDeleting={cancelInvMutation.isPending}
      />
    </div>
  );
}
