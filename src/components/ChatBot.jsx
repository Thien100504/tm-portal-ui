import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, X, Send, Loader2, MessageCircle, Plus, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { DropdownMenu } from '@/components/ui/DropdownMenu';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/axios';
import { toast } from 'sonner';

const API_BASE = '/api/v1';
const MAX_MESSAGES = 50; // CB-6: cap the number of messages to avoid unbounded memory

export default function ChatBot() {
  const { t, i18n } = useTranslation();
  const { id: projectId } = useParams();
  const { accessToken } = useAuthStore();

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);

  // Chat sessions
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [loadingSessions, setLoadingSessions] = useState(false);

  const scrollContainerRef = useRef(null);
  const inputRef = useRef(null);
  const abortRef = useRef(null);

  const lang = i18n.language?.startsWith('vi') ? 'vi' : 'en';

  // 1. Load the sessions when the popup opens
  const fetchSessions = useCallback(async () => {
    if (!open || !projectId) return;
    try {
      setLoadingSessions(true);
      const res = await api.get(`/projects/${projectId}/chat/sessions`);
      const data = res.data;
      setSessions(data);
      if (data.length > 0 && !currentSessionId) {
        setCurrentSessionId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch sessions', err);
    } finally {
      setLoadingSessions(false);
    }
  }, [open, projectId, accessToken, currentSessionId]);

  useEffect(() => {
    if (open) fetchSessions();
  }, [open, fetchSessions]);

  // 2. Load the messages when the session changes
  useEffect(() => {
    async function loadMessages() {
      if (!currentSessionId || !open) return;
      try {
        const res = await api.get(
          `/projects/${projectId}/chat/sessions/${currentSessionId}/messages`
        );
        const msgs = res.data;
        // Filter out tools to not show raw json
        const viewable = msgs.filter(
          (m) => m.role !== 'tool' && !(m.role === 'assistant' && !m.content)
        );
        setMessages(viewable.map((m) => ({ id: m.id, role: m.role, content: m.content || '' })));
      } catch (err) {
        console.error('Failed to fetch messages', err);
      }
    }
    loadMessages();
  }, [currentSessionId, open, projectId, accessToken]);

  // CB-4: scroll directly
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    []
  );

  // Create a new session
  const createNewSession = async () => {
    if (!projectId) return;
    try {
      const res = await api.post(`/projects/${projectId}/chat/sessions`, {
        title: 'New Conversation',
      });
      const newSession = res.data;
      setSessions([newSession, ...sessions]);
      setCurrentSessionId(newSession.id);
      setMessages([]);
    } catch (e) {
      console.error(e);
    }
  };

  const sendMessage = useCallback(async () => {
    if (!input.trim() || streaming || !projectId) return;

    let targetSessionId = currentSessionId;
    if (!targetSessionId) {
      // Auto create if no session
      try {
        const res = await api.post(`/projects/${projectId}/chat/sessions`, {
          title: input.trim().substring(0, 30) + '...',
        });
        const data = res.data;
        targetSessionId = data.id;
        setSessions([data, ...sessions]);
        setCurrentSessionId(data.id);
      } catch (e) {
        console.error(e);
        return;
      }
    }

    const userMsg = { id: crypto.randomUUID(), role: 'user', content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setStreaming(true);

    const assistantId = crypto.randomUUID();
    const assistantMsg = { id: assistantId, role: 'assistant', content: '' };
    setMessages((prev) => {
      const appended = [...prev, assistantMsg];
      return appended.length > MAX_MESSAGES ? appended.slice(-MAX_MESSAGES) : appended;
    });

    try {
      const controller = new AbortController();
      abortRef.current = controller;

      const freshToken = localStorage.getItem('access_token') || accessToken;

      const res = await fetch(
        `${API_BASE}/projects/${projectId}/chat/sessions/${targetSessionId}/stream`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${freshToken}`,
          },
          body: JSON.stringify({
            content: userMsg.content,
            lang,
          }),
          signal: controller.signal,
        }
      );

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let assistantText = '';

      while (!done) {
        const { value, done: streamDone } = await reader.read();
        done = streamDone;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          assistantText += chunk;

          const toastMatch = assistantText.match(/\[toast:(success|error)\]([\s\S]*?)\[\/toast\]/);
          if (toastMatch) {
            const type = toastMatch[1];
            const msg = toastMatch[2].trim();
            if (type === 'success') toast.success(msg);
            else toast.error(msg);
            assistantText = assistantText.replace(toastMatch[0], '');
          }

          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: assistantText.trimStart() } : m
            )
          );
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: t('chatbot.connection_error', '_(Connection error, please try again.)_'),
                }
              : m
          )
        );
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [input, messages, streaming, projectId, lang, accessToken, currentSessionId, sessions]);

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const isDragging = useRef(false);

  const clearChat = async () => {
    if (!currentSessionId) return;
    if (streaming) abortRef.current?.abort();
    // Soft clear UI, or we could delete the session
    setMessages([]);
  };

  if (!projectId) return null;

  const placeholder = t('chatbot.placeholder', 'Ask about project, tasks, progress...');

  const greeting = t(
    'chatbot.greeting',
    "Hello! I'm the AI assistant for this project. How can I help?"
  );

  return (
    <>
      <motion.button
        onClick={() => setOpen((o) => !o)}
        className={`fixed bottom-6 right-6 z-[60] w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-110
          ${
            open
              ? 'bg-muted text-foreground border border-border'
              : 'bg-[color:var(--color-ai)] text-white hover:bg-[color:var(--color-ai)]/90'
          }`}
        aria-label="Open AI chat"
      >
        {open ? (
          <X className="w-5 h-5 pointer-events-none" />
        ) : (
          <MessageCircle className="w-6 h-6 pointer-events-none" />
        )}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-[84px] right-6 z-50 w-[380px] h-[550px] min-w-[320px] max-w-[80vw] min-h-[400px] max-h-[85vh] flex flex-col bg-card border border-border rounded-2xl shadow-2xl glass-surface overflow-hidden resize"
          >
            {/* Header with Session Selector */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30 shrink-0">
              <div className="w-7 h-7 rounded-full bg-[color:var(--color-ai)]/15 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-[color:var(--color-ai)]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-foreground leading-none">
                  AI Assistant
                </p>
                {/* Session Selector */}
                {sessions.length > 0 ? (
                  <DropdownMenu
                    align="left"
                    trigger={
                      <button className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground mt-0.5 transition-colors max-w-full">
                        <span className="truncate">
                          {sessions.find((s) => s.id === currentSessionId)?.title || 'Conversation'}
                        </span>
                        <ChevronDown className="w-3 h-3 shrink-0" />
                      </button>
                    }
                    content={
                      <div className="flex flex-col max-h-[200px] overflow-y-auto min-w-[200px]">
                        {sessions.map((s) => (
                          <button
                            key={s.id}
                            onClick={() => setCurrentSessionId(s.id)}
                            className={`px-3 py-2 text-left text-xs hover:bg-muted/50 transition-colors border-b border-border/50 last:border-0 ${
                              s.id === currentSessionId
                                ? 'bg-muted/50 font-medium text-[color:var(--color-ai)]'
                                : ''
                            }`}
                          >
                            <span className="truncate block">{s.title || 'Conversation'}</span>
                          </button>
                        ))}
                      </div>
                    }
                  />
                ) : (
                  <p className="text-[10px] text-muted-foreground mt-0.5">New Conversation</p>
                )}
              </div>

              <button
                onClick={createNewSession}
                className="text-muted-foreground/50 hover:text-[color:var(--color-ai)] transition-colors p-1"
                title="New Chat"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-3 space-y-3 text-sm">
              {messages.length === 0 && !loadingSessions && (
                <div className="flex flex-col items-center justify-center h-full pt-6 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-[color:var(--color-ai)]/10 flex items-center justify-center mb-3">
                    <Bot className="w-6 h-6 text-[color:var(--color-ai)]" />
                  </div>
                  <p className="text-[12px] text-muted-foreground leading-relaxed px-4">
                    {greeting}
                  </p>
                </div>
              )}

              {messages.map((msg) => (
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
                    className={`max-w-[82%] rounded-xl px-3 py-2 text-[12px] leading-relaxed break-words
                      ${
                        msg.role === 'user'
                          ? 'bg-[color:var(--color-ai)] text-white rounded-tr-none'
                          : 'bg-muted/60 text-foreground rounded-tl-none'
                      }
                    `}
                  >
                    {msg.role === 'assistant' ? (
                      <span className="whitespace-pre-wrap">
                        {msg.content ||
                          (streaming && msg.id === messages[messages.length - 1]?.id ? '▋' : '')}
                      </span>
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-border p-3 shrink-0">
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder={placeholder}
                  rows={1}
                  disabled={streaming}
                  className="flex-1 resize-none bg-muted/40 border border-border rounded-xl px-3 py-2 text-[12px] outline-none focus:border-[color:var(--color-ai)] transition-colors disabled:opacity-50 max-h-24 overflow-y-auto"
                  style={{ minHeight: 36 }}
                />
                <Button
                  size="icon"
                  onClick={sendMessage}
                  disabled={!input.trim() || streaming}
                  className="w-9 h-9 rounded-xl bg-[color:var(--color-ai)] hover:bg-[color:var(--color-ai)]/90 shrink-0"
                >
                  {streaming ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground/40 mt-1.5 text-center">
                Enter ↵ to send · Shift+Enter for new line
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
