import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Search, Loader2, Shield, User, Code, Bug, Palette } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import userService from '@/services/userService';
import projectService from '@/services/projectService';
import rbacService from '@/services/rbacService';
import { Modal } from '@/components/ui/Modal';
import CustomSelect from '@/components/ui/CustomSelect';

export default function ProjectMembersModal({ project, onClose }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedRoles, setSelectedRoles] = useState({});
  
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 500);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: searchResults = [], isLoading: isSearching } = useQuery({
    queryKey: ['users', 'search', debouncedSearch],
    queryFn: () => userService.searchUsers(debouncedSearch),
    enabled: debouncedSearch.length > 0,
  });

  const { data: members = [], isLoading: isMembersLoading } = useQuery({
    queryKey: ['members', project.id],
    queryFn: () => projectService.getMembers(project.id),
  });

  const { data: roles = [], isLoading: isRolesLoading } = useQuery({
    queryKey: ['roles', 'project'],
    queryFn: () => rbacService.getRoles('project'),
  });

  const viewerRole = roles.find(r => r.name === 'Viewer') || roles[0];
  const defaultRoleId = viewerRole?.id || '';

  const addMutation = useMutation({
    mutationFn: ({ userId, roleId }) => projectService.addMember(project.id, userId, roleId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['members', project.id] });
    }
  });

  const updateMemberMutation = useMutation({
    mutationFn: ({ userId, data }) => projectService.updateMember(project.id, userId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['members', project.id] });
    }
  });

  const existingMemberIds = new Set([project.owner_id, ...members.map(m => m.user_id)]);

  const getRoleIcon = (role) => {
    switch (role) {
      case 'project_manager': return <Shield className="w-4 h-4 text-primary opacity-50" />;
      case 'developer': return <Code className="w-4 h-4 text-blue-500 opacity-50" />;
      case 'tester': return <Bug className="w-4 h-4 text-red-500 opacity-50" />;
      case 'designer': return <Palette className="w-4 h-4 text-pink-500 opacity-50" />;
      default: return <User className="w-4 h-4 text-muted-foreground opacity-50" />;
    }
  };

  const formatRole = (role) => {
    if (!role) return '';
    return role.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  return (
    <Modal title={t('kanban.team')} onClose={onClose}>
        <div className="p-4 flex-1 scrollbar-thin max-h-[65vh]">
          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
            <input
              autoFocus
              type="text"
              placeholder={t('common.search')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-background/50 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-[color:var(--color-ai)] shadow-sm transition-shadow"
            />
          </div>

          {/* Search Results */}
          <AnimatePresence>
            {debouncedSearch.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-6 space-y-2"
              >
                <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t('kanban.search_results')}</h3>
                {isSearching ? (
                  <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-[color:var(--color-ai)]" /></div>
                ) : searchResults.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-2">{t('kanban.no_users_found')}</p>
                ) : (
                  searchResults.map(user => {
                    const isMember = existingMemberIds.has(user.id);
                    return (
                      <div key={user.id} className="flex items-center justify-between p-2 rounded-lg border border-border bg-background/50 shadow-sm hover:border-[color:var(--color-ai-soft)] transition-colors">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary to-ai text-white flex items-center justify-center font-bold text-xs uppercase shadow-sm">
                            {user.full_name?.charAt(0) || 'U'}
                          </div>
                          <div>
                            <p className="text-xs font-semibold">{user.full_name}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">{user.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {!isMember && !isRolesLoading && (
                            <CustomSelect
                              options={roles.map(r => ({ value: r.id, label: r.name }))}
                              value={selectedRoles[user.id] || defaultRoleId}
                              onChange={(val) => setSelectedRoles({ ...selectedRoles, [user.id]: val })}
                            />
                          )}
                          <button
                            disabled={isMember || addMutation.isPending || isRolesLoading}
                            onClick={() => addMutation.mutate({ userId: user.id, roleId: selectedRoles[user.id] || defaultRoleId })}
                            className={`text-[10px] px-2.5 py-1.5 rounded-md font-medium transition-colors disabled:opacity-50 flex items-center gap-1 ${
                              isMember 
                                ? 'bg-muted text-muted-foreground cursor-not-allowed border border-transparent' 
                                : 'bg-[color:var(--color-ai)]/10 text-[color:var(--color-ai)] hover:bg-[color:var(--color-ai)]/20 border border-[color:var(--color-ai)]/20 shadow-sm'
                            }`}
                          >
                            {isMember ? t('kanban.added') : t('common.add')}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Current Members */}
          <div className="space-y-2">
            <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t('kanban.current_members')}</h3>
            
            {isMembersLoading ? (
              <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-[color:var(--color-ai)]" /></div>
            ) : (
              members.map(m => (
                <div key={m.user_id} className="flex flex-col p-3 rounded-lg border border-border bg-card/50 gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center font-bold text-xs uppercase shadow-sm">
                        {m.user?.full_name?.charAt(0) || 'U'}
                      </div>
                      <div>
                        <p className="text-xs font-medium">{m.user?.full_name || t('common.user')}</p>
                        <p className="text-[10px] text-[color:var(--color-ai)] font-mono uppercase tracking-widest mt-0.5">{m.role?.name || formatRole(m.project_role)}</p>
                      </div>
                    </div>
                    {getRoleIcon(m.role?.name?.toLowerCase().replace(' ', '_') || m.project_role)}
                  </div>
                  
                  {/* Topic ID Input */}
                  <div className="flex items-center gap-2 mt-1 pt-2 border-t border-border">
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap font-medium">{t('project.topic_id')}:</span>
                    <input
                      type="text"
                      placeholder="e.g. 15"
                      defaultValue={m.telegram_thread_id || ''}
                      onBlur={(e) => {
                        const val = e.target.value.trim();
                        if (val !== (m.telegram_thread_id || '')) {
                          updateMemberMutation.mutate({ userId: m.user_id, data: { telegram_thread_id: val || null } });
                        }
                      }}
                      className="flex-1 bg-background/50 border border-border rounded px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-ai)] transition-shadow"
                    />
                  </div>
                </div>
              ))
            )}
            
            {members.length === 0 && !isMembersLoading && (
              <div className="flex items-center justify-between p-2 rounded-lg border border-border bg-muted/20">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">O</div>
                  <div>
                    <p className="text-xs font-medium">{t('role.project_owner')}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{t('role.project_manager')}</p>
                  </div>
                </div>
                <Shield className="w-4 h-4 text-primary" />
              </div>
            )}
          </div>

        </div>
    </Modal>
  );
}
