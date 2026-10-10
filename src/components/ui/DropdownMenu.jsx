import { useState, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"
import { AnimatePresence, motion } from "framer-motion"

export function DropdownMenu({ 
  trigger, 
  content, 
  mode = "click", 
  align = "right", 
  className,
  onOpenChange
}) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);
  let timeoutRef = useRef(null);

  const handleOpenChange = (newVal) => {
    setIsOpen(newVal);
    onOpenChange?.(newVal);
  };

  useEffect(() => {
    if (mode !== "click") return;
    function handleClickOutside(event) {
      if (ref.current && !ref.current.contains(event.target)) {
        handleOpenChange(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const handleMouseEnter = () => {
    if (mode === "hover") {
      clearTimeout(timeoutRef.current);
      handleOpenChange(true);
    }
  };

  const handleMouseLeave = () => {
    if (mode === "hover") {
      timeoutRef.current = setTimeout(() => handleOpenChange(false), 200);
    }
  };

  const alignments = {
    left: "left-0 origin-top-left",
    right: "right-0 origin-top-right",
    center: "left-1/2 -translate-x-1/2 origin-top",
  };

  return (
    <div 
      className="relative" 
      ref={ref}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div 
        onClick={() => mode === "click" && handleOpenChange(!isOpen)}
        className="cursor-pointer h-full"
      >
        {trigger}
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            data-app-dropdown
            initial={{ opacity: 0, y: -5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -5, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className={cn(
              "absolute top-full mt-2 z-50 rounded-xl border border-border bg-card shadow-2xl glass-surface",
              alignments[align],
              className
            )}
          >
            {content}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
