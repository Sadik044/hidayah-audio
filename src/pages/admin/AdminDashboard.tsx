import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Shield,
  Layers,
  Headphones,
  Folder,
  LogOut,
  RefreshCw,
  AlertCircle,
  LayoutDashboard,
  Plus,
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { useAuth } from '../../context/AuthContext';
import {
  fetchAdminDashboardData,
  fetchAdminCategories,
  fetchAdminSeriesList,
  fetchAdminEpisodesList,
  type AdminDashboardData,
  type CategoryWithCount,
  type SeriesWithCount,
} from '../../services/adminService';
import { CategoryManager } from '../../components/admin/CategoryManager';
import { SeriesManager } from '../../components/admin/SeriesManager';
import { EpisodeManager } from '../../components/admin/EpisodeManager';
import { toBengaliNumber } from '../../lib/utils';
import type { Episode } from '../../types/database.types';

type AdminTab = 'overview' | 'categories' | 'series' | 'episodes';

export const AdminDashboard: React.FC = () => {
  const { user, isAdmin, loading: authLoading, signOut } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = (searchParams.get('tab') as AdminTab) || 'overview';

  const [dashboardData, setDashboardData] = useState<AdminDashboardData | null>(null);
  const [categories, setCategories] = useState<CategoryWithCount[]>([]);
  const [seriesList, setSeriesList] = useState<SeriesWithCount[]>([]);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAllData = async () => {
    setLoading(true);
    setError(null);

    const [dashRes, catRes, sRes, epRes] = await Promise.all([
      fetchAdminDashboardData(),
      fetchAdminCategories(),
      fetchAdminSeriesList(),
      fetchAdminEpisodesList(),
    ]);

    if (dashRes.error || catRes.error || sRes.error || epRes.error) {
      setError(dashRes.error || catRes.error || sRes.error || epRes.error);
    }

    setDashboardData(dashRes.data);
    setCategories(catRes.data || []);
    setSeriesList(sRes.data || []);
    setEpisodes(epRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (user && isAdmin) {
      loadAllData();
    } else {
      setLoading(false);
    }
  }, [user, isAdmin]);

  const setTab = (tab: AdminTab) => {
    if (tab === 'overview') {
      searchParams.delete('tab');
      setSearchParams(searchParams);
    } else {
      setSearchParams({ tab });
    }
  };

  if (authLoading) {
    return (
      <div className="py-20 text-center text-sm text-stone-500">
        অ্যাকাউন্ট অধিকার যাচাই করা হচ্ছে...
      </div>
    );
  }

  // Protected View Barrier
  if (!user || !isAdmin) {
    return (
      <div className="max-w-md mx-auto my-16 text-center space-y-4">
        <div className="h-14 w-14 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center">
          <Shield className="h-7 w-7" />
        </div>
        <h2 className="text-xl font-bold text-sand-900 dark:text-stone-100">
          অনুমোদন প্রয়োজন
        </h2>
        <p className="text-xs text-stone-500 dark:text-stone-400">
          এই পৃষ্ঠাটি শুধুমাত্র হিদায়াহ অডিওর অনুমোদিত অ্যাডমিনের জন্য সংরক্ষিত। অনুগ্রহ করে আপনার অ্যাডমিন অ্যাকাউন্টে লগইন করুন।
        </p>
        <div className="pt-2">
          <Link to="/admin/login">
            <Button variant="primary" size="md">
              অ্যাডমিন লগইন করুন
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const metrics = dashboardData?.metrics || {
    categoriesCount: categories.length,
    seriesCount: seriesList.length,
    episodesCount: episodes.length,
    publishedEpisodesCount: episodes.filter((e) => e.published).length,
  };

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-sand-200/80 dark:border-emerald-900/40 pb-4">
        <div>
          <div className="flex items-center gap-2 text-gold mb-1">
            <Shield className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wider">সিস্টেম ব্যবস্থাপনা</span>
          </div>
          <h1 className="text-2xl font-bold text-sand-900 dark:text-stone-100">
            অ্যাডমিন কনসোল
          </h1>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
            লগইন করা আছে: <span className="font-medium text-emerald-700 dark:text-emerald-400">{user.email}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadAllData}
            isLoading={loading}
            className="gap-1.5 text-xs"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>রিফ্রেশ</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => signOut()}
            className="gap-1.5 text-xs text-red-600 hover:text-red-700 hover:bg-red-500/10"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>লগআউট</span>
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Admin Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-sand-200/80 dark:border-emerald-900/40 pb-1 overflow-x-auto scrollbar-none">
        <button
          type="button"
          onClick={() => setTab('overview')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold shrink-0 transition-colors ${
            currentTab === 'overview'
              ? 'bg-emerald-800 text-white dark:bg-emerald-700'
              : 'text-stone-600 dark:text-stone-300 hover:bg-sand-200/50 dark:hover:bg-emerald-900/40'
          }`}
        >
          <LayoutDashboard className="h-4 w-4" />
          <span>ড্যাশবোর্ড ওভারভিউ</span>
        </button>

        <button
          type="button"
          onClick={() => setTab('categories')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold shrink-0 transition-colors ${
            currentTab === 'categories'
              ? 'bg-emerald-800 text-white dark:bg-emerald-700'
              : 'text-stone-600 dark:text-stone-300 hover:bg-sand-200/50 dark:hover:bg-emerald-900/40'
          }`}
        >
          <Folder className="h-4 w-4" />
          <span>ক্যাটাগরি ({toBengaliNumber(categories.length)})</span>
        </button>

        <button
          type="button"
          onClick={() => setTab('series')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold shrink-0 transition-colors ${
            currentTab === 'series'
              ? 'bg-emerald-800 text-white dark:bg-emerald-700'
              : 'text-stone-600 dark:text-stone-300 hover:bg-sand-200/50 dark:hover:bg-emerald-900/40'
          }`}
        >
          <Layers className="h-4 w-4" />
          <span>সিরিজ ({toBengaliNumber(seriesList.length)})</span>
        </button>

        <button
          type="button"
          onClick={() => setTab('episodes')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold shrink-0 transition-colors ${
            currentTab === 'episodes'
              ? 'bg-emerald-800 text-white dark:bg-emerald-700'
              : 'text-stone-600 dark:text-stone-300 hover:bg-sand-200/50 dark:hover:bg-emerald-900/40'
          }`}
        >
          <Headphones className="h-4 w-4" />
          <span>অডিও পর্ব ({toBengaliNumber(episodes.length)})</span>
        </button>
      </div>

      {/* Tab 1: Overview */}
      {currentTab === 'overview' && (
        <div className="space-y-8">
          {/* Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card
              hoverable
              onClick={() => setTab('categories')}
              className="p-5 flex items-center gap-4 cursor-pointer"
            >
              <div className="h-12 w-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 flex items-center justify-center shrink-0">
                <Folder className="h-6 w-6" />
              </div>
              <div>
                <span className="text-xs text-stone-500 dark:text-stone-400 font-medium">
                  মোট বিষয় / ক্যাটাগরি
                </span>
                <div className="text-2xl font-bold text-sand-900 dark:text-stone-100">
                  {toBengaliNumber(metrics.categoriesCount)}
                </div>
              </div>
            </Card>

            <Card
              hoverable
              onClick={() => setTab('series')}
              className="p-5 flex items-center gap-4 cursor-pointer"
            >
              <div className="h-12 w-12 rounded-xl bg-sand-200 dark:bg-emerald-800/40 text-sand-800 dark:text-stone-200 flex items-center justify-center shrink-0">
                <Layers className="h-6 w-6" />
              </div>
              <div>
                <span className="text-xs text-stone-500 dark:text-stone-400 font-medium">
                  মোট সিরিজ
                </span>
                <div className="text-2xl font-bold text-sand-900 dark:text-stone-100">
                  {toBengaliNumber(metrics.seriesCount)}
                </div>
              </div>
            </Card>

            <Card
              hoverable
              onClick={() => setTab('episodes')}
              className="p-5 flex items-center gap-4 cursor-pointer"
            >
              <div className="h-12 w-12 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 flex items-center justify-center shrink-0">
                <Headphones className="h-6 w-6" />
              </div>
              <div>
                <span className="text-xs text-stone-500 dark:text-stone-400 font-medium">
                  মোট অডিও পর্ব
                </span>
                <div className="text-2xl font-bold text-sand-900 dark:text-stone-100">
                  {toBengaliNumber(metrics.episodesCount)}
                </div>
              </div>
            </Card>

            <Card className="p-5 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 flex items-center justify-center shrink-0">
                <Shield className="h-6 w-6" />
              </div>
              <div>
                <span className="text-xs text-stone-500 dark:text-stone-400 font-medium">
                  প্রকাশিত পর্ব
                </span>
                <div className="text-2xl font-bold text-sand-900 dark:text-stone-100">
                  {toBengaliNumber(metrics.publishedEpisodesCount)}
                </div>
              </div>
            </Card>
          </div>

          {/* Quick Actions Bar */}
          <Card className="p-5">
            <h3 className="text-sm font-bold text-sand-900 dark:text-stone-100 mb-3">
              দ্রুত পদক্ষেপ
            </h3>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                size="sm"
                variant="primary"
                onClick={() => setTab('categories')}
                className="gap-1.5"
              >
                <Plus className="h-4 w-4" />
                <span>নতুন ক্যাটাগরি তৈরি</span>
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setTab('series')}
                className="gap-1.5"
              >
                <Plus className="h-4 w-4" />
                <span>নতুন সিরিজ তৈরি</span>
              </Button>
              <Button
                size="sm"
                variant="gold"
                onClick={() => setTab('episodes')}
                className="gap-1.5"
              >
                <Plus className="h-4 w-4" />
                <span>নতুন অডিও পর্ব যোগ</span>
              </Button>
            </div>
          </Card>

          {/* Content Summary Grids */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Series */}
            <Card className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-sand-900 dark:text-stone-100">
                  সাম্প্রতিক সিরিজ
                </h2>
                <button
                  type="button"
                  onClick={() => setTab('series')}
                  className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
                >
                  সকল সিরিজ দেখুন
                </button>
              </div>

              {seriesList.length > 0 ? (
                <div className="divide-y divide-sand-200/60 dark:divide-emerald-900/40 text-xs">
                  {seriesList.slice(0, 5).map((s) => (
                    <div key={s.id} className="py-2.5 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="font-semibold text-sand-900 dark:text-stone-100 truncate block">
                          {s.title}
                        </span>
                        <span className="text-[11px] text-stone-400">
                          {s.category?.name || 'ক্যাটাগরি নেই'} • {toBengaliNumber(s.episodes_count || 0)} টি পর্ব
                        </span>
                      </div>
                      <Badge variant={s.published ? 'emerald' : 'muted'} className="text-[10px]">
                        {s.published ? 'প্রকাশিত' : 'ড্রাফট'}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-stone-400 border border-dashed rounded-xl">
                  ডাটাবেজে এখনো কোনো সিরিজ যোগ করা হয়নি।
                </div>
              )}
            </Card>

            {/* Categories */}
            <Card className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-sand-900 dark:text-stone-100">
                  ক্যাটাগরি তালিকা
                </h2>
                <button
                  type="button"
                  onClick={() => setTab('categories')}
                  className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
                >
                  সকল ক্যাটাগরি দেখুন
                </button>
              </div>

              {categories.length > 0 ? (
                <div className="divide-y divide-sand-200/60 dark:divide-emerald-900/40 text-xs">
                  {categories.slice(0, 5).map((cat) => (
                    <div key={cat.id} className="py-2.5 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="font-semibold text-sand-900 dark:text-stone-100 truncate block">
                          {cat.name}
                        </span>
                        <span className="text-[11px] text-stone-400">
                          স্লাগ: /{cat.slug}
                        </span>
                      </div>
                      <Badge variant="default" className="text-[10px]">
                        {toBengaliNumber(cat.series_count || 0)} টি সিরিজ
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-stone-400 border border-dashed rounded-xl">
                  ডাটাবেজে কোনো ক্যাটাগরি তৈরি করা নেই।
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* Tab 2: Category Management */}
      {currentTab === 'categories' && (
        <CategoryManager
          categories={categories}
          onRefresh={loadAllData}
        />
      )}

      {/* Tab 3: Series Management */}
      {currentTab === 'series' && (
        <SeriesManager
          seriesList={seriesList}
          categories={categories}
          onRefresh={loadAllData}
        />
      )}

      {/* Tab 4: Episode Management */}
      {currentTab === 'episodes' && (
        <EpisodeManager
          episodes={episodes}
          seriesList={seriesList}
          onRefresh={loadAllData}
        />
      )}
    </div>
  );
};
