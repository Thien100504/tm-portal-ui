import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Shield,
  Key,
  Plus,
  Check,
  Users,
  Edit2,
  Trash2,
  ToggleLeft,
  Loader2,
  Goal,
  Route,
  BarChart3,
  Workflow,
  Sparkles,
  Clock,
  Calendar,
  ListTodo,
  AlertCircle,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import { Modal } from '@/components/ui/Modal';
import rbacService from '@/services/rbacService';
import workspaceService from '@/services/workspaceService';
import WorkspaceMembers from '@/components/workspaces/WorkspaceMembers';
import { useActiveWorkspace } from '@/hooks/useActiveWorkspace';
import { useAuth } from '@/hooks/useAuth';
import { ConfirmDeleteDialog } from '@/components/ui/ConfirmDeleteDialog';

const FEATURE_FLAGS = [
  {
    key: 'enable_sprint',
    icon: Goal,
    label: 'Sprints',
    desc: 'Enable sprint planning and timeline views',
  },
  {
    key: 'enable_epics',
    icon: Route,
    label: 'Epics & Roadmap',
    desc: 'Enable epics and roadmap planning',
  },
  {
    key: 'enable_story_points',
    icon: BarChart3,
    label: 'Story Points',
    desc: 'Enable story point estimation on tasks',
  },
  {
    key: 'enable_workload',
    icon: Users,
    label: 'Workload',
    desc: 'Enable workload view and capacity planning',
  },
  {
    key: 'enable_automation',
    icon: Workflow,
    label: 'Automation',
    desc: 'Enable workflow automation rules',
  },
  {
    key: 'enable_ai',
    icon: Sparkles,
    label: 'AI Assistant',
    desc: 'Enable AI-powered features and suggestions',
  },
  {
    key: 'enable_time_tracking',
    icon: Clock,
    label: 'Time Tracking',
    desc: 'Enable time tracking on tasks',
  },
  {
    key: 'enable_list_view',
    icon: ListTodo,
    label: 'List View',
    desc: 'Enable list view for tasks',
  },
  {
    key: 'enable_calendar',
    icon: Calendar,
    label: 'Calendar',
    desc: 'Enable calendar view for deadlines',
  },
  {
    key: 'enable_reports',
    icon: BarChart3,
    label: 'Reports',
    desc: 'Enable personal productivity & project health reports tab',
  },
];

export default function WorkspaceSettingsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { activeWorkspaceId, activeWorkspace, settings } = useActiveWorkspace();

  // Guard: only owner or workspace.admin can access
  const { user } = useAuth();
  const isOwner = activeWorkspace?.owner_id === user?.id;
  const { data: wsPerms = [] } = useQuery({
    queryKey: ['rbac', 'ws-permissions', activeWorkspaceId],
    queryFn: () => rbacService.getMyPermissions(null, activeWorkspaceId),
    enabled: !!activeWorkspaceId && !isOwner,
    staleTime: 5 * 60 * 1000,
  });
  const hasAccess = isOwner || user?.system_role === 'admin' || wsPerms.includes('workspace.admin');

  const [activeTab, setActiveTab] = useState('members'); // 'members' | 'roles' | 'features'
  const [roleModal, setRoleModal] = useState({ open: false, mode: 'create', role: null });
  const [deleteRoleTarget, setDeleteRoleTarget] = useState(null);

  // ── Queries ──────────────────────────────────────────────────────────
  const { data: roles = [] } = useQuery({
    queryKey: ['roles', 'workspace', activeWorkspaceId],
    queryFn: () => rbacService.getRoles('workspace', activeWorkspaceId),
    enabled: !!activeWorkspaceId,
  });

  const { data: allPermissions = [] } = useQuery({
    queryKey: ['permissions'],
    queryFn: () => rbacService.getPermissions(),
  });

  const permissions = allPermissions.filter((p) => p.module === 'Workspaces');

  const _groupedPermissions = permissions.reduce((acc, perm) => {
    if (!acc[perm.module]) acc[perm.module] = [];
    acc[perm.module].push(perm);
    return acc;
  }, {});

  // ── Mutations ────────────────────────────────────────────────────────
  const permMutation = useMutation({
    mutationFn: ({ roleId, permissionIds }) =>
      rbacService.updateRolePermissions(roleId, permissionIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles', 'workspace', activeWorkspaceId] });
      toast.success(t('workspace.permissions_updated', { defaultValue: 'Permissions updated' }));
    },
    onError: (err) => {
      toast.error(t('common.error'), { description: err.translatedMessage || '' });
    },
  });

  const deleteRoleMutation = useMutation({
    mutationFn: (roleId) => rbacService.deleteRole(roleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles', 'workspace', activeWorkspaceId] });
      toast.success(t('workspace.role_deleted', { defaultValue: 'Role deleted' }));
    },
    onError: (err) => {
      toast.error(t('common.error'), { description: err.translatedMessage || '' });
    },
  });

  const settingsMutation = useMutation({
    mutationFn: (newSettings) =>
      workspaceService.updateWorkspace(activeWorkspaceId, { settings: newSettings }),
    onMutate: async (newSettings) => {
      await queryClient.cancelQueries({ queryKey: ['workspaces'] });
      const previous = queryClient.getQueryData(['workspaces']);
      queryClient.setQueryData(['workspaces'], (old) =>
        old?.map((ws) => (ws.id === activeWorkspaceId ? { ...ws, settings: newSettings } : ws))
      );
      return { previous };
    },
    onError: (err, _vars, context) => {
      queryClient.setQueryData(['workspaces'], context?.previous);
      toast.error(t('common.error'), { description: err.translatedMessage || '' });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
    },
  });

  // ── Handlers ─────────────────────────────────────────────────────────
  const handleDeleteRole = (roleId) => {
    const role = roles.find((r) => r.id === roleId);
    setDeleteRoleTarget(role || { id: roleId });
  };

  const handleFeatureToggle = (key) => {
    const currentValue = settings?.[key] ?? true;
    const newSettings = { ...settings, [key]: !currentValue };
    settingsMutation.mutate(newSettings);
  };

  if (!hasAccess && wsPerms !== undefined) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Shield className="w-12 h-12 opacity-30 mb-3" />
        <p className="text-sm font-medium">
          {t('workspace.no_access', {
            defaultValue: 'You do not have permission to access workspace settings.',
          })}
        </p>
      </div>
    );
  }

  // ── Tab config ───────────────────────────────────────────────────────
  const tabs = [
    { id: 'members', label: t('workspace.members', { defaultValue: 'Members' }), icon: Users },
    { id: 'roles', label: t('workspace.roles_title', { defaultValue: 'Roles' }), icon: Shield },
    {
      id: 'features',
      label: t('workspace.features_title', { defaultValue: 'Features' }),
      icon: ToggleLeft,
    },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center gap-3.5 mb-6">
        <div className="p-2.5 rounded-xl bg-gradient-to-tr from-[color:var(--color-primary)] to-[color:var(--color-ai)] text-white shadow-md shrink-0">
          <Key className="w-6 h-6" />
        </div>
        <div className="flex flex-col justify-center">
          <h1 className="text-2xl font-bold text-foreground tracking-tight leading-none mb-1.5">
            {t('sidebar.workspaceSettings')}
          </h1>
          <p className="text-sm text-muted-foreground leading-none">
            {t('workspace.settings_desc', {
              defaultValue: 'Manage members, roles, permissions, and features for this workspace.',
            })}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border mb-6">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 rounded-t-lg transition-colors ${
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

      {/* ═══════════════════ Tab: Members ═══════════════════ */}
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        {activeTab === 'members' && <WorkspaceMembers />}

        {/* ═══════════════════ Tab: Roles ═══════════════════ */}
        {activeTab === 'roles' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">
                  {t('workspace.roles_title', { defaultValue: 'Roles' })}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {t('workspace.roles_subtitle', {
                    defaultValue: 'Manage roles and their permissions',
                  })}
                </p>
              </div>
              <button
                onClick={() => setRoleModal({ open: true, mode: 'create', role: null })}
                className="flex items-center gap-2 bg-[color:var(--color-primary)] text-primary-foreground hover:bg-[color:var(--color-primary)]/90 px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4" />
                {t('workspace.new_role', { defaultValue: 'New Role' })}
              </button>
            </div>

            <div className="grid gap-4">
              {roles.map((role) => {
                const isSystem = role.is_system_default;
                const isAdmin = role.name === 'Workspace Admin';
                const rolePerms = role.permissions || [];
                return (
                  <Card key={role.id} className="border border-border shadow-sm overflow-hidden">
                    {/* Role header */}
                    <div className="flex items-center justify-between px-5 py-3.5 bg-muted/30 border-b border-border">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`p-1.5 rounded-lg ${isAdmin ? 'bg-[color:var(--color-ai)]/10' : 'bg-muted/50'}`}
                        >
                          <Shield
                            className={`w-4 h-4 ${isAdmin ? 'text-[color:var(--color-ai)]' : 'text-muted-foreground'}`}
                          />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-foreground">
                            {isSystem
                              ? t(`workspace.roles.${role.name.replace(/\s+/g, '_')}.name`, {
                                  defaultValue: role.name,
                                })
                              : role.name}
                          </h3>
                          {role.description && (
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              {isSystem
                                ? t(`workspace.roles.${role.name.replace(/\s+/g, '_')}.desc`, {
                                    defaultValue: role.description,
                                  })
                                : role.description}
                            </p>
                          )}
                        </div>
                        {isSystem && (
                          <span className="bg-[color:var(--color-primary)]/10 text-[color:var(--color-primary)] text-[9px] uppercase px-1.5 py-0.5 rounded font-bold">
                            {t('workspace.sys_role', { defaultValue: 'System' })}
                          </span>
                        )}
                      </div>
                      {!isSystem && (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setRoleModal({ open: true, mode: 'edit', role })}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-foreground hover:bg-muted rounded-lg transition-colors border border-border/50"
                          >
                            <Edit2 className="w-3 h-3" />{' '}
                            {t('common.edit', { defaultValue: 'Edit' })}
                          </button>
                          <button
                            onClick={() => handleDeleteRole(role.id)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />{' '}
                            {t('common.delete', { defaultValue: 'Delete' })}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Permissions area */}
                    <div className="p-4">
                      <div className="flex flex-col gap-2">
                        {isSystem && (
                          <p className="text-[11px] text-muted-foreground italic mb-1">
                            {isAdmin
                              ? t('workspace.admin_role_fixed', {
                                  defaultValue:
                                    'This role has full access to all workspace features and cannot be modified.',
                                })
                              : t('workspace.system_role_readonly', {
                                  defaultValue: 'This role cannot be modified.',
                                })}
                          </p>
                        )}
                        {rolePerms.length === 0 ? (
                          <p className="text-xs text-muted-foreground italic">
                            {t('workspace.no_permissions_assigned', {
                              defaultValue: 'No permissions assigned.',
                            })}
                          </p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {rolePerms.map((perm) => (
                              <span
                                key={perm.id}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-mono border border-emerald-500/20"
                              >
                                <Check className="w-2.5 h-2.5 stroke-[3]" />
                                {t(`workspace.permission_codes.${perm.code.replace(/\./g, '_')}`, {
                                  defaultValue: perm.description || perm.code,
                                })}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══════════════════ Tab: Features ═══════════════════ */}
        {activeTab === 'features' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                {t('workspace.features_title', { defaultValue: 'Features' })}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t('workspace.features_desc', {
                  defaultValue:
                    'Enable or disable features for this workspace. Changes take effect immediately.',
                })}
              </p>
            </div>

            <div className="grid gap-3">
              {FEATURE_FLAGS.map(({ key, icon: Icon, label, desc }) => (
                <div
                  key={key}
                  className="flex items-center justify-between p-4 rounded-xl border border-border bg-card hover:bg-muted/10 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-muted/50">
                      <Icon className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground text-sm">
                        {t(`workspace.feature_${key}`, { defaultValue: label })}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {t(`workspace.feature_${key}_desc`, { defaultValue: desc })}
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={settings?.[key] ?? true}
                    onCheckedChange={() => handleFeatureToggle(key)}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════ Role Modal ═══════════════════ */}
      {roleModal.open && (
        <RoleModal
          mode={roleModal.mode}
          role={roleModal.role}
          workspaceId={activeWorkspaceId}
          permissions={permissions}
          onClose={() => setRoleModal({ open: false, mode: 'create', role: null })}
        />
      )}

      <ConfirmDeleteDialog
        isOpen={!!deleteRoleTarget}
        onClose={() => setDeleteRoleTarget(null)}
        onConfirm={() => {
          deleteRoleMutation.mutate(deleteRoleTarget.id);
          setDeleteRoleTarget(null);
        }}
        title={t('workspace.delete_role_title', 'Delete role')}
        description={t(
          'workspace.delete_role_desc',
          'This role will be deleted. Members using it will be affected.'
        )}
        isDeleting={deleteRoleMutation.isPending}
      />
    </div>
  );
}

// ── Inline Role Create/Edit Modal ──────────────────────────────────────
function RoleModal({ mode, role, workspaceId, permissions, onClose }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [name, setName] = useState(mode === 'edit' ? role?.name || '' : '');
  const [description, setDescription] = useState(mode === 'edit' ? role?.description || '' : '');
  const [selectedPermIds, setSelectedPermIds] = useState(
    mode === 'edit' && role?.permissions ? role.permissions.map((p) => p.id) : []
  );
  const [error, setError] = useState(null);

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const newRole = await rbacService.createRole(data);
      if (selectedPermIds.length > 0) {
        await rbacService.updateRolePermissions(newRole.id, selectedPermIds);
      }
      return newRole;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles', 'workspace', workspaceId] });
      toast.success(t('workspace.role_created', { defaultValue: 'Role created' }));
      onClose();
    },
    onError: (err) =>
      setError(err.translatedMessage || t('common.error', { defaultValue: 'An error occurred' })),
  });

  const updateMutation = useMutation({
    mutationFn: async (data) => {
      await rbacService.updateRole(role.id, data);
      await rbacService.updateRolePermissions(role.id, selectedPermIds);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles', 'workspace', workspaceId] });
      toast.success(t('workspace.role_updated', { defaultValue: 'Role updated' }));
      onClose();
    },
    onError: (err) =>
      setError(err.translatedMessage || t('common.error', { defaultValue: 'An error occurred' })),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError(t('common.required_fields', { defaultValue: 'Please fill required fields' }));
      return;
    }
    if (mode === 'create') {
      createMutation.mutate({
        name: name.trim(),
        description: description.trim(),
        scope: 'workspace',
        workspace_id: workspaceId,
      });
    } else {
      updateMutation.mutate({ name: name.trim(), description: description.trim() });
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <Modal
      title={
        mode === 'create'
          ? t('workspace.create_role', { defaultValue: 'Create Role' })
          : t('workspace.edit_role', { defaultValue: 'Edit Role' })
      }
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            {t('common.cancel', { defaultValue: 'Cancel' })}
          </Button>
          <Button type="submit" form="role-form" disabled={isSubmitting} size="sm">
            {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {mode === 'create'
              ? t('workspace.btn_create_role', { defaultValue: 'Create Role' })
              : t('common.save', { defaultValue: 'Save' })}
          </Button>
        </div>
      }
    >
      <form id="role-form" onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
        {error && (
          <div className="flex items-center gap-2 p-3 text-xs text-[color:var(--color-destructive)] bg-[color:var(--color-destructive)]/10 rounded-lg">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <p className="font-medium">{error}</p>
          </div>
        )}

        <div>
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
            {t('workspace.role_name', { defaultValue: 'Role Name' })}{' '}
            <span className="text-destructive">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('workspace.role_name_placeholder', {
              defaultValue: 'e.g. Lead Developer',
            })}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[color:var(--color-ai)] focus:ring-1 focus:ring-[color:var(--color-ai)] transition-all"
            autoFocus
          />
        </div>

        <div>
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
            {t('common.description', { defaultValue: 'Description' })}
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('workspace.role_desc_placeholder', {
              defaultValue: 'What can this role do?',
            })}
            rows={3}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[color:var(--color-ai)] focus:ring-1 focus:ring-[color:var(--color-ai)] transition-all resize-none scrollbar-thin"
          />
        </div>

        <div className="pt-2 border-t border-border">
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-2.5">
            {t('workspace.permissions', { defaultValue: 'Permissions' })}
          </label>
          {permissions.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">
              {t('workspace.no_permissions', { defaultValue: 'No workspace permissions found.' })}
            </p>
          ) : (
            <div className="space-y-1 max-h-[200px] overflow-y-auto scrollbar-thin pr-1">
              {permissions.map((perm) => {
                const isSelected = selectedPermIds.includes(perm.id);
                return (
                  <button
                    key={perm.id}
                    type="button"
                    onClick={() =>
                      setSelectedPermIds((prev) =>
                        isSelected ? prev.filter((id) => id !== perm.id) : [...prev, perm.id]
                      )
                    }
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/40 transition-colors text-left group"
                  >
                    <div
                      className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                        isSelected
                          ? 'bg-emerald-500 text-white'
                          : 'border border-border group-hover:border-[color:var(--color-ai)]/50'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-foreground">
                        {t(`workspace.permission_codes.${perm.code.replace(/\./g, '_')}`, {
                          defaultValue: perm.description || perm.code,
                        })}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </form>
    </Modal>
  );
}
