import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Check, Clock, User as UserIcon,
  ChevronDown, SlidersHorizontal, Goal
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function KanbanFilter({ filters, setFilters, members, sprints = [] }) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const PRIORITY_OPTIONS = [
    { value: 'high', label: t('kanban.priority_high'), color: 'text-[color:var(--color-destructive)] bg-[color:var(--color-destructive)]/10' },
    { value: 'medium', label: t('kanban.priority_medium'), color: 'text-[color:var(--color-warning)] bg-[color:var(--color-warning)]/10' },
    { value: 'low', label: t('kanban.priority_low'), color: 'text-[color:var(--color-success)] bg-[color:var(--color-success)]/10' },
  ];

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const togglePriority = (priority) => {
    const current = filters.priorities || [];
    if (current.includes(priority)) {
      setFilters({ ...filters, priorities: current.filter(p => p !== priority) });
    } else {
      setFilters({ ...filters, priorities: [...current, priority] });
    }
  };

  const toggleAssignee = (userId) => {
    const current = filters.assignees || [];
    if (current.includes(userId)) {
      setFilters({ ...filters, assignees: current.filter(id => id !== userId) });
    } else {
      setFilters({ ...filters, assignees: [...current, userId] });
    }
  };

  const setSprint = (sprintId) => {
    // Toggle: clicking the selected sprint again clears the filter
    setFilters({ ...filters, sprint: filters.sprint === sprintId ? null : sprintId });
  };

  const activeFilterCount =
    (filters.search ? 1 : 0) +
    (filters.priorities?.length || 0) +
    (filters.assignees?.length || 0) +
    (filters.isOverdue ? 1 : 0) +
    (filters.sprint ? 1 : 0);

  const clearAll = () => {
    setFilters({ search: '', priorities: [], assignees: [], isOverdue: false, sprint: null });
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 h-auto transition-colors shadow-sm ${
          activeFilterCount > 0 
            ? 'bg-[color:var(--color-ai)]/10 text-[color:var(--color-ai)] border-[color:var(--color-ai)]/30 hover:bg-[color:var(--color-ai)]/20 hover:text-[color:var(--color-ai)]' 
            : 'text-muted-foreground'
        }`}
      >
        <SlidersHorizontal className="w-3.5 h-3.5" />
        <span className="text-xs font-medium">{t('kanban.filter')}</span>
        {activeFilterCount > 0 && (
          <span className="ml-1 w-4 h-4 rounded-full bg-[color:var(--color-ai)] text-primary-foreground flex items-center justify-center text-[9px] font-bold">
            {activeFilterCount}
          </span>
        )}
        <ChevronDown className="w-3.5 h-3.5 opacity-50 ml-0.5" />
      </Button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute right-0 top-full mt-2 w-72 bg-card border border-border shadow-xl rounded-xl z-50 overflow-hidden glass-surface"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/20">
              <span className="text-xs font-semibold uppercase tracking-wider">{t('kanban.filter_title')}</span>
              {activeFilterCount > 0 && (
                <button onClick={clearAll} className="text-[10px] text-muted-foreground hover:text-foreground font-medium hover:underline">
                  {t('kanban.clear_all')}
                </button>
              )}
            </div>

            <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto scrollbar-thin">
              {/* Search */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">{t('kanban.search')}</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder={t('kanban.search_placeholder')}
                    value={filters.search || ''}
                    onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                    className="w-full bg-background border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[color:var(--color-ai)]"
                  />
                  {filters.search && (
                    <button onClick={() => setFilters({ ...filters, search: '' })} className="absolute right-2 top-2 text-muted-foreground hover:text-foreground">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Priorities */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">{t('kanban.priority')}</label>
                <div className="flex flex-wrap gap-1.5">
                  {PRIORITY_OPTIONS.map(p => {
                    const isActive = (filters.priorities || []).includes(p.value);
                    return (
                      <button
                        key={p.value}
                        onClick={() => togglePriority(p.value)}
                        className={`px-2 py-1 rounded-md text-[11px] font-medium transition-all border ${
                          isActive ? `${p.color} border-current ring-1 ring-current` : 'bg-muted/50 text-muted-foreground border-transparent hover:bg-muted'
                        }`}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Assignees */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">{t('kanban.assignee')}</label>
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => toggleAssignee('unassigned')}
                    className={`flex items-center justify-between px-2 py-1.5 rounded-md text-xs transition-colors ${
                      (filters.assignees || []).includes('unassigned') ? 'bg-[color:var(--color-ai)]/10 text-[color:var(--color-ai)] font-medium' : 'hover:bg-muted text-foreground'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full border border-dashed border-muted-foreground/50 flex items-center justify-center">
                        <UserIcon className="w-3 h-3 text-muted-foreground/50" />
                      </div>
                      <span>{t('kanban.unassigned')}</span>
                    </div>
                    {(filters.assignees || []).includes('unassigned') && <Check className="w-3.5 h-3.5" />}
                  </button>
                  
                  {members.map(m => {
                    const isActive = (filters.assignees || []).includes(m.user_id);
                    return (
                      <button
                        key={m.user_id}
                        onClick={() => toggleAssignee(m.user_id)}
                        className={`flex items-center justify-between px-2 py-1.5 rounded-md text-xs transition-colors ${
                          isActive ? 'bg-[color:var(--color-ai)]/10 text-[color:var(--color-ai)] font-medium' : 'hover:bg-muted text-foreground'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-primary to-ai text-[9px] font-bold text-white flex items-center justify-center shadow-sm uppercase">
                            {m.user?.full_name?.charAt(0) || 'U'}
                          </div>
                          <span className="truncate max-w-[150px]">{m.user?.full_name || m.user?.email}</span>
                        </div>
                        {isActive && <Check className="w-3.5 h-3.5" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sprint filter — only shown when the project has sprints */}
              {sprints.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                    <Goal className="w-3 h-3" /> Sprint
                  </label>
                  <div className="flex flex-col gap-1">
                    {/* Backlog option */}
                    <button
                      onClick={() => setSprint('__backlog__')}
                      className={`flex items-center justify-between px-2 py-1.5 rounded-md text-xs transition-colors ${
                        filters.sprint === '__backlog__'
                          ? 'bg-[color:var(--color-ai)]/10 text-[color:var(--color-ai)] font-medium'
                          : 'hover:bg-muted text-foreground'
                      }`}
                    >
                      <span>{t('kanban.backlog_filter')}</span>
                      {filters.sprint === '__backlog__' && <Check className="w-3.5 h-3.5 shrink-0" />}
                    </button>
                    {/* Sprint rows */}
                    {sprints.map(s => (
                      <button
                        key={s.id}
                        onClick={() => setSprint(s.id)}
                        className={`flex items-center justify-between px-2 py-1.5 rounded-md text-xs transition-colors ${
                          filters.sprint === s.id
                            ? 'bg-[color:var(--color-ai)]/10 text-[color:var(--color-ai)] font-medium'
                            : 'hover:bg-muted text-foreground'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="truncate">{s.name}</span>
                          {s.status === 'active' && (
                            <span className="shrink-0 text-[9px] bg-[color:var(--color-success)]/15 text-[color:var(--color-success)] px-1 py-px rounded-sm font-mono uppercase">
                              {t('common.active')}
                            </span>
                          )}
                        </div>
                        {filters.sprint === s.id && <Check className="w-3.5 h-3.5 shrink-0" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Deadline */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">{t('kanban.deadline')}</label>
                <button
                  onClick={() => setFilters({ ...filters, isOverdue: !filters.isOverdue })}
                  className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs transition-colors ${
                    filters.isOverdue ? 'bg-[color:var(--color-destructive)]/10 text-[color:var(--color-destructive)] font-medium' : 'hover:bg-muted text-foreground'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Clock className={`w-3.5 h-3.5 ${filters.isOverdue ? 'text-[color:var(--color-destructive)]' : 'text-muted-foreground'}`} />
                    <span>{t('kanban.overdue')}</span>
                  </div>
                  {filters.isOverdue && <Check className="w-3.5 h-3.5" />}
                </button>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
