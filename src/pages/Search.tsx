import React, { useState, useEffect } from 'react';
import { Search as SearchIcon, X, Headphones, Play, AlertCircle } from 'lucide-react';
import { Input } from '../components/common/Input';
import { searchPublishedContent, getCoverImageUrl } from '../services/contentService';
import { useAudioPlayer } from '../context/AudioPlayerContext';
import { Link } from 'react-router-dom';
import type { Series, Episode } from '../types/database.types';

export const Search: React.FC = () => {
  const [query, setQuery] = useState('');
  const [seriesResults, setSeriesResults] = useState<Series[]>([]);
  const [episodeResults, setEpisodeResults] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { playEpisode } = useAudioPlayer();

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSeriesResults([]);
      setEpisodeResults([]);
      setHasSearched(false);
      setError(null);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      setHasSearched(true);

      const res = await searchPublishedContent(trimmed);

      if (res.error) {
        setError(res.error);
        setSeriesResults([]);
        setEpisodeResults([]);
      } else if (res.data) {
        setSeriesResults(res.data.series);
        setEpisodeResults(res.data.episodes);
      }

      setLoading(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#171A18] dark:text-[#F3F4EF]">
          অনুসন্ধান
        </h1>
        <p className="text-sm text-[#777C77] dark:text-[#A4ADA6] mt-1">
          যেকোনো বিষয়, সিরিজের নাম বা পর্ব অনুসন্ধান করুন
        </p>
      </div>

      {/* Search Input Box */}
      <div className="relative">
        <Input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="অনুসন্ধান করুন (যেমন: সালাত, হাদিস, তাওহীদ)..."
          icon={<SearchIcon className="h-4 w-4" />}
          autoFocus
          className="text-sm py-2.5"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#777C77] hover:text-[#171A18] dark:hover:text-[#F3F4EF]"
            aria-label="মুছে ফেলুন"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Error notification if search query fails */}
      {error && (
        <div className="p-3.5 rounded-lg bg-red-500/10 text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Search State / Results */}
      {loading ? (
        <div className="py-12 text-center text-xs text-[#777C77] dark:text-[#A4ADA6]">
          অনুসন্ধান চলছে...
        </div>
      ) : hasSearched ? (
        <div className="space-y-8">
          {/* Series Results */}
          {seriesResults.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs font-medium uppercase tracking-wider text-[#777C77] dark:text-[#A4ADA6]">
                সিরিজ ({seriesResults.length})
              </h2>
              <div className="divide-y divide-[#E6E7E2]/50 dark:divide-[#233128]/50">
                {seriesResults.map((s) => (
                  <Link
                    key={s.id}
                    to={`/series/${s.id}`}
                    className="flex items-center gap-3.5 py-2.5 px-2 rounded-lg hover:bg-[#F0F1ED]/50 dark:hover:bg-[#19231D]/50 transition-colors group"
                  >
                    <div className="h-11 w-11 shrink-0 rounded-lg overflow-hidden bg-[#F0F1ED] dark:bg-[#19231D] flex items-center justify-center">
                      {s.cover_image ? (
                        <img
                          src={getCoverImageUrl(s.cover_image) || '/cover-placeholder.svg'}
                          alt={s.title}
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = '/cover-placeholder.svg';
                          }}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Headphones className="h-5 w-5 text-[#777C77]" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-medium text-[#171A18] dark:text-[#F3F4EF] group-hover:text-[#176B50] dark:group-hover:text-[#48A783] transition-colors truncate">
                        {s.title}
                      </h3>
                      {s.category && (
                        <p className="text-xs text-[#777C77] dark:text-[#A4ADA6] truncate">
                          {s.category.name}
                        </p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Episode Results */}
          {episodeResults.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs font-medium uppercase tracking-wider text-[#777C77] dark:text-[#A4ADA6]">
                পর্ব ({episodeResults.length})
              </h2>
              <div className="divide-y divide-[#E6E7E2]/50 dark:divide-[#233128]/50">
                {episodeResults.map((ep) => (
                  <div
                    key={ep.id}
                    className="flex items-center justify-between gap-3 py-2.5 px-2 rounded-lg hover:bg-[#F0F1ED]/50 dark:hover:bg-[#19231D]/50 transition-colors group"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-[#F0F1ED] dark:bg-[#19231D] shrink-0 flex items-center justify-center">
                        {ep.series?.cover_image ? (
                          <img
                            src={getCoverImageUrl(ep.series.cover_image) || '/cover-placeholder.svg'}
                            alt={ep.series.title}
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src = '/cover-placeholder.svg';
                            }}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Headphones className="h-4 w-4 text-[#777C77]" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
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

                    <button
                      type="button"
                      onClick={() => playEpisode(ep, ep.series, episodeResults)}
                      className="p-1.5 rounded-full text-[#777C77] hover:text-[#176B50] dark:hover:text-[#48A783] transition-colors"
                      aria-label="শুনুন"
                    >
                      <Play className="h-4 w-4 fill-current ml-0.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {seriesResults.length === 0 && episodeResults.length === 0 && (
            <div className="text-center py-12 space-y-1">
              <h3 className="text-sm font-medium text-[#171A18] dark:text-[#F3F4EF]">
                কোনো ফলাফল পাওয়া যায়নি
              </h3>
              <p className="text-xs text-[#777C77] dark:text-[#A4ADA6]">
                অন্য কোনো শব্দ দিয়ে পুনরায় অনুসন্ধান করুন।
              </p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};
