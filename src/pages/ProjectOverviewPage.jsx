import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  Sparkles, Brain, Zap, RefreshCw,
  CheckCircle2, AlertTriangle, AlertCircle, Info, Users, Timer, Target, Activity,
  CheckSquare, Ban, Settings, PieChart,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { vi, enUS } from 'date-fns/locale';
import aiService from '@/services/aiService';
import projectService from '@/services/projectService';
import EditProjectModal from '@/components/EditProjectModal';
import StatusBadge from '@/components/ui/StatusBadge';
import { useTheme } from "@/contexts/useTheme";

import { Card, MotionCard } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useAuth } from '@/hooks/useAuth';
import { useProjectPermissions } from '@/hooks/useProjectPermissions';

// ── Constants ────────────────────────────────────────────────────────────────

const INSIGHT_META = {
  risk:    { icon: AlertCircle,   bg: 'bg-red-500/8',    border: 'border-red-500/20',   text: 'text-red-500',    badge: 'bg-red-500/10 text-red-500' },
  warning: { icon: AlertTriangle, bg: 'bg-amber-500/8',  border: 'border-amber-500/20', text: 'text-amber-500',  badge: 'bg-amber-500/10 text-amber-500' },
  success: { icon: CheckCircle2,  bg: 'bg-emerald-500/8',border: 'border-emerald-500/20',text: 'text-emerald-500',badge: 'bg-emerald-500/10 text-emerald-500' },
  info:    { icon: Info,          bg: 'bg-blue-500/8',   border: 'border-blue-500/20',  text: 'text-blue-500',   badge: 'bg-blue-500/10 text-blue-500' },
};

const _INSIGHT_LABEL = {
  risk:    'projectOverview.insight_labels.risk',
  warning: 'projectOverview.insight_labels.warning',
  success: 'projectOverview.insight_labels.success',
  info:    'projectOverview.insight_labels.info',
};

const HEALTH_GRADIENT = {
  green:  { from: '#22c55e', to: '#16a34a', glow: 'rgba(34,197,94,0.3)' },
  blue:   { from: '#3b82f6', to: '#2563eb', glow: 'rgba(59,130,246,0.3)' },
  yellow: { from: '#f59e0b', to: '#d97706', glow: 'rgba(245,158,11,0.3)' },
  red:    { from: '#ef4444', to: '#dc2626', glow: 'rgba(239,68,68,0.3)' },
};

const WORKLOAD_STYLE = {
  low:      { bar: 'bg-muted',            text: 'text-muted-foreground' },
  normal:   { bar: 'bg-emerald-500',      text: 'text-emerald-600' },
  high:     { bar: 'bg-amber-500',        text: 'text-amber-600' },
  critical: { bar: 'bg-red-500',          text: 'text-red-600' },
};

// ── Health Score Gauge ────────────────────────────────────────────────────────

function HealthGauge({ score, color, label }) {
  const r = 66;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - score / 100);
  const g = HEALTH_GRADIENT[color] || HEALTH_GRADIENT.blue;

  return (
    <div className="relative flex flex-col items-center">
      <svg width="168" height="168" viewBox="0 0 168 168" className="drop-shadow-sm">
        <defs>
          <linearGradient id="health-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={g.from} />
            <stop offset="100%" stopColor={g.to} />
          </linearGradient>
          <filter id="health-glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {/* Track */}
        <circle cx="84" cy="84" r={r} fill="none" stroke="currentColor"
          strokeWidth="10" className="text-muted/20" />
        {/* Arc */}
        <motion.circle
          cx="84" cy="84" r={r}
          fill="none"
          stroke="url(#health-grad)"
          strokeWidth="10"
          strokeDasharray={circ}
          strokeLinecap="round"
          transform="rotate(-90 84 84)"
          filter="url(#health-glow)"
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
        />
        {/* Score */}
        <text x="84" y="76" textAnchor="middle" fill="currentColor"
          fontSize="34" fontWeight="700" className="fill-foreground">
          {score}
        </text>
        <text x="84" y="98" textAnchor="middle" fontSize="12" className="fill-muted-foreground">
          / 100
        </text>
      </svg>
      <div className="mt-1 text-center">
        <span
          className="inline-block px-3 py-0.5 rounded-full text-[11px] font-semibold tracking-wide"
          style={{ background: g.glow, color: g.from }}
        >
          {label}
        </span>
      </div>
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, color, sub, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className="rounded-xl border border-border bg-card p-4 flex items-start gap-3"
    >
      <div className={`mt-0.5 p-2 rounded-lg ${color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-[11px] text-muted-foreground font-medium">{label}</p>
        <p className="text-2xl font-bold text-foreground leading-tight">{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </motion.div>
  );
}

// ── Insight Card ──────────────────────────────────────────────────────────────

function InsightCard({ card, delay = 0, isGlass, t }) {
  const meta = INSIGHT_META[card.type] || INSIGHT_META.info;
  const Icon = meta.icon;

  // i18n: prefer title_key/description_key from the server, fall back to the raw text
  const _title = card.title_key ? t(card.title_key) : card.title;
  const description = card.description_key
    ? t(card.description_key, card.description_params || {})
    : card.description;

  return (
    <MotionCard
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className={`p-4 ${isGlass ? meta.bg : 'bg-card'} ${meta.border}`}
    >
      <div className="flex items-start gap-3">
        <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${meta.text}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <StatusBadge type="insight" status={card.type} className={meta.badge} />
            {card.metric && (
              <span className={`text-[11px] font-bold ${meta.text}`}>{card.metric}</span>
            )}
          </div>
          <p className="text-[12px] text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
        </div>
      </div>
    </MotionCard>
  );
}

// ── Status Bar ────────────────────────────────────────────────────────────────

function StatusDistribution({ data, t }) {
  const { total_tasks, todo_tasks, in_progress_tasks, review_tasks, done_tasks } = data;
  if (!total_tasks) return null;

  const bars = [
    { key: 'todo',        count: todo_tasks,        label: t('dashboard.status.todo'),       color: 'bg-muted-foreground/30' },
    { key: 'in_progress', count: in_progress_tasks,  label: t('dashboard.status.in_progress'),    color: 'bg-[color:var(--color-ai)]' },
    { key: 'review',      count: review_tasks,        label: t('dashboard.status.review'),      color: 'bg-amber-500' },
    { key: 'done',        count: done_tasks,          label: t('projectOverview.stats.completed'),  color: 'bg-emerald-500' },
  ];

  return (
    <div className="space-y-3">
      {/* Stacked bar */}
      <div className="flex h-3 rounded-full overflow-hidden gap-px bg-muted/20">
        {bars.map(b => {
          const pct = total_tasks ? (b.count / total_tasks) * 100 : 0;
          return pct > 0 ? (
            <motion.div
              key={b.key}
              className={`${b.color} first:rounded-l-full last:rounded-r-full`}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
            />
          ) : null;
        })}
      </div>
      {/* Legend */}
      <div className="grid grid-cols-4 gap-2">
        {bars.map(b => (
          <div key={b.key} className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full shrink-0 ${b.color}`} />
            <div>
              <p className="text-[10px] text-muted-foreground">{b.label}</p>
              <p className="text-[13px] font-bold text-foreground">{b.count}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Team Workload ─────────────────────────────────────────────────────────────

function TeamWorkload({ members, t }) {
  if (!members?.length) return null;
  const maxCount = Math.max(...members.map(m => m.task_count), 1);

  return (
    <div className="space-y-2.5">
      {members.map((m, i) => {
        const style = WORKLOAD_STYLE[m.workload_level] || WORKLOAD_STYLE.normal;
        const pct = maxCount > 0 ? (m.task_count / maxCount) * 100 : 0;
        return (
          <motion.div
            key={m.user_id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06 }}
            className="flex items-center gap-3"
          >
            <div className="w-7 h-7 rounded-full bg-[color:var(--color-ai)]/10 text-[color:var(--color-ai)] flex items-center justify-center text-[11px] font-bold shrink-0 border border-[color:var(--color-ai)]/20">
              {m.full_name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[12px] font-medium text-foreground truncate">{m.full_name}</span>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  {m.overdue_count > 0 && (
                    <span className="text-[10px] text-red-500 font-medium">
                      {t('projectOverview.team.overdue_count', { count: m.overdue_count })}
                    </span>
                  )}
                  <Badge variant="glass" className={`${style.text} bg-current/10 border-none`}>
                    {t(`projectOverview.workload_levels.${m.workload_level}`)}
                  </Badge>
                </div>
              </div>
              <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${style.bar}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.7, ease: 'easeOut', delay: i * 0.06 + 0.1 }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {t('projectOverview.team.workload_desc', { active: m.task_count, in_progress: m.in_progress_count })}
              </p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

// ── AI Summary Card ───────────────────────────────────────────────────────────

function AISummaryCard({ summary, recommendations, isPowered, isGlass, t }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className={`rounded-xl border border-[color:var(--color-ai)]/25 p-5 ${
        isGlass ? 'bg-[color:var(--color-ai)]/5' : 'bg-card'
      }`}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 rounded-lg bg-[color:var(--color-ai)]/10">
          <Brain className="w-4 h-4 text-[color:var(--color-ai)]" />
        </div>
        <div>
          <h3 className="text-[13px] font-semibold text-foreground">{t('projectOverview.ai_analysis.title')}</h3>
          {isPowered && (
            <p className="text-[10px] text-[color:var(--color-ai-soft)]">{t('projectOverview.ai_analysis.powered_by')}</p>
          )}
        </div>
        {isPowered && (
          <Badge variant="glass" className="ml-auto flex items-center gap-1 text-[color:var(--color-ai-soft)] border-[color:var(--color-ai)]/20">
            <Sparkles className="w-2.5 h-2.5" />
            {t('projectOverview.ai_analysis.ai_generated')}
          </Badge>
        )}
      </div>

      {summary && (
        <p className="text-[13px] text-foreground leading-relaxed mb-4 pl-1 border-l-2 border-[color:var(--color-ai)]/30">
          {summary}
        </p>
      )}

      {recommendations?.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2.5">
            <Zap className="w-3.5 h-3.5 text-[color:var(--color-ai)]" />
            <span className="text-[11px] font-semibold text-foreground uppercase tracking-wide">
              {t('projectOverview.ai_analysis.recommendations')}
            </span>
          </div>
          <ol className="space-y-2">
            {recommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-2.5 text-[12px] text-foreground">
                <span className="mt-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[color:var(--color-ai)]/15 text-[color:var(--color-ai)] text-[10px] font-bold shrink-0">
                  {i + 1}
                </span>
                <span className="leading-relaxed">{rec}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {!isPowered && (
        <p className="text-[11px] text-muted-foreground italic">
          {t('projectOverview.ai_analysis.configure_api')}
        </p>
      )}
    </motion.div>
  );
}

// ── Sprint Card ───────────────────────────────────────────────────────────────

function SprintCard({ sprint, t }) {
  const pct = sprint.completion_rate;
  const color = sprint.is_on_track ? 'bg-emerald-500' : 'bg-amber-500';

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-[color:var(--color-ai)]" />
          <span className="text-[13px] font-semibold text-foreground">{sprint.sprint_name}</span>
        </div>
        <Badge variant="glass" className={`${
          sprint.is_on_track
            ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
            : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
        }`}>
          {sprint.is_on_track ? t('projectOverview.sprint.on_track') : t('projectOverview.sprint.needs_speed')}
        </Badge>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-3 text-center">
        <div>
          <p className="text-xl font-bold text-foreground">{pct.toFixed(0)}%</p>
          <p className="text-[10px] text-muted-foreground">{t('projectOverview.sprint.completed')}</p>
        </div>
        <div>
          <p className="text-xl font-bold text-foreground">{sprint.velocity}</p>
          <p className="text-[10px] text-muted-foreground">{t('projectOverview.sprint.task_done')}</p>
        </div>
        <div>
          <p className="text-xl font-bold text-foreground">
            {sprint.days_remaining ?? '–'}
          </p>
          <p className="text-[10px] text-muted-foreground">{t('projectOverview.sprint.days_remaining')}</p>
        </div>
      </div>

      <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.9, ease: 'easeOut', delay: 0.2 }}
        />
      </div>
    </Card>
  );
}

// ── Loading Skeleton ──────────────────────────────────────────────────────────

function Skeleton({ className }) {
  return <div className={`animate-pulse rounded-lg bg-muted/40 ${className}`} />;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-6 flex flex-col items-center gap-3 md:col-span-1">
          <Skeleton className="w-40 h-40 rounded-full" />
          <Skeleton className="w-24 h-5" />
        </div>
        <div className="md:col-span-2 grid grid-cols-2 gap-3 content-start">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="rounded-xl border border-border bg-card p-4">
              <Skeleton className="w-24 h-3 mb-2" />
              <Skeleton className="w-12 h-7" />
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="rounded-xl border border-border bg-card p-4">
            <Skeleton className="w-32 h-4 mb-2" />
            <Skeleton className="w-full h-3" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ProjectOverviewPage() {
  const { t, i18n } = useTranslation();
  const { id: projectId } = useParams();
  const { user: currentUser } = useAuth();
  const { can } = useProjectPermissions(projectId);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const { themeStyle } = useTheme();
  const isGlass = themeStyle === 'glass';

  // Load project details
  const { data: project } = useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => projectService.getProject(projectId),
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000,
  });

  const {
    data: insights,
    isLoading,
    isFetching,
    refetch,
    dataUpdatedAt,
  } = useQuery({
    // i18n.language is part of the queryKey so the data refetches when the language changes
    queryKey: ['ai-insights', projectId, i18n.language],
    queryFn: () => aiService.getInsights(projectId),
    enabled: !!projectId,
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });

  const lastUpdated = dataUpdatedAt
    ? formatDistanceToNow(new Date(dataUpdatedAt), { addSuffix: true, locale: i18n.language === 'vi' ? vi : enUS })
    : null;

  const riskCount = insights?.insights?.filter(c => c.type === 'risk').length || 0;
  const warningCount = insights?.insights?.filter(c => c.type === 'warning').length || 0;

  return (
    <div className="max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="px-5 pt-6 pb-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[color:var(--color-ai)]/10 border border-[color:var(--color-ai)]/20 text-[color:var(--color-ai)]">
              <PieChart className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-foreground">
                  {t('projectOverview.title')}
                </h1>
                {project?.status === 'active' && (
                  <StatusBadge type="project" status={project.status} />
                )}
              </div>
              <p className="text-[12px] text-muted-foreground mt-0.5">
                {project?.name || t('common.loading')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {lastUpdated && (
              <span className="text-[10px] text-muted-foreground hidden sm:block">
                {t('projectOverview.updated_at', { time: lastUpdated })}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{t('projectOverview.reanalyze')}</span>
            </Button>
            {/* Same rule as PUT /projects/{id}: the owner or a member with project.settings */}
            {(project?.owner_id === currentUser?.id || can('project.settings')) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditModalOpen(true)}
                className="flex items-center gap-1.5"
              >
                <Settings className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t('projectOverview.settings')}</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-5">
        {!projectId ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <Sparkles className="w-10 h-10 text-[color:var(--color-ai)]/40" />
            <p className="text-[14px] text-muted-foreground">{t('projectOverview.select_project')}</p>
          </div>
        ) : isLoading ? (
          <LoadingSkeleton />
        ) : !insights ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <AlertCircle className="w-10 h-10 text-red-500/40" />
            <p className="text-[14px] text-muted-foreground">{t('ai_insights.no_data')}</p>
            <p className="text-[12px] text-muted-foreground/80">{t('ai_insights.no_data_desc')}</p>
            <button onClick={() => refetch()} className="text-[12px] text-[color:var(--color-ai)] hover:underline mt-2">
              {t('ai_insights.analyze_btn')}
            </button>
          </div>
        ) : (
          <div className="space-y-4 max-w-4xl mx-auto">
            {/* Risk/Warning banner */}
            {(riskCount > 0 || warningCount > 0) && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-[12px] font-medium ${
                  riskCount > 0
                    ? 'bg-red-500/8 border-red-500/20 text-red-600'
                    : 'bg-amber-500/8 border-amber-500/20 text-amber-600'
                }`}
              >
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {riskCount > 0
                  ? t('projectOverview.details.banner_risks', { riskCount, andWarning: warningCount > 0 ? t('projectOverview.details.and_warnings', { warningCount }) : '' })
                  : t('projectOverview.details.banner_warnings', { warningCount })
                }
              </motion.div>
            )}

            {/* Top section: health + metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Health Score */}
              <MotionCard
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
                className="p-5 flex flex-col items-center gap-1 shadow-sm"
              >
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                  {t('projectOverview.health_score')}
                </p>
                <HealthGauge
                  score={insights.health_score}
                  color={insights.health_color}
                  label={t(`ai_insights.health_label.${insights.health_label}`)}
                />
                <p className="text-[11px] text-muted-foreground mt-2 text-center">
                  {t('projectOverview.health_desc', { total: insights.total_tasks, members: insights.team_insights.length })}
                </p>
              </MotionCard>

              {/* 4 metric cards */}
              <div className="md:col-span-2 grid grid-cols-2 gap-3 content-start">
                <StatCard
                  label={t('projectOverview.stats.total_tasks')}
                  value={insights.total_tasks}
                  icon={CheckSquare}
                  color="bg-[color:var(--color-ai)]/10 text-[color:var(--color-ai)]"
                  sub={t('projectOverview.stats.completion_rate', { rate: insights.completion_rate.toFixed(0) })}
                  delay={0.05}
                />
                <StatCard
                  label={t('projectOverview.stats.completed')}
                  value={insights.done_tasks}
                  icon={CheckCircle2}
                  color="bg-emerald-500/10 text-emerald-500"
                  sub={t('projectOverview.stats.in_progress', { count: insights.in_progress_tasks })}
                  delay={0.1}
                />
                <StatCard
                  label={t('projectOverview.stats.overdue')}
                  value={insights.overdue_tasks}
                  icon={Timer}
                  color={insights.overdue_tasks > 0 ? 'bg-red-500/10 text-red-500' : 'bg-muted text-muted-foreground'}
                  sub={insights.overdue_tasks > 0 ? t('projectOverview.stats.needs_action') : t('projectOverview.stats.all_on_track')}
                  delay={0.15}
                />
                <StatCard
                  label={t('projectOverview.stats.blocked')}
                  value={insights.blocked_tasks}
                  icon={Ban}
                  color={insights.blocked_tasks > 0 ? 'bg-amber-500/10 text-amber-500' : 'bg-muted text-muted-foreground'}
                  sub={insights.blocked_tasks > 0 ? t('projectOverview.stats.dependency_not_done') : t('projectOverview.stats.no_blocked')}
                  delay={0.2}
                />
              </div>
            </div>

            {/* Task distribution */}
            <MotionCard
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="p-4"
            >
              <div className="flex items-center gap-2 mb-3">
                <Activity className="w-4 h-4 text-[color:var(--color-ai)]" />
                <h2 className="text-[13px] font-semibold text-foreground">{t('projectOverview.status_distribution')}</h2>
              </div>
              <StatusDistribution data={insights} t={t} />
            </MotionCard>

            {/* AI Summary */}
            <AISummaryCard
              summary={insights.ai_summary}
              recommendations={insights.ai_recommendations}
              isPowered={insights.ai_powered}
              isGlass={isGlass}
              t={t}
            />

            {/* Sprint + Team in 2 cols */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Active Sprint */}
              <div>
                {insights.active_sprint ? (
                  <>
                    <div className="flex items-center gap-2 mb-2.5">
                      <Target className="w-3.5 h-3.5 text-[color:var(--color-ai)]" />
                      <h2 className="text-[13px] font-semibold text-foreground">{t('projectOverview.sprint.current')}</h2>
                    </div>
                    <SprintCard sprint={insights.active_sprint} t={t} />
                  </>
                ) : (
                  <Card className={`border-dashed p-5 flex flex-col items-center justify-center gap-2 text-center h-full min-h-[120px] ${
                    isGlass ? 'bg-muted/20' : 'bg-card'
                  }`}>
                    <Target className="w-6 h-6 text-muted-foreground/40" />
                    <p className="text-[12px] text-muted-foreground">{t('projectOverview.sprint.no_sprint')}</p>
                  </Card>
                )}
              </div>

              {/* Team Workload */}
              <div>
                <div className="flex items-center gap-2 mb-2.5">
                  <Users className="w-3.5 h-3.5 text-[color:var(--color-ai)]" />
                  <h2 className="text-[13px] font-semibold text-foreground">
                    {t('projectOverview.team.workload')}
                  </h2>
                  <span className="text-[10px] text-muted-foreground ml-auto">
                    {t('projectOverview.team.members_count', { count: insights.team_insights.length })}
                  </span>
                </div>
                <Card className="p-4">
                  {insights.team_insights.length === 0 ? (
                    <p className="text-[12px] text-muted-foreground text-center py-4">{t('projectOverview.team.no_members')}</p>
                  ) : (
                    <TeamWorkload members={insights.team_insights} t={t} />
                  )}
                </Card>
              </div>
            </div>

            {/* Insights cards grid */}
            {insights.insights.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2.5">
                  <Sparkles className="w-3.5 h-3.5 text-[color:var(--color-ai)]" />
                  <h2 className="text-[13px] font-semibold text-foreground">{t('projectOverview.details.title')}</h2>
                  <span className="ml-auto text-[10px] text-muted-foreground">
                    {riskCount > 0 && <span className="text-red-500 mr-1">{t('projectOverview.details.risk_count', { count: riskCount })}</span>}
                    {warningCount > 0 && <span className="text-amber-500">{t('projectOverview.details.warning_count', { count: warningCount })}</span>}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {insights.insights.map((card, i) => (
                    <InsightCard key={i} card={card} delay={i * 0.05} isGlass={isGlass} t={t} />
                  ))}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="pt-2 pb-4 text-center">
              <p className="text-[10px] text-muted-foreground/60">
                {t('projectOverview.analyzed_at', { time: new Date(insights.generated_at).toLocaleString(i18n.language === 'vi' ? 'vi-VN' : 'en-US', {
                  day: '2-digit', month: '2-digit', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                }) })}
                {insights.ai_powered && ` · ${t('projectOverview.ai_narrative')}`}
              </p>
            </div>
          </div>
        )}
      </div>

      {isEditModalOpen && project && (
        <EditProjectModal project={project} onClose={() => setIsEditModalOpen(false)} />
      )}
    </div>
  );
}
