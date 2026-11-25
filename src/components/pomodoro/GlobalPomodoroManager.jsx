import { useEffect, useRef } from 'react';
import usePomodoroStore from '@/store/usePomodoroStore';
import PomodoroPiP from '@/components/pomodoro/PomodoroPiP';
import PomodoroFullscreen from '@/components/pomodoro/PomodoroFullscreen';
import { useTranslation } from 'react-i18next';

export default function GlobalPomodoroManager() {
  const { t } = useTranslation();

  // Audio Refs
  const audioCtxRef = useRef(null);
  const noiseSourceRef = useRef(null);
  const gainNodeRef = useRef(null);

  const {
    isRunning,
    soundType,
    tick,
    isPipMode,
    isFullscreen,
    timeLeft,
    duration,
    mode,
    currentTask,
    completedSessions,
    stars,
    volume,
    setVolume,
    setIsPipMode,
    setIsFullscreen,
    setIsRunning,
    setSoundType,
    setMode,
    handleReset,
    handlePresetTime,
  } = usePomodoroStore();

  // Timer Tick
  useEffect(() => {
    let interval;
    if (isRunning) {
      interval = setInterval(() => {
        tick();
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, tick]);

  const startSound = (type) => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      stopSound();

      if (type === 'none') return;

      const bufferSize = 2 * ctx.sampleRate;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);

      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        if (type === 'rain') {
          // Mix brown noise (deep rumble) with a bit of white noise (splashes)
          const brown = (lastOut + 0.02 * white) / 1.02;
          lastOut = brown;
          output[i] = brown * 3.5 + white * 0.15;
        } else if (type === 'wind') {
          // Pink noise (soothing rush, like wind)
          output[i] = (lastOut + 0.12 * white) / 1.12;
          lastOut = output[i];
          output[i] *= 2.5;
        } else {
          // White noise (static)
          output[i] = white * 0.5;
        }
      }

      const bufferSource = ctx.createBufferSource();
      bufferSource.buffer = noiseBuffer;
      bufferSource.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = type === 'rain' ? 800 : type === 'wind' ? 700 : 1800;

      const gainNode = ctx.createGain();
      // Apply base volume depending on type
      const baseGain = type === 'rain' ? 0.08 : 0.06;
      gainNode.gain.setValueAtTime(baseGain * volume, ctx.currentTime);

      bufferSource.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(ctx.destination);

      bufferSource.start();
      noiseSourceRef.current = bufferSource;
      gainNodeRef.current = gainNode;
    } catch (e) {
      console.error('Failed to start focus sound:', e);
    }
  };

  const stopSound = () => {
    if (noiseSourceRef.current) {
      try {
        noiseSourceRef.current.stop();
      } catch {
        // Silently ignore
      }
      noiseSourceRef.current = null;
    }
  };

  // Audio Playback
  useEffect(() => {
    if (isRunning && soundType !== 'none') {
      startSound(soundType);
    } else {
      stopSound();
    }
    return () => stopSound();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning, soundType]);

  // Dynamic Volume
  useEffect(() => {
    if (gainNodeRef.current && audioCtxRef.current) {
      const baseGain = soundType === 'rain' ? 0.08 : 0.06;
      gainNodeRef.current.gain.setTargetAtTime(
        baseGain * volume,
        audioCtxRef.current.currentTime,
        0.1
      );
    }
  }, [volume, soundType]);

  const percentage = duration > 0 ? (timeLeft / duration) * 100 : 0;
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleSoundChange = (type) => setSoundType(type);

  const state = {
    isPipMode,
    isFullscreen,
    timeLeft,
    duration,
    mode,
    isRunning,
    currentTask,
    completedSessions,
    soundType,
    volume,
    percentage,
    stars,
    sounds: [
      { type: 'none', label: t('pomodoro.sounds.none') },
      { type: 'rain', label: t('pomodoro.sounds.rain') },
      { type: 'wind', label: t('pomodoro.sounds.wind') },
      { type: 'white', label: t('pomodoro.sounds.white') },
    ],
  };

  const actions = {
    setIsPipMode,
    setIsFullscreen,
    setIsRunning,
    handleSoundChange,
    handleReset,
    formatTime,
    handlePresetTime,
    setVolume,
    setMode,
  };

  return (
    <>
      {/* Global Overlays */}
      <PomodoroPiP state={state} actions={actions} t={t} />
      <PomodoroFullscreen state={state} actions={actions} t={t} />
    </>
  );
}
