import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronDown,
  Bookmark,
  BookmarkCheck,
  Repeat,
  Repeat1,
  Clock,
  Gauge,
  ListMusic,
  X,
  AlertCircle,
  Loader2,
  MoreVertical,
} from 'lucide-react';
import { useAudioPlayer } from '../../context/AudioPlayerContext';
import { getCoverImageUrl } from '../../lib/supabase';
import { formatDuration, toBengaliNumber } from '../../lib/utils';

export const FullPlayer: React.FC = () => {
  const {
    currentEpisode,
    currentSeries,
    isPlaying,
    isLoadingAudio,
    duration,
    currentTime,
    playbackRate,
    repeatMode,
    error,
    queue,
    playNext,
    playPrevious,
    hasNext,
    hasPrevious,
    togglePlay,
    seek,
    setPlaybackRate,
    toggleRepeat,
    sleepTimerMode,
    sleepTimerMinutes,
    sleepTimerSecondsRemaining,
    setSleepTimer,
    cancelSleepTimer,
    isFullPlayerOpen,
    closeFullPlayer,
    favorites,
    toggleFavorite,
    playEpisode,
  } = useAudioPlayer();

  // Sub-panel views inside full player
  const [showQueue, setShowQueue] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  // Dragging seekbar state
  const [isDragging, setIsDragging] = useState(false);
  const [dragTime, setDragTime] = useState(0);

  // Close drawers or player on Escape key press, space to toggle play
  useEffect(() => {
    if (!isFullPlayerOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showQueue || showMenu) {
          setShowQueue(false);
          setShowMenu(false);
        } else {
          closeFullPlayer();
        }
      } else if (e.code === 'Space' && (e.target as HTMLElement)?.tagName !== 'INPUT') {
        e.preventDefault();
        togglePlay();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullPlayerOpen, showQueue, showMenu, closeFullPlayer, togglePlay]);

  if (!isFullPlayerOpen || !currentEpisode) return null;

  const isFav = favorites.includes(currentEpisode.id);
  const effectiveTime = isDragging ? dragTime : currentTime;
  const progressPercent = duration > 0 ? (effectiveTime / duration) * 100 : 0;

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    const targetTime = (val / 100) * duration;
    setDragTime(targetTime);
  };

  const handleSeekStart = () => {
    setIsDragging(true);
    setDragTime(currentTime);
  };

  const handleSeekEnd = () => {
    setIsDragging(false);
    seek(dragTime);
  };

  const speedOptions = [0.5, 0.75, 1, 1.25, 1.5, 2];
  const timerOptions = [5, 10, 15, 30, 45, 60];

  // Resolve dynamic cover URL from series
  const rawCover = currentSeries?.cover_image || currentEpisode.series?.cover_image;
  const coverUrl = getCoverImageUrl(rawCover);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-950 text-white select-none animate-in fade-in duration-300">
      {/* 1. Dynamic Ambient Blurred Background derived from actual cover */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none select-none z-0">
        <img
          src={coverUrl}
          alt=""
          aria-hidden="true"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = '/cover-placeholder.svg';
          }}
          className="w-full h-full object-cover scale-150 blur-3xl opacity-35 filter brightness-75 contrast-125 transform-gpu"
        />
        {/* Dark overlay & subtle emerald gradient for depth and readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/85 via-stone-950/80 to-emerald-950/95" />
        <div className="absolute inset-0 bg-black/40 backdrop-blur-3xl" />
      </div>

      {/* 2. Scrollable Content Wrapper */}
      <div className="relative z-10 w-full max-w-lg md:max-w-xl mx-auto min-h-full px-5 sm:px-6 py-4 sm:py-6 flex flex-col justify-between gap-5 sm:gap-6">
        {/* Step 1: Top Navigation Bar */}
        <header className="w-full flex items-center justify-between pb-1">
          <button
            type="button"
            onClick={() => {
              setShowQueue(false);
              setShowMenu(false);
              closeFullPlayer();
            }}
            className="p-2.5 rounded-full text-stone-300 hover:text-white hover:bg-white/10 active:scale-95 transition-all"
            title="মিনিমাইজ করুন"
            aria-label="মিনিমাইজ করুন"
          >
            <ChevronDown className="h-6 w-6" />
          </button>

          <div className="flex flex-col items-center text-center min-w-0 px-2">
            <span className="text-[11px] font-medium tracking-widest text-stone-400 uppercase">
              এখন বাজছে
            </span>
            {currentSeries && (
              <Link
                to={`/series/${currentSeries.id}`}
                onClick={closeFullPlayer}
                className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 truncate max-w-[200px] sm:max-w-xs transition-colors"
              >
                {currentSeries.title}
              </Link>
            )}
          </div>

          <button
            type="button"
            onClick={() => toggleFavorite(currentEpisode.id)}
            className="p-2.5 rounded-full text-stone-300 hover:text-gold active:scale-95 transition-all"
            title={isFav ? 'পছন্দ থেকে সরান' : 'পছন্দে যোগ করুন'}
            aria-label={isFav ? 'পছন্দ থেকে সরান' : 'পছন্দে যোগ করুন'}
          >
            {isFav ? (
              <BookmarkCheck className="h-6 w-6 text-gold fill-current" />
            ) : (
              <Bookmark className="h-6 w-6" />
            )}
          </button>
        </header>

        {/* Step 2: Large Centered Square Cover Artwork (1:1 Aspect Ratio, Never Panoramic) */}
        <div className="w-full flex justify-center items-center py-1 sm:py-2 shrink-0">
          <div className="w-[280px] h-[280px] xs:w-[320px] xs:h-[320px] sm:w-[360px] sm:h-[360px] md:w-[400px] md:h-[400px] max-w-[85vw] max-h-[85vw] aspect-square shrink-0 rounded-2xl sm:rounded-3xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.8)] border border-white/10 ring-1 ring-white/5 bg-stone-900 flex items-center justify-center group">
            <img
              src={coverUrl}
              alt={currentEpisode.title}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = '/cover-placeholder.svg';
              }}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          </div>
        </div>

        {/* Step 3: Episode Title & Series Title */}
        <div className="text-center w-full px-2 space-y-1">
          {currentEpisode.episode_number && (
            <div className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 mb-1">
              পর্ব {toBengaliNumber(currentEpisode.episode_number)}
            </div>
          )}

          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight leading-snug line-clamp-2 drop-shadow-md">
            {currentEpisode.title}
          </h1>

          {currentSeries && (
            <Link
              to={`/series/${currentSeries.id}`}
              onClick={closeFullPlayer}
              className="text-sm font-medium text-emerald-400 hover:text-emerald-300 truncate block transition-colors mt-0.5"
            >
              {currentSeries.title}
            </Link>
          )}
        </div>

        {/* Step 4: Seekable Progress Bar with Current Time and Duration */}
        <div className="space-y-1.5 w-full">
          {error && (
            <div className="mb-2 p-3 rounded-xl bg-red-500/20 border border-red-500/30 text-xs text-red-200 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          <div className="relative w-full flex items-center group cursor-pointer py-1">
            <div className="w-full h-1.5 sm:h-2 bg-white/20 group-hover:bg-white/30 rounded-full overflow-hidden transition-all">
              <div
                className="h-full bg-gradient-to-r from-emerald-400 to-gold rounded-full transition-all duration-75"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="0.1"
              value={progressPercent || 0}
              onChange={handleSeekChange}
              onMouseDown={handleSeekStart}
              onTouchStart={handleSeekStart}
              onMouseUp={handleSeekEnd}
              onTouchEnd={handleSeekEnd}
              className="absolute inset-0 w-full opacity-0 cursor-pointer h-5 -top-1"
              aria-label="টাইমলাইন স্ক্রাবার"
            />
          </div>

          <div className="flex items-center justify-between text-xs text-stone-400 tabular-nums px-0.5 font-mono">
            <span>{formatDuration(effectiveTime)}</span>
            <span>{formatDuration(duration)}</span>
          </div>
        </div>

        {/* Step 5: Main Controls (Repeat, Previous, Play/Pause, Next, Queue) */}
        <div className="flex items-center justify-between px-2">
          {/* Repeat Mode */}
          <button
            type="button"
            onClick={toggleRepeat}
            className={`p-3 rounded-full transition-all active:scale-90 ${
              repeatMode !== 'off'
                ? 'text-emerald-400 bg-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                : 'text-stone-400 hover:text-white hover:bg-white/5'
            }`}
            title={`রিপিট: ${
              repeatMode === 'one' ? 'একটি পর্ব' : repeatMode === 'all' ? 'সকল পর্ব' : 'বন্ধ'
            }`}
            aria-label="রিপিট মোড"
          >
            {repeatMode === 'one' ? (
              <Repeat1 className="h-5 w-5" />
            ) : (
              <Repeat className="h-5 w-5" />
            )}
          </button>

          {/* Previous Episode */}
          <button
            type="button"
            onClick={playPrevious}
            disabled={!hasPrevious && repeatMode !== 'all'}
            className="p-3 rounded-full text-stone-200 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-all active:scale-95"
            title="পূর্ববর্তী পর্ব"
            aria-label="পূর্ববর্তী পর্ব"
          >
            <SkipBack className="h-7 w-7 fill-current" />
          </button>

          {/* Large Circular Play / Pause Button */}
          <button
            type="button"
            onClick={togglePlay}
            disabled={isLoadingAudio}
            className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-[0_8px_30px_rgba(5,150,105,0.4)] active:scale-95 transition-all"
            title={isPlaying ? 'বিরতি দিন' : 'চালান'}
            aria-label={isPlaying ? 'বিরতি দিন' : 'চালান'}
          >
            {isLoadingAudio ? (
              <Loader2 className="h-8 w-8 animate-spin" />
            ) : isPlaying ? (
              <Pause className="h-8 w-8 fill-current" />
            ) : (
              <Play className="h-8 w-8 fill-current ml-1" />
            )}
          </button>

          {/* Next Episode */}
          <button
            type="button"
            onClick={playNext}
            disabled={!hasNext && repeatMode !== 'all'}
            className="p-3 rounded-full text-stone-200 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-all active:scale-95"
            title="পরবর্তী পর্ব"
            aria-label="পরবর্তী পর্ব"
          >
            <SkipForward className="h-7 w-7 fill-current" />
          </button>

          {/* Queue Button */}
          <button
            type="button"
            onClick={() => {
              setShowQueue(!showQueue);
              setShowMenu(false);
            }}
            className={`p-3 rounded-full transition-all active:scale-90 ${
              showQueue
                ? 'text-emerald-400 bg-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                : 'text-stone-400 hover:text-white hover:bg-white/5'
            }`}
            title="প্লেলিস্ট / পর্বের তালিকা"
            aria-label="প্লেলিস্ট"
          >
            <ListMusic className="h-5 w-5" />
          </button>
        </div>

        {/* Step 6: Bottom Action Bar with Three-Dot Vertical Menu Button (⋮) */}
        <div className="flex items-center justify-between gap-3 pt-1 pb-3">
          {/* Active Settings Status Indicator Pill */}
          <div className="flex-1 min-w-0">
            {(playbackRate !== 1 || sleepTimerSecondsRemaining || sleepTimerMode === 'end_of_episode') ? (
              <div className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-3 py-1.5 rounded-full backdrop-blur-md">
                {playbackRate !== 1 && <span>{toBengaliNumber(playbackRate)}x গতি</span>}
                {playbackRate !== 1 && (sleepTimerSecondsRemaining || sleepTimerMode === 'end_of_episode') && (
                  <span className="text-emerald-500/40">·</span>
                )}
                {sleepTimerSecondsRemaining ? (
                  <span className="inline-flex items-center gap-1 text-amber-300">
                    <Clock className="h-3 w-3 text-amber-400" />
                    {formatDuration(sleepTimerSecondsRemaining)} বাকি
                  </span>
                ) : sleepTimerMode === 'end_of_episode' ? (
                  <span className="text-amber-300">পর্বের শেষে</span>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Three-dot vertical menu button (⋮) */}
          <button
            type="button"
            onClick={() => {
              setShowMenu(!showMenu);
              setShowQueue(false);
            }}
            className={`p-3 rounded-full transition-all active:scale-95 flex items-center justify-center backdrop-blur-md ${
              showMenu || playbackRate !== 1 || sleepTimerMode !== null
                ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.25)]'
                : 'bg-white/5 text-stone-300 hover:text-white hover:bg-white/10 border border-white/10'
            }`}
            title="প্লেব্যাক গতি ও স্লিপ টাইমার অপশন"
            aria-label="প্লেব্যাক গতি ও স্লিপ টাইমার মেনু"
          >
            <MoreVertical className="h-5 w-5" />
          </button>
        </div>

        {/* Three-Dot Menu Drawer / Bottom Sheet */}
        {showMenu && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end select-none">
            {/* Backdrop: Tap outside to close */}
            <div
              className="fixed inset-0 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
              onClick={() => setShowMenu(false)}
            />

            {/* Bottom Sheet Card */}
            <div
              className="relative z-10 w-full max-w-lg md:max-w-xl mx-auto bg-stone-900/98 dark:bg-[#0c1a13]/98 backdrop-blur-2xl border-t border-x border-white/15 rounded-t-3xl p-5 sm:p-6 shadow-[0_-15px_50px_rgba(0,0,0,0.8)] space-y-5 animate-in slide-in-from-bottom duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drag Handle Bar */}
              <div className="w-10 h-1 bg-white/20 rounded-full mx-auto -mt-1 mb-1" />

              {/* Menu Header */}
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <MoreVertical className="h-4 w-4" />
                  </div>
                  <h3 className="text-sm font-bold text-white tracking-wide">
                    প্লেয়ার অপশন ও সেটিংস
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowMenu(false)}
                  className="p-1.5 rounded-full text-stone-400 hover:text-white hover:bg-white/10 transition-colors"
                  aria-label="বন্ধ করুন"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Section 1: Playback Speed */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs font-semibold text-stone-300">
                  <span className="flex items-center gap-1.5">
                    <Gauge className="h-3.5 w-3.5 text-emerald-400" />
                    <span>প্লেব্যাক গতি (Playback Speed)</span>
                  </span>
                  <span className="text-[11px] text-emerald-400 font-mono font-medium">
                    {toBengaliNumber(playbackRate)}x নির্বাচিত
                  </span>
                </div>

                <div className="grid grid-cols-6 gap-1.5 sm:gap-2">
                  {speedOptions.map((rate) => {
                    const isSelected = playbackRate === rate;
                    return (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => setPlaybackRate(rate)}
                        className={`py-2 px-1 rounded-xl text-xs font-bold transition-all active:scale-95 text-center ${
                          isSelected
                            ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/50 ring-1 ring-emerald-400'
                            : 'bg-white/10 text-stone-300 hover:bg-white/15 hover:text-white'
                        }`}
                      >
                        {rate === 1 ? '1x' : `${rate}x`}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Section 2: Sleep Timer */}
              <div className="space-y-2.5 pt-1">
                <div className="flex items-center justify-between text-xs font-semibold text-stone-300">
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-amber-400" />
                    <span>স্লিপ টাইমার (Sleep Timer)</span>
                  </span>
                  {sleepTimerSecondsRemaining ? (
                    <span className="text-[11px] text-amber-400 font-mono font-medium animate-pulse">
                      {formatDuration(sleepTimerSecondsRemaining)} বাকি
                    </span>
                  ) : sleepTimerMode === 'end_of_episode' ? (
                    <span className="text-[11px] text-amber-400 font-medium">
                      বর্তমান পর্বের শেষে
                    </span>
                  ) : null}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {timerOptions.map((min) => {
                    const isSelected = sleepTimerMode === 'minutes' && sleepTimerMinutes === min;
                    return (
                      <button
                        key={min}
                        type="button"
                        onClick={() => setSleepTimer(min)}
                        className={`py-2.5 px-2 rounded-xl text-xs font-medium transition-all active:scale-95 text-center ${
                          isSelected
                            ? 'bg-amber-600 text-white shadow-lg shadow-amber-900/50 ring-1 ring-amber-400 font-bold'
                            : 'bg-white/10 text-stone-300 hover:bg-white/15 hover:text-white'
                        }`}
                      >
                        {toBengaliNumber(min)} মিনিট
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setSleepTimer('end_of_episode')}
                    className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-medium transition-all active:scale-95 text-center ${
                      sleepTimerMode === 'end_of_episode'
                        ? 'bg-amber-600 text-white shadow-lg shadow-amber-900/50 ring-1 ring-amber-400 font-bold'
                        : 'bg-white/10 text-stone-300 hover:bg-white/15 hover:text-white'
                    }`}
                  >
                    বর্তমান পর্বের শেষে
                  </button>

                  <button
                    type="button"
                    onClick={() => cancelSleepTimer()}
                    className={`py-2.5 px-3.5 rounded-xl text-xs font-medium transition-all active:scale-95 ${
                      sleepTimerMode === null
                        ? 'bg-white/20 text-white font-bold ring-1 ring-white/30'
                        : 'bg-red-500/20 text-red-300 hover:bg-red-500/30'
                    }`}
                  >
                    টাইমার বন্ধ (Timer Off)
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Queue / Episode List Panel */}
        {showQueue && (
          <div className="p-4 rounded-2xl bg-stone-900/95 backdrop-blur-xl border border-white/15 space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-150 shadow-2xl">
            <div className="flex items-center justify-between text-xs font-semibold text-stone-300 border-b border-white/10 pb-2">
              <span>সিরিজের পর্ব তালিকা ({toBengaliNumber(queue.length)})</span>
              <button
                type="button"
                onClick={() => setShowQueue(false)}
                className="text-stone-400 hover:text-white p-1"
                aria-label="বন্ধ করুন"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-56 overflow-y-auto divide-y divide-white/5 text-xs">
              {queue.map((ep, idx) => {
                const isSelected = ep.id === currentEpisode.id;
                return (
                  <div
                    key={ep.id}
                    onClick={() => playEpisode(ep, currentSeries, queue)}
                    className={`py-2 px-2.5 rounded-xl cursor-pointer flex items-center justify-between gap-2 transition-all ${
                      isSelected
                        ? 'bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 font-semibold'
                        : 'hover:bg-white/10 text-stone-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="w-5 text-stone-500 font-mono text-[11px]">
                        {toBengaliNumber(ep.episode_number || idx + 1)}.
                      </span>
                      <span className="truncate">{ep.title}</span>
                    </div>

                    {isSelected && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 shrink-0 font-medium">
                        বাজছে
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
