import { useState, useRef, useCallback, useEffect } from 'react';
import { toast } from 'sonner';

interface UseMatchTimerProps {
  partDurationMinutes: number;
  onTimeAlert?: (type: 'approaching' | 'regulation_end' | 'overtime') => void;
}

export function useMatchTimer({ partDurationMinutes, onTimeAlert }: UseMatchTimerProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const pausedAtRef = useRef<number>(0);
  const alertsTriggeredRef = useRef<Set<string>>(new Set());

  // Check for time alerts
  useEffect(() => {
    if (!isRunning || !partDurationMinutes) return;

    const regulationSeconds = partDurationMinutes * 60;
    const approachingSeconds = regulationSeconds - 120; // 2 minutes before
    const overtimeSeconds = regulationSeconds + 300; // 5 minutes after

    // Approaching end (2 min before)
    if (elapsedSeconds >= approachingSeconds && elapsedSeconds < regulationSeconds) {
      if (!alertsTriggeredRef.current.has('approaching')) {
        alertsTriggeredRef.current.add('approaching');
        onTimeAlert?.('approaching');
        toast.warning('⏱️ Faltam 2 minutos para o fim do tempo regulamentar', {
          duration: 5000,
        });
        // Play sound
        playAlertSound('beep');
      }
    }

    // Regulation time ended
    if (elapsedSeconds >= regulationSeconds && elapsedSeconds < overtimeSeconds) {
      if (!alertsTriggeredRef.current.has('regulation_end')) {
        alertsTriggeredRef.current.add('regulation_end');
        onTimeAlert?.('regulation_end');
        toast.info('⏱️ Tempo regulamentar terminado', {
          duration: 5000,
        });
        playAlertSound('whistle');
      }
    }

    // 5 minutes overtime
    if (elapsedSeconds >= overtimeSeconds) {
      if (!alertsTriggeredRef.current.has('overtime')) {
        alertsTriggeredRef.current.add('overtime');
        onTimeAlert?.('overtime');
        toast.warning('⏱️ +5 minutos após o tempo regulamentar', {
          duration: 5000,
        });
        playAlertSound('beep');
      }
    }
  }, [elapsedSeconds, isRunning, partDurationMinutes, onTimeAlert]);

  const playAlertSound = (type: 'beep' | 'whistle') => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      if (type === 'beep') {
        oscillator.frequency.value = 880;
        oscillator.type = 'sine';
        gainNode.gain.value = 0.3;
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.3);
      } else {
        oscillator.frequency.value = 600;
        oscillator.type = 'square';
        gainNode.gain.value = 0.2;
        oscillator.start();
        setTimeout(() => oscillator.stop(), 500);
      }
    } catch (e) {
      console.log('Audio not supported');
    }
  };

  const startTimer = useCallback((fromSeconds?: number) => {
    if (intervalRef.current) return;

    if (fromSeconds !== undefined) {
      pausedAtRef.current = fromSeconds;
      setElapsedSeconds(fromSeconds);
    }

    startTimeRef.current = Date.now() - (pausedAtRef.current * 1000);
    setIsRunning(true);

    intervalRef.current = setInterval(() => {
      if (startTimeRef.current) {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setElapsedSeconds(elapsed);
      }
    }, 1000);

    return startTimeRef.current;
  }, []);

  const pauseTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (startTimeRef.current) {
      pausedAtRef.current = Math.floor((Date.now() - startTimeRef.current) / 1000);
    }
    startTimeRef.current = null;
    setElapsedSeconds(pausedAtRef.current);
    setIsRunning(false);
    return pausedAtRef.current;
  }, []);

  /** Exact elapsed seconds right now (does not wait for the next 1s tick). */
  const getExactElapsedSeconds = useCallback(() => {
    if (startTimeRef.current) return Math.floor((Date.now() - startTimeRef.current) / 1000);
    return pausedAtRef.current;
  }, []);

  // When the phone wakes up / the app comes back to the foreground, refresh immediately.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && startTimeRef.current) {
        setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  const resetTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setElapsedSeconds(0);
    pausedAtRef.current = 0;
    startTimeRef.current = null;
    setIsRunning(false);
    alertsTriggeredRef.current.clear();
  }, []);

  const restoreTimer = useCallback((savedSeconds: number, savedStartTime: number | null) => {
    if (savedStartTime) {
      // Timer was running - calculate elapsed from the actual start timestamp
      // savedStartTime is when the current part started, so elapsed = now - startTime
      const elapsed = Math.floor((Date.now() - savedStartTime) / 1000);

      // Ensure we don't go negative and cap at a reasonable value
      const validElapsed = Math.max(0, elapsed);

      pausedAtRef.current = validElapsed;
      setElapsedSeconds(validElapsed);
      startTimer(validElapsed);
      // keep the real start of the part: re-deriving it from whole seconds would
      // shift the clock a little every time the match screen is reopened
      startTimeRef.current = Math.min(savedStartTime, Date.now());
    } else {
      // Timer was paused - use the saved seconds directly
      pausedAtRef.current = savedSeconds;
      setElapsedSeconds(savedSeconds);
    }
  }, [startTimer]);

  const getTimerState = useCallback(() => ({
    elapsedSeconds,
    isRunning,
    startTime: startTimeRef.current,
  }), [elapsedSeconds, isRunning]);

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const getMinutes = useCallback(() => Math.floor(elapsedSeconds / 60), [elapsedSeconds]);
  const getSeconds = useCallback(() => elapsedSeconds % 60, [elapsedSeconds]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    elapsedSeconds,
    isRunning,
    startTimer,
    pauseTimer,
    resetTimer,
    restoreTimer,
    getTimerState,
    getExactElapsedSeconds,
    formatTime,
    getMinutes,
    getSeconds,
  };
}
