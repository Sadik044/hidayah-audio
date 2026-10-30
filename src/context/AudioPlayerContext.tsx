import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import type { Episode, Series } from '../types/database.types';
import { getEpisodeAudioUrl } from '../lib/supabase';

export interface RecentlyPlayedItem {
  episode: Episode;
  series?: Series | null;
  playedAt: string;
}

export type RepeatMode = 'off' | 'all' | 'one';
export type SleepTimerMode = 'minutes' | 'end_of_episode' | null;

interface AudioPlayerContextType {
  // Current track state
  currentEpisode: Episode | null;
  currentSeries: Series | null;
  isPlaying: boolean;
  isLoadingAudio: boolean;
  duration: number;
  currentTime: number;
  volume: number;
  isMuted: boolean;
  playbackRate: number;
  repeatMode: RepeatMode;
  error: string | null;

  // Queue & Navigation
  queue: Episode[];
  queueIndex: number;
  setQueue: (episodes: Episode[], startIndex?: number, series?: Series | null) => void;
  playNext: () => void;
  playPrevious: () => void;
  hasNext: boolean;
  hasPrevious: boolean;

  // Actions
  playEpisode: (episode: Episode, series?: Series | null, newQueue?: Episode[]) => Promise<void>;
  togglePlay: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  setPlaybackRate: (rate: number) => void;
  toggleRepeat: () => void;
  closePlayer: () => void;

  // Sleep Timer
  sleepTimerMode: SleepTimerMode;
  sleepTimerMinutes: number | null;
  sleepTimerSecondsRemaining: number | null;
  setSleepTimer: (minutes: number | 'end_of_episode' | null) => void;
  cancelSleepTimer: () => void;

  // Full Player Modal
  isFullPlayerOpen: boolean;
  openFullPlayer: () => void;
  closeFullPlayer: () => void;

  // Persistence (Favorites & History)
  favorites: string[];
  toggleFavorite: (episodeId: string) => void;
  isFavorite: (episodeId: string) => boolean;
  recentlyPlayed: RecentlyPlayedItem[];
}

const AudioPlayerContext = createContext<AudioPlayerContextType | undefined>(undefined);

export const AudioPlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Current Playing Track & Series
  const [currentEpisode, setCurrentEpisode] = useState<Episode | null>(null);
  const [currentSeries, setCurrentSeries] = useState<Series | null>(null);

  // Queue state
  const [queue, setQueueState] = useState<Episode[]>([]);
  const [queueIndex, setQueueIndex] = useState<number>(-1);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolumeState] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRateState] = useState(1);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  const [error, setError] = useState<string | null>(null);

  // Full Player Modal visibility
  const [isFullPlayerOpen, setIsFullPlayerOpen] = useState(false);

  // Signed URL expiry tracker (in timestamp ms)
  const signedUrlExpiresAtRef = useRef<number>(0);

  // Sleep Timer state
  const [sleepTimerMode, setSleepTimerMode] = useState<SleepTimerMode>(null);
  const [sleepTimerMinutes, setSleepTimerMinutes] = useState<number | null>(null);
  const [sleepTimerSecondsRemaining, setSleepTimerSecondsRemaining] = useState<number | null>(null);

  // Single shared HTMLAudioElement reference
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Audio property refs to avoid tearing down audio instance on state updates
  const playbackRateRef = useRef<number>(1);
  const volumeRef = useRef<number>(1);
  const isMutedRef = useRef<boolean>(false);
  const lastNonZeroVolumeRef = useRef<number>(1);

  // Function refs so listeners can invoke latest callbacks without causing re-subscriptions
  const playEpisodeRef = useRef<(episode: Episode, series?: Series | null, newQueue?: Episode[]) => Promise<void>>(async () => {});
  const playNextRef = useRef<() => void>(() => {});

  // Saved favorites
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('hidayah_favorites');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Recently played history
  const [recentlyPlayed, setRecentlyPlayed] = useState<RecentlyPlayedItem[]>(() => {
    try {
      const stored = localStorage.getItem('hidayah_recently_played');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Keep references to state inside event listeners
  const stateRef = useRef({
    currentEpisode,
    currentSeries,
    queue,
    queueIndex,
    repeatMode,
    sleepTimerMode,
    isPlaying,
    playbackRate,
    volume,
    isMuted,
  });

  useEffect(() => {
    stateRef.current = {
      currentEpisode,
      currentSeries,
      queue,
      queueIndex,
      repeatMode,
      sleepTimerMode,
      isPlaying,
      playbackRate,
      volume,
      isMuted,
    };
  }, [currentEpisode, currentSeries, queue, queueIndex, repeatMode, sleepTimerMode, isPlaying, playbackRate, volume, isMuted]);

  // Handle Play Episode
  const playEpisode = useCallback(
    async (episode: Episode, series?: Series | null, newQueue?: Episode[]) => {
      if (!audioRef.current) return;

      setError(null);
      setCurrentEpisode(episode);
      const effectiveSeries = series || episode.series || null;
      setCurrentSeries(effectiveSeries);
      setIsLoadingAudio(true);

      // Handle queue assignment
      if (newQueue && newQueue.length > 0) {
        setQueueState(newQueue);
        const idx = newQueue.findIndex((ep) => ep.id === episode.id);
        setQueueIndex(idx !== -1 ? idx : 0);
      } else {
        setQueueState((prevQueue) => {
          const existingIdx = prevQueue.findIndex((ep) => ep.id === episode.id);
          if (existingIdx !== -1) {
            setQueueIndex(existingIdx);
            return prevQueue;
          }
          // If queue doesn't contain this episode, start a queue with this single episode
          setQueueIndex(0);
          return [episode];
        });
      }

      // Record in Recently Played (deduplicated, newest first)
      setRecentlyPlayed((prev) => {
        const filtered = prev.filter((item) => item.episode.id !== episode.id);
        const updated = [
          { episode, series: effectiveSeries, playedAt: new Date().toISOString() },
          ...filtered,
        ].slice(0, 40);
        try {
          localStorage.setItem('hidayah_recently_played', JSON.stringify(updated));
        } catch {
          // ignore storage quota errors
        }
        return updated;
      });

      try {
        // Fetch temporary signed URL from the Edge Function
        const res = await getEpisodeAudioUrl(episode.id);

        if (!res.success || !res.data?.signed_url) {
          throw new Error(res.error?.message || 'অডিও স্ট্রিম লিংক প্রস্তুত করা সম্ভব হয়নি।');
        }

        // Expiry timestamp (expires_in is in seconds, e.g. 300)
        signedUrlExpiresAtRef.current = Date.now() + (res.data.expires_in - 20) * 1000;

        audioRef.current.src = res.data.signed_url;
        audioRef.current.defaultPlaybackRate = playbackRateRef.current;
        audioRef.current.playbackRate = playbackRateRef.current;
        audioRef.current.volume = volumeRef.current;
        audioRef.current.muted = isMutedRef.current;

        await audioRef.current.play();
        setIsPlaying(true);
      } catch (err) {
        console.error('Audio playback error:', err);
        setError(err instanceof Error ? err.message : 'অডিও চালানো সম্ভব হচ্ছে না।');
        setIsPlaying(false);
      } finally {
        setIsLoadingAudio(false);
      }
    },
    []
  );

  playEpisodeRef.current = playEpisode;

  // Play next episode in queue
  const playNext = useCallback(() => {
    const { queue: q, queueIndex: idx, currentSeries: s, repeatMode: rMode } = stateRef.current;
    if (q.length === 0) return;

    if (idx < q.length - 1) {
      const nextEp = q[idx + 1];
      setQueueIndex(idx + 1);
      playEpisodeRef.current(nextEp, s);
    } else if (rMode === 'all') {
      // Loop to beginning
      const firstEp = q[0];
      setQueueIndex(0);
      playEpisodeRef.current(firstEp, s);
    }
  }, []);

  playNextRef.current = playNext;

  // Play previous episode in queue
  const playPrevious = useCallback(() => {
    const { queue: q, queueIndex: idx, currentSeries: s } = stateRef.current;
    if (q.length === 0) return;

    // If audio has progressed more than 3 seconds, replay current episode from start
    if (audioRef.current && audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      setCurrentTime(0);
      return;
    }

    if (idx > 0) {
      const prevEp = q[idx - 1];
      setQueueIndex(idx - 1);
      playEpisodeRef.current(prevEp, s);
    } else {
      // Replay first episode from beginning
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        setCurrentTime(0);
      }
    }
  }, []);

  // Initialize single shared HTMLAudioElement and attach listeners ONCE
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.defaultPlaybackRate = playbackRateRef.current;
    audio.playbackRate = playbackRateRef.current;
    audio.volume = volumeRef.current;
    audio.muted = isMutedRef.current;
    audioRef.current = audio;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => {
      setDuration(audio.duration || 0);
      audio.playbackRate = playbackRateRef.current;
    };

    const onEnded = () => {
      const { repeatMode: rMode, sleepTimerMode: sMode } = stateRef.current;

      // 1. Check if sleep timer is set to "end_of_episode"
      if (sMode === 'end_of_episode') {
        setIsPlaying(false);
        setCurrentTime(0);
        setSleepTimerMode(null);
        setSleepTimerMinutes(null);
        setSleepTimerSecondsRemaining(null);
        return;
      }

      // 2. Check repeat mode 'one'
      if (rMode === 'one') {
        audio.currentTime = 0;
        audio.play().catch(console.error);
        return;
      }

      // 3. Otherwise try to play next in queue
      const { queue: q, queueIndex: idx } = stateRef.current;
      if (idx < q.length - 1 || rMode === 'all') {
        playNextRef.current();
      } else {
        setIsPlaying(false);
        setCurrentTime(0);
      }
    };

    const onError = () => {
      setIsLoadingAudio(false);
      setIsPlaying(false);
      setError('অডিও লোড করতে সমস্যা হয়েছে। পুনরায় চেষ্টা করুন।');
    };

    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.pause();
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
  }, []);

  // Sleep Timer countdown interval
  useEffect(() => {
    if (sleepTimerMode !== 'minutes' || !sleepTimerSecondsRemaining) return;

    const interval = setInterval(() => {
      setSleepTimerSecondsRemaining((prev) => {
        if (!prev || prev <= 1) {
          // Timer finished: stop playback!
          if (audioRef.current) {
            audioRef.current.pause();
          }
          setIsPlaying(false);
          setSleepTimerMode(null);
          setSleepTimerMinutes(null);
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [sleepTimerMode, sleepTimerSecondsRemaining]);

  // Refresh signed URL if expired when toggling play
  const togglePlay = async () => {
    if (!audioRef.current || !currentEpisode) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      // Check if signed URL has expired
      if (Date.now() > signedUrlExpiresAtRef.current && signedUrlExpiresAtRef.current > 0) {
        try {
          setIsLoadingAudio(true);
          const res = await getEpisodeAudioUrl(currentEpisode.id);
          if (res.success && res.data?.signed_url) {
            const resumeTime = audioRef.current.currentTime;
            signedUrlExpiresAtRef.current = Date.now() + (res.data.expires_in - 20) * 1000;
            audioRef.current.src = res.data.signed_url;
            audioRef.current.currentTime = resumeTime;
            audioRef.current.defaultPlaybackRate = playbackRateRef.current;
            audioRef.current.playbackRate = playbackRateRef.current;
            audioRef.current.volume = volumeRef.current;
            audioRef.current.muted = isMutedRef.current;
          }
        } catch (e) {
          console.warn('URL refresh warning:', e);
        } finally {
          setIsLoadingAudio(false);
        }
      }

      audioRef.current.play().catch((err) => {
        console.error('Play resumed error:', err);
      });
    }
  };

  const seek = (time: number) => {
    if (!audioRef.current) return;
    const clamped = Math.max(0, Math.min(time, duration || Infinity));
    audioRef.current.currentTime = clamped;
    setCurrentTime(clamped);
  };

  const setVolume = (val: number) => {
    const clamped = Math.max(0, Math.min(1, val));
    volumeRef.current = clamped;
    setVolumeState(clamped);

    if (audioRef.current) {
      audioRef.current.volume = clamped;
    }

    if (clamped === 0) {
      isMutedRef.current = true;
      setIsMuted(true);
      if (audioRef.current) {
        audioRef.current.muted = true;
      }
    } else {
      lastNonZeroVolumeRef.current = clamped;
      if (isMutedRef.current) {
        isMutedRef.current = false;
        setIsMuted(false);
        if (audioRef.current) {
          audioRef.current.muted = false;
        }
      }
    }
  };

  const toggleMute = () => {
    const willBeMuted = !isMutedRef.current;

    if (willBeMuted) {
      isMutedRef.current = true;
      setIsMuted(true);
      if (audioRef.current) {
        audioRef.current.muted = true;
      }
    } else {
      isMutedRef.current = false;
      setIsMuted(false);
      if (audioRef.current) {
        audioRef.current.muted = false;
      }

      // If volume was 0 when unmuting, restore to last non-zero volume
      if (volumeRef.current === 0) {
        const restored = lastNonZeroVolumeRef.current || 0.5;
        volumeRef.current = restored;
        setVolumeState(restored);
        if (audioRef.current) {
          audioRef.current.volume = restored;
        }
      }
    }
  };

  const setPlaybackRate = (rate: number) => {
    playbackRateRef.current = rate;
    setPlaybackRateState(rate);

    if (audioRef.current) {
      audioRef.current.defaultPlaybackRate = rate;
      audioRef.current.playbackRate = rate;
    }
  };

  const toggleRepeat = () => {
    setRepeatMode((prev) => {
      if (prev === 'off') return 'all';
      if (prev === 'all') return 'one';
      return 'off';
    });
  };

  const setSleepTimer = (value: number | 'end_of_episode' | null) => {
    if (value === null) {
      cancelSleepTimer();
      return;
    }
    if (value === 'end_of_episode') {
      setSleepTimerMode('end_of_episode');
      setSleepTimerMinutes(null);
      setSleepTimerSecondsRemaining(null);
    } else {
      setSleepTimerMode('minutes');
      setSleepTimerMinutes(value);
      setSleepTimerSecondsRemaining(value * 60);
    }
  };

  const cancelSleepTimer = () => {
    setSleepTimerMode(null);
    setSleepTimerMinutes(null);
    setSleepTimerSecondsRemaining(null);
  };

  const setQueue = (episodesList: Episode[], startIndex = 0, series?: Series | null) => {
    setQueueState(episodesList);
    setQueueIndex(startIndex);
    if (episodesList[startIndex]) {
      playEpisode(episodesList[startIndex], series || episodesList[startIndex].series || currentSeries, episodesList);
    }
  };

  const closePlayer = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    setCurrentEpisode(null);
    setCurrentSeries(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setError(null);
    cancelSleepTimer();
    setIsFullPlayerOpen(false);
  };

  const toggleFavorite = (episodeId: string) => {
    setFavorites((prev) => {
      const exists = prev.includes(episodeId);
      const next = exists ? prev.filter((id) => id !== episodeId) : [...prev, episodeId];
      try {
        localStorage.setItem('hidayah_favorites', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const isFavorite = (episodeId: string) => favorites.includes(episodeId);

  const hasNext = queueIndex >= 0 && queueIndex < queue.length - 1;
  const hasPrevious = queueIndex > 0 || (audioRef.current ? audioRef.current.currentTime > 3 : false);

  return (
    <AudioPlayerContext.Provider
      value={{
        currentEpisode,
        currentSeries,
        isPlaying,
        isLoadingAudio,
        duration,
        currentTime,
        volume,
        isMuted,
        playbackRate,
        repeatMode,
        error,

        queue,
        queueIndex,
        setQueue,
        playNext,
        playPrevious,
        hasNext,
        hasPrevious,

        playEpisode,
        togglePlay,
        seek,
        setVolume,
        toggleMute,
        setPlaybackRate,
        toggleRepeat,
        closePlayer,

        sleepTimerMode,
        sleepTimerMinutes,
        sleepTimerSecondsRemaining,
        setSleepTimer,
        cancelSleepTimer,

        isFullPlayerOpen,
        openFullPlayer: () => setIsFullPlayerOpen(true),
        closeFullPlayer: () => setIsFullPlayerOpen(false),

        favorites,
        toggleFavorite,
        isFavorite,
        recentlyPlayed,
      }}
    >
      {children}
    </AudioPlayerContext.Provider>
  );
};

export const useAudioPlayer = (): AudioPlayerContextType => {
  const context = useContext(AudioPlayerContext);
  if (!context) {
    throw new Error('useAudioPlayer must be used within an AudioPlayerProvider');
  }
  return context;
};
