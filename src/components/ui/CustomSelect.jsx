import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function CustomSelect({
  options = [],
  value,
  onChange,
  placeholder,
  icon,
  disabled = false,
  className = '',
  dropdownClassName = '',
}) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const dropdownRef = useRef(null);
  const [dropdownStyle, setDropdownStyle] = useState({});

  useEffect(() => {
    const handleClickOutside = (event) => {
      const isOutsideContainer =
        containerRef.current && !containerRef.current.contains(event.target);
      const isOutsideDropdown = dropdownRef.current && !dropdownRef.current.contains(event.target);

      if (isOutsideContainer && isOutsideDropdown) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Where the list goes: below the field, or above it when there is more room there
  const measure = () => {
    const rect = containerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const dropdownHeight = 220; // approximate max height
    const upwards = spaceBelow < dropdownHeight && spaceAbove > spaceBelow;
    return {
      position: 'fixed',
      top: upwards ? 'auto' : rect.bottom + 6,
      bottom: upwards ? window.innerHeight - rect.top + 6 : 'auto',
      left: rect.left,
      width: rect.width,
      zIndex: 99999,
      transformOrigin: upwards ? 'bottom center' : 'top center',
    };
  };

  // Measure before opening: rendered without position the list would land in
  // the page flow for one frame, stretching the page and making it jump
  const toggle = () => {
    if (disabled) return;
    if (!isOpen && containerRef.current) setDropdownStyle(measure());
    setIsOpen(!isOpen);
  };

  useEffect(() => {
    if (isOpen && containerRef.current) {
      const updatePosition = () => setDropdownStyle(measure());

      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);

      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [isOpen]);

  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <div className={`relative w-full ${className}`} ref={containerRef}>
      <button
        type="button"
        onClick={toggle}
        disabled={disabled}
        className={`w-full flex items-center justify-between px-3 py-2 bg-background border rounded-lg text-[13px] transition-colors shadow-sm focus:outline-none ${
          disabled
            ? 'opacity-50 cursor-not-allowed border-border'
            : isOpen
              ? 'border-[color:var(--color-ai)] ring-1 ring-[color:var(--color-ai)]'
              : 'border-border hover:border-[color:var(--color-ai)]/50 cursor-pointer'
        }`}
      >
        <div className="flex items-center gap-2 truncate">
          {icon && <div className="text-muted-foreground">{icon}</div>}
          <span
            className={`truncate ${!selectedOption ? 'text-muted-foreground font-normal' : 'text-foreground font-medium'}`}
          >
            {selectedOption ? selectedOption.label : placeholder || t('common.select')}
          </span>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-muted-foreground transition-transform duration-200 flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {isOpen && dropdownStyle.position && (
              <motion.div
                ref={dropdownRef}
                initial={{ opacity: 0, y: dropdownStyle.top === 'auto' ? 10 : -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: dropdownStyle.top === 'auto' ? 10 : -10, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                style={dropdownStyle}
                className={`bg-card border border-border rounded-lg shadow-2xl overflow-hidden glass-surface ${dropdownClassName}`}
              >
                <div className="max-h-[220px] overflow-y-auto py-1 scrollbar-thin">
                  {options.length === 0 ? (
                    <div className="px-3 py-3 text-[12px] text-muted-foreground text-center italic">
                      {t('common.noData')}
                    </div>
                  ) : (
                    options.map((option) => {
                      const isSelected = value === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault(); // keep the focus, losing it breaks the selection
                            onChange(option.value);
                            setIsOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 text-[13px] transition-colors text-left ${
                            isSelected
                              ? 'bg-[color:var(--color-ai)]/10 text-[color:var(--color-ai)] font-semibold'
                              : 'text-foreground hover:bg-muted'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate pr-2">
                            {option.icon && <span className="flex-shrink-0">{option.icon}</span>}
                            <span className="truncate">{option.label}</span>
                          </div>
                          {isSelected && <Check className="w-3.5 h-3.5 flex-shrink-0" />}
                        </button>
                      );
                    })
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
}
