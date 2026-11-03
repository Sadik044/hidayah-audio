import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  ShieldCheck,
  RefreshCw,
  Search,
  Eye,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Database,
  FileCode,
} from 'lucide-react';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';
import { fetchAuditLogs } from '../../services/auditService';
import type { AuditLog } from '../../types/database.types';
import { toBengaliNumber } from '../../lib/utils';

interface SecurityActivityViewerProps {
  onRefreshTrigger?: () => void;
}

const CATEGORY_OPTIONS = [
  { value: 'all', label: 'সকল ক্যাটাগরি' },
  { value: 'admin_activity', label: 'অ্যাডমিন কার্যক্রম (ডাটাবেজ পরিবর্তন)' },
  { value: 'authentication', label: 'প্রমাণীকরণ ও প্রবেশ' },
  { value: 'mfa', label: 'দ্বি-স্তরীয় যাচাই (TOTP 2FA)' },
  { value: 'session', label: 'সেশন ও সময়সীমা' },
  { value: 'access_denial', label: 'অননুমোদিত প্রবেশ চেষ্টা' },
  { value: 'storage_activity', label: 'স্টোরেজ ও ফাইল কার্যক্রম' },
];

const DATE_OPTIONS = [
  { value: 'all', label: 'যেকোনো সময়' },
  { value: 'today', label: 'আজকের দিন' },
  { value: '7days', label: 'বিগত ৭ দিন' },
  { value: '30days', label: 'বিগত ৩০ দিন' },
];

export const SecurityActivityViewer: React.FC<SecurityActivityViewerProps> = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [category, setCategory] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Selected Log for Metadata Inspection Modal
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const calculateDateRange = useCallback(() => {
    if (dateFilter === 'all') return { startDate: undefined, endDate: undefined };

    const now = new Date();
    let startDate: string | undefined;

    if (dateFilter === 'today') {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      startDate = today.toISOString();
    } else if (dateFilter === '7days') {
      const past7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      startDate = past7.toISOString();
    } else if (dateFilter === '30days') {
      const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      startDate = past30.toISOString();
    }

    return { startDate, endDate: undefined };
  }, [dateFilter]);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { startDate, endDate } = calculateDateRange();

    const res = await fetchAuditLogs({
      page,
      pageSize,
      category,
      startDate,
      endDate,
    });

    if (res.error) {
      setError(res.error);
    } else {
      setLogs(res.logs);
      setTotalCount(res.totalCount);
    }

    setLoading(false);
  }, [page, pageSize, category, calculateDateRange]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  // Client-side quick search filter on description/target
  const filteredLogs = useMemo(() => {
    if (!searchTerm.trim()) return logs;
    const term = searchTerm.toLowerCase();
    return logs.filter(
      (l) =>
        l.description.toLowerCase().includes(term) ||
        (l.target_id && l.target_id.toLowerCase().includes(term)) ||
        l.event_type.toLowerCase().includes(term)
    );
  }, [logs, searchTerm]);

  const getCategoryBadge = (cat: string) => {
    switch (cat) {
      case 'admin_activity':
        return <Badge variant="emerald">অ্যাডমিন কার্যক্রম</Badge>;
      case 'authentication':
        return <Badge variant="gold">প্রমাণীকরণ</Badge>;
      case 'mfa':
        return <Badge variant="emerald">TOTP 2FA</Badge>;
      case 'session':
        return <Badge variant="muted">সেশন</Badge>;
      case 'access_denial':
        return <Badge variant="muted" className="text-red-700 bg-red-500/10 dark:text-red-400 dark:bg-red-500/20 font-medium">নিরাপত্তা অস্বীকৃতি</Badge>;
      case 'storage_activity':
        return <Badge variant="default">স্টোরেজ</Badge>;
      default:
        return <Badge variant="muted">{cat}</Badge>;
    }
  };

  const formatTimestamp = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleString('bn-BD', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Explanation */}
      <Card className="p-5 border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-950/20">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-sand-900 dark:text-stone-100 flex items-center gap-2">
                নিরাপত্তা ও অডিট লগ পর্যবেক্ষণ
                <Badge variant="emerald" className="text-[10px]">
                  সক্রিয় ও সুরক্ষিত (AAL2)
                </Badge>
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                সিস্টেমের সমস্ত সংবেদনশীল পরিবর্তন, প্রমাণীকরণ ও নিরাপত্তা কার্যক্রমের অপরিবর্তনযোগ্য (Append-Only) রেকর্ড।
              </p>
            </div>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={loadLogs}
            isLoading={loading}
            className="gap-1.5 text-xs shrink-0 self-end sm:self-auto"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>লগ রিফ্রেশ</span>
          </Button>
        </div>
      </Card>

      {/* Filter and Search Bar */}
      <Card className="p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Category Filter */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-stone-600 dark:text-stone-400">
              ক্যাটাগরি ফিল্টার
            </label>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
              className="w-full text-xs rounded-lg border border-sand-300 dark:border-emerald-900/60 bg-white dark:bg-stone-900 px-3 py-2 text-stone-800 dark:text-stone-200 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Date Filter */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-stone-600 dark:text-stone-400">
              সময়সীমা
            </label>
            <select
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value);
                setPage(1);
              }}
              className="w-full text-xs rounded-lg border border-sand-300 dark:border-emerald-900/60 bg-white dark:bg-stone-900 px-3 py-2 text-stone-800 dark:text-stone-200 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            >
              {DATE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Text Search */}
          <div className="space-y-1 sm:col-span-2">
            <label className="text-[11px] font-semibold text-stone-600 dark:text-stone-400">
              বিবরণ বা লক্ষ্য আইডি দিয়ে অনুসন্ধান
            </label>
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                placeholder="ইভেন্ট বা বিবরণে খুঁজুন..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-xs rounded-lg border border-sand-300 dark:border-emerald-900/60 bg-white dark:bg-stone-900 pl-8 pr-3 py-2 text-stone-800 dark:text-stone-200 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Error state */}
      {error && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Audit Log Table */}
      <Card className="overflow-hidden border-sand-200/80 dark:border-emerald-900/40">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-stone-700 dark:text-stone-300 divide-y divide-sand-200/60 dark:divide-emerald-900/40">
            <thead className="bg-sand-100/60 dark:bg-emerald-950/40 text-[11px] font-semibold text-stone-600 dark:text-stone-400 uppercase tracking-wider">
              <tr>
                <th scope="col" className="px-4 py-3">
                  সময়
                </th>
                <th scope="col" className="px-4 py-3">
                  ক্যাটাগরি
                </th>
                <th scope="col" className="px-4 py-3">
                  কার্যক্রম ও বিবরণ
                </th>
                <th scope="col" className="px-4 py-3">
                  নিরাপত্তা স্তর
                </th>
                <th scope="col" className="px-4 py-3">
                  লক্ষ্যবস্তু (Target)
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  মেটাডাটা
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-200/40 dark:divide-emerald-900/20">
              {loading && logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-stone-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                      <span>অডিট লগ লোড হচ্ছে...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-stone-400">
                    <Database className="h-8 w-8 mx-auto mb-2 text-stone-300 dark:text-stone-700" />
                    <span>প্রদত্ত ফিল্টারের সাথে কোনো অডিট রেকর্ড পাওয়া যায়নি।</span>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-sand-50/60 dark:hover:bg-emerald-950/20 transition-colors"
                  >
                    <td className="px-4 py-3 text-stone-500 whitespace-nowrap text-[11px]">
                      {formatTimestamp(log.created_at)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {getCategoryBadge(log.event_category)}
                    </td>
                    <td className="px-4 py-3 min-w-[200px]">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sand-900 dark:text-stone-100">
                          {log.description}
                        </span>
                        {log.origin === 'db_trigger' ? (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-medium">
                            ডাটাবেজ-জেনারেটেড (সার্ভার)
                          </span>
                        ) : (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400 font-medium">
                            ক্লায়েন্ট রিপোর্ট (অযাচাইকৃত)
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] font-mono text-stone-400 mt-0.5">
                        {log.event_type}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {log.aal_level === 'aal2' ? (
                        <Badge variant="emerald" className="text-[9px]">
                          AAL2
                        </Badge>
                      ) : log.aal_level === 'aal1' ? (
                        <Badge variant="gold" className="text-[9px]">
                          AAL1
                        </Badge>
                      ) : (
                        <span className="text-[10px] text-stone-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-stone-500 whitespace-nowrap text-[11px]">
                      {log.target_type ? (
                        <div>
                          <span className="font-medium text-stone-700 dark:text-stone-300">
                            {log.target_type}
                          </span>
                          {log.target_id && (
                            <span className="block text-[10px] font-mono text-stone-400 truncate max-w-[120px]">
                              {log.target_id}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-stone-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {log.metadata && Object.keys(log.metadata).length > 0 ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSelectedLog(log)}
                          className="h-7 px-2 text-[11px] gap-1 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
                        >
                          <Eye className="h-3 w-3" />
                          <span>মেটাডাটা</span>
                        </Button>
                      ) : (
                        <span className="text-[10px] text-stone-400">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="px-4 py-3 bg-sand-50/50 dark:bg-emerald-950/20 border-t border-sand-200/60 dark:divide-emerald-900/40 flex items-center justify-between text-xs text-stone-500">
          <div>
            মোট <span className="font-semibold text-sand-900 dark:text-stone-100">{toBengaliNumber(totalCount)}</span> টি রেকর্ডের মধ্যে{' '}
            <span className="font-semibold text-sand-900 dark:text-stone-100">
              {toBengaliNumber((page - 1) * pageSize + (filteredLogs.length > 0 ? 1 : 0))} - {toBengaliNumber(Math.min(page * pageSize, totalCount))}
            </span>{' '}
            প্রদর্শিত
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="h-7 px-2 text-xs"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>পূর্ববর্তী</span>
            </Button>
            <span className="px-2 text-xs font-medium">
              পৃষ্ঠা {toBengaliNumber(page)} / {toBengaliNumber(totalPages)}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
              className="h-7 px-2 text-xs"
            >
              <span>পরবর্তী</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Metadata Detail Inspection Modal */}
      {selectedLog && (
        <Modal
          isOpen={Boolean(selectedLog)}
          onClose={() => setSelectedLog(null)}
          title="অডিট লগ মেটাডাটা ও বিশদ তথ্য"
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-sand-50 dark:bg-stone-900 rounded-lg space-y-1.5 border border-sand-200 dark:border-stone-800">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sand-900 dark:text-stone-100">
                  {selectedLog.description}
                </span>
                {getCategoryBadge(selectedLog.event_category)}
              </div>
              <div className="text-stone-400 text-[11px] flex items-center gap-2 flex-wrap">
                <span>ইভেন্ট: <span className="font-mono text-stone-600 dark:text-stone-300">{selectedLog.event_type}</span></span>
                <span>•</span>
                <span>উৎস: <span className="font-semibold text-emerald-700 dark:text-emerald-400">{selectedLog.origin === 'db_trigger' ? 'ডাটাবেজ-জেনারেটেড (সার্ভার)' : 'ক্লায়েন্ট রিপোর্ট (অযাচাইকৃত)'}</span></span>
                <span>•</span>
                <span>সময়: {formatTimestamp(selectedLog.created_at)}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-stone-600 dark:text-stone-400 flex items-center gap-1.5">
                <FileCode className="h-3.5 w-3.5 text-emerald-600" />
                <span>সংরক্ষিত কনটেক্সট মেটাডাটা (JSON)</span>
              </label>
              <pre className="p-3 rounded-lg bg-stone-900 text-emerald-400 font-mono text-[11px] overflow-x-auto max-h-60 scrollbar-thin">
                {JSON.stringify(selectedLog.metadata, null, 2)}
              </pre>
              <p className="text-[10px] text-stone-400">
                নোট: অডিট লগে কোনো পাসওয়ার্ড, টোকেন বা গোপন চাবি সংরক্ষিত হয় না।
              </p>
            </div>

            <div className="pt-2 flex justify-end">
              <Button size="sm" variant="secondary" onClick={() => setSelectedLog(null)}>
                বন্ধ করুন
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
