import { motion } from 'framer-motion';
import { Trash2, X, CheckSquare, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * Floating action bar that appears at the bottom of the screen when tasks are selected.
 * Props:
 *   count        – number of selected tasks
 *   onDelete     – called when "Delete" is clicked
 *   onClear      – called when "Clear selection" is clicked
 *   isDeleting   – shows spinner on delete button while request is in flight
 *   children     – extra action buttons inserted before the divider/delete
 */
export default function BulkActionBar({ count, onDelete, onClear, isDeleting, children }) {
  const { t } = useTranslation();
  if (count === 0) return null;

  return (
    <motion.div
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 80, opacity: 0 }}
      transition={{ type: 'spring', damping: 22, stiffness: 260 }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2
                 bg-card border border-border shadow-2xl rounded-xl px-4 py-2.5 min-w-[300px]"
    >
      {/* Count */}
      <CheckSquare className="w-4 h-4 text-[color:var(--color-ai)] shrink-0" />
      <span className="text-[12px] font-semibold text-foreground whitespace-nowrap">
        {t('sprintBoard.bulk.selected', { count })}
      </span>

      {/* Extra slot (e.g. "Move to sprint" on Kanban) */}
      {children && (
        <>
          <div className="w-px h-4 bg-border shrink-0" />
          {children}
        </>
      )}

      <div className="flex-1" />
      <div className="w-px h-4 bg-border shrink-0" />

      {/* Delete */}
      <button
        onClick={onDelete}
        disabled={isDeleting}
        className="flex items-center gap-1.5 text-[11px] font-medium text-[color:var(--color-destructive)]
                   hover:bg-[color:var(--color-destructive)]/10 px-2.5 py-1.5 rounded-md transition-colors
                   disabled:opacity-50"
      >
        {isDeleting
          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
          : <Trash2 className="w-3.5 h-3.5" />
        }
        {t('sprintBoard.bulk.delete', { count })}
      </button>

      {/* Clear */}
      <button
        onClick={onClear}
        className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground
                   hover:text-foreground hover:bg-muted px-2 py-1.5 rounded-md transition-colors"
        title={t('sprintBoard.bulk.clear')}
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
}
