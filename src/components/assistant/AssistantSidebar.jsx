import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { differenceInCalendarDays } from 'date-fns';
import {
  ArrowLeft,
  Bot,
  Check,
  Loader2,
  MessageSquarePlus,
  MoreHorizontal,
  Pencil,
  Search,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import CustomSelect from '@/components/ui/CustomSelect';
import { DropdownMenu } from '@/components/ui/DropdownMenu';
import { useActiveWorkspace } from '@/hooks/useActiveWorkspace';
import { getApiError } from '@/lib/apiError';
import { renderMarkers } from '@/lib/chatMarkers';
import chatService from '@/services/chatService';
import projectService from '@/services/projectService';
import { useAssistantStore } from '@/store/assistantStore';

const WORKSPACE = 'workspace';
const TITLE_LENGTH = 60;

function routeProjectId(pathname) {
  return pathname.match(/\/projects\/([a-f0-9-]+)/i)?.[1] || null;
}

/** today / yesterday / week / older, from the session's last activity */
function ageGroup(dateStr) {
  const days = differenceInCalendarDays(new Date(), new Date(dateStr));
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return 'week';
  return 'older';
}

// ─── Session list ────────────────────────────────────────────────────────────

function SessionRow({ session, onOpen }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [mode, setMode] = useState('view'); // view | rename | confirm-delete
  const [title, setTitle] = useState(session.title || '');
  const [busy, setBusy] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: ['chatSessions'] });

  const rename = async () => {
    const next = title.trim();
    if (!next || next === session.title) return setMode('view');
    setBusy(true);
    try {
      await chatService.renameSession(session.id, next);
      await refresh();
      setMode('view');
    } catch (err) {
      toast.error(getApiError(err, t('common.error')));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await chatService.deleteSession(session.id);
      qc.removeQueries({ queryKey: ['chatMessages', session.id] });
      await refresh();
      toast.success(t('assistant.deleted'));
    } catch (err) {
      toast.error(getApiError(err, t('common.error')));
      setBusy(false);
    }
  };

  if (mode === 'rename') {
    return (
      <div className="flex items-center gap-1 px-2 py-1.5">
        <input
          autoFocus
          value={title}
          maxLength={255}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') rename();
            if (e.key === 'Escape') setMode('view');
          }}
          aria-label={t('assistant.rename')}
          className="flex-1 min-w-0 bg-background border border-border rounded-md px-2 py-1 text-[12px] outline-none focus:border-[color:var(--color-ai)]"
        />
        <Button
          size="icon"
          variant="ghost"
          className="w-7 h-7"
          onClick={rename}
          disabled={busy}
          aria-label={t('common.save')}
        >
          {busy ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Check className="w-3.5 h-3.5" />
          )}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="w-7 h-7"
          onClick={() => setMode('view')}
          aria-label={t('common.cancel')}
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>
    );
  }

  if (mode === 'confirm-delete') {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-destructive/5 rounded-md">
        <p className="flex-1 min-w-0 text-[11px] text-foreground truncate">
          {t('assistant.delete_confirm', { title: session.title || t('chatbot.conversation') })}
        </p>
        <Button size="sm" variant="destructive" onClick={remove} disabled={busy}>
          {busy && <Loader2 className="w-3 h-3 animate-spin" />}
          {t('common.delete')}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setMode('view')} disabled={busy}>
          {t('common.cancel')}
        </Button>
      </div>
    );
  }

  return (
    <div className="group flex items-center rounded-md hover:bg-muted/50 transition-colors">
      <button
        onClick={() => onOpen(session)}
        className="flex-1 min-w-0 text-left px-3 py-2 text-[12px] text-foreground truncate"
      >
        {session.title || t('chatbot.conversation')}
      </button>
      <DropdownMenu
        align="right"
        trigger={
          <button
            className="w-7 h-7 mr-1 flex items-center justify-center rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-background"
            aria-label={t('assistant.actions', { title: session.title || '' })}
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>
        }
        content={
          <div className="flex flex-col min-w-[140px] py-1">
            <button
              onClick={() => {
                setTitle(session.title || '');
                setMode('rename');
              }}
              className="flex items-center gap-2 px-3 py-1.5 text-[12px] hover:bg-muted/50 text-left"
            >
              <Pencil className="w-3.5 h-3.5" /> {t('assistant.rename')}
            </button>
            <button
              onClick={() => setMode('confirm-delete')}
              className="flex items-center gap-2 px-3 py-1.5 text-[12px] text-destructive hover:bg-destructive/10 text-left"
            >
              <Trash2 className="w-3.5 h-3.5" /> {t('common.delete')}
            </button>
          </div>
        }
      />
    </div>
  );
}

function SessionList({ sessions, isLoading, onOpen, onNew }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const shown = sessions.filter((s) => !q || (s.title || '').toLowerCase().includes(q));
    const byAge = { today: [], yesterday: [], week: [], older: [] };
    shown.forEach((s) => byAge[ageGroup(s.updated_at)].push(s));
    return Object.entries(byAge).filter(([, list]) => list.length);
  }, [sessions, query]);

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="p-3 flex flex-col gap-2 border-b border-border">
        <Button
          size="sm"
          onClick={onNew}
          className="w-full bg-[color:var(--color-ai)] hover:bg-[color:var(--color-ai)]/90 text-white"
        >
          <MessageSquarePlus className="w-3.5 h-3.5" /> {t('chatbot.new_conversation')}
        </Button>
        {sessions.length > 0 && (
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('assistant.search')}
              aria-label={t('assistant.search')}
              className="w-full bg-muted/40 border border-border rounded-md pl-8 pr-2 py-1.5 text-[12px] outline-none focus:border-[color:var(--color-ai)]"
            />
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-2">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        ) : groups.length === 0 ? (
          <p className="text-center text-[12px] text-muted-foreground py-8 px-4">
            {query ? t('assistant.no_match') : t('assistant.empty')}
          </p>
        ) : (
          groups.map(([group, list]) => (
            <div key={group} className="mb-3">
              <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t(`assistant.group_${group}`)}
              </p>
              {list.map((s) => (
                <SessionRow key={s.id} session={s} onOpen={onOpen} />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Chat view ───────────────────────────────────────────────────────────────

function ChatView({ session, workspaceId, projectId, onCreated, onBack }) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const [sessionId, setSessionId] = useState(session?.id || null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const lang = i18n.language?.startsWith('vi') ? 'vi' : 'en';

  // History is loaded only for chats opened from the list; a new chat starts empty
  const [openedSession] = useState(session);
  const { data: history } = useQuery({
    queryKey: ['chatMessages', sessionId],
    queryFn: () => chatService.getMessages(sessionId),
    enabled: !!openedSession,
    staleTime: Infinity,
  });
  const isLoading = !!openedSession && !history;

  useEffect(() => {
    if (history) {
      // tool calls and their results are for the model, not for people
      setMessages(
        history.filter((m) => m.role !== 'tool' && !(m.role === 'assistant' && !m.content))
      );
    }
  }, [history]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
    return () => abortRef.current?.abort();
  }, []);

  const send = useCallback(
    async (text) => {
      const content = (text ?? input).trim();
      if (!content || streaming) return;
      setInput('');
      setStreaming(true);
      const assistantId = crypto.randomUUID();
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'user', content },
        { id: assistantId, role: 'assistant', content: '' },
      ]);
      const show = (value) =>
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: value } : m))
        );

      try {
        let id = sessionId;
        if (!id) {
          const created = await chatService.createSession({
            workspaceId,
            projectId,
            title: content.slice(0, TITLE_LENGTH),
          });
          id = created.id;
          setSessionId(id);
          onCreated(created);
        }

        const controller = new AbortController();
        abortRef.current = controller;
        const res = await chatService.streamReply(id, { content, lang }, controller.signal);
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let text = '';
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          text = renderMarkers(t, text + decoder.decode(value, { stream: true }));
          show(text.trimStart());
        }
        qc.invalidateQueries({ queryKey: ['chatSessions'] });
        qc.invalidateQueries({ queryKey: ['chatMessages', id] });
      } catch (err) {
        if (err.name !== 'AbortError') {
          show(getApiError(err, t('chatbot.connection_error')));
        }
      } finally {
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [input, streaming, sessionId, workspaceId, projectId, lang, t, qc, onCreated]
  );

  const suggestions = projectId
    ? ['suggest_project_progress', 'suggest_project_overdue', 'suggest_project_create']
    : ['suggest_ws_overdue', 'suggest_ws_behind', 'suggest_ws_mine'];

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="flex items-center gap-1 px-2 py-2 border-b border-border">
        <Button
          size="icon"
          variant="ghost"
          className="w-7 h-7"
          onClick={onBack}
          aria-label={t('assistant.back')}
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <p className="flex-1 min-w-0 text-[12px] font-medium text-foreground truncate">
          {session?.title || t('chatbot.new_conversation')}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin px-3 py-3 space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center text-center gap-3 py-6">
            <div className="w-10 h-10 rounded-full bg-[color:var(--color-ai)]/15 flex items-center justify-center">
              <Bot className="w-5 h-5 text-[color:var(--color-ai)]" />
            </div>
            <p className="text-[12px] text-muted-foreground max-w-[260px]">
              {projectId ? t('chatbot.greeting') : t('assistant.greeting_workspace')}
            </p>
            <div className="flex flex-col gap-1.5 w-full">
              {suggestions.map((key) => (
                <button
                  key={key}
                  onClick={() => send(t(`assistant.${key}`))}
                  className="text-left text-[12px] px-3 py-2 rounded-lg border border-border hover:border-[color:var(--color-ai)]/50 hover:bg-muted/40 transition-colors"
                >
                  {t(`assistant.${key}`)}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="w-6 h-6 rounded-full bg-[color:var(--color-ai)]/15 flex items-center justify-center shrink-0 mr-2 mt-0.5">
                  <Bot className="w-3.5 h-3.5 text-[color:var(--color-ai)]" />
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-xl px-3 py-2 text-[12px] leading-relaxed break-words whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-[color:var(--color-ai)] text-white rounded-tr-none'
                    : 'bg-muted/60 text-foreground rounded-tl-none'
                }`}
              >
                {msg.content || (streaming && msg.role === 'assistant' ? '▋' : '')}
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-border p-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={
              projectId ? t('chatbot.placeholder') : t('assistant.placeholder_workspace')
            }
            aria-label={t('assistant.message')}
            rows={1}
            disabled={streaming}
            className="flex-1 resize-none bg-muted/40 border border-border rounded-xl px-3 py-2 text-[12px] outline-none focus:border-[color:var(--color-ai)] transition-colors disabled:opacity-50 max-h-32 overflow-y-auto"
            style={{ minHeight: 36 }}
          />
          <Button
            size="icon"
            onClick={() => send()}
            disabled={!input.trim() || streaming}
            aria-label={t('assistant.send')}
            className="w-9 h-9 rounded-xl bg-[color:var(--color-ai)] hover:bg-[color:var(--color-ai)]/90 shrink-0"
          >
            {streaming ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground/60 mt-1.5 text-center">
          {t('assistant.enter_hint')}
        </p>
      </div>
    </div>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

/**
 * Right-hand AI assistant: pick a scope (the whole workspace or one project),
 * then browse, rename and delete conversations or chat in one.
 */
export default function AssistantSidebar() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const open = useAssistantStore((s) => s.open);
  const setOpen = useAssistantStore((s) => s.setOpen);
  const { activeWorkspaceId, settings } = useActiveWorkspace();
  const routeProject = routeProjectId(pathname);

  const [scope, setScope] = useState(routeProject || WORKSPACE);
  // null = the list; { session } = a chat (session null while drafting a new one)
  const [chat, setChat] = useState(null);
  const [chatKey, setChatKey] = useState(0);

  // Entering another project's pages switches the assistant to that project
  const lastRouteProject = useRef(routeProject);
  useEffect(() => {
    if (routeProject && routeProject !== lastRouteProject.current) {
      setScope(routeProject);
      setChat(null);
    }
    lastRouteProject.current = routeProject;
  }, [routeProject]);

  // A different workspace starts from its own list
  useEffect(() => {
    setScope(routeProjectId(window.location.pathname) || WORKSPACE);
    setChat(null);
  }, [activeWorkspaceId]);

  const projectId = scope === WORKSPACE ? null : scope;
  const enabled = open && !!activeWorkspaceId && settings.enable_ai !== false;

  const { data: projects = [] } = useQuery({
    queryKey: ['projects', activeWorkspaceId],
    queryFn: () => projectService.getProjects(activeWorkspaceId),
    enabled,
  });

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['chatSessions', activeWorkspaceId, projectId],
    queryFn: () => chatService.listSessions({ workspaceId: activeWorkspaceId, projectId }),
    enabled,
  });

  const scopeOptions = [
    { value: WORKSPACE, label: t('assistant.scope_workspace') },
    ...projects.map((p) => ({ value: p.id, label: p.name })),
  ];

  const openChat = (session) => {
    setChatKey((k) => k + 1);
    setChat({ session });
  };

  const onCreated = useCallback((session) => {
    setChat({ session });
  }, []);

  if (!open || settings.enable_ai === false) return null;

  return (
    <>
      {/* below lg the sidebar floats over the page */}
      <div
        className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm lg:hidden"
        onClick={() => setOpen(false)}
      />
      <aside
        aria-label={t('chatbot.title')}
        className="fixed inset-y-0 right-0 z-50 w-full sm:w-[400px] lg:static lg:z-auto lg:w-[380px] shrink-0 flex flex-col border-l border-border bg-card/95 backdrop-blur-md"
      >
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
          <div className="w-7 h-7 rounded-full bg-[color:var(--color-ai)]/15 flex items-center justify-center shrink-0">
            <Bot className="w-4 h-4 text-[color:var(--color-ai)]" />
          </div>
          <p className="text-[13px] font-semibold text-foreground shrink-0">{t('chatbot.title')}</p>
          <div className="flex-1 min-w-0">
            <CustomSelect
              options={scopeOptions}
              value={scope}
              onChange={(value) => {
                setScope(value);
                setChat(null);
              }}
              className="text-[11px]"
            />
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="w-7 h-7 shrink-0"
            onClick={() => setOpen(false)}
            aria-label={t('assistant.close')}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {chat ? (
          <ChatView
            key={chatKey}
            session={chat.session}
            workspaceId={activeWorkspaceId}
            projectId={projectId}
            onCreated={onCreated}
            onBack={() => setChat(null)}
          />
        ) : (
          <SessionList
            sessions={sessions}
            isLoading={isLoading}
            onOpen={openChat}
            onNew={() => openChat(null)}
          />
        )}
      </aside>
    </>
  );
}
