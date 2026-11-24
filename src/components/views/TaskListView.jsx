import { useMemo, useState } from 'react';
import PriorityBadge from '@/components/ui/PriorityBadge';
import { useTranslation } from 'react-i18next';
import { format, isToday, isThisWeek, isPast, startOfDay, addWeeks } from 'date-fns';
import { vi, enUS } from 'date-fns/locale';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CalendarDays,
  CalendarClock,
  Calendar,
  Inbox,
  User as UserIcon,
  CornerDownRight,
} from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';

// ─── Group metadata ───────────────────────────────────────────────────────────
const GROUPS = [
  {
    key: 'overdue',
    icon: AlertTriangle,
    labelKey: 'kanban.list.overdue',
    accent: 'var(--color-destructive)',
    pill: 'bg-red-500/15 text-red-500',
    headerClass: 'text-red-500',
    stripClass: 'border-l-2 border-red-500/50',
  },
  {
    key: 'today',
    icon: CalendarClock,
    labelKey: 'kanban.list.today',
    accent: 'var(--color-ai)',
    pill: 'bg-violet-500/15 text-violet-400',
    headerClass: 'text-violet-400',
    stripClass: 'border-l-2 border-violet-400/50',
  },
  {
    key: 'this_week',
    icon: CalendarDays,
    labelKey: 'kanban.list.this_week',
    accent: '#f59e0b',
    pill: 'bg-amber-500/15 text-amber-400',
    headerClass: 'text-amber-400',
    stripClass: 'border-l-2 border-amber-400/50',
  },
  {
    key: 'next_week',
    icon: Calendar,
    labelKey: 'kanban.list.next_week',
    accent: '#64748b',
    pill: 'bg-muted/30 text-muted-foreground',
    headerClass: 'text-muted-foreground',
    stripClass: '',
  },
  {
    key: 'later',
    icon: Calendar,
    labelKey: 'kanban.list.later',
    accent: '#64748b',
    pill: 'bg-muted/30 text-muted-foreground',
    headerClass: 'text-muted-foreground',
    stripClass: '',
  },
  {
    key: 'no_deadline',
    icon: Inbox,
    labelKey: 'kanban.list.no_deadline',
    accent: '#475569',
    pill: 'bg-muted/20 text-muted-foreground/60',
    headerClass: 'text-muted-foreground/60',
    stripClass: '',
  },
];

function getGroup(task) {
  if (!task.deadline || task.status === 'done') return 'no_deadline';
  const d = startOfDay(new Date(task.deadline));
  const today = startOfDay(new Date());
  if (isPast(d) && !isToday(new Date(task.deadline))) return 'overdue';
  if (isToday(new Date(task.deadline))) return 'today';
  if (isThisWeek(d, { weekStartsOn: 1 })) return 'this_week';
  const nextWeekStart = addWeeks(startOfDay(today), 1);
  const nextWeekEnd = addWeeks(nextWeekStart, 1);
  if (d >= nextWeekStart && d < nextWeekEnd) return 'next_week';
  return 'later';
}

// ─── Assignee avatar ──────────────────────────────────────────────────────────
function Avatar({ name }) {
  if (!name) {
    return (
      <div className="w-6 h-6 rounded-full bg-muted border border-dashed border-border flex items-center justify-center">
        <UserIcon className="w-3 h-3 text-muted-foreground/30" />
      </div>
    );
  }
  return (
    <div
      className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-violet-500 text-[9px] font-bold text-white flex items-center justify-center shadow-sm ring-1 ring-white/10"
      title={name}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

// ─── Single task row ──────────────────────────────────────────────────────────
function TaskRow({
  task,
  subtaskCount = 0,
  isSubtask = false,
  hasChildren = false,
  isCollapsed = false,
  onToggle,
  onTaskClick,
  membersMap,
  locale,
}) {
  const isOverdue = task.deadline && new Date(task.deadline) < new Date() && task.status !== 'done';
  const assignee = membersMap?.[task.assignee_id];
  const assigneeName = assignee?.full_name || assignee?.email;
  const isDone = task.status === 'done';

  return (
    <div
      onClick={() => onTaskClick(task)}
      className={[
        'group flex items-center cursor-pointer select-none transition-all duration-150',
        // vertical padding
        isSubtask ? 'py-1.5 pl-10 pr-3' : 'py-2.5 px-3',
        // hover
        'hover:bg-primary/5',
        // done state
        isDone ? 'opacity-55' : '',
        // subtask indent line
        isSubtask ? 'border-t border-border/30' : '',
      ].join(' ')}
    >
      {/* ── Col 1: toggle / indent indicator ─────────────────── 20px */}
      <div className="shrink-0 w-5 flex items-center justify-center mr-2">
        {!isSubtask && hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle?.();
            }}
            className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/60 transition-all"
          >
            {isCollapsed ? (
              <ChevronRight className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        ) : isSubtask ? (
          <CornerDownRight className="w-3.5 h-3.5 text-muted-foreground/25" />
        ) : (
          <div className="w-5 h-5" />
        )}
      </div>

      {/* ── Col 2: title (flex-1) ────────────────────────────── */}
      <div className="flex-1 min-w-0 flex items-center gap-2 mr-3">
        <span
          className={[
            'truncate leading-snug',
            isSubtask
              ? 'text-[12px] font-normal text-muted-foreground'
              : 'text-[13px] font-semibold text-foreground',
            isDone ? 'line-through' : '',
          ].join(' ')}
        >
          {task.title}
        </span>
        {hasChildren && (
          <span className="shrink-0 text-[10px] font-mono text-muted-foreground/40 bg-muted/40 px-1.5 rounded">
            {/* subtask count shown at ParentCard level */}
          </span>
        )}
      </div>

      {/* ── Col 3: Priority ──────────────────────────── 88px */}
      <div className="shrink-0 w-[88px] hidden sm:flex items-center">
        <PriorityBadge priority={task.priority} />
      </div>

      {/* ── Col 4: Deadline ──────────────────────────── 80px */}
      <div
        className={[
          'shrink-0 w-20 hidden md:flex items-center justify-end gap-1',
          !task.deadline
            ? 'invisible'
            : isOverdue
              ? 'text-red-500 font-semibold'
              : 'text-muted-foreground/60',
          'text-[11px] font-mono',
        ].join(' ')}
      >
        {isOverdue ? (
          <AlertCircle className="w-3 h-3 shrink-0" />
        ) : (
          <Clock className="w-3 h-3 shrink-0" />
        )}
        {task.deadline ? format(new Date(task.deadline), 'dd/MM', { locale }) : '—'}
      </div>

      {/* ── Col 5: Assignee ──────────────────────────── 40px */}
      <div className="shrink-0 w-10 hidden sm:flex items-center justify-center">
        <Avatar name={assigneeName} />
      </div>

      {/* ── Col 6: Status ────────────────────────────── 108px */}
      <div className="shrink-0 w-[108px] flex items-center justify-center">
        <StatusBadge
          type="task"
          status={task.status}
          className="w-full justify-center text-[10px] border-none py-0.5"
        />
      </div>
    </div>
  );
}

// ─── Parent card wrapping parent + its subtasks ───────────────────────────────
function ParentCard({ task, subtasks, membersMap, onTaskClick, locale, stripClass }) {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);
  const hasChildren = subtasks.length > 0;

  return (
    <div
      className={[
        'rounded-lg border border-border/50 overflow-hidden bg-card/60 hover:bg-card',
        'hover:border-border/80 hover:shadow-sm transition-all duration-150',
        stripClass,
      ].join(' ')}
    >
      <TaskRow
        task={task}
        hasChildren={hasChildren}
        isCollapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
        onTaskClick={onTaskClick}
        membersMap={membersMap}
        locale={locale}
      />

      {/* Subtask collapsed indicator */}
      {hasChildren && collapsed && (
        <div className="px-10 py-1 border-t border-border/30 bg-muted/20 flex items-center gap-1.5">
          <ChevronRight className="w-3 h-3 text-muted-foreground/40" />
          <span className="text-[10px] text-muted-foreground/50 font-mono">
            {t('taskList.hidden_subtasks', {
              count: subtasks.length,
              defaultValue: '{{count}} hidden subtask(s)',
            })}
          </span>
        </div>
      )}

      {/* Subtask rows */}
      {hasChildren &&
        !collapsed &&
        subtasks.map((sub) => (
          <TaskRow
            key={sub.id}
            task={sub}
            isSubtask={true}
            onTaskClick={onTaskClick}
            membersMap={membersMap}
            locale={locale}
            parentPriority={task.priority}
          />
        ))}
    </div>
  );
}

// ─── Sticky column header ─────────────────────────────────────────────────────
function TableHeader({ t }) {
  return (
    <div className="sticky top-0 z-10 flex items-center px-3 py-2 mb-1 bg-background/80 backdrop-blur-sm border-b border-border/40">
      {/* spacer for toggle col */}
      <div className="shrink-0 w-5 mr-2" />

      {/* title */}
      <span className="flex-1 text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-widest mr-3">
        {t('sprintBoard.headers.task', { defaultValue: 'Task' })}
      </span>

      {/* priority */}
      <span className="shrink-0 w-[88px] text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-widest hidden sm:block">
        {t('kanban.priority', { defaultValue: 'Priority' })}
      </span>

      {/* deadline */}
      <span className="shrink-0 w-20 text-right text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-widest hidden md:block">
        {t('sprintBoard.headers.deadline', { defaultValue: 'Due' })}
      </span>

      {/* assignee */}
      <span className="shrink-0 w-10 text-center text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-widest hidden sm:block">
        {t('sprintBoard.headers.who', { defaultValue: 'Who' })}
      </span>

      {/* status */}
      <span className="shrink-0 w-[108px] text-center text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-widest">
        {t('sprintBoard.headers.status', { defaultValue: 'Status' })}
      </span>
    </div>
  );
}

// ─── Group section ────────────────────────────────────────────────────────────
function GroupSection({ groupDef, tasks, subtasksByParent, membersMap, onTaskClick, locale, t }) {
  const [collapsed, setCollapsed] = useState(false);
  const { key, icon: Icon, labelKey, pill, headerClass, stripClass } = groupDef;
  if (tasks.length === 0) return null;

  return (
    <div className="mb-4">
      {/* Group header */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className={[
          'w-full flex items-center gap-2 px-2 py-1.5 rounded-lg mb-2',
          'hover:bg-muted/30 transition-colors group',
        ].join(' ')}
      >
        <span className={`transition-transform duration-150 ${collapsed ? '' : 'rotate-0'}`}>
          {collapsed ? (
            <ChevronRight className={`w-3.5 h-3.5 ${headerClass}`} />
          ) : (
            <ChevronDown className={`w-3.5 h-3.5 ${headerClass}`} />
          )}
        </span>
        <Icon className={`w-3.5 h-3.5 ${headerClass}`} />
        <span className={`text-[11px] font-bold uppercase tracking-wider ${headerClass}`}>
          {t(labelKey, { defaultValue: key })}
        </span>
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${pill}`}>
          {tasks.length}
        </span>
      </button>

      {/* Task cards */}
      {!collapsed && (
        <div className="space-y-1.5">
          {tasks.map((task) => (
            <ParentCard
              key={task.id}
              task={task}
              subtasks={subtasksByParent[task.id] || []}
              membersMap={membersMap}
              onTaskClick={onTaskClick}
              locale={locale}
              stripClass={stripClass}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Root component ───────────────────────────────────────────────────────────
export default function TaskListView({ tasks, membersMap, onTaskClick }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'vi' ? vi : enUS;

  const { subtasksByParent, grouped } = useMemo(() => {
    const taskIndex = Object.fromEntries(tasks.map((t) => [t.id, t]));
    const byParent = {};
    const parents = [];
    const orphans = [];

    for (const task of tasks) {
      if (!task.parent_task_id) {
        parents.push(task);
      } else if (taskIndex[task.parent_task_id]) {
        byParent[task.parent_task_id] = byParent[task.parent_task_id] || [];
        byParent[task.parent_task_id].push(task);
      } else {
        orphans.push(task);
      }
    }

    const priorityWeight = { high: 3, medium: 2, low: 1 };
    const sorted = [...parents, ...orphans].sort((a, b) => {
      const pw = (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0);
      if (pw !== 0) return pw;
      if (a.deadline && b.deadline) return new Date(a.deadline) - new Date(b.deadline);
      return 0;
    });

    const g = Object.fromEntries(GROUPS.map((gr) => [gr.key, []]));
    for (const task of sorted) g[getGroup(task)].push(task);

    return { subtasksByParent: byParent, grouped: g };
  }, [tasks]);

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-muted-foreground gap-3">
        <CheckCircle2 className="w-14 h-14 opacity-10" />
        <p className="text-sm font-medium">{t('kanban.noTask')}</p>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-var(--layout-offset)-100px)] overflow-y-auto pb-8">
      <TableHeader t={t} />

      <div className="mt-2 space-y-0 px-0">
        {GROUPS.map((groupDef) => (
          <GroupSection
            key={groupDef.key}
            groupDef={groupDef}
            tasks={grouped[groupDef.key]}
            subtasksByParent={subtasksByParent}
            membersMap={membersMap}
            onTaskClick={onTaskClick}
            locale={locale}
            t={t}
          />
        ))}
      </div>
    </div>
  );
}
