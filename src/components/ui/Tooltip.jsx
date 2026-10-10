import { cn } from "@/lib/utils"

export function Tooltip({ children, content, position = "top", className, disabled = false }) {
  if (disabled || !content) return <>{children}</>;

  const positions = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  return (
    <div className={cn("group/tooltip relative flex items-center", className)}>
      {children}
      <div 
        data-app-tooltip
        className={cn(
          "absolute z-50 px-2 py-1.5 text-[11px] font-semibold text-foreground whitespace-nowrap rounded-md bg-card border border-border shadow-md opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-200 pointer-events-none transform scale-95 group-hover/tooltip:scale-100",
          positions[position],
          className
        )}
      >
        {content}
      </div>
    </div>
  )
}
