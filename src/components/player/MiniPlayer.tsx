import React, { useState } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  X,
  Volume2,
  VolumeX,
  AlertCircle,
  Loader2,
  Maximize2,
  Clock,
} from 'lucide-react';
import { useAudioPlayer, useAudioProgress } from '../../context/AudioPlayerContext';
import { getCoverImageUrl } from '../../lib/supabase';
import { formatDuration } from '../../lib/utils';

export const MiniPlayer: React.FC = () => {
  const {
    currentEpisode,
    currentSeries,
    isPlaying,
    isLoadingAudio,
    volume,
    isMuted,
    error,
    togglePlay,
    seek,
    setVolume,
    toggleMute,
    closePlayer,
    openFullPlayer,
    playNext,
    playPrevious,
    hasNext,
    hasPrevious,
    sleepTimerSecondsRemaining,
    sleepTimerMode,
  } = useAudioPlayer();

  const { currentTime, duration, progressPercent } = useAudioProgress();

  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

  if (!currentEpisode) return null;

  const coverUrl = getCoverImageUrl(currentSeries?.cover_image);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    seek((val / 100) * duration);
  };

  return (
    <div className="fixed bottom-14 md:bottom-0 left-0 right-0 z-40 bg-[#FAFAF8]/95 dark:bg-[#101713]/95 backdrop-blur-md border-t border-[#E6E7E2] dark:border-[#233128] transition-all">
      {/* Interactive audio scrubber on top of player */}
      <div className="relative w-full h-1 group cursor-pointer bg-[#E6E7E2] dark:bg-[#233128]">
        <div
          className="absolute left-0 top-0 bottom-0 bg-[#176B50] dark:bg-[#48A783] transition-all duration-100"
          style={{ width: `${progressPercent}%` }}
        />
        <input
          type="range"
          min="0"
          max="100"
          step="0.1"
          value={progressPercent || 0}
          onChange={handleSeek}
          className="absolute inset-0 w-full opacity-0 cursor-pointer h-8 -top-3.5"
          aria-label="অডিও স্ক্রাবার"
        />
      </div>

      {error && (
        <div className="bg-red-500/10 border-b border-red-500/20 px-4 py-1 text-xs text-red-600 dark:text-red-400 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5" />
            <span>{error}</span>
          </div>
        </div>
      )}

      <div className="max-w-page mx-auto px-4 sm:px-8 lg:px-12 py-2 flex items-center justify-between gap-3">
        {/* Left: Cover thumbnail + Track info (clickable to open Full Player) */}
        <div
          className="flex items-center gap-3 min-w-0 flex-1 sm:max-w-xs md:max-w-sm cursor-pointer group"
          onClick={openFullPlayer}
          title="ফুল প্লেয়ার খুলুন"
        >
          <div className="relative h-10 w-10 shrink-0 rounded-lg overflow-hidden bg-[#F0F1ED] dark:bg-[#19231D]">
            <img
              src={coverUrl}
              alt={currentEpisode.title}
              onError={(e) => {
                e.currentTarget.src = '/cover-placeholder.svg';
              }}
              className="h-full w-full object-cover group-hover:scale-105 transition-transform"
            />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium text-[#171A18] dark:text-[#F3F4EF] truncate block group-hover:text-[#176B50] dark:group-hover:text-[#48A783] transition-colors">
                {currentEpisode.title}
              </span>
            </div>
            {currentSeries && (
              <span className="text-xs text-[#777C77] dark:text-[#A4ADA6] truncate block">
                {currentSeries.title}
              </span>
            )}
          </div>
        </div>

        {/* Center: Controls (Prev, Play/Pause, Next) + Timer */}
        <div className="flex flex-col items-center gap-0.5">
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Previous */}
            <button
              type="button"
              onClick={playPrevious}
              disabled={!hasPrevious}
              className="p-1.5 text-[#777C77] dark:text-[#A4ADA6] hover:text-[#171A18] dark:hover:text-[#F3F4EF] disabled:opacity-30 disabled:pointer-events-none transition-colors"
              title="পূর্ববর্তী পর্ব"
              aria-label="পূর্ববর্তী পর্ব"
            >
              <SkipBack className="h-4 w-4 fill-current" />
            </button>

            {/* Play/Pause */}
            <button
              type="button"
              onClick={togglePlay}
              disabled={isLoadingAudio}
              className="h-8 w-8 rounded-full bg-[#176B50] hover:bg-[#12543E] dark:bg-[#48A783] dark:hover:bg-[#5DB895] text-white dark:text-[#101713] flex items-center justify-center transition-transform active:scale-95"
              aria-label={isPlaying ? 'বিরতি' : 'চালান'}
            >
              {isLoadingAudio ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isPlaying ? (
                <Pause className="h-4 w-4 fill-current" />
              ) : (
                <Play className="h-4 w-4 fill-current ml-0.5" />
              )}
            </button>

            {/* Next */}
            <button
              type="button"
              onClick={playNext}
              disabled={!hasNext}
              className="p-1.5 text-[#777C77] dark:text-[#A4ADA6] hover:text-[#171A18] dark:hover:text-[#F3F4EF] disabled:opacity-30 disabled:pointer-events-none transition-colors"
              title="পরবর্তী পর্ব"
              aria-label="পরবর্তী পর্ব"
            >
              <SkipForward className="h-4 w-4 fill-current" />
            </button>
          </div>

          {/* Time display */}
          <div className="hidden sm:flex items-center gap-1 text-[11px] text-[#777C77] dark:text-[#A4ADA6] tabular-nums font-mono">
            <span>{formatDuration(currentTime)}</span>
            <span>/</span>
            <span>{formatDuration(duration)}</span>
          </div>
        </div>

        {/* Right: Sleep Timer indicator, Volume, Expand & Dismiss */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Active Sleep Timer Pill */}
          {(sleepTimerSecondsRemaining || sleepTimerMode === 'end_of_episode') && (
            <button
              type="button"
              onClick={openFullPlayer}
              className="hidden lg:inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium text-[#176B50] dark:text-[#48A783] bg-[#176B50]/10 dark:bg-[#48A783]/10 tabular-nums font-mono"
              title="স্লিপ টাইমার সক্রিয়"
            >
              <Clock className="h-3 w-3" />
              <span>
                {sleepTimerSecondsRemaining
                  ? formatDuration(sleepTimerSecondsRemaining)
                  : 'পর্বের শেষে'}
              </span>
            </button>
          )}

          {/* Volume control */}
          <div className="relative hidden sm:flex items-center">
            <button
              type="button"
              onClick={toggleMute}
              onMouseEnter={() => setShowVolumeSlider(true)}
              className="p-1.5 text-[#777C77] dark:text-[#A4ADA6] hover:text-[#171A18] dark:hover:text-[#F3F4EF] transition-colors"
              aria-label="সাউন্ড কন্ট্রোল"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </button>

            {showVolumeSlider && (
              <div
                onMouseLeave={() => setShowVolumeSlider(false)}
                className="absolute bottom-8 right-0 bg-[#FAFAF8] dark:bg-[#101713] p-2.5 rounded-lg border border-[#E6E7E2] dark:border-[#233128] flex items-center z-50"
              >
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="w-20 accent-[#176B50] dark:accent-[#48A783] cursor-pointer"
                  aria-label="সাউন্ড মাত্রা"
                />
              </div>
            )}
          </div>

          {/* Expand Full Player Button */}
          <button
            type="button"
            onClick={openFullPlayer}
            className="p-1.5 rounded-lg text-[#777C77] dark:text-[#A4ADA6] hover:text-[#176B50] dark:hover:text-[#48A783] hover:bg-[#F0F1ED] dark:hover:bg-[#19231D] transition-colors"
            title="ফুল প্লেয়ার খুলুন"
            aria-label="ফুল প্লেয়ার খুলুন"
          >
            <Maximize2 className="h-4 w-4" />
          </button>

          {/* Close miniplayer */}
          <button
            type="button"
            onClick={closePlayer}
            className="p-1.5 rounded-lg text-[#777C77] dark:text-[#A4ADA6] hover:text-[#171A18] dark:hover:text-[#F3F4EF] hover:bg-[#F0F1ED] dark:hover:bg-[#19231D] transition-colors"
            title="প্লেয়ার বন্ধ করুন"
            aria-label="প্লেয়ার বন্ধ করুন"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
