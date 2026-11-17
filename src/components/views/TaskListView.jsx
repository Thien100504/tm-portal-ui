import { useMemo } from 'react';
import PriorityBadge from '@/components/ui/PriorityBadge';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';


const STATUS_MAP = {
  todo: { label: 'kanban.columns.todo', color: 'bg-muted-foreground/30 text-foreground' },
  in_progress: { label: 'kanban.columns.in_progress', color: 'bg-[color:var(--color-ai)]/15 text-[color:var(--color-ai)]' },
  review: { label: 'kanban.columns.review', color: 'bg-amber-500/15 text-amber-500' },
  done: { label: 'kanban.columns.done', color: 'bg-emerald-500/15 text-emerald-500' },
};

export default function TaskListView({ tasks, membersMap, onTaskClick }) {
  const { t } = useTranslation();

  const sortedTasks = useMemo(() => {
    // Basic sort: priority (high -> low), then deadline
    const priorityWeight = { high: 3, medium: 2, low: 1 };
    return [...tasks].sort((a, b) => {
      if (priorityWeight[a.priority] !== priorityWeight[b.priority]) {
        return (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0);
      }
      if (a.deadline && b.deadline) {
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      }
      return 0;
    });
  }, [tasks]);

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-muted-foreground">
        <CheckCircle2 className="w-12 h-12 opacity-20 mb-3" />
        <p className="text-sm font-medium">{t('kanban.noTask')}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm h-[calc(100vh-var(--layout-offset)-100px)]">
      <table className="w-full text-sm text-left">
        <thead className="text-[10px] font-semibold uppercase bg-muted/40 text-muted-foreground border-b border-border sticky top-0 z-10 backdrop-blur-md">
          <tr>
            <th className="px-5 py-3 font-semibold">{t('kanban.search')}</th>
            <th className="px-5 py-3 font-semibold w-32">{t('kanban.status')}</th>
            <th className="px-5 py-3 font-semibold w-24">{t('kanban.priority')}</th>
            <th className="px-5 py-3 font-semibold w-40">{t('kanban.assignee')}</th>
            <th className="px-5 py-3 font-semibold w-32">{t('kanban.deadline')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {sortedTasks.map((task) => {
            const assignee = membersMap[task.assignee_id];
            const isOverdue = task.deadline && new Date(task.deadline) < new Date() && task.status !== 'done';
            const statusConfig = STATUS_MAP[task.status] || STATUS_MAP.todo;
            return (
              <tr 
                key={task.id} 
                className="hover:bg-muted/40 transition-colors cursor-pointer group"
                onClick={() => onTaskClick(task)}
              >
                <td className="px-5 py-3">
                  <div className="font-medium text-foreground truncate max-w-[300px] group-hover:text-[color:var(--color-ai)] transition-colors">
                    {task.title}
                  </div>
                </td>
                <td className="px-5 py-3">
                  <Badge variant="secondary" className={`font-medium ${statusConfig.color} px-2 py-0.5 rounded-md whitespace-nowrap`}>
                    {t(statusConfig.label)}
                  </Badge>
                </td>
                <td className="px-5 py-3">
                  <PriorityBadge priority={task.priority} />
                </td>
                <td className="px-5 py-3">
                  {assignee ? (
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center overflow-hidden flex-shrink-0 ring-1 ring-border">
                        {assignee.avatar_url ? (
                          <img src={assignee.avatar_url} alt={assignee.full_name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[10px] font-medium text-foreground">
                            {assignee.full_name?.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground truncate max-w-[100px]">
                        {assignee.full_name}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground opacity-50">-</span>
                  )}
                </td>
                <td className="px-5 py-3">
                  {task.deadline ? (
                    <div className={`flex items-center gap-1.5 text-xs ${isOverdue ? 'text-[color:var(--color-destructive)] font-medium' : 'text-muted-foreground'}`}>
                      {isOverdue ? <AlertCircle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                      <span>{format(new Date(task.deadline), 'MMM dd, yyyy', { locale: vi })}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground opacity-50">-</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
