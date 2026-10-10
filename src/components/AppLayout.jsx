import React from 'react';
import { useLocation, Link, useNavigate, useOutlet } from 'react-router-dom';
import { flushSync } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sun, Moon, Monitor, Wifi, Menu, Bell, Info, CheckCircle, AlertTriangle, XCircle, UserCheck, Workflow, X, ChevronRight, Flame } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useTheme } from "@/contexts/useTheme";
import { useAuth } from '@/hooks/useAuth';
import projectService from '@/services/projectService';
import notificationService from '@/services/notificationService';
import { useState, useRef, useEffect } from 'react';
import { DropdownMenu } from '@/components/ui/DropdownMenu';
import { Tooltip } from '@/components/ui/Tooltip';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import Sidebar from './Sidebar';
import MouseGlowBackground from './MouseGlowBackground';
import { ReactLenis } from '@studio-freight/react-lenis';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useActiveWorkspace } from '@/hooks/useActiveWorkspace';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { vi as viLocale, enUS as enLocale } from 'date-fns/locale';
import GlobalPomodoroManager from '@/components/pomodoro/GlobalPomodoroManager';
import usePomodoroStore from '@/store/usePomodoroStore';

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatRelativeTime(dateStr, lang) {
  const date = new Date(dateStr);
  const locale = lang === 'vi' ? viLocale : enLocale;
  return formatDistanceToNow(date, { addSuffix: true, locale });
}

function getNotifMeta(type) {
  switch (type) {
    case 'success':
      return { Icon: CheckCircle, colorClass: 'bg-emerald-500/10 text-emerald-500' };
    case 'warning':
      return { Icon: AlertTriangle, colorClass: 'bg-amber-500/10 text-amber-500' };
    case 'error':
      return { Icon: XCircle, colorClass: 'bg-rose-500/10 text-rose-500' };
    case 'assignment':
      return { Icon: UserCheck, colorClass: 'bg-violet-500/10 text-violet-500' };
    case 'automation':
      return { Icon: Workflow, colorClass: 'bg-[color:var(--color-ai)]/10 text-[color:var(--color-ai)]' };
    default:
      return { Icon: Info, colorClass: 'bg-sky-500/10 text-sky-500' };
  }
}

// ─── Notification Bell Dropdown ──────────────────────────────────────────────

function NotificationBell() {
  const { t, i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: count = 0 } = useQuery({
    queryKey: ['notifications-count'],
    queryFn: () => notificationService.getUnreadCount(),
    refetchInterval: 60_000,
  });

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationService.getAll(8, 0),
    enabled: isOpen,
    select: (data) => (Array.isArray(data) ? data : data?.items ?? []),
  });

  // Close on click outside
  useEffect(() => {
    function handleOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [isOpen]);

  const handleMarkRead = async (id) => {
    try {
      await notificationService.markRead(id);
      queryClient.invalidateQueries({ queryKey: ['notifications-count'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    } catch { /* noop */ }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllRead();
      queryClient.invalidateQueries({ queryKey: ['notifications-count'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    } catch { /* noop */ }
  };

  const hasUnread = notifications.some((n) => !n.is_read);

  return (
    <div ref={dropdownRef}>
      <DropdownMenu
        mode="click"
        onOpenChange={setIsOpen}
        trigger={
          <Button
            variant="outline"
            size="icon"
            className="relative w-8 h-8 rounded-md text-muted-foreground hover:text-foreground"
            aria-label="Notifications"
          >
            <Bell className="w-3.5 h-3.5" />
            {count > 0 && (
              <span className="absolute -top-1.5 -right-1.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white ring-2 ring-background">
                {count > 99 ? '99+' : count}
              </span>
            )}
          </Button>
        }
        content={
          <div className="w-[360px]">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-foreground" />
              <span className="text-sm font-semibold text-foreground">{t('sidebar.notifications')}</span>
              {count > 0 && (
                <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500/15 px-1 text-[9px] font-bold text-rose-500">
                  {count}
                </span>
              )}
            </div>
            <Link
              to="/notifications"
              onClick={() => setIsOpen(false)}
              className="text-[11px] text-[color:var(--color-ai)] hover:underline font-medium"
            >
              See all →
            </Link>
          </div>

          {/* Notification list */}
          <div className="max-h-[400px] overflow-y-auto scrollbar-thin">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2.5 py-10 text-center">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  <Bell className="w-5 h-5 text-muted-foreground/40" />
                </div>
                <p className="text-[12px] text-muted-foreground">{t('common.all_caught_up')}</p>
              </div>
            ) : (
              notifications.map((notif) => {
                const { Icon, colorClass } = getNotifMeta(notif.type);

                let title = notif.title_key
                  ? t(notif.title_key, notif.title_params || {})
                  : notif.title;
                let desc = notif.message_key
                  ? t(notif.message_key, notif.message_params || {})
                  : notif.message;

                return (
                  <button
                    key={notif.id}
                    onClick={() => !notif.is_read && handleMarkRead(notif.id)}
                    className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 border-b border-border/40 last:border-0 ${
                      !notif.is_read ? 'bg-[color:var(--color-ai)]/[0.04]' : ''
                    }`}
                  >
                    {/* Type icon */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${colorClass}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-[12px] font-medium leading-tight ${notif.is_read ? 'text-muted-foreground' : 'text-foreground'}`}>
                        {title}
                      </p>
                      {desc && (
                        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 leading-snug">
                          {desc}
                        </p>
                      )}
                      <p className="text-[10px] text-muted-foreground/50 mt-1">
                        {formatRelativeTime(notif.created_at, i18n.language)}
                      </p>
                    </div>

                    {/* Unread indicator */}
                    {!notif.is_read && (
                      <div className="w-2 h-2 rounded-full bg-[color:var(--color-ai)] shrink-0 mt-2" />
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Footer: mark all */}
          {hasUnread && (
            <div className="border-t border-border px-4 py-2.5 flex items-center justify-between">
              <button
                onClick={handleMarkAllRead}
                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                {t('common.mark_all_read')}
              </button>
              <X
                className="w-3.5 h-3.5 text-muted-foreground/40 cursor-pointer hover:text-foreground transition-colors"
                onClick={() => setIsOpen(false)}
              />
            </div>
          )}
        </div>
      }
      />
    </div>
  );
}

// ─── Pomodoro Quick Toggle ───────────────────────────────────────────────────

function PomodoroQuickToggle() {
  const { isRunning, isPipMode, setIsPipMode, timeLeft, duration, mode, currentTask } = usePomodoroStore();
  const { t } = useTranslation();

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isActive = isRunning || timeLeft < duration;

  const tooltipContent = isActive ? (
    <div className="flex flex-col items-center justify-center p-0.5 min-w-[120px]">
      <span className="font-bold text-[12px] mb-0.5">
        {mode === 'focus' ? '🎯 ' + t('pomodoro.focus') : '☕ ' + t('pomodoro.break')}
      </span>
      {currentTask && (
        <span className="text-[10px] text-muted-foreground truncate w-full text-center max-w-[140px] mb-1.5">
          {currentTask.title}
        </span>
      )}
      <span className="text-[9px] text-muted-foreground/80 uppercase tracking-widest border-t border-border/50 w-full text-center pt-1 mt-0.5">
        {isPipMode ? "Hide PiP" : "Show PiP"}
      </span>
    </div>
  ) : "Start Pomodoro";

  return (
    <Tooltip content={tooltipContent} position="bottom">
      <motion.button
        layout
        onClick={() => setIsPipMode(!isPipMode)}
        className={`h-8 flex items-center justify-center rounded-lg shadow-sm overflow-hidden transition-colors ${
          isActive 
            ? 'px-2.5 text-[color:var(--color-ai)] bg-[color:var(--color-ai)]/10 hover:bg-[color:var(--color-ai)]/20' 
            : 'w-8 px-0 text-muted-foreground hover:text-foreground hover:bg-muted/50'
        }`}
        style={{ touchAction: 'none' }}
        transition={{ type: "spring", stiffness: 350, damping: 25 }}
      >
        <motion.div layout="position" className="flex items-center gap-1.5">
          <Flame className={`w-4 h-4 shrink-0 ${isRunning ? 'animate-pulse text-amber-500' : ''}`} />
          <AnimatePresence>
            {isActive && (
              <motion.span
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: "auto", opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                className="font-mono text-[11px] font-bold leading-none tracking-tight whitespace-nowrap overflow-hidden block"
              >
                {formatTime(timeLeft)}
              </motion.span>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.button>
    </Tooltip>
  );
}

// ─── TopBar ──────────────────────────────────────────────────────────────────

function TopBar({ onMenuClick }) {
  const { theme, setMode, themeStyle, motion: motionEnabled } = useTheme();
  const location = useLocation();
  useAuth();
  const { t, i18n } = useTranslation();
  const { activeWorkspace } = useActiveWorkspace();

  const pathname = location.pathname;
  const projectId = pathname.match(/\/projects\/([a-f0-9-]+)/i)?.[1];

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectService.getProject(projectId),
    enabled: !!projectId,
  });

  const { data: members = [] } = useQuery({
    queryKey: ['members', projectId],
    queryFn: () => projectService.getMembers(projectId),
    enabled: !!projectId,
  });

  const crumbs = [];
  if (projectId) {
    const pName = project?.name || t('projectOverview.loading');
    crumbs.push({ label: t('sidebar.projects'), to: '/projects' });
    crumbs.push({ label: pName, to: `/projects/${projectId}` });
    
    if (pathname.includes('/kanban')) {
      crumbs.push({ label: t('sidebar.kanban') });
    } else if (pathname.includes('/sprints')) {
      crumbs.push({ label: t('sidebar.sprints') });
    } else if (pathname.includes('/timeline')) {
      crumbs.push({ label: t('sidebar.timeline') });
    } else if (pathname.includes('/automation')) {
      crumbs.push({ label: t('sidebar.automation') });
    }
  } else if (pathname !== '/' && pathname !== '/dashboard') {
    let cleanName = pathname.replace('/', '').replace('-', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    if (pathname.includes('/admin')) cleanName = 'Admin';
    if (pathname.includes('/settings')) cleanName = 'Settings';
    crumbs.push({ label: cleanName });
  } else {
    crumbs.push({ label: t('sidebar.dashboard') });
  }

  const isGlass = themeStyle === 'glass';

  return (
    <header data-app-topbar className={`sticky top-0 z-30 flex h-12 items-center justify-between gap-4 border-b px-4 md:px-6 transition-colors ${
      isGlass 
        ? 'bg-background/85 border-border backdrop-blur-md' 
        : 'bg-background border-border'
    }`}>
      <div className="flex min-w-0 items-center text-[12px]">
        <Button
          variant="ghost"
          size="icon"
          onClick={onMenuClick}
          className="md:hidden w-8 h-8 mr-2 -ml-1.5"
        >
          <Menu className="w-4 h-4" />
        </Button>
        
        <div className="hidden sm:flex items-center text-muted-foreground font-medium shrink-0">
          <Link to="/" className="hover:text-foreground transition-colors">
            TaskFlow
          </Link>
        </div>
        
        {crumbs.map((crumb, idx) => {
          const isLast = idx === crumbs.length - 1;
          return (
            <div key={idx} className="flex items-center min-w-0 shrink">
              <ChevronRight className="w-3.5 h-3.5 mx-1.5 text-muted-foreground/40 shrink-0" />
              {crumb.to && !isLast ? (
                <Link 
                  to={crumb.to} 
                  className="text-muted-foreground hover:text-foreground transition-colors truncate max-w-[120px] sm:max-w-[180px] lg:max-w-[240px] block font-medium"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className={`truncate max-w-[140px] sm:max-w-[200px] lg:max-w-[280px] block ${isLast ? 'font-bold text-foreground tracking-tight' : 'font-medium text-muted-foreground'}`}>
                  {crumb.label}
                </span>
              )}
            </div>
          );
        })}
        {activeWorkspace && (
          <Badge 
            variant="glass" 
            className={`ml-3 px-1.5 py-0.5 text-[9px] font-semibold border shrink-0 ${
              activeWorkspace.type === 'personal'
                ? 'bg-[color:var(--color-ai)]/10 border-[color:var(--color-ai)]/20 text-[color:var(--color-ai)]'
                : 'bg-[color:var(--color-primary)]/10 border-[color:var(--color-primary)]/20 text-[color:var(--color-primary)]'
            }`}
          >
            {t('workspace.type.' + activeWorkspace.type)}
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Live indicator */}
        <div className="hidden items-center gap-1.5 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[10px] font-medium text-emerald-500 md:flex">
          <Wifi className="w-3 h-3" />
          <span className="font-mono uppercase tracking-wider">Live</span>
          <span className="w-1.5 h-1.5 animate-pulse-soft rounded-full bg-emerald-500" />
        </div>

        {/* Project Members AvatarStack */}
        {projectId && members.length > 0 && (
          <div className="hidden md:flex -space-x-1.5 ml-2 mr-2">
            {members.slice(0, 4).map((m) => (
              <DropdownMenu
                key={m.user_id}
                mode="hover"
                align="center"
                trigger={
                  <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-primary to-ai text-[10px] font-bold text-white flex items-center justify-center ring-2 ring-background hover:ring-muted transition-colors shadow-sm cursor-pointer">
                    {m.user?.full_name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                }
                content={
                  <div className="w-max max-w-[200px] p-2.5">
                    <p className="text-[12px] font-bold text-foreground truncate">{m.user?.full_name || t('common.user')}</p>
                    <p className="text-[10px] text-muted-foreground truncate mb-1">{m.user?.email}</p>
                    <Badge variant={isGlass ? "glass" : "outline"} className="text-[9px] px-1 py-0.5 mt-1 border-none bg-muted text-muted-foreground uppercase">
                      {m.role?.name || t('role.custom_role')}
                    </Badge>
                  </div>
                }
              />
            ))}
            {members.length > 4 && (
              <div className="w-7 h-7 rounded-full bg-muted text-[10px] font-bold text-muted-foreground flex items-center justify-center ring-2 ring-background shadow-sm">
                +{members.length - 4}
              </div>
            )}
          </div>
        )}

        {/* Utilities Toolbar */}
        <div className="flex items-center gap-2">
          {/* Pomodoro Quick Toggle */}
          <PomodoroQuickToggle />

          {/* Language toggle */}
          <Tooltip content="Change Language" position="bottom">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                const newLang = i18n.language === 'vi' ? 'en' : 'vi';
                if (document.startViewTransition && motionEnabled) {
                  document.documentElement.classList.add('is-transitioning');
                  const transition = document.startViewTransition(() => {
                    flushSync(() => i18n.changeLanguage(newLang));
                  });
                  transition.finished.finally(() => {
                    document.documentElement.classList.remove('is-transitioning');
                  });
                } else {
                  i18n.changeLanguage(newLang);
                }
              }}
              className="w-8 h-8 rounded-lg text-[11px] font-bold text-muted-foreground hover:text-foreground hover:bg-background shadow-sm uppercase transition-colors"
              aria-label="Change language"
            >
              {i18n.language === 'vi' ? 'VI' : 'EN'}
            </Button>
          </Tooltip>

          {/* Theme toggle */}
          <DropdownMenu
            mode="click"
            align="right"
            trigger={
              <Button
                variant="ghost"
                size="icon"
                className="w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-background shadow-sm transition-colors"
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? <Moon className="w-4 h-4" /> : theme === 'light' ? <Sun className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
              </Button>
            }
            content={
              <div className="w-32 p-1">
                <button
                  onClick={() => setMode('light')}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded-md transition-colors ${
                    theme === 'light' ? 'bg-[color:var(--color-ai)]/10 text-[color:var(--color-ai)] font-medium' : 'hover:bg-muted text-muted-foreground'
                  }`}
                >
                  <Sun className="w-3.5 h-3.5" /> {t('settings.themeMode.light')}
                </button>
                <button
                  onClick={() => setMode('dark')}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded-md transition-colors ${
                    theme === 'dark' ? 'bg-[color:var(--color-ai)]/10 text-[color:var(--color-ai)] font-medium' : 'hover:bg-muted text-muted-foreground'
                  }`}
                >
                  <Moon className="w-3.5 h-3.5" /> {t('settings.themeMode.dark')}
                </button>
                <button
                  onClick={() => setMode('system')}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded-md transition-colors ${
                    theme === 'system' ? 'bg-[color:var(--color-ai)]/10 text-[color:var(--color-ai)] font-medium' : 'hover:bg-muted text-muted-foreground'
                  }`}
                >
                  <Monitor className="w-3.5 h-3.5" /> {t('settings.themeMode.system')}
                </button>
              </div>
            }
          />

          <div className="w-px h-4 bg-border/60 mx-1 hidden sm:block" />

          {/* Notification Bell */}
          <NotificationBell />
        </div>

      </div>
    </header>
  );
}

// ─── Layout ──────────────────────────────────────────────────────────────────

export default function AppLayout() {
  const { t } = useTranslation();
  const { motion: motionEnabled } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const outlet = useOutlet();
  const projectId = location.pathname.match(/\/projects\/([a-f0-9-]+)/i)?.[1];

  // Mobile scroll lock & Global Lenis nested scroll fix
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }, [mobileMenuOpen]);

  // Fix nested scroll for Lenis
  useEffect(() => {
    const handleWheel = (e) => {
      const scrollable = e.target.closest('.overflow-y-auto, .overflow-auto, .overflow-x-auto, .scrollbar-thin');
      if (scrollable && scrollable.tagName.toLowerCase() !== 'main') {
        e.stopPropagation();
      }
    };
    
    // Must use capture phase to intercept before ReactLenis does
    document.addEventListener('wheel', handleWheel, { capture: true, passive: true });
    document.addEventListener('touchstart', handleWheel, { capture: true, passive: true });
    document.addEventListener('touchmove', handleWheel, { capture: true, passive: true });
    
    return () => {
      document.removeEventListener('wheel', handleWheel, { capture: true });
      document.removeEventListener('touchstart', handleWheel, { capture: true });
      document.removeEventListener('touchmove', handleWheel, { capture: true });
    };
  }, []);

  // Global WebSocket for notifications
  useWebSocket(null, (notif) => {
    let title = notif.title_key
      ? t(notif.title_key, notif.title_params || {})
      : notif.title;
    let desc = notif.message_key
      ? t(notif.message_key, notif.message_params || {})
      : notif.message;

    if (!title) {
      title = t('notification.system.alert.title');
    }

    const projectId = notif.data?.project_id;
    const taskId = notif.data?.task_id;

    toast(title, {
      description: desc,
      duration: 5000,
      action: (projectId && taskId) ? {
        label: t('common.view_now'),
        onClick: () => navigate(`/projects/${projectId}/kanban?taskId=${taskId}`)
      } : undefined
    });
  });

  return (
    <MouseGlowBackground fullScreen>
      <div data-app-shell className="flex h-screen w-full text-foreground overflow-hidden relative z-10">
        {/* Mobile Sidebar Overlay */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Mobile Sidebar Container */}
        <div className={`fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 md:relative md:transform-none ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
          <Sidebar onMobileClose={() => setMobileMenuOpen(false)} isMobile={mobileMenuOpen} projectId={projectId} />
        </div>

        <div className="flex min-w-0 flex-1 flex-col relative z-10">
          <TopBar onMenuClick={() => setMobileMenuOpen(true)} />
          <div id="app-main-area" className="relative flex-1 flex flex-col overflow-hidden">
            <ReactLenis
              as="main"
              options={{ smoothWheel: true, duration: 1.2 }}
              className="flex-1 overflow-x-hidden overflow-y-auto px-4 py-4 md:px-6 relative"
            >
              <div className="mx-auto w-full max-w-[1400px]">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={location.pathname}
                    initial={motionEnabled ? { opacity: 0, y: 15, filter: 'blur(8px)' } : { opacity: 0 }}
                    animate={motionEnabled ? { opacity: 1, y: 0, filter: 'blur(0px)', transitionEnd: { transform: 'none', filter: 'none' } } : { opacity: 1 }}
                    exit={motionEnabled ? { opacity: 0, y: -15, filter: 'blur(8px)' } : { opacity: 0 }}
                    transition={motionEnabled ? { duration: 0.2, ease: [0.22, 1, 0.36, 1] } : { duration: 0 }}
                    className="w-full"
                  >
                    {outlet && React.cloneElement(outlet, { key: location.pathname })}
                  </motion.div>
                </AnimatePresence>
              </div>
            </ReactLenis>
            <div id="modal-root" className="absolute inset-0 pointer-events-none z-[100]"></div>
          </div>
        </div>
      </div>
      <GlobalPomodoroManager />
    </MouseGlowBackground>
  );
}
