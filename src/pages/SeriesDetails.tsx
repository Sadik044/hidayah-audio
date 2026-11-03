import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Play,
  Pause,
  ArrowLeft,
  Clock,
  Bookmark,
  BookmarkCheck,
  Share2,
  Check,
  AlertCircle,
  Loader2,
  ListMusic,
  ChevronDown,
  ChevronUp,
  Volume2,
} from 'lucide-react';
import { Button } from '../components/common/Button';
import {
  fetchSeriesById,
  fetchSeriesEpisodes,
  getCoverImageUrl,
} from '../services/contentService';
import { useAudioPlayer } from '../context/AudioPlayerContext';
import { formatDuration, toBengaliNumber } from '../lib/utils';
import type { Series, Episode } from '../types/database.types';

interface EpisodeRowProps {
  episode: Episode;
  orderNumber: number;
  isCurrent: boolean;
  isPlayingThis: boolean;
  isLoadingThis: boolean;
  isFav: boolean;
  coverUrl: string;
  onPlay: (ep: Episode) => void;
  onToggleFavorite: (id: string) => void;
}

const EpisodeRow = React.memo<EpisodeRowProps>(({
  episode,
  orderNumber,
  isCurrent,
  isPlayingThis,
  isLoadingThis,
  isFav,
  coverUrl,
  onPlay,
  onToggleFavorite,
}) => {
  return (
    <div
      className={`group flex items-center justify-between gap-3 p-2.5 sm:p-3 rounded-xl transition-all border ${
        isCurrent
          ? 'bg-[#FFFFFF] dark:bg-[#14221A] border-l-4 border-l-[#176B50] dark:border-l-[#54B58B] border-[#EAEAE5] dark:border-[#26372D] shadow-sm'
          : 'border-transparent hover:bg-[#FFFFFF]/90 dark:hover:bg-[#14221A]/80 hover:border-[#EAEAE5]/60 dark:hover:border-[#26372D]/60'
      }`}
    >
      {/* Left: Play/Pause Button, Number & Thumbnail */}
      <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
        {/* Play/Pause Button */}
        <button
          type="button"
          onClick={() => onPlay(episode)}
          disabled={isLoadingThis}
          className={`h-9 w-9 shrink-0 rounded-full flex items-center justify-center transition-transform active:scale-95 ${
            isCurrent
              ? 'bg-[#176B50] text-white dark:bg-[#54B58B] dark:text-[#0D1712] shadow-sm'
              : 'bg-[#FAF9F6] dark:bg-[#1A2820] text-[#777D78] dark:text-[#A8B2AA] hover:bg-[#176B50] hover:text-white dark:hover:bg-[#54B58B] dark:hover:text-[#0D1712]'
          }`}
          aria-label={isPlayingThis ? 'বিরতি দিন' : 'চালান'}
          title={isPlayingThis ? 'বিরতি দিন' : 'চালান'}
        >
          {isLoadingThis ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isPlayingThis ? (
            <Pause className="h-4 w-4 fill-current" />
          ) : (
            <Play className="h-4 w-4 fill-current ml-0.5" />
          )}
        </button>

        {/* Episode Order Number */}
        <span className="hidden sm:inline-block text-xs font-mono text-[#777D78] dark:text-[#A8B2AA] w-6 text-center shrink-0">
          {isPlayingThis ? (
            <Volume2 className="h-3.5 w-3.5 text-[#176B50] dark:text-[#54B58B] animate-pulse mx-auto" />
          ) : (
            toBengaliNumber(orderNumber)
          )}
        </span>

        {/* Small Square Artwork */}
        <div className="w-11 h-11 sm:w-12 sm:h-12 aspect-square rounded-lg overflow-hidden bg-[#FAF9F6] dark:bg-[#1A2820] border border-[#EAEAE5] dark:border-[#26372D] shrink-0">
          <img
            src={coverUrl}
            alt=""
            aria-hidden="true"
            className="w-full h-full object-cover select-none"
            loading="lazy"
          />
        </div>

        {/* Episode Title & Description */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Link
              to={`/episodes/${episode.id}`}
              className={`text-sm sm:text-base font-medium truncate block transition-colors ${
                isCurrent
                  ? 'text-[#176B50] dark:text-[#54B58B] font-semibold'
                  : 'text-[#191D1A] dark:text-[#F2F4EF] hover:text-[#176B50] dark:hover:text-[#54B58B]'
              }`}
              title={episode.title}
            >
              {episode.title}
            </Link>
          </div>

          {episode.description && (
            <p className="text-xs text-[#777D78] dark:text-[#A8B2AA] line-clamp-1 mt-0.5">
              {episode.description}
            </p>
          )}
        </div>
      </div>

      {/* Right: Duration & Bookmark Action */}
      <div className="flex items-center gap-3 sm:gap-4 shrink-0">
        {episode.duration && episode.duration > 0 ? (
          <span className="tabular-nums font-mono text-xs text-[#777D78] dark:text-[#A8B2AA] flex items-center gap-1">
            <Clock className="h-3 w-3 sm:inline-block hidden" />
            {formatDuration(episode.duration)}
          </span>
        ) : null}

        {/* Favorite / Bookmark toggle */}
        <button
          type="button"
          onClick={() => onToggleFavorite(episode.id)}
          className="p-1.5 rounded-lg text-[#777D78] hover:text-[#176B50] dark:text-[#A8B2AA] dark:hover:text-[#54B58B] hover:bg-[#FAF9F6] dark:hover:bg-[#1A2820] transition-colors"
          title={isFav ? 'পছন্দ তালিকা থেকে সরান' : 'পছন্দ তালিকায় যুক্ত করুন'}
          aria-label={isFav ? 'পছন্দ তালিকা থেকে সরান' : 'পছন্দ তালিকায় যুক্ত করুন'}
        >
          {isFav ? (
            <BookmarkCheck className="h-4 w-4 text-[#176B50] dark:text-[#54B58B] fill-current" />
          ) : (
            <Bookmark className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
});

export const SeriesDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [series, setSeries] = useState<Series | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const {
    currentEpisode,
    isPlaying,
    isLoadingAudio,
    playEpisode,
    togglePlay,
    toggleFavorite,
    isFavorite,
  } = useAudioPlayer();

  useEffect(() => {
    async function loadSeries() {
      if (!id) return;
      setLoading(true);
      setError(null);

      try {
        // Step 1: Strictly verify that the series exists and is published first
        const sRes = await fetchSeriesById(id);

        if (sRes.error || !sRes.data) {
          setError(sRes.error || 'অনুরোধকৃত সিরিজটি খুঁজে পাওয়া যায়নি অথবা এটি বর্তমানে অপ্রকাশিত।');
          setSeries(null);
          setEpisodes([]);
          return;
        }

        setSeries(sRes.data);

        // Step 2: Now that parent series publication is proven, load published episodes
        const epRes = await fetchSeriesEpisodes(id, { skipSeriesVerification: true });
        setEpisodes(epRes.data || []);
      } catch {
        setError('সিরিজের তথ্য লোড করতে সমস্যা হয়েছে। অনুগ্রহ করে পুনরায় চেষ্টা করুন।');
        setSeries(null);
        setEpisodes([]);
      } finally {
        setLoading(false);
      }
    }

    loadSeries();
  }, [id]);

  // Derived states
  const totalDurationSeconds = episodes.reduce(
    (acc, ep) => acc + (typeof ep.duration === 'number' && ep.duration > 0 ? ep.duration : 0),
    0
  );

  const formatTotalDuration = () => {
    if (totalDurationSeconds <= 0) return null;
    const hours = Math.floor(totalDurationSeconds / 3600);
    const minutes = Math.floor((totalDurationSeconds % 3600) / 60);

    if (hours > 0) {
      return `${toBengaliNumber(hours)} ঘণ্টা ${toBengaliNumber(minutes)} মিনিট`;
    }
    return `${toBengaliNumber(minutes)} মিনিট`;
  };

  const formattedDate = series?.created_at
    ? new Date(series.created_at).toLocaleDateString('bn-BD', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  const isCurrentSeriesPlaying =
    !!currentEpisode &&
    episodes.some((ep) => ep.id === currentEpisode.id) &&
    isPlaying;

  const isCurrentSeriesLoaded =
    !!currentEpisode &&
    episodes.some((ep) => ep.id === currentEpisode.id);

  // Handlers
  const handlePrimaryPlay = () => {
    if (episodes.length === 0) return;

    if (isCurrentSeriesLoaded) {
      togglePlay();
    } else {
      playEpisode(episodes[0], series, episodes);
    }
  };

  const handlePlayEpisode = useCallback((episode: Episode) => {
    if (currentEpisode?.id === episode.id) {
      togglePlay();
    } else {
      playEpisode(episode, series, episodes);
    }
  }, [currentEpisode?.id, togglePlay, playEpisode, series, episodes]);

  const handleShare = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // Fallback ignore
    }
  };

  const handleScrollToEpisodes = () => {
    const el = document.getElementById('episodes-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // 1. Loading Skeleton State
  if (loading) {
    return (
      <div className="space-y-10 animate-pulse py-2">
        {/* Back Link Skeleton */}
        <div className="h-4 w-28 bg-[#EAEAE5] dark:bg-[#26372D] rounded" />

        {/* Hero Section Skeleton */}
        <div className="flex flex-col md:flex-row gap-6 md:gap-10 items-start">
          <div className="w-56 h-56 sm:w-64 sm:h-64 md:w-[280px] md:h-[280px] aspect-square bg-[#EAEAE5] dark:bg-[#26372D] rounded-2xl mx-auto md:mx-0 shrink-0" />
          <div className="flex-1 w-full space-y-4 py-2">
            <div className="h-4 w-24 bg-[#EAEAE5] dark:bg-[#26372D] rounded-full" />
            <div className="h-8 md:h-10 w-3/4 bg-[#EAEAE5] dark:bg-[#26372D] rounded-lg" />
            <div className="h-4 w-1/2 bg-[#EAEAE5] dark:bg-[#26372D] rounded" />
            <div className="h-16 w-full max-w-xl bg-[#EAEAE5] dark:bg-[#26372D] rounded-lg" />
            <div className="flex gap-3 pt-2">
              <div className="h-10 w-36 bg-[#EAEAE5] dark:bg-[#26372D] rounded-lg" />
              <div className="h-10 w-28 bg-[#EAEAE5] dark:bg-[#26372D] rounded-lg" />
            </div>
          </div>
        </div>

        {/* Episodes Skeleton */}
        <div className="space-y-3 pt-8 border-t border-[#EAEAE5] dark:border-[#26372D]">
          <div className="h-6 w-44 bg-[#EAEAE5] dark:bg-[#26372D] rounded" />
          <div className="space-y-2 pt-2">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-16 w-full bg-[#EAEAE5]/60 dark:bg-[#26372D]/60 rounded-xl"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // 2. Error State
  if (error || !series) {
    return (
      <div className="text-center py-20 px-4 space-y-5 max-w-md mx-auto">
        <div className="h-12 w-12 rounded-full bg-red-500/10 text-red-500 mx-auto flex items-center justify-center">
          <AlertCircle className="h-6 w-6" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-xl font-bold text-[#191D1A] dark:text-[#F2F4EF]">
            সিরিজটি পাওয়া যায়নি
          </h2>
          <p className="text-sm text-[#777D78] dark:text-[#A8B2AA] leading-relaxed">
            {error || 'অনুরোধকৃত অডিও সিরিজটি খুঁজে পাওয়া যায়নি অথবা এটি বর্তমানে অপ্রকাশিত।'}
          </p>
        </div>
        <div className="pt-2">
          <Link to="/browse">
            <Button variant="secondary" size="md">
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              সকল সিরিজে ফিরে যান
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const coverUrl = getCoverImageUrl(series.cover_image);
  const totalDurationText = formatTotalDuration();
  const isLongDescription = (series.description?.length || 0) > 220;

  return (
    <div className="space-y-10">
      {/* Back to Browse link */}
      <div>
        <Link
          to="/browse"
          className="inline-flex items-center gap-1.5 text-xs text-[#777D78] dark:text-[#A8B2AA] hover:text-[#176B50] dark:hover:text-[#54B58B] transition-colors group"
        >
          <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
          <span>সকল সিরিজ</span>
        </Link>
      </div>

      {/* Series Hero Section */}
      <section className="flex flex-col md:flex-row gap-6 sm:gap-8 md:gap-10 items-start">
        {/* Cover Artwork */}
        <div className="w-56 h-56 sm:w-64 sm:h-64 md:w-[280px] md:h-[280px] lg:w-[300px] lg:h-[300px] aspect-square shrink-0 rounded-2xl overflow-hidden bg-[#FFFFFF] dark:bg-[#14221A] border border-[#EAEAE5] dark:border-[#26372D] shadow-sm mx-auto md:mx-0">
          <img
            src={coverUrl}
            alt={series.title}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = '/cover-placeholder.svg';
            }}
            className="w-full h-full object-cover select-none"
            loading="eager"
          />
        </div>

        {/* Hero Metadata & Actions */}
        <div className="space-y-4 flex-1 min-w-0 py-1">
          {/* Category & Episode count badge */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {series.category && (
              <Link
                to={`/browse?category=${series.category.id}`}
                className="font-semibold text-[#176B50] dark:text-[#54B58B] hover:underline uppercase tracking-wider"
              >
                {series.category.name}
              </Link>
            )}
            <span className="text-[#777D78] dark:text-[#A8B2AA]">·</span>
            <span className="text-[#777D78] dark:text-[#A8B2AA] font-medium">
              {toBengaliNumber(episodes.length)} টি পর্ব
            </span>
            {totalDurationText && (
              <>
                <span className="text-[#777D78] dark:text-[#A8B2AA]">·</span>
                <span className="text-[#777D78] dark:text-[#A8B2AA] font-medium">
                  {totalDurationText}
                </span>
              </>
            )}
          </div>

          {/* Series Title */}
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-[#191D1A] dark:text-[#F2F4EF] leading-snug">
            {series.title}
          </h1>

          {/* Short Teaser Description */}
          {series.description && (
            <p className="text-sm text-[#777D78] dark:text-[#A8B2AA] leading-relaxed max-w-2xl line-clamp-2 md:line-clamp-3">
              {series.description}
            </p>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            {episodes.length > 0 && (
              <Button
                onClick={handlePrimaryPlay}
                size="md"
                className="gap-2 px-5 py-2.5 font-medium shadow-sm"
              >
                {isCurrentSeriesPlaying ? (
                  <>
                    <Pause className="h-4 w-4 fill-current" />
                    <span>বিরতি দিন</span>
                  </>
                ) : isCurrentSeriesLoaded ? (
                  <>
                    <Play className="h-4 w-4 fill-current ml-0.5" />
                    <span>চালিয়ে যান</span>
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 fill-current ml-0.5" />
                    <span>প্রথম পর্ব শুনুন</span>
                  </>
                )}
              </Button>
            )}

            {episodes.length > 0 && (
              <Button
                onClick={handleScrollToEpisodes}
                variant="secondary"
                size="md"
                className="gap-2"
              >
                <ListMusic className="h-4 w-4" />
                <span>পর্বসমূহ</span>
              </Button>
            )}

            {/* Share button */}
            <Button
              onClick={handleShare}
              variant="outline"
              size="md"
              className="gap-1.5"
              title="লিংক কপি করুন"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-[#176B50] dark:text-[#54B58B]" />
                  <span className="text-[#176B50] dark:text-[#54B58B]">কপি হয়েছে</span>
                </>
              ) : (
                <>
                  <Share2 className="h-4 w-4 text-[#777D78] dark:text-[#A8B2AA]" />
                  <span>শেয়ার</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </section>

      {/* Series Information Section (Compact Details) */}
      <section className="bg-[#FFFFFF] dark:bg-[#14221A] rounded-2xl p-5 sm:p-6 border border-[#EAEAE5] dark:border-[#26372D] shadow-sm space-y-4">
        <h2 className="text-base font-bold text-[#191D1A] dark:text-[#F2F4EF]">
          সিরিজ পরিচিতি
        </h2>

        {series.description ? (
          <div className="space-y-2">
            <p className="text-sm text-[#777D78] dark:text-[#A8B2AA] leading-relaxed whitespace-pre-line">
              {isLongDescription && !descriptionExpanded
                ? `${series.description.slice(0, 220)}...`
                : series.description}
            </p>

            {isLongDescription && (
              <button
                type="button"
                onClick={() => setDescriptionExpanded(!descriptionExpanded)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#176B50] dark:text-[#54B58B] hover:underline pt-1"
              >
                <span>{descriptionExpanded ? 'সংক্ষেপ করুন' : 'সম্পূর্ণ বিবরণ পড়ুন'}</span>
                {descriptionExpanded ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </button>
            )}
          </div>
        ) : (
          <p className="text-sm text-[#777D78] dark:text-[#A8B2AA] italic">
            এই সিরিজের জন্য কোনো অতিরিক্ত বিবরণ সংরক্ষিত নেই।
          </p>
        )}

        {/* Quick Meta Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-[#EAEAE5] dark:border-[#26372D] text-xs">
          <div>
            <span className="block text-[#777D78] dark:text-[#A8B2AA]">ক্যাটাগরি</span>
            <span className="font-medium text-[#191D1A] dark:text-[#F2F4EF]">
              {series.category?.name || 'সাধারণ'}
            </span>
          </div>

          <div>
            <span className="block text-[#777D78] dark:text-[#A8B2AA]">মোট পর্ব</span>
            <span className="font-medium text-[#191D1A] dark:text-[#F2F4EF]">
              {toBengaliNumber(episodes.length)} টি
            </span>
          </div>

          {totalDurationText && (
            <div>
              <span className="block text-[#777D78] dark:text-[#A8B2AA]">মোট সময়কাল</span>
              <span className="font-medium text-[#191D1A] dark:text-[#F2F4EF]">
                {totalDurationText}
              </span>
            </div>
          )}

          {formattedDate && (
            <div>
              <span className="block text-[#777D78] dark:text-[#A8B2AA]">প্রকাশের তারিখ</span>
              <span className="font-medium text-[#191D1A] dark:text-[#F2F4EF]">
                {formattedDate}
              </span>
            </div>
          )}
        </div>
      </section>

      {/* Episodes Tracklist Section */}
      <section id="episodes-section" className="space-y-4 pt-2">
        <div className="flex items-center justify-between pb-2 border-b border-[#EAEAE5] dark:border-[#26372D]">
          <div className="flex items-center gap-2">
            <h2 className="text-lg sm:text-xl font-bold text-[#191D1A] dark:text-[#F2F4EF]">
              ধারাবাহিক পর্বসমূহ
            </h2>
            <span className="text-xs bg-[#EAEAE5] dark:bg-[#26372D] text-[#777D78] dark:text-[#A8B2AA] px-2 py-0.5 rounded-full font-medium">
              {toBengaliNumber(episodes.length)}
            </span>
          </div>
        </div>

        {episodes.length > 0 ? (
          <div className="space-y-1.5">
            {episodes.map((ep, idx) => (
              <EpisodeRow
                key={ep.id}
                episode={ep}
                orderNumber={ep.episode_number || idx + 1}
                isCurrent={currentEpisode?.id === ep.id}
                isPlayingThis={currentEpisode?.id === ep.id && isPlaying}
                isLoadingThis={currentEpisode?.id === ep.id && isLoadingAudio}
                isFav={isFavorite(ep.id)}
                coverUrl={coverUrl}
                onPlay={handlePlayEpisode}
                onToggleFavorite={toggleFavorite}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 px-4 rounded-2xl bg-[#FFFFFF] dark:bg-[#14221A] border border-[#EAEAE5] dark:border-[#26372D] space-y-2">
            <p className="text-sm font-medium text-[#191D1A] dark:text-[#F2F4EF]">
              বর্তমানে কোনো প্রকাশিত পর্ব নেই
            </p>
            <p className="text-xs text-[#777D78] dark:text-[#A8B2AA] max-w-sm mx-auto">
              এই সিরিজের জন্য নতুন অডিও পর্ব প্রকাশিত হলে এখানে তালিকাভুক্ত করা হবে।
            </p>
          </div>
        )}
      </section>
    </div>
  );
};
