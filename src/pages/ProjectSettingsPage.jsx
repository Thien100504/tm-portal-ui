import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Users, Settings, Shield, Plus, Search, Mail, Trash2, Loader2,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

import projectService from '@/services/projectService';
import userService from '@/services/userService';
import rbacService from '@/services/rbacService';
import { useAuth } from '@/hooks/useAuth';
import { useProjectPermissions } from '@/hooks/useProjectPermissions';

import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import CustomSelect from '@/components/ui/CustomSelect';
import { ConfirmDeleteDialog } from '@/components/ui/ConfirmDeleteDialog';

export default function ProjectSettingsPage() {
  const { t } = useTranslation();
  const { id: projectId } = useParams();
  const { user: currentUser } = useAuth();
  const { can } = useProjectPermissions(projectId);
  const [activeTab, setActiveTab] = useState('members');

  const { data: project } = useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => projectService.getProject(projectId),
    enabled: !!projectId,
  });

  const isOwner = project?.owner_id === currentUser?.id;
  const isPM = isOwner || currentUser?.system_role === 'admin' || can('project.settings');

  if (!isPM) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Shield className="w-12 h-12 opacity-30 mb-3" />
        <p className="text-sm font-medium">{t('project.no_settings_access', { defaultValue: 'You do not have permission to access project settings.' })}</p>
      </div>
    );
  }

  const tabs = [
    { id: 'members', label: t('workspace.members', { defaultValue: 'Members' }), icon: Users },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="px-5 pt-6 pb-2">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[color:var(--color-ai)]/10 border border-[color:var(--color-ai)]/20 text-[color:var(--color-ai)]">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">
              {t('project.settings_title', { defaultValue: 'Project Settings' })}
            </h1>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              {project?.name || t('common.loading')}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-[color:var(--color-primary)] text-[color:var(--color-primary)]'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'members' && (
        <ProjectMembersTab projectId={projectId} project={project} currentUser={currentUser} isPM={isPM} />
      )}
    </div>
  );
}


// ── Members Tab ────────────────────────────────────────────────────────
function ProjectMembersTab({ projectId, project, currentUser, isPM }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [removeTarget, setRemoveTarget] = useState(null);

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['members', projectId],
    queryFn: () => projectService.getMembers(projectId),
    enabled: !!projectId,
  });

  const { data: roles = [] } = useQuery({
    queryKey: ['roles', 'project'],
    queryFn: () => rbacService.getRoles('project'),
  });

  const { data: searchResults = [] } = useQuery({
    queryKey: ['users', 'search', debouncedSearch],
    queryFn: () => userService.searchUsers(debouncedSearch),
    enabled: debouncedSearch.length > 1,
  });

  const memberIds = new Set([project?.owner_id, ...members.map(m => m.user_id)]);
  const defaultRoleId = roles.find(r => r.name === 'Member')?.id || roles[0]?.id || '';

  const addMutation = useMutation({
    mutationFn: ({ userId, roleId }) => projectService.addMember(projectId, userId, roleId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['members', projectId] });
      toast.success(t('project.member_added', { defaultValue: 'Member added' }));
      setSearch(''); setDebouncedSearch('');
    },
    onError: (err) => toast.error(t('common.error'), { description: err.translatedMessage || '' }),
  });

  const removeMutation = useMutation({
    mutationFn: (userId) => projectService.removeMember(projectId, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['members', projectId] });
      toast.success(t('project.member_removed', { defaultValue: 'Member removed' }));
    },
    onError: (err) => toast.error(t('common.error'), { description: err.translatedMessage || '' }),
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, roleId }) => projectService.updateMember(projectId, userId, { role_id: roleId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['members', projectId] });
      toast.success(t('project.role_updated', { defaultValue: 'Role updated' }));
    },
  });

  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    clearTimeout(window._projMemberSearchTimer);
    window._projMemberSearchTimer = setTimeout(() => setDebouncedSearch(e.target.value), 400);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{t('project.members_title', { defaultValue: 'Members' })}</h2>
          <p className="text-sm text-muted-foreground">{t('project.members_desc', { defaultValue: 'Manage who has access to this project and their roles.' })}</p>
        </div>
        <Badge variant="secondary" className="text-[10px] px-2 py-0.5 rounded-full font-mono">{members.length}</Badge>
      </div>

      {/* Add member search */}
      {isPM && (
        <Card className="p-4 border border-border">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder={t('project.search_add', { defaultValue: 'Search user by name or email to add...' })}
              value={search}
              onChange={handleSearchChange}
              className="w-full pl-9 pr-3 py-2 text-[13px] bg-background border border-border rounded-lg focus:outline-none focus:border-[color:var(--color-ai)] focus:ring-1 focus:ring-[color:var(--color-ai)] transition-all"
            />
          </div>
          {debouncedSearch.length > 1 && searchResults.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {searchResults.filter(u => !memberIds.has(u.id)).slice(0, 5).map(user => (
                <div key={user.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-muted/20 border border-border/50 hover:border-[color:var(--color-ai)]/30 transition-colors">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-[color:var(--color-ai)]/10 text-[color:var(--color-ai)] flex items-center justify-center font-bold text-[11px]">
                      {user.full_name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <div>
                      <p className="text-[12px] font-medium text-foreground">{user.full_name}</p>
                      <p className="text-[10px] text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                  <Button size="xs" onClick={() => addMutation.mutate({ userId: user.id, roleId: defaultRoleId })} disabled={addMutation.isPending}>
                    <Plus className="w-3 h-3" /> {t('common.add', { defaultValue: 'Add' })}
                  </Button>
                </div>
              ))}
              {searchResults.filter(u => !memberIds.has(u.id)).length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-2">{t('project.all_already_members', { defaultValue: 'All results are already members' })}</p>
              )}
            </div>
          )}
        </Card>
      )}

      {/* Members table */}
      <Card className="border border-border overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="py-12 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-[color:var(--color-ai)]" /></div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="p-4 font-semibold text-muted-foreground">{t('common.user', { defaultValue: 'User' })}</th>
                <th className="p-4 font-semibold text-muted-foreground">{t('workspace.role', { defaultValue: 'Role' })}</th>
                <th className="p-4 font-semibold text-muted-foreground">{t('common.joined', { defaultValue: 'Joined' })}</th>
                <th className="p-4 font-semibold text-muted-foreground w-[60px]"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {members.map(member => {
                const isMemberOwner = member.user_id === project?.owner_id;
                const isSelf = member.user_id === currentUser?.id;

                return (
                  <tr key={member.user_id} className="hover:bg-muted/10 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[color:var(--color-primary)]/20 to-[color:var(--color-ai)]/20 text-[color:var(--color-ai)] flex items-center justify-center font-bold text-[11px]">
                          {member.user?.full_name?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div>
                          <p className="font-medium text-foreground text-[13px] flex items-center gap-1.5">
                            {member.user?.full_name}
                            {isMemberOwner && <Badge variant="glass" className="text-[8px] px-1 py-px bg-[color:var(--color-ai)]/10 text-[color:var(--color-ai)]">Owner</Badge>}
                            {isSelf && !isMemberOwner && <Badge variant="outline" className="text-[8px] px-1 py-px">You</Badge>}
                          </p>
                          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <Mail className="w-3 h-3" /> {member.user?.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      {isPM && !isMemberOwner ? (
                        <CustomSelect
                          options={roles.map(r => ({ value: r.id, label: r.name }))}
                          value={member.role_id || ''}
                          onChange={(val) => updateRoleMutation.mutate({ userId: member.user_id, roleId: val })}
                        />
                      ) : (
                        <Badge variant="outline" className="text-[10px] px-2 py-0.5 capitalize">
                          {member.role?.name || member.project_role}
                        </Badge>
                      )}
                    </td>
                    <td className="p-4 text-muted-foreground text-xs">
                      {member.joined_at ? format(new Date(member.joined_at), 'dd/MM/yyyy') : '-'}
                    </td>
                    <td className="p-4 text-right">
                      {isPM && !isMemberOwner && !isSelf && (
                        <button
                          onClick={() => setRemoveTarget(member)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded-lg transition-all border border-transparent hover:border-rose-500/20 shadow-sm opacity-60 hover:opacity-100"
                        >
                          <Trash2 className="w-3 h-3" />
                          {t('common.remove', { defaultValue: 'Remove' })}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {members.length === 0 && (
                <tr><td colSpan={4} className="p-10 text-center text-muted-foreground text-xs">{t('project.no_members', { defaultValue: 'No members' })}</td></tr>
              )}
            </tbody>
          </table>
        )}
      </Card>

      <ConfirmDeleteDialog
        isOpen={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        onConfirm={() => { removeMutation.mutate(removeTarget.user_id); setRemoveTarget(null); }}
        title={t('project.remove_member', { defaultValue: 'Remove member' })}
        description={t('project.remove_member_confirm', { name: removeTarget?.user?.full_name, defaultValue: `${removeTarget?.user?.full_name} will be removed from the project and cannot access tasks anymore.` })}
        isDeleting={removeMutation.isPending}
      />
    </div>
  );
}
