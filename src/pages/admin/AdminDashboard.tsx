import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Clock,
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
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useAdminInactivity } from '../../hooks/useAdminInactivity';
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
import { SecurityActivityViewer } from '../../components/admin/SecurityActivityViewer';
import { logSecurityEvent } from '../../services/auditService';
import { toBengaliNumber } from '../../lib/utils';
import type { Episode } from '../../types/database.types';

type AdminTab = 'overview' | 'categories' | 'series' | 'episodes' | 'security';

export const AdminDashboard: React.FC = () => {
  const { user, isAdmin, aal, loading: authLoading, signOut } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const currentTab = (searchParams.get('tab') as AdminTab) || 'overview';

  const [dashboardData, setDashboardData] = useState<AdminDashboardData | null>(null);
  const [categories, setCategories] = useState<CategoryWithCount[]>([]);
  const [seriesList, setSeriesList] = useState<SeriesWithCount[]>([]);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [mfaFactorInfo, setMfaFactorInfo] = useState<{ friendlyName?: string; createdAt?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Global Logout Modal & state
  const [isGlobalLogoutOpen, setIsGlobalLogoutOpen] = useState(false);
  const [globalLogoutLoading, setGlobalLogoutLoading] = useState(false);

  // Inactivity timeout handler
  const handleInactivityLogout = async () => {
    try {
      await logSecurityEvent({
        event_type: 'client_inactivity_timeout',
        event_category: 'session',
        description: '৩০ মিনিট নিষ্ক্রিয়তার কারণে স্বয়ংক্রিয় সেশন সমাপ্তি',
      });
      await signOut();
    } catch (err) {
      console.error('Error signing out due to inactivity:', err);
    } finally {
      navigate('/admin/login', {
        replace: true,
        state: {
          message: 'নিষ্ক্রিয়তার কারণে আপনার অ্যাডমিন সেশন সমাপ্ত হয়েছে। অনুগ্রহ করে পুনরায় লগইন করুন।',
        },
      });
    }
  };

  const {
    showWarning: showInactivityWarning,
    remainingSeconds: inactivityRemainingSeconds,
    keepActive: keepSessionActive,
  } = useAdminInactivity({
    timeoutMs: 30 * 60 * 1000, // 30 minutes default
    warningMs: 2 * 60 * 1000,  // 2 minutes warning dialog
    onTimeout: handleInactivityLogout,
    enabled: Boolean(user && isAdmin),
  });

  const handleGlobalLogout = async () => {
    if (globalLogoutLoading) return;
    setGlobalLogoutLoading(true);
    try {
      await logSecurityEvent({
        event_type: 'client_global_logout',
        event_category: 'session',
        description: 'সকল সক্রিয় ডিভাইস থেকে গ্লোবাল লগআউট কার্যকর',
      });
      await signOut({ scope: 'global' });
      navigate('/admin/login', {
        replace: true,
        state: {
          message: 'আপনার অ্যাকাউন্টটি সার্ভার থেকে সকল ডিভাইসের জন্য সফলভাবে লগআউট করা হয়েছে।',
          type: 'success',
        },
      });
    } catch (err) {
      console.error('Global logout error:', err);
      navigate('/admin/login', {
        replace: true,
        state: {
          message: 'সার্ভার সমস্যা বা নেটওয়ার্ক ত্রুটির কারণে দূরবর্তী সেশনগুলো বাতিল করা যায়নি। তবে আপনার বর্তমান ডিভাইসের স্থানীয় সেশন নিরাপদে মুছে ফেলা হয়েছে। অন্যান্য ডিভাইসের সেশন বাতিল নিশ্চিত করতে পুনরায় লগইন করে চেষ্টা করুন।',
          type: 'error',
        },
      });
    } finally {
      setGlobalLogoutLoading(false);
      setIsGlobalLogoutOpen(false);
    }
  };

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

    // Also fetch factor info (safe metadata only)
    try {
      const { data: factorsData } = await supabase.auth.mfa.listFactors();
      const verified = factorsData?.totp?.find((f) => f.status === 'verified');
      if (verified) {
        setMfaFactorInfo({
          friendlyName: verified.friendly_name || 'Authenticator App',
          createdAt: verified.created_at,
        });
      }
    } catch {
      // Ignore
    }

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

        <div className="flex flex-wrap items-center gap-2">
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
            variant="outline"
            size="sm"
            onClick={() => setIsGlobalLogoutOpen(true)}
            className="gap-1.5 text-xs text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800/60 hover:bg-amber-500/10"
            title="সকল সক্রিয় ডিভাইস ও ব্রাউজার থেকে সেশন বাতিল করুন"
          >
            <ShieldAlert className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">সকল ডিভাইস থেকে লগআউট</span>
            <span className="sm:hidden">সকল ডিভাইস</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await logSecurityEvent({
                event_type: 'client_manual_logout',
                event_category: 'session',
                description: 'স্থানীয় ডিভাইস থেকে অ্যাডমিন লগআউট',
              });
              await signOut();
            }}
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

        <button
          type="button"
          onClick={() => setTab('security')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold shrink-0 transition-colors ${
            currentTab === 'security'
              ? 'bg-emerald-800 text-white dark:bg-emerald-700'
              : 'text-stone-600 dark:text-stone-300 hover:bg-sand-200/50 dark:hover:bg-emerald-900/40'
          }`}
        >
          <ShieldAlert className="h-4 w-4" />
          <span>নিরাপত্তা ও অডিট লগ</span>
        </button>
      </div>

      {/* Tab 1: Overview */}
      {currentTab === 'overview' && (
        <div className="space-y-8">
          {/* Security & MFA Assurance Status */}
          <Card className="p-4 sm:p-5 border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-950/20">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0 shadow-sm">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-sand-900 dark:text-stone-100">
                      দ্বি-স্তরীয় প্রমাণীকরণ (TOTP 2FA)
                    </h3>
                    <Badge variant="emerald" className="text-[10px]">
                      {aal === 'aal2' ? 'AAL2 সুরক্ষিত' : 'AAL1'}
                    </Badge>
                  </div>
                  <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                    সংযুক্ত অ্যাপ: <span className="font-mono text-emerald-700 dark:text-emerald-300 font-medium">{mfaFactorInfo?.friendlyName || user.email}</span>
                    {mfaFactorInfo?.createdAt && (
                      <span className="text-stone-400 dark:text-stone-500">
                        {' '}• সংযুক্তিকরণ সম্পন্ন
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <div className="text-xs text-stone-500 dark:text-stone-400 max-w-sm sm:text-right">
                ডাটাবেজের RLS নিরাপত্তা পলিসির মাধ্যমে সমস্ত প্রশাসনিক পরিবর্তন ও স্টোরেজ আপলোড শুধুমাত্র AAL2 সেশনের জন্য সীমাবদ্ধ।
              </div>
            </div>
          </Card>

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

      {/* Tab 5: Security & Audit Logging */}
      {currentTab === 'security' && (
        <SecurityActivityViewer onRefreshTrigger={loadAllData} />
      )}

      {/* Global Logout Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isGlobalLogoutOpen}
        onClose={() => setIsGlobalLogoutOpen(false)}
        onConfirm={handleGlobalLogout}
        title="সকল ডিভাইস থেকে লগআউট"
        message="আপনি কি নিশ্চিত যে আপনার এই অ্যাকাউন্টটি সকল ডিভাইস থেকে লগআউট করতে চান? এটি সার্ভার থেকে সব ডিভাইসের রিফ্রেশ টোকেন তাৎক্ষণিকভাবে বাতিল করবে। তবে অন্যান্য ডিভাইসে ইতোমধ্যে সক্রিয় থাকা স্বল্পমেয়াদি অ্যাক্সেস টোকেনগুলো তাদের নির্দিষ্ট মেয়াদ শেষ না হওয়া পর্যন্ত সাময়িকভাবে সক্রিয় থাকতে পারে, এরপর তা পুরোপুরি বন্ধ হয়ে যাবে।"
        confirmLabel="হ্যাঁ, সকল ডিভাইস থেকে লগআউট"
        cancelLabel="বাতিল"
        isDangerous={true}
        isLoading={globalLogoutLoading}
      />

      {/* Admin Inactivity Warning Modal */}
      <Modal
        isOpen={showInactivityWarning}
        onClose={keepSessionActive}
        title="সেশন মেয়াদোত্তীর্ণের সতর্কতা"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Clock className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-sand-900 dark:text-stone-100">
                আপনি বেশ কিছুক্ষণ ধরে নিষ্ক্রিয় রয়েছেন।
              </p>
              <p className="text-xs text-sand-700/80 dark:text-stone-400 leading-relaxed">
                অ্যাকাউন্ট নিরাপত্তার স্বার্থে আর{' '}
                <span className="font-bold text-amber-600 dark:text-amber-400">
                  {toBengaliNumber(inactivityRemainingSeconds)}
                </span>{' '}
                সেকেন্ডের মধ্যে স্বয়ংক্রিয়ভাবে লগআউট করা হবে।
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-sand-200 dark:border-emerald-900/40">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleInactivityLogout}
              className="text-xs text-red-600 hover:text-red-700"
            >
              এখনই লগআউট
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={keepSessionActive}
              className="text-xs"
            >
              সেশন বজায় রাখুন
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
