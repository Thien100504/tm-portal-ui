import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Navigate } from 'react-router-dom';
import {
  ShieldAlert, Users, FolderKanban, CheckCircle2,
  Lock, Unlock, Shield, User, Edit2, KeyRound,
  Search, Server, Briefcase, Mail, Loader2, AlertCircle,
} from 'lucide-react';
import { format } from 'date-fns';

import { useAuth } from '@/hooks/useAuth';
import dashboardService from '@/services/dashboardService';
import adminService from '@/services/adminService';
import { Card, MotionCard } from '@/components/ui/Card';
import { Switch } from '@/components/ui/Switch';
import { Badge } from '@/components/ui/Badge';
import CustomSelect from '@/components/ui/CustomSelect';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { toast } from 'sonner';

export default function AdminPage() {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('users');
  const [searchQuery, setSearchQuery] = useState('');
  const [editModal, setEditModal] = useState({ open: false, user: null });


  // ── Queries ────────────────────────────────────────────────────────
  const { data: stats } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: dashboardService.getAdminStats,
    staleTime: 30_000,
    enabled: currentUser?.system_role === 'admin',
  });

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: adminService.listUsers,
    enabled: currentUser?.system_role === 'admin',
  });

  const { data: workspaces = [], isLoading: workspacesLoading } = useQuery({
    queryKey: ['admin', 'workspaces'],
    queryFn: adminService.listWorkspaces,
    enabled: currentUser?.system_role === 'admin' && activeTab === 'workspaces',
  });

  // ── Mutations ──────────────────────────────────────────────────────
  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }) => adminService.updateUserRole(userId, role),
    onSuccess: () => {
      toast.success(t('admin.role_updated_success'));
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
    },
    onError: () => toast.error(t('admin.role_update_failed')),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ userId, isActive }) => adminService.updateUserStatus(userId, isActive),
    onSuccess: (data) => {
      toast.success(data.is_active ? t('admin.user_unblocked_success') : t('admin.user_blocked_success'));
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
    },
    onError: () => toast.error(t('admin.status_update_failed')),
  });

  const handleRoleChange = (userId, newRole) => {
    if (userId === currentUser.id) return toast.error(t('admin.cannot_demote_self'));
    updateRoleMutation.mutate({ userId, role: newRole });
  };

  const handleStatusChange = (userId, currentActive) => {
    if (userId === currentUser.id) return toast.error(t('admin.cannot_block_self'));
    updateStatusMutation.mutate({ userId, isActive: !currentActive });
  };

  const filteredUsers = users.filter(user =>
    user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const tabs = [
    { id: 'users', label: t('admin.tab_users'), icon: Users },
    { id: 'workspaces', label: t('admin.tab_workspaces'), icon: Briefcase },
  ];

  if (currentUser?.system_role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3.5">
        <div className="p-2.5 rounded-xl bg-gradient-to-tr from-[color:var(--color-primary)] to-[color:var(--color-ai)] text-white shadow-md shrink-0">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <div className="flex flex-col justify-center">
          <h1 className="text-2xl font-bold text-foreground tracking-tight leading-none mb-1.5">{t('admin.title')}</h1>
          <p className="text-sm text-muted-foreground leading-none">{t('admin.subtitle')}</p>
        </div>
      </div>

      {/* Compact Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatPill icon={Users} label={t('dashboard.users')} value={stats?.total_users} sub={`${stats?.active_users ?? '—'} active`} color="text-[color:var(--color-primary)]" />
        <StatPill icon={FolderKanban} label={t('dashboard.active_projects')} value={stats?.active_projects} sub={`/ ${stats?.total_projects ?? '—'}`} color="text-[color:var(--color-ai)]" />
        <StatPill icon={CheckCircle2} label={t('dashboard.total_tasks')} value={stats?.total_tasks} sub={`${stats?.done_this_week ?? '—'} done/wk`} color="text-[color:var(--color-success)]" />
        <StatPill icon={Server} label={t('admin.system_status')} value="Online" color="text-emerald-500" />
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

      {/* ═══════════ Tab: Users ═══════════ */}
      <AnimatePresence mode="wait">
        {activeTab === 'users' && (
          <motion.div key="users" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            {/* Search */}
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder={t('admin.search_placeholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-[color:var(--color-ai)] focus:border-[color:var(--color-ai)]"
                />
              </div>
              <span className="text-xs text-muted-foreground">
                {filteredUsers.length} / {users.length} {t('dashboard.users').toLowerCase()}
              </span>
            </div>

            {/* Users Table */}
            <Card className="border border-border overflow-hidden">
              <div className="overflow-x-auto">
                {usersLoading ? (
                  <div className="py-20 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-[color:var(--color-ai)]" /></div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-muted/40 border-b border-border text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        <th className="py-3.5 px-4">{t('admin.column_name')}</th>
                        <th className="py-3.5 px-4">{t('admin.column_role')}</th>
                        <th className="py-3.5 px-4">{t('admin.column_status')}</th>
                        <th className="py-3.5 px-4">{t('admin.column_joined')}</th>
                        <th className="py-3.5 px-4 text-right">{t('admin.column_actions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60 text-xs">
                      {filteredUsers.length > 0 ? filteredUsers.map((userItem) => (
                        <tr key={userItem.id} className="hover:bg-muted/20 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[color:var(--color-primary)]/20 to-[color:var(--color-ai)]/20 flex items-center justify-center font-bold text-xs text-[color:var(--color-ai)]">
                                {userItem.full_name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-semibold text-foreground flex items-center gap-1.5">
                                  {userItem.full_name}
                                  {userItem.id === currentUser.id && (
                                    <Badge variant="glass" className="text-[8px] px-1 py-px bg-[color:var(--color-ai)]/15 text-[color:var(--color-ai)] scale-90">You</Badge>
                                  )}
                                </p>
                                <p className="text-[10px] text-muted-foreground">{userItem.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <CustomSelect
                              options={[
                                { value: 'user', label: 'User', icon: <User className="w-3.5 h-3.5 text-muted-foreground" /> },
                                { value: 'admin', label: 'Admin', icon: <Shield className="w-3.5 h-3.5 text-[color:var(--color-ai)]" /> },
                              ]}
                              value={userItem.system_role}
                              onChange={(val) => handleRoleChange(userItem.id, val)}
                              disabled={userItem.id === currentUser.id || updateRoleMutation.isPending}
                            />
                          </td>
                          <td className="py-3 px-4">
                            {userItem.is_active ? (
                              <Badge variant="success" className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-semibold">
                                <Unlock className="w-2.5 h-2.5" /> Active
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-semibold">
                                <Lock className="w-2.5 h-2.5" /> Blocked
                              </Badge>
                            )}
                          </td>
                          <td className="py-3 px-4 text-muted-foreground/80">
                            {format(new Date(userItem.created_at), 'dd/MM/yyyy')}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-end gap-3">
                              <button
                                onClick={() => setEditModal({ open: true, user: userItem })}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-foreground hover:bg-muted rounded-lg transition-colors border border-border/50"
                              >
                                <Edit2 className="w-3 h-3" /> {t('common.edit', { defaultValue: 'Edit' })}
                              </button>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-muted-foreground">
                                  {userItem.is_active ? 'Block' : 'Unblock'}
                                </span>
                                <Switch
                                  checked={userItem.is_active}
                                  disabled={userItem.id === currentUser.id || updateStatusMutation.isPending}
                                  onCheckedChange={() => handleStatusChange(userItem.id, userItem.is_active)}
                                />
                              </div>
                            </div>
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={5} className="py-12 text-center text-muted-foreground">{t('admin.no_users_found')}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </Card>
          </motion.div>
        )}

        {/* ═══════════ Tab: Workspaces ═══════════ */}
        {activeTab === 'workspaces' && (
          <motion.div key="workspaces" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            {workspacesLoading ? (
              <div className="py-20 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-[color:var(--color-ai)]" /></div>
            ) : workspaces.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {workspaces.map((workspace) => (
                  <MotionCard
                    key={workspace.id}
                    whileHover={{ y: -3 }}
                    className="p-5 border border-border hover:shadow-md transition-shadow relative overflow-hidden group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between mb-3.5">
                        <div className="p-2.5 rounded-xl bg-[color:var(--color-ai)]/10 border border-[color:var(--color-ai)]/20 text-[color:var(--color-ai)] shrink-0">
                          <Briefcase className="w-5 h-5" />
                        </div>
                        <div className="flex gap-2">
                          <Badge variant="outline" className="text-[8px] scale-90 origin-right uppercase">{workspace.type}</Badge>
                        </div>
                      </div>
                      <h4 className="text-sm font-semibold text-foreground group-hover:text-[color:var(--color-ai)] transition-colors line-clamp-1 mb-1">{workspace.name}</h4>
                      <div className="bg-muted/40 p-2.5 rounded-lg border border-border/50 space-y-1 mt-3 mb-4">
                        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Owner</p>
                        <p className="text-xs font-semibold text-card-foreground">{workspace.owner_name}</p>
                        <p className="text-[10px] text-muted-foreground/80 flex items-center gap-1">
                          <Mail className="w-3.5 h-3.5 shrink-0" /> {workspace.owner_email}
                        </p>
                      </div>
                    </div>
                    <div className="pt-3.5 border-t border-border/80 flex justify-between text-xs text-muted-foreground">
                      <div>Prj: <strong className="text-foreground ml-1">{workspace.projects_count}</strong></div>
                      <div>Task: <strong className="text-foreground ml-1">{workspace.tasks_count}</strong></div>
                      <div>Mem: <strong className="text-foreground ml-1">{workspace.members_count}</strong></div>
                      <div className="text-[10px] text-muted-foreground/60">{format(new Date(workspace.created_at), 'dd/MM/yy')}</div>
                    </div>
                  </MotionCard>
                ))}
              </div>
            ) : (
              <Card className="py-20 flex flex-col items-center justify-center border border-border text-muted-foreground">
                <Briefcase className="w-12 h-12 opacity-30 mb-2" />
                <p className="text-xs font-semibold">{t('admin.no_workspaces_found')}</p>
              </Card>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit User Modal */}
      {editModal.open && (
        <EditUserModal
          user={editModal.user}
          currentUserId={currentUser.id}
          onClose={() => setEditModal({ open: false, user: null })}
        />
      )}
    </div>
  );
}

// ── Compact stat pill ─────────────────────────────────────────────────
function StatPill({ icon: Icon, label, value, sub, color }) {
  return (
    <Card className="px-4 py-3 border border-border flex items-center gap-3">
      <div className={`p-2 rounded-lg bg-muted/50 ${color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-lg font-bold text-foreground leading-none">{value ?? '—'}</p>
        <p className="text-[10px] text-muted-foreground mt-1 truncate">
          {label} {sub && <span className="opacity-60">{sub}</span>}
        </p>
      </div>
    </Card>
  );
}

// ── Edit User Modal ───────────────────────────────────────────────────
function EditUserModal({ user, currentUserId, onClose }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState(user.full_name);
  const [email, setEmail] = useState(user.email);
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState(null);

  const profileMutation = useMutation({
    mutationFn: (data) => adminService.updateUserProfile(user.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      toast.success(t('admin.profile_updated', { defaultValue: 'User profile updated' }));
    },
    onError: (err) => setError(err.translatedMessage || t('common.error')),
  });

  const passwordMutation = useMutation({
    mutationFn: (pw) => adminService.resetPassword(user.id, pw),
    onSuccess: () => {
      setNewPassword('');
      toast.success(t('admin.password_reset_success', { defaultValue: 'Password reset successfully' }));
    },
    onError: (err) => setError(err.translatedMessage || t('common.error')),
  });

  const handleSave = async (e) => {
    e.preventDefault();
    setError(null);
    // Validate first so that nothing is saved when the password is rejected
    if (newPassword.length > 0 && newPassword.length < 6) {
      return setError(t('admin.password_too_short', { defaultValue: 'Password must be at least 6 characters' }));
    }
    const updates = {};
    if (fullName !== user.full_name) updates.full_name = fullName;
    if (email !== user.email) updates.email = email;
    try {
      if (Object.keys(updates).length > 0) await profileMutation.mutateAsync(updates);
      if (newPassword) await passwordMutation.mutateAsync(newPassword);
      onClose();
    } catch {
      // the mutation's onError already shows the message in the form
    }
  };

  const isSaving = profileMutation.isPending || passwordMutation.isPending;
  const isSelf = user.id === currentUserId;

  return (
    <Modal
      title={t('admin.edit_user', { defaultValue: 'Edit User' })}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            {t('common.cancel', { defaultValue: 'Cancel' })}
          </Button>
          <Button
            type="submit"
            form="edit-user-form"
            disabled={isSaving}
            size="sm"
          >
            {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {t('common.save', { defaultValue: 'Save' })}
          </Button>
        </div>
      }
    >
      <form id="edit-user-form" onSubmit={handleSave} className="p-5 flex flex-col gap-4">
        {error && (
          <div className="flex items-center gap-2 p-3 text-xs text-[color:var(--color-destructive)] bg-[color:var(--color-destructive)]/10 rounded-lg">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <p className="font-medium">{error}</p>
          </div>
        )}

        {/* User info header */}
        <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border/50">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[color:var(--color-primary)]/20 to-[color:var(--color-ai)]/20 flex items-center justify-center font-bold text-sm text-[color:var(--color-ai)]">
            {user.full_name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-foreground text-[13px] flex items-center gap-2">
              {user.full_name}
              {isSelf && <Badge variant="glass" className="text-[8px] px-1 py-px bg-[color:var(--color-ai)]/15 text-[color:var(--color-ai)]">You</Badge>}
            </p>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Mail className="w-3 h-3" /> {user.email}
            </p>
          </div>
        </div>

        {/* Full name */}
        <div>
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
            {t('admin.field_name', { defaultValue: 'Full Name' })}
          </label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[color:var(--color-ai)] focus:ring-1 focus:ring-[color:var(--color-ai)] transition-all"
          />
        </div>

        {/* Email */}
        <div>
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
            {t('common.email', { defaultValue: 'Email' })}
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-lg text-[13px] focus:outline-none focus:border-[color:var(--color-ai)] focus:ring-1 focus:ring-[color:var(--color-ai)] transition-all"
            />
          </div>
        </div>

        {/* Reset password */}
        <div>
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
            {t('admin.reset_password', { defaultValue: 'Reset Password' })}
            <span className="normal-case tracking-normal font-normal ml-1 opacity-60">({t('common.optional', { defaultValue: 'optional' })})</span>
          </label>
          <div className="relative">
            <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={t('admin.new_password_placeholder', { defaultValue: 'Leave empty to keep current' })}
              className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-lg text-[13px] focus:outline-none focus:border-[color:var(--color-ai)] focus:ring-1 focus:ring-[color:var(--color-ai)] transition-all"
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">{t('admin.password_hint', { defaultValue: 'Minimum 6 characters. Only fill if you want to change.' })}</p>
        </div>
      </form>
    </Modal>
  );
}
