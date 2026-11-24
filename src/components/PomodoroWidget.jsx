import { useTranslation } from 'react-i18next';
import { Flame, Play, Pause, RotateCcw, Maximize2, PictureInPicture } from 'lucide-react';
import CustomSelect from '@/components/ui/CustomSelect';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import usePomodoroStore from '@/store/usePomodoroStore';

export default function PomodoroWidget({ myDayTasks = [] }) {
  const { t } = useTranslation();

  const {
    mode,
    setMode,
    timeLeft,
    duration,
    isRunning,
    setIsRunning,
    currentTask,
    setCurrentTask,
    completedSessions,
    soundType,
    setSoundType,
    volume,
    setVolume,
    setIsFullscreen,
    setIsPipMode,
    handlePresetTime,
    handleReset,
  } = usePomodoroStore();

  const selectedTaskId = currentTask?.id || '';
  const setSelectedTaskId = (id) => {
    const task = myDayTasks.find((t) => t.id === id);
    setCurrentTask(task || null);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const percentage = duration > 0 ? (timeLeft / duration) * 100 : 0;

  const sounds = [
    { type: 'none', label: t('pomodoro.sounds.none') },
    { type: 'rain', label: t('pomodoro.sounds.rain') },
    { type: 'wind', label: t('pomodoro.sounds.wind') },
    { type: 'white', label: t('pomodoro.sounds.white') },
  ];

  return (
    <Card className="glass-surface border border-border/60 relative overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border/50">
        <span className="flex items-center gap-1.5 text-[10px] font-mono text-[color:var(--color-ai)] font-semibold uppercase tracking-widest">
          <Flame className="w-3.5 h-3.5" /> {t('pomodoro.timer')}
        </span>
        {completedSessions > 0 && (
          <span className="text-emerald-500 text-[10px] font-bold bg-emerald-500/10 px-2 py-0.5 rounded-md">
            {t('pomodoro.completed_sessions', { count: completedSessions })}
          </span>
        )}
      </div>

      <div className="p-5 flex flex-col items-center">
        {/* Mode + Preset row */}
        <div className="flex flex-col items-center gap-3 mb-6 w-full justify-center">
          <div className="flex bg-muted/50 p-1 rounded-xl border border-border/40 w-full max-w-[240px]">
            <button
              onClick={() => {
                setMode('focus');
                handlePresetTime(25);
              }}
              className={`flex-1 whitespace-nowrap flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                mode === 'focus'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>🎯</span> <span>{t('pomodoro.focus')}</span>
            </button>
            <button
              onClick={() => {
                setMode('break');
                handlePresetTime(5);
              }}
              className={`flex-1 whitespace-nowrap flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                mode === 'break'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>☕</span> <span>{t('pomodoro.break')}</span>
            </button>
          </div>
          <div className="flex gap-2 justify-center">
            {(mode === 'focus' ? [15, 25, 45, 60] : [5, 10, 15]).map((mins) => (
              <button
                key={mins}
                onClick={() => handlePresetTime(mins)}
                className={`px-3 py-1 text-xs font-medium rounded-lg transition-all ${
                  Math.floor(duration / 60) === mins
                    ? 'bg-[color:var(--color-ai)] text-white shadow-sm'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground border border-border/40'
                }`}
              >
                {mins}m
              </button>
            ))}
          </div>
        </div>

        {/* Circular Clock */}
        <div className="relative w-40 h-40 flex items-center justify-center mb-5">
          <svg
            className="w-full h-full transform -rotate-90 overflow-visible"
            viewBox="0 0 128 128"
          >
            <circle cx="64" cy="64" r="58" className="stroke-muted fill-none" strokeWidth="3" />
            <circle
              cx="64"
              cy="64"
              r="58"
              className="fill-none transition-all duration-300"
              stroke="var(--color-ai)"
              strokeWidth="4"
              strokeDasharray={364.4}
              strokeDashoffset={364.4 - (364.4 * percentage) / 100}
              strokeLinecap="round"
              style={{ filter: isRunning ? 'drop-shadow(0 0 6px var(--color-ai))' : 'none' }}
            />
          </svg>
          <div className="absolute flex flex-col items-center justify-center">
            <span className="text-3xl font-bold font-mono text-foreground leading-none tracking-tight">
              {formatTime(timeLeft)}
            </span>
            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mt-1.5">
              {mode === 'focus' ? t('pomodoro.focus') : t('pomodoro.break')}
            </span>
          </div>
        </div>

        {/* Task Selector */}
        <div className="w-full max-w-[260px] mb-4">
          <CustomSelect
            value={selectedTaskId}
            onChange={setSelectedTaskId}
            placeholder={t('pomodoro.select_task')}
            options={myDayTasks.map((task) => ({ value: task.id, label: task.title }))}
          />
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 mb-4">
          <Button
            variant="default"
            onClick={() => setIsRunning(!isRunning)}
            className="rounded-full px-6 bg-[color:var(--color-ai)] hover:bg-[color:var(--color-ai)]/90 text-white font-semibold"
          >
            {isRunning ? <Pause className="w-4 h-4 mr-1.5" /> : <Play className="w-4 h-4 mr-1.5" />}
            {isRunning ? t('pomodoro.btn_pause') : t('pomodoro.btn_start')}
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={handleReset}
            className="rounded-full w-9 h-9"
            title={t('pomodoro.btn_reset')}
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setIsFullscreen(true)}
            className="rounded-full w-9 h-9"
            title={t('pomodoro.fullscreen')}
          >
            <Maximize2 className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setIsPipMode(true)}
            className="rounded-full w-9 h-9"
            title={t('pomodoro.pip')}
          >
            <PictureInPicture className="w-4 h-4" />
          </Button>
        </div>

        {/* Sound & Volume */}
        <div className="flex flex-col w-full gap-2 mt-2">
          <div className="flex items-center gap-1.5 bg-muted/30 p-1 rounded-xl border border-border/40 w-full justify-center">
            {sounds.map((s) => (
              <button
                key={s.type}
                onClick={() => setSoundType(s.type)}
                className={`flex-1 px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors ${
                  soundType === s.type
                    ? 'bg-background text-foreground shadow-sm font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          {soundType !== 'none' && (
            <div className="flex items-center gap-2 px-2">
              <span className="text-[10px] font-medium text-muted-foreground">Vol</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-full h-1 bg-muted rounded-lg appearance-none cursor-pointer accent-[color:var(--color-ai)]"
              />
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
