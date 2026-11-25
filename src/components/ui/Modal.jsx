import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';

export function Modal({ onClose, title, icon, subtitle, maxWidth = 'max-w-md', footer, children }) {
  const container = document.getElementById('app-main-area') || document.body;
  const isPortalMain = container.id === 'app-main-area';

  return createPortal(
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className={`${isPortalMain ? 'absolute rounded-[inherit]' : 'fixed'} inset-0 bg-background/60 backdrop-blur-sm z-40`}
      />
      <div
        className={`${isPortalMain ? 'absolute' : 'fixed'} inset-0 z-50 flex items-center justify-center p-4 pointer-events-none`}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className={`bg-card w-full ${maxWidth} rounded-xl shadow-2xl border border-border overflow-hidden pointer-events-auto flex flex-col max-h-[85vh] glass-surface`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header — fixed top */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/30 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              {icon}
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-foreground truncate">{title}</h2>
                {subtitle && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{subtitle}</p>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-muted rounded-full transition-colors shrink-0"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {/* Body — scrollable (min-h-0 allows flex shrink below content height) */}
          <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">{children}</div>

          {/* Footer — fixed bottom */}
          {footer && (
            <div className="shrink-0 px-5 py-4 border-t border-border bg-muted/20">{footer}</div>
          )}
        </motion.div>
      </div>
    </>,
    container
  );
}
