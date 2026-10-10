import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/Badge';

/**
 * A unified Status Badge component that handles colors and i18n
 * for tasks, sprints, and projects across the entire app.
 */

const CONFIG = {
  task: {
    todo:        { colorClass: 'bg-muted text-muted-foreground border-transparent', i18nKey: 'dashboard.status.todo' },
    in_progress: { colorClass: 'bg-[color:var(--color-ai)]/10 text-[color:var(--color-ai)] border-[color:var(--color-ai)]/20', i18nKey: 'dashboard.status.in_progress' },
    review:      { colorClass: 'bg-[color:var(--color-warning)]/15 text-[color:var(--color-warning)] border-[color:var(--color-warning)]/20', i18nKey: 'dashboard.status.review' },
    done:        { colorClass: 'bg-[color:var(--color-success)]/15 text-[color:var(--color-success)] border-[color:var(--color-success)]/20', i18nKey: 'dashboard.status.done' },
    blocked:     { colorClass: 'bg-destructive/15 text-destructive border-destructive/20', i18nKey: 'dashboard.status.blocked' },
  },
  sprint: {
    planning:  { colorClass: 'bg-sky-500/10 text-sky-500 border-sky-500/20', i18nKey: 'timeline.legend.planning' },
    active:    { colorClass: 'bg-[color:var(--color-success)]/15 text-[color:var(--color-success)] border-[color:var(--color-success)]/20', i18nKey: 'timeline.legend.active' },
    completed: { colorClass: 'bg-slate-500/10 text-slate-500 border-slate-500/20', i18nKey: 'timeline.legend.completed' },
  },
  project: {
    active:   { colorClass: 'bg-[color:var(--color-success)]/15 text-[color:var(--color-success)] border-[color:var(--color-success)]/20', i18nKey: 'project.status_active' },
    archived: { colorClass: 'bg-muted text-muted-foreground border-border', i18nKey: 'project.status_archived' },
  },
  insight: {
    success: { colorClass: 'bg-[color:var(--color-success)]/15 text-[color:var(--color-success)] border-none', i18nKey: 'projectOverview.insight_labels.success' },
    warning: { colorClass: 'bg-[color:var(--color-warning)]/15 text-[color:var(--color-warning)] border-none', i18nKey: 'projectOverview.insight_labels.warning' },
    risk:    { colorClass: 'bg-[color:var(--color-destructive)]/15 text-[color:var(--color-destructive)] border-none', i18nKey: 'projectOverview.insight_labels.risk' },
    info:    { colorClass: 'bg-sky-500/15 text-sky-500 border-none', i18nKey: 'projectOverview.insight_labels.info' },
  },
  health: {
    excellent: { colorClass: 'bg-sky-500/15 text-sky-500 border-none', i18nKey: 'ai_insights.health_label.excellent' },
    good:      { colorClass: 'bg-[color:var(--color-success)]/15 text-[color:var(--color-success)] border-none', i18nKey: 'ai_insights.health_label.good' },
    at_risk:   { colorClass: 'bg-[color:var(--color-warning)]/15 text-[color:var(--color-warning)] border-none', i18nKey: 'ai_insights.health_label.at_risk' },
    warning:   { colorClass: 'bg-[color:var(--color-warning)]/15 text-[color:var(--color-warning)] border-none', i18nKey: 'ai_insights.health_label.warning' },
    critical:  { colorClass: 'bg-[color:var(--color-destructive)]/15 text-[color:var(--color-destructive)] border-none', i18nKey: 'ai_insights.health_label.critical' },
  }
};

export function StatusBadge({ type = 'task', status, className = '', variant = 'glass' }) {
  const { t } = useTranslation();
  
  if (!status) return null;
  
  const typeConfig = CONFIG[type] || {};
  const config = typeConfig[status.toLowerCase()] || { 
    colorClass: 'bg-muted text-muted-foreground border-border', 
    i18nKey: `status.${status}` 
  };

  return (
    <Badge 
      variant={variant} 
      className={`shrink-0 text-[9px] uppercase tracking-widest font-mono ${config.colorClass} ${className}`}
    >
      {t(config.i18nKey, status)}
    </Badge>
  );
}

export default StatusBadge;
