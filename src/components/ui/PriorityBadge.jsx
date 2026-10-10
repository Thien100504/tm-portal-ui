import { useTranslation } from 'react-i18next';

const CONFIG = {
  high: {
    dot: 'bg-[color:var(--color-destructive)]',
    pill: 'text-[color:var(--color-destructive)] bg-[color:var(--color-destructive)]/12 border border-[color:var(--color-destructive)]/25',
    labelKey: 'kanban.card.priority.high',
  },
  medium: {
    dot: 'bg-[color:var(--color-warning)]',
    pill: 'text-[color:var(--color-warning)] bg-[color:var(--color-warning)]/12 border border-[color:var(--color-warning)]/25',
    labelKey: 'kanban.card.priority.medium',
  },
  low: {
    dot: 'bg-[color:var(--color-success)]',
    pill: 'text-[color:var(--color-success)] bg-[color:var(--color-success)]/12 border border-[color:var(--color-success)]/25',
    labelKey: 'kanban.card.priority.low',
  },
};

/**
 * PriorityBadge — consistent pill for task priority.
 * @param {string} priority - 'high' | 'medium' | 'low'
 * @param {'sm'|'md'} size
 * @param {string} className
 */
export default function PriorityBadge({ priority = 'medium', size = 'md', className = '' }) {
  const { t } = useTranslation();
  const cfg = CONFIG[priority] || CONFIG.medium;

  const textSize = size === 'sm' ? 'text-[9px]' : 'text-[10px]';
  const dotSize = size === 'sm' ? 'w-1 h-1' : 'w-1.5 h-1.5';
  const padding = size === 'sm' ? 'px-1.5 py-0.5' : 'px-2 py-0.5';

  return (
    <span
      className={[
        'inline-flex items-center gap-1 font-semibold uppercase tracking-wider rounded-md whitespace-nowrap',
        textSize,
        padding,
        cfg.pill,
        className,
      ].join(' ')}
    >
      <span className={`rounded-full shrink-0 ${dotSize} ${cfg.dot}`} />
      {t(cfg.labelKey)}
    </span>
  );
}
