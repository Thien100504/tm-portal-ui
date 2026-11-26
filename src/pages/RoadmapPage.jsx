import { useMemo, useState } from 'react';
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
  Link2,
  Unlink,
  Search,
  Inbox,
} from 'lucide-react';
import epicService from '@/services/epicService';
import projectService from '@/services/projectService';
import { useAuth } from '@/hooks/useAuth';
import { useProjectPermissions } from '@/hooks/useProjectPermissions';
import { useTaskHierarchy } from '@/hooks/useTaskHierarchy';
import { getApiError } from '@/lib/apiError';
import taskService from '@/services/taskService';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import CustomSelect from '@/components/ui/CustomSelect';
import { Modal } from '@/components/ui/Modal';
import TaskTypeBadge from '@/components/ui/TaskTypeBadge';
import CreateTaskModal from '@/components/CreateTaskModal';
import TaskDetailModal from '@/components/TaskDetailModal';
import { toast } from 'sonner';
import { ConfirmDeleteDialog } from '@/components/ui/ConfirmDeleteDialog';

const NO_EPIC = '__none__';

// A story that has tasks is a container; its progress comes from those tasks
function progressOf(items, childrenOf) {
  const work = items.filter((task) => !(task.type === 'story' && childrenOf(task.id).length));
  const done = work.filter((task) => task.status === 'done').length;
  return {
    total: work.length,
    done,
    percent: work.length ? Math.round((done / work.length) * 100) : 0,
  };
}

function ProgressBar({ percent, done, total, color }) {
  return (
    <div className="flex items-center gap-3 w-40 sm:w-48">
      <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${percent}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-[11px] font-mono font-bold text-foreground w-16 text-right">
        {percent}% ({done}/{total})
      </span>
    </div>
  );
}

function StatusIcon({ status }) {
  if (status === 'done') return <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />;
  if (status === 'in_progress')
    return <Clock className="w-4 h-4 text-[color:var(--color-ai)] shrink-0 animate-pulse-soft" />;
  return <Circle className="w-4 h-4 text-muted-foreground/50 shrink-0" />;
}

function TaskLine({ task, onOpen, onUnlink, unlinkTitle, children, leading }) {
  const { t, i18n } = useTranslation();
  const isDone = task.status === 'done';
  return (
    <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-border/40 bg-background/50 hover:bg-background/80 transition-colors">
      <div className="flex items-center gap-2 min-w-0">
        {leading}
        <StatusIcon status={task.status} />
        <TaskTypeBadge type={task.type} />
        <button
          type="button"
          onClick={() => onOpen(task)}
          className={`text-[12px] font-medium truncate text-left hover:underline ${isDone ? 'line-through text-muted-foreground/75' : 'text-foreground'}`}
        >
          {task.title}
        </button>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {children}
        <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">
          {t(`kanban.columns.${task.status}`, task.status)}
        </span>
        {task.deadline && (
          <span className="hidden sm:inline text-[10px] text-muted-foreground">
            {new Date(task.deadline).toLocaleDateString(i18n.language === 'vi' ? 'vi-VN' : 'en-US')}
          </span>
        )}
        {onUnlink && (
          <Button
            variant="ghost"
            size="icon"
            title={unlinkTitle}
            aria-label={unlinkTitle}
            onClick={() => onUnlink(task)}
            className="w-7 h-7 rounded-lg text-muted-foreground hover:text-rose-500"
          >
            <Unlink className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

export default function RoadmapPage() {
  const { id: projectId } = useParams();
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const activeWorkspaceId = localStorage.getItem('active-workspace-id');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingEpic, setEditingEpic] = useState(null);
  const [expanded, setExpanded] = useState(() => new Set());
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [createCtx, setCreateCtx] = useState(null);
  const [linkCtx, setLinkCtx] = useState(null);
  const [openTask, setOpenTask] = useState(null);

  // Same rule as the API: the project owner or a member with project.settings
  const { user: currentUser } = useAuth();
  const { can } = useProjectPermissions(projectId);
  const { data: project } = useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => projectService.getProject(projectId),
    enabled: !!projectId,
  });
  const canManage = project?.owner_id === currentUser?.id || can('project.settings');
  const canCreate = can('task.create');
  const canEdit = can('task.update');

  const { epics, tasks, isLoading } = useTaskHierarchy(projectId);

  const { data: members = [] } = useQuery({
    queryKey: ['members', projectId],
    queryFn: () => projectService.getMembers(projectId),
    enabled: !!projectId && !!createCtx,
  });

  const tree = useMemo(() => {
    const children = {};
    tasks.forEach((task) => {
      if (task.parent_task_id) (children[task.parent_task_id] ||= []).push(task);
    });
    const childrenOf = (id) => children[id] || [];
    const groupOf = (epicId) => {
      const inGroup = tasks.filter((task) => (task.epic_id || NO_EPIC) === epicId);
      const top = inGroup.filter((task) => !task.parent_task_id);
      return {
        stories: top.filter((task) => task.type === 'story'),
        loose: top.filter((task) => task.type !== 'story'),
        progress: progressOf(inGroup, childrenOf),
      };
    };
    return { childrenOf, groupOf };
  }, [tasks]);

  const deleteMutation = useMutation({
    mutationFn: (epicId) => epicService.deleteEpic(epicId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['epics', projectId] });
      qc.invalidateQueries({ queryKey: ['tasks', projectId] });
      toast.success(t('roadmap.delete_success'));
    },
    onError: (err) => {
      toast.error(getApiError(err, t('roadmap.delete_error')));
    },
  });

  // Attach/detach: { epic_id } for an epic, { parent_task_id } for a story
  const moveMutation = useMutation({
    mutationFn: ({ taskId, data }) => taskService.updateTask(taskId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks', projectId] });
    },
    onError: (err) => toast.error(getApiError(err, t('common.error'))),
  });

  const toggle = (id) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const handleDelete = (epicId, e) => {
    e.stopPropagation();
    setDeleteTarget(epics.find((ep) => ep.id === epicId) || { id: epicId });
  };

  const handleEdit = (epic, e) => {
    e.stopPropagation();
    setEditingEpic(epic);
  };

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[color:var(--color-ai)]" />
      </div>
    );
  }

  const noEpic = tree.groupOf(NO_EPIC);
  const groups = [
    ...epics.map((epic) => ({ epic, id: epic.id })),
    ...(noEpic.stories.length || noEpic.loose.length ? [{ epic: null, id: NO_EPIC }] : []),
  ];

  const renderStory = (story, epicId) => {
    const kids = tree.childrenOf(story.id);
    const isOpen = expanded.has(story.id);
    const p = progressOf(kids, () => []);
    return (
      <div key={story.id} className="space-y-1.5">
        <TaskLine
          task={story}
          onOpen={setOpenTask}
          onUnlink={
            canEdit && epicId !== NO_EPIC
              ? (task) => moveMutation.mutate({ taskId: task.id, data: { epic_id: null } })
              : undefined
          }
          unlinkTitle={t('hierarchy.remove_from_epic')}
          leading={
            <button
              type="button"
              onClick={() => toggle(story.id)}
              aria-label={t('hierarchy.toggle_story')}
              className="text-muted-foreground/60 hover:text-foreground"
            >
              {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          }
        >
          {kids.length > 0 && (
            <span className="text-[10px] font-mono text-muted-foreground">
              {p.done}/{p.total}
            </span>
          )}
        </TaskLine>
        {isOpen && (
          <div className="ml-6 pl-3 border-l border-border/60 space-y-1.5">
            {kids.length === 0 && (
              <p className="text-[11px] text-muted-foreground italic py-1">
                {t('hierarchy.story_empty')}
              </p>
            )}
            {kids.map((task) => (
              <TaskLine
                key={task.id}
                task={task}
                onOpen={setOpenTask}
                onUnlink={
                  canEdit
                    ? (x) => moveMutation.mutate({ taskId: x.id, data: { parent_task_id: null } })
                    : undefined
                }
                unlinkTitle={t('hierarchy.remove_from_story')}
              />
            ))}
            <div className="flex gap-2 pt-0.5">
              {canCreate && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-[11px]"
                  onClick={() =>
                    setCreateCtx({
                      type: 'task',
                      epicId: story.epic_id,
                      parentId: story.id,
                    })
                  }
                >
                  <Plus className="w-3.5 h-3.5" /> {t('hierarchy.add_task')}
                </Button>
              )}
              {canEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-[11px]"
                  onClick={() => setLinkCtx({ story })}
                >
                  <Link2 className="w-3.5 h-3.5" /> {t('hierarchy.link_existing')}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

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
            <p className="text-[12px] text-muted-foreground mt-0.5">{t('hierarchy.subtitle')}</p>
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

      {/* Epic → Story → Task tree */}
      <div className="space-y-3">
        {groups.length === 0 ? (
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
          groups.map(({ epic, id }) => {
            const { stories, loose, progress } = tree.groupOf(id);
            const isExpanded = expanded.has(id);
            const epicColor = epic?.color || '#94a3b8';
            const epicId = epic?.id || null;

            return (
              <Card
                key={id}
                className={`overflow-hidden glass-surface border border-border/60 hover:border-border transition-all duration-300 shadow-sm ${epic ? '' : 'border-dashed'}`}
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => toggle(id)}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggle(id)}
                  className="p-4 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-1.5 h-8 rounded-full"
                      style={{ backgroundColor: epicColor }}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {!epic && <Inbox className="w-4 h-4 text-muted-foreground" />}
                        <span className="font-bold text-sm text-foreground truncate max-w-[200px] sm:max-w-md">
                          {epic ? epic.name : t('hierarchy.no_epic_group')}
                        </span>
                        {epic && (
                          <Badge
                            variant="outline"
                            className="text-[9px] uppercase font-mono px-1 py-0.5 leading-none"
                          >
                            {epic.status}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground/80 mt-1 line-clamp-1">
                        {epic
                          ? epic.description || t('roadmap.no_description')
                          : t('hierarchy.no_epic_desc')}
                        {' · '}
                        {t('hierarchy.counts', { stories: stories.length, tasks: loose.length })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end shrink-0">
                    {epic?.due_date && (
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

                    <ProgressBar
                      percent={progress.percent}
                      done={progress.done}
                      total={progress.total}
                      color={epicColor}
                    />

                    <div className="flex items-center gap-1">
                      {epic && canManage && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={t('roadmap.edit_epic')}
                            onClick={(e) => handleEdit(epic, e)}
                            className="w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={t('roadmap.delete_title')}
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

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-border/40 bg-muted/10 overflow-hidden"
                    >
                      <div className="p-4 space-y-4">
                        <section className="space-y-1.5">
                          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">
                            {t('hierarchy.stories', { count: stories.length })}
                          </p>
                          {stories.length === 0 && (
                            <p className="text-[11px] text-muted-foreground italic">
                              {t('hierarchy.no_stories')}
                            </p>
                          )}
                          {stories.map((story) => renderStory(story, id))}
                        </section>

                        <section className="space-y-1.5">
                          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">
                            {t('hierarchy.loose_tasks', { count: loose.length })}
                          </p>
                          {loose.length === 0 && (
                            <p className="text-[11px] text-muted-foreground italic">
                              {t('hierarchy.no_loose_tasks')}
                            </p>
                          )}
                          {loose.map((task) => (
                            <TaskLine
                              key={task.id}
                              task={task}
                              onOpen={setOpenTask}
                              onUnlink={
                                canEdit && epic
                                  ? (x) =>
                                      moveMutation.mutate({
                                        taskId: x.id,
                                        data: { epic_id: null },
                                      })
                                  : undefined
                              }
                              unlinkTitle={t('hierarchy.remove_from_epic')}
                            >
                              {tree.childrenOf(task.id).length > 0 && (
                                <span className="text-[10px] font-mono text-muted-foreground">
                                  {t('hierarchy.subtask_count', {
                                    count: tree.childrenOf(task.id).length,
                                  })}
                                </span>
                              )}
                            </TaskLine>
                          ))}
                        </section>

                        {(canCreate || (canEdit && epic)) && (
                          <div className="flex flex-wrap gap-2 pt-1 border-t border-border/40">
                            {canCreate && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 text-[11px] mt-3"
                                  onClick={() => setCreateCtx({ type: 'story', epicId })}
                                >
                                  <Plus className="w-3.5 h-3.5" /> {t('hierarchy.add_story')}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 text-[11px] mt-3"
                                  onClick={() => setCreateCtx({ type: 'task', epicId })}
                                >
                                  <Plus className="w-3.5 h-3.5" /> {t('hierarchy.add_task')}
                                </Button>
                              </>
                            )}
                            {canEdit && epic && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-[11px] mt-3"
                                onClick={() => setLinkCtx({ epic })}
                              >
                                <Link2 className="w-3.5 h-3.5" /> {t('hierarchy.link_existing')}
                              </Button>
                            )}
                          </div>
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

      <AnimatePresence>
        {createCtx && (
          <CreateTaskModal
            key="roadmap-create-task"
            projectId={projectId}
            members={members}
            defaultType={createCtx.type}
            defaultEpicId={createCtx.epicId || undefined}
            defaultParentId={createCtx.parentId}
            onClose={() => setCreateCtx(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {linkCtx && (
          <LinkTaskModal
            key="roadmap-link-task"
            target={linkCtx}
            tasks={tasks}
            childrenOf={tree.childrenOf}
            isPending={moveMutation.isPending}
            onPick={(task) => {
              const data = linkCtx.story
                ? { parent_task_id: linkCtx.story.id }
                : { epic_id: linkCtx.epic.id };
              moveMutation.mutate(
                { taskId: task.id, data },
                {
                  onSuccess: () => toast.success(t('hierarchy.linked', { title: task.title })),
                }
              );
            }}
            onClose={() => setLinkCtx(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {openTask && (
          <TaskDetailModal
            key="roadmap-task-detail"
            task={openTask}
            projectId={projectId}
            onClose={() => setOpenTask(null)}
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

/**
 * Pick an existing task to put in an epic (top-level tasks of other epics or
 * none) or under a story (non-story tasks without subtasks, same rule as the API).
 */
function LinkTaskModal({ target, tasks, childrenOf, isPending, onPick, onClose }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const candidates = tasks.filter((task) => {
    if (target.story) {
      return (
        task.id !== target.story.id &&
        task.type !== 'story' &&
        task.parent_task_id !== target.story.id &&
        childrenOf(task.id).length === 0
      );
    }
    return !task.parent_task_id && task.epic_id !== target.epic.id;
  });
  const q = query.trim().toLowerCase();
  const shown = q ? candidates.filter((task) => task.title.toLowerCase().includes(q)) : candidates;

  return (
    <Modal
      title={t('hierarchy.link_title', { name: target.story?.title || target.epic.name })}
      onClose={onClose}
      maxWidth="max-w-md"
    >
      <div className="p-5 flex flex-col gap-3">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('hierarchy.search_tasks')}
            className="w-full bg-background border border-border rounded-lg pl-9 pr-3 py-2 text-[13px] focus:outline-none focus:border-[color:var(--color-ai)] focus:ring-1 focus:ring-[color:var(--color-ai)]"
          />
        </div>
        <div className="max-h-80 overflow-y-auto space-y-1 scrollbar-thin">
          {shown.length === 0 && (
            <p className="text-[12px] text-muted-foreground italic text-center py-6">
              {t('hierarchy.no_candidates')}
            </p>
          )}
          {shown.map((task) => (
            <button
              key={task.id}
              type="button"
              disabled={isPending}
              onClick={() => onPick(task)}
              className="w-full flex items-center gap-2 p-2 rounded-lg border border-transparent hover:border-border hover:bg-muted/40 text-left disabled:opacity-50"
            >
              <StatusIcon status={task.status} />
              <TaskTypeBadge type={task.type} />
              <span className="text-[12px] text-foreground truncate flex-1">{task.title}</span>
              <Link2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>
      </div>
    </Modal>
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
