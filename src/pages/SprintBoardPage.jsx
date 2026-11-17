import { useTranslation } from 'react-i18next';
import DatePicker from '@/components/ui/DatePicker';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import {
  Goal, Plus, Clock, Play, Square, BarChart2,
  User as UserIcon, Loader2, Pencil, Check,
  Inbox, Calendar, GripVertical,
  ChevronRight, ChevronDown,
} from 'lucide-react';
import sprintService from '@/services/sprintService';
import taskService from '@/services/taskService';
import projectService from '@/services/projectService';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useProjectPermissions } from '@/hooks/useProjectPermissions';
import BurndownChartModal from '@/components/BurndownChartModal';
import EndSprintModal from '@/components/EndSprintModal';
import CreateTaskModal from '@/components/CreateTaskModal';
import TaskDetailModal from '@/components/TaskDetailModal';
import { toast } from 'sonner';
import { getApiError } from '@/lib/apiError';
import BulkActionBar from '@/components/BulkActionBar';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { StatusBadge } from '@/components/ui/StatusBadge';

// ── Priority dot config ────────────────────────────────────────────────
const PRIORITY_DOT = {
  high:   'bg-[color:var(--color-destructive)]',
  medium: 'bg-[color:var(--color-warning)]',
  low:    'bg-[color:var(--color-success)]',
};

// Left-border accent for subtask rows (mirrors parent priority)
const PRIORITY_ACCENT = {
  high:   'border-l-2 border-l-[color:var(--color-destructive)]/50',
  medium: 'border-l-2 border-l-[color:var(--color-warning)]/50',
  low:    'border-l-2 border-l-[color:var(--color-success)]/50',
};

const _SPRINT_STATUS_CLASS = {
  planning:  'bg-muted text-muted-foreground',
  active:    'bg-[color:var(--color-success)]/15 text-[color:var(--color-success)]',
  completed: 'bg-[color:var(--color-ai)]/10 text-[color:var(--color-ai)]',
};

const _SPRINT_STATUS_KEY = {
  planning:  'sprintBoard.status.planning',
  active:    'sprintBoard.status.active',
  completed: 'sprintBoard.status.completed',
};

// ── Compact task row ───────────────────────────────────────────────────
// Column layout (all shrink-0 except title):
//   [drag 3.5] [toggle/chevron/spacer 3.5] [dot 2] [title flex-1] [deadline 16] [who 6] [status 20]
function TaskRow({
  task, index, membersMap,
  isSubtask = false,
  hasChildren = false,
  isChildrenCollapsed = false,
  onToggleCollapse,
  onOpen,
  parentPriority,
  isSelected = false,
  onToggleSelect,
  t,
}) {
  const assignee = membersMap?.[task.assignee_id];
  const assigneeName = assignee?.full_name || assignee?.email;
  const isOverdue = task.deadline && new Date(task.deadline) < new Date() && task.status !== 'done';

  const _handleClick = (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      e.stopPropagation();
      onToggleSelect?.();
    } else if (!e.currentTarget.closest('[data-drag-handle]')) {
      // normal click — open detail
    }
  };

  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          onClick={(e) => {
            if (e.ctrlKey || e.metaKey) { e.preventDefault(); onToggleSelect?.(); }
            else if (!snapshot.isDragging) { onOpen?.(task); }
          }}
          className={`flex items-center gap-2 px-3 cursor-pointer select-none transition-colors
            ${isSubtask
              ? `py-2 border-t border-border/40 hover:bg-muted/50
                 ${isSelected ? 'bg-[color:var(--color-ai)]/10' : 'bg-muted/30'}
                 ${PRIORITY_ACCENT[parentPriority] ?? 'border-l-2 border-l-border/30'}`
              : `py-3 hover:bg-muted/20 ${isSelected ? 'bg-[color:var(--color-ai)]/8' : 'bg-transparent'}`
            }
            ${snapshot.isDragging ? 'shadow-xl ring-1 ring-[color:var(--color-ai)] rounded-xl bg-card z-50' : ''}
          `}
        >
          {/* Drag handle / selection indicator */}
          <div
            {...provided.dragHandleProps}
            onClick={e => e.stopPropagation()}
            className={`shrink-0 cursor-grab active:cursor-grabbing transition-colors
              ${isSelected ? 'text-[color:var(--color-ai)]' : 'text-muted-foreground/25 hover:text-muted-foreground'}
            `}
          >
            {isSelected
              ? <Check className="w-3.5 h-3.5" />
              : <GripVertical className="w-3.5 h-3.5" />
            }
          </div>

          {/* Collapse toggle | subtask chevron | leaf spacer */}
          {hasChildren ? (
            <button
              onClick={e => { e.stopPropagation(); onToggleCollapse?.(); }}
              className="shrink-0 w-3.5 h-3.5 flex items-center justify-center text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            >
              {isChildrenCollapsed
                ? <ChevronRight className="w-3.5 h-3.5" />
                : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          ) : isSubtask ? (
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30 shrink-0" />
          ) : (
            <div className="w-3.5 shrink-0" />
          )}

          {/* Priority dot */}
          <div className={`w-2 h-2 rounded-full shrink-0 ${PRIORITY_DOT[task.priority] || 'bg-muted-foreground/30'}`} />

          {/* Title */}
          <span className={`flex-1 min-w-0 truncate
            ${isSubtask ? 'text-[11px] font-normal text-muted-foreground' : 'text-[12px] font-medium text-foreground'}
            ${task.status === 'done' ? 'line-through opacity-40' : ''}
          `}>
            {task.title}
          </span>

          {/* Deadline */}
          <span className={`shrink-0 w-16 text-right text-[10px] font-mono flex items-center justify-end gap-1
            ${!task.deadline ? 'invisible' : isOverdue ? 'text-[color:var(--color-destructive)]' : 'text-muted-foreground/60'}
          `}>
            <Clock className="w-3 h-3" />
            {task.deadline ? format(new Date(task.deadline), 'dd/MM', { locale: vi }) : '—'}
          </span>

          {/* Assignee */}
          {assigneeName ? (
            <div
              className="w-6 h-6 rounded-full bg-gradient-to-tr from-primary to-ai text-[9px] font-bold text-white flex items-center justify-center shadow-sm shrink-0"
              title={assigneeName}
            >
              {assigneeName.charAt(0).toUpperCase()}
            </div>
          ) : (
            <div className="w-6 h-6 rounded-full bg-background border border-dashed border-border flex items-center justify-center shrink-0" title={t('sprintBoard.unassigned')}>
              <UserIcon className="w-3 h-3 text-muted-foreground/30" />
            </div>
          )}

          {/* Status */}
          <StatusBadge type="task" status={task.status} className="w-20 justify-center border-none" />
        </div>
      )}
    </Draggable>
  );
}

// ── Column header (mirrors TaskRow column widths exactly) ──────────────
function TaskListHeader({ t }) {
  return (
    <div className="flex items-center gap-2 px-4 py-1 mb-1.5">
      <div className="w-3.5 shrink-0" />
      <div className="w-3.5 shrink-0" />
      <div className="w-2 shrink-0" />
      <span className="flex-1 text-[10px] font-mono text-muted-foreground uppercase tracking-widest">{t('sprintBoard.headers.task')}</span>
      <span className="w-16 text-right text-[10px] font-mono text-muted-foreground uppercase tracking-widest hidden sm:block">{t('sprintBoard.headers.deadline')}</span>
      <span className="w-6 text-center text-[10px] font-mono text-muted-foreground uppercase tracking-widest">{t('sprintBoard.headers.who')}</span>
      <span className="w-20 text-center text-[10px] font-mono text-muted-foreground uppercase tracking-widest">{t('sprintBoard.headers.status')}</span>
    </div>
  );
}

// ── Task list: parents grouped with their subtasks ─────────────────────
// Visual: parent = full row; subtasks = smaller rows inside a card border,
// with a left accent bar matching the parent's priority color.
// DnD: flat sequential indices are preserved via indexMap.
function SprintTaskList({ tasks, allTasks, membersMap, onOpen, selectedIds, onToggleSelect, t }) {
  const [collapsed, setCollapsed] = useState({});

  const parents = useMemo(() => tasks.filter(t => !t.parent_task_id), [tasks]);

  const childrenMap = useMemo(() => {
    const map = {};
    tasks.filter(t => t.parent_task_id).forEach(t => {
      if (!map[t.parent_task_id]) map[t.parent_task_id] = [];
      map[t.parent_task_id].push(t);
    });
    return map;
  }, [tasks]);

  const parentIds = useMemo(() => new Set(parents.map(p => p.id)), [parents]);
  const orphaned = useMemo(
    () => tasks.filter(t => t.parent_task_id && !parentIds.has(t.parent_task_id)),
    [tasks, parentIds],
  );

  const orphanedGroups = useMemo(() => {
    const groups = [];
    const map = {};
    orphaned.forEach(t => {
      if (!map[t.parent_task_id]) {
        map[t.parent_task_id] = [];
        groups.push({ parentId: t.parent_task_id, children: map[t.parent_task_id] });
      }
      map[t.parent_task_id].push(t);
    });
    return groups;
  }, [orphaned]);

  // Flat id-list → index map for DnD (must be sequential 0,1,2…)
  const indexMap = useMemo(() => {
    const ids = [];
    parents.forEach(p => {
      ids.push(p.id);
      if (!collapsed[p.id]) (childrenMap[p.id] || []).forEach(c => ids.push(c.id));
    });
    orphanedGroups.forEach(g => {
      g.children.forEach(c => ids.push(c.id));
    });
    const map = {};
    ids.forEach((id, i) => { map[id] = i; });
    return map;
  }, [parents, childrenMap, orphanedGroups, collapsed]);

  return (
    <>
      {parents.map(parent => {
        const children = childrenMap[parent.id] || [];
        const hasChildren = children.length > 0;
        const isCollapsed = !!collapsed[parent.id];
        const visibleChildren = isCollapsed ? [] : children;

        return (
          // Group card: A distinct bounded box for parent + its subtasks
          <div
            key={parent.id}
            className="mb-2.5 rounded-xl overflow-hidden border border-border/60 shadow-sm bg-card hover:shadow-md transition-shadow"
          >
            {/* Parent row */}
            <TaskRow
              task={parent}
              index={indexMap[parent.id]}
              membersMap={membersMap}
              isSubtask={false}
              hasChildren={hasChildren}
              isChildrenCollapsed={isCollapsed}
              onToggleCollapse={() => setCollapsed(c => ({ ...c, [parent.id]: !c[parent.id] }))}
              onOpen={onOpen}
              isSelected={selectedIds?.has(parent.id)}
              onToggleSelect={() => onToggleSelect?.(parent.id)}
              t={t}
            />

            {/* Collapsed hint */}
            {hasChildren && isCollapsed && (
              <div className="px-10 py-1 bg-muted/20 border-t border-border/30">
                <span className="text-[10px] font-mono text-muted-foreground/50">
                  {t('sprintBoard.hidden_subtasks', { count: children.length })}
                </span>
              </div>
            )}

            {/* Subtask rows — visually nested inside the group card */}
            {visibleChildren.map(child => (
              <TaskRow
                key={child.id}
                task={child}
                index={indexMap[child.id]}
                membersMap={membersMap}
                isSubtask={true}
                hasChildren={false}
                onOpen={onOpen}
                parentPriority={parent.priority}
                isSelected={selectedIds?.has(child.id)}
                onToggleSelect={() => onToggleSelect?.(child.id)}
                t={t}
              />
            ))}
          </div>
        );
      })}

      {/* Orphaned subtasks: parent is in another sprint/backlog */}
      {orphanedGroups.map(group => {
        const parentTask = allTasks?.find(t => t.id === group.parentId);
        return (
          <div
            key={`orphaned-group-${group.parentId}`}
            className="mb-2.5 rounded-xl overflow-hidden border border-border/60 shadow-sm bg-card hover:shadow-md transition-shadow"
          >
            {parentTask && (
              <div className="bg-muted/30 border-b border-border/40 px-3 py-1 flex items-center">
                <span className="text-[10px] font-semibold text-muted-foreground truncate w-full">
                  {parentTask.title}
                </span>
              </div>
            )}
            {group.children.map(task => (
              <TaskRow
                key={task.id}
                task={task}
                index={indexMap[task.id]}
                membersMap={membersMap}
                isSubtask={true}
                parentPriority={parentTask?.priority}
                hasChildren={false}
                onOpen={onOpen}
                isSelected={selectedIds?.has(task.id)}
                onToggleSelect={() => onToggleSelect?.(task.id)}
                t={t}
              />
            ))}
          </div>
        );
      })}
    </>
  );
}

// ── Edit sprint inline form ────────────────────────────────────────────
function EditSprintForm({ sprint, onSave, onCancel, t }) {
  const [form, setForm] = useState({
    name:       sprint.name,
    goal:       sprint.goal || '',
    start_date: sprint.start_date || '',
    end_date:   sprint.end_date || '',
  });

  return (
    <div className="px-4 py-3 space-y-2.5">
      <div className="flex gap-2">
        <input
          autoFocus
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          placeholder={t('sprintBoard.form.name_placeholder')}
          className="flex-1 bg-background border border-border rounded-md px-3 py-1.5 text-sm outline-none focus:border-[color:var(--color-ai)]"
        />
        <input
          value={form.goal}
          onChange={e => setForm(f => ({ ...f, goal: e.target.value }))}
          placeholder={t('sprintBoard.form.goal_placeholder')}
          className="flex-1 bg-background border border-border rounded-md px-3 py-1.5 text-sm outline-none focus:border-[color:var(--color-ai)]"
        />
      </div>
      <div className="flex gap-2 items-center">
        <div className="flex items-center gap-1.5">
          <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest shrink-0">{t('sprintBoard.form.plan')}</label>
          <DatePicker size="sm" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
          <span className="text-muted-foreground text-xs">→</span>
          <DatePicker size="sm" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
        </div>
        <div className="flex gap-1.5 ml-auto">
          <Button size="sm" onClick={() => onSave({ name: form.name.trim(), goal: form.goal.trim() || null, start_date: form.start_date || null, end_date: form.end_date || null })}
            disabled={!form.name.trim()}
            className="flex items-center gap-1"
          >
            <Check className="w-3.5 h-3.5" /> {t('sprintBoard.form.save')}
          </Button>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            {t('sprintBoard.form.cancel')}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────
export default function SprintBoardPage() {
  const { t } = useTranslation();
  const { id: projectId } = useParams();
  const qc = useQueryClient();
  const { can } = useProjectPermissions(projectId);

  const [isCreating, setIsCreating] = useState(false);
  const [newSprintName, setNewSprintName] = useState('');
  const [editingSprintId, setEditingSprintId] = useState(null);
  const [endingSprintId, setEndingSprintId] = useState(null);
  const [chartSprint, setChartSprint] = useState(null);
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [sprintCollapsed, setSprintCollapsed] = useState({});

  // ── Multi-select ───────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState(new Set());

  const toggleSelect = useCallback((id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') clearSelection(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [clearSelection]);

  const { isConnected } = useWebSocket(projectId);

  // ── Queries ────────────────────────────────────────────────────────
  const { data: sprints = [], isLoading: isLoadingSprints } = useQuery({
    queryKey: ['sprints', projectId],
    queryFn: () => sprintService.getSprints(projectId),
    enabled: !!projectId,
  });

  const { data: tasks = [], isLoading: isLoadingTasks } = useQuery({
    queryKey: ['tasks', projectId],
    queryFn: () => taskService.getTasks(projectId),
    enabled: !!projectId,
    refetchInterval: isConnected ? false : 15_000,
  });

  const { data: members = [] } = useQuery({
    queryKey: ['members', projectId],
    queryFn: () => projectService.getMembers(projectId),
    enabled: !!projectId,
  });

  const membersMap = useMemo(
    () => Object.fromEntries(members.map(m => [m.user_id, m.user])),
    [members],
  );

  // ── Mutations ──────────────────────────────────────────────────────
  const createSprintMutation = useMutation({
    onError: (err) => toast.error(t('common.error'), { description: getApiError(err, t('common.error')) }),
    mutationFn: (name) => sprintService.createSprint(projectId, { name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sprints', projectId] });
      setIsCreating(false);
      setNewSprintName('');
      toast.success(t('sprintBoard.create_success'));
    },
  });

  const updateSprintMutation = useMutation({
    onError: (err) => toast.error(t('common.error'), { description: getApiError(err, t('common.error')) }),
    mutationFn: ({ sprintId, data }) => sprintService.updateSprint(sprintId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sprints', projectId] });
      setEditingSprintId(null);
      toast.success(t('sprintBoard.update_success'));
    },
  });

  const startSprintMutation = useMutation({
    mutationFn: (sprintId) => sprintService.startSprint(sprintId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sprints', projectId] });
      toast.success(t('sprintBoard.start_success'));
    },
    onError: (err) => {
      const rawDetail = err.response?.data?.detail;
      toast.error(t('common.error'), {
        description: rawDetail === 'sprint.error_already_active'
          ? t('sprintBoard.already_active')
          : getApiError(err, t('common.error')),
      });
    },
  });

  const reopenSprintMutation = useMutation({
    mutationFn: (sprintId) => sprintService.reopenSprint(sprintId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sprints', projectId] });
      toast.success(t('sprintBoard.reopen_success'));
    },
    onError: (err) => {
      const rawDetail = err.response?.data?.detail;
      toast.error(t('common.error'), {
        description: rawDetail === 'sprint.error_already_active'
          ? t('sprintBoard.reopen_error')
          : getApiError(err, t('common.error')),
      });
    },
  });

  const moveTaskMutation = useMutation({
    mutationFn: ({ taskId, sprintId }) => taskService.updateTask(taskId, { sprint_id: sprintId }),
    onMutate: async ({ taskId, sprintId }) => {
      await qc.cancelQueries({ queryKey: ['tasks', projectId] });
      const previousTasks = qc.getQueryData(['tasks', projectId]);
      qc.setQueryData(['tasks', projectId], (old = []) =>
        old.map(t => {
          if (t.id === taskId) return { ...t, sprint_id: sprintId };
          if (t.parent_task_id === taskId) return { ...t, sprint_id: sprintId };
          return t;
        }),
      );
      return { previousTasks };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousTasks) qc.setQueryData(['tasks', projectId], context.previousTasks);
      toast.error(t('common.error'), { description: t('sprintBoard.move_error') });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['tasks', projectId] }),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids) => Promise.all([...ids].map(id => taskService.deleteTask(id))),
    onMutate: async (ids) => {
      await qc.cancelQueries({ queryKey: ['tasks', projectId] });
      const previous = qc.getQueryData(['tasks', projectId]);
      qc.setQueryData(['tasks', projectId], (old = []) => old.filter(t => !ids.has(t.id)));
      return { previous };
    },
    onError: (_, __, context) => {
      if (context?.previous) qc.setQueryData(['tasks', projectId], context.previous);
      toast.error(t('common.error'), { description: t('sprintBoard.delete_error') });
    },
    onSuccess: (_, ids) => {
      toast.success(t('sprintBoard.delete_tasks_success', { count: ids.size }));
      clearSelection();
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['tasks', projectId] }),
  });

  // ── Drag & drop ────────────────────────────────────────────────────
  const onDragEnd = ({ destination, source, draggableId }) => {
    if (!destination || destination.droppableId === source.droppableId) return;
    const newSprintId = destination.droppableId === 'backlog' ? null : destination.droppableId;
    
    if (selectedIds?.has(draggableId) && selectedIds.size > 1) {
      // Bulk move all selected tasks
      [...selectedIds].forEach(id => {
        moveTaskMutation.mutate({ taskId: id, sprintId: newSprintId });
      });
      clearSelection();
    } else {
      // Single task move
      moveTaskMutation.mutate({ taskId: draggableId, sprintId: newSprintId });
      if (selectedIds?.has(draggableId)) clearSelection();
    }
  };

  // ── Helpers ────────────────────────────────────────────────────────
  const getSprintTasks = (sprintId) => tasks.filter(t => t.sprint_id === sprintId);
  const backlogTasks = useMemo(() => tasks.filter(t => !t.sprint_id && t.status !== 'done'), [tasks]);

  const endingSprint = endingSprintId ? sprints.find(s => s.id === endingSprintId) : null;

  if (!projectId) return <div className="p-6 text-muted-foreground">{t('sprintBoard.no_project')}</div>;

  return (
    <div className="flex flex-col h-[calc(100vh-var(--layout-offset))]">

      {/* ── Page header ───────────────────────────────────────────── */}
      <div className="flex items-center justify-between pb-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[color:var(--color-ai)]/10 border border-[color:var(--color-ai)]/20 text-[color:var(--color-ai)]">
            <Goal className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">{t('sprintBoard.title')}</h1>
            <p className="text-[12px] text-muted-foreground mt-0.5">{t('sprintBoard.management')}</p>
          </div>
        </div>
        {can('sprint.manage') && (
          <Button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" /> {t('sprintBoard.create_new')}
          </Button>
        )}
      </div>

      {/* ── Create sprint inline form ──────────────────────────────── */}
      {isCreating && (
        <form
          className="mb-4 bg-card p-3 rounded-lg border border-border shadow-sm flex items-center gap-2 shrink-0"
          onSubmit={e => { e.preventDefault(); if (newSprintName.trim()) createSprintMutation.mutate(newSprintName.trim()); }}
        >
          <input autoFocus value={newSprintName} onChange={e => setNewSprintName(e.target.value)}
            placeholder={t('sprintBoard.form.name_placeholder')}
            className="flex-1 bg-background border border-border rounded-md px-3 py-1.5 text-sm outline-none focus:border-[color:var(--color-ai)]"
            disabled={createSprintMutation.isPending}
          />
          <Button type="submit" disabled={!newSprintName.trim() || createSprintMutation.isPending}
            className="flex items-center gap-1.5"
          >
            {createSprintMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-3.5 h-3.5" /> {t('sprintBoard.form.save')}</>}
          </Button>
          <Button type="button" variant="ghost" onClick={() => { setIsCreating(false); setNewSprintName(''); }}>
            {t('sprintBoard.form.cancel')}
          </Button>
        </form>
      )}

      {/* ── Content ───────────────────────────────────────────────── */}
      {(isLoadingSprints || isLoadingTasks) ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-[color:var(--color-ai)]" />
        </div>
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex-1 overflow-y-auto space-y-3 pb-6">

            {/* ── Sprint sections ──────────────────────────────── */}
            {sprints.map(sprint => {
              const sprintTasks = getSprintTasks(sprint.id);
              const doneCount = sprintTasks.filter(t => t.status === 'done').length;
              const total = sprintTasks.length;
              const pct = total > 0 ? Math.round(doneCount / total * 100) : 0;
              const isCollapsed = sprintCollapsed[sprint.id];
              const isEditing = editingSprintId === sprint.id;

              return (
                <div key={sprint.id} className="mb-6 bg-muted/10 border border-border/40 rounded-2xl overflow-hidden">

                  {/* Sprint header */}
                  {isEditing ? (
                    <EditSprintForm
                      sprint={sprint}
                      onSave={data => updateSprintMutation.mutate({ sprintId: sprint.id, data })}
                      onCancel={() => setEditingSprintId(null)}
                      t={t}
                    />
                  ) : (
                    <div className="border-b border-border/40 bg-muted/30">
                      {/* Row 1: Name + Status + Actions */}
                      <div className="flex items-center gap-3 px-4 py-3">
                        <button
                          onClick={() => setSprintCollapsed(c => ({ ...c, [sprint.id]: !c[sprint.id] }))}
                          className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                        >
                          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>

                        <h3 className="font-semibold text-sm text-foreground truncate">{sprint.name}</h3>
                        <StatusBadge type="sprint" status={sprint.status} className="border-none shrink-0" />

                        <div className="flex-1" />

                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button variant="ghost" size="icon" onClick={() => setChartSprint(sprint)} title={t('sprintBoard.actions.report')} className="h-7 w-7 text-muted-foreground hover:text-foreground">
                            <BarChart2 className="w-3.5 h-3.5" />
                          </Button>
                          {can('sprint.manage') && sprint.status !== 'completed' && (
                            <Button variant="ghost" size="icon" onClick={() => setEditingSprintId(sprint.id)} title={t('common.edit')} className="h-7 w-7 text-muted-foreground hover:text-foreground">
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          {can('sprint.manage') && sprint.status === 'planning' && (
                            <Button size="sm" onClick={() => startSprintMutation.mutate(sprint.id)} disabled={startSprintMutation.isPending} className="h-7 text-xs">
                              <Play className="w-3 h-3" /> {t('sprintBoard.actions.start')}
                            </Button>
                          )}
                          {can('sprint.manage') && sprint.status === 'active' && (
                            <Button size="sm" variant="destructive" onClick={() => setEndingSprintId(sprint.id)} className="h-7 text-xs">
                              <Square className="w-3 h-3" /> {t('sprintBoard.actions.end')}
                            </Button>
                          )}
                          {can('sprint.manage') && sprint.status === 'completed' && (
                            <Button size="sm" variant="outline" onClick={() => reopenSprintMutation.mutate(sprint.id)} disabled={reopenSprintMutation.isPending}
                              className="h-7 text-xs hover:text-[color:var(--color-warning)] hover:bg-[color:var(--color-warning)]/10 hover:border-[color:var(--color-warning)]/30">
                              <Play className="w-3 h-3" /> {t('sprintBoard.actions.reopen')}
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Row 2: Meta info — dates, goal, progress */}
                      <div className="flex items-center gap-4 px-4 pb-2.5 pl-11 text-[11px] text-muted-foreground">
                        {(sprint.start_date || sprint.end_date) && (
                          <span className="flex items-center gap-1 shrink-0">
                            <Calendar className="w-3 h-3" />
                            {sprint.start_date && format(new Date(sprint.start_date), 'dd/MM', { locale: vi })}
                            {sprint.end_date && ` → ${format(new Date(sprint.end_date), 'dd/MM/yyyy', { locale: vi })}`}
                          </span>
                        )}
                        {sprint.goal && (
                          <span className="italic truncate hidden md:block">
                            {sprint.goal}
                          </span>
                        )}
                        <div className="flex-1" />
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden hidden sm:block">
                            <div className="h-full bg-[color:var(--color-success)] rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="font-mono font-medium whitespace-nowrap">
                            {doneCount}/{total} <span className="text-muted-foreground/50">({pct}%)</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Task list (collapsible) */}
                  {!isCollapsed && (
                    <Droppable droppableId={sprint.id} isDropDisabled={sprint.status === 'completed'}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`p-3 transition-colors ${snapshot.isDraggingOver ? 'bg-[color:var(--color-ai)]/5' : ''} ${sprint.status === 'completed' ? 'opacity-60' : ''}`}
                        >
                          {/* Column headers */}
                          {sprintTasks.length > 0 && <TaskListHeader t={t} />}

                          {sprintTasks.length === 0 && (
                            <p className="text-xs text-muted-foreground italic text-center py-5">
                              {sprint.status === 'completed' ? t('sprintBoard.empty.completed') : t('sprintBoard.empty.drag_here')}
                            </p>
                          )}

                          <SprintTaskList tasks={sprintTasks} allTasks={tasks} membersMap={membersMap} onOpen={setSelectedTask} selectedIds={selectedIds} onToggleSelect={toggleSelect} t={t} />
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  )}
                </div>
              );
            })}

            {/* ── Backlog ─────────────────────────────────────── */}
            <div className="mb-6 bg-muted/5 border border-dashed border-border/60 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border/40 bg-muted/20 flex items-center gap-3">
                <Inbox className="w-4 h-4 text-muted-foreground shrink-0" />
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  Backlog
                  <Badge variant="secondary" className="px-1.5 py-0.5 rounded-full font-mono text-[10px]">
                    {backlogTasks.length}
                  </Badge>
                </h3>
                <div className="flex-1" />
                {can('task.create') && (
                  <Button
                    variant="outline" size="sm"
                    onClick={() => setIsCreateTaskOpen(true)}
                    className="flex items-center gap-1.5 h-7 text-xs"
                  >
                    <Plus className="w-3.5 h-3.5" /> {t('sprintBoard.actions.add_task')}
                  </Button>
                )}
              </div>

              <Droppable droppableId="backlog">
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`p-3 transition-colors ${snapshot.isDraggingOver ? 'bg-[color:var(--color-ai)]/5' : ''}`}
                  >
                    {backlogTasks.length === 0 && (
                      <p className="text-xs text-muted-foreground italic text-center py-6">
                        {t('sprintBoard.empty.backlog')}
                      </p>
                    )}

                    {backlogTasks.length > 0 && <TaskListHeader t={t} />}

                    <SprintTaskList tasks={backlogTasks} allTasks={tasks} membersMap={membersMap} onOpen={setSelectedTask} selectedIds={selectedIds} onToggleSelect={toggleSelect} t={t} />
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>

          </div>
        </DragDropContext>
      )}

      {/* ── Bulk action bar ──────────────────────────────────────── */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <BulkActionBar
            count={selectedIds.size}
            isDeleting={bulkDeleteMutation.isPending}
            onDelete={can('task.delete') ? () => bulkDeleteMutation.mutate(selectedIds) : undefined}
            onClear={clearSelection}
          />
        )}
      </AnimatePresence>

      {/* ── Modals ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedTask && (
          <TaskDetailModal
            task={selectedTask}
            projectId={projectId}
            onClose={() => setSelectedTask(null)}
          />
        )}
        {chartSprint && <BurndownChartModal sprint={chartSprint} onClose={() => setChartSprint(null)} />}
        {endingSprint && (
          <EndSprintModal
            sprint={endingSprint}
            allSprints={sprints}
            projectId={projectId}
            onClose={() => setEndingSprintId(null)}
          />
        )}
        {isCreateTaskOpen && (
          <CreateTaskModal
            projectId={projectId}
            defaultStatus="todo"
            members={members}
            onClose={() => setIsCreateTaskOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
