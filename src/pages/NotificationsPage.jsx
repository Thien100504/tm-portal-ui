import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Bell, BellOff, Info, CheckCircle, AlertTriangle, XCircle,
  UserCheck, Workflow, Check, CheckCheck, RefreshCw, Filter
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useTheme } from "@/contexts/useTheme";
import notificationService from '@/services/notificationService';

// ─── Helpers ─────────────────────────────────────────────────────────────────

import { formatDistanceToNow, format } from 'date-fns';
import { vi as viLocale, enUS as enLocale } from 'date-fns/locale';

function formatRelativeTime(dateStr, lang) {
  const date = new Date(dateStr);
  const locale = lang === 'vi' ? viLocale : enLocale;
  return formatDistanceToNow(date, { addSuffix: true, locale });
}

function formatDateGroup(dateStr, t, lang) {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return t('common.today');
  if (date.toDateString() === yesterday.toDateString()) return t('common.yesterday');
  
  const locale = lang === 'vi' ? viLocale : enLocale;
  return format(date, 'EEEE, d MMMM', { locale });
}

function getNotifMeta(type) {
  switch (type) {
    case 'success':
      return { Icon: CheckCircle, colorClass: 'bg-emerald-500/10 text-emerald-500', label: 'Success' };
    case 'warning':
      return { Icon: AlertTriangle, colorClass: 'bg-amber-500/10 text-amber-500', label: 'Warning' };
    case 'error':
      return { Icon: XCircle, colorClass: 'bg-rose-500/10 text-rose-500', label: 'Error' };
    case 'assignment':
      return { Icon: UserCheck, colorClass: 'bg-violet-500/10 text-violet-500', label: 'Assignment' };
    case 'automation':
      return { Icon: Workflow, colorClass: 'bg-[color:var(--color-ai)]/10 text-[color:var(--color-ai)]', label: 'Automation' };
    default:
      return { Icon: Info, colorClass: 'bg-sky-500/10 text-sky-500', label: 'Info' };
  }
}

// ─── Filter Tab ───────────────────────────────────────────────────────────────

const getFilters = (t) => [
  { key: 'all', label: t('notifications.all') },
  { key: 'unread', label: t('notifications.unread') },
  { key: 'task', label: t('notifications.filter_task', { defaultValue: 'Tasks' }) },
  { key: 'sprint', label: t('notifications.filter_sprint', { defaultValue: 'Sprints' }) },
  { key: 'project', label: t('notifications.filter_project', { defaultValue: 'Projects' }) },
];

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function NotifSkeleton() {
  return (
    <div className="flex items-start gap-4 px-5 py-4 border-b border-border/50 animate-pulse">
      <div className="w-10 h-10 rounded-full bg-muted shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 bg-muted rounded w-3/4" />
        <div className="h-3 bg-muted rounded w-1/2" />
        <div className="h-2.5 bg-muted rounded w-1/4" />
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const { themeStyle } = useTheme();
  const isGlass = themeStyle === 'glass';
  const [filter, setFilter] = useState('all');

  const { data: count = 0 } = useQuery({
    queryKey: ['notifications-count'],
    queryFn: () => notificationService.getUnreadCount(),
  });

  const { data: rawData = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['notifications', 'list', 50],
    queryFn: () => notificationService.getAll(50, 0),
    select: (data) => (Array.isArray(data) ? data : data?.items ?? []),
  });

  // Apply filter
  const notifications = rawData.filter((n) => {
    if (filter === 'all') return true;
    if (filter === 'unread') return !n.is_read;
    return n.entity_type === filter;
  });

  // Group by date
  const grouped = notifications.reduce((acc, notif) => {
    const key = formatDateGroup(notif.created_at, t, i18n.language);
    if (!acc[key]) acc[key] = [];
    acc[key].push(notif);
    return acc;
  }, {});

  const handleMarkRead = async (id) => {
    try {
      await notificationService.markRead(id);
      queryClient.invalidateQueries({ queryKey: ['notifications-count'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    } catch (err) {
      toast.error(t('common.error'), {
        description: t(err?.response?.data?.detail || 'server.notification_unavailable'),
      });
      // a notification that no longer exists disappears from the list
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllRead();
      queryClient.invalidateQueries({ queryKey: ['notifications-count'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    } catch (err) {
      toast.error(t('common.error'), {
        description: t(err?.response?.data?.detail || 'server.notification_unavailable'),
      });
      // a notification that no longer exists disappears from the list
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  };

  const hasUnread = rawData.some((n) => !n.is_read);

  return (
    <div className="w-full space-y-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-gradient-to-tr from-[color:var(--color-primary)] to-[color:var(--color-ai)] text-white shadow-md shrink-0">
            <Bell className="w-6 h-6" />
          </div>
          <div className="flex flex-col justify-center">
            <div className="flex items-center gap-2.5 mb-1.5">
              <h1 className="text-2xl font-bold text-foreground tracking-tight leading-none">{t('sidebar.notifications')}</h1>
              {count > 0 && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white leading-none">
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground leading-none">
              {count > 0 ? `${count} ${t('notifications.unread_notifs')}` : t('common.all_caught_up')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetch()}
            className="w-8 h-8"
            title={t('notifications.refresh', 'Refresh')}
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
          {hasUnread && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllRead}
              className="h-8 text-[11px]"
            >
              <CheckCheck className="w-3.5 h-3.5 mr-1.5" />
              {t('common.mark_all_read')}
            </Button>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 mb-4 flex-wrap">
        <Filter className="w-3.5 h-3.5 text-muted-foreground mr-1" />
        {getFilters(t).map((f) => {
          const isActive = filter === f.key;
          const filterCount = f.key === 'all' ? rawData.length
            : f.key === 'unread' ? count
            : rawData.filter(n => n.entity_type === f.key).length;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`inline-flex items-center gap-1 h-7 px-3 rounded-full text-[11px] font-medium transition-colors ${
                isActive
                  ? 'bg-foreground text-background'
                  : 'border border-border bg-card text-muted-foreground hover:text-foreground'
              }`}
            >
              {f.label}
              {filterCount > 0 && (
                <span className={`inline-flex h-3.5 min-w-[14px] items-center justify-center rounded-full px-0.5 text-[8px] font-bold ${
                  isActive ? 'bg-background/20 text-background' : 'bg-rose-500/15 text-rose-500'
                }`}>
                  {filterCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Notification List */}
      <div className={`rounded-xl border border-border overflow-hidden ${isGlass ? 'bg-card/80 backdrop-blur-md' : 'bg-card'}`}>
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => <NotifSkeleton key={i} />)
        ) : isError ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <p className="text-sm font-medium text-foreground">{t('server.notification_unavailable')}</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              {t('notifications.retry', 'Retry')}
            </Button>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
              <BellOff className="w-6 h-6 text-muted-foreground/40" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground mb-1">
                {filter === 'unread' ? t('notifications.no_unread') : t('notifications.no_notifs')}
              </p>
              <p className="text-[12px] text-muted-foreground">
                {filter === 'unread' ? t('common.all_caught_up') : t('notifications.will_let_you_know')}
              </p>
            </div>
          </div>
        ) : (
          Object.entries(grouped).map(([dateLabel, items]) => (
            <div key={dateLabel}>
              {/* Date group header */}
              <div className="sticky top-0 px-5 py-2 bg-muted/40 backdrop-blur-sm border-b border-border/50">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {dateLabel}
                </p>
              </div>

              {/* Items */}
              {items.map((notif) => {
                const { Icon, colorClass } = getNotifMeta(notif.type);

                const title = notif.title_key
                  ? t(notif.title_key, notif.title_params || {})
                  : notif.title;
                const desc = notif.message_key
                  ? t(notif.message_key, notif.message_params || {})
                  : notif.message;

                return (
                  <div
                    key={notif.id}
                    className={`group flex items-start gap-4 px-5 py-4 border-b border-border/40 last:border-0 transition-colors ${
                      !notif.is_read
                        ? 'bg-[color:var(--color-ai)]/[0.035] hover:bg-[color:var(--color-ai)]/[0.06]'
                        : 'hover:bg-muted/40'
                    }`}
                  >
                    {/* Icon */}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${colorClass}`}>
                      <Icon className="w-4 h-4" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-[13px] font-medium leading-tight ${notif.is_read ? 'text-muted-foreground' : 'text-foreground'}`}>
                          {title}
                        </p>
                        <span className="text-[10px] text-muted-foreground/60 shrink-0 mt-0.5">
                          {formatRelativeTime(notif.created_at, i18n.language)}
                        </span>
                      </div>
                      {desc && (
                        <p className="text-[12px] text-muted-foreground mt-1 leading-snug">
                          {desc}
                        </p>
                      )}
                      {/* Entity badge & Metadata */}
                      <div className="mt-2 flex flex-wrap gap-2 items-center">
                        {notif.entity_type && (
                          <span className="inline-flex items-center text-[9px] font-mono uppercase tracking-wider bg-muted text-muted-foreground px-1.5 py-0.5 rounded-sm">
                            {notif.entity_type}
                          </span>
                        )}
                        {notif.event_data?.project_name && (
                          <span className="text-[11px] font-medium text-foreground/70 flex items-center gap-1">
                            • {notif.event_data.project_name}
                          </span>
                        )}
                        {notif.event_data?.actor_name && (
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                            • 👤 {notif.event_data.actor_name}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Mark read button */}
                    <div className="shrink-0 flex items-center gap-1">
                      {!notif.is_read ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleMarkRead(notif.id)}
                          className="opacity-0 group-hover:opacity-100 h-6 px-2 text-[10px]"
                          title={t('notifications.mark_read')}
                        >
                          <Check className="w-3 h-3 mr-1" />
                          {t('notifications.mark_read')}
                        </Button>
                      ) : (
                        <div className="w-2 h-2 rounded-full bg-muted" title={t('notifications.read', 'Read')} />
                      )}
                      {!notif.is_read && (
                        <div className="w-2 h-2 rounded-full bg-[color:var(--color-ai)]" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>

      {/* Footer info */}
      {!isLoading && rawData.length > 0 && (
        <p className="text-center text-[11px] text-muted-foreground/50 py-4">
          {t('notifications.showing_last_notifs', { count: rawData.length })}
        </p>
      )}
    </div>
  );
}
