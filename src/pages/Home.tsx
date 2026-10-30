import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Play, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '../components/common/Button';
import { WelcomeBanner } from '../components/home/WelcomeBanner';
import {
  fetchFeaturedSeries,
  fetchRecentSeries,
  fetchCategories,
  getCoverImageUrl,
} from '../services/contentService';
import type { Series, Category } from '../types/database.types';

export const Home: React.FC = () => {
  const [featuredSeries, setFeaturedSeries] = useState<Series[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [recentSeries, setRecentSeries] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setErrorMessage(null);

    const [featuredRes, recentRes, catRes] = await Promise.all([
      fetchFeaturedSeries(6),
      fetchRecentSeries(6),
      fetchCategories(),
    ]);

    if (featuredRes.error || recentRes.error || catRes.error) {
      setErrorMessage(featuredRes.error || recentRes.error || catRes.error);
    }

    setFeaturedSeries(featuredRes.data || []);
    setRecentSeries(recentRes.data || []);
    setCategories(catRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Use real published series for editorial hero spotlight
  const allAvailable = featuredSeries.length > 0 ? featuredSeries : recentSeries;
  const heroSeries = allAvailable.length > 0 ? allAvailable[0] : null;
  // If multiple series exist, show others in secondary collection
  const collectionSeries = allAvailable.length > 1 ? allAvailable.slice(1, 5) : [];

  return (
    <div className="space-y-8 sm:space-y-12">
      {/* 1. Premium Bismillah Welcome Banner */}
      <WelcomeBanner />

      {/* Error notification banner if any API failed */}
      {errorMessage && (
        <div className="p-3.5 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={loadData} className="gap-1.5 text-xs shrink-0">
            <RefreshCw className="h-3 w-3" />
            <span>পুনরায় চেষ্টা</span>
          </Button>
        </div>
      )}

      {/* 2. Featured Series Banner — Minimal Editorial Spotlight */}
      {loading ? (
        <div className="flex flex-col md:flex-row gap-8 items-center md:items-start animate-pulse">
          <div className="w-56 h-56 sm:w-64 sm:h-64 md:w-72 md:h-72 aspect-square rounded-2xl bg-[#F0F1ED] dark:bg-[#19231D]" />
          <div className="flex-1 space-y-4 w-full">
            <div className="h-4 w-24 bg-[#F0F1ED] dark:bg-[#19231D] rounded" />
            <div className="h-8 w-3/4 bg-[#F0F1ED] dark:bg-[#19231D] rounded" />
            <div className="h-16 w-full bg-[#F0F1ED] dark:bg-[#19231D] rounded" />
            <div className="h-10 w-36 bg-[#F0F1ED] dark:bg-[#19231D] rounded" />
          </div>
        </div>
      ) : heroSeries ? (
        <section className="pt-1">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-8 md:gap-12">
            {/* Actual Square Cover Artwork from Supabase */}
            <div className="w-56 h-56 sm:w-64 sm:h-64 md:w-72 md:h-72 aspect-square shrink-0 rounded-2xl overflow-hidden bg-[#F0F1ED] dark:bg-[#19231D] relative shadow-sm">
              <img
                src={getCoverImageUrl(heroSeries.cover_image)}
                alt={heroSeries.title}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = '/cover-placeholder.svg';
                }}
                className="w-full h-full object-cover transition-transform duration-300 hover:scale-102"
              />
            </div>

            {/* Editorial Content on Right (Stacked on Mobile) */}
            <div className="flex-1 min-w-0 space-y-3.5 text-center md:text-left">
              {heroSeries.category && (
                <span className="text-xs uppercase tracking-wider text-[#176B50] dark:text-[#48A783] font-medium block">
                  {heroSeries.category.name}
                </span>
              )}

              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-[#171A18] dark:text-[#F3F4EF] leading-snug">
                {heroSeries.title}
              </h1>

              {/* Clean line-clamp 2 to 3 lines */}
              {heroSeries.description && (
                <p className="text-sm sm:text-base text-[#777C77] dark:text-[#A4ADA6] leading-relaxed line-clamp-2 sm:line-clamp-3 max-w-xl">
                  {heroSeries.description}
                </p>
              )}

              <div className="pt-2 sm:pt-3 flex flex-wrap items-center justify-center md:justify-start gap-3 sm:gap-4">
                <Link to={`/series/${heroSeries.id}`}>
                  <Button variant="primary" size="md" className="gap-2 px-6 py-2.5 font-medium shadow-xs">
                    <Play className="h-4 w-4 fill-current ml-0.5" />
                    <span>শোনা শুরু করুন</span>
                  </Button>
                </Link>
                <Link
                  to="/browse"
                  className="text-sm font-medium text-[#777C77] dark:text-[#A4ADA6] hover:text-[#171A18] dark:hover:text-[#F3F4EF] transition-colors py-2 px-1"
                >
                  সকল সিরিজ দেখুন
                </Link>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="py-12 text-center max-w-md mx-auto space-y-3">
          <h1 className="text-2xl font-bold text-[#171A18] dark:text-[#F3F4EF]">
            সহীহ জ্ঞানের নূর অন্তরে
          </h1>
          <p className="text-sm text-[#777C77] dark:text-[#A4ADA6] leading-relaxed">
            কুরআন ও সুন্নাহর ভিত্তিতে বিশুদ্ধ আলোচনা ও ধারাবাহিক অডিও শুনুন।
          </p>
          <div className="pt-2">
            <Link to="/browse">
              <Button variant="primary" size="sm">
                ক্যাটাগরি ব্রাউজ করুন
              </Button>
            </Link>
          </div>
        </section>
      )}

      {/* Secondary Series Collection (Only rendered if multiple series exist) */}
      {collectionSeries.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg sm:text-xl font-bold text-[#171A18] dark:text-[#F3F4EF]">
              নির্বাচিত সিরিজ
            </h2>
            <Link
              to="/browse"
              className="text-xs text-[#777C77] dark:text-[#A4ADA6] hover:text-[#171A18] dark:hover:text-[#F3F4EF] transition-colors"
            >
              সব দেখুন
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {collectionSeries.map((series) => (
              <Link key={series.id} to={`/series/${series.id}`} className="group space-y-2">
                <div className="aspect-square w-full rounded-2xl overflow-hidden bg-[#F0F1ED] dark:bg-[#19231D] relative shadow-xs">
                  <img
                    src={getCoverImageUrl(series.cover_image)}
                    alt={series.title}
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
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 3. Categories — Simple Compact Links / Subtle Tiles */}
      <section className="space-y-3.5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg sm:text-xl font-bold text-[#171A18] dark:text-[#F3F4EF]">
            ক্যাটাগরি
          </h2>
          <Link
            to="/browse"
            className="text-xs text-[#777C77] dark:text-[#A4ADA6] hover:text-[#171A18] dark:hover:text-[#F3F4EF] transition-colors"
          >
            সকল বিষয়
          </Link>
        </div>

        {categories.length > 0 ? (
          <div className="flex flex-wrap gap-2.5">
            {categories.map((cat) => (
              <Link
                key={cat.id}
                to={`/browse?category=${cat.id}`}
                className="px-4 py-2 rounded-full text-xs text-[#171A18] dark:text-[#F3F4EF] bg-[#F0F1ED] dark:bg-[#19231D] hover:bg-[#E6E7E2] dark:hover:bg-[#233128] transition-colors"
              >
                {cat.name}
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-xs text-[#777C77] dark:text-[#A4ADA6]">
            কোনো ক্যাটাগরি পাওয়া যায়নি।
          </p>
        )}
      </section>

      {/* 4. Recently Added Series — Clean Horizontal List */}
      <section className="space-y-3.5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg sm:text-xl font-bold text-[#171A18] dark:text-[#F3F4EF]">
            সাম্প্রতিক সিরিজ
          </h2>
        </div>

        {recentSeries.length > 0 ? (
          <div className="divide-y divide-[#E6E7E2]/50 dark:divide-[#233128]/50">
            {recentSeries.map((series) => (
              <Link
                key={series.id}
                to={`/series/${series.id}`}
                className="flex items-center gap-4 py-3 px-2 rounded-lg hover:bg-[#F0F1ED]/50 dark:hover:bg-[#19231D]/50 transition-colors group"
              >
                {/* Small square cover */}
                <div className="h-12 w-12 shrink-0 rounded-xl overflow-hidden bg-[#F0F1ED] dark:bg-[#19231D]">
                  <img
                    src={getCoverImageUrl(series.cover_image)}
                    alt={series.title}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = '/cover-placeholder.svg';
                    }}
                    className="h-full w-full object-cover"
                  />
                </div>

                {/* Series Details */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm text-[#171A18] dark:text-[#F3F4EF] truncate group-hover:text-[#176B50] dark:group-hover:text-[#48A783] transition-colors">
                    {series.title}
                  </h3>
                  {series.category && (
                    <p className="text-xs text-[#777C77] dark:text-[#A4ADA6] truncate mt-0.5">
                      {series.category.name}
                    </p>
                  )}
                </div>

                {/* Play action */}
                <div className="text-[#777C77] dark:text-[#A4ADA6] group-hover:text-[#176B50] dark:group-hover:text-[#48A783] transition-colors pr-1">
                  <Play className="h-4 w-4" />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-xs text-[#777C77] dark:text-[#A4ADA6] py-2">
            বর্তমানে কোনো অডিও সিরিজ পাওয়া যায়নি।
          </p>
        )}
      </section>
    </div>
  );
};
