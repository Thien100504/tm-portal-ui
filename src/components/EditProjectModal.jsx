import { Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import projectService from '@/services/projectService';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import CustomSelect from '@/components/ui/CustomSelect';
import DatePicker from '@/components/ui/DatePicker';

export default function EditProjectModal({ project, onClose }) {
  const qc = useQueryClient();
  const { t } = useTranslation();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      name: project?.name || '',
      description: project?.description || '',
      start_date: project?.start_date || '',
      end_date: project?.end_date || '',
      telegram_chat_id: project?.telegram_chat_id || '',
      status: project?.status || 'active',
    },
  });

  const mutation = useMutation({
    mutationFn: (data) => projectService.updateProject(project.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['projects', project.id] });
      onClose();
    },
    onError: (err) => toast.error(err.translatedMessage || t('common.error')),
  });

  return (
    <Modal
      title={t('project.edit_title')}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            form="edit-project-form"
            disabled={isSubmitting || mutation.isPending}
            size="sm"
          >
            {mutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            {t('common.save')}
          </Button>
        </div>
      }
    >
      <form
        id="edit-project-form"
        onSubmit={handleSubmit((data) => mutation.mutate(data))}
        className="p-5 flex flex-col gap-4"
      >
        <div>
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
            {t('project.name')} <span className="text-destructive">*</span>
          </label>
          <input
            {...register('name', { required: t('common.required_fields') })}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[color:var(--color-ai)] focus:ring-1 focus:ring-[color:var(--color-ai)] transition-all"
            autoFocus
          />
          {errors.name && (
            <p className="text-xs text-[color:var(--color-destructive)] mt-1">
              {errors.name.message}
            </p>
          )}
        </div>

        <div>
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
            {t('project.description')}
          </label>
          <textarea
            {...register('description')}
            rows={3}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[color:var(--color-ai)] focus:ring-1 focus:ring-[color:var(--color-ai)] transition-all resize-none scrollbar-thin"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
              {t('project.start_date')}
            </label>
            <DatePicker {...register('start_date')} />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
              {t('project.end_date')}
            </label>
            <DatePicker {...register('end_date')} />
          </div>
        </div>

        <div>
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
            {t('project.telegram_id')}
          </label>
          <input
            {...register('telegram_chat_id')}
            placeholder="-5171357396"
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[color:var(--color-ai)] focus:ring-1 focus:ring-[color:var(--color-ai)] transition-all"
          />
        </div>

        <div>
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
            {t('project.status')}
          </label>
          <CustomSelect
            options={[
              { value: 'active', label: t('project.status_active') },
              { value: 'archived', label: t('project.status_archived') },
            ]}
            value={watch('status')}
            onChange={(val) => setValue('status', val)}
          />
        </div>
      </form>
    </Modal>
  );
}
