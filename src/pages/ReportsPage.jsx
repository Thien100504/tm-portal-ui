import { useTranslation } from 'react-i18next';
import PriorityBadge from '@/components/ui/PriorityBadge';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { vi, enUS } from 'date-fns/locale';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
} from 'recharts';
import { BarChart3, Loader2, GitBranch } from 'lucide-react';
import dashboardService from '@/services/dashboardService';
import { useWorkspaceStore } from '@/store/workspaceStore';

const STATUS_COLORS = {
  todo:        '#94a3b8',
  in_progress: '#7c3aed',
  review:      '#f59e0b',
  done:        '#22c55e',
};

function Card({ children, className = '' }) {
  return (
    <div className={`rounded-2xl bg-card border border-border p-5 ${className}`}>
      {children}
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4">
      {children}
    </p>
  );
}

function Stat({ label, value, hint, tone = 'default' }) {
  const toneColor = {
    default:  'text-foreground',
    green:    'text-emerald-500',
    purple:   'text-[color:var(--color-ai)]',
    red:      'text-red-500',
    blue:     'text-[color:var(--color-primary)]',
  }[tone];

  return (
    <Card>
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`text-3xl font-semibold mt-1 tabular-nums ${toneColor}`}>{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>}
    </Card>
  );
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  return (
    <div style={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }}
      className="px-3 py-2 shadow-xl">
      <span className="text-foreground font-medium">{name}: </span>
      <span className="text-muted-foreground">{value}</span>
    </div>
  );
}

export default function ReportsPage() {
  const { t, i18n } = useTranslation();
  const dateFnsLocale = i18n.language === 'vi' ? vi : enUS;
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);

  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats', activeWorkspaceId],
    queryFn: () => dashboardService.getPersonalStats(activeWorkspaceId),
  });

  const taskTotal = stats
    ? (stats.my_tasks.todo + stats.my_tasks.in_progress + stats.my_tasks.review + stats.my_tasks.done_this_week)
    : 0;

  const donutData = stats ? [
    { name: t('dashboard.status.todo'),        value: stats.my_tasks.todo,           color: STATUS_COLORS.todo },
    { name: t('dashboard.status.in_progress'), value: stats.my_tasks.in_progress,    color: STATUS_COLORS.in_progress },
    { name: t('dashboard.status.review'),      value: stats.my_tasks.review,          color: STATUS_COLORS.review },
    { name: t('reports.done_this_week'),        value: stats.my_tasks.done_this_week, color: STATUS_COLORS.done },
  ].filter(d => d.value > 0) : [];

  return (
    <motion.div
      className="pb-6 max-w-5xl mx-auto space-y-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      {/* Header */}
      <div className="flex items-center gap-3.5">
        <div className="p-2.5 rounded-xl bg-gradient-to-tr from-[color:var(--color-primary)] to-[color:var(--color-ai)] text-white shadow-md shrink-0">
          <BarChart3 className="w-6 h-6" />
        </div>
        <div className="flex flex-col justify-center">
          <h1 className="text-2xl font-bold text-foreground tracking-tight leading-none mb-1">{t('sidebar.reports')}</h1>
          <p className="text-sm text-muted-foreground leading-none">{t('reports.subtitle', { defaultValue: 'Personal productivity & project health' })}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : !stats ? null : (
        <>
          {/* ── Stat cards ─────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Stat label={t('reports.done_this_week')} value={stats.my_tasks.done_this_week} tone="green"
              hint={t('reports.tasks_completed')} />
            <Stat label={t('reports.in_progress')}   value={stats.my_tasks.in_progress}    tone="purple" />
            <Stat label={t('reports.overdue')}        value={stats.overdue_count}            tone="red"
              hint={stats.overdue_count > 0 ? t('reports.needs_attention') : t('reports.all_on_track')} />
            <Stat label={t('reports.my_projects')}   value={stats.my_projects_count ?? stats.my_projects?.length ?? 0} tone="blue" />
          </div>

          {/* ── Task breakdown + Project progress ─────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* Donut */}
            <Card>
              <SectionTitle>{t('reports.task_breakdown')}</SectionTitle>
              {donutData.length === 0 ? (
                <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">
                  {t('reports.no_tasks')}
                </div>
              ) : (
                <div className="flex items-center gap-6">
                  <ResponsiveContainer width={140} height={140}>
                    <PieChart>
                      <Pie
                        data={donutData}
                        cx="50%" cy="50%"
                        innerRadius={44} outerRadius={64}
                        paddingAngle={3}
                        dataKey="value"
                        strokeWidth={0}
                      >
                        {donutData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-col gap-2.5 flex-1 min-w-0">
                    {donutData.map((d) => (
                      <div key={d.name} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
                          <span className="text-[12px] text-muted-foreground truncate">{d.name}</span>
                        </div>
                        <span className="text-[12px] font-semibold text-foreground tabular-nums shrink-0">{d.value}</span>
                      </div>
                    ))}
                    <div className="h-px bg-border mt-1" />
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground">Total</span>
                      <span className="text-[12px] font-bold text-foreground tabular-nums">{taskTotal}</span>
                    </div>
                  </div>
                </div>
              )}
            </Card>

            {/* Project progress */}
            <Card>
              <SectionTitle>{t('reports.project_progress')}</SectionTitle>
              {stats.my_projects.length === 0 ? (
                <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">
                  {t('reports.no_projects')}
                </div>
              ) : (
                <div className="space-y-4 max-h-52 overflow-y-auto pr-1 scrollbar-thin">
                  {[...stats.my_projects]
                    .sort((a, b) => {
                      const pA = a.my_tasks_total ? a.my_tasks_done / a.my_tasks_total : 0;
                      const pB = b.my_tasks_total ? b.my_tasks_done / b.my_tasks_total : 0;
                      return pB - pA;
                    })
                    .map((proj) => {
                      const pct = proj.my_tasks_total
                        ? Math.round((proj.my_tasks_done / proj.my_tasks_total) * 100) : 0;
                      return (
                        <div key={proj.id}>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[12px] font-medium text-foreground truncate max-w-[180px]">{proj.name}</span>
                            <span className="text-[11px] text-muted-foreground tabular-nums shrink-0 ml-2">
                              {proj.my_tasks_done}/{proj.my_tasks_total} · {pct}%
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                            <motion.div
                              className="h-full rounded-full bg-gradient-to-r from-[color:var(--color-primary)] to-[color:var(--color-ai)]"
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.7, ease: 'easeOut', delay: 0.1 }}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </Card>
          </div>

          {/* ── Upcoming deadlines ──────────────────────────── */}
          {stats.upcoming_tasks.length > 0 && (
            <Card>
              <SectionTitle>{t('reports.upcoming_deadlines')}</SectionTitle>
              <div className="divide-y divide-border/50">
                {stats.upcoming_tasks.slice(0, 8).map((task) => {
                  const isOverdue = new Date(task.deadline) < new Date();
                  return (
                    <div key={task.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isOverdue ? 'bg-red-500' : 'bg-amber-400'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium text-foreground truncate">{task.title}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{task.project_name}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <PriorityBadge priority={task.priority} size="sm" />
                        <span className={`text-[10px] font-medium tabular-nums ${isOverdue ? 'text-red-500' : 'text-amber-500'}`}>
                          {formatDistanceToNow(new Date(task.deadline), { addSuffix: true, locale: dateFnsLocale })}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* ── Team workload (PM only) ──────────────────────── */}
          {stats.is_pm && stats.team_workload.length > 0 && (
            <Card>
              <SectionTitle>{t('reports.team_workload')}</SectionTitle>
              <div className="space-y-4">
                {stats.team_workload.map((m) => {
                  const total = (m.todo_count || 0) + (m.in_progress_count || 0) + (m.overdue_count || 0);
                  const todoPct = total ? Math.round((m.todo_count / total) * 100) : 0;
                  const inProgPct = total ? Math.round((m.in_progress_count / total) * 100) : 0;
                  const overduePct = total ? Math.round((m.overdue_count / total) * 100) : 0;
                  return (
                    <div key={m.user_id ?? m.full_name}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[12px] font-medium text-foreground truncate">{m.full_name}</span>
                        <span className="text-[11px] text-muted-foreground tabular-nums shrink-0 ml-2">
                          {total} {t('common.tasks', { defaultValue: 'tasks' })}
                          {m.overdue_count > 0 && (
                            <span className="text-red-500 ml-1.5">· {m.overdue_count} overdue</span>
                          )}
                        </span>
                      </div>
                      <div className="flex h-1.5 rounded-full overflow-hidden bg-muted gap-px">
                        {todoPct > 0    && <div style={{ width: `${todoPct}%`,    background: STATUS_COLORS.todo }} />}
                        {inProgPct > 0  && <div style={{ width: `${inProgPct}%`,  background: STATUS_COLORS.in_progress }} />}
                        {overduePct > 0 && <div style={{ width: `${overduePct}%`, background: '#ef4444' }} />}
                      </div>
                    </div>
                  );
                })}
                {/* Legend */}
                <div className="flex items-center gap-4 pt-1">
                  {[
                    { color: STATUS_COLORS.todo, label: t('dashboard.status.todo') },
                    { color: STATUS_COLORS.in_progress, label: t('dashboard.status.in_progress') },
                    { color: '#ef4444', label: t('reports.overdue') },
                  ].map(({ color, label }) => (
                    <div key={label} className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                      <span className="text-[10px] text-muted-foreground">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {/* ── Blocked tasks (PM only) ──────────────────────── */}
          {stats.is_pm && stats.blocked_tasks.length > 0 && (
            <Card>
              <div className="flex items-center gap-2 mb-4">
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  {t('reports.blocked_tasks')}
                </p>
                <span className="text-[10px] font-semibold text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded-full">
                  {stats.blocked_tasks.length}
                </span>
              </div>
              <div className="divide-y divide-border/50">
                {stats.blocked_tasks.map((task) => (
                  <div key={task.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                    <GitBranch className="w-3.5 h-3.5 text-red-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-medium text-foreground truncate">{task.title}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{task.project_name}</p>
                    </div>
                    <span className="text-[10px] font-medium text-red-500 shrink-0 tabular-nums">
                      {task.blocked_by_count} {t('reports.blocking_deps')}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </motion.div>
  );
}
