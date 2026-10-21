import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const generateStars = () => {
  return Array.from({ length: 60 }).map((_, i) => ({
    id: i,
    size: Math.random() * 2.5 + 0.5,
    left: Math.random() * 100,
    top: Math.random() * 100,
    duration: Math.random() * 5 + 3,
    delay: Math.random() * 5
  }));
};

const usePomodoroStore = create(
  persist(
    (set, get) => ({
      timeLeft: 25 * 60,
      duration: 25 * 60,
      mode: 'focus', // 'focus' | 'break'
      isRunning: false,
      currentTask: null,
      completedSessions: 0,
      soundType: 'none',
      volume: 0.5,
      isPipMode: false,
      isFullscreen: false,
      stars: generateStars(),

      setIsRunning: (isRunning) => set({ isRunning }),
      setMode: (mode) => set({ mode }),
      setTimeLeft: (timeLeft) => set({ timeLeft }),
      setDuration: (duration) => set({ duration }),
      setCurrentTask: (currentTask) => set({ currentTask }),
      setIsPipMode: (isPipMode) => set({ isPipMode }),
      setIsFullscreen: (isFullscreen) => set({ isFullscreen }),
      setSoundType: (soundType) => set({ soundType }),
      setVolume: (volume) => set({ volume }),

      tick: () => {
        const { timeLeft, mode, completedSessions } = get();
        if (timeLeft > 0) {
          set({ timeLeft: timeLeft - 1 });
        } else {
          // Timer finished
          if (mode === 'focus') {
            set({
              mode: 'break',
              completedSessions: completedSessions + 1,
              timeLeft: 5 * 60,
              duration: 5 * 60,
              isRunning: false, // auto pause on transition
            });
            // Could play an alarm here
          } else {
            set({
              mode: 'focus',
              timeLeft: 25 * 60,
              duration: 25 * 60,
              isRunning: false,
            });
          }
        }
      },

      handleReset: () => {
        const { duration } = get();
        set({ timeLeft: duration, isRunning: false });
      },

      handlePresetTime: (minutes) => {
        set({
          duration: minutes * 60,
          timeLeft: minutes * 60,
          isRunning: false
        });
      }
    }),
    {
      name: 'pomodoro-storage',
      partialize: (state) => ({
        // We persist these fields
        mode: state.mode,
        completedSessions: state.completedSessions,
        soundType: state.soundType,
        volume: state.volume,
        currentTask: state.currentTask,
        // We DO NOT persist running state, PiP, Fullscreen, or time to avoid weirdness on reload
      })
    }
  )
);

export default usePomodoroStore;
