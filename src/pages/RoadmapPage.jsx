import { useState } from 'react';
import DatePicker from '@/components/ui/DatePicker';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  Layers,
  Plus,
  Trash2,
  Edit3,
  Loader2,
  CheckCircle2,
  Circle,
  Clock,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import epicService from '@/services/epicService';
import projectService from '@/services/projectService';
import { useAuth } from '@/hooks/useAuth';
import { useProjectPermissions } from '@/hooks/useProjectPermissions';
import { getApiError } from '@/lib/apiError';
import taskService from '@/services/taskService';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import CustomSelect from '@/components/ui/CustomSelect';
import { Modal } from '@/components/ui/Modal';
import { toast } from 'sonner';
import { ConfirmDeleteDialog } from '@/components/ui/ConfirmDeleteDialog';

export default function RoadmapPage() {
  const { id: projectId } = useParams();
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const activeWorkspaceId = localStorage.getItem('active-workspace-id');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingEpic, setEditingEpic] = useState(null);
  const [expandedEpicId, setExpandedEpicId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Same rule as the API: the project owner or a member with project.settings
  const { user: currentUser } = useAuth();
  const { can } = useProjectPermissions(projectId);
  const { data: project } = useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => projectService.getProject(projectId),
    enabled: !!projectId,
  });
  const canManage = project?.owner_id === currentUser?.id || can('project.settings');

  // Fetch Epics
  const { data: epics = [], isLoading: epicsLoading } = useQuery({
    queryKey: ['epics', projectId],
    queryFn: () => epicService.getEpics({ projectId }),
    enabled: !!projectId,
  });

  // Fetch Tasks to calculate progress and show linked tasks
  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks', projectId],
    queryFn: () => taskService.getTasks(projectId),
    enabled: !!projectId,
  });

  // Delete Epic Mutation
  const deleteMutation = useMutation({
    mutationFn: (epicId) => epicService.deleteEpic(epicId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['epics', projectId] });
      toast.success(t('roadmap.delete_success'));
    },
    onError: (err) => {
      toast.error(getApiError(err, t('roadmap.delete_error')));
    },
  });

  const getEpicStats = (epicId) => {
    const epicTasks = tasks.filter((t) => t.epic_id === epicId && !t.is_deleted);
    const total = epicTasks.length;
    const completed = epicTasks.filter((t) => t.status === 'done').length;
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, progress, tasks: epicTasks };
  };

  const handleDelete = (epicId, e) => {
    e.stopPropagation();
    setDeleteTarget(epics.find((ep) => ep.id === epicId) || { id: epicId });
  };

  const handleEdit = (epic, e) => {
    e.stopPropagation();
    setEditingEpic(epic);
  };

  if (epicsLoading || tasksLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[color:var(--color-ai)]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[color:var(--color-ai)]/10 border border-[color:var(--color-ai)]/20 text-[color:var(--color-ai)]">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              {t('roadmap.title')}
            </h1>
            <p className="text-[12px] text-muted-foreground mt-0.5">{t('roadmap.subtitle')}</p>
          </div>
        </div>
        <Button
          disabled={!canManage}
          onClick={() => setShowCreateModal(true)}
          className="rounded-xl flex items-center gap-1.5 shadow-sm"
        >
          <Plus className="w-4 h-4" /> {t('roadmap.create_epic')}
        </Button>
      </div>

      {/* Epics List */}
      <div className="space-y-3">
        {epics.length === 0 ? (
          <Card className="p-8 text-center glass-surface flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <Layers className="w-6 h-6 text-muted-foreground/50" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{t('roadmap.empty_title')}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t('roadmap.empty_desc')}</p>
            </div>
            <Button
              variant="outline"
              disabled={!canManage}
              onClick={() => setShowCreateModal(true)}
              className="mt-2 text-xs rounded-xl"
            >
              {t('roadmap.create_now')}
            </Button>
          </Card>
        ) : (
          epics.map((epic) => {
            const { total, completed, progress, tasks: epicTasks } = getEpicStats(epic.id);
            const isExpanded = expandedEpicId === epic.id;
            const epicColor = epic.color || '#3b82f6';

            return (
              <Card
                key={epic.id}
                onClick={() => setExpandedEpicId(isExpanded ? null : epic.id)}
                className="overflow-hidden glass-surface border border-border/60 hover:border-border transition-all duration-300 shadow-sm cursor-pointer"
              >
                <div className="p-4 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-1.5 h-8 rounded-full"
                      style={{ backgroundColor: epicColor }}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-foreground truncate max-w-[200px] sm:max-w-md">
                          {epic.name}
                        </span>
                        <Badge
                          variant="outline"
                          className="text-[9px] uppercase font-mono px-1 py-0.5 leading-none"
                        >
                          {epic.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground/80 mt-1 line-clamp-1">
                        {epic.description || t('roadmap.no_description')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end shrink-0">
                    {/* Date */}
                    {epic.due_date && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>
                          {t('roadmap.due_date', {
                            date: new Date(epic.due_date).toLocaleDateString(
                              i18n.language === 'vi' ? 'vi-VN' : 'en-US'
                            ),
                          })}
                        </span>
                      </div>
                    )}

                    {/* Progress */}
                    <div className="flex items-center gap-3 w-40 sm:w-48">
                      <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${progress}%`, backgroundColor: epicColor }}
                        />
                      </div>
                      <span className="text-[11px] font-mono font-bold text-foreground w-12 text-right">
                        {progress}% ({completed}/{total})
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      {canManage && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => handleEdit(epic, e)}
                            className="w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => handleDelete(epic.id, e)}
                            className="w-8 h-8 rounded-lg text-muted-foreground hover:text-rose-500"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      )}
                      <span className="text-muted-foreground/50 ml-1">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Sub-tasks Accordion */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-border/40 bg-muted/10 overflow-hidden"
                    >
                      <div className="p-4 space-y-2">
                        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3">
                          {t('roadmap.linked_tasks', { count: total })}
                        </p>
                        {epicTasks.length === 0 ? (
                          <p className="text-xs text-muted-foreground py-2 italic">
                            {t(
                              'roadmap.no_linked_tasks_hint',
                              'No tasks are linked to this Epic yet. Assign the Epic in the task details.'
                            )}
                          </p>
                        ) : (
                          epicTasks.map((t) => {
                            const isDone = t.status === 'done';
                            return (
                              <div
                                key={t.id}
                                className="flex items-center justify-between p-2.5 rounded-lg border border-border/40 bg-background/50 hover:bg-background/80 transition-colors"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  {isDone ? (
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                                  ) : t.status === 'in_progress' ? (
                                    <Clock className="w-4 h-4 text-[color:var(--color-ai)] shrink-0 animate-pulse-soft" />
                                  ) : (
                                    <Circle className="w-4 h-4 text-muted-foreground/50 shrink-0" />
                                  )}
                                  <span
                                    className={`text-[12px] font-medium truncate ${isDone ? 'line-through text-muted-foreground/75' : 'text-foreground'}`}
                                  >
                                    {t.title}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                  <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">
                                    {t.status}
                                  </span>
                                  {t.deadline && (
                                    <span className="text-[10px] text-muted-foreground">
                                      {new Date(t.deadline).toLocaleDateString('vi-VN')}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            );
          })
        )}
      </div>

      {/* Create / Edit Modal */}
      <AnimatePresence>
        {(showCreateModal || editingEpic) && (
          <EpicFormModal
            workspaceId={activeWorkspaceId}
            projectId={projectId}
            epic={editingEpic}
            onClose={() => {
              setShowCreateModal(false);
              setEditingEpic(null);
            }}
          />
        )}
      </AnimatePresence>

      <ConfirmDeleteDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          deleteMutation.mutate(deleteTarget.id);
          setDeleteTarget(null);
        }}
        title={t('roadmap.delete_title', 'Delete Epic')}
        description={t('roadmap.delete_desc', {
          name: deleteTarget?.name,
          defaultValue: 'Epic "{{name}}" will be permanently deleted.',
        })}
        isDeleting={deleteMutation.isPending}
      />
    </div>
  );
}

function EpicFormModal({ workspaceId, projectId, epic, onClose }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [name, setName] = useState(epic?.name || '');
  const [description, setDescription] = useState(epic?.description || '');
  const [color, setColor] = useState(epic?.color || '#3b82f6');
  const [status, setStatus] = useState(epic?.status || 'open');
  const [dueDate, setDueDate] = useState(epic?.due_date || '');

  const isEdit = !!epic;

  const mutation = useMutation({
    mutationFn: (data) =>
      isEdit ? epicService.updateEpic(epic.id, data) : epicService.createEpic(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['epics', projectId] });
      toast.success(
        isEdit
          ? t('roadmap.update_success', 'Epic updated!')
          : t('roadmap.create_success', 'Epic created!')
      );
      onClose();
    },
    onError: (err) => {
      toast.error(getApiError(err, t('roadmap.save_error', 'Could not save the Epic!')));
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    mutation.mutate({
      name: name.trim(),
      description: isEdit ? description.trim() : description.trim() || undefined,
      color,
      status,
      due_date: dueDate || (isEdit ? null : undefined),
      workspace_id: workspaceId,
      project_id: projectId,
    });
  };

  const COLORS = [
    '#3b82f6',
    '#10b981',
    '#f59e0b',
    '#ef4444',
    '#8b5cf6',
    '#ec4899',
    '#6366f1',
    '#14b8a6',
  ];

  return (
    <Modal
      title={
        isEdit ? t('roadmap.edit_epic', 'Edit Epic') : t('roadmap.create_epic', 'Create New Epic')
      }
      onClose={onClose}
      maxWidth="max-w-sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            type="submit"
            form="epic-form"
            disabled={mutation.isPending || !name.trim()}
            size="sm"
          >
            {mutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {t('common.save', 'Save')}
          </Button>
        </div>
      }
    >
      <form id="epic-form" onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
        <div>
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
            {t('roadmap.name_label', 'Epic name')} <span className="text-destructive">*</span>
          </label>
          <input
            type="text"
            required
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('roadmap.name_placeholder', 'e.g. Payments, Main UI...')}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[color:var(--color-ai)] focus:ring-1 focus:ring-[color:var(--color-ai)] transition-all"
          />
        </div>
        <div>
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
            {t('roadmap.description_label', 'Description')}
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('roadmap.desc_placeholder', 'Short description...')}
            rows={2}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[color:var(--color-ai)] focus:ring-1 focus:ring-[color:var(--color-ai)] transition-all resize-none scrollbar-thin"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
              {t('roadmap.status_label', 'Status')}
            </label>
            <CustomSelect
              options={[
                { value: 'open', label: t('roadmap.status_open', 'Open') },
                { value: 'in_progress', label: t('roadmap.status_in_progress', 'In Progress') },
                { value: 'done', label: t('roadmap.status_done', 'Done') },
              ]}
              value={status}
              onChange={setStatus}
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
              {t('roadmap.due_label', 'Due date')}
            </label>
            <DatePicker value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
            {t('roadmap.color_label', 'Epic label color')}
          </label>
          <div className="flex gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className="w-6 h-6 rounded-full border border-black/10 hover:scale-110 transition-transform cursor-pointer relative flex items-center justify-center shrink-0"
                style={{ backgroundColor: c }}
              >
                {color === c && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
              </button>
            ))}
          </div>
        </div>
      </form>
    </Modal>
  );
}
