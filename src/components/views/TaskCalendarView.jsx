import { useMemo, useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  isSameMonth,
  isSameDay,
  addDays,
  parseISO,
} from 'date-fns';
import { vi, enUS } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

const PRIORITY_COLORS = {
  high: 'bg-[color:var(--color-destructive)]/20 text-[color:var(--color-destructive)] border-[color:var(--color-destructive)]/30',
  medium:
    'bg-[color:var(--color-warning)]/20 text-[color:var(--color-warning)] border-[color:var(--color-warning)]/30',
  low: 'bg-[color:var(--color-success)]/20 text-[color:var(--color-success)] border-[color:var(--color-success)]/30',
};

// Expects events to be: { id, title, start: Date | null, priority, rawData }
const MAX_VISIBLE_PER_DAY = 3;

function DayPopover({ dayId, dayEvents, renderEvent, onClose, anchorRef }) {
  const popRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (
        popRef.current &&
        !popRef.current.contains(e.target) &&
        !anchorRef.current?.contains(e.target)
      ) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose, anchorRef]);

  return (
    <div
      ref={popRef}
      className="absolute z-50 left-0 top-full mt-1 w-56 bg-popover border border-border rounded-xl shadow-2xl p-2 glass-surface"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="max-h-48 overflow-y-auto space-y-0.5">
        {dayEvents.map((event, idx) => renderEvent(event, idx))}
      </div>
    </div>
  );
}

export default function TaskCalendarView({
  events = [],
  onEventClick,
  onTaskCreate,
  onTaskUpdateDeadline,
  canEdit = true,
}) {
  const { t, i18n } = useTranslation();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [openPopoverDay, setOpenPopoverDay] = useState(null);

  const locale = i18n.language === 'vi' ? vi : enUS;

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const today = () => setCurrentDate(new Date());

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 }); // Start on Monday
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const dateFormat = 'MMMM yyyy';

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const days = [];
    let day = startDate;
    while (day <= endDate) {
      days.push(day);
      day = addDays(day, 1);
    }
    return days;
  }, [startDate, endDate]);

  const weekDays = useMemo(() => {
    const days = [];
    let startDateOfWeek = startOfWeek(currentDate, { weekStartsOn: 1 });
    for (let i = 0; i < 7; i++) {
      days.push(format(addDays(startDateOfWeek, i), 'EEEE', { locale }));
    }
    return days;
  }, [currentDate, locale]);

  const unscheduledEvents = useMemo(() => events.filter((e) => !e.start), [events]);
  const scheduledEvents = useMemo(() => events.filter((e) => !!e.start), [events]);

  const onDragEnd = (result) => {
    if (!result.destination) return;
    const { source, destination, draggableId } = result;

    if (source.droppableId === destination.droppableId) return;

    if (destination.droppableId === 'unscheduled') {
      onTaskUpdateDeadline?.(draggableId, null);
    } else {
      // Destination is a date string 'yyyy-MM-dd'
      onTaskUpdateDeadline?.(draggableId, parseISO(destination.droppableId));
    }
  };

  const renderEvent = (event, index) => {
    const isDone = event.rawData?.status === 'done';
    const colorClass = isDone
      ? 'bg-muted text-muted-foreground opacity-60 line-through border-transparent'
      : PRIORITY_COLORS[event.priority || 'medium'];

    return (
      <Draggable
        key={event.id}
        draggableId={event.id.toString()}
        index={index}
        isDragDisabled={!canEdit}
      >
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            style={provided.draggableProps.style}
            onClick={(e) => {
              e.stopPropagation();
              onEventClick && onEventClick(event);
            }}
            className={`text-[10px] font-medium px-1.5 py-0.5 mb-1 rounded truncate cursor-pointer border transition-all ${colorClass} ${snapshot.isDragging ? 'shadow-lg ring-2 ring-[color:var(--color-primary)] scale-105 relative z-50' : 'hover:opacity-80'}`}
            title={event.title}
          >
            {event.title}
          </div>
        )}
      </Draggable>
    );
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex h-full gap-4">
        {/* Main Calendar Area */}
        <div className="flex-1 flex flex-col bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          {/* Calendar Header */}
          <div className="flex items-center justify-between p-4 border-b border-border bg-muted/20">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-bold text-foreground capitalize">
                {format(currentDate, dateFormat, { locale })}
              </h2>
              <div className="flex items-center bg-muted/50 rounded-lg p-1 border border-border/50">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-md hover:bg-background"
                  onClick={prevMonth}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-3 text-xs font-semibold rounded-md hover:bg-background"
                  onClick={today}
                >
                  {t('kanban.today', { defaultValue: 'Today' })}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-md hover:bg-background"
                  onClick={nextMonth}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Days of week */}
            <div className="grid grid-cols-7 border-b border-border bg-muted/40 shrink-0">
              {weekDays.map((day, idx) => (
                <div
                  key={idx}
                  className="py-2 text-center text-[11px] font-semibold text-muted-foreground uppercase tracking-wider"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Days Grid */}
            <div className="flex-1 grid grid-cols-7 grid-rows-5 bg-muted/10">
              {calendarDays.map((day) => {
                const isToday = isSameDay(day, new Date());
                const isCurrentMonth = isSameMonth(day, monthStart);
                const dayEvents = scheduledEvents.filter((e) => isSameDay(e.start, day));
                const dayId = format(day, 'yyyy-MM-dd');

                return (
                  <Droppable key={dayId} droppableId={dayId}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        onClick={() => onTaskCreate?.(day)}
                        className={`min-h-0 flex flex-col p-1.5 border-b border-r border-border/50 transition-colors cursor-pointer
                          ${!isCurrentMonth ? 'bg-muted/20 opacity-50' : 'bg-card hover:bg-muted/10'}
                          ${snapshot.isDraggingOver ? 'bg-[color:var(--color-primary)]/10 ring-inset ring-2 ring-[color:var(--color-primary)]/30' : ''}
                        `}
                      >
                        <div className="flex justify-between items-start mb-1 px-1 shrink-0">
                          <span
                            className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full
                            ${isToday ? 'bg-[color:var(--color-primary)] text-white shadow-sm' : 'text-muted-foreground'}
                          `}
                          >
                            {format(day, 'd')}
                          </span>
                        </div>

                        <div className="flex-1 flex flex-col min-h-0 relative">
                          {dayEvents
                            .slice(0, MAX_VISIBLE_PER_DAY)
                            .map((event, idx) => renderEvent(event, idx))}
                          {provided.placeholder}
                          {dayEvents.length > MAX_VISIBLE_PER_DAY &&
                            (() => {
                              const moreBtnRef = { current: null };
                              const hiddenCount = dayEvents.length - MAX_VISIBLE_PER_DAY;
                              const isOpen = openPopoverDay === dayId;
                              return (
                                <div className="relative">
                                  <button
                                    ref={(el) => {
                                      moreBtnRef.current = el;
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setOpenPopoverDay(isOpen ? null : dayId);
                                    }}
                                    className="text-[9px] font-semibold text-[color:var(--color-ai)] hover:underline mt-0.5 px-1 text-left w-full"
                                  >
                                    +{hiddenCount} more
                                  </button>
                                  {isOpen && (
                                    <DayPopover
                                      dayId={dayId}
                                      dayEvents={dayEvents}
                                      renderEvent={renderEvent}
                                      onClose={() => setOpenPopoverDay(null)}
                                      anchorRef={moreBtnRef}
                                    />
                                  )}
                                </div>
                              );
                            })()}
                        </div>
                      </div>
                    )}
                  </Droppable>
                );
              })}
            </div>
          </div>
        </div>

        {/* Unscheduled Panel */}
        <div className="w-[280px] shrink-0 flex flex-col bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 p-4 border-b border-border bg-muted/20">
            <Inbox className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">
              {t('kanban.unscheduled', { defaultValue: 'Unscheduled Tasks' })}
            </h3>
            <span className="ml-auto flex items-center justify-center bg-muted text-muted-foreground text-[10px] font-bold px-2 py-0.5 rounded-full">
              {unscheduledEvents.length}
            </span>
          </div>
          <Droppable droppableId="unscheduled">
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`flex-1 overflow-y-auto p-3 transition-colors ${snapshot.isDraggingOver ? 'bg-[color:var(--color-primary)]/5' : 'bg-muted/10'}`}
              >
                {unscheduledEvents.length === 0 ? (
                  <div className="text-center mt-10 text-muted-foreground text-xs italic opacity-70">
                    {t('kanban.no_unscheduled', { defaultValue: 'All tasks have deadlines!' })}
                  </div>
                ) : (
                  unscheduledEvents.map((event, idx) => renderEvent(event, idx))
                )}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </div>
      </div>
    </DragDropContext>
  );
}
