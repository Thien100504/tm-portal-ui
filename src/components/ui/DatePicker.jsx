import { useState, useRef, useEffect, forwardRef, useCallback } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
  parseISO,
  isValid,
} from 'date-fns';
import { vi, enUS } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';

const WEEKDAYS = {
  vi: ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'],
  en: ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'],
};

function parseDate(str) {
  if (!str) return null;
  const d = parseISO(str);
  return isValid(d) ? d : null;
}

const DatePicker = forwardRef(function DatePicker(
  {
    value,
    onChange,
    className = '',
    inputClassName = '',
    size = 'md',
    min,
    max,
    placeholder,
    ...props
  },
  ref
) {
  const { t, i18n } = useTranslation();
  const isVi = i18n.language === 'vi';
  const locale = isVi ? vi : enUS;

  const [localValue, setLocalValue] = useState(value || '');
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => parseDate(value) ?? new Date());
  const [popoverStyle, setPopoverStyle] = useState({});

  const containerRef = useRef(null);
  const popoverRef = useRef(null);
  const hiddenInputRef = useRef(null);

  // Controlled sync
  useEffect(() => {
    if (value !== undefined) setLocalValue(value || '');
  }, [value]);

  useEffect(() => {
    const d = parseDate(localValue);
    if (d) setViewDate(d);
  }, [localValue]);

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (!containerRef.current?.contains(e.target) && !popoverRef.current?.contains(e.target)) {
        setOpen(false);
      }
    };
    const handleKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  // Combine refs
  const setRefs = useCallback(
    (el) => {
      hiddenInputRef.current = el;
      if (typeof ref === 'function') ref(el);
      else if (ref) ref.current = el;
    },
    [ref]
  );

  const fireChange = useCallback(
    (dateStr) => {
      setLocalValue(dateStr);
      // Dispatch native events so react-hook-form picks up via registered input
      const el = hiddenInputRef.current;
      if (el) {
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value'
        )?.set;
        setter?.call(el, dateStr);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
      onChange?.({ target: { value: dateStr } });
    },
    [onChange]
  );

  const handleDayClick = useCallback(
    (day) => {
      fireChange(day ? format(day, 'yyyy-MM-dd') : '');
      setOpen(false);
    },
    [fireChange]
  );

  const updatePopoverPos = useCallback(() => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const popW = Math.max(rect.width, 280);
    const popH = 330;
    const spaceBelow = window.innerHeight - rect.bottom;
    const top = spaceBelow >= popH ? rect.bottom + 4 : rect.top - popH - 4;
    const wouldOverflowRight = rect.left + popW > window.innerWidth - 8;
    const left = wouldOverflowRight ? rect.right - popW : rect.left;
    setPopoverStyle({ top, left, minWidth: popW });
  }, []);

  const handleOpen = () => {
    updatePopoverPos();
    setOpen(true);
  };

  // Recompute position on any scroll/resize while open
  useEffect(() => {
    if (!open) return;
    window.addEventListener('scroll', updatePopoverPos, true);
    window.addEventListener('resize', updatePopoverPos);
    return () => {
      window.removeEventListener('scroll', updatePopoverPos, true);
      window.removeEventListener('resize', updatePopoverPos);
    };
  }, [open, updatePopoverPos]);

  // Calendar grid
  const monthStart = startOfMonth(viewDate);
  const days = eachDayOfInterval({
    start: startOfWeek(monthStart, { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(viewDate), { weekStartsOn: 1 }),
  });

  const selectedDate = parseDate(localValue);
  const displayText = selectedDate ? format(selectedDate, 'dd/MM/yyyy') : '';

  const height = size === 'sm' ? 'h-8' : 'h-9';
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';
  const iconSz = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Hidden native input — carries name/ref/onBlur for react-hook-form */}
      <input
        type="date"
        ref={setRefs}
        defaultValue={localValue}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        min={min}
        max={max}
        {...props}
      />

      {/* Trigger */}
      <button
        type="button"
        onClick={handleOpen}
        className={[
          'flex items-center gap-2 w-full px-3 rounded-xl border border-border bg-muted/40 transition-all duration-150 text-left',
          height,
          textSize,
          inputClassName,
          open
            ? 'ring-1 ring-[color:var(--color-ai)] border-[color:var(--color-ai)]'
            : 'hover:border-foreground/30',
        ].join(' ')}
      >
        <Calendar className={`${iconSz} text-muted-foreground shrink-0`} />
        <span
          className={`flex-1 font-mono ${displayText ? 'text-foreground' : 'text-muted-foreground/50'}`}
        >
          {displayText || placeholder || (isVi ? 'dd/mm/yyyy' : 'mm/dd/yyyy')}
        </span>
        {selectedDate && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              handleDayClick(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.stopPropagation();
                handleDayClick(null);
              }
            }}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-3 h-3" />
          </span>
        )}
      </button>

      {/* Calendar popover */}
      {open &&
        createPortal(
          <div
            ref={popoverRef}
            style={{
              position: 'fixed',
              top: popoverStyle.top,
              left: popoverStyle.left,
              minWidth: popoverStyle.minWidth,
              zIndex: 9999,
            }}
            className="rounded-2xl border border-border bg-popover shadow-2xl shadow-black/25 p-4 backdrop-blur-xl"
          >
            {/* Month navigation */}
            <div className="flex items-center justify-between mb-3">
              <button
                type="button"
                onClick={() => setViewDate((d) => subMonths(d, 1))}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors text-foreground"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-semibold capitalize select-none text-foreground">
                {format(viewDate, 'MMMM yyyy', { locale })}
              </span>
              <button
                type="button"
                onClick={() => setViewDate((d) => addMonths(d, 1))}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors text-foreground"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 mb-1">
              {WEEKDAYS[isVi ? 'vi' : 'en'].map((d) => (
                <div
                  key={d}
                  className="text-center text-[10px] font-semibold text-muted-foreground py-1 select-none"
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Day grid */}
            <div className="grid grid-cols-7 gap-0.5">
              {days.map((day) => {
                const isSel = selectedDate && isSameDay(day, selectedDate);
                const isCur = isSameMonth(day, viewDate);
                const today = isToday(day);
                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => handleDayClick(day)}
                    className={[
                      'aspect-square rounded-lg text-[13px] font-medium transition-colors select-none',
                      isSel
                        ? 'bg-[color:var(--color-primary)] text-white shadow-sm'
                        : today
                          ? 'ring-1 ring-[color:var(--color-primary)] text-[color:var(--color-primary)]'
                          : isCur
                            ? 'hover:bg-muted text-foreground'
                            : 'text-muted-foreground/35 hover:bg-muted/50',
                    ].join(' ')}
                  >
                    {format(day, 'd')}
                  </button>
                );
              })}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-border">
              <button
                type="button"
                onClick={() => handleDayClick(null)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {t('common.clear', 'Clear')}
              </button>
              <button
                type="button"
                onClick={() => handleDayClick(new Date())}
                className="text-xs font-semibold text-[color:var(--color-primary)] hover:opacity-75 transition-opacity"
              >
                {t('common.today', 'Today')}
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
});

export default DatePicker;
