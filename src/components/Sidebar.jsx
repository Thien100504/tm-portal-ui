import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderKanban,
  Columns3,
  Goal,
  Sparkles,
  Workflow,
  BarChart3,
  Bell,
  Settings,
  Shield,
  Key,
  LogOut,
  ChevronLeft,
  ChevronRight,
  GanttChart,
  Route,
  X,
  Plus,
  Loader2,
  Kanban,
  ExternalLink,
} from 'lucide-react';
import projectService from '@/services/projectService';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import workspaceService from '@/services/workspaceService';
import rbacService from '@/services/rbacService';
import { Card } from '@/components/ui/Card';
import notificationService from '@/services/notificationService';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { useTheme } from '@/contexts/useTheme';
import { Tooltip } from '@/components/ui/Tooltip';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import SidebarSearch from './SidebarSearch';

function NavGroup({ label, items, active, search, isCollapsed, projectsPopup }) {
  const { motionLevel = 70, themeStyle = 'standard' } = useTheme();
  const _isGlass = themeStyle === 'glass';
  const durPanel = 0.22 + (motionLevel / 100) * 0.13;
  const springOvershoot = 1 + (motionLevel / 100) * 0.8;
  const easeSpring = [0.34, springOvershoot, 0.64, 1];

  return (
    <div className="mb-3">
      {/* Group Label */}
      <div
        className="grid transition-all ease-[cubic-bezier(0.34,1.56,0.64,1)]"
        style={{
          transitionDuration: `${durPanel * 1000}ms`,
          gridTemplateRows: isCollapsed ? '0fr' : '1fr',
          opacity: isCollapsed ? 0 : 1,
        }}
      >
        <div className="overflow-hidden">
          <p className="px-2 pb-1.5 pt-1 font-mono text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/80 whitespace-nowrap">
            {label}
          </p>
        </div>
      </div>
      <ul className="">
        <AnimatePresence initial={false}>
          {items.map((it) => {
            const isProjectsItem = it.to === '/projects' && !it.isChild;
            let isActive = false;
            const [toPath, toSearch] = it.to.split('?');

            if (it.exact) {
              isActive = active === toPath;
            } else {
              isActive = active === toPath || active.startsWith(toPath + '/');
            }

            if (isActive && toSearch && search) {
              const currentParams = new URLSearchParams(search);
              const targetParams = new URLSearchParams(toSearch);
              let allMatch = true;
              for (const [key, value] of targetParams.entries()) {
                if (currentParams.get(key) !== value) {
                  allMatch = false;
                  break;
                }
              }
              isActive = allMatch;
            }

            const Icon = it.icon;
            const isChild = !!it.isChild;

            const content = (
              <motion.li
                key={it.to}
                initial={{ height: 0, opacity: 0, overflow: 'hidden' }}
                animate={{ height: 'auto', opacity: 1, transitionEnd: { overflow: 'visible' } }}
                exit={{
                  height: 0,
                  opacity: 0,
                  overflow: 'hidden',
                  transition: { duration: 0.2, ease: 'easeOut' },
                }}
                transition={{ duration: durPanel, ease: easeSpring }}
              >
                <div className="pb-1.5 w-full">
                  <Tooltip
                    content={it.label}
                    position="right"
                    disabled={!isCollapsed}
                    className="w-full"
                  >
                    <Link
                      to={it.to}
                      data-active={isActive ? 'true' : undefined}
                      data-is-child={isChild ? 'true' : undefined}
                      className={`group relative flex items-center transition-all duration-[var(--dur-panel)] ease-[var(--ease-spring)] ${
                        isActive
                          ? isChild && !isCollapsed
                            ? 'text-[color:var(--color-ai)] font-semibold bg-gradient-to-l from-[color:var(--color-ai)]/15 to-transparent border-r-[3px] border-[color:var(--color-ai)] rounded-l-xl'
                            : 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm rounded-xl'
                          : `text-muted-foreground hover:text-foreground ${isChild && !isCollapsed ? 'hover:text-[color:var(--color-ai)]/80' : 'hover:bg-muted/60 rounded-xl'}`
                      } ${isCollapsed ? 'mx-1.5 rounded-xl' : 'mx-2'}`}
                    >
                      {/* Child connector line (elegant tree curve) */}
                      {isChild && (
                        <div
                          className={`transition-opacity duration-[var(--dur-panel)] pointer-events-none ${isCollapsed ? 'opacity-0' : 'opacity-100'}`}
                        >
                          {/* Vertical line extending down if NOT last child */}
                          {!it.isLastChild && (
                            <div className="absolute left-[20px] top-1/2 bottom-[-6px] w-px bg-border" />
                          )}

                          {/* The curve (top half vertical + horizontal branch) */}
                          <div className="absolute left-[20px] top-[-6px] bottom-1/2 w-[16px] border-l border-b border-border rounded-bl-[10px]" />
                        </div>
                      )}

                      {/* Fixed-width Icon Wrapper to prevent jumping */}
                      <div
                        className={`flex items-center justify-center shrink-0 transition-all duration-[var(--dur-panel)] ease-[var(--ease-spring)] ${isCollapsed ? 'w-[40px] h-[40px]' : isChild ? 'w-10 h-9 ml-6' : 'w-10 h-10'}`}
                      >
                        <Icon
                          className={`shrink-0 transition-colors duration-[var(--dur-panel)] ${isChild ? 'w-3.5 h-3.5' : 'w-4 h-4'} ${
                            isActive
                              ? 'text-[color:var(--color-ai)]'
                              : 'text-muted-foreground/60 group-hover:text-foreground'
                          }`}
                          style={
                            isActive
                              ? { filter: 'drop-shadow(0 0 8px var(--color-ai))' }
                              : undefined
                          }
                        />
                      </div>

                      {/* Text Container */}
                      <div
                        className={`flex items-center overflow-hidden transition-all duration-[var(--dur-panel)] ease-[var(--ease-spring)] whitespace-nowrap ${isCollapsed ? 'w-0 opacity-0' : 'w-[140px] opacity-100 pr-2'}`}
                      >
                        <span
                          className={`truncate flex-1 transition-colors duration-[var(--dur-panel)] ${isChild ? 'text-[12px] font-medium' : 'text-[13px] font-medium'}`}
                        >
                          {it.label}
                        </span>
                        {it.badge && (
                          <Badge variant="glass" className="ml-1.5 px-1 py-px text-[9px]">
                            {it.badge}
                          </Badge>
                        )}
                        {it.count !== undefined && (
                          <span className="ml-1.5 shrink-0 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500/15 px-1 text-[9px] font-semibold text-rose-500">
                            {it.count}
                          </span>
                        )}
                      </div>
                    </Link>
                  </Tooltip>
                </div>
              </motion.li>
            );

            if (isProjectsItem && !!projectsPopup) {
              return (
                <ProjectsHoverWrapper key={it.to} enabled={true} popup={projectsPopup}>
                  {content}
                </ProjectsHoverWrapper>
              );
            }

            return content;
          })}
        </AnimatePresence>
      </ul>
    </div>
  );
}

function ProjectsHoverWrapper({ enabled, popup, children }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const timer = useRef(null);
  const triggerRef = useRef(null);

  if (!enabled) return children;

  const show = () => {
    clearTimeout(timer.current);
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPos({ top: rect.top, left: rect.right + 12 });
    }
    setOpen(true);
  };
  const hide = () => {
    timer.current = setTimeout(() => setOpen(false), 180);
  };

  // Attach ref and events directly to the child (motion.li) to avoid extra DOM nodes
  const trigger = React.cloneElement(children, {
    ref: triggerRef,
    onMouseEnter: show,
    onMouseLeave: hide,
  });

  return (
    <>
      {trigger}
      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              key="projects-popup"
              initial={{ opacity: 0, x: -6, scale: 0.97 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -6, scale: 0.97 }}
              transition={{ duration: 0.14, ease: 'easeOut' }}
              onMouseEnter={show}
              onMouseLeave={hide}
              style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
              className="w-52 bg-popover border border-border rounded-xl shadow-2xl p-1.5 glass-surface"
            >
              <p className="px-2.5 py-1 text-[9px] font-mono font-semibold uppercase tracking-widest text-muted-foreground/70">
                Projects
              </p>
              <div className="space-y-0.5 py-0.5">
                {popup.projects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      popup.onNavigate(p.id);
                      setOpen(false);
                    }}
                    className="flex items-center gap-2.5 w-full text-left px-2.5 py-2 rounded-lg text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors group"
                  >
                    <div className="w-5 h-5 rounded-md bg-[color:var(--color-ai)]/10 text-[color:var(--color-ai)] flex items-center justify-center font-bold text-[10px] shrink-0">
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="truncate flex-1 font-medium">{p.name}</span>
                    <Kanban className="w-3 h-3 opacity-0 group-hover:opacity-50 shrink-0 transition-opacity" />
                  </button>
                ))}
              </div>
              <div className="border-t border-border/60 mt-1 pt-1 px-1">
                <button
                  onClick={() => {
                    popup.onViewAll();
                    setOpen(false);
                  }}
                  className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-lg text-[11px] font-medium text-[color:var(--color-ai)] hover:bg-[color:var(--color-ai)]/10 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  {popup.viewAllLabel}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}

export default function Sidebar({ onMobileClose, isMobile, projectId }) {
  const location = useLocation();
  const pathname = location.pathname;
  const search = location.search;
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { themeStyle } = useTheme();

  const { data: workspaces = [], isLoading: _wsLoading } = useQuery({
    queryKey: ['workspaces'],
    queryFn: workspaceService.getWorkspaces,
  });

  const activeWsId = useWorkspaceStore((state) => state.activeWorkspaceId);
  const setActiveWsId = useWorkspaceStore((state) => state.setActiveWorkspaceId);

  // Auto-select the first workspace if none is selected, or if the stored one
  // is not in this user's list (e.g. left over from another account)
  useEffect(() => {
    if (workspaces.length > 0 && !workspaces.some((w) => w.id === activeWsId)) {
      const firstId = workspaces[0].id;
      setActiveWsId(firstId);
      qc.invalidateQueries({ queryKey: ['projects', firstId] });
    }
  }, [workspaces, activeWsId, qc, setActiveWsId]);

  const activeWorkspace = workspaces.find((w) => w.id === activeWsId) || workspaces[0];

  // Resolve the workspace that owns the current project (may differ from activeWorkspace)
  const { data: currentProject } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectService.getProject(projectId),
    enabled: !!projectId,
    staleTime: 30_000,
  });
  const projectWorkspace =
    (projectId && workspaces.find((w) => w.id === currentProject?.workspace_id)) || activeWorkspace;

  const handleWorkspaceChange = (id) => {
    setActiveWsId(id);
    qc.invalidateQueries({ queryKey: ['projects', id] });
    navigate('/dashboard');
  };

  const [showWsDropdown, setShowWsDropdown] = useState(false);
  const [showCreateWs, setShowCreateWs] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const wsDropdownRef = useRef(null);
  const wsPopupRef = useRef(null);

  useEffect(() => {
    if (!showWsDropdown) return;
    const handler = (e) => {
      const inTrigger = wsDropdownRef.current?.contains(e.target);
      const inPopup = wsPopupRef.current?.contains(e.target);
      if (!inTrigger && !inPopup) {
        setShowWsDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showWsDropdown]);

  // Recent projects for hover popup
  const { data: projects = [] } = useQuery({
    queryKey: ['projects', activeWsId],
    queryFn: () => projectService.getProjects(activeWsId),
    enabled: !!activeWsId,
    staleTime: 30_000,
  });
  const recentProjects = projects.slice(0, 5);

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['notifications-count'],
    queryFn: () => notificationService.getUnreadCount(),
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });

  const isWsOwner = activeWorkspace?.owner_id === user?.id;
  const { data: wsPermissions = [] } = useQuery({
    queryKey: ['rbac', 'ws-permissions', activeWsId],
    queryFn: () => rbacService.getMyPermissions(null, activeWsId),
    enabled: !!activeWsId && !isWsOwner && activeWorkspace?.type !== 'personal',
    staleTime: 5 * 60 * 1000,
  });
  const canManageWorkspace =
    activeWorkspace?.type !== 'personal' &&
    (isWsOwner || user?.system_role === 'admin' || wsPermissions.includes('workspace.admin'));

  const projectChildren = [];
  if (projectId) {
    projectChildren.push({
      to: `/projects/${projectId}`,
      label: t('sidebar.overview'),
      icon: Sparkles,
      isChild: true,
      exact: true,
    });

    projectChildren.push({
      to: `/projects/${projectId}/kanban`,
      label: t('sidebar.kanban', { defaultValue: 'Kanban' }),
      icon: Columns3,
      isChild: true,
    });

    const isPersonalWs = projectWorkspace?.type === 'personal';

    if (!isPersonalWs && projectWorkspace?.settings?.enable_sprint !== false) {
      projectChildren.push({
        to: `/projects/${projectId}/sprints`,
        label: t('sidebar.sprints'),
        icon: Goal,
        isChild: true,
      });
      projectChildren.push({
        to: `/projects/${projectId}/timeline`,
        label: t('sidebar.timeline'),
        icon: GanttChart,
        isChild: true,
      });
    }

    if (!isPersonalWs && projectWorkspace?.settings?.enable_epics !== false) {
      projectChildren.push({
        to: `/projects/${projectId}/roadmap`,
        label: t('sidebar.roadmap'),
        icon: Route,
        isChild: true,
      });
    }

    if (!isPersonalWs && projectWorkspace?.settings?.enable_automation !== false) {
      projectChildren.push({
        to: `/projects/${projectId}/automation`,
        label: t('sidebar.automation'),
        icon: Workflow,
        isChild: true,
      });
    }

    projectChildren.push({
      to: `/projects/${projectId}/settings`,
      label: t('sidebar.projectSettings', { defaultValue: 'Settings' }),
      icon: Settings,
      isChild: true,
    });

    if (projectChildren.length > 0) {
      projectChildren[projectChildren.length - 1].isLastChild = true;
    }
  }

  const navMain = [
    { to: '/dashboard', label: t('sidebar.dashboard'), icon: LayoutDashboard },
    { to: '/projects', label: t('sidebar.projects'), icon: FolderKanban },
    ...projectChildren,
  ];

  const navIntel = [
    ...(activeWorkspace?.settings?.enable_reports === true
      ? [{ to: '/reports', label: t('sidebar.reports'), icon: BarChart3 }]
      : []),
  ];

  const navSystem = [
    {
      to: '/notifications',
      label: t('sidebar.notifications'),
      icon: Bell,
      count: unreadCount > 0 ? unreadCount : undefined,
    },
    ...(user?.system_role === 'admin'
      ? [{ to: '/admin', label: t('sidebar.admin'), icon: Shield }]
      : []),
    ...(canManageWorkspace
      ? [{ to: '/workspace-settings', label: t('sidebar.workspaceSettings'), icon: Key }]
      : []),
  ];

  const [width, setWidth] = useState(() => {
    const saved = parseInt(localStorage.getItem('sidebar-width'), 10);
    return Number.isFinite(saved) && saved >= 68 ? saved : 240;
  });
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = parseInt(localStorage.getItem('sidebar-width'), 10);
    return Number.isFinite(saved) && saved <= 68;
  });
  const [isDragging, setIsDragging] = useState(false);
  const isResizing = useRef(false);
  const sidebarRef = useRef(null);
  const widthRef = useRef(width);
  const isCollapsedRef = useRef(isCollapsed);
  const lastExpandedWidth = useRef(width > 68 ? width : 240);

  useEffect(() => {
    widthRef.current = width;
    isCollapsedRef.current = isCollapsed;
  }, [width, isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing.current || !sidebarRef.current) return;

      const sidebarLeft = sidebarRef.current.getBoundingClientRect().left;
      const newWidth = e.clientX - sidebarLeft;

      if (newWidth < 120) {
        setIsCollapsed(true);
        setWidth(68); // collapsed width
      } else {
        const clamped = Math.min(Math.max(newWidth, 180), 400);
        setIsCollapsed(false);
        setWidth(clamped);
      }
    };

    const handleMouseUp = () => {
      if (isResizing.current) {
        isResizing.current = false;
        setIsDragging(false);
        document.body.style.cursor = 'default';
        document.body.style.userSelect = 'auto'; // Re-enable text selection

        localStorage.setItem(
          'sidebar-width',
          String(isCollapsedRef.current ? 68 : widthRef.current)
        );
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const handleMouseDown = (e) => {
    e.preventDefault();
    isResizing.current = true;
    setIsDragging(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none'; // Prevent text selection while dragging
  };

  const toggleCollapse = () => {
    if (!isCollapsed) {
      lastExpandedWidth.current = width;
      setIsCollapsed(true);
      setWidth(68);
      localStorage.setItem('sidebar-width', '68');
    } else {
      setIsCollapsed(false);
      setWidth(lastExpandedWidth.current);
      localStorage.setItem('sidebar-width', String(lastExpandedWidth.current));
    }
  };

  const effectiveIsCollapsed = isMobile ? false : isCollapsed;
  const effectiveWidth = isMobile ? 260 : width;

  return (
    <aside
      ref={sidebarRef}
      data-app-sidebar
      className={`sticky top-0 h-screen shrink-0 flex-col border-r border-border bg-sidebar relative z-20 group/sidebar ${isMobile ? 'flex shadow-2xl w-[260px]' : 'hidden md:flex'}`}
      style={{
        width: `${effectiveWidth}px`,
        minWidth: `${effectiveWidth}px`,
        transition: !isDragging
          ? 'width var(--dur-panel) var(--ease-spring), min-width var(--dur-panel) var(--ease-spring)'
          : 'none',
      }}
    >
      {/* Resizer Handle (Hidden on mobile) */}
      {!isMobile && (
        <div
          className="absolute right-[-8px] top-0 bottom-0 w-[16px] cursor-col-resize z-50 hover:bg-[color:var(--color-ai)]/50 transition-colors opacity-0 hover:opacity-100"
          onMouseDown={handleMouseDown}
        />
      )}

      {/* Collapse Toggle (Hidden on mobile) */}
      {!isMobile && (
        <button
          onClick={toggleCollapse}
          className="absolute -right-3 top-4 z-50 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background shadow-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {effectiveIsCollapsed ? (
            <ChevronRight className="w-3.5 h-3.5" />
          ) : (
            <ChevronLeft className="w-3.5 h-3.5" />
          )}
        </button>
      )}

      {/* Mobile Close Button */}
      {isMobile && (
        <button
          onClick={onMobileClose}
          className="absolute right-3 top-4 z-50 flex h-6 w-6 items-center justify-center rounded-md bg-muted/50 text-muted-foreground hover:text-foreground md:hidden"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      {/* Workspace Selector / Header */}
      <div className="relative z-50">
        {/* Row 1: Logo + App name */}
        <div
          className={`flex items-center h-12 transition-all duration-[var(--dur-panel)] ease-[var(--ease-spring)] ${
            effectiveIsCollapsed ? 'px-[16px]' : 'pl-4 pr-10'
          }`}
        >
          <button
            onClick={() => navigate('/')}
            className="relative shrink-0 rounded-lg p-0.5 group/logo focus:outline-none"
          >
            <span className="absolute inset-0 rounded-lg opacity-0 group-hover/logo:opacity-100 transition-opacity duration-300 bg-gradient-to-tr from-[color:var(--color-primary)]/30 to-[color:var(--color-ai)]/30 blur-sm" />
            <img
              src="/logo-icon.svg"
              alt="TaskFlow AI"
              className="relative w-6 h-6 object-contain transition-all duration-300 group-hover/logo:scale-110 group-hover/logo:rotate-6 group-hover/logo:drop-shadow-[0_0_10px_rgba(109,40,217,0.6)]"
            />
          </button>
          {!effectiveIsCollapsed && (
            <div className="ml-2.5 overflow-hidden">
              <p className="text-[14px] font-bold text-foreground tracking-tight leading-none">
                TaskFlow
              </p>
              <p className="font-mono text-[8px] uppercase tracking-widest text-[color:var(--color-ai)] font-semibold mt-0.5">
                AI Platform
              </p>
            </div>
          )}
        </div>

        {/* Row 2: Workspace switcher (expanded only) */}
        {!effectiveIsCollapsed && (
          <div className="px-3 pb-2" ref={wsDropdownRef}>
            <button
              onClick={() => setShowWsDropdown(!showWsDropdown)}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl cursor-pointer hover:bg-muted/60 border border-transparent hover:border-border/60 transition-all duration-200 text-left"
            >
              <div className="w-6 h-6 rounded-lg bg-[color:var(--color-ai)]/10 text-[color:var(--color-ai)] flex items-center justify-center font-bold text-[11px] shrink-0">
                {activeWorkspace?.name?.charAt(0)?.toUpperCase() || 'T'}
              </div>
              <div className="flex flex-col justify-center overflow-hidden flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-foreground leading-tight truncate">
                  {activeWorkspace ? activeWorkspace.name : 'TaskFlow'}
                </p>
                <p className="text-[9px] text-muted-foreground leading-tight mt-0.5 truncate font-mono uppercase tracking-wide">
                  {activeWorkspace
                    ? t('workspace.type.' + activeWorkspace.type)
                    : t('sidebar.ai_platform')}
                </p>
              </div>
              <ChevronRight
                className={`w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform duration-200 ${showWsDropdown ? 'rotate-90' : ''}`}
              />
            </button>
          </div>
        )}

        {/* Dropdown list */}
        <AnimatePresence>
          {showWsDropdown && !effectiveIsCollapsed && (
            <>
              <motion.div
                ref={wsPopupRef}
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                className="absolute left-3 right-3 top-[calc(100%+2px)] bg-popover border border-border rounded-xl shadow-2xl p-1.5 z-50 glass-surface"
              >
                <p className="px-2.5 py-1 text-[9px] font-mono font-semibold uppercase tracking-widest text-muted-foreground/80">
                  {t('sidebar.workspaces_title')}
                </p>
                <div className="max-h-48 overflow-y-auto space-y-0.5 py-1">
                  {workspaces.map((ws) => (
                    <button
                      key={ws.id}
                      onClick={() => {
                        handleWorkspaceChange(ws.id);
                        setShowWsDropdown(false);
                      }}
                      className={`flex items-center gap-2.5 w-full text-left px-2.5 py-2 rounded-lg text-xs transition-colors ${
                        ws.id === activeWsId
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold'
                          : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                      }`}
                    >
                      <div className="w-5 h-5 rounded-md bg-[color:var(--color-ai)]/10 text-[color:var(--color-ai)] flex items-center justify-center font-bold text-[10px]">
                        {ws.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="truncate flex-1">
                        <p className="truncate leading-none">{ws.name}</p>
                        <p className="text-[9px] text-muted-foreground/60 mt-0.5">
                          <span className="capitalize">{ws.type}</span>
                          {ws.owner_id !== user?.id && (
                            <span className="text-[color:var(--color-ai)] font-medium ml-1">
                              • Shared
                            </span>
                          )}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
                <div className="border-t border-border/60 mt-1.5 pt-1.5 px-1">
                  <button
                    onClick={() => {
                      setShowCreateWs(true);
                      setShowWsDropdown(false);
                    }}
                    className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-lg text-[11px] font-medium text-[color:var(--color-ai)] hover:bg-[color:var(--color-ai)]/10 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {t('sidebar.create_workspace')}
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Create Workspace Modal */}
        {showCreateWs && <CreateWorkspaceModal onClose={() => setShowCreateWs(false)} />}
      </div>

      <SidebarSearch isCollapsed={effectiveIsCollapsed} onExpand={() => setIsCollapsed(false)} />

      <nav className="scrollbar-thin flex-1 overflow-y-auto py-1 px-2">
        <NavGroup
          label={t('sidebar.group_workspace')}
          items={navMain}
          active={pathname}
          search={search}
          isCollapsed={effectiveIsCollapsed}
          projectsPopup={
            recentProjects.length > 0
              ? {
                  projects: recentProjects,
                  onNavigate: (id) => {
                    navigate(`/projects/${id}/kanban`);
                  },
                  onViewAll: () => navigate('/projects'),
                  viewAllLabel: t('sidebar.view_all_projects', { defaultValue: 'View all' }),
                }
              : null
          }
        />
        <AnimatePresence initial={false}>
          {navIntel.length > 0 && (
            <motion.div
              key="intel-group"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
              style={{ overflow: 'hidden' }}
            >
              <NavGroup
                label={t('sidebar.group_intelligence')}
                items={navIntel}
                active={pathname}
                search={search}
                isCollapsed={effectiveIsCollapsed}
              />
            </motion.div>
          )}
        </AnimatePresence>
        <NavGroup
          label={t('sidebar.group_system')}
          items={navSystem}
          active={pathname}
          search={search}
          isCollapsed={effectiveIsCollapsed}
        />
      </nav>

      <div
        className={`mt-auto shrink-0 border-t border-sidebar-border py-2 flex flex-col gap-2 transition-all duration-[var(--dur-panel)] ${effectiveIsCollapsed ? 'px-2' : 'px-3'}`}
      >
        {user && (
          <div
            className={`flex items-center gap-2 hover:bg-muted p-1 rounded-lg transition-colors ${effectiveIsCollapsed ? 'justify-center' : 'px-1'}`}
          >
            <button
              onClick={() => navigate('/profile')}
              className="flex items-center gap-2 flex-1 min-w-0 text-left focus:outline-none"
              title={t('profile.title', { defaultValue: 'Profile' })}
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[color:var(--color-primary)] to-[color:var(--color-ai)] text-white font-bold text-[11px] flex items-center justify-center shrink-0 shadow-sm">
                {user.full_name?.charAt(0).toUpperCase() || 'U'}
              </div>
              {!effectiveIsCollapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-bold text-foreground truncate leading-tight group-hover:text-[color:var(--color-ai)] transition-colors">
                    {user.full_name}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate leading-tight mt-0.5">
                    {user.email}
                  </p>
                </div>
              )}
            </button>
            {!effectiveIsCollapsed && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigate('/settings');
                }}
                className="w-7 h-7 rounded flex items-center justify-center transition-colors shrink-0 border text-muted-foreground hover:bg-background shadow-sm hover:text-foreground border-transparent hover:border-border"
                title={t('sidebar.settings')}
              >
                <Settings className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
        <button
          onClick={() => setShowLogoutConfirm(true)}
          title={effectiveIsCollapsed ? t('sidebar.logout') : undefined}
          className={`flex items-center justify-center rounded-md font-medium text-muted-foreground transition-colors hover:bg-[color:var(--color-destructive)]/10 hover:text-[color:var(--color-destructive)] border border-transparent hover:border-[color:var(--color-destructive)]/20 ${effectiveIsCollapsed ? 'w-full p-2' : 'w-full gap-2 px-2 py-1.5 text-[11px]'}`}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!effectiveIsCollapsed && <span>{t('sidebar.logout')}</span>}
        </button>
      </div>

      {showLogoutConfirm && (
        <Modal
          title={t('auth.logout_confirm_title', { defaultValue: 'Confirm Logout' })}
          onClose={() => setShowLogoutConfirm(false)}
          maxWidth="max-w-sm"
          footer={
            <div className="flex gap-2 w-full">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowLogoutConfirm(false)}
              >
                {t('common.cancel', { defaultValue: 'Cancel' })}
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => {
                  setShowLogoutConfirm(false);
                  logout();
                }}
              >
                {t('sidebar.logout', { defaultValue: 'Logout' })}
              </Button>
            </div>
          }
        >
          <div className="p-5 text-sm text-muted-foreground text-center">
            <LogOut className="w-12 h-12 text-[color:var(--color-destructive)] opacity-20 mx-auto mb-3" />
            <p>
              {t('auth.logout_confirm_desc', { defaultValue: 'Are you sure you want to log out?' })}
            </p>
          </div>
        </Modal>
      )}
    </aside>
  );
}

function CreateWorkspaceModal({ onClose }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const setActiveWsId = useWorkspaceStore((state) => state.setActiveWorkspaceId);
  const [name, setName] = useState('');
  const [type, setType] = useState('personal'); // personal | team

  const mutation = useMutation({
    mutationFn: (data) => workspaceService.createWorkspace(data),
    onSuccess: (newWs) => {
      toast.success(t('workspace.created_success'));
      qc.invalidateQueries({ queryKey: ['workspaces'] });
      setActiveWsId(newWs.id);
      onClose();
      navigate('/dashboard');
    },
    onError: () => {
      toast.error(t('workspace.create_failed'));
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    mutation.mutate({ name, type });
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-[101] p-4">
        <Card
          className="w-full max-w-sm p-5 glass shadow-2xl border border-border"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-foreground">{t('workspace.create_title')}</h3>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                {t('workspace.name_label')}
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('workspace.name_placeholder')}
                className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-[color:var(--color-ai)]"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                {t('workspace.type_label')}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setType('personal')}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${
                    type === 'personal'
                      ? 'bg-[color:var(--color-ai)]/10 border-[color:var(--color-ai)] text-[color:var(--color-ai)]'
                      : 'bg-card border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t('workspace.type.personal')}
                </button>
                <button
                  type="button"
                  onClick={() => setType('team')}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${
                    type === 'team'
                      ? 'bg-[color:var(--color-primary)]/10 border-[color:var(--color-primary)] text-[color:var(--color-primary)]'
                      : 'bg-card border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t('workspace.type.team')}
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground/60 mt-1.5 leading-normal">
                {type === 'team'
                  ? t('workspace.type_desc.team')
                  : t('workspace.type_desc.personal')}
              </p>
            </div>
            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
              >
                {t('workspace.btn_cancel')}
              </button>
              <button
                type="submit"
                disabled={mutation.isPending || !name.trim()}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[color:var(--color-primary)] to-[color:var(--color-ai)] text-white text-xs font-semibold shadow-sm hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-1.5"
              >
                {mutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {t('workspace.btn_create')}
              </button>
            </div>
          </form>
        </Card>
      </div>
    </>
  );
}
