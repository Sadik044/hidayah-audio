import React, { useEffect, useState } from 'react';
import { Play, Trash2, ArrowRight, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../components/common/Button';
import { useAudioPlayer } from '../context/AudioPlayerContext';
import { fetchEpisodesByIds } from '../services/contentService';
import { formatDuration } from '../lib/utils';
import type { Episode } from '../types/database.types';

export const Favorites: React.FC = () => {
  const { favorites, toggleFavorite, playEpisode } = useAudioPlayer();
  const [favoriteEpisodes, setFavoriteEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadFavoriteEpisodes() {
      if (favorites.length === 0) {
        setFavoriteEpisodes([]);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      const res = await fetchEpisodesByIds(favorites);

      if (res.error) {
        setError(res.error);
      } else {
        setFavoriteEpisodes(res.data || []);
      }

      setLoading(false);
    }

    loadFavoriteEpisodes();
  }, [favorites]);

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#171A18] dark:text-[#F3F4EF]">
          পছন্দের অডিও
        </h1>
        <p className="text-sm text-[#777C77] dark:text-[#A4ADA6] mt-1">
          আপনার সংরক্ষিত প্রিয় পর্বসমূহ যেকোনো সময় শুনুন
        </p>
      </div>

      {error && (
        <div className="p-3.5 rounded-lg bg-red-500/10 text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 rounded-lg bg-[#F0F1ED] dark:bg-[#19231D] animate-pulse" />
          ))}
        </div>
      ) : favoriteEpisodes.length > 0 ? (
        <div className="divide-y divide-[#E6E7E2]/50 dark:divide-[#233128]/50">
          {favoriteEpisodes.map((ep) => (
            <div
              key={ep.id}
              className="flex items-center justify-between gap-3 py-3 px-2 rounded-lg hover:bg-[#F0F1ED]/50 dark:hover:bg-[#19231D]/50 transition-colors group"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => playEpisode(ep, ep.series, favoriteEpisodes)}
                  className="p-1.5 rounded-full text-[#777C77] hover:text-[#176B50] dark:hover:text-[#48A783] transition-colors"
                  aria-label="শুনুন"
                >
                  <Play className="h-4 w-4 fill-current ml-0.5" />
                </button>

                <div className="min-w-0">
                  <Link
                    to={`/episodes/${ep.id}`}
                    className="text-sm font-medium text-[#171A18] dark:text-[#F3F4EF] hover:text-[#176B50] dark:hover:text-[#48A783] truncate block"
                  >
                    {ep.title}
                  </Link>
                  {ep.series && (
                    <p className="text-xs text-[#777C77] dark:text-[#A4ADA6] truncate">
                      {ep.series.title}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4 shrink-0 text-xs text-[#777C77] dark:text-[#A4ADA6]">
                {ep.duration && (
                  <span className="font-mono tabular-nums hidden sm:inline">
                    {formatDuration(ep.duration)}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => toggleFavorite(ep.id)}
                  className="p-1 text-[#777C77] hover:text-red-500 transition-colors"
                  title="পছন্দ থেকে সরান"
                  aria-label="পছন্দ থেকে সরান"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 space-y-3">
          <h3 className="text-sm font-medium text-[#171A18] dark:text-[#F3F4EF]">
            আপনার পছন্দের তালিকা এখনো খালি
          </h3>
          <p className="text-xs text-[#777C77] dark:text-[#A4ADA6] max-w-xs mx-auto">
            যেকোনো পর্বের পাশে থাকা বুকমার্ক আইকনে ক্লিক করে সহজেই এখানে যুক্ত করতে পারেন।
          </p>
          <div className="pt-2">
            <Link to="/browse">
              <Button variant="secondary" size="sm" className="gap-1.5">
                <span>ব্রাউজ করুন</span>
                <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};
