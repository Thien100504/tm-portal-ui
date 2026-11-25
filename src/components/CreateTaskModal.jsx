import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, User as UserIcon, Flag } from 'lucide-react';
import DatePicker from '@/components/ui/DatePicker';
import { useTranslation } from 'react-i18next';
import taskService from '@/services/taskService';
import CustomSelect from '@/components/ui/CustomSelect';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { toast } from 'sonner';
import { useActiveWorkspace } from '@/hooks/useActiveWorkspace';
import { getApiError } from '@/lib/apiError';

export default function CreateTaskModal({
  projectId,
  sprintId,
  defaultStatus,
  initialDeadline,
  members = [],
  onClose,
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { settings } = useActiveWorkspace();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium',
    assignee_id: '',
    deadline: initialDeadline || '',
    status: defaultStatus || 'todo',
    story_points: '',
    estimated_hours: '',
  });

  const STATUS_OPTIONS = [
    { value: 'todo', label: t('kanban.columns.todo') },
    { value: 'in_progress', label: t('kanban.columns.in_progress') },
    { value: 'review', label: t('kanban.columns.review') },
    { value: 'done', label: t('kanban.columns.done') },
  ];

  const PRIORITY_OPTIONS = [
    { value: 'high', label: t('taskDetail.priority_high') },
    { value: 'medium', label: t('taskDetail.priority_medium') },
    { value: 'low', label: t('taskDetail.priority_low') },
  ];

  const MEMBER_OPTIONS = [
    { value: '', label: t('taskDetail.unassigned') },
    ...members.map((m) => ({ value: m.user_id, label: m.user?.full_name || m.user?.email })),
  ];

  const mutation = useMutation({
    mutationFn: (data) => taskService.createTask(data),
    onSuccess: (_newTask) => {
      qc.invalidateQueries({ queryKey: ['tasks', projectId] });
      toast.success(t('common.success'), { description: t('createTask.success', 'Task created.') });
      onClose();
    },
    onError: (err) => {
      console.error('Create task error:', err);
      const errorMsg = getApiError(err, t('common.error'));
      toast.error(t('common.error'), { description: errorMsg });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error(t('common.error'), {
        description: t('createTask.name_required', 'Please enter a task name.'),
      });
      return;
    }

    const payload = {
      project_id: projectId,
      title: formData.title.trim(),
      description: formData.description.trim() || undefined,
      priority: formData.priority,
      status: formData.status,
    };

    if (formData.story_points) {
      payload.story_points = parseInt(formData.story_points, 10);
    }
    if (formData.estimated_hours) {
      payload.estimated_hours = parseFloat(formData.estimated_hours);
    }

    if (sprintId) payload.sprint_id = sprintId;
    if (formData.assignee_id) payload.assignee_id = formData.assignee_id;
    if (formData.deadline) {
      const d = new Date(`${formData.deadline}T23:59:59`);
      payload.deadline = d.toISOString();
    }

    mutation.mutate(payload);
  };

  return (
    <Modal
      title={t('createTask.title', 'Create new task')}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button type="submit" form="create-task-form" disabled={mutation.isPending} size="sm">
            {mutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {t('createTask.submit', 'Create task')}
          </Button>
        </div>
      }
    >
      <form id="create-task-form" onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
        <div>
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
            {t('createTask.name_label', 'Task name')} <span className="text-destructive">*</span>
          </label>
          <input
            autoFocus
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder={t('createTask.name_placeholder', 'Enter task name...')}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[color:var(--color-ai)] focus:ring-1 focus:ring-[color:var(--color-ai)] transition-all"
          />
        </div>

        <div>
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
            {t('createTask.desc_label', 'Description')}
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder={t('createTask.desc_placeholder', 'Detailed description...')}
            rows={3}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[color:var(--color-ai)] focus:ring-1 focus:ring-[color:var(--color-ai)] transition-all resize-none scrollbar-thin"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          {settings.enable_members !== false && (
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                <UserIcon className="w-3 h-3" /> Assignee
              </label>
              <CustomSelect
                options={MEMBER_OPTIONS}
                value={formData.assignee_id}
                onChange={(val) => setFormData({ ...formData, assignee_id: val })}
                placeholder={t('createTask.assignee_placeholder', 'Choose an assignee')}
              />
            </div>
          )}

          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
              <Flag className="w-3 h-3" /> Priority
            </label>
            <CustomSelect
              options={PRIORITY_OPTIONS}
              value={formData.priority}
              onChange={(val) => setFormData({ ...formData, priority: val })}
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
              Deadline
            </label>
            <DatePicker
              value={formData.deadline}
              onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
              Status
            </label>
            <CustomSelect
              options={STATUS_OPTIONS}
              value={formData.status}
              onChange={(val) => setFormData({ ...formData, status: val })}
            />
          </div>

          {settings.enable_story_points !== false && (
            <div>
              <label
                className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-1.5"
                title="Fibonacci (1, 2, 3, 5, 8...)"
              >
                Story Points
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={formData.story_points}
                onChange={(e) => setFormData({ ...formData, story_points: e.target.value })}
                placeholder="VD: 3, 5, 8"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-[13px] font-mono focus:outline-none focus:border-[color:var(--color-ai)] focus:ring-1 focus:ring-[color:var(--color-ai)] transition-all"
              />
            </div>
          )}

          {settings.enable_time_tracking !== false && (
            <div>
              <label
                className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-1.5"
                title="Estimated hours for this task"
              >
                Estimate (h)
              </label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={formData.estimated_hours}
                onChange={(e) => setFormData({ ...formData, estimated_hours: e.target.value })}
                placeholder="VD: 2.5"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-[13px] font-mono focus:outline-none focus:border-[color:var(--color-ai)] focus:ring-1 focus:ring-[color:var(--color-ai)] transition-all"
              />
            </div>
          )}
        </div>
      </form>
    </Modal>
  );
}
