import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, X, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function PomodoroPiP({ state, actions, t }) {
  const {
    isPipMode,
    timeLeft,
    mode,
    isRunning,
    currentTask,
    completedSessions,
    soundType,
    percentage,
    stars,
    sounds,
  } = state;
  const {
    setIsPipMode,
    setIsFullscreen: _setIsFullscreen,
    setIsRunning,
    handleSoundChange,
    handleReset,
    formatTime,
  } = actions;

  return createPortal(
    <AnimatePresence>
      {isPipMode && (
        <motion.div
          key="pomodoro-pip"
          drag
          dragMomentum={false}
          initial={{ opacity: 0, scale: 0.8, y: 40, filter: 'blur(10px)' }}
          animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, scale: 0.8, y: 40, filter: 'blur(10px)' }}
          transition={{
            type: 'spring',
            stiffness: 260,
            damping: 20,
            mass: 1,
            bounce: 0.25,
          }}
          className="fixed z-[9999] bottom-6 right-6 w-[340px] rounded-2xl"
          style={{ touchAction: 'none' }}
        >
          {/* Outer Glows (Bleeding out) */}
          <div className="absolute -inset-20 pointer-events-none z-0 overflow-visible">
            <motion.div
              animate={{ scale: [1, 1.05, 1], opacity: [0.3, 0.5, 0.3] }}
              transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute top-10 left-10 w-[200px] h-[200px] rounded-full bg-[color:var(--color-ai)]/60 blur-[60px]"
            />
            <motion.div
              animate={{ scale: [1, 1.08, 1], opacity: [0.2, 0.4, 0.2] }}
              transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
              className="absolute bottom-10 right-10 w-[200px] h-[200px] rounded-full bg-[color:var(--color-primary)]/60 blur-[60px]"
            />
          </div>

          {/* Window Card (Clipped) */}
          <div className="relative z-10 w-full flex flex-col text-foreground bg-background/85 backdrop-blur-2xl border border-border/60 shadow-[0_16px_48px_rgba(0,0,0,0.4)] rounded-2xl overflow-hidden">
            {/* Stars background */}
            <div className="absolute inset-0 pointer-events-none z-0">
              {stars.map((star) => (
                <motion.div
                  key={star.id}
                  initial={{ opacity: 0, y: 0 }}
                  animate={{ opacity: [0, 0.8, 0], y: -50 }}
                  transition={{
                    duration: star.duration,
                    delay: star.delay,
                    repeat: Infinity,
                    ease: 'linear',
                  }}
                  className="absolute bg-foreground/50 rounded-full shadow-[0_0_8px_2px_rgba(255,255,255,0.2)] dark:bg-white dark:shadow-[0_0_8px_2px_rgba(255,255,255,0.4)]"
                  style={{
                    width: star.size,
                    height: star.size,
                    left: `${star.left}%`,
                    top: `${star.top}%`,
                  }}
                />
              ))}
            </div>

            {/* Top Bar for Dragging */}
            <div className="relative z-10 w-full flex items-center justify-between p-3 px-4 border-b border-border/50 bg-muted/20 cursor-move">
              <div className="flex items-center gap-2 pointer-events-none">
                <Flame className="w-4 h-4 text-amber-500 animate-pulse" />
                <span className="text-[11px] font-semibold tracking-wider uppercase font-mono text-foreground/80">
                  Pomodoro
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-muted-foreground font-medium bg-muted/50 px-2 py-0.5 rounded-full border border-border/50 pointer-events-none">
                  {t('pomodoro.sessions_today', { count: completedSessions })}
                </span>
                <button
                  onClick={() => setIsPipMode(false)}
                  className="p-1 hover:bg-muted/80 rounded-full transition-colors cursor-pointer"
                  onPointerDown={(e) => e.stopPropagation()} // Prevent drag when clicking close
                  title={t('pomodoro.exit_fullscreen')}
                >
                  <X className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                </button>
              </div>
            </div>

            {/* Main Content Area */}
            <div
              className="relative z-10 flex flex-col items-center justify-center p-6 gap-6"
              onPointerDown={(e) => e.stopPropagation()}
            >
              {/* Glowing Clock Ring */}
              <div className="relative w-44 h-44 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90 overflow-visible">
                  <circle
                    cx="88"
                    cy="88"
                    r="80"
                    className="stroke-muted fill-none"
                    strokeWidth="4"
                  />
                  <circle
                    cx="88"
                    cy="88"
                    r="80"
                    className="stroke-[color:var(--color-ai)] fill-none transition-all duration-300"
                    strokeWidth="5"
                    strokeDasharray={502.6}
                    strokeDashoffset={502.6 - (502.6 * percentage) / 100}
                    strokeLinecap="round"
                    style={{ filter: isRunning ? 'drop-shadow(0 0 10px var(--color-ai))' : 'none' }}
                  />
                </svg>
                <div className="absolute flex flex-col items-center justify-center">
                  <span className="text-4xl font-bold font-mono tracking-tight text-foreground">
                    {formatTime(timeLeft)}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1">
                    {mode === 'focus' ? '🎯 ' + t('pomodoro.focus') : '☕ ' + t('pomodoro.break')}
                  </span>
                </div>
              </div>

              {/* Selected Task details */}
              {currentTask ? (
                <div className="text-center w-full bg-muted/30 border border-border/40 p-3 rounded-xl">
                  <span className="text-[9px] font-mono uppercase tracking-widest text-[color:var(--color-ai)]">
                    {t('pomodoro.current_goal')}
                  </span>
                  <h3 className="text-sm font-bold text-foreground mt-1 leading-snug truncate px-2">
                    {currentTask.title}
                  </h3>
                </div>
              ) : (
                <div className="text-center text-muted-foreground/60 text-xs font-medium italic">
                  {t('pomodoro.no_task')}
                </div>
              )}

              {/* Controls */}
              <div className="flex items-center gap-3 w-full justify-center">
                <Button
                  variant="default"
                  size="default"
                  onClick={() => setIsRunning(!isRunning)}
                  className="rounded-full px-6 bg-[color:var(--color-ai)] hover:bg-[color:var(--color-ai)]/90 text-white font-bold shadow-lg shadow-[color:var(--color-ai)]/20"
                >
                  {isRunning ? t('pomodoro.btn_pause') : t('pomodoro.btn_start')}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleReset}
                  className="w-10 h-10 rounded-full border-border/50 hover:bg-muted/80 shrink-0"
                  title={t('pomodoro.btn_reset')}
                >
                  <RotateCcw className="w-4 h-4 text-muted-foreground" />
                </Button>
              </div>

              {/* Sound Selection */}
              <div className="flex bg-muted/30 p-1 rounded-xl border border-border/40 w-full justify-center mt-2">
                {sounds.map((s) => (
                  <button
                    key={s.type}
                    onClick={() => handleSoundChange(s.type)}
                    className={`flex-1 px-2 py-1.5 rounded-lg text-[10px] font-medium transition-colors ${
                      soundType === s.type
                        ? 'bg-background text-foreground shadow-sm font-semibold'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
