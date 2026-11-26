import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import PriorityBadge from '@/components/ui/PriorityBadge';
import TaskTypeBadge from '@/components/ui/TaskTypeBadge';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Clock,
  User as UserIcon,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Sparkles,
  Users,
  Goal,
  Play,
  Square,
  BarChart2,
  Calendar,
  Check,
  LayoutGrid,
  ListTodo,
} from 'lucide-react';
import KanbanFilter from '@/components/KanbanFilter';
import TaskListView from '@/components/views/TaskListView';
import TaskCalendarView from '@/components/views/TaskCalendarView';
import { useWorkspaceStore } from '@/store/workspaceStore';
import BulkActionBar from '@/components/BulkActionBar';
import taskService from '@/services/taskService';
import projectService from '@/services/projectService';
import sprintService from '@/services/sprintService';
import workspaceService from '@/services/workspaceService';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import TaskDetailModal from '@/components/TaskDetailModal';
import CreateTaskModal from '@/components/CreateTaskModal';
import ProjectMembersModal from '@/components/ProjectMembersModal';
import EndSprintModal from '@/components/EndSprintModal';
import BurndownChartModal from '@/components/BurndownChartModal';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useProjectPermissions } from '@/hooks/useProjectPermissions';
import { toast } from 'sonner';
import { getApiError } from '@/lib/apiError';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

// membersMap: { user_id → user } pre-computed in KanbanPage to avoid an O(n) find per card
// parentTask: computed in the column render loop, so allTasks is not passed
const TaskCard = React.memo(function TaskCard({
  task,
  index,
  onOpen,
  isRollingBack,
  membersMap,
  parentTask,
  isSelected,
  onToggleSelect,
  isGlass,
  canEdit = true,
}) {
  const { t } = useTranslation();

  const isOverdue = task.deadline && new Date(task.deadline) < new Date() && task.status !== 'done';

  const cardBgStyle = isGlass
    ? {
        high: 'bg-[color:var(--color-destructive)]/5 border-l-4 border-l-[color:var(--color-destructive)]/70 border-y-border border-r-border',
        medium:
          'bg-[color:var(--color-warning)]/5 border-l-4 border-l-[color:var(--color-warning)]/70 border-y-border border-r-border',
        low: 'bg-[color:var(--color-success)]/5 border-l-4 border-l-[color:var(--color-success)]/70 border-y-border border-r-border',
      }[task.priority] || 'bg-card border border-border'
    : {
        high: 'bg-card border-l-4 border-l-[color:var(--color-destructive)]/70 border-y-border border-r-border',
        medium:
          'bg-card border-l-4 border-l-[color:var(--color-warning)]/70 border-y-border border-r-border',
        low: 'bg-card border-l-4 border-l-[color:var(--color-success)]/70 border-y-border border-r-border',
      }[task.priority] || 'bg-card border border-border';

  const isSubtask = !!task.parent_task_id;
  const isOrphaned = isSubtask && (!parentTask || parentTask.status !== task.status);

  const handleClick = (e) => {
    if ((e.ctrlKey || e.metaKey) && canEdit) {
      e.preventDefault();
      e.stopPropagation();
      onToggleSelect?.();
    } else {
      onOpen(task);
    }
  };

  return (
    <Draggable draggableId={task.id} index={index} isDragDisabled={!canEdit}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          style={provided.draggableProps.style}
          onClick={handleClick}
          className={`relative z-0 ${isSubtask ? (isOrphaned ? 'w-full mb-2' : 'w-[94%] ml-auto mb-2') : 'mb-2'}`}
        >
          {/* Selection indicator — top-left badge */}
          {isSelected && (
            <div className="absolute -top-1.5 -left-1.5 z-30 w-5 h-5 rounded-full bg-[color:var(--color-ai)] flex items-center justify-center shadow-md ring-2 ring-card">
              <Check className="w-3 h-3 text-white" />
            </div>
          )}

          <motion.div
            animate={
              isRollingBack
                ? {
                    y: [-40, 0, -20, 0, -10, 0],
                    x: [-10, 10, -5, 5, 0],
                    rotate: [-5, 5, -2, 2, 0],
                    scale: [1.05, 1],
                    boxShadow: ['0px 10px 30px rgba(255,0,0,0.5)', '0px 1px 2px rgba(0,0,0,0.05)'],
                    borderColor: ['var(--color-destructive)', 'var(--color-border)'],
                  }
                : {}
            }
            transition={{ duration: 0.8, type: 'spring', bounce: 0.6 }}
            className={`${cardBgStyle} rounded-lg p-2.5 cursor-pointer select-none transition-all duration-200 relative z-10
              ${isSelected ? 'ring-2 ring-[color:var(--color-ai)]/70 ring-offset-1 brightness-95' : ''}
              ${
                snapshot.isDragging
                  ? 'shadow-2xl rotate-2 ring-1 ring-[color:var(--color-ai)] scale-105 relative z-50'
                  : 'shadow-sm hover:shadow hover:brightness-95'
              }`}
          >
            {/* Parent Task Context for Orphaned Subtasks */}
            {isOrphaned && parentTask && (
              <div className="text-[10px] font-medium text-muted-foreground mb-1.5 truncate flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />
                {parentTask.title}
              </div>
            )}

            {/* Priority + Overdue */}
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <TaskTypeBadge type={task.type} />
                <PriorityBadge priority={task.priority} size="sm" />
                {task.story_points != null && (
                  <span
                    className="text-[9px] font-mono font-bold bg-muted text-muted-foreground px-1.5 py-0.5 rounded-sm shadow-sm"
                    title="Story Points"
                  >
                    {task.story_points}
                  </span>
                )}
                {task.estimated_hours != null && (
                  <span
                    className="text-[9px] font-mono font-medium text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded-sm border border-border/50"
                    title={t('kanban.card.estimated_hours')}
                  >
                    {task.estimated_hours}h
                  </span>
                )}
              </div>
              {isOverdue && (
                <span className="text-[10px] text-[color:var(--color-destructive)] flex items-center gap-0.5 font-medium">
                  <AlertCircle className="w-2.5 h-2.5" /> {t('kanban.card.overdue')}
                </span>
              )}
            </div>

            {/* Title */}
            <h3 className="text-[12px] font-medium text-card-foreground leading-snug mb-2 line-clamp-2">
              {task.title}
            </h3>

            {/* Sub-tasks progress */}
            {!isSubtask &&
              task.subtasks?.length > 0 &&
              (() => {
                // Computed once to avoid calling filter() twice for the same result
                const doneCount = task.subtasks.filter((s) => s.status === 'done').length;
                const totalCount = task.subtasks.length;
                const pct = (doneCount / totalCount) * 100;
                return (
                  <div className="mb-2">
                    <div className="flex justify-between text-[9px] text-muted-foreground font-mono uppercase tracking-widest mb-1">
                      <span>{t('kanban.card.subtasks')}</span>
                      <span>
                        {doneCount}/{totalCount}
                      </span>
                    </div>
                    <div className="h-1 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        className="h-full bg-[color:var(--color-ai)] rounded-full"
                      />
                    </div>
                  </div>
                );
              })()}

            {/* Footer */}
            <div className="flex items-center justify-between mt-auto">
              {/* Assignee */}
              <div className="flex items-center gap-1.5">
                {task.assignee_id ? (
                  (() => {
                    // O(1) lookup through membersMap instead of an O(n) find()
                    const assignee = membersMap?.[task.assignee_id];
                    const name = assignee?.full_name || assignee?.email || 'U';
                    const initial = name.charAt(0).toUpperCase();
                    return (
                      <>
                        <div
                          className="w-5 h-5 rounded-full bg-gradient-to-tr from-primary to-ai text-[9px] font-bold text-white flex items-center justify-center shadow-sm"
                          title={name}
                        >
                          {initial}
                        </div>
                        <span
                          className="text-[10px] text-muted-foreground truncate max-w-[80px]"
                          title={name}
                        >
                          {name}
                        </span>
                      </>
                    );
                  })()
                ) : (
                  <>
                    <div className="w-5 h-5 rounded-full bg-background border border-border border-dashed flex items-center justify-center">
                      <UserIcon className="w-3 h-3 text-muted-foreground/50" />
                    </div>
                    <span className="text-[10px] text-muted-foreground truncate max-w-[80px]">
                      {t('kanban.card.unassigned')}
                    </span>
                  </>
                )}
              </div>

              {/* Deadline */}
              {task.deadline && (
                <span
                  className={`text-[10px] flex items-center gap-1 font-mono ${isOverdue ? 'text-[color:var(--color-destructive)]' : 'text-muted-foreground'}`}
                >
                  <Clock className="w-3 h-3" />
                  {format(new Date(task.deadline), 'dd/MM', { locale: vi })}
                </span>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </Draggable>
  );
});

import { useTheme } from '@/contexts/useTheme';

export default function KanbanPage() {
  const activeWsId = useWorkspaceStore((state) => state.activeWorkspaceId);
  const { data: workspaces = [] } = useQuery({
    queryKey: ['workspaces'],
    queryFn: workspaceService.getWorkspaces,
  });
  const activeWorkspace = workspaces.find((w) => w.id === activeWsId) || workspaces[0];

  const { t } = useTranslation();
  const { id: projectId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  // Fetch the project to resolve its own workspace (may differ from active workspace)
  const { data: projectData } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectService.getProject(projectId),
    enabled: !!projectId,
    staleTime: 30_000,
  });
  const projectWorkspace =
    workspaces.find((w) => w.id === projectData?.workspace_id) || activeWorkspace;

  const viewParam = searchParams.get('view');
  let activeView = viewParam || (projectWorkspace?.type === 'personal' ? 'list' : 'board');
  const wsSettings = projectWorkspace?.settings || {};
  if (activeView === 'calendar' && wsSettings.enable_calendar === false) activeView = 'board';
  if (activeView === 'list' && wsSettings.enable_list_view === false) activeView = 'board';

  const handleViewChange = useCallback(
    (v) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('view', v);
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const qc = useQueryClient();
  const { can } = useProjectPermissions(projectId);
  const { themeStyle } = useTheme();
  const isGlass = themeStyle === 'glass';
  const [addingIn, setAddingIn] = useState(null);
  const [initialDeadline, setInitialDeadline] = useState(null);
  const [rollbackTaskId, setRollbackTaskId] = useState(null);
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    types: [],
    priorities: [],
    assignees: [],
    isOverdue: false,
    sprint: null,
  });
  const hasAutoSetSprint = useRef(false);
  const [endingSprintId, setEndingSprintId] = useState(null);
  const [chartSprint, setChartSprint] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());

  const handleOpenTask = useCallback(
    (task) => {
      const newParams = new URLSearchParams(searchParams);
      newParams.set('taskId', task.id);
      setSearchParams(newParams, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const handleCloseTask = useCallback(() => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('taskId');
    setSearchParams(newParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const toggleSelect = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  // Escape → clear selection
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') clearSelection();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [clearSelection]);

  const [isDragging, setIsDragging] = useState(false);

  // Custom WebSocket hook
  const { isConnected } = useWebSocket(projectId);

  const { data: members = [] } = useQuery({
    queryKey: ['members', projectId],
    queryFn: () => projectService.getMembers(projectId),
    enabled: !!projectId,
  });

  const { data: sprints = [] } = useQuery({
    queryKey: ['sprints', projectId],
    queryFn: () => sprintService.getSprints(projectId),
    enabled: !!projectId,
    staleTime: 60_000,
  });

  // Auto-select the active sprint on first load (once; never overrides a manual choice)
  useEffect(() => {
    if (sprints.length === 0 || hasAutoSetSprint.current) return;
    hasAutoSetSprint.current = true;
    const active = sprints.find((s) => s.status === 'active');
    if (active) {
      setFilters((f) => ({ ...f, sprint: active.id }));
    }
  }, [sprints]);

  // Pre-compute O(1) lookup map: { user_id → user object }
  // Stable reference: recomputed only when members change (rare)
  const membersMap = useMemo(
    () => Object.fromEntries(members.map((m) => [m.user_id, m.user])),
    [members]
  );

  const COLUMNS = useMemo(
    () => [
      {
        id: 'todo',
        label: t('kanban.columns.todo'),
        color: 'bg-[color:var(--color-muted-foreground)]',
        light: 'bg-muted',
        border: 'border-border',
      },
      {
        id: 'in_progress',
        label: t('kanban.columns.in_progress'),
        color: 'bg-[color:var(--color-ai)]',
        light: 'bg-[color:var(--color-ai)]/10',
        border: 'border-[color:var(--color-ai)]/20',
      },
      {
        id: 'review',
        label: t('kanban.columns.review'),
        color: 'bg-[color:var(--color-warning)]',
        light: 'bg-[color:var(--color-warning)]/10',
        border: 'border-[color:var(--color-warning)]/20',
      },
      {
        id: 'done',
        label: t('kanban.columns.done'),
        color: 'bg-[color:var(--color-success)]',
        light: 'bg-[color:var(--color-success)]/10',
        border: 'border-[color:var(--color-success)]/20',
      },
    ],
    [t]
  );

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks', projectId],
    queryFn: () => taskService.getTasks(projectId),
    enabled: !!projectId,
    refetchInterval: isDragging || isConnected ? false : 5000,
  });

  // Pre-compute O(1) tasks lookup map: { task_id → task }
  // Must come AFTER the tasks useQuery because it depends on `tasks`
  const tasksById = useMemo(() => Object.fromEntries(tasks.map((t) => [t.id, t])), [tasks]);

  // Derive selectedTask directly from URL
  const selectedTask = useMemo(() => {
    const taskIdFromUrl = searchParams.get('taskId');
    if (taskIdFromUrl && tasksById[taskIdFromUrl]) {
      return tasksById[taskIdFromUrl];
    }
    return null;
  }, [searchParams, tasksById]);

  // ── Sprint context banner ────────────────────────────────────────────
  // Show whichever sprint the user has filtered to; fall back to the active sprint.
  const currentSprint = useMemo(() => {
    if (filters.sprint && filters.sprint !== '__backlog__') {
      return sprints.find((s) => s.id === filters.sprint) ?? null;
    }
    return sprints.find((s) => s.status === 'active') ?? null;
  }, [filters.sprint, sprints]);

  const sprintStats = useMemo(() => {
    if (!currentSprint) return null;
    const sprintTasks = tasks.filter((t) => t.sprint_id === currentSprint.id);
    const total = sprintTasks.length;
    const done = sprintTasks.filter((t) => t.status === 'done').length;
    return { total, done, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
  }, [currentSprint, tasks]);

  const startSprintMutation = useMutation({
    mutationFn: (sprintId) => sprintService.startSprint(sprintId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sprints', projectId] });
      toast.success(t('sprintBoard.start_success'));
    },
    onError: (err) => {
      const rawDetail = err.response?.data?.detail;
      toast.error(t('common.error'), {
        description:
          rawDetail === 'sprint.error_already_active'
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
        description:
          rawDetail === 'sprint.error_already_active'
            ? t('sprintBoard.reopen_error')
            : getApiError(err, t('common.error')),
      });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids) => Promise.all([...ids].map((id) => taskService.deleteTask(id))),
    onMutate: async (ids) => {
      await qc.cancelQueries({ queryKey: ['tasks', projectId] });
      const previous = qc.getQueryData(['tasks', projectId]);
      qc.setQueryData(['tasks', projectId], (old = []) => old.filter((t) => !ids.has(t.id)));
      return { previous };
    },
    onError: (_, __, context) => {
      if (context?.previous) qc.setQueryData(['tasks', projectId], context.previous);
      toast.error(t('common.error'), {
        description: t(
          'sprintBoard.delete_tasks_failed',
          'Some tasks could not be deleted. Changes were reverted.'
        ),
      });
    },
    onSuccess: () => {
      toast.success(
        t('sprintBoard.delete_tasks_success', {
          count: selectedIds.size,
          defaultValue: 'Deleted {{count}} tasks',
        })
      );
      clearSelection();
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['tasks', projectId] }),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ taskId, status }) => taskService.updateStatus(taskId, status),
    onSettled: () => qc.invalidateQueries({ queryKey: ['tasks', projectId] }),
    onMutate: async ({ taskId, status: _status }) => {
      await qc.cancelQueries({ queryKey: ['tasks', projectId] });
      const previousTasks = qc.getQueryData(['tasks', projectId]);
      return { previousTasks, taskId };
    },
    onError: (err, variables, context) => {
      const errorMsg = getApiError(err, t('kanban.updateError'));
      toast.error(t('common.error'), { description: errorMsg });
      if (context?.previousTasks) {
        qc.setQueryData(['tasks', projectId], context.previousTasks);
      }
    },
  });

  const updatePositionMutation = useMutation({
    mutationFn: ({ taskId, status, insertAfterId }) =>
      taskService.updatePosition(taskId, status, insertAfterId),
    onSettled: () => qc.invalidateQueries({ queryKey: ['tasks', projectId] }),
    onMutate: async ({ previousTasks, taskId }) => {
      await qc.cancelQueries({ queryKey: ['tasks', projectId] });
      return { previousTasks, taskId };
    },
    onError: (err, variables, context) => {
      const errorMsg = getApiError(err, t('kanban.updateError'));
      toast.error(t('common.error'), { description: errorMsg });
      if (context?.previousTasks) {
        qc.setQueryData(['tasks', projectId], context.previousTasks);
        setRollbackTaskId(context.taskId);
        setTimeout(() => setRollbackTaskId(null), 1000);
      }
    },
  });

  const updateDeadlineMutation = useMutation({
    mutationFn: ({ taskId, deadline }) => taskService.updateTask(taskId, { deadline }),
    onMutate: async ({ taskId, deadline }) => {
      await qc.cancelQueries({ queryKey: ['tasks', projectId] });
      const previousTasks = qc.getQueryData(['tasks', projectId]);
      if (previousTasks) {
        qc.setQueryData(['tasks', projectId], (old) =>
          old.map((t) => (t.id === taskId ? { ...t, deadline } : t))
        );
      }
      return { previousTasks };
    },
    onError: (err, variables, context) => {
      if (context?.previousTasks) {
        qc.setQueryData(['tasks', projectId], context.previousTasks);
      }
      toast.error(t('common.error'), { description: err.translatedMessage || '' });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['tasks', projectId] });
    },
  });

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      let matches = true;
      if (filters.search) {
        const query = filters.search.toLowerCase();
        matches = matches && task.title.toLowerCase().includes(query);
      }
      if (filters.types?.length > 0) {
        matches = matches && filters.types.includes(task.type || 'task');
      }
      if (filters.priorities?.length > 0) {
        matches = matches && filters.priorities.includes(task.priority);
      }
      if (filters.assignees?.length > 0) {
        if (filters.assignees.includes('unassigned')) {
          const assigneeMatch = !task.assignee_id || filters.assignees.includes(task.assignee_id);
          matches = matches && assigneeMatch;
        } else {
          matches = matches && filters.assignees.includes(task.assignee_id);
        }
      }
      if (filters.isOverdue) {
        const isOverdue =
          task.deadline && new Date(task.deadline) < new Date() && task.status !== 'done';
        matches = matches && isOverdue;
      }
      // Sprint filter
      if (filters.sprint === '__backlog__') {
        matches = matches && !task.sprint_id;
      } else if (filters.sprint) {
        matches = matches && task.sprint_id === filters.sprint;
      }
      return matches;
    });
  }, [tasks, filters]);

  const grouped = useMemo(() => {
    return COLUMNS.reduce((acc, col) => {
      const colTasks = filteredTasks.filter((t) => t.status === col.id);

      const result = [];
      const parents = colTasks.filter((t) => !t.parent_task_id);
      const children = colTasks.filter((t) => t.parent_task_id);

      parents.forEach((p) => {
        result.push(p);

        // Find children belonging to this parent that are in the SAME column
        // And sort them by created_at ascending (oldest first)
        const parentChildren = children.filter((c) => c.parent_task_id === p.id);
        parentChildren.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

        result.push(...parentChildren);
      });

      const orphaned = children.filter((c) => !parents.find((p) => p.id === c.parent_task_id));
      result.push(...orphaned);

      acc[col.id] = result;
      return acc;
    }, {});
  }, [filteredTasks, COLUMNS]);

  const onDragEnd = (result) => {
    setIsDragging(false);
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index)
      return;

    const newStatus = destination.droppableId;

    if (selectedIds?.has(draggableId) && selectedIds.size > 1) {
      if (source.droppableId !== destination.droppableId) {
        // Bulk move across columns: just update status for all selected tasks
        [...selectedIds].forEach((id) => {
          updateStatusMutation.mutate({ taskId: id, status: newStatus });
        });
      }
      clearSelection();
      return;
    }

    const destColTasks = grouped[newStatus] || [];

    // Clone array to find correct insertAfterId
    const tasksInDest = Array.from(destColTasks);
    if (source.droppableId === destination.droppableId) {
      tasksInDest.splice(source.index, 1); // Remove from old position
    }

    // Find the parent task right before the drop position (subtasks are skipped: the backend only orders parents)
    let insertAfterId = null;
    for (let i = destination.index - 1; i >= 0; i--) {
      if (!tasksInDest[i].parent_task_id) {
        insertAfterId = tasksInDest[i].id;
        break;
      }
    }

    // OPTIMISTIC UPDATE: Calculate the new array to prevent visual lag/snapping
    // Keep previousTasks to roll back on error
    const previousTasks = qc.getQueryData(['tasks', projectId]);
    let optimisticTasks = previousTasks;

    if (optimisticTasks) {
      // Deep clone to avoid mutating cache directly before setQueryData
      optimisticTasks = optimisticTasks.map((t) => ({ ...t }));
      const taskIdx = optimisticTasks.findIndex((t) => t.id === draggableId);
      if (taskIdx > -1) {
        const [draggedTask] = optimisticTasks.splice(taskIdx, 1);
        draggedTask.status = newStatus;

        // Fix Case 1: subtask dragged → update parent task's nested subtasks array
        // (shallow copy {…t} doesn't clone nested arrays, so progress bar reads stale data)
        if (draggedTask.parent_task_id) {
          const parentTask = optimisticTasks.find((t) => t.id === draggedTask.parent_task_id);
          if (parentTask && Array.isArray(parentTask.subtasks)) {
            parentTask.subtasks = parentTask.subtasks.map((sub) =>
              sub.id === draggedTask.id ? { ...sub, status: newStatus } : sub
            );
          }
        }

        // Optimistic cascade for subtasks (flat list)
        if (newStatus === 'in_progress' || newStatus === 'review') {
          optimisticTasks.forEach((t) => {
            if (t.parent_task_id === draggedTask.id) {
              if (newStatus === 'in_progress' && t.status === 'todo') {
                t.status = 'in_progress';
              } else if (newStatus === 'review' && ['todo', 'in_progress'].includes(t.status)) {
                t.status = 'review';
              }
            }
          });

          // Fix Case 2: parent dragged with cascade → also update draggedTask's own nested subtasks array
          if (Array.isArray(draggedTask.subtasks)) {
            draggedTask.subtasks = draggedTask.subtasks.map((sub) => {
              if (newStatus === 'in_progress' && sub.status === 'todo') {
                return { ...sub, status: 'in_progress' };
              } else if (newStatus === 'review' && ['todo', 'in_progress'].includes(sub.status)) {
                return { ...sub, status: 'review' };
              }
              return sub;
            });
          }
        }

        let insertIdx = 0;
        if (insertAfterId) {
          insertIdx = optimisticTasks.findIndex((t) => t.id === insertAfterId) + 1;
        } else {
          // Find first parent task in the new column
          const firstInCol = optimisticTasks.findIndex(
            (t) => t.status === newStatus && !t.parent_task_id
          );
          insertIdx = firstInCol !== -1 ? firstInCol : 0;
        }
        optimisticTasks.splice(insertIdx, 0, draggedTask);

        // APPLY SYNCHRONOUSLY TO AVOID SNAPBACK IN REACT-BEAUTIFUL-DND
        qc.setQueryData(['tasks', projectId], optimisticTasks);
      }
    }

    updatePositionMutation.mutate({
      taskId: draggableId,
      status: newStatus,
      insertAfterId,
      previousTasks,
    });
  };

  if (!projectId) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        <p>{t('kanban.selectProject')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-var(--layout-offset))]">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[color:var(--color-ai)]/10 border border-[color:var(--color-ai)]/20 text-[color:var(--color-ai)]">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">
              {projectWorkspace?.type === 'personal' ? t('kanban.tasks_title') : t('kanban.title')}
            </h1>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              {projectWorkspace?.type === 'personal'
                ? t('kanban.tasks_subtitle')
                : t('kanban.subtitle')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* View Switcher */}
          <div className="flex items-center bg-muted/50 rounded-lg p-1 border border-border shadow-sm">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleViewChange('board')}
              className={`h-7 px-2.5 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-all ${activeView === 'board' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              {t('kanban.view_board')}
            </Button>
            {wsSettings.enable_list_view !== false && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleViewChange('list')}
                className={`h-7 px-2.5 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-all ${activeView === 'list' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <ListTodo className="w-3.5 h-3.5" />
                {t('kanban.view_list')}
              </Button>
            )}
            {wsSettings.enable_calendar !== false && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleViewChange('calendar')}
                className={`h-7 px-2.5 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-all ${activeView === 'calendar' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <Calendar className="w-3.5 h-3.5" />
                {t('kanban.view_calendar')}
              </Button>
            )}
          </div>

          {/* Avatar Stack for Team Members */}
          <button
            onClick={() => setIsMembersModalOpen(true)}
            className="flex items-center gap-2 text-xs font-medium bg-card hover:bg-muted px-2.5 py-1.5 rounded-md border border-border transition-colors shadow-sm group"
          >
            <div className="flex -space-x-1.5">
              {members.slice(0, 4).map((m) => (
                <div
                  key={m.user_id}
                  className="w-6 h-6 rounded-full bg-gradient-to-tr from-primary to-ai text-[9px] font-bold text-white flex items-center justify-center ring-2 ring-card group-hover:ring-muted transition-colors shadow-sm"
                  title={m.user?.full_name}
                >
                  {m.user?.full_name?.charAt(0).toUpperCase() || 'U'}
                </div>
              ))}
              {members.length > 4 && (
                <div className="w-6 h-6 rounded-full bg-muted text-[9px] font-bold text-muted-foreground flex items-center justify-center ring-2 ring-card group-hover:ring-muted transition-colors shadow-sm">
                  +{members.length - 4}
                </div>
              )}
              {members.length === 0 && <Users className="w-3.5 h-3.5 text-muted-foreground" />}
            </div>
            <span className="text-muted-foreground">{t('kanban.team')}</span>
          </button>

          <KanbanFilter
            filters={filters}
            setFilters={setFilters}
            members={members}
            sprints={sprints}
          />

          <Link
            to={`/projects/${projectId}/sprints`}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-card hover:bg-muted border border-border px-3 py-1.5 rounded-md transition-colors shadow-sm"
          >
            <Goal className="w-3.5 h-3.5" /> Sprints
          </Link>
        </div>
      </div>

      {/* Sprint Context Bar */}
      {currentSprint && (
        <div className="mb-3 flex items-center gap-2.5 px-3 py-2 bg-card border border-border rounded-lg shadow-sm shrink-0 overflow-hidden">
          <Goal className="w-3.5 h-3.5 text-[color:var(--color-ai)] shrink-0" />

          {/* Name + status */}
          <span className="font-semibold text-[12px] text-foreground truncate max-w-[160px]">
            {currentSprint.name}
          </span>
          {(() => {
            const statusConfig = {
              planning: {
                label: t('sprintBoard.status.planning'),
                className: 'bg-muted text-muted-foreground',
              },
              active: {
                label: t('sprintBoard.status.active'),
                className: 'bg-[color:var(--color-success)]/15 text-[color:var(--color-success)]',
              },
              completed: {
                label: t('sprintBoard.status.completed'),
                className: 'bg-[color:var(--color-ai)]/10 text-[color:var(--color-ai)]',
              },
            }[currentSprint.status];

            return statusConfig ? (
              <Badge
                variant="glass"
                className={`shrink-0 text-[9px] uppercase tracking-widest font-mono border-none ${statusConfig.className}`}
              >
                {statusConfig.label}
              </Badge>
            ) : null;
          })()}

          {/* Goal */}
          {currentSprint.goal && (
            <span className="text-[11px] text-muted-foreground italic truncate hidden lg:block">
              — {currentSprint.goal}
            </span>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Progress bar */}
          {sprintStats && sprintStats.total > 0 && (
            <div className="hidden sm:flex items-center gap-2 shrink-0">
              <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-[color:var(--color-success)] rounded-full transition-all duration-500"
                  style={{ width: `${sprintStats.pct}%` }}
                />
              </div>
              <span className="text-[10px] font-mono text-muted-foreground whitespace-nowrap">
                {sprintStats.done}/{sprintStats.total}
              </span>
            </div>
          )}

          {/* Date range */}
          {(currentSprint.start_date || currentSprint.end_date) && (
            <div className="hidden md:flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
              <Calendar className="w-3 h-3" />
              {currentSprint.start_date &&
                format(new Date(currentSprint.start_date), 'dd/MM', { locale: vi })}
              {currentSprint.end_date &&
                ` → ${format(new Date(currentSprint.end_date), 'dd/MM', { locale: vi })}`}
            </div>
          )}

          {/* Divider */}
          <div className="w-px h-4 bg-border shrink-0" />

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setChartSprint(currentSprint)}
              title={t('sprintBoard.actions.report')}
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
            >
              <BarChart2 className="w-3.5 h-3.5" />
            </Button>

            {can('sprint.manage') && currentSprint.status === 'planning' && (
              <Button
                size="sm"
                onClick={() => startSprintMutation.mutate(currentSprint.id)}
                disabled={startSprintMutation.isPending}
                className="h-7 text-xs flex items-center gap-1"
              >
                <Play className="w-3 h-3" /> {t('sprintBoard.actions.start')}
              </Button>
            )}
            {can('sprint.manage') && currentSprint.status === 'active' && (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setEndingSprintId(currentSprint.id)}
                className="h-7 text-xs flex items-center gap-1"
              >
                <Square className="w-3 h-3" /> {t('sprintBoard.actions.end')}
              </Button>
            )}
            {can('sprint.manage') && currentSprint.status === 'completed' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => reopenSprintMutation.mutate(currentSprint.id)}
                disabled={reopenSprintMutation.isPending}
                title={t('sprintBoard.actions.reopen_hint')}
                className="h-7 text-xs flex items-center gap-1 hover:text-[color:var(--color-warning)] hover:bg-[color:var(--color-warning)]/10 hover:border-[color:var(--color-warning)]/30"
              >
                <Play className="w-3 h-3" /> {t('sprintBoard.actions.reopen')}
              </Button>
            )}
          </div>
        </div>
      )}

      <AnimatePresence mode="wait">
        {/* Board */}
        {activeView === 'board' && (
          <motion.div
            key="board"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="flex-1 flex flex-col min-h-0"
          >
            {isLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-[color:var(--color-ai)] animate-spin" />
              </div>
            ) : (
              <DragDropContext onDragStart={() => setIsDragging(true)} onDragEnd={onDragEnd}>
                <div className="flex-1 flex gap-4 overflow-x-auto overflow-y-hidden pb-2 scrollbar-thin">
                  {COLUMNS.map((col) => (
                    <div key={col.id} className="flex flex-col min-w-[260px] flex-1 max-w-[450px]">
                      {/* Column Header */}
                      <div
                        className={`flex items-center justify-between mb-2 px-2.5 py-1.5 rounded-md ${col.light} border ${col.border}`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${col.color}`} />
                          <span className="text-[11px] font-semibold text-foreground uppercase tracking-wide">
                            {col.label}
                          </span>
                          <Badge
                            variant="secondary"
                            className="px-1.5 py-px rounded-full font-mono text-[10px]"
                          >
                            {grouped[col.id]?.length || 0}
                          </Badge>
                        </div>
                        {can('task.create') && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setAddingIn(col.id)}
                            className="h-6 w-6 text-muted-foreground hover:text-foreground"
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                      {/* Droppable Area */}
                      <Droppable droppableId={col.id}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={`flex-1 rounded-xl p-2 min-h-[150px] overflow-y-auto scrollbar-thin transition-colors border ${isGlass ? (snapshot.isDraggingOver ? 'bg-muted/30 border-[color:var(--color-ai)]/30 backdrop-blur-sm' : 'bg-transparent border-transparent') : snapshot.isDraggingOver ? 'bg-muted border-[color:var(--color-ai)]/30' : 'bg-muted/30 border-transparent'}`}
                          >
                            {grouped[col.id]?.map((task, index) => (
                              <TaskCard
                                key={task.id}
                                task={task}
                                index={index}
                                onOpen={handleOpenTask}
                                isRollingBack={rollbackTaskId === task.id}
                                membersMap={membersMap}
                                parentTask={
                                  task.parent_task_id ? tasksById[task.parent_task_id] : null
                                }
                                isSelected={selectedIds.has(task.id)}
                                onToggleSelect={() => toggleSelect(task.id)}
                                isGlass={isGlass}
                                canEdit={can('task.update')}
                              />
                            ))}
                            {provided.placeholder}
                            {addingIn === col.id && (
                              <div className="mb-2 p-3 bg-card border border-border border-dashed rounded-lg flex flex-col gap-2">
                                <span className="text-xs text-muted-foreground italic text-center animate-pulse">
                                  Creating...
                                </span>
                              </div>
                            )}
                            <AnimatePresence>{/* Removed inline form */}</AnimatePresence>

                            {/* Empty state */}
                            {grouped[col.id]?.length === 0 && addingIn !== col.id && (
                              <div className="flex flex-col items-center justify-center py-6 text-muted-foreground/50">
                                <CheckCircle2 className="w-6 h-6 mb-1.5" />
                                <p className="text-[10px]">{t('kanban.noTask')}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </Droppable>
                    </div>
                  ))}
                </div>
              </DragDropContext>
            )}
          </motion.div>
        )}

        {/* List View */}
        {activeView === 'list' && (
          <motion.div
            key="list"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="flex-1 flex flex-col min-h-0 pt-2"
          >
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 text-[color:var(--color-ai)] animate-spin" />
              </div>
            ) : (
              <TaskListView
                tasks={filteredTasks}
                membersMap={membersMap}
                onTaskClick={handleOpenTask}
              />
            )}
          </motion.div>
        )}

        {/* Calendar View */}
        {activeView === 'calendar' && (
          <motion.div
            key="calendar"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="flex-1 flex flex-col min-h-0 pt-2"
          >
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 text-[color:var(--color-ai)] animate-spin" />
              </div>
            ) : (
              <TaskCalendarView
                events={filteredTasks.map((t) => ({
                  id: t.id,
                  title: t.title,
                  start: t.deadline ? new Date(t.deadline) : null,
                  priority: t.priority,
                  rawData: t,
                }))}
                onEventClick={handleOpenTask}
                canEdit={can('task.update')}
                onTaskCreate={
                  can('task.create')
                    ? (date) => {
                        setInitialDeadline(format(date, 'yyyy-MM-dd'));
                        setAddingIn('todo');
                      }
                    : undefined
                }
                onTaskUpdateDeadline={(taskId, date) => {
                  updateDeadlineMutation.mutate({
                    taskId,
                    deadline: date ? format(date, 'yyyy-MM-dd') : null,
                  });
                }}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bulk action bar */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            key="bulk-action-wrapper"
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <BulkActionBar
              count={selectedIds.size}
              isDeleting={bulkDeleteMutation.isPending}
              onDelete={
                can('task.delete') ? () => bulkDeleteMutation.mutate(selectedIds) : undefined
              }
              onClear={clearSelection}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Task Detail Modal */}
      <AnimatePresence>
        {selectedTask && (
          <TaskDetailModal
            key="task-detail-modal"
            task={selectedTask}
            projectId={projectId}
            onClose={handleCloseTask}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isMembersModalOpen && (
          <ProjectMembersModal
            key="members-modal"
            project={{ id: projectId }}
            onClose={() => setIsMembersModalOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {addingIn && (
          <CreateTaskModal
            key="create-task-modal"
            projectId={projectId}
            sprintId={
              filters.sprint && filters.sprint !== '__backlog__' ? filters.sprint : undefined
            }
            defaultStatus={addingIn}
            members={members}
            initialDeadline={initialDeadline}
            onClose={() => {
              setAddingIn(null);
              setInitialDeadline(null);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {chartSprint && (
          <BurndownChartModal
            key="chart-modal"
            sprint={chartSprint}
            onClose={() => setChartSprint(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {endingSprintId &&
          (() => {
            const endingSprint = sprints.find((s) => s.id === endingSprintId);
            return endingSprint ? (
              <EndSprintModal
                key="end-sprint-modal"
                sprint={endingSprint}
                allSprints={sprints}
                projectId={projectId}
                onClose={() => setEndingSprintId(null)}
              />
            ) : null;
          })()}
      </AnimatePresence>
    </div>
  );
}
