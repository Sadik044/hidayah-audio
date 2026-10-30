import React, { useState } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Play,
  Pause,
  Headphones,
  UploadCloud,
  CheckCircle,
  AlertCircle,
  Search,
  Eye,
  EyeOff,
  Clock,
  FileAudio,
  Loader2,
} from 'lucide-react';
import { Button } from '../common/Button';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import { Input } from '../common/Input';
import { Modal } from '../common/Modal';
import { ConfirmDialog } from '../common/ConfirmDialog';
import {
  type SeriesWithCount,
  createEpisode,
  updateEpisode,
  deleteEpisode,
  toggleEpisodePublish,
  uploadAudioFile,
} from '../../services/adminService';
import { useAudioPlayer } from '../../context/AudioPlayerContext';
import { formatDuration, toBengaliNumber } from '../../lib/utils';
import type { Episode } from '../../types/database.types';

interface EpisodeManagerProps {
  episodes: Episode[];
  seriesList: SeriesWithCount[];
  onRefresh: () => void;
}

export const EpisodeManager: React.FC<EpisodeManagerProps> = ({
  episodes,
  seriesList,
  onRefresh,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSeries, setFilterSeries] = useState<string>('all');
  const [filterPublished, setFilterPublished] = useState<string>('all');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEpisode, setEditingEpisode] = useState<Episode | null>(null);

  // Form fields
  const [seriesId, setSeriesId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [episodeNumber, setEpisodeNumber] = useState<string>('');
  const [duration, setDuration] = useState<string>('');
  const [published, setPublished] = useState(false);

  // Audio file states
  const [audioPath, setAudioPath] = useState<string>('');
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Delete states
  const [deletingEpisode, setDeletingEpisode] = useState<Episode | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Audio preview from current player
  const { currentEpisode, isPlaying, playEpisode, togglePlay } = useAudioPlayer();

  const openCreateModal = () => {
    setEditingEpisode(null);
    setSeriesId(seriesList.length > 0 ? seriesList[0].id : '');
    setTitle('');
    setSlug('');
    setDescription('');
    setEpisodeNumber(String(episodes.length + 1));
    setDuration('');
    setAudioPath('');
    setSelectedFileName('');
    setPublished(false);
    setFormError(null);
    setUploadError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (ep: Episode) => {
    setEditingEpisode(ep);
    setSeriesId(ep.series_id);
    setTitle(ep.title);
    setSlug(ep.slug);
    setDescription(ep.description || '');
    setEpisodeNumber(ep.episode_number ? String(ep.episode_number) : '');
    setDuration(ep.duration ? String(ep.duration) : '');
    setAudioPath(ep.audio_path);
    setSelectedFileName(ep.audio_path.split('/').pop() || '');
    setPublished(ep.published);
    setFormError(null);
    setUploadError(null);
    setIsModalOpen(true);
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTitle(val);
    if (!editingEpisode) {
      const generated = val
        .toLowerCase()
        .trim()
        .replace(/[\s_]+/g, '-')
        .replace(/[^\w-]/g, '');
      setSlug(generated);
    }
  };

  const handleAudioFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAudio(true);
    setUploadError(null);
    setSelectedFileName(file.name);

    // Auto calculate audio duration via HTML5 Audio object
    try {
      const objectUrl = URL.createObjectURL(file);
      const tempAudio = new Audio(objectUrl);
      tempAudio.addEventListener('loadedmetadata', () => {
        if (tempAudio.duration && !isNaN(tempAudio.duration)) {
          setDuration(String(Math.round(tempAudio.duration)));
        }
        URL.revokeObjectURL(objectUrl);
      });
    } catch {
      // Ignore duration extraction failure if browser doesn't decode
    }

    const res = await uploadAudioFile(file);
    setUploadingAudio(false);

    if (res.error || !res.data) {
      setUploadError(res.error || 'অডিও ফাইল আপলোড ব্যর্থ হয়েছে।');
      setAudioPath('');
      return;
    }

    setAudioPath(res.data.path);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!seriesId) {
      setFormError('অনুগ্রহ করে একটি সিরিজ নির্বাচন করুন।');
      return;
    }
    if (!title.trim()) {
      setFormError('পর্বের শিরোনাম আবশ্যক।');
      return;
    }
    if (!slug.trim()) {
      setFormError('পর্বের স্লাগ (slug) আবশ্যক।');
      return;
    }
    if (!audioPath) {
      setFormError('একটি অডিও ফাইল আপলোড করা আবশ্যক।');
      return;
    }

    setFormLoading(true);
    setFormError(null);

    const parsedEpNum = episodeNumber ? parseInt(episodeNumber, 10) : null;
    const parsedDuration = duration ? parseInt(duration, 10) : null;

    if (editingEpisode) {
      const res = await updateEpisode(
        editingEpisode.id,
        {
          series_id: seriesId,
          title,
          slug,
          description,
          episode_number: isNaN(Number(parsedEpNum)) ? null : parsedEpNum,
          audio_path: audioPath,
          duration: isNaN(Number(parsedDuration)) ? null : parsedDuration,
          published,
        },
        editingEpisode.audio_path // cleanup old audio if replaced
      );

      if (res.error) {
        setFormError(res.error);
        setFormLoading(false);
        return;
      }
      setSuccessMessage('পর্বের তথ্য সফলভাবে সংরক্ষিত হয়েছে।');
    } else {
      const res = await createEpisode({
        series_id: seriesId,
        title,
        slug,
        description,
        episode_number: isNaN(Number(parsedEpNum)) ? null : parsedEpNum,
        audio_path: audioPath,
        duration: isNaN(Number(parsedDuration)) ? null : parsedDuration,
        published,
      });

      if (res.error) {
        setFormError(res.error);
        setFormLoading(false);
        return;
      }
      setSuccessMessage('নতুন পর্ব সফলভাবে যুক্ত করা হয়েছে।');
    }

    setFormLoading(false);
    setIsModalOpen(false);
    onRefresh();
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleTogglePublish = async (ep: Episode) => {
    const next = !ep.published;
    const res = await toggleEpisodePublish(ep.id, next);
    if (!res.error) {
      onRefresh();
      setSuccessMessage(next ? 'পর্বটি প্রকাশিত হয়েছে।' : 'পর্বটি ড্রাফটে রাখা হয়েছে।');
      setTimeout(() => setSuccessMessage(null), 2500);
    }
  };

  const confirmDelete = async () => {
    if (!deletingEpisode) return;
    setDeleteLoading(true);
    setDeleteError(null);

    const res = await deleteEpisode(deletingEpisode.id);
    setDeleteLoading(false);

    if (res.error) {
      setDeleteError(res.error);
      setDeletingEpisode(null);
      onRefresh();
      return;
    }

    setDeletingEpisode(null);
    setSuccessMessage('পর্ব এবং এর অডিও ফাইল সফলভাবে অপসারিত হয়েছে।');
    onRefresh();
    setTimeout(() => setSuccessMessage(null), 3500);
  };

  const handlePlayTest = (ep: Episode) => {
    if (currentEpisode?.id === ep.id) {
      togglePlay();
    } else {
      playEpisode(ep, ep.series);
    }
  };

  // Filtered episode list
  const filtered = episodes.filter((ep) => {
    const matchesSearch =
      ep.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ep.slug.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSeries =
      filterSeries === 'all' || ep.series_id === filterSeries;
    const matchesPublished =
      filterPublished === 'all' ||
      (filterPublished === 'published' && ep.published) ||
      (filterPublished === 'draft' && !ep.published);

    return matchesSearch && matchesSeries && matchesPublished;
  });

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-sand-900 dark:text-stone-100">
            পর্ব ব্যবস্থাপনা ({toBengaliNumber(episodes.length)})
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            প্রাইভেট অডিও স্টোরেজ ও পর্বের বিবরণ পরিচালনা করুন
          </p>
        </div>

        <Button onClick={openCreateModal} size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          <span>নতুন পর্ব যোগ করুন</span>
        </Button>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
          <CheckCircle className="h-4 w-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {deleteError && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-600 dark:text-red-400 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{deleteError}</span>
          </div>
          <button
            type="button"
            onClick={() => setDeleteError(null)}
            className="text-stone-400 hover:text-stone-600 text-xs"
          >
            বন্ধ
          </button>
        </div>
      )}

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="পর্বের নাম খুঁজুন..."
            icon={<Search className="h-4 w-4" />}
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filterSeries}
            onChange={(e) => setFilterSeries(e.target.value)}
            className="rounded-xl border border-sand-300 dark:border-emerald-800/60 bg-white/70 dark:bg-emerald-deep/40 px-3 py-2 text-xs text-sand-900 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-600"
          >
            <option value="all">সকল সিরিজ</option>
            {seriesList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>

          <select
            value={filterPublished}
            onChange={(e) => setFilterPublished(e.target.value)}
            className="rounded-xl border border-sand-300 dark:border-emerald-800/60 bg-white/70 dark:bg-emerald-deep/40 px-3 py-2 text-xs text-sand-900 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-600"
          >
            <option value="all">সকল অবস্থা</option>
            <option value="published">শুধুমাত্র প্রকাশিত</option>
            <option value="draft">শুধুমাত্র ড্রাফট</option>
          </select>
        </div>
      </div>

      {/* Episodes Table */}
      {filtered.length > 0 ? (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-sand-100/70 dark:bg-emerald-950/60 text-stone-500 dark:text-stone-400 border-b border-sand-200 dark:border-emerald-900/40">
                <tr>
                  <th className="py-3 px-4">প্লেয়ার ও পর্বের নাম</th>
                  <th className="py-3 px-4">সিরিজ</th>
                  <th className="py-3 px-4">পর্ব নং</th>
                  <th className="py-3 px-4">সময়কাল</th>
                  <th className="py-3 px-4 text-center">অবস্থা</th>
                  <th className="py-3 px-4 text-right">পদক্ষেপ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-200/50 dark:divide-emerald-900/30">
                {filtered.map((ep) => {
                  const isCurrent = currentEpisode?.id === ep.id;
                  return (
                    <tr
                      key={ep.id}
                      className="hover:bg-sand-50/50 dark:hover:bg-emerald-900/20 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => handlePlayTest(ep)}
                            className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                              isCurrent
                                ? 'bg-emerald-700 text-white shadow-sm'
                                : 'bg-sand-200 dark:bg-emerald-900/60 text-sand-800 dark:text-stone-200 hover:bg-emerald-700 hover:text-white'
                            }`}
                            title="প্লে করুন (Edge Function মাধ্যমে)"
                          >
                            {isCurrent && isPlaying ? (
                              <Pause className="h-3.5 w-3.5 fill-current" />
                            ) : (
                              <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
                            )}
                          </button>
                          <div className="min-w-0 max-w-xs">
                            <span className="font-semibold text-sand-900 dark:text-stone-100 block truncate">
                              {ep.title}
                            </span>
                            <span className="text-[11px] font-mono text-stone-400 truncate block">
                              {ep.audio_path}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-stone-600 dark:text-stone-300">
                        {ep.series?.title || '—'}
                      </td>

                      <td className="py-3 px-4 text-stone-600 dark:text-stone-300 font-medium">
                        {ep.episode_number ? toBengaliNumber(ep.episode_number) : '—'}
                      </td>

                      <td className="py-3 px-4 text-stone-600 dark:text-stone-300">
                        <span className="inline-flex items-center gap-1 font-mono text-stone-500">
                          <Clock className="h-3 w-3" />
                          {formatDuration(ep.duration)}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleTogglePublish(ep)}
                          className="inline-flex items-center gap-1 cursor-pointer"
                          title={ep.published ? 'ড্রাফট করুন' : 'প্রকাশ করুন'}
                        >
                          {ep.published ? (
                            <Badge variant="emerald" className="gap-1">
                              <Eye className="h-3 w-3" />
                              <span>প্রকাশিত</span>
                            </Badge>
                          ) : (
                            <Badge variant="muted" className="gap-1">
                              <EyeOff className="h-3 w-3" />
                              <span>ড্রাফট</span>
                            </Badge>
                          )}
                        </button>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openEditModal(ep)}
                            className="p-1.5 rounded-lg text-stone-500 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-sand-200/60 dark:hover:bg-emerald-900/40 transition-colors"
                            title="সম্পাদনা করুন"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingEpisode(ep)}
                            className="p-1.5 rounded-lg text-stone-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            title="মুছে ফেলুন"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <Card className="text-center py-12 border-dashed space-y-3">
          <Headphones className="h-10 w-10 text-stone-400 mx-auto" />
          <h3 className="text-sm font-medium text-sand-900 dark:text-stone-200">
            কোনো পর্ব পাওয়া যায়নি
          </h3>
          <p className="text-xs text-stone-400 max-w-xs mx-auto">
            "নতুন পর্ব যোগ করুন" বোতামে ক্লিক করে অডিও ফাইল আপলোড করুন।
          </p>
        </Card>
      )}

      {/* Create / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => !formLoading && setIsModalOpen(false)}
        title={editingEpisode ? 'পর্ব সম্পাদনা' : 'নতুন পর্ব আপলোড ও সংযোজন'}
        description="প্রাইভেট 'audio' বাকেটে ফাইল আপলোড করুন এবং পর্বের তথ্য পূরণ করুন"
        maxWidth="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-sand-800 dark:text-stone-300">
              মূল সিরিজ *
            </label>
            <select
              value={seriesId}
              onChange={(e) => setSeriesId(e.target.value)}
              required
              className="w-full rounded-xl border border-sand-300 dark:border-emerald-800/60 bg-white/70 dark:bg-emerald-deep/40 px-3.5 py-2.5 text-sm text-sand-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            >
              <option value="">— একটি সিরিজ নির্বাচন করুন —</option>
              {seriesList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title} {s.published ? '(প্রকাশিত)' : '(ড্রাফট)'}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="পর্বের শিরোনাম *"
              value={title}
              onChange={handleTitleChange}
              placeholder="যেমন: ভূমিকা ও সূচনা পাঠ"
              required
            />

            <Input
              label="স্লাগ (URL Slug) *"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="introductory-lecture"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="পর্ব নম্বর"
              type="number"
              value={episodeNumber}
              onChange={(e) => setEpisodeNumber(e.target.value)}
              placeholder="1"
              min="1"
            />

            <Input
              label="সময়কাল (সেকেন্ডে)"
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="স্বয়ংক্রিয়ভাবে সনাক্ত হবে"
              min="0"
            />
          </div>

          {/* Audio Upload Container */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-sand-800 dark:text-stone-300">
              অডিও ফাইল (প্রাইভেট 'audio' বাকেট) *
            </label>
            <div className="p-4 rounded-xl border border-dashed border-sand-300 dark:border-emerald-800/60 bg-sand-50/50 dark:bg-emerald-night/40 space-y-2">
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <input
                  type="file"
                  id="audio-file-input"
                  accept="audio/mpeg,audio/mp4,audio/aac,audio/ogg,audio/wav,.mp3,.m4a,.wav,.aac,.ogg"
                  onChange={handleAudioFileSelected}
                  disabled={uploadingAudio}
                  className="hidden"
                />
                <label
                  htmlFor="audio-file-input"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-medium cursor-pointer transition-colors shadow-sm disabled:opacity-50"
                >
                  {uploadingAudio ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>আপলোড হচ্ছে...</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="h-4 w-4" />
                      <span>{audioPath ? 'ফাইল পরিবর্তন করুন' : 'অডিও ফাইল নির্বাচন করুন'}</span>
                    </>
                  )}
                </label>

                {audioPath && (
                  <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400 font-mono truncate max-w-sm">
                    <FileAudio className="h-4 w-4 shrink-0" />
                    <span className="truncate">{selectedFileName || audioPath}</span>
                    <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />
                  </div>
                )}
              </div>

              <p className="text-[11px] text-stone-400">
                অনুমোদিত ফরম্যাট: MP3, M4A, WAV, AAC, OGG (সর্বোচ্চ ১০০ মেগাবাইট)। অডিওটি সরাসরি প্রাইভেট বাকেটে নিরাপদে সংরক্ষিত থাকবে।
              </p>
              {uploadError && (
                <p className="text-xs text-red-500 font-medium">{uploadError}</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-sand-800 dark:text-stone-300">
              আলোচনার বিবরণ (ঐচ্ছিক)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="এই পর্বের প্রধান বিষয়সমূহ ও নোট..."
              className="w-full rounded-xl border border-sand-300 dark:border-emerald-800/60 bg-white/70 dark:bg-emerald-deep/40 px-3.5 py-2.5 text-sm text-sand-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 resize-none"
            />
          </div>

          <div className="pt-2">
            <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-sand-800 dark:text-stone-300">
              <input
                type="checkbox"
                checked={published}
                onChange={(e) => setPublished(e.target.checked)}
                className="h-4 w-4 rounded accent-emerald-600"
              />
              <span>অবিলম্বে প্রকাশ করুন</span>
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-sand-200 dark:border-emerald-900/40">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsModalOpen(false)}
              disabled={formLoading || uploadingAudio}
            >
              বাতিল
            </Button>
            <Button
              type="submit"
              size="sm"
              isLoading={formLoading || uploadingAudio}
            >
              {editingEpisode ? 'সংরক্ষণ করুন' : 'পর্ব যোগ করুন'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deletingEpisode}
        onClose={() => setDeletingEpisode(null)}
        onConfirm={confirmDelete}
        title="অডিও পর্ব মুছে ফেলা"
        message={`আপনি কি নিশ্চিতভাবে "${deletingEpisode?.title}" পর্বটি মুছে ফেলতে চান? এটি ডেটাবেজ এবং প্রাইভেট স্টোরেজ উভয় স্থান থেকে স্থায়ীভাবে মুছে যাবে।`}
        confirmLabel="হ্যাঁ, মুছে ফেলুন"
        cancelLabel="না, রাখুন"
        isDangerous={true}
        isLoading={deleteLoading}
      />
    </div>
  );
};
