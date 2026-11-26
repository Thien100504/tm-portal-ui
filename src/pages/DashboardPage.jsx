import { getApiError } from '@/lib/apiError';
import { useState } from 'react';
import PriorityBadge from '@/components/ui/PriorityBadge';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  TrendingUp,
  ArrowRight,
  Sparkles,
  Users,
  FolderKanban,
  ShieldAlert,
  UserCheck,
  Activity,
  Lock,
  Flame,
  CalendarDays,
  CheckCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { format, isToday, isTomorrow, differenceInDays } from 'date-fns';
import { vi as viLocale, enUS as enLocale } from 'date-fns/locale';
import { useAuth } from '@/hooks/useAuth';
import dashboardService from '@/services/dashboardService';
import taskService from '@/services/taskService';
import TaskDetailModal from '@/components/TaskDetailModal';
import { Card, MotionCard } from '@/components/ui/Card';
import { toast } from 'sonner';

import { useActiveWorkspace } from '@/hooks/useActiveWorkspace';
import NoWorkspaceState from '@/components/workspaces/NoWorkspaceState';
import PomodoroWidget from '@/components/PomodoroWidget';

// ── Helpers ─────────────────────────────────────────────────────────

const STATUS_COLOR = {
  todo: 'bg-muted text-muted-foreground',
  in_progress: 'bg-[color:var(--color-ai)]/10 text-[color:var(--color-ai)]',
  review: 'bg-[color:var(--color-warning)]/10 text-[color:var(--color-warning)]',
  done: 'bg-[color:var(--color-success)]/10 text-[color:var(--color-success)]',
};

function formatDeadline(dateStr, t, lang) {
  const d = new Date(dateStr);
  const locale = lang === 'vi' ? viLocale : enLocale;
  if (isToday(d)) return t('dashboard.deadline.today');
  if (isTomorrow(d)) return t('dashboard.deadline.tomorrow');
  const diff = differenceInDays(d, new Date());
  if (diff <= 7) return t('dashboard.deadline.days_left', { count: diff });
  return format(d, 'dd/MM', { locale });
}

function progressPercent(done, total) {
  if (!total) return 0;
  return Math.round((done / total) * 100);
}

// ── Stat Card ────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, color, bg, border, sub, delay = 0 }) {
  return (
    <MotionCard
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="p-3.5 hover:shadow-md transition-shadow"
    >
      <div className="flex items-center gap-3">
        <div className={`flex-shrink-0 inline-flex p-2 rounded-lg ${bg} ${border} border`}>
          <Icon className={`w-4 h-4 ${color}`} />
        </div>
        <div>
          <p className="text-2xl font-bold text-card-foreground leading-none">{value ?? '—'}</p>
          <p className="text-[11px] font-medium text-muted-foreground mt-0.5">{label}</p>
          {sub && <p className="text-[10px] text-muted-foreground/70 mt-0.5">{sub}</p>}
        </div>
      </div>
    </MotionCard>
  );
}

// ── Section Header ───────────────────────────────────────────────────

function SectionHeader({ title, linkTo, linkLabel }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
      <h2 className="text-xs font-semibold text-card-foreground">{title}</h2>
      {linkTo && (
        <Link
          to={linkTo}
          className="text-[10px] font-medium text-[color:var(--color-ai)] hover:underline flex items-center gap-0.5"
        >
          {linkLabel} <ArrowRight className="w-3 h-3" />
        </Link>
      )}
    </div>
  );
}

// ── Skeleton loader ──────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <Card className="p-3.5 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-muted" />
        <div className="space-y-1.5">
          <div className="h-5 w-12 bg-muted rounded" />
          <div className="h-3 w-20 bg-muted rounded" />
        </div>
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const isAdmin = user?.system_role === 'admin';
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState('overview'); // overview | my_day
  const [selectedTask, setSelectedTask] = useState(null);

  const hour = new Date().getHours();
  const greeting =
    hour < 12
      ? t('dashboard.greeting.morning')
      : hour < 18
        ? t('dashboard.greeting.afternoon')
        : t('dashboard.greeting.evening');

  const {
    activeWorkspace,
    activeWorkspaceId,
    workspaces,
    isLoading: workspacesLoading,
  } = useActiveWorkspace();
  const isPersonalMode = activeWorkspace?.type === 'personal';
  const noWorkspace = !workspacesLoading && workspaces.length === 0;

  // Personal stats — every user (or scoped to the workspace)
  const { data: personal, isLoading: personalLoading } = useQuery({
    queryKey: ['dashboard', 'personal', activeWorkspaceId],
    queryFn: () => dashboardService.getPersonalStats(activeWorkspaceId),
    staleTime: 60_000,
  });

  // Admin stats — admins only
  const { data: admin, isLoading: adminLoading } = useQuery({
    queryKey: ['dashboard', 'admin'],
    queryFn: dashboardService.getAdminStats,
    enabled: isAdmin,
    staleTime: 60_000,
  });

  const { data: myDayTasks = [], isLoading: myDayLoading } = useQuery({
    queryKey: ['dashboard', 'my-day', activeWorkspaceId],
    queryFn: () => taskService.getMyDayTasks(activeWorkspaceId),
    staleTime: 30_000,
  });

  const toggleTaskMutation = useMutation({
    mutationFn: ({ id, status }) => taskService.updateStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dashboard', 'my-day'] });
      qc.invalidateQueries({ queryKey: ['dashboard', 'personal'] });
      toast.success(t('dashboard.update_success'));
    },
    onError: (err) => toast.error(getApiError(err, t('common.error'))),
  });

  // System admins keep the system-wide stats; everyone else has nothing to show yet
  if (noWorkspace && !isAdmin) return <NoWorkspaceState />;

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {noWorkspace && <NoWorkspaceState compact />}
      {/* Greeting with tab switcher */}
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            {greeting},{' '}
            <span className="text-[color:var(--color-ai)]">
              {user?.full_name?.split(' ').pop() || t('common.user')}
            </span>{' '}
            👋
          </h1>
          <p className="text-muted-foreground text-xs mt-0.5">
            {activeTab === 'my_day'
              ? t('dashboard.my_day_subtitle')
              : isAdmin
                ? t('dashboard.admin_subtitle')
                : t('dashboard.user_subtitle')}
          </p>
        </motion.div>

        <div className="flex bg-muted/60 p-1 rounded-xl w-fit border border-border/40 shrink-0">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'overview'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t('dashboard.tab_overview')}
          </button>
          <button
            onClick={() => setActiveTab('my_day')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'my_day'
                ? 'bg-background text-[color:var(--color-ai)] shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Flame className="w-3.5 h-3.5" /> {t('dashboard.tab_my_day')}
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'overview' ? (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="w-full space-y-4"
          >
            {isAdmin && !isPersonalMode && (
              <>
                <div className="flex items-center gap-1.5 text-[color:var(--color-ai)]">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <p className="text-[10px] font-mono font-semibold uppercase tracking-widest">
                    {t('dashboard.system_stats')}
                  </p>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {adminLoading ? (
                    Array(4)
                      .fill(0)
                      .map((_, i) => <SkeletonCard key={i} />)
                  ) : (
                    <>
                      <StatCard
                        label={t('dashboard.users')}
                        value={admin?.total_users}
                        sub={`${admin?.active_users} ${t('dashboard.active_users')}`}
                        icon={Users}
                        color="text-[color:var(--color-primary)]"
                        bg="bg-[color:var(--color-primary)]/10"
                        border="border-[color:var(--color-primary)]/20"
                        delay={0}
                      />
                      <StatCard
                        label={t('dashboard.active_projects')}
                        value={admin?.active_projects}
                        sub={`/ ${admin?.total_projects} ${t('dashboard.total_projects')}`}
                        icon={FolderKanban}
                        color="text-[color:var(--color-ai)]"
                        bg="bg-[color:var(--color-ai)]/10"
                        border="border-[color:var(--color-ai)]/20"
                        delay={0.05}
                      />
                      <StatCard
                        label={t('dashboard.total_tasks')}
                        value={admin?.total_tasks}
                        icon={CheckCircle2}
                        color="text-[color:var(--color-success)]"
                        bg="bg-[color:var(--color-success)]/10"
                        border="border-[color:var(--color-success)]/20"
                        delay={0.1}
                      />
                      <StatCard
                        label={t('dashboard.done_this_week')}
                        value={admin?.done_this_week}
                        sub={t('dashboard.system_wide')}
                        icon={TrendingUp}
                        color="text-[color:var(--color-warning)]"
                        bg="bg-[color:var(--color-warning)]/10"
                        border="border-[color:var(--color-warning)]/20"
                        delay={0.15}
                      />
                    </>
                  )}
                </div>

                {/* Admin: Task distribution + Recent users */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Task by status */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-card border border-border rounded-xl shadow-sm overflow-hidden"
                  >
                    <SectionHeader title={t('dashboard.status_distribution')} />
                    {adminLoading ? (
                      <div className="p-4 space-y-3 animate-pulse">
                        {Array(4)
                          .fill(0)
                          .map((_, i) => (
                            <div key={i} className="flex items-center gap-3">
                              <div className="h-3 w-16 bg-muted rounded" />
                              <div className="flex-1 h-2 bg-muted rounded-full" />
                              <div className="h-3 w-8 bg-muted rounded" />
                            </div>
                          ))}
                      </div>
                    ) : (
                      <div className="p-4 space-y-3">
                        {[
                          {
                            key: 'todo',
                            label: t('dashboard.status.todo'),
                            color: 'bg-muted',
                            textColor: 'text-muted-foreground',
                          },
                          {
                            key: 'in_progress',
                            label: t('dashboard.status.in_progress'),
                            color: 'bg-[color:var(--color-ai)]',
                            textColor: 'text-[color:var(--color-ai)]',
                          },
                          {
                            key: 'review',
                            label: t('dashboard.status.review'),
                            color: 'bg-[color:var(--color-warning)]',
                            textColor: 'text-[color:var(--color-warning)]',
                          },
                          {
                            key: 'done',
                            label: t('dashboard.status.done'),
                            color: 'bg-[color:var(--color-success)]',
                            textColor: 'text-[color:var(--color-success)]',
                          },
                        ].map(({ key, label, color, textColor }) => {
                          const count = admin?.tasks_by_status?.[key] || 0;
                          const total = admin?.total_tasks || 1;
                          const pct = Math.round((count / total) * 100);
                          return (
                            <div key={key} className="flex items-center gap-3">
                              <span
                                className={`text-[11px] font-medium w-20 shrink-0 ${textColor}`}
                              >
                                {label}
                              </span>
                              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                <motion.div
                                  className={`h-full ${color} rounded-full`}
                                  initial={{ width: 0 }}
                                  animate={{ width: `${pct}%` }}
                                  transition={{ duration: 0.8, delay: 0.3 }}
                                />
                              </div>
                              <span className="text-[11px] text-muted-foreground w-12 text-right font-mono">
                                {count} <span className="text-muted-foreground/50">({pct}%)</span>
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </motion.div>

                  {/* Recent users */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 }}
                    className="bg-card border border-border rounded-xl shadow-sm overflow-hidden"
                  >
                    <SectionHeader title={t('dashboard.recent_users')} />
                    <div className="divide-y divide-border/50">
                      {adminLoading
                        ? Array(4)
                            .fill(0)
                            .map((_, i) => (
                              <div
                                key={i}
                                className="px-4 py-2.5 flex items-center gap-3 animate-pulse"
                              >
                                <div className="w-7 h-7 rounded-full bg-muted shrink-0" />
                                <div className="flex-1 space-y-1">
                                  <div className="h-3 w-24 bg-muted rounded" />
                                  <div className="h-2 w-32 bg-muted rounded" />
                                </div>
                              </div>
                            ))
                        : admin?.recent_users?.map((u, i) => (
                            <motion.div
                              key={u.id}
                              initial={{ opacity: 0, x: -5 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.25 + i * 0.05 }}
                              className="px-4 py-2.5 flex items-center gap-3 hover:bg-muted/30 transition-colors"
                            >
                              <div className="w-7 h-7 rounded-full bg-[color:var(--color-primary)]/10 text-[color:var(--color-primary)] flex items-center justify-center text-[11px] font-bold shrink-0">
                                {u.full_name?.charAt(0)?.toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[12px] font-medium text-foreground truncate">
                                  {u.full_name}
                                </p>
                                <p className="text-[10px] text-muted-foreground truncate">
                                  {u.email}
                                </p>
                              </div>
                              {u.system_role === 'admin' && (
                                <span className="text-[9px] font-mono uppercase tracking-wider text-[color:var(--color-ai)] bg-[color:var(--color-ai)]/10 px-1.5 py-0.5 rounded-sm shrink-0">
                                  {t('dashboard.admin_badge')}
                                </span>
                              )}
                            </motion.div>
                          ))}
                    </div>
                  </motion.div>
                </div>
              </>
            )}

            {/* ── PERSONAL: My Task Stats ─────────────────────────────────── */}
            <div className="flex items-center gap-1.5 text-[color:var(--color-ai)]">
              <Activity className="w-3.5 h-3.5" />
              <p className="text-[10px] font-mono font-semibold uppercase tracking-widest">
                {isAdmin && !isPersonalMode
                  ? t('dashboard.personal_tasks')
                  : t('dashboard.my_tasks_label')}
              </p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {personalLoading ? (
                Array(4)
                  .fill(0)
                  .map((_, i) => <SkeletonCard key={i} />)
              ) : (
                <>
                  <StatCard
                    label={t('dashboard.status.in_progress')}
                    value={personal?.my_tasks?.in_progress}
                    icon={Clock}
                    color="text-[color:var(--color-ai)]"
                    bg="bg-[color:var(--color-ai)]/10"
                    border="border-[color:var(--color-ai)]/20"
                    delay={0}
                  />
                  <StatCard
                    label={t('dashboard.status.review')}
                    value={personal?.my_tasks?.review}
                    icon={CheckCircle2}
                    color="text-[color:var(--color-warning)]"
                    bg="bg-[color:var(--color-warning)]/10"
                    border="border-[color:var(--color-warning)]/20"
                    delay={0.05}
                  />
                  <StatCard
                    label={t('dashboard.done_this_week')}
                    value={personal?.my_tasks?.done_this_week}
                    icon={TrendingUp}
                    color="text-[color:var(--color-success)]"
                    bg="bg-[color:var(--color-success)]/10"
                    border="border-[color:var(--color-success)]/20"
                    delay={0.1}
                  />
                  <StatCard
                    label={t('dashboard.overdue')}
                    value={personal?.overdue_count}
                    icon={AlertCircle}
                    color="text-[color:var(--color-destructive)]"
                    bg="bg-[color:var(--color-destructive)]/10"
                    border="border-[color:var(--color-destructive)]/20"
                    delay={0.15}
                  />
                </>
              )}
            </div>

            {/* ── Main grid ───────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Upcoming Tasks */}
              <MotionCard
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="lg:col-span-2 overflow-hidden"
              >
                <SectionHeader
                  title={t('dashboard.upcoming_tasks')}
                  linkTo="/projects"
                  linkLabel={t('dashboard.view_all')}
                />
                {personalLoading ? (
                  <div className="divide-y divide-border/50">
                    {Array(4)
                      .fill(0)
                      .map((_, i) => (
                        <div key={i} className="px-4 py-2.5 flex items-center gap-3 animate-pulse">
                          <div className="w-1.5 h-1.5 rounded-full bg-muted shrink-0" />
                          <div className="flex-1 space-y-1">
                            <div className="h-3 w-40 bg-muted rounded" />
                            <div className="h-2 w-24 bg-muted rounded" />
                          </div>
                          <div className="h-4 w-12 bg-muted rounded" />
                        </div>
                      ))}
                  </div>
                ) : personal?.upcoming_tasks?.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <CheckCircle2 className="w-8 h-8 text-[color:var(--color-success)]/50 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">{t('dashboard.no_upcoming')}</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/50">
                    {personal?.upcoming_tasks?.map((task, i) => (
                      <motion.div
                        key={task.id}
                        initial={{ opacity: 0, x: -5 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 + i * 0.05 }}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors group"
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-[color:var(--color-ai)] flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-medium text-foreground truncate group-hover:text-[color:var(--color-ai)] transition-colors">
                            {task.title}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {task.project_name}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <PriorityBadge priority={task.priority} size="sm" />
                          <span
                            className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${STATUS_COLOR[task.status] || ''}`}
                          >
                            {t(`dashboard.status.${task.status}`)}
                          </span>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 font-mono shrink-0">
                            <Clock className="w-2.5 h-2.5" />{' '}
                            {formatDeadline(task.deadline, t, i18n.language)}
                          </span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </MotionCard>

              {/* Right column */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="flex flex-col gap-4"
              >
                {/* AI Insight */}
                <div className="ai-border ai-glow rounded-xl p-4 text-card-foreground bg-card">
                  <div className="flex items-center gap-1.5 mb-1.5 text-[color:var(--color-ai)]">
                    <Sparkles className="w-3.5 h-3.5" />
                    <p className="text-[10px] font-mono font-semibold uppercase tracking-widest">
                      AI Insight
                    </p>
                  </div>
                  {personalLoading ? (
                    <div className="space-y-1.5 animate-pulse">
                      <div className="h-3 w-full bg-muted rounded" />
                      <div className="h-3 w-3/4 bg-muted rounded" />
                    </div>
                  ) : personal?.overdue_count > 0 ? (
                    <p className="text-[12px] font-medium leading-relaxed">
                      {t('dashboard.ai.overdue_msg_1')}
                      <span className="text-[color:var(--color-destructive)] font-bold">
                        {personal.overdue_count}
                        {t('dashboard.ai.overdue_msg_2')}
                      </span>
                      {t('dashboard.ai.overdue_msg_3')}
                    </p>
                  ) : personal?.my_tasks?.in_progress > 0 ? (
                    <p className="text-[12px] font-medium leading-relaxed">
                      {t('dashboard.ai.in_progress_msg_1')}
                      <span className="text-[color:var(--color-ai)] font-bold">
                        {personal.my_tasks.in_progress}
                        {t('dashboard.ai.in_progress_msg_2')}
                      </span>
                      {t('dashboard.ai.in_progress_msg_3')}
                    </p>
                  ) : (
                    <p className="text-[12px] font-medium leading-relaxed">
                      {t('dashboard.ai.clear_msg_1')}
                      <span className="text-[color:var(--color-success)] font-bold">
                        {t('dashboard.ai.clear_msg_2')}
                      </span>
                      {t('dashboard.ai.clear_msg_3')}
                    </p>
                  )}
                </div>

                {/* My Projects */}
                <Card className="flex-1 overflow-hidden">
                  <SectionHeader
                    title={t('projectList.title')}
                    linkTo="/projects"
                    linkLabel={t('dashboard.all')}
                  />
                  {personalLoading ? (
                    <div className="p-3 space-y-2.5 animate-pulse">
                      {Array(3)
                        .fill(0)
                        .map((_, i) => (
                          <div key={i} className="space-y-1">
                            <div className="h-3 w-32 bg-muted rounded" />
                            <div className="h-2 w-full bg-muted rounded-full" />
                          </div>
                        ))}
                    </div>
                  ) : personal?.my_projects?.length === 0 ? (
                    <div className="px-4 py-6 text-center">
                      <FolderKanban className="w-6 h-6 text-muted-foreground/40 mx-auto mb-1.5" />
                      <p className="text-xs text-muted-foreground">{t('dashboard.no_projects')}</p>
                    </div>
                  ) : (
                    <div className="p-3 space-y-3">
                      {personal?.my_projects?.slice(0, 5).map((proj, i) => {
                        const pct = progressPercent(proj.my_tasks_done, proj.my_tasks_total);
                        return (
                          <motion.div
                            key={proj.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.3 + i * 0.05 }}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <Link
                                to={`/projects/${proj.id}`}
                                className="text-[12px] font-medium text-foreground hover:text-[color:var(--color-ai)] truncate max-w-[160px] transition-colors"
                              >
                                {proj.name}
                              </Link>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {proj.my_role === 'Project Manager' && (
                                  <span className="text-[10px] font-mono uppercase tracking-wider text-[color:var(--color-ai)] bg-[color:var(--color-ai)]/10 px-1 py-0.5 rounded-sm">
                                    PM
                                  </span>
                                )}
                                <span className="text-[10px] font-mono text-muted-foreground">
                                  {proj.my_tasks_done}/{proj.my_tasks_total}
                                </span>
                              </div>
                            </div>
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                              <motion.div
                                className="h-full bg-[color:var(--color-ai)] rounded-full"
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ duration: 0.8, delay: 0.4 + i * 0.05 }}
                              />
                            </div>
                            {proj.my_tasks_total === 0 && (
                              <p className="text-[9px] text-muted-foreground/60 mt-0.5">
                                {t('dashboard.no_assigned_tasks')}
                              </p>
                            )}
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </Card>
              </motion.div>
            </div>

            {/* ── PM Section: Team Workload & Blocked Tasks ───────────────── */}
            {personal?.is_pm && !isPersonalMode && (
              <>
                <div className="flex items-center gap-1.5 text-[color:var(--color-ai)]">
                  <UserCheck className="w-3.5 h-3.5" />
                  <p className="text-[10px] font-mono font-semibold uppercase tracking-widest">
                    {t('dashboard.team_management')}
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Team Workload */}
                  <MotionCard
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="overflow-hidden"
                  >
                    <SectionHeader title={t('dashboard.team_workload')} />
                    {personal?.team_workload?.length === 0 ? (
                      <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                        {t('dashboard.no_team_members')}
                      </div>
                    ) : (
                      <div className="divide-y divide-border/50">
                        {personal?.team_workload?.map((member, i) => (
                          <motion.div
                            key={member.user_id}
                            initial={{ opacity: 0, x: -5 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.3 + i * 0.04 }}
                            className="px-4 py-2.5 flex items-center gap-3"
                          >
                            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[color:var(--color-primary)] to-[color:var(--color-ai)] text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                              {member.full_name?.charAt(0)?.toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[12px] font-medium text-foreground truncate">
                                {member.full_name}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[9px] text-[color:var(--color-ai)]">
                                  {member.in_progress_count}{' '}
                                  {t('dashboard.status.in_progress').toLowerCase()}
                                </span>
                                <span className="text-[9px] text-muted-foreground">
                                  {member.todo_count} {t('dashboard.status.todo').toLowerCase()}
                                </span>
                                {member.overdue_count > 0 && (
                                  <span className="text-[9px] text-[color:var(--color-destructive)] font-semibold">
                                    {member.overdue_count} {t('dashboard.overdue').toLowerCase()}!
                                  </span>
                                )}
                              </div>
                            </div>
                            {/* Mini workload bar */}
                            <div className="flex gap-0.5 shrink-0">
                              {Array(Math.min(member.in_progress_count, 5))
                                .fill(0)
                                .map((_, j) => (
                                  <div
                                    key={j}
                                    className="w-1.5 h-4 bg-[color:var(--color-ai)] rounded-sm opacity-80"
                                  />
                                ))}
                              {member.in_progress_count > 5 && (
                                <span className="text-[9px] text-muted-foreground self-center ml-0.5">
                                  +{member.in_progress_count - 5}
                                </span>
                              )}
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </MotionCard>

                  {/* Blocked Tasks */}
                  <MotionCard
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.35 }}
                    className="overflow-hidden"
                  >
                    <SectionHeader title={t('dashboard.blocked_tasks')} />
                    {personal?.blocked_tasks?.length === 0 ? (
                      <div className="px-4 py-6 text-center">
                        <CheckCircle2 className="w-6 h-6 text-[color:var(--color-success)]/50 mx-auto mb-1.5" />
                        <p className="text-xs text-muted-foreground">{t('dashboard.no_blocked')}</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-border/50">
                        {personal?.blocked_tasks?.map((task, i) => (
                          <motion.div
                            key={task.id}
                            initial={{ opacity: 0, x: -5 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.35 + i * 0.04 }}
                            className="px-4 py-2.5 flex items-center gap-3 hover:bg-muted/30 transition-colors"
                          >
                            <Lock className="w-3.5 h-3.5 text-[color:var(--color-warning)] shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-[12px] font-medium text-foreground truncate">
                                {task.title}
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                {task.project_name}
                              </p>
                            </div>
                            <span className="text-[9px] font-semibold text-[color:var(--color-warning)] bg-[color:var(--color-warning)]/10 px-1.5 py-0.5 rounded shrink-0">
                              {task.blocked_by_count} {t('dashboard.blocked_count')}
                            </span>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </MotionCard>
                </div>
              </>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="myday"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-1 lg:grid-cols-5 gap-4 w-full"
          >
            {/* Today's Checklist */}
            <Card className="lg:col-span-3 overflow-hidden flex flex-col glass-surface border border-border/60">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                  <CalendarDays className="w-4 h-4 text-[color:var(--color-ai)]" />{' '}
                  {t('dashboard.my_day.title')}
                </h2>
                <span className="text-[10px] font-mono font-bold text-muted-foreground uppercase">
                  {format(new Date(), 'EEEE, dd MMMM', {
                    locale: i18n.language === 'vi' ? viLocale : enLocale,
                  })}
                </span>
              </div>

              {myDayLoading ? (
                <div className="p-4 space-y-3">
                  {Array(3)
                    .fill(0)
                    .map((_, i) => (
                      <div key={i} className="flex items-center gap-3 animate-pulse">
                        <div className="w-4 h-4 rounded bg-muted shrink-0" />
                        <div className="flex-1 space-y-1">
                          <div className="h-3 w-40 bg-muted rounded" />
                          <div className="h-2 w-24 bg-muted rounded" />
                        </div>
                      </div>
                    ))}
                </div>
              ) : myDayTasks.length === 0 ? (
                <div className="p-10 text-center flex flex-col items-center justify-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-[color:var(--color-success)]/10 text-[color:var(--color-success)] flex items-center justify-center">
                    <CheckCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {t('dashboard.my_day.empty')}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t('dashboard.my_day.empty_desc')}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-border/50 max-h-[60vh] overflow-y-auto scrollbar-thin">
                  {myDayTasks.map((task) => {
                    const isCompleted = task.status === 'done';
                    return (
                      <div
                        key={task.id}
                        onClick={() => setSelectedTask(task)}
                        className="flex items-center gap-3.5 px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer group"
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleTaskMutation.mutate({
                              id: task.id,
                              status: isCompleted ? 'todo' : 'done',
                            });
                          }}
                          className={`w-4.5 h-4.5 rounded border transition-colors shrink-0 flex items-center justify-center ${
                            isCompleted
                              ? 'bg-emerald-500 border-emerald-500 text-white'
                              : 'border-border/80 group-hover:border-[color:var(--color-ai)] hover:bg-[color:var(--color-ai)]/5'
                          }`}
                        >
                          {isCompleted && <CheckCircle className="w-3.5 h-3.5 stroke-[3]" />}
                        </button>

                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-[12px] font-medium leading-snug truncate transition-all ${
                              isCompleted
                                ? 'line-through text-muted-foreground/75'
                                : 'text-foreground group-hover:text-[color:var(--color-ai)]'
                            }`}
                          >
                            {task.title}
                          </p>
                          <p className="text-[10px] text-muted-foreground/70 mt-0.5 flex items-center gap-1.5">
                            <span>
                              {task.project_name
                                ? t('dashboard.my_day.project_label', { name: task.project_name })
                                : t('dashboard.my_day.personal_project')}
                            </span>
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <PriorityBadge priority={task.priority} size="sm" />
                          <span
                            className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${STATUS_COLOR[task.status] || ''}`}
                          >
                            {t(`dashboard.status.${task.status}`)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* Pomodoro Timer */}
            <div className="lg:col-span-2 flex flex-col gap-4">
              <PomodoroWidget myDayTasks={myDayTasks} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Task Detail Modal */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          projectId={selectedTask.project_id}
          onClose={() => {
            setSelectedTask(null);
            qc.invalidateQueries({ queryKey: ['dashboard', 'my-day'] });
          }}
        />
      )}
    </div>
  );
}
