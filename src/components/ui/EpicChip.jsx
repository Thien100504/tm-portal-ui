/** Small colored label with an epic's name; renders a dash when there is no epic. */
export default function EpicChip({ epic, size = 'md', fallback = '—' }) {
  if (!epic) {
    return fallback ? <span className="text-[12px] text-muted-foreground">{fallback}</span> : null;
  }
  const color = epic.color || '#3b82f6';
  const text = size === 'sm' ? 'text-[9px] px-1.5 py-0.5' : 'text-[11px] px-2 py-0.5';
  return (
    <span
      className={`inline-flex items-center gap-1 max-w-full rounded-full font-medium border truncate ${text}`}
      style={{ color, borderColor: `${color}55`, backgroundColor: `${color}14` }}
      title={epic.name}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
      <span className="truncate">{epic.name}</span>
    </span>
  );
}
