import { useState, useEffect } from 'react';
import DatePicker from '@/components/ui/DatePicker';
import PriorityBadge from '@/components/ui/PriorityBadge';
import TaskTypeBadge from '@/components/ui/TaskTypeBadge';
import { TASK_TYPES } from '@/lib/taskTypes';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { vi, enUS } from 'date-fns/locale';
import {
  X,
  Clock,
  User as UserIcon,
  Flag,
  Shapes,
  CheckSquare,
  MessageSquare,
  Loader2,
  Send,
  Trash2,
  Edit3,
  GitBranch,
  Calendar,
  Plus,
  Sparkles,
} from 'lucide-react';
import taskService from '@/services/taskService';
import projectService from '@/services/projectService';
import { toast } from 'sonner';
import aiService from '@/services/aiService';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/useTheme';
import CustomSelect from '@/components/ui/CustomSelect';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDeleteDialog } from '@/components/ui/ConfirmDeleteDialog';
import { useActiveWorkspace } from '@/hooks/useActiveWorkspace';
import { useProjectPermissions } from '@/hooks/useProjectPermissions';
import { getApiError } from '@/lib/apiError';

// Removed hardcoded constants here, moved inside component to use translations

export default function TaskDetailModal({ task, projectId, onClose }) {
  const { user: _user } = useAuth();
  const { t, i18n } = useTranslation();
  const { themeStyle } = useTheme();
  const isGlass = themeStyle === 'glass';
  const dateFnsLocale = i18n.language === 'vi' ? vi : enUS;
  const qc = useQueryClient();
  const { settings } = useActiveWorkspace();
  const { can } = useProjectPermissions(projectId);
  const [comment, setComment] = useState('');
  const [newSubtask, setNewSubtask] = useState('');
  const [activeTab, setActiveTab] = useState('details');
  const [isEditing, setIsEditing] = useState(false);
  const [draftTask, setDraftTask] = useState({});
  const [isAiGeneratingSubtasks, setIsAiGeneratingSubtasks] = useState(false);
  const [isAiEstimating, setIsAiEstimating] = useState(false);
  const [pendingBreakdownMetricId, setPendingBreakdownMetricId] = useState(null);
  const [_pendingEstimateMetricId, setPendingEstimateMetricId] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAiRegenConfirm, setShowAiRegenConfirm] = useState(false);

  const STATUS_OPTIONS = [
    {
      value: 'todo',
      label: t('taskDetail.status_todo'),
      color: 'bg-muted text-muted-foreground border border-border',
    },
    {
      value: 'in_progress',
      label: t('taskDetail.status_in_progress'),
      color:
        'bg-[color:var(--color-ai)]/10 text-[color:var(--color-ai)] border border-[color:var(--color-ai)]/20',
    },
    {
      value: 'review',
      label: t('taskDetail.status_review'),
      color:
        'bg-[color:var(--color-warning)]/10 text-[color:var(--color-warning)] border border-[color:var(--color-warning)]/20',
    },
    {
      value: 'done',
      label: t('taskDetail.status_done'),
      color:
        'bg-[color:var(--color-success)]/10 text-[color:var(--color-success)] border border-[color:var(--color-success)]/20',
    },
  ];

  const PRIORITY_OPTIONS = [
    {
      value: 'high',
      label: t('taskDetail.priority_high'),
      color: 'text-[color:var(--color-destructive)]',
    },
    {
      value: 'medium',
      label: t('taskDetail.priority_medium'),
      color: 'text-[color:var(--color-warning)]',
    },
    {
      value: 'low',
      label: t('taskDetail.priority_low'),
      color: 'text-[color:var(--color-success)]',
    },
  ];

  const projectTasks = qc.getQueryData(['tasks', projectId]) || [];
  const availableDependencies = projectTasks.filter(
    (t) => t.id !== task.id && t.parent_task_id !== task.id
  );

  const { data: taskDetail } = useQuery({
    queryKey: ['task', task.id],
    queryFn: () => taskService.getTask(task.id),
    initialData: task,
    refetchInterval: 3000,
  });

  const { data: comments = [] } = useQuery({
    queryKey: ['comments', task.id],
    queryFn: () => taskService.getComments(task.id),
    enabled: activeTab === 'comments',
  });

  const { data: members = [] } = useQuery({
    queryKey: ['members', projectId],
    queryFn: () => projectService.getMembers(projectId),
    enabled: !!projectId,
  });

  const updateStatusMutation = useMutation({
    onError: (err) =>
      toast.error(t('common.error'), { description: getApiError(err, t('common.error')) }),
    mutationFn: ({ status }) => taskService.updateStatus(task.id, status),
    onSuccess: (updatedTask) => {
      qc.setQueryData(['task', task.id], (old) => ({ ...old, ...updatedTask }));
      qc.setQueryData(['tasks', projectId], (old) =>
        old?.map((t) => (t.id === task.id ? { ...t, ...updatedTask } : t))
      );
      qc.invalidateQueries({ queryKey: ['tasks', projectId] });
      qc.invalidateQueries({ queryKey: ['task', task.id] });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async (data) => {
      const { assignee_id, ...updatePayload } = data;
      if (updatePayload.estimated_hours !== null && updatePayload.estimated_hours !== undefined) {
        updatePayload.estimated_hours = parseFloat(updatePayload.estimated_hours);
      }
      if (updatePayload.story_points !== null && updatePayload.story_points !== undefined) {
        updatePayload.story_points = parseInt(updatePayload.story_points, 10);
      }
      let finalRes = await taskService.updateTask(task.id, updatePayload);

      if (assignee_id !== undefined && assignee_id !== taskDetail?.assignee_id) {
        finalRes = await taskService.assignTask(task.id, assignee_id);
      }
      return finalRes;
    },
    onMutate: async (data) => {
      await qc.cancelQueries({ queryKey: ['task', task.id] });
      await qc.cancelQueries({ queryKey: ['tasks', projectId] });

      const previousTask = qc.getQueryData(['task', task.id]);
      const previousTasks = qc.getQueryData(['tasks', projectId]);

      qc.setQueryData(['task', task.id], (old) => ({ ...old, ...data }));
      qc.setQueryData(['tasks', projectId], (old) =>
        old?.map((t) => (t.id === task.id ? { ...t, ...data } : t))
      );

      return { previousTask, previousTasks };
    },
    onError: (err, variables, context) => {
      if (context?.previousTask) qc.setQueryData(['task', task.id], context.previousTask);
      if (context?.previousTasks) qc.setQueryData(['tasks', projectId], context.previousTasks);
      console.error('Update status error:', err);
      toast.error(t('common.error'), { description: getApiError(err, t('common.error')) });
    },
    onSuccess: (updatedTask) => {
      qc.setQueryData(['task', task.id], (old) => ({ ...old, ...updatedTask }));
      qc.setQueryData(['tasks', projectId], (old) =>
        old?.map((t) => (t.id === task.id ? { ...t, ...updatedTask } : t))
      );
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['task', task.id] });
      qc.invalidateQueries({ queryKey: ['tasks', projectId] });
    },
  });

  const handleEditClick = () => {
    setDraftTask({
      title: taskDetail?.title || '',
      description: taskDetail?.description || '',
      type: taskDetail?.type || 'task',
      priority: taskDetail?.priority || 'medium',
      deadline: taskDetail?.deadline ? new Date(taskDetail.deadline).toISOString() : null,
      assignee_id: taskDetail?.assignee_id || null,
      estimated_hours: taskDetail?.estimated_hours || null,
      story_points: taskDetail?.story_points || null,
      auto_start: taskDetail?.auto_start || false,
      status: taskDetail?.status || 'todo',
    });
    setIsEditing(true);
  };

  const handleSaveClick = () => {
    if (draftTask.status !== taskDetail.status) {
      updateStatusMutation.mutate({ status: draftTask.status });
    }
    const { status: _status, ...restDraft } = draftTask;
    updateTaskMutation.mutate(restDraft);
    setIsEditing(false);
  };

  const addCommentMutation = useMutation({
    onError: (err) =>
      toast.error(t('common.error'), { description: getApiError(err, t('common.error')) }),
    mutationFn: (content) => taskService.addComment(task.id, content),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comments', task.id] });
      setComment('');
    },
  });

  const deleteMutation = useMutation({
    onError: (err) =>
      toast.error(t('common.error'), { description: getApiError(err, t('common.error')) }),
    mutationFn: () => taskService.deleteTask(task.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks', projectId] });
      onClose();
    },
  });

  const addSubtaskMutation = useMutation({
    onError: (err) =>
      toast.error(t('common.error'), { description: getApiError(err, t('common.error')) }),
    mutationFn: (title) =>
      taskService.createTask({
        title,
        project_id: projectId,
        parent_task_id: task.id,
        sprint_id: taskDetail?.sprint_id || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task', task.id] });
      qc.invalidateQueries({ queryKey: ['tasks', projectId] });
      setNewSubtask('');
    },
  });

  const aiBreakdownMutation = useMutation({
    mutationFn: () => taskService.requestAIBreakdown(task.id),
    onSuccess: () => {
      setIsAiGeneratingSubtasks(true);
      toast.success(t('taskDetail.ai_breakdown_started'), { icon: '✨' });
      setTimeout(() => setIsAiGeneratingSubtasks(false), 20000);
    },
    onError: () => {
      toast.error(t('taskDetail.ai_error'));
      setIsAiGeneratingSubtasks(false);
    },
  });

  const aiEstimateMutation = useMutation({
    mutationFn: () => taskService.requestAIEstimate(task.id),
    onSuccess: () => {
      setIsAiEstimating(true);
      toast.success(t('taskDetail.ai_estimate_started'), { icon: '✨' });
      setTimeout(() => setIsAiEstimating(false), 20000);
    },
    onError: () => {
      toast.error(t('taskDetail.ai_error'));
      setIsAiEstimating(false);
    },
  });

  useEffect(() => {
    if (isAiGeneratingSubtasks) {
      setIsAiGeneratingSubtasks(false);
      aiService.getLatestMetric(projectId, task.id, 'breakdown').then((metric) => {
        if (metric) {
          setPendingBreakdownMetricId(metric.id);
          toast(
            t('taskDetail.ai_created_subtasks', {
              n: metric.output_data?.count || '',
              defaultValue: '✨ AI created {{n}} subtasks',
            }),
            {
              duration: 30000,
              action: {
                label: t('taskDetail.ai_keep', '👍 Keep'),
                onClick: () => {
                  aiService.submitFeedback(projectId, metric.id, 'applied').then(() => {
                    qc.invalidateQueries({ queryKey: ['ai-metrics', projectId] });
                    qc.invalidateQueries({ queryKey: ['task', task.id] });
                  });
                  setPendingBreakdownMetricId(null);
                  toast.success(t('taskDetail.ai_kept', 'Subtasks kept'));
                },
              },
              cancel: {
                label: t('taskDetail.ai_undo', '👎 Undo'),
                onClick: () => {
                  aiService.submitFeedback(projectId, metric.id, 'rejected').then(() => {
                    qc.invalidateQueries({ queryKey: ['tasks', projectId] });
                    qc.invalidateQueries({ queryKey: ['ai-metrics', projectId] });
                    qc.invalidateQueries({ queryKey: ['task', task.id] });
                  });
                  setPendingBreakdownMetricId(null);
                  toast.success(t('taskDetail.ai_undone', 'AI subtasks undone'));
                },
              },
            }
          );
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskDetail?.subtasks]);
  useEffect(() => {
    if (isAiEstimating) {
      setIsAiEstimating(false);
      aiService.getLatestMetric(projectId, task.id, 'estimate').then((metric) => {
        if (metric) {
          setPendingEstimateMetricId(metric.id);
          toast(
            t('taskDetail.ai_estimated', {
              points: metric.output_data?.story_points || '?',
              defaultValue: '✨ AI estimate: {{points}} story points',
            }),
            {
              duration: 30000,
              action: {
                label: t('taskDetail.ai_agree', '👍 Agree'),
                onClick: () => {
                  aiService.submitFeedback(projectId, metric.id, 'applied');
                  setPendingEstimateMetricId(null);
                  qc.invalidateQueries({ queryKey: ['ai-metrics', projectId] });
                },
              },
              cancel: {
                label: t('taskDetail.ai_inaccurate', '👎 Not accurate'),
                onClick: () => {
                  aiService.submitFeedback(projectId, metric.id, 'rejected');
                  setPendingEstimateMetricId(null);
                  qc.invalidateQueries({ queryKey: ['ai-metrics', projectId] });
                },
              },
            }
          );
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskDetail?.story_points, taskDetail?.updated_at]);

  const addDependencyMutation = useMutation({
    mutationFn: (dependsOnId) => taskService.addDependency(task.id, dependsOnId),
    onMutate: async (dependsOnId) => {
      await qc.cancelQueries({ queryKey: ['task', task.id] });
      const previousTask = qc.getQueryData(['task', task.id]);
      const newDep = availableDependencies.find((t) => t.id === dependsOnId);
      if (newDep) {
        qc.setQueryData(['task', task.id], (old) => {
          if (!old) return old;
          return { ...old, dependencies: [...(old.dependencies || []), newDep] };
        });
      }
      return { previousTask };
    },
    onError: (err, variables, context) => {
      if (context?.previousTask) qc.setQueryData(['task', task.id], context.previousTask);
      console.error('Add dependency error:', err);
      toast.error(t('common.error'), { description: getApiError(err, t('common.error')) });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['task', task.id] });
    },
  });

  const removeDependencyMutation = useMutation({
    mutationFn: (dependsOnId) => taskService.removeDependency(task.id, dependsOnId),
    onMutate: async (dependsOnId) => {
      await qc.cancelQueries({ queryKey: ['task', task.id] });
      const previousTask = qc.getQueryData(['task', task.id]);
      qc.setQueryData(['task', task.id], (old) => {
        if (!old) return old;
        return {
          ...old,
          dependencies: (old.dependencies || []).filter((d) => d.id !== dependsOnId),
        };
      });
      return { previousTask };
    },
    onError: (err, variables, context) => {
      if (context?.previousTask) qc.setQueryData(['task', task.id], context.previousTask);
      toast.error(t('common.error'), {
        description: t('taskDetail.remove_dep_failed', 'Could not remove the dependency'),
      });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['task', task.id] });
    },
  });

  const currentStatus =
    STATUS_OPTIONS.find((s) => s.value === taskDetail?.status) || STATUS_OPTIONS[0];
  const isOverdue =
    taskDetail?.deadline &&
    new Date(taskDetail.deadline) < new Date() &&
    taskDetail.status !== 'done';

  const handleSubmitComment = (e) => {
    e.preventDefault();
    if (!comment.trim()) return;
    addCommentMutation.mutate(comment.trim());
  };

  const container = document.getElementById('app-main-area') || document.body;
  const isPortalMain = container.id === 'app-main-area';

  return createPortal(
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className={`${isPortalMain ? 'absolute rounded-[inherit]' : 'fixed'} inset-0 bg-background/60 backdrop-blur-sm z-40`}
      />

      <motion.div
        role="dialog"
        initial={{ opacity: 0, x: 32 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 32 }}
        transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
        data-side-panel
        className={`${isPortalMain ? 'absolute' : 'fixed'} right-0 sm:right-4 top-0 sm:top-4 bottom-0 sm:bottom-4 w-[100%] sm:w-full max-w-lg ${isGlass ? '' : 'bg-background'} border border-border/50 shadow-2xl shadow-black/40 sm:rounded-2xl z-50 flex flex-col overflow-hidden glass-surface`}
      >
        <div
          className={`flex items-start justify-between px-5 py-4 border-b border-border ${isGlass ? 'bg-transparent' : 'bg-card'}`}
        >
          <div className="flex-1 pr-4">
            <Badge
              variant="glass"
              className={`px-2 py-0.5 rounded-sm uppercase tracking-wider text-[10px] border-none ${currentStatus.color}`}
            >
              {currentStatus.label}
            </Badge>
            {isEditing ? (
              <input
                type="text"
                autoFocus
                className="mt-2 block w-full text-lg font-bold text-foreground bg-muted/30 border border-border/50 rounded-md px-2 py-1 focus:bg-background focus:outline-none focus:ring-2 focus:ring-[color:var(--color-ai)]"
                value={draftTask.title || ''}
                onChange={(e) => setDraftTask({ ...draftTask, title: e.target.value })}
                placeholder={t('createTask.name_placeholder', 'Enter task name...')}
              />
            ) : (
              <h2 className="mt-2 text-lg font-bold text-foreground leading-tight tracking-tight px-2">
                {taskDetail?.title}
              </h2>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {can('task.delete') && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowDeleteConfirm(true)}
                className="w-7 h-7 text-muted-foreground hover:text-[color:var(--color-destructive)] hover:bg-[color:var(--color-destructive)]/10"
                title={t('taskDetail.delete_task')}
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="w-7 h-7 text-muted-foreground hover:text-foreground"
              title={t('taskDetail.close')}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div
          className={`flex border-b border-border px-4 ${isGlass ? 'bg-white/5 dark:bg-white/5' : 'bg-card'}`}
        >
          {[
            { id: 'details', label: t('taskDetail.title'), icon: Edit3 },
            {
              id: 'subtasks',
              label: `${t('taskDetail.subtasks')} (${taskDetail?.subtasks?.length || 0})`,
              icon: CheckSquare,
            },
            { id: 'comments', label: t('taskDetail.comments'), icon: MessageSquare },
          ]
            .filter((tab) => !(tab.id === 'subtasks' && taskDetail?.parent_task_id))
            .map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-[12px] font-medium border-b-2 transition-colors focus:outline-none ${
                  activeTab === tab.id
                    ? 'border-[color:var(--color-ai)] text-[color:var(--color-ai)]'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            ))}
        </div>

        <div
          className={`flex-1 overflow-y-auto pb-16 ${isGlass ? 'bg-transparent' : 'bg-background'}`}
        >
          <AnimatePresence mode="wait">
            {activeTab === 'details' && (
              <motion.div
                key="details"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="p-5 space-y-5"
              >
                <div className="flex justify-between items-center">
                  <h3 className="text-[13px] font-semibold text-foreground">
                    {t('taskDetail.title')}
                  </h3>
                  {!isEditing ? (
                    can('task.update') && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleEditClick}
                        className="h-7 text-[11px] bg-[color:var(--color-primary)]/10 text-[color:var(--color-primary)] hover:bg-[color:var(--color-primary)]/20 hover:text-[color:var(--color-primary)] gap-1.5"
                      >
                        <Edit3 className="w-3.5 h-3.5" /> {t('taskDetail.edit')}
                      </Button>
                    )
                  ) : (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsEditing(false)}
                        className="h-7 text-[11px]"
                      >
                        {t('taskDetail.cancel')}
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSaveClick}
                        className="h-7 text-[11px] bg-[color:var(--color-ai)] hover:bg-[color:var(--color-ai)]/90 gap-1.5"
                      >
                        {t('taskDetail.save')}
                      </Button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-[10px] font-mono font-semibold text-muted-foreground uppercase tracking-widest">
                    {t('taskDetail.description')}
                  </label>
                  {isEditing ? (
                    <textarea
                      className="mt-1.5 w-full p-3 rounded-lg bg-muted/30 text-[13px] text-foreground leading-relaxed border border-border/50 focus:bg-background focus:ring-1 focus:ring-[color:var(--color-ai)] outline-none resize-y min-h-[80px]"
                      placeholder={t('taskDetail.no_description')}
                      value={draftTask.description || ''}
                      onChange={(e) => setDraftTask({ ...draftTask, description: e.target.value })}
                    />
                  ) : (
                    <div className="mt-1.5 p-3 rounded-lg bg-muted/30 text-[13px] text-foreground leading-relaxed border border-border/50 whitespace-pre-wrap">
                      {taskDetail?.description || (
                        <span className="text-muted-foreground italic">
                          {t('taskDetail.no_description')}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-[10px] font-mono font-semibold text-muted-foreground uppercase tracking-widest">
                    {t('taskDetail.status')}
                  </label>
                  <div className="mt-2">
                    {isEditing ? (
                      <CustomSelect
                        options={STATUS_OPTIONS.map((opt) => ({
                          value: opt.value,
                          label: opt.label,
                          icon: (
                            <span
                              className={`w-2 h-2 rounded-full inline-block ${opt.color.split(' ')[0]}`}
                            />
                          ),
                        }))}
                        value={draftTask.status || 'todo'}
                        onChange={(val) => setDraftTask({ ...draftTask, status: val })}
                      />
                    ) : (
                      <div className="flex gap-2">
                        <Badge
                          variant="outline"
                          className={`px-3 py-1 text-[11px] font-medium border ${currentStatus.color}`}
                        >
                          {currentStatus.label}
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-muted/30 border border-border/60 rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <p className="text-[12px] font-semibold text-foreground">
                      {t('taskDetail.auto_start')}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {t('taskDetail.auto_start_desc')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (isEditing)
                        setDraftTask({ ...draftTask, auto_start: !draftTask.auto_start });
                      else updateTaskMutation.mutate({ auto_start: !taskDetail?.auto_start });
                    }}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[color:var(--color-ai)] focus:ring-offset-2 ${
                      (isEditing ? draftTask.auto_start : taskDetail?.auto_start)
                        ? 'bg-[color:var(--color-success)]'
                        : 'bg-muted-foreground/30'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        (isEditing ? draftTask.auto_start : taskDetail?.auto_start)
                          ? 'translate-x-4'
                          : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-muted/30 border border-border/60 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5">
                      <Shapes className="w-3.5 h-3.5" /> {t('taskType.label')}
                    </div>
                    {isEditing ? (
                      <CustomSelect
                        options={TASK_TYPES.filter(
                          (type) => type !== 'story' || !taskDetail?.parent_task_id
                        ).map((value) => ({ value, label: t(`taskType.${value}`) }))}
                        value={draftTask.type || 'task'}
                        onChange={(val) => setDraftTask({ ...draftTask, type: val })}
                      />
                    ) : (
                      <TaskTypeBadge type={taskDetail?.type} showLabel />
                    )}
                  </div>

                  <div className="bg-muted/30 border border-border/60 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5">
                      <Flag className="w-3.5 h-3.5" /> {t('taskDetail.priority')}
                    </div>
                    {isEditing ? (
                      <CustomSelect
                        options={PRIORITY_OPTIONS.map((p) => ({
                          value: p.value,
                          label: p.label,
                          icon: (
                            <span className="text-[10px]">
                              {p.value === 'high' ? '🔴' : p.value === 'medium' ? '🟡' : '🟢'}
                            </span>
                          ),
                        }))}
                        value={draftTask.priority || 'medium'}
                        onChange={(val) => setDraftTask({ ...draftTask, priority: val })}
                      />
                    ) : (
                      <PriorityBadge priority={taskDetail?.priority} />
                    )}
                  </div>

                  <div
                    className={`rounded-lg p-3 border ${isOverdue ? 'bg-[color:var(--color-destructive)]/5 border-[color:var(--color-destructive)]/20' : 'bg-muted/30 border-border/60'}`}
                  >
                    <div
                      className={`flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest mb-1.5 ${isOverdue ? 'text-[color:var(--color-destructive)]' : 'text-muted-foreground'}`}
                    >
                      <Calendar className="w-3.5 h-3.5" /> {t('taskDetail.deadline')}
                    </div>
                    {isEditing ? (
                      <DatePicker
                        size="sm"
                        value={
                          draftTask.deadline
                            ? format(new Date(draftTask.deadline), 'yyyy-MM-dd')
                            : ''
                        }
                        onChange={(e) => {
                          const val = e.target.value;
                          if (!val) {
                            setDraftTask({ ...draftTask, deadline: null });
                          } else {
                            const d = new Date(`${val}T23:59:59`);
                            if (!isNaN(d.getTime())) {
                              setDraftTask({ ...draftTask, deadline: d.toISOString() });
                            }
                          }
                        }}
                        inputClassName={`bg-transparent font-semibold font-mono ${isOverdue ? 'text-[color:var(--color-destructive)]' : ''}`}
                      />
                    ) : (
                      <p
                        className={`text-[13px] font-semibold ${isOverdue ? 'text-[color:var(--color-destructive)]' : 'text-foreground font-mono'}`}
                      >
                        {taskDetail?.deadline
                          ? format(new Date(taskDetail.deadline), 'dd/MM/yyyy HH:mm', {
                              locale: dateFnsLocale,
                            })
                          : t('taskDetail.not_set')}
                        {isOverdue && ' ⚠️'}
                      </p>
                    )}
                  </div>

                  {settings.enable_members !== false && (
                    <div className="bg-muted/30 border border-border/60 rounded-lg p-3">
                      <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5">
                        <UserIcon className="w-3.5 h-3.5" /> {t('taskDetail.assignee')}
                      </div>
                      {isEditing ? (
                        <CustomSelect
                          options={[
                            { value: '', label: t('taskDetail.unassigned') },
                            ...members.map((m) => ({
                              value: m.user_id,
                              label: m.user?.full_name || m.user?.email,
                            })),
                          ]}
                          value={draftTask.assignee_id || ''}
                          onChange={(val) =>
                            setDraftTask({ ...draftTask, assignee_id: val || null })
                          }
                        />
                      ) : (
                        <p className="text-[13px] font-medium text-foreground truncate max-w-[150px]">
                          {taskDetail?.assignee_id
                            ? members.find((m) => m.user_id === taskDetail.assignee_id)?.user
                                ?.full_name
                            : t('taskDetail.unassigned')}
                        </p>
                      )}
                    </div>
                  )}

                  {(settings.enable_story_points !== false ||
                    settings.enable_time_tracking !== false) && (
                    <div className="bg-muted/30 border border-border/60 rounded-lg p-3 relative group flex flex-col gap-3">
                      {settings.enable_story_points !== false && (
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                              <Sparkles className="w-3.5 h-3.5" /> Story Points
                            </div>
                            {!isEditing && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => aiEstimateMutation.mutate()}
                                disabled={aiEstimateMutation.isPending}
                                className="opacity-0 group-hover:opacity-100 transition-opacity h-6 text-[10px] bg-[color:var(--color-ai)]/10 text-[color:var(--color-ai)] px-1.5 py-0 border-[color:var(--color-ai)]/20 hover:bg-[color:var(--color-ai)]/20 hover:text-[color:var(--color-ai)] gap-1"
                                title={t(
                                  'taskDetail.ai_estimate_title',
                                  'AI auto-estimate (Fibonacci)'
                                )}
                              >
                                {aiEstimateMutation.isPending ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Sparkles className="w-3 h-3" />
                                )}{' '}
                                AI
                              </Button>
                            )}
                          </div>
                          {isEditing ? (
                            <input
                              type="number"
                              min="0"
                              step="1"
                              className="bg-transparent outline-none text-[13px] font-mono font-medium text-foreground w-full placeholder:text-muted-foreground"
                              placeholder="Fibonacci (1, 2, 3, 5, 8...)"
                              value={draftTask.story_points ?? ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setDraftTask({
                                  ...draftTask,
                                  story_points: val === '' ? null : val,
                                });
                              }}
                            />
                          ) : (
                            <p className="text-[13px] font-medium text-foreground font-mono">
                              {isAiEstimating ? (
                                <span className="animate-pulse text-[color:var(--color-ai)] flex items-center gap-1.5">
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />{' '}
                                  {t('taskDetail.ai_calculating', 'AI is calculating...')}
                                </span>
                              ) : taskDetail?.story_points ? (
                                `${taskDetail.story_points} points`
                              ) : (
                                t('taskDetail.not_set')
                              )}
                            </p>
                          )}
                        </div>
                      )}

                      {settings.enable_story_points !== false &&
                        settings.enable_time_tracking !== false && (
                          <div className="h-px bg-border/50 -mx-3" />
                        )}

                      {settings.enable_time_tracking !== false && (
                        <div>
                          <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5">
                            <Clock className="w-3.5 h-3.5" /> {t('taskDetail.estimated_hours')}
                          </div>
                          {isEditing ? (
                            <input
                              type="number"
                              min="0"
                              step="0.5"
                              className="bg-transparent outline-none text-[13px] font-mono font-medium text-foreground w-full placeholder:text-muted-foreground"
                              placeholder="e.g. 2.5"
                              value={draftTask.estimated_hours ?? ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setDraftTask({
                                  ...draftTask,
                                  estimated_hours: val === '' ? null : val,
                                });
                              }}
                            />
                          ) : (
                            <p className="text-[13px] font-medium text-foreground font-mono">
                              {taskDetail?.estimated_hours
                                ? `${taskDetail.estimated_hours}h`
                                : t('taskDetail.not_set')}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Dependencies */}
                <div>
                  <label className="text-[10px] font-mono font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                    <GitBranch className="w-3.5 h-3.5" /> {t('taskDetail.dependencies')}
                  </label>
                  <div className="mt-2.5 bg-muted/20 border border-border rounded-lg p-3">
                    <div className="space-y-2 mb-3">
                      {taskDetail?.dependencies?.map((dep) => (
                        <div
                          key={dep.id}
                          className="flex items-center justify-between text-[12px] text-foreground bg-card shadow-sm border border-border/50 px-3 py-2.5 rounded-md hover:border-[color:var(--color-ai)]/40 transition-colors group"
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-full bg-[color:var(--color-warning)]/10 flex items-center justify-center">
                              <Clock className="w-3 h-3 text-[color:var(--color-warning)]" />
                            </div>
                            <span className="font-medium">{dep.title}</span>
                          </div>
                          {isEditing && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeDependencyMutation.mutate(dep.id)}
                              disabled={removeDependencyMutation.isPending}
                              className="opacity-0 group-hover:opacity-100 w-6 h-6 text-muted-foreground hover:text-[color:var(--color-destructive)] hover:bg-[color:var(--color-destructive)]/10"
                              title={t('taskDetail.remove_dep', 'Remove dependency')}
                            >
                              {removeDependencyMutation.isPending ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <X className="w-3 h-3" />
                              )}
                            </Button>
                          )}
                        </div>
                      ))}
                      {(!taskDetail?.dependencies || taskDetail?.dependencies?.length === 0) && (
                        <p className="text-[11px] text-muted-foreground italic px-1 text-center py-2">
                          {t('taskDetail.no_dependents', 'No dependent tasks.')}
                        </p>
                      )}
                    </div>

                    {isEditing && (
                      <div className="mt-2 relative">
                        <CustomSelect
                          options={availableDependencies.map((t) => ({
                            value: t.id,
                            label: t.title,
                          }))}
                          value=""
                          onChange={(val) => {
                            if (val) addDependencyMutation.mutate(val);
                          }}
                          placeholder={t('taskDetail.add_dependency')}
                          icon={<Plus className="w-3.5 h-3.5 text-[color:var(--color-ai)]" />}
                          disabled={addDependencyMutation.isPending}
                          dropdownClassName="bottom-full mb-1"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'subtasks' && (
              <motion.div
                key="subtasks"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="p-5 space-y-4"
              >
                {!taskDetail?.subtasks || taskDetail.subtasks.length === 0 ? (
                  <div className="text-center py-10 bg-muted/20 border border-border rounded-lg border-dashed">
                    <CheckSquare className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-50" />
                    <p className="text-[12px] text-muted-foreground mb-4">
                      {t('taskDetail.no_subtasks')}
                    </p>
                    <Button
                      onClick={() => aiBreakdownMutation.mutate()}
                      disabled={aiBreakdownMutation.isPending || isAiGeneratingSubtasks}
                      className="gap-1.5 text-[12px] bg-[color:var(--color-ai)] hover:bg-[color:var(--color-ai)]/90 h-8"
                    >
                      {aiBreakdownMutation.isPending || isAiGeneratingSubtasks ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4" />
                      )}
                      {isAiGeneratingSubtasks
                        ? t('taskDetail.ai_processing', 'AI processing...')
                        : t('taskDetail.ai_breakdown_btn', 'AI Breakdown')}
                    </Button>
                  </div>
                ) : (
                  <div className="bg-card border border-border rounded-lg overflow-hidden shadow-sm">
                    {/* Progress Header */}
                    <div className="px-4 py-3 bg-muted/20 border-b border-border flex items-center justify-between">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {t('taskDetail.subtask_progress', 'Sub-task progress')}
                      </span>
                      <div className="flex items-center gap-3">
                        {!isEditing && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (taskDetail?.subtasks?.length > 0) {
                                setShowAiRegenConfirm(true);
                              } else {
                                aiBreakdownMutation.mutate();
                              }
                            }}
                            disabled={aiBreakdownMutation.isPending || isAiGeneratingSubtasks}
                            className="h-6 text-[10px] bg-[color:var(--color-ai)]/10 text-[color:var(--color-ai)] border-[color:var(--color-ai)]/20 hover:bg-[color:var(--color-ai)]/20 hover:text-[color:var(--color-ai)] gap-1 px-2"
                          >
                            {aiBreakdownMutation.isPending || isAiGeneratingSubtasks ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Sparkles className="w-3.5 h-3.5" />
                            )}
                            {isAiGeneratingSubtasks
                              ? t('taskDetail.ai_thinking', 'AI is thinking...')
                              : taskDetail?.subtasks?.length > 0
                                ? t('taskDetail.ai_regen', { defaultValue: 'Regenerate (AI)' })
                                : t('taskDetail.ai_breakdown', { defaultValue: 'AI Breakdown' })}
                          </Button>
                        )}
                        <span className="text-[12px] font-medium">
                          {(taskDetail.subtasks || []).filter((s) => s.status === 'done').length} /{' '}
                          {taskDetail.subtasks.length}
                        </span>
                      </div>
                    </div>
                    <div className="h-1 bg-muted w-full">
                      <div
                        className="h-full bg-[color:var(--color-success)] transition-all duration-500"
                        style={{
                          width: `${((taskDetail.subtasks || []).filter((s) => s.status === 'done').length / Math.max(1, taskDetail.subtasks?.length || 1)) * 100}%`,
                        }}
                      />
                    </div>
                    {/* List */}
                    <div className="divide-y divide-border">
                      {taskDetail?.subtasks?.map((sub) => (
                        <div
                          key={sub.id}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors group"
                        >
                          <button
                            onClick={async () => {
                              const newStatus = sub.status === 'done' ? 'todo' : 'done';

                              await qc.cancelQueries({ queryKey: ['task', task.id] });
                              await qc.cancelQueries({ queryKey: ['tasks', projectId] });

                              // Optimistic update for modal
                              qc.setQueryData(['task', task.id], (old) => {
                                if (!old || !old.subtasks) return old;
                                return {
                                  ...old,
                                  subtasks: old.subtasks.map((s) =>
                                    s.id === sub.id ? { ...s, status: newStatus } : s
                                  ),
                                };
                              });

                              // Optimistic update for kanban board
                              qc.setQueryData(['tasks', projectId], (old) => {
                                if (!old) return old;
                                return old.map((t) => {
                                  let updated = t;
                                  if (t.id === task.id && t.subtasks) {
                                    updated = {
                                      ...t,
                                      subtasks: t.subtasks.map((s) =>
                                        s.id === sub.id ? { ...s, status: newStatus } : s
                                      ),
                                    };
                                  }
                                  if (updated.id === sub.id) {
                                    updated = {
                                      ...updated,
                                      status: newStatus,
                                    };
                                  }
                                  return updated;
                                });
                              });

                              // API Call
                              taskService
                                .updateStatus(sub.id, newStatus)
                                .then(() => {
                                  qc.invalidateQueries({ queryKey: ['task', task.id] });
                                  qc.invalidateQueries({ queryKey: ['tasks', projectId] });
                                })
                                .catch(() => {
                                  qc.invalidateQueries({ queryKey: ['task', task.id] });
                                  qc.invalidateQueries({ queryKey: ['tasks', projectId] });
                                });
                            }}
                            className={`w-4 h-4 rounded-[3px] border flex items-center justify-center flex-shrink-0 cursor-pointer transition-colors ${
                              sub.status === 'done'
                                ? 'bg-[color:var(--color-success)] border-[color:var(--color-success)] text-white'
                                : 'border-muted-foreground/50 hover:border-[color:var(--color-ai)] bg-background'
                            }`}
                          >
                            {sub.status === 'done' && (
                              <span className="text-[10px] font-bold">✓</span>
                            )}
                          </button>
                          <p
                            className={`text-[13px] flex-1 font-medium ${sub.status === 'done' ? 'line-through text-muted-foreground' : 'text-foreground'}`}
                          >
                            {sub.title}
                          </p>
                        </div>
                      ))}
                      {isAiGeneratingSubtasks && taskDetail?.subtasks?.length > 0 && (
                        <div className="flex items-center gap-3 px-4 py-3 bg-[color:var(--color-ai)]/5 animate-pulse">
                          <Loader2 className="w-4 h-4 text-[color:var(--color-ai)] animate-spin flex-shrink-0" />
                          <span className="text-[12px] font-medium text-[color:var(--color-ai)]">
                            {t(
                              'taskDetail.ai_breakdown_started',
                              'AI is analyzing and generating sub-tasks...'
                            )}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (newSubtask.trim()) addSubtaskMutation.mutate(newSubtask.trim());
                  }}
                  className="mt-4 flex items-center gap-2"
                >
                  <div className="flex-1 relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Plus className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <input
                      value={newSubtask}
                      onChange={(e) => setNewSubtask(e.target.value)}
                      placeholder={t('taskDetail.add_subtask')}
                      className="w-full bg-background border border-border rounded-lg pl-9 pr-3 py-2 text-[12px] focus:outline-none focus:border-[color:var(--color-ai)] focus:ring-1 focus:ring-[color:var(--color-ai)] shadow-sm"
                      disabled={addSubtaskMutation.isPending}
                    />
                  </div>
                </form>
              </motion.div>
            )}

            {activeTab === 'comments' && (
              <motion.div
                key="comments"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col h-full"
              >
                <div className="flex-1 p-4 space-y-4 overflow-y-auto scrollbar-thin">
                  {comments.length === 0 && (
                    <div className="text-center py-10 text-muted-foreground/50">
                      <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-[11px]">{t('taskDetail.no_comments')}</p>
                    </div>
                  )}
                  {comments.map((c) => (
                    <div key={c.id} className="flex gap-2.5">
                      <div className="w-7 h-7 bg-[color:var(--color-ai)]/10 rounded-full flex items-center justify-center flex-shrink-0">
                        <UserIcon className="w-3.5 h-3.5 text-[color:var(--color-ai)]" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="text-[12px] font-semibold text-foreground">
                            {t('common.you', 'You')}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {format(new Date(c.created_at), 'HH:mm dd/MM', {
                              locale: dateFnsLocale,
                            })}
                          </span>
                        </div>
                        <div className="bg-muted/50 border border-border rounded-lg rounded-tl-none px-3 py-2 text-[13px] text-foreground">
                          {c.content}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Comment input */}
                <form onSubmit={handleSubmitComment} className="p-3 border-t border-border bg-card">
                  <div className="flex gap-2">
                    <div className="w-7 h-7 bg-[color:var(--color-ai)]/10 rounded-full flex items-center justify-center flex-shrink-0">
                      <UserIcon className="w-3.5 h-3.5 text-[color:var(--color-ai)]" />
                    </div>
                    <div className="flex-1 flex gap-2">
                      <input
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder={t('taskDetail.add_comment')}
                        className="flex-1 bg-background border border-border rounded-md px-3 py-1.5 text-[12px] text-foreground focus:outline-none focus:ring-1 focus:ring-[color:var(--color-ai)]"
                      />
                      <Button
                        type="submit"
                        disabled={!comment.trim() || addCommentMutation.isPending}
                        className="bg-[color:var(--color-ai)] hover:bg-[color:var(--color-ai)]/90 h-9 px-3"
                      >
                        {addCommentMutation.isPending ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Send className="w-3.5 h-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      <ConfirmDeleteDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={() => {
          deleteMutation.mutate();
          setShowDeleteConfirm(false);
        }}
        title={t('taskDetail.delete_title', { defaultValue: 'Delete Task' })}
        description={t('taskDetail.delete_desc', {
          defaultValue: `Task "{{title}}" and all its subtasks and comments will be permanently deleted.`,
          title: taskDetail?.title,
        })}
        isDeleting={deleteMutation.isPending}
      />

      <ConfirmDeleteDialog
        isOpen={showAiRegenConfirm}
        onClose={() => setShowAiRegenConfirm(false)}
        onConfirm={() => {
          if (pendingBreakdownMetricId) {
            aiService.submitFeedback(projectId, pendingBreakdownMetricId, 'rejected');
            setPendingBreakdownMetricId(null);
            toast.dismiss(); // dismiss the old feedback toast
          }
          aiBreakdownMutation.mutate();
          setShowAiRegenConfirm(false);
        }}
        title={t('taskDetail.ai_regen_title', { defaultValue: 'Regenerate Subtasks (AI)' })}
        description={t('taskDetail.ai_regen_desc', {
          defaultValue:
            'This action deletes the current Todo subtasks and creates new ones. Done subtasks are kept.',
        })}
        confirmWord="regen"
        isDeleting={aiBreakdownMutation.isPending}
        confirmLabel={t('taskDetail.ai_regen_confirm_btn', { defaultValue: 'Regenerate' })}
      />
    </>,
    container
  );
}
