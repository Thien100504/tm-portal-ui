import { useState } from 'react';
import DatePicker from '@/components/ui/DatePicker';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { Plus, FolderKanban, Users, Calendar, Loader2, BarChart3 } from 'lucide-react';
import { format } from 'date-fns';
import { vi, enUS } from 'date-fns/locale';
import projectService from '@/services/projectService';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { MotionCard } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { useWorkspaceStore } from '@/store/workspaceStore';

function CreateProjectModal({ onClose }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm();

  const mutation = useMutation({
    mutationFn: (data) => projectService.createProject(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      onClose();
    },
    onError: (err) => toast.error(err.translatedMessage || t('common.error')),
  });

  return (
    <Modal
      title={t('projectList.create.title')}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="create-project-form" disabled={isSubmitting} size="sm">
            {isSubmitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Plus className="w-3.5 h-3.5" />
            )}
            {isSubmitting ? t('common.saving') : t('projectList.create.submit')}
          </Button>
        </div>
      }
    >
      <form
        id="create-project-form"
        onSubmit={handleSubmit((data) =>
          mutation.mutate({
            ...data,
            start_date: data.start_date || null,
            end_date: data.end_date || null,
          })
        )}
        className="p-5 flex flex-col gap-4"
      >
        <div>
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
            {t('projectList.create.name_label')} <span className="text-destructive">*</span>
          </label>
          <input
            {...register('name', { required: t('projectList.create.name_required') })}
            placeholder={t('projectList.create.name_placeholder')}
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
            {t('projectList.create.desc_label') || 'Description'}
          </label>
          <textarea
            {...register('description')}
            placeholder={
              t('projectList.create.desc_placeholder') || 'A short description of the project...'
            }
            rows={3}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[color:var(--color-ai)] focus:ring-1 focus:ring-[color:var(--color-ai)] transition-all resize-none scrollbar-thin"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
              {t('projectList.create.start_date') || 'Start Date'}
            </label>
            <DatePicker {...register('start_date')} />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
              {t('projectList.create.end_date') || 'End Date'}
            </label>
            <DatePicker {...register('end_date')} />
          </div>
        </div>

        <div>
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
            {t('projectList.create.telegram_label') || 'Telegram Group Chat ID (Optional)'}
          </label>
          <input
            {...register('telegram_chat_id')}
            placeholder="e.g. -5171357396"
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[color:var(--color-ai)] focus:ring-1 focus:ring-[color:var(--color-ai)] transition-all"
          />
          <p className="text-[10px] text-muted-foreground mt-1.5">
            {t('projectList.create.telegram_hint') ||
              'Invite Bot @TM_1005_BOT to the group and use /start to receive notifications.'}
          </p>
        </div>
      </form>
    </Modal>
  );
}

const STATUS_COLOR = {
  active: 'bg-[color:var(--color-success)]/15 text-[color:var(--color-success)]',
  archived: 'bg-muted text-muted-foreground',
};

export default function ProjectListPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  useAuth();
  const [showCreate, setShowCreate] = useState(false);

  const activeWorkspaceId = useWorkspaceStore((state) => state.activeWorkspaceId);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects', activeWorkspaceId],
    queryFn: () => projectService.getProjects(activeWorkspaceId),
  });

  return (
    <div className="pb-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-gradient-to-tr from-[color:var(--color-primary)] to-[color:var(--color-ai)] text-white shadow-md shrink-0">
            <FolderKanban className="w-6 h-6" />
          </div>
          <div className="flex flex-col justify-center">
            <h1 className="text-2xl font-bold text-foreground tracking-tight leading-none mb-1.5">
              {t('projectList.title')}
            </h1>
            <p className="text-sm text-muted-foreground leading-none">
              {t('projectList.active_count', {
                count: projects.length,
                defaultValue: `${projects.length} active projects`,
              })}
            </p>
          </div>
        </div>
        <Button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-sm"
        >
          <Plus className="w-4 h-4" /> {t('projectList.create_new')}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-[color:var(--color-ai)] animate-spin" />
        </div>
      ) : projects.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-20"
        >
          <div className="w-20 h-20 bg-[color:var(--color-ai)]/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <FolderKanban className="w-10 h-10 text-[color:var(--color-ai)]" />
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-1">
            {t('projectList.no_projects')}
          </h2>
          <p className="text-muted-foreground text-sm mb-4">{t('projectList.no_projects_desc')}</p>
          <Button onClick={() => setShowCreate(true)} className="px-5 py-2 rounded-xl">
            {t('projectList.create_now')}
          </Button>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map((project, i) => (
            <MotionCard
              key={project.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              className="rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group flex flex-col border-border/50 overflow-hidden"
              padding="none"
              glass
            >
              {/* Timeline bar: shows project time progress */}
              {(() => {
                const hasRange = project.start_date && project.end_date;
                let pct = 100;
                let isOverdue = false;
                if (hasRange) {
                  const start = new Date(project.start_date).getTime();
                  const end = new Date(project.end_date).getTime();
                  const now = Date.now();
                  pct = Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
                  isOverdue = now > end;
                }
                return (
                  <div className="h-1.5 relative bg-border/30">
                    <div
                      className={`absolute left-0 top-0 h-full transition-all ${
                        isOverdue ? 'bg-muted-foreground/30' : 'bg-[color:var(--color-ai)]/50'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                );
              })()}

              <div className="p-4 flex flex-col flex-1 gap-3.5">
                {/* Title + badge */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="font-bold text-[14px] text-card-foreground group-hover:text-[color:var(--color-ai)] transition-colors truncate leading-snug">
                      {project.name}
                    </h2>
                    <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                      {project.description || t('projectList.no_description')}
                    </p>
                  </div>
                  <Badge
                    variant="glass"
                    className={`shrink-0 tracking-widest uppercase border-none text-[9px] px-2 py-0.5 ${STATUS_COLOR[project.status] || STATUS_COLOR.active}`}
                  >
                    {project.status === 'active'
                      ? t('project.status_active')
                      : t('project.status_archived')}
                  </Badge>
                </div>

                {/* Timeline dates (if exist) */}
                {(project.start_date || project.end_date) && (
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <Calendar className="w-3 h-3 shrink-0" />
                    {project.start_date &&
                      format(new Date(project.start_date), 'dd/MM/yy', {
                        locale: i18n.language === 'vi' ? vi : enUS,
                      })}
                    {project.start_date && project.end_date && (
                      <span className="text-border">→</span>
                    )}
                    {project.end_date &&
                      format(new Date(project.end_date), 'dd/MM/yy', {
                        locale: i18n.language === 'vi' ? vi : enUS,
                      })}
                  </div>
                )}

                {/* Members */}
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-1.5">
                    {(project.members || []).slice(0, 5).map((m) => (
                      <div
                        key={m.user_id}
                        className="w-6 h-6 rounded-full bg-gradient-to-tr from-primary to-ai text-[9px] font-bold text-white flex items-center justify-center ring-2 ring-card shadow-sm"
                        title={m.user?.full_name}
                      >
                        {m.user?.full_name?.charAt(0).toUpperCase() || 'U'}
                      </div>
                    ))}
                    {(project.members || []).length > 5 && (
                      <div className="w-6 h-6 rounded-full bg-muted text-[9px] font-bold text-muted-foreground flex items-center justify-center ring-2 ring-card shadow-sm">
                        +{(project.members || []).length - 5}
                      </div>
                    )}
                  </div>
                  {project.members?.length > 0 && (
                    <span className="text-[11px] text-muted-foreground">
                      {project.members.length} {t('common.member')}
                    </span>
                  )}
                  {(!project.members || project.members.length === 0) && (
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Users className="w-3 h-3" /> {project.member_count || 1} {t('common.member')}
                    </span>
                  )}
                </div>

                {/* Divider */}
                <div className="h-px bg-border/40" />

                {/* Action buttons */}
                <div className="flex gap-2">
                  <Button
                    onClick={() => navigate(`/projects/${project.id}`)}
                    className="flex-1 flex items-center justify-center gap-1.5 text-[12px] h-8 rounded-xl"
                  >
                    <BarChart3 className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{t('common.overview')}</span>
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => navigate(`/projects/${project.id}/kanban`)}
                    className="flex-1 flex items-center justify-center gap-1.5 text-[12px] h-8 rounded-xl"
                  >
                    <FolderKanban className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{t('sidebar.kanban')}</span>
                  </Button>
                </div>
              </div>
            </MotionCard>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showCreate && <CreateProjectModal onClose={() => setShowCreate(false)} />}
      </AnimatePresence>
    </div>
  );
}
