import React, { useEffect, useState } from 'react';
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
  Headphones,
} from 'lucide-react';
import { Button } from '../components/common/Button';
import { fetchEpisodeById, fetchSeriesEpisodes, getCoverImageUrl } from '../services/contentService';
import { useAudioPlayer } from '../context/AudioPlayerContext';
import { formatDuration, toBengaliNumber } from '../lib/utils';
import type { Episode, Series } from '../types/database.types';

export const EpisodeDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [series, setSeries] = useState<Series | null>(null);
  const [seriesEpisodes, setSeriesEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const {
    currentEpisode,
    isPlaying,
    isLoadingAudio,
    playEpisode,
    togglePlay,
    toggleFavorite,
    isFavorite,
    error: playerError,
  } = useAudioPlayer();

  useEffect(() => {
    async function loadEpisode() {
      if (!id) return;
      setLoading(true);
      setError(null);

      const res = await fetchEpisodeById(id);

      if (res.error || !res.data) {
        setError(res.error || 'পর্বটি খুঁজে পাওয়া যায়নি।');
        setEpisode(null);
        setSeries(null);
      } else {
        const epData = res.data;
        setEpisode(epData);
        setSeries(epData.series || null);

        // Fetch sibling episodes for seamless queue playback
        // Since fetchEpisodeById already cryptographically verified parent series publication,
        // we skip the redundant series query to eliminate sequential waterfall
        if (epData.series_id) {
          const epRes = await fetchSeriesEpisodes(epData.series_id, { skipSeriesVerification: true });
          if (epRes.data) {
            setSeriesEpisodes(epRes.data);
          }
        }
      }

      setLoading(false);
    }

    loadEpisode();
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse max-w-2xl">
        <div className="h-4 w-24 bg-[#F0F1ED] dark:bg-[#19231D] rounded" />
        <div className="flex flex-col sm:flex-row gap-6">
          <div className="w-36 h-36 bg-[#F0F1ED] dark:bg-[#19231D] rounded-xl" />
          <div className="flex-1 space-y-3">
            <div className="h-4 w-20 bg-[#F0F1ED] dark:bg-[#19231D] rounded" />
            <div className="h-6 w-3/4 bg-[#F0F1ED] dark:bg-[#19231D] rounded" />
            <div className="h-10 w-28 bg-[#F0F1ED] dark:bg-[#19231D] rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !episode) {
    return (
      <div className="text-center py-16 space-y-4 max-w-md mx-auto">
        <div className="h-12 w-12 rounded-full bg-red-500/10 text-red-500 mx-auto flex items-center justify-center">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-bold text-[#171A18] dark:text-[#F3F4EF]">
          পর্বটি পাওয়া যায়নি
        </h2>
        <p className="text-xs text-[#777C77] dark:text-[#A4ADA6]">
          {error || 'অনুরোধকৃত অডিও পর্বটি মুছে ফেলা হয়েছে অথবা বর্তমানে অপ্রকাশিত।'}
        </p>
        <Link to="/browse">
          <Button variant="secondary" size="sm">
            ব্রাউজে ফিরে যান
          </Button>
        </Link>
      </div>
    );
  }

  const isCurrent = currentEpisode?.id === episode.id;
  const isFav = isFavorite(episode.id);

  const handlePlayToggle = () => {
    if (isCurrent) {
      togglePlay();
    } else {
      const queueToUse = seriesEpisodes.length > 0 ? seriesEpisodes : [episode];
      playEpisode(episode, series, queueToUse);
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const coverUrl = getCoverImageUrl(series?.cover_image) || '/cover-placeholder.svg';

  return (
    <div className="max-w-2xl space-y-8">
      {/* Back button */}
      <div>
        <Link
          to={series ? `/series/${series.id}` : '/browse'}
          className="inline-flex items-center gap-1.5 text-xs text-[#777C77] dark:text-[#A4ADA6] hover:text-[#171A18] dark:hover:text-[#F3F4EF] transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>{series ? `${series.title}-এ ফিরে যান` : 'ব্রাউজে ফিরে যান'}</span>
        </Link>
      </div>

      {/* Main Episode Presentation */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-6 items-start">
          {/* Cover Artwork */}
          <div className="w-32 h-32 sm:w-40 sm:h-40 shrink-0 rounded-xl overflow-hidden bg-[#F0F1ED] dark:bg-[#19231D] shadow-xs flex items-center justify-center">
            {series?.cover_image ? (
              <img
                src={coverUrl}
                alt={series.title}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = '/cover-placeholder.svg';
                }}
                className="w-full h-full object-cover"
              />
            ) : (
              <Headphones className="h-10 w-10 text-[#777C77]" />
            )}
          </div>

          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2 text-xs text-[#777C77] dark:text-[#A4ADA6]">
              {episode.episode_number && (
                <span className="font-medium text-[#176B50] dark:text-[#48A783]">
                  পর্ব {toBengaliNumber(episode.episode_number)}
                </span>
              )}
              {series && (
                <>
                  <span>·</span>
                  <Link to={`/series/${series.id}`} className="hover:underline">
                    {series.title}
                  </Link>
                </>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#171A18] dark:text-[#F3F4EF] leading-snug">
              {episode.title}
            </h1>

            {episode.duration && (
              <div className="flex items-center gap-1.5 text-xs text-[#777C77] dark:text-[#A4ADA6] font-mono">
                <Clock className="h-3 w-3" />
                <span>{formatDuration(episode.duration)}</span>
              </div>
            )}

            {/* Play, Share & Favorite Actions */}
            <div className="pt-3 flex items-center gap-2.5">
              <Button
                size="md"
                onClick={handlePlayToggle}
                disabled={isCurrent && isLoadingAudio}
                className="gap-2"
              >
                {isCurrent && isLoadingAudio ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>লোড হচ্ছে...</span>
                  </>
                ) : isCurrent && isPlaying ? (
                  <>
                    <Pause className="h-4 w-4 fill-current" />
                    <span>বিরতি দিন</span>
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 fill-current ml-0.5" />
                    <span>{isCurrent ? 'চালিয়ে যান' : 'এখনই শুনুন'}</span>
                  </>
                )}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleShare}
                className="gap-1.5 text-xs text-[#777C77] dark:text-[#A4ADA6]"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-[#176B50] dark:text-[#48A783]" /> : <Share2 className="h-3.5 w-3.5" />}
                <span>{copied ? 'কপি হয়েছে' : 'শেয়ার'}</span>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleFavorite(episode.id)}
                className="gap-1.5 text-xs text-[#777C77] dark:text-[#A4ADA6]"
              >
                {isFav ? (
                  <BookmarkCheck className="h-3.5 w-3.5 text-[#176B50] dark:text-[#48A783] fill-current" />
                ) : (
                  <Bookmark className="h-3.5 w-3.5" />
                )}
                <span>{isFav ? 'পছন্দিত' : 'সংরক্ষণ'}</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Player error if any */}
        {isCurrent && playerError && (
          <div className="p-3 rounded-lg bg-red-500/10 text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{playerError}</span>
          </div>
        )}

        {/* Description */}
        {episode.description && (
          <div className="space-y-2 pt-4 border-t border-[#E6E7E2]/60 dark:border-[#233128]/60">
            <h3 className="text-sm font-semibold text-[#171A18] dark:text-[#F3F4EF]">
              আলোচনার বিবরণ
            </h3>
            <p className="text-sm text-[#777C77] dark:text-[#A4ADA6] leading-relaxed whitespace-pre-line">
              {episode.description}
            </p>
          </div>
        )}
      </section>
    </div>
  );
};
