import { useTranslation } from 'react-i18next';
import { BookOpen, Bug, CheckSquare } from 'lucide-react';

const STYLES = {
  story: { icon: BookOpen, className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  task: { icon: CheckSquare, className: 'bg-sky-500/10 text-sky-600 dark:text-sky-400' },
  bug: { icon: Bug, className: 'bg-rose-500/10 text-rose-600 dark:text-rose-400' },
};

export default function TaskTypeBadge({ type = 'task', showLabel = false, className = '' }) {
  const { t } = useTranslation();
  const style = STYLES[type] || STYLES.task;
  const Icon = style.icon;
  const label = t(`taskType.${type in STYLES ? type : 'task'}`);

  return (
    <span
      title={label}
      aria-label={label}
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold shrink-0 ${style.className} ${className}`}
    >
      <Icon className="w-3 h-3" />
      {showLabel && label}
    </span>
  );
}
