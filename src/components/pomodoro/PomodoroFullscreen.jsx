import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function PomodoroFullscreen({ state, actions, t }) {
  const {
    isFullscreen,
    timeLeft,
    duration: _duration,
    mode,
    isRunning,
    currentTask,
    completedSessions,
    soundType,
    percentage,
    stars,
    sounds,
    volume,
  } = state;
  const {
    setIsFullscreen,
    setIsRunning,
    handleSoundChange,
    handleReset,
    formatTime,
    setVolume,
    setMode,
    handlePresetTime,
  } = actions;

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, setIsFullscreen]);

  return createPortal(
    <AnimatePresence>
      {isFullscreen && (
        <motion.div
          key="pomodoro-fullscreen"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] bg-background/95 flex flex-col items-center justify-between text-foreground py-12 px-6 overflow-hidden backdrop-blur-md"
        >
          {/* Stars background */}
          {stars.map((star) => (
            <motion.div
              key={star.id}
              initial={{ opacity: 0, y: 0 }}
              animate={{ opacity: [0, 0.8, 0], y: -80 }}
              transition={{
                duration: star.duration,
                delay: star.delay,
                repeat: Infinity,
                ease: 'linear',
              }}
              className="absolute bg-foreground/50 rounded-full shadow-[0_0_8px_2px_rgba(255,255,255,0.2)] dark:bg-white dark:shadow-[0_0_8px_2px_rgba(255,255,255,0.4)] pointer-events-none"
              style={{
                width: star.size,
                height: star.size,
                left: `${star.left}%`,
                top: `${star.top}%`,
              }}
            />
          ))}

          {/* Background Breathing Glow */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <motion.div
              animate={{ scale: [1, 1.05, 1], opacity: [0.15, 0.25, 0.15] }}
              transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute -top-1/4 left-1/4 w-[500px] h-[500px] rounded-full bg-[color:var(--color-ai)]/20 blur-[120px]"
            />
            <motion.div
              animate={{ scale: [1, 1.08, 1], opacity: [0.1, 0.2, 0.1] }}
              transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
              className="absolute -bottom-1/4 right-1/4 w-[500px] h-[500px] rounded-full bg-[color:var(--color-primary)]/20 blur-[120px]"
            />
          </div>

          {/* Top Bar */}
          <div className="relative z-10 w-full max-w-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-amber-500 animate-pulse" />
              <span className="text-sm font-semibold tracking-wider uppercase font-mono text-foreground/80">
                TaskFlow Pomodoro
              </span>
            </div>
            <span className="text-xs font-mono text-muted-foreground font-medium bg-muted/50 px-3 py-1.5 rounded-full border border-border/50">
              {t('pomodoro.sessions_today', { count: completedSessions })}
            </span>
          </div>

          {/* Main Clock Area */}
          <div className="relative z-10 flex flex-col items-center justify-center my-auto gap-8">
            {/* Glowing Clock Ring */}
            <div className="relative w-64 h-64 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90 overflow-visible">
                <circle
                  cx="128"
                  cy="128"
                  r="116"
                  className="stroke-muted fill-none"
                  strokeWidth="4"
                />
                <circle
                  cx="128"
                  cy="128"
                  r="116"
                  className="stroke-[color:var(--color-ai)] fill-none transition-all duration-300"
                  strokeWidth="5"
                  strokeDasharray={728.8}
                  strokeDashoffset={728.8 - (728.8 * percentage) / 100}
                  strokeLinecap="round"
                  style={{ filter: isRunning ? 'drop-shadow(0 0 12px var(--color-ai))' : 'none' }}
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center">
                <span className="text-5xl font-bold font-mono tracking-tight text-foreground">
                  {formatTime(timeLeft)}
                </span>
                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground mt-2">
                  {mode === 'focus' ? '🎯 ' + t('pomodoro.focus') : '☕ ' + t('pomodoro.break')}
                </span>
              </div>
            </div>

            {/* Selected Task details */}
            {currentTask ? (
              <div className="text-center max-w-md bg-muted/30 border border-border/40 p-4 rounded-2xl">
                <span className="text-[10px] font-mono uppercase tracking-widest text-[color:var(--color-ai)]">
                  {t('pomodoro.current_goal')}
                </span>
                <h3 className="text-lg font-bold text-foreground mt-1 leading-snug">
                  {currentTask.title}
                </h3>
              </div>
            ) : (
              <div className="text-center text-muted-foreground/60 text-sm font-medium italic">
                {t('pomodoro.no_task')}
              </div>
            )}

            {/* Preset Buttons */}
            <div className="flex items-center gap-3 mt-2">
              {[
                { id: 'focus', label: t('pomodoro.focus'), time: 25 },
                { id: 'shortBreak', label: t('pomodoro.short_break'), time: 5 },
                { id: 'longBreak', label: t('pomodoro.long_break'), time: 15 },
              ].map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => {
                    setMode(preset.id);
                    handlePresetTime(preset.time);
                  }}
                  className={`flex flex-col items-center justify-center px-6 py-2.5 rounded-xl border transition-all ${
                    mode === preset.id
                      ? 'bg-[color:var(--color-ai)]/10 border-[color:var(--color-ai)]/30 text-[color:var(--color-ai)]'
                      : 'bg-muted/30 border-border/40 text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                  }`}
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider mb-0.5">
                    {preset.label}
                  </span>
                  <span className="text-lg font-mono font-bold leading-none">{preset.time}</span>
                </button>
              ))}
            </div>

            {/* Controls */}
            <div className="flex items-center gap-4 mt-2">
              <Button
                variant="default"
                size="lg"
                onClick={() => setIsRunning(!isRunning)}
                className="rounded-full px-8 bg-[color:var(--color-ai)] hover:bg-[color:var(--color-ai)]/90 text-white font-bold shadow-xl shadow-[color:var(--color-ai)]/20"
              >
                {isRunning ? t('pomodoro.btn_pause') : t('pomodoro.btn_start')}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={handleReset}
                className="w-12 h-12 rounded-full border-border/50 hover:bg-muted/80"
              >
                <RotateCcw className="w-5 h-5 text-muted-foreground" />
              </Button>
            </div>
          </div>

          {/* Bottom Bar: Sounds & Exit */}
          <div className="relative z-10 w-full max-w-xl flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-border/40 pt-6">
            <div className="flex flex-col sm:flex-row items-center gap-4">
              {/* Sound Selection */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-muted-foreground mr-1">
                  {t('pomodoro.sound_label')}
                </span>
                <div className="flex bg-muted/30 p-1 rounded-xl border border-border/40">
                  {sounds.map((s) => (
                    <button
                      key={s.type}
                      onClick={() => handleSoundChange(s.type)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
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

              {/* Volume Slider */}
              {soundType !== 'none' && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">Vol</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={volume}
                    onChange={(e) => setVolume(parseFloat(e.target.value))}
                    className="w-24 h-1 bg-muted rounded-lg appearance-none cursor-pointer accent-[color:var(--color-ai)]"
                  />
                </div>
              )}
            </div>

            {/* Exit Button */}
            <Button
              variant="ghost"
              onClick={() => setIsFullscreen(false)}
              className="text-xs font-semibold text-muted-foreground hover:text-foreground border border-border/40 rounded-xl hover:bg-muted/50 px-5"
            >
              {t('pomodoro.exit_fullscreen')}
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
