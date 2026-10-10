import * as React from "react"
import { cn } from "@/lib/utils"

const Switch = React.forwardRef(({ className, checked, onCheckedChange, ...props }, ref) => {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange?.(!checked)}
      className={cn(
        "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-[color:var(--color-ai)]" : "bg-muted",
        className
      )}
      ref={ref}
      {...props}
    >
      <span
        className={cn(
          "pointer-events-none block h-5 w-5 rounded-full bg-white shadow-md ring-0 transition-transform duration-200 ease-out",
          checked ? "translate-x-5" : "translate-x-0"
        )}
      />
    </button>
  )
})
Switch.displayName = "Switch"

export { Switch }
