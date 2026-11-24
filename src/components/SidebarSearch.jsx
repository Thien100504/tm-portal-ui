import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Folder, CheckSquare, User, Loader2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useDebounce } from '@/hooks/useDebounce';
import { useActiveWorkspace } from '@/hooks/useActiveWorkspace';
import searchService from '@/services/searchService';
import { motion, AnimatePresence } from 'framer-motion';

export default function SidebarSearch({ isCollapsed, onExpand }) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const debouncedQuery = useDebounce(query, 300);
  const { t } = useTranslation();
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const [popupPos, setPopupPos] = useState({ top: 0, left: 0, width: 300 });

  const { activeWorkspace } = useActiveWorkspace();
  const activeWsId = activeWorkspace?.id;

  // Click outside to close & Ctrl+K to focus
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (isCollapsed && onExpand) {
          onExpand();
          setTimeout(() => inputRef.current?.focus(), 300);
        } else {
          inputRef.current?.focus();
        }
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    if (!isOpen) return () => window.removeEventListener('keydown', handleKeyDown);

    const handleClickOutside = (e) => {
      // Allow clicking inside input
      if (containerRef.current?.contains(e.target)) return;

      // Close popup
      setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isCollapsed, onExpand]);

  // Fetch results
  const { data: results, isFetching } = useQuery({
    queryKey: ['global-search', debouncedQuery, activeWsId],
    queryFn: () => searchService.globalSearch(debouncedQuery, activeWsId),
    enabled: isOpen && debouncedQuery.length > 0 && !!activeWsId,
    staleTime: 60_000,
  });

  const navigateTo = (path) => {
    navigate(path);
    setIsOpen(false);
    setQuery('');
    if (inputRef.current) inputRef.current.blur();
  };

  const hasResults =
    results &&
    (results.projects?.length > 0 || results.tasks?.length > 0 || results.users?.length > 0);

  const handleContainerClick = () => {
    if (isCollapsed && onExpand) {
      onExpand();
      setTimeout(() => inputRef.current?.focus(), 300);
    } else {
      inputRef.current?.focus();
    }
  };

  return (
    <div className="py-2 px-2 relative" ref={containerRef}>
      <div
        onClick={handleContainerClick}
        className={`flex w-full items-center rounded-xl border border-border bg-card text-muted-foreground transition-all duration-[var(--dur-panel)] ease-[var(--ease-spring)] focus-within:ring-2 focus-within:ring-[color:var(--color-ai)]/50 focus-within:border-[color:var(--color-ai)] hover:text-foreground hover:bg-muted/50 overflow-hidden cursor-text ${isOpen ? 'ring-2 ring-[color:var(--color-ai)]/50 border-[color:var(--color-ai)]' : ''}`}
      >
        <div
          className={`flex shrink-0 items-center justify-center transition-all duration-[var(--dur-panel)] ease-[var(--ease-spring)] ${isCollapsed ? 'w-[52px] h-[36px] cursor-pointer' : 'w-10 h-8'}`}
        >
          <Search
            className={`w-4 h-4 shrink-0 transition-colors ${isOpen ? 'text-[color:var(--color-ai)]' : ''}`}
          />
        </div>

        <div
          className={`flex items-center flex-1 overflow-hidden transition-all duration-[var(--dur-panel)] ease-[var(--ease-spring)] ${isCollapsed ? 'w-0 opacity-0' : 'opacity-100'}`}
        >
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (e.target.value.length > 0) setIsOpen(true);
              else setIsOpen(false);
            }}
            onFocus={() => {
              if (query.length > 0) setIsOpen(true);
            }}
            placeholder={t('sidebar.search', { defaultValue: 'Search...' })}
            className="w-full bg-transparent border-none outline-none ring-0 text-[12px] font-medium text-foreground placeholder:text-muted-foreground py-1 pr-2"
          />
          {query && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setQuery('');
                setIsOpen(false);
                inputRef.current?.focus();
              }}
              className="mr-2 shrink-0 p-0.5 rounded-full hover:bg-muted/80 text-muted-foreground transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {isOpen && (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, y: 5, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.98 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            style={{
              position: 'absolute',
              top: '100%',
              left: isCollapsed ? '100%' : '8px',
              width: isCollapsed ? 300 : 'calc(100% - 16px)',
              zIndex: 9999,
              marginTop: '4px',
              marginLeft: isCollapsed ? '4px' : 0,
            }}
            className="bg-card border border-border shadow-2xl rounded-xl overflow-hidden flex flex-col max-h-[400px]"
            onMouseDown={(e) => e.stopPropagation()} // Prevent clicking popup from closing it
          >
            <div className="overflow-y-auto p-2 scrollbar-thin">
              {isFetching && (
                <div className="py-6 flex justify-center">
                  <Loader2 className="w-4 h-4 animate-spin text-[color:var(--color-ai)]" />
                </div>
              )}

              {!isFetching && !hasResults && (
                <div className="py-6 text-center text-[11px] text-muted-foreground">
                  {t('search.no_results', { defaultValue: 'No results found.' })}
                </div>
              )}

              {!isFetching && hasResults && (
                <div className="space-y-3">
                  {/* Projects */}
                  {results.projects?.length > 0 && (
                    <div>
                      <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1 px-2">
                        Projects
                      </div>
                      {results.projects.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => navigateTo(`/projects/${p.id}`)}
                          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md hover:bg-muted/50 transition-colors text-left group"
                        >
                          <div className="w-5 h-5 rounded bg-[color:var(--color-primary)]/10 text-[color:var(--color-primary)] flex items-center justify-center shrink-0 group-hover:bg-[color:var(--color-primary)]/20 transition-colors">
                            <Folder className="w-3 h-3" />
                          </div>
                          <span className="text-[12px] font-medium text-foreground truncate">
                            {p.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Tasks */}
                  {results.tasks?.length > 0 && (
                    <div>
                      <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1 px-2">
                        Tasks
                      </div>
                      {results.tasks.map((t) => (
                        <button
                          key={t.id}
                          onClick={() =>
                            navigateTo(`/projects/${t.project_id}/kanban?taskId=${t.id}`)
                          }
                          className="w-full flex flex-col px-2.5 py-1.5 rounded-md hover:bg-muted/50 transition-colors text-left group"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-5 h-5 rounded bg-[color:var(--color-ai)]/10 text-[color:var(--color-ai)] flex items-center justify-center shrink-0 group-hover:bg-[color:var(--color-ai)]/20 transition-colors">
                              <CheckSquare className="w-3 h-3" />
                            </div>
                            <span className="text-[12px] font-medium text-foreground truncate">
                              {t.title}
                            </span>
                          </div>
                          <span className="text-[9px] text-muted-foreground ml-7.5 mt-0.5 truncate">
                            {t.project_name}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Users */}
                  {results.users?.length > 0 && (
                    <div>
                      <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1 px-2">
                        Members
                      </div>
                      {results.users.map((u) => (
                        <button
                          key={u.id}
                          onClick={() => navigateTo('/workspace-settings')}
                          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md hover:bg-muted/50 transition-colors text-left group"
                        >
                          <div className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0 group-hover:bg-emerald-500/20 transition-colors">
                            <User className="w-3 h-3" />
                          </div>
                          <div className="flex flex-col min-w-0 flex-1">
                            <span className="text-[12px] font-medium text-foreground leading-none truncate">
                              {u.name}
                            </span>
                            <span className="text-[9px] text-muted-foreground mt-1 truncate">
                              {u.email}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}
