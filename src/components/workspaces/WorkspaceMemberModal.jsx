import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Mail, Shield, AlertCircle, Loader2 } from 'lucide-react';

import workspaceService from '@/services/workspaceService';
import rbacService from '@/services/rbacService';
import { useActiveWorkspace } from '@/hooks/useActiveWorkspace';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import CustomSelect from '@/components/ui/CustomSelect';

export default function WorkspaceMemberModal({ isOpen, mode, member, onClose }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { activeWorkspaceId } = useActiveWorkspace();

  const [email, setEmail] = useState('');
  const [roleId, setRoleId] = useState('');
  const [error, setError] = useState(null);

  const { data: roles = [], isLoading: isRolesLoading } = useQuery({
    queryKey: ['roles', 'workspace', activeWorkspaceId],
    queryFn: () => rbacService.getRoles('workspace', activeWorkspaceId),
    enabled: !!activeWorkspaceId,
  });

  useEffect(() => {
    if (mode === 'edit' && member) {
      setRoleId(member.role_id || '');
    } else if (roles.length > 0 && !roleId) {
      const viewerRole = roles.find(r => r.name.toLowerCase() === 'viewer') || roles[0];
      setRoleId(viewerRole?.id || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, member, roles]);

  const inviteMutation = useMutation({
    mutationFn: (data) => workspaceService.inviteMember(activeWorkspaceId, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['workspace-members', activeWorkspaceId]);
      queryClient.invalidateQueries(['workspace-invitations', activeWorkspaceId]);
      toast.success(t('workspace.invitation_sent'));
      onClose();
    },
    onError: (err) => setError(err.translatedMessage || t('common.error')),
  });

  const updateMutation = useMutation({
    mutationFn: (data) => workspaceService.updateMember(activeWorkspaceId, member.user_id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['workspace-members', activeWorkspaceId]);
      toast.success(t('workspace.member_updated'));
      onClose();
    },
    onError: (err) => setError(err.translatedMessage || t('common.error')),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);
    if (mode === 'invite') {
      if (!email || !roleId) return setError(t('common.required_fields'));
      inviteMutation.mutate({ email, role_id: roleId });
    } else {
      if (!roleId) return setError(t('common.required_fields'));
      updateMutation.mutate({ role_id: roleId });
    }
  };

  if (!isOpen) return null;

  const isSubmitting = inviteMutation.isPending || updateMutation.isPending;

  return (
    <Modal
      title={mode === 'invite' ? t('workspace.invite_member') : t('workspace.edit_member')}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            form="workspace-member-form"
            disabled={isSubmitting}
            size="sm"
          >
            {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {mode === 'invite' ? t('workspace.send_invite') : t('common.save')}
          </Button>
        </div>
      }
    >
      <form id="workspace-member-form" onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
        {error && (
          <div className="flex items-center gap-2 p-3 text-xs text-[color:var(--color-destructive)] bg-[color:var(--color-destructive)]/10 rounded-lg">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <p className="font-medium">{error}</p>
          </div>
        )}

        {mode === 'invite' ? (
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">{t('common.email')} <span className="text-destructive">*</span></label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="email"
                placeholder="user@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-lg text-[13px] focus:outline-none focus:border-[color:var(--color-ai)] focus:ring-1 focus:ring-[color:var(--color-ai)] transition-all"
                autoFocus
              />
            </div>
          </div>
        ) : (
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">{t('common.user')}</label>
            <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border/50">
              <div className="w-8 h-8 rounded-full bg-[color:var(--color-ai)]/10 text-[color:var(--color-ai)] flex items-center justify-center font-bold text-[11px]">
                {member.user?.full_name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div>
                <p className="font-medium text-foreground text-[13px]">{member.user?.full_name}</p>
                <p className="text-muted-foreground text-[11px]">{member.user?.email}</p>
              </div>
            </div>
          </div>
        )}

        <div>
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">{t('workspace.role')} <span className="text-destructive">*</span></label>
          <CustomSelect
            options={roles.map(r => ({ value: r.id, label: r.name + (r.is_system_default ? ' (Default)' : '') }))}
            value={roleId}
            onChange={setRoleId}
            placeholder={t('common.select')}
            icon={<Shield className="w-4 h-4" />}
            disabled={isRolesLoading}
          />
        </div>
      </form>
    </Modal>
  );
}
