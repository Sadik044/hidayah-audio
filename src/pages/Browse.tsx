import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '../components/common/Button';
import {
  fetchCategories,
  fetchSeriesList,
  getCoverImageUrl,
} from '../services/contentService';
import type { Series, Category } from '../types/database.types';

export const Browse: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedCategoryId = searchParams.get('category');

  const [categories, setCategories] = useState<Category[]>([]);
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load categories once on mount with caching
  useEffect(() => {
    let isMounted = true;
    fetchCategories().then((catRes) => {
      if (!isMounted) return;
      if (catRes.error) {
        setError(catRes.error);
      } else {
        setCategories(catRes.data || []);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Load series whenever selectedCategoryId changes
  const loadSeries = async () => {
    setLoading(true);
    setError(null);

    const seriesRes = await fetchSeriesList({ categoryId: selectedCategoryId });

    if (seriesRes.error) {
      setError(seriesRes.error);
    }
    setSeriesList(seriesRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadSeries();
  }, [selectedCategoryId]);

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#171A18] dark:text-[#F3F4EF]">
          অডিও লাইব্রেরি
        </h1>
        <p className="text-sm text-[#777C77] dark:text-[#A4ADA6] mt-1">
          ইসলামিক অডিও সিরিজ, কুরআনি নসিহত, দোয়া ও জীবনঘনিষ্ঠ শিক্ষার সমাহার।
        </p>
      </div>

      {/* Error state alert */}
      {error && (
        <div className="p-3.5 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={loadSeries} className="gap-1.5 text-xs shrink-0">
            <RefreshCw className="h-3 w-3" />
            <span>আবার চেষ্টা করুন</span>
          </Button>
        </div>
      )}

      {/* Category Pills Filter */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          type="button"
          onClick={() => setSearchParams({})}
          className={`px-3.5 py-1.5 rounded-full text-xs font-medium shrink-0 transition-colors ${
            !selectedCategoryId
              ? 'bg-[#176B50] text-white dark:bg-[#48A783] dark:text-[#101713]'
              : 'bg-[#F0F1ED] text-[#171A18] dark:bg-[#19231D] dark:text-[#F3F4EF] hover:bg-[#E6E7E2] dark:hover:bg-[#233128]'
          }`}
        >
          সকল বিষয়
        </button>

        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setSearchParams({ category: cat.id })}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium shrink-0 transition-colors ${
              selectedCategoryId === cat.id
                ? 'bg-[#176B50] text-white dark:bg-[#48A783] dark:text-[#101713]'
                : 'bg-[#F0F1ED] text-[#171A18] dark:bg-[#19231D] dark:text-[#F3F4EF] hover:bg-[#E6E7E2] dark:hover:bg-[#233128]'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Series Grid — Content-first Artwork Presentation */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-2 animate-pulse">
              <div className="aspect-square rounded-xl bg-[#F0F1ED] dark:bg-[#19231D]" />
              <div className="h-4 w-3/4 bg-[#F0F1ED] dark:bg-[#19231D] rounded" />
              <div className="h-3 w-1/2 bg-[#F0F1ED] dark:bg-[#19231D] rounded" />
            </div>
          ))}
        </div>
      ) : seriesList.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {seriesList.map((series) => (
            <Link key={series.id} to={`/series/${series.id}`} className="group space-y-2">
              <div className="aspect-square w-full rounded-xl overflow-hidden bg-[#F0F1ED] dark:bg-[#19231D] relative shadow-xs">
                <img
                  src={getCoverImageUrl(series.cover_image)}
                  alt={series.title}
                  width={300}
                  height={300}
                  loading="lazy"
                  decoding="async"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = '/cover-placeholder.svg';
                  }}
                  className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-200"
                />
              </div>

              <div>
                <h3 className="font-medium text-sm text-[#171A18] dark:text-[#F3F4EF] line-clamp-1 group-hover:text-[#176B50] dark:group-hover:text-[#48A783] transition-colors">
                  {series.title}
                </h3>
                {series.category && (
                  <p className="text-xs text-[#777C77] dark:text-[#A4ADA6] truncate mt-0.5">
                    {series.category.name}
                  </p>
                )}
                {series.description && (
                  <p className="text-xs text-[#777C77] dark:text-[#A4ADA6] line-clamp-2 mt-1 leading-relaxed">
                    {series.description}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="py-16 text-center space-y-2">
          <h3 className="text-sm font-medium text-[#171A18] dark:text-[#F3F4EF]">
            {selectedCategoryId
              ? 'এই ক্যাটাগরিতে এখনো কোনো প্রকাশিত সিরিজ নেই'
              : 'বর্তমানে কোনো অডিও সিরিজ পাওয়া যায়নি'}
          </h3>
          <p className="text-xs text-[#777C77] dark:text-[#A4ADA6]">
            অন্য কোনো বিষয় নির্বাচন করুন অথবা পরে পুনরায় ব্রাউজ করুন।
          </p>
        </div>
      )}
    </div>
  );
};
