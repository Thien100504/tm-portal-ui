import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  GanttChart, CalendarDays, AlertCircle,
  CheckCircle2, Clock, Circle, Layers
} from 'lucide-react';
import sprintService from '@/services/sprintService';
import taskService from '@/services/taskService';
import { StatusBadge } from '@/components/ui/StatusBadge';

// ─── Constants ────────────────────────────────────────────────────────────────

const LABEL_W = 220;    // px — fixed label column width
const ROW_H   = 64;     // px — each sprint row height
const RULER_H = 48;     // px — date ruler height
const PX_PER_DAY = 24;  // base pixels per day

const SPRINT_COLORS = {
  planning:  { barBg: 'bg-sky-500/20',     barBorder: 'border-sky-500/50',     fill: 'bg-sky-500',     text: 'text-sky-400'   },
  active:    { barBg: 'bg-emerald-500/20', barBorder: 'border-emerald-500/60', fill: 'bg-emerald-500', text: 'text-emerald-400'},
  completed: { barBg: 'bg-slate-500/10',   barBorder: 'border-slate-500/30',   fill: 'bg-slate-500',   text: 'text-slate-400' },
};

const TASK_DOT_COLOR = {
  done:        'bg-emerald-500',
  in_progress: 'bg-sky-500',
  review:      'bg-violet-500',
  blocked:     'bg-rose-500',
  todo:        'bg-slate-400',
};

// ─── Date helpers ─────────────────────────────────────────────────────────────

function parseDate(str) {
  if (!str) return null;
  const d = new Date(str);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function fmtShort(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtMonthYear(date) {
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

// Return Monday-anchored week-start dates within [start, end]
function weekStarts(start, end) {
  const result = [];
  const cur = new Date(start);
  const dow = cur.getDay();
  cur.setDate(cur.getDate() - (dow === 0 ? 6 : dow - 1)); // rewind to Monday
  while (cur <= end) {
    result.push(new Date(cur));
    cur.setDate(cur.getDate() + 7);
  }
  return result;
}

// Return first-of-month dates in [start, end]
function monthStarts(start, end) {
  const result = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cur <= end) {
    result.push(new Date(cur));
    cur.setMonth(cur.getMonth() + 1);
  }
  return result;
}

// ─── Derived position ─────────────────────────────────────────────────────────

function dateToPx(date, rangeStart) {
  return Math.round(((new Date(date) - rangeStart) / 86_400_000) * PX_PER_DAY);
}

// Removed local StatusBadge in favor of shared component

// ─── Date Ruler ──────────────────────────────────────────────────────────────

function DateRuler({ rangeStart, rangeEnd, chartWidth }) {
  const months = useMemo(() => monthStarts(rangeStart, rangeEnd), [rangeStart, rangeEnd]);
  const weeks  = useMemo(() => weekStarts(rangeStart, rangeEnd),  [rangeStart, rangeEnd]);

  return (
    <div className="relative border-b border-border bg-muted/20" style={{ height: RULER_H, width: chartWidth }}>
      {/* Month labels — top half */}
      {months.map((m) => {
        const x = dateToPx(m, rangeStart);
        if (x < 0 || x > chartWidth) return null;
        return (
          <div key={m.toISOString()} className="absolute top-0 flex items-center" style={{ left: x, height: RULER_H / 2 }}>
            <div className="h-full w-px bg-border/70" />
            <span className="pl-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap select-none">
              {fmtMonthYear(m)}
            </span>
          </div>
        );
      })}

      {/* Week labels — bottom half */}
      {weeks.map((w) => {
        const x = dateToPx(w, rangeStart);
        if (x < 0 || x > chartWidth) return null;
        return (
          <div key={`wk-${w.toISOString()}`} className="absolute bottom-0 flex items-center" style={{ left: x, height: RULER_H / 2 }}>
            <div className="h-full w-px bg-border/30" />
            <span className="pl-1 text-[9px] text-muted-foreground/50 whitespace-nowrap select-none">
              {w.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Sprint Bar Row (inside scrollable area) ──────────────────────────────────

function SprintBarRow({ sprint, tasks, rangeStart, chartWidth, isEven, t }) {
  const colors = SPRINT_COLORS[sprint.status] ?? SPRINT_COLORS.planning;
  const start = parseDate(sprint.start_date);
  const end   = parseDate(sprint.end_date);
  const today = new Date(); today.setHours(0,0,0,0);

  const hasBar = !!(start && end && end >= start);
  const barLeft  = hasBar ? Math.max(0, dateToPx(start, rangeStart)) : 0;
  const barWidth = hasBar ? Math.max(4, dateToPx(end, rangeStart) - barLeft + PX_PER_DAY) : 0;

  const sprintTasks = tasks.filter((t) => t.sprint_id === sprint.id);
  const done = sprintTasks.filter((t) => t.status === 'done').length;
  const prog = sprintTasks.length > 0 ? Math.round((done / sprintTasks.length) * 100) : null;

  const deadlines = sprintTasks
    .filter((t) => t.due_date)
    .map((t) => {
      const due = parseDate(t.due_date);
      const x   = dateToPx(due, rangeStart);
      const overdue = due < today && t.status !== 'done';
      const dot = overdue ? 'bg-rose-500' : (TASK_DOT_COLOR[t.status] ?? 'bg-slate-400');
      return { task: t, x, dot, due };
    });

  // Week grid lines
  const weeks = useMemo(() => weekStarts(rangeStart, addDays(rangeStart, chartWidth / PX_PER_DAY)), [rangeStart, chartWidth]);

  return (
    <div
      className={`relative border-b border-border/40 ${isEven ? 'bg-muted/[0.07]' : ''}`}
      style={{ height: ROW_H, width: chartWidth }}
    >
      {/* Week grid lines */}
      {weeks.map((w) => {
        const x = dateToPx(w, rangeStart);
        if (x < 0 || x > chartWidth) return null;
        return (
          <div
            key={w.toISOString()}
            className="absolute top-0 bottom-0 w-px bg-border/20 pointer-events-none"
            style={{ left: x }}
          />
        );
      })}

      {hasBar && (
        <>
          {/* Sprint bar */}
          <div
            className={`absolute top-1/2 -translate-y-1/2 rounded border ${colors.barBg} ${colors.barBorder} overflow-hidden`}
            style={{ left: barLeft, width: barWidth, height: 32 }}
            title={`${sprint.name}: ${fmtShort(start)} – ${fmtShort(end)}`}
          >
            {/* Progress fill */}
            {prog !== null && (
              <div className={`h-full opacity-40 ${colors.fill}`} style={{ width: `${prog}%` }} />
            )}
            {/* Label */}
            {barWidth > 60 && (
              <span className={`absolute inset-0 flex items-center px-2 text-[11px] font-medium truncate ${colors.text}`}>
                {sprint.name}{prog !== null ? ` · ${prog}%` : ''}
              </span>
            )}
          </div>

          {/* Task deadline markers */}
          {deadlines.map(({ task, x, dot, due }) => {
            if (x < 0 || x > chartWidth) return null;
            return (
              <div
                key={task.id}
                className="absolute group z-10"
                style={{ left: x, top: 0, bottom: 0, width: 1 }}
              >
                {/* Tick line */}
                <div className={`w-0.5 h-full ${dot} opacity-60`} />
                {/* Diamond */}
                <div
                  className={`absolute w-3 h-3 rotate-45 ${dot} shadow-sm -translate-x-[5px]`}
                  style={{ top: ROW_H / 2 - 6 }}
                />
                {/* Tooltip */}
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 min-w-[140px]">
                  <div className="bg-card border border-border rounded-lg px-2.5 py-2 shadow-2xl whitespace-nowrap text-left">
                    <p className="text-[11px] font-semibold text-foreground truncate max-w-[180px]">{task.title}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{t('timeline.due', { date: fmtShort(due) })}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                      <span className="text-[10px] text-muted-foreground capitalize">{t(`dashboard.status.${task.status}`, task.status?.replace('_', ' '))}</span>
                    </div>
                  </div>
                  {/* Arrow */}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-border" />
                </div>
              </div>
            );
          })}
        </>
      )}

      {!hasBar && (
        <div className="absolute inset-0 flex items-center pl-4">
          <span className="text-[11px] italic text-muted-foreground/35">{t('timeline.no_dates')}</span>
        </div>
      )}
    </div>
  );
}

// ─── Sprint Label (fixed column) ──────────────────────────────────────────────

function SprintLabel({ sprint, tasks, isEven }) {
  const sprintTasks = tasks.filter((t) => t.sprint_id === sprint.id);
  const done = sprintTasks.filter((t) => t.status === 'done').length;
  const prog = sprintTasks.length > 0 ? Math.round((done / sprintTasks.length) * 100) : null;
  const start = parseDate(sprint.start_date);
  const end   = parseDate(sprint.end_date);

  return (
    <div
      className={`border-b border-border/40 flex flex-col justify-center gap-1 px-3 py-2 ${isEven ? 'bg-muted/[0.07]' : ''}`}
      style={{ height: ROW_H, width: LABEL_W, minWidth: LABEL_W }}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-[12px] font-semibold text-foreground truncate" title={sprint.name}>
          {sprint.name}
        </span>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        <StatusBadge type="sprint" status={sprint.status} />
        {prog !== null && (
          <span className="text-[10px] text-muted-foreground">{prog}%</span>
        )}
      </div>
      {start && end && (
        <p className="text-[10px] text-muted-foreground/55 leading-none">
          {fmtShort(start)} – {fmtShort(end)}
        </p>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TimelinePage() {
  const { t } = useTranslation();
  const { id: projectId } = useParams();

  const { data: sprints = [], isLoading: loadingSprints } = useQuery({
    queryKey: ['sprints', projectId],
    queryFn: () => sprintService.getSprints(projectId),
    enabled: !!projectId,
    select: (d) => (Array.isArray(d) ? d : d?.items ?? []),
  });

  const { data: tasks = [], isLoading: loadingTasks } = useQuery({
    queryKey: ['tasks', projectId],
    queryFn: () => taskService.getTasks(projectId),
    enabled: !!projectId,
    select: (d) => (Array.isArray(d) ? d : d?.items ?? []),
  });

  const isLoading = loadingSprints || loadingTasks;

  // ── Range & chart dimensions ──────────────────────────────────────────────
  const { rangeStart, rangeEnd, chartWidth, todayX } = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0);
    const datedSprints = sprints.filter((s) => s.start_date && s.end_date);

    let rStart, rEnd;
    if (datedSprints.length === 0) {
      rStart = addDays(today, -14);
      rEnd   = addDays(today, 75);
    } else {
      const starts = datedSprints.map((s) => parseDate(s.start_date).getTime());
      const ends   = datedSprints.map((s) => parseDate(s.end_date).getTime());
      rStart = addDays(new Date(Math.min(...starts)), -7);
      rEnd   = addDays(new Date(Math.max(...ends)), 14);
    }

    const totalDays = Math.ceil((rEnd - rStart) / 86_400_000);
    const cw = Math.max(900, totalDays * PX_PER_DAY);
    const todayXPx = dateToPx(today, rStart);

    return { rangeStart: rStart, rangeEnd: rEnd, chartWidth: cw, todayX: todayXPx };
  }, [sprints]);

  // ── Sorted sprints ────────────────────────────────────────────────────────
  const sortedSprints = useMemo(() => {
    const order = { active: 0, planning: 1, completed: 2 };
    return [...sprints].sort((a, b) => {
      const diff = (order[a.status] ?? 3) - (order[b.status] ?? 3);
      if (diff !== 0) return diff;
      return (parseDate(a.start_date)?.getTime() ?? 0) - (parseDate(b.start_date)?.getTime() ?? 0);
    });
  }, [sprints]);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const today = new Date(); today.setHours(0,0,0,0);
  const activeSprints = sprints.filter((s) => s.status === 'active').length;
  const overdueTasks  = tasks.filter((t) => t.due_date && t.status !== 'done' && parseDate(t.due_date) < today).length;

  // ── Loading ───────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-border/40 animate-pulse">
              <div className="h-4 bg-muted rounded w-1/4" />
              <div className="h-8 bg-muted rounded flex-1" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (sprints.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 min-h-[400px] text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
          <GanttChart className="w-7 h-7 text-muted-foreground/40" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-1">{t('timeline.no_sprints')}</h2>
          <p className="text-sm text-muted-foreground mb-4">{t('timeline.no_sprints_desc')}</p>
          <Link
            to={`/projects/${projectId}/sprints`}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity"
          >
            {t('timeline.go_to_sprints')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[color:var(--color-ai)]/10 border border-[color:var(--color-ai)]/20 text-[color:var(--color-ai)]">
            <GanttChart className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">{t('timeline.title')}</h1>
            <p className="text-[12px] text-muted-foreground mt-0.5">{t('timeline.subtitle')}</p>
          </div>
        </div>
        <Link
          to={`/projects/${projectId}/sprints`}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-border bg-card text-[12px] font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <Layers className="w-3.5 h-3.5" />
          {t('timeline.sprint_board')}
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: t('timeline.stats.total_sprints'), value: sprints.length,   icon: GanttChart,    color: 'text-sky-500'   },
          { label: t('timeline.stats.active'),        value: activeSprints,    icon: CheckCircle2,  color: 'text-emerald-500' },
          { label: t('timeline.stats.total_tasks'),   value: tasks.length,     icon: Circle,        color: 'text-foreground' },
          { label: t('timeline.stats.overdue_tasks'), value: overdueTasks,     icon: AlertCircle,   color: overdueTasks > 0 ? 'text-rose-500' : 'text-muted-foreground' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-xl border border-border bg-card px-4 py-3 flex items-center gap-3">
            <Icon className={`w-4 h-4 shrink-0 ${color}`} />
            <div>
              <p className="text-xl font-bold text-foreground leading-none">{value}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-5 flex-wrap text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-sky-500/30 border border-sky-500/50" />{t('timeline.legend.planning')}</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-500/30 border border-emerald-500/50" />{t('timeline.legend.active')}</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-slate-500/20 border border-slate-500/30" />{t('timeline.legend.completed')}</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rotate-45 bg-sky-500 inline-block" />{t('timeline.legend.task_deadline')}</span>
        <span className="flex items-center gap-1.5"><span className="w-0.5 h-3 bg-rose-500/70 inline-block" />{t('timeline.legend.today')}</span>
      </div>

      {/* ── Gantt chart ────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex" style={{ minWidth: 0 }}>

          {/* ── LEFT: fixed label column ──────────────────────────────────── */}
          <div className="shrink-0 border-r border-border/40 flex flex-col" style={{ width: LABEL_W }}>
            {/* Header cell */}
            <div
              className="border-b border-border bg-muted/20 flex items-center px-3"
              style={{ height: RULER_H }}
            >
              <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5" />
                {t('timeline.sprint_col')}
              </span>
            </div>
            {/* Label rows */}
            {sortedSprints.map((sprint, i) => (
              <SprintLabel key={sprint.id} sprint={sprint} tasks={tasks} isEven={i % 2 === 1} />
            ))}
          </div>

          {/* ── RIGHT: scrollable timeline ────────────────────────────────── */}
          <div className="flex-1 overflow-x-auto scrollbar-thin relative">
            <div style={{ width: chartWidth }} className="relative">

              {/* Date ruler */}
              <DateRuler rangeStart={rangeStart} rangeEnd={rangeEnd} chartWidth={chartWidth} />

              {/* Today line — full height overlay */}
              {todayX >= 0 && todayX <= chartWidth && (
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-rose-500/60 z-10 pointer-events-none"
                  style={{ left: todayX }}
                >
                  <div className="absolute -top-0 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-rose-500 border-2 border-background" />
                  <div className="absolute top-3 text-[9px] font-bold text-rose-500 left-1 whitespace-nowrap bg-card/80 px-1 rounded-sm border border-rose-500/20">
                    {t('timeline.legend.today')}
                  </div>
                </div>
              )}

              {/* Sprint bar rows */}
              {sortedSprints.map((sprint, i) => (
                <SprintBarRow
                  key={sprint.id}
                  sprint={sprint}
                  tasks={tasks}
                  rangeStart={rangeStart}
                  chartWidth={chartWidth}
                  isEven={i % 2 === 1}
                  t={t}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Footer hint */}
        {tasks.every((t) => !t.due_date) && (
          <div className="border-t border-border/40 px-5 py-3 flex items-center gap-2 text-[11px] text-muted-foreground/55">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            {t('timeline.footer_hint')}
          </div>
        )}
      </div>
    </div>
  );
}
