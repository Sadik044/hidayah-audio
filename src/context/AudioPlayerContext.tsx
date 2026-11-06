import React, { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import type { Episode, Series } from '../types/database.types';
import { getEpisodeAudioUrl } from '../lib/supabase';
import {
  updateMediaSessionMetadata,
  updateMediaSessionPlaybackState,
  updateMediaSessionPositionState,
  registerMediaSessionActions,
  clearMediaSession,
} from '../lib/mediaSession';

export interface RecentlyPlayedItem {
  episode: Episode;
  series?: Series | null;
  playedAt: string;
}

export type RepeatMode = 'off' | 'all' | 'one';
export type SleepTimerMode = 'minutes' | 'end_of_episode' | null;

/**
 * Low-frequency audio player state and playback control methods.
 * Components subscribing to this context will NOT re-render on audio timeupdates.
 */
export interface AudioPlayerContextType {
  // Current track state
  currentEpisode: Episode | null;
  currentSeries: Series | null;
  isPlaying: boolean;
  isLoadingAudio: boolean;
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
  seek: (time: number) => Promise<void>;
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

/**
 * High-frequency audio playback progress state (updates ~4 times per second).
 * Only components needing real-time time or scrubbers (e.g. MiniPlayer, FullPlayer) should subscribe to this.
 */
export interface AudioProgressContextType {
  currentTime: number;
  duration: number;
  progressPercent: number;
}

const AudioPlayerContext = createContext<AudioPlayerContextType | undefined>(undefined);
const AudioProgressContext = createContext<AudioProgressContextType>({
  currentTime: 0,
  duration: 0,
  progressPercent: 0,
});

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

  // Ref tracking duration to allow seek clamping without re-creating seek callback
  const durationRef = useRef<number>(0);

  // Signed URL expiry tracker (in timestamp ms)
  const signedUrlExpiresAtRef = useRef<number>(0);

  // Client-side in-memory signed URL cache (episodeId -> { url, expiresAt })
  // Avoids redundant Edge Function requests when replaying recent episodes
  const urlCacheRef = useRef<Map<string, { url: string; expiresAt: number }>>(new Map());

  // Recovery retry lock to prevent infinite retry loops on unrecoverable media errors
  const isRetryingRef = useRef<boolean>(false);
  const isClosingRef = useRef<boolean>(false);

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
  const togglePlayRef = useRef<() => Promise<void> | void>(() => {});
  const playPreviousRef = useRef<() => void>(() => {});
  const seekRef = useRef<(time: number) => Promise<void> | void>(() => {});

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

  // Keep references to state inside event listeners to avoid stale closures
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

  /**
   * Fetches a fresh signed URL from the Edge Function, updates in-memory cache,
   * and records expiration with a 20-second safety cushion.
   */
  const refreshStreamUrl = useCallback(async (episodeId: string): Promise<string> => {
    const res = await getEpisodeAudioUrl(episodeId);
    if (!res.success || !res.data?.signed_url) {
      throw new Error(res.error?.message || 'অডিও স্ট্রিম লিংক নবায়ন করা সম্ভব হয়নি।');
    }
    const expiresAtMs = Date.now() + (res.data.expires_in - 20) * 1000;
    urlCacheRef.current.set(episodeId, { url: res.data.signed_url, expiresAt: expiresAtMs });
    signedUrlExpiresAtRef.current = expiresAtMs;
    return res.data.signed_url;
  }, []);

  // Handle Play Episode
  const playEpisode = useCallback(
    async (episode: Episode, series?: Series | null, newQueue?: Episode[]) => {
      if (!audioRef.current) return;

      isClosingRef.current = false;
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
        const now = Date.now();
        let streamUrl: string | null = null;
        let expiresAtMs = 0;

        // Check in-memory URL cache: reuse if valid for at least 60 more seconds
        const cached = urlCacheRef.current.get(episode.id);
        if (cached && now < cached.expiresAt - 60000) {
          streamUrl = cached.url;
          expiresAtMs = cached.expiresAt;
        } else {
          // Fetch fresh signed URL from the Edge Function
          const res = await getEpisodeAudioUrl(episode.id);
          if (!res.success || !res.data?.signed_url) {
            throw new Error(res.error?.message || 'অডিও স্ট্রিম লিংক প্রস্তুত করা সম্ভব হয়নি।');
          }
          streamUrl = res.data.signed_url;
          expiresAtMs = now + (res.data.expires_in - 20) * 1000;
          urlCacheRef.current.set(episode.id, { url: streamUrl, expiresAt: expiresAtMs });
        }

        signedUrlExpiresAtRef.current = expiresAtMs;

        audioRef.current.src = streamUrl;
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

  playPreviousRef.current = playPrevious;

  // Initialize single shared HTMLAudioElement and attach listeners ONCE
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.defaultPlaybackRate = playbackRateRef.current;
    audio.playbackRate = playbackRateRef.current;
    audio.volume = volumeRef.current;
    audio.muted = isMutedRef.current;
    audioRef.current = audio;

    let lastPositionUpdate = 0;

    const onPlay = () => {
      if (isClosingRef.current || !stateRef.current.currentEpisode) return;
      setIsPlaying(true);
      updateMediaSessionPlaybackState('playing');
      updateMediaSessionPositionState(audio.currentTime, durationRef.current, audio.playbackRate);
    };

    const onPause = () => {
      setIsPlaying(false);
      if (!isClosingRef.current && stateRef.current.currentEpisode) {
        updateMediaSessionPlaybackState('paused');
        updateMediaSessionPositionState(audio.currentTime, durationRef.current, audio.playbackRate);
      } else {
        updateMediaSessionPlaybackState('none');
      }
    };

    const onTimeUpdate = () => {
      if (isClosingRef.current || !stateRef.current.currentEpisode) return;
      setCurrentTime(audio.currentTime);
      const now = Date.now();
      // Periodically sync position state to OS lock screen (~every 4 seconds)
      if (now - lastPositionUpdate > 4000) {
        lastPositionUpdate = now;
        updateMediaSessionPositionState(audio.currentTime, durationRef.current, audio.playbackRate);
      }
    };

    const onLoadedMetadata = () => {
      if (isClosingRef.current || !stateRef.current.currentEpisode) return;
      const d = audio.duration || 0;
      setDuration(d);
      durationRef.current = d;
      audio.playbackRate = playbackRateRef.current;
      updateMediaSessionPositionState(audio.currentTime, d, playbackRateRef.current);
    };

    const onRateChange = () => {
      if (isClosingRef.current || !stateRef.current.currentEpisode) return;
      updateMediaSessionPositionState(audio.currentTime, durationRef.current, audio.playbackRate);
    };

    const onSeeked = () => {
      if (isClosingRef.current || !stateRef.current.currentEpisode) return;
      updateMediaSessionPositionState(audio.currentTime, durationRef.current, audio.playbackRate);
    };

    const onEnded = () => {
      if (isClosingRef.current || !stateRef.current.currentEpisode) return;
      const { repeatMode: rMode, sleepTimerMode: sMode } = stateRef.current;

      // 1. Check if sleep timer is set to "end_of_episode"
      if (sMode === 'end_of_episode') {
        setIsPlaying(false);
        setCurrentTime(0);
        setSleepTimerMode(null);
        setSleepTimerMinutes(null);
        setSleepTimerSecondsRemaining(null);
        updateMediaSessionPlaybackState('paused');
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
        updateMediaSessionPlaybackState('paused');
      }
    };

    const onError = async () => {
      if (isClosingRef.current || !stateRef.current.currentEpisode) return;
      const { currentEpisode } = stateRef.current;

      // Automated URL recovery retry if URL expired or experienced a transient network glitch
      if (currentEpisode && !isRetryingRef.current && signedUrlExpiresAtRef.current > 0) {
        isRetryingRef.current = true;
        try {
          setIsLoadingAudio(true);
          const freshUrl = await refreshStreamUrl(currentEpisode.id);
          const resumeTime = audio.currentTime;
          audio.src = freshUrl;
          audio.currentTime = resumeTime;
          await audio.play();
          setIsPlaying(true);
          setError(null);
          isRetryingRef.current = false;
          return;
        } catch (retryErr) {
          console.error('Audio auto-recovery retry failed:', retryErr);
        } finally {
          setIsLoadingAudio(false);
          isRetryingRef.current = false;
        }
      }

      setIsLoadingAudio(false);
      setIsPlaying(false);
      updateMediaSessionPlaybackState('paused');
      setError('অডিও লোড করতে সমস্যা হয়েছে। পুনরায় চেষ্টা করুন।');
    };

    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ratechange', onRateChange);
    audio.addEventListener('seeked', onSeeked);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.pause();
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ratechange', onRateChange);
      audio.removeEventListener('seeked', onSeeked);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      clearMediaSession();
    };
  }, [refreshStreamUrl]);

  // Sleep Timer countdown interval (runs once per second when active)
  useEffect(() => {
    if (sleepTimerMode !== 'minutes' || sleepTimerSecondsRemaining === null) return;

    if (sleepTimerSecondsRemaining <= 0) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setIsPlaying(false);
      setSleepTimerMode(null);
      setSleepTimerMinutes(null);
      setSleepTimerSecondsRemaining(null);
      return;
    }

    const interval = setInterval(() => {
      setSleepTimerSecondsRemaining((prev) => {
        if (prev === null || prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [sleepTimerMode, sleepTimerSecondsRemaining]);

  // Refresh signed URL if expired when toggling play
  const togglePlay = useCallback(async () => {
    if (!audioRef.current || !stateRef.current.currentEpisode) return;

    if (stateRef.current.isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      // Check if signed URL has expired or is expiring within 15 seconds
      const isExpired = signedUrlExpiresAtRef.current > 0 && Date.now() > signedUrlExpiresAtRef.current - 15000;
      if (isExpired) {
        try {
          setIsLoadingAudio(true);
          const freshUrl = await refreshStreamUrl(stateRef.current.currentEpisode.id);
          const resumeTime = audioRef.current.currentTime;
          audioRef.current.src = freshUrl;
          audioRef.current.currentTime = resumeTime;
          audioRef.current.defaultPlaybackRate = playbackRateRef.current;
          audioRef.current.playbackRate = playbackRateRef.current;
          audioRef.current.volume = volumeRef.current;
          audioRef.current.muted = isMutedRef.current;
        } catch (e) {
          console.warn('URL refresh warning:', e);
        } finally {
          setIsLoadingAudio(false);
        }
      }

      try {
        await audioRef.current.play();
        setIsPlaying(true);
      } catch (err) {
        console.error('Play resumed error:', err);
        setIsPlaying(false);
      }
    }
  }, [refreshStreamUrl]);

  togglePlayRef.current = togglePlay;

  /**
   * Seeks to a specific timestamp in the audio track.
   * If the signed URL has expired or is expiring within 15s, seamlessly
   * fetches a fresh signed URL before seeking to avoid HTTP 403 range-request failures.
   */
  const seek = useCallback(async (time: number) => {
    if (!audioRef.current || !stateRef.current.currentEpisode) return;
    const clamped = Math.max(0, Math.min(time, durationRef.current || Infinity));

    const isExpired = signedUrlExpiresAtRef.current > 0 && Date.now() > signedUrlExpiresAtRef.current - 15000;
    if (isExpired) {
      try {
        setIsLoadingAudio(true);
        const freshUrl = await refreshStreamUrl(stateRef.current.currentEpisode.id);
        audioRef.current.src = freshUrl;
        audioRef.current.currentTime = clamped;
        setCurrentTime(clamped);
        updateMediaSessionPositionState(clamped, durationRef.current, audioRef.current.playbackRate);
        if (stateRef.current.isPlaying) {
          await audioRef.current.play();
        }
      } catch (err) {
        console.error('Seek URL refresh error:', err);
        setError('অডিও লিংক মেয়াদোত্তীর্ণ হয়েছে। পুনরায় লোড করতে ব্যর্থ হয়েছে।');
      } finally {
        setIsLoadingAudio(false);
      }
    } else {
      audioRef.current.currentTime = clamped;
      setCurrentTime(clamped);
      updateMediaSessionPositionState(clamped, durationRef.current, audioRef.current.playbackRate);
    }
  }, [refreshStreamUrl]);

  seekRef.current = seek;

  // Synchronize MediaSession metadata & playbackState
  useEffect(() => {
    if (!currentEpisode || isClosingRef.current) {
      updateMediaSessionMetadata(null);
      updateMediaSessionPlaybackState('none');
      return;
    }

    const effectiveSeries = currentSeries || currentEpisode.series;
    const artist =
      (currentEpisode as any).speaker ||
      (effectiveSeries as any)?.speaker ||
      effectiveSeries?.category?.name ||
      'হিদায়াহ অডিও';

    updateMediaSessionMetadata({
      title: currentEpisode.title,
      artist,
      album: effectiveSeries?.title || 'হিদায়াহ অডিও',
      coverImage: effectiveSeries?.cover_image,
    });

    updateMediaSessionPlaybackState(isPlaying ? 'playing' : 'paused');

    if (currentEpisode.duration && currentEpisode.duration > 0 && durationRef.current === 0) {
      durationRef.current = currentEpisode.duration;
      updateMediaSessionPositionState(0, currentEpisode.duration, playbackRateRef.current);
    }
  }, [currentEpisode, currentSeries, isPlaying]);

  // Register MediaSession action handlers (play, pause, next, previous, seek)
  useEffect(() => {
    if (!currentEpisode) {
      registerMediaSessionActions(null);
      return;
    }

    registerMediaSessionActions({
      onPlay: () => {
        if (audioRef.current?.paused) {
          togglePlayRef.current();
        }
      },
      onPause: () => {
        if (audioRef.current && !audioRef.current.paused) {
          audioRef.current.pause();
          setIsPlaying(false);
        }
      },
      onPreviousTrack: () => playPreviousRef.current(),
      onNextTrack: () => playNextRef.current(),
      onSeekBackward: (offset) => {
        if (audioRef.current) {
          const target = Math.max(0, audioRef.current.currentTime - offset);
          seekRef.current(target);
        }
      },
      onSeekForward: (offset) => {
        if (audioRef.current) {
          const target = Math.min(durationRef.current || Infinity, audioRef.current.currentTime + offset);
          seekRef.current(target);
        }
      },
      onSeekTo: (position) => {
        seekRef.current(position);
      },
    });

    return () => {
      registerMediaSessionActions(null);
    };
  }, [currentEpisode, queueIndex, queue.length, repeatMode]);

  const setVolume = useCallback((val: number) => {
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
  }, []);

  const toggleMute = useCallback(() => {
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
  }, []);

  const setPlaybackRate = useCallback((rate: number) => {
    playbackRateRef.current = rate;
    setPlaybackRateState(rate);

    if (audioRef.current) {
      audioRef.current.defaultPlaybackRate = rate;
      audioRef.current.playbackRate = rate;
    }
  }, []);

  const toggleRepeat = useCallback(() => {
    setRepeatMode((prev) => {
      if (prev === 'off') return 'all';
      if (prev === 'all') return 'one';
      return 'off';
    });
  }, []);

  const cancelSleepTimer = useCallback(() => {
    setSleepTimerMode(null);
    setSleepTimerMinutes(null);
    setSleepTimerSecondsRemaining(null);
  }, []);

  const setSleepTimer = useCallback((value: number | 'end_of_episode' | null) => {
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
  }, [cancelSleepTimer]);

  const setQueue = useCallback((episodesList: Episode[], startIndex = 0, series?: Series | null) => {
    setQueueState(episodesList);
    setQueueIndex(startIndex);
    if (episodesList[startIndex]) {
      playEpisodeRef.current(episodesList[startIndex], series || episodesList[startIndex].series || stateRef.current.currentSeries, episodesList);
    }
  }, []);

  const closePlayer = useCallback(() => {
    isClosingRef.current = true;
    stateRef.current.currentEpisode = null;
    stateRef.current.currentSeries = null;
    stateRef.current.isPlaying = false;
    clearMediaSession();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute('src');
      audioRef.current.load();
    }
    setCurrentEpisode(null);
    setCurrentSeries(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    durationRef.current = 0;
    setError(null);
    cancelSleepTimer();
    setIsFullPlayerOpen(false);
  }, [cancelSleepTimer]);

  const toggleFavorite = useCallback((episodeId: string) => {
    setFavorites((prev) => {
      const exists = prev.includes(episodeId);
      const next = exists ? prev.filter((id) => id !== episodeId) : [...prev, episodeId];
      try {
        localStorage.setItem('hidayah_favorites', JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }, []);

  const isFavorite = useCallback((episodeId: string) => favorites.includes(episodeId), [favorites]);

  const openFullPlayer = useCallback(() => setIsFullPlayerOpen(true), []);
  const closeFullPlayer = useCallback(() => setIsFullPlayerOpen(false), []);

  const hasNext = queueIndex >= 0 && queueIndex < queue.length - 1;
  const hasPrevious = queueIndex > 0 || (audioRef.current ? audioRef.current.currentTime > 3 : false);

  // Memoized low-frequency player context value
  // Does NOT contain currentTime or duration, preventing 4Hz re-render storm in page components
  const playerValue = useMemo<AudioPlayerContextType>(() => ({
    currentEpisode,
    currentSeries,
    isPlaying,
    isLoadingAudio,
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
    openFullPlayer,
    closeFullPlayer,

    favorites,
    toggleFavorite,
    isFavorite,
    recentlyPlayed,
  }), [
    currentEpisode,
    currentSeries,
    isPlaying,
    isLoadingAudio,
    volume,
    isMuted,
    playbackRate,
    repeatMode,
    error,
    queue,
    queueIndex,
    hasNext,
    hasPrevious,
    setQueue,
    playNext,
    playPrevious,
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
    openFullPlayer,
    closeFullPlayer,
    favorites,
    toggleFavorite,
    isFavorite,
    recentlyPlayed,
  ]);

  // Memoized high-frequency progress context value
  // Only consumed by MiniPlayer and FullPlayer scrubbers
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const progressValue = useMemo<AudioProgressContextType>(() => ({
    currentTime,
    duration,
    progressPercent,
  }), [currentTime, duration, progressPercent]);

  return (
    <AudioPlayerContext.Provider value={playerValue}>
      <AudioProgressContext.Provider value={progressValue}>
        {children}
      </AudioProgressContext.Provider>
    </AudioPlayerContext.Provider>
  );
};

/**
 * Access low-frequency player state and playback controls.
 * Will NOT re-render on audio playback timeupdate ticks.
 */
export const useAudioPlayer = (): AudioPlayerContextType => {
  const context = useContext(AudioPlayerContext);
  if (!context) {
    throw new Error('useAudioPlayer must be used within an AudioPlayerProvider');
  }
  return context;
};

/**
 * Access high-frequency audio progress (currentTime, duration, progressPercent).
 * Only subscribe in scrubber or timer components where real-time progress is needed.
 */
export const useAudioProgress = (): AudioProgressContextType => {
  return useContext(AudioProgressContext);
};
