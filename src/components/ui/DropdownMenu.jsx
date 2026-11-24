import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';

export function DropdownMenu({
  trigger,
  content,
  mode = 'click',
  align = 'right',
  className,
  onOpenChange,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState(null);
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);
  let timeoutRef = useRef(null);

  const updateCoords = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + 8, // mt-2 equivalent
        left: align === 'center' ? rect.left + rect.width / 2 : undefined,
        right: align === 'right' || align === 'end' ? window.innerWidth - rect.right : undefined,
        leftOffset: align === 'left' || align === 'start' ? rect.left : undefined,
      });
    }
  };

  const handleOpenChange = (newVal) => {
    if (newVal) {
      updateCoords();
    }
    setIsOpen(newVal);
    onOpenChange?.(newVal);
  };

  useEffect(() => {
    const handleScroll = () => {
      if (isOpen) updateCoords();
    };
    if (isOpen) {
      window.addEventListener('scroll', handleScroll, true);
      window.addEventListener('resize', handleScroll);
    }
    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
    };
  }, [isOpen]);

  useEffect(() => {
    if (mode !== 'click') return;
    function handleClickOutside(event) {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(event.target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target)
      ) {
        handleOpenChange(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const handleMouseEnter = () => {
    if (mode === 'hover') {
      clearTimeout(timeoutRef.current);
      handleOpenChange(true);
    }
  };

  const handleMouseLeave = () => {
    if (mode === 'hover') {
      timeoutRef.current = setTimeout(() => handleOpenChange(false), 200);
    }
  };

  const alignments = {
    left: 'origin-top-left',
    start: 'origin-top-left',
    right: 'origin-top-right',
    end: 'origin-top-right',
    center: '-translate-x-1/2 origin-top',
  };

  return (
    <>
      <div
        className="relative inline-block"
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div
          onClick={(e) => {
            if (mode === 'click') {
              e.stopPropagation();
              handleOpenChange(!isOpen);
            }
          }}
          className="cursor-pointer h-full"
        >
          {trigger}
        </div>
      </div>

      {typeof window !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {isOpen && coords && (
              <motion.div
                ref={dropdownRef}
                data-app-dropdown
                initial={{ opacity: 0, y: -5, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -5, scale: 0.95 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                style={{
                  position: 'fixed',
                  top: coords.top,
                  right: coords.right,
                  left: align === 'center' ? coords.left : coords.leftOffset,
                  zIndex: 9999,
                }}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                className={cn(
                  'rounded-xl border border-border bg-card shadow-2xl glass-surface',
                  alignments[align],
                  className
                )}
              >
                {content}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}
