import React, { useState } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Headphones,
  Search,
  UploadCloud,
  CheckCircle,
  AlertCircle,
  Star,
  Eye,
  EyeOff,
  ImageIcon,
} from 'lucide-react';
import { Button } from '../common/Button';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import { Input } from '../common/Input';
import { Modal } from '../common/Modal';
import { ConfirmDialog } from '../common/ConfirmDialog';
import {
  type SeriesWithCount,
  type CategoryWithCount,
  createSeries,
  updateSeries,
  deleteSeries,
  toggleSeriesPublish,
  toggleSeriesFeatured,
  uploadCoverImage,
} from '../../services/adminService';
import { getCoverImageUrl } from '../../lib/supabase';
import { toBengaliNumber } from '../../lib/utils';

interface SeriesManagerProps {
  seriesList: SeriesWithCount[];
  categories: CategoryWithCount[];
  onRefresh: () => void;
}

export const SeriesManager: React.FC<SeriesManagerProps> = ({
  seriesList,
  categories,
  onRefresh,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterPublished, setFilterPublished] = useState<string>('all');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSeries, setEditingSeries] = useState<SeriesWithCount | null>(null);

  // Form fields
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [description, setDescription] = useState('');
  const [featured, setFeatured] = useState(false);
  const [published, setPublished] = useState(false);

  // Cover image upload
  const [coverPath, setCoverPath] = useState<string | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Delete states
  const [deletingSeries, setDeletingSeries] = useState<SeriesWithCount | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const openCreateModal = () => {
    setEditingSeries(null);
    setTitle('');
    setSlug('');
    setCategoryId(categories.length > 0 ? categories[0].id : '');
    setDescription('');
    setCoverPath(null);
    setCoverPreviewUrl(null);
    setFeatured(false);
    setPublished(false);
    setFormError(null);
    setUploadError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (s: SeriesWithCount) => {
    setEditingSeries(s);
    setTitle(s.title);
    setSlug(s.slug);
    setCategoryId(s.category_id || '');
    setDescription(s.description || '');
    setCoverPath(s.cover_image);
    setCoverPreviewUrl(s.cover_image ? getCoverImageUrl(s.cover_image) : null);
    setFeatured(s.featured);
    setPublished(s.published);
    setFormError(null);
    setUploadError(null);
    setIsModalOpen(true);
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTitle(val);
    if (!editingSeries) {
      const generated = val
        .toLowerCase()
        .trim()
        .replace(/[\s_]+/g, '-')
        .replace(/[^\w-]/g, '');
      setSlug(generated);
    }
  };

  const handleCoverFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingCover(true);
    setUploadError(null);

    const res = await uploadCoverImage(file);
    setUploadingCover(false);

    if (res.error || !res.data) {
      setUploadError(res.error || 'ছবি আপলোড করতে ব্যর্থ হয়েছে।');
      return;
    }

    setCoverPath(res.data.path);
    setCoverPreviewUrl(res.data.publicUrl || null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      setFormError('সিরিজের শিরোনাম আবশ্যক।');
      return;
    }
    if (!slug.trim()) {
      setFormError('সিরিজের স্লাগ (slug) আবশ্যক।');
      return;
    }

    setFormLoading(true);
    setFormError(null);

    if (editingSeries) {
      const res = await updateSeries(
        editingSeries.id,
        {
          title,
          slug,
          category_id: categoryId || null,
          description,
          cover_image: coverPath,
          featured,
          published,
        },
        editingSeries.cover_image // Pass previous cover for cleanup if changed
      );

      if (res.error) {
        setFormError(res.error);
        setFormLoading(false);
        return;
      }
      setSuccessMessage('সিরিজ সফলভাবে হালনাগাদ করা হয়েছে।');
    } else {
      const res = await createSeries({
        title,
        slug,
        category_id: categoryId || null,
        description,
        cover_image: coverPath,
        featured,
        published,
      });

      if (res.error) {
        setFormError(res.error);
        setFormLoading(false);
        return;
      }
      setSuccessMessage('নতুন সিরিজ সফলভাবে তৈরি করা হয়েছে।');
    }

    setFormLoading(false);
    setIsModalOpen(false);
    onRefresh();
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleTogglePublish = async (s: SeriesWithCount) => {
    const next = !s.published;
    const res = await toggleSeriesPublish(s.id, next);
    if (!res.error) {
      onRefresh();
      setSuccessMessage(next ? 'সিরিজটি প্রকাশিত হয়েছে।' : 'সিরিজটি ড্রাফটে নেওয়া হয়েছে।');
      setTimeout(() => setSuccessMessage(null), 2500);
    }
  };

  const handleToggleFeatured = async (s: SeriesWithCount) => {
    const next = !s.featured;
    const res = await toggleSeriesFeatured(s.id, next);
    if (!res.error) {
      onRefresh();
      setSuccessMessage(next ? 'ফিচার্ড তালিকায় যুক্ত করা হয়েছে।' : 'ফিচার্ড থেকে সরানো হয়েছে।');
      setTimeout(() => setSuccessMessage(null), 2500);
    }
  };

  const confirmDelete = async () => {
    if (!deletingSeries) return;
    setDeleteLoading(true);
    setDeleteError(null);

    const res = await deleteSeries(deletingSeries.id);
    setDeleteLoading(false);

    if (res.error) {
      setDeleteError(res.error);
      setDeletingSeries(null);
      onRefresh();
      return;
    }

    setDeletingSeries(null);
    setSuccessMessage('সিরিজ ও সংশ্লিষ্ট কভার ইমেজ সফলভাবে অপসারিত হয়েছে।');
    onRefresh();
    setTimeout(() => setSuccessMessage(null), 3500);
  };

  // Filtered series list
  const filtered = seriesList.filter((s) => {
    const matchesSearch =
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.slug.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      filterCategory === 'all' || s.category_id === filterCategory;
    const matchesPublished =
      filterPublished === 'all' ||
      (filterPublished === 'published' && s.published) ||
      (filterPublished === 'draft' && !s.published);

    return matchesSearch && matchesCategory && matchesPublished;
  });

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-sand-900 dark:text-stone-100">
            সিরিজ ব্যবস্থাপনা ({toBengaliNumber(seriesList.length)})
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            ধারাবাহিক অডিও আলোচনা ও কভার ইমেজ পরিচালনা করুন
          </p>
        </div>

        <Button onClick={openCreateModal} size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          <span>নতুন সিরিজ তৈরি করুন</span>
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
            placeholder="সিরিজের নাম খুঁজুন..."
            icon={<Search className="h-4 w-4" />}
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="rounded-xl border border-sand-300 dark:border-emerald-800/60 bg-white/70 dark:bg-emerald-deep/40 px-3 py-2 text-xs text-sand-900 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-600"
          >
            <option value="all">সকল বিষয়</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
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

      {/* Series Table */}
      {filtered.length > 0 ? (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-sand-100/70 dark:bg-emerald-950/60 text-stone-500 dark:text-stone-400 border-b border-sand-200 dark:border-emerald-900/40">
                <tr>
                  <th className="py-3 px-4">কভার ও সিরিজ</th>
                  <th className="py-3 px-4">ক্যাটাগরি</th>
                  <th className="py-3 px-4">পর্ব সংখ্যা</th>
                  <th className="py-3 px-4 text-center">ফিচার্ড</th>
                  <th className="py-3 px-4 text-center">অবস্থা</th>
                  <th className="py-3 px-4 text-right">পদক্ষেপ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-200/50 dark:divide-emerald-900/30">
                {filtered.map((s) => (
                  <tr
                    key={s.id}
                    className="hover:bg-sand-50/50 dark:hover:bg-emerald-900/20 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-xl bg-sand-200 dark:bg-emerald-deep overflow-hidden shrink-0 flex items-center justify-center border border-sand-300/40 dark:border-emerald-800/40">
                          {s.cover_image ? (
                            <img
                              src={getCoverImageUrl(s.cover_image) || ''}
                              alt={s.title}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <Headphones className="h-5 w-5 text-stone-400" />
                          )}
                        </div>
                        <div className="min-w-0 max-w-xs">
                          <span className="font-semibold text-sand-900 dark:text-stone-100 block truncate">
                            {s.title}
                          </span>
                          <span className="text-[11px] font-mono text-stone-400 truncate block">
                            /{s.slug}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4 text-stone-600 dark:text-stone-300">
                      {s.category ? (
                        <Badge variant="emerald">{s.category.name}</Badge>
                      ) : (
                        <span className="text-stone-400">নির্ধারিত নেই</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-stone-600 dark:text-stone-300 font-medium">
                      {toBengaliNumber(s.episodes_count || 0)} টি পর্ব
                    </td>

                    <td className="py-3 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleFeatured(s)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          s.featured
                            ? 'text-amber-500 hover:bg-amber-500/10'
                            : 'text-stone-400 hover:text-stone-600 hover:bg-sand-200/40'
                        }`}
                        title={s.featured ? 'ফিচার্ড থেকে সরান' : 'ফিচার্ড করুন'}
                      >
                        <Star className={`h-4 w-4 ${s.featured ? 'fill-current' : ''}`} />
                      </button>
                    </td>

                    <td className="py-3 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleTogglePublish(s)}
                        className="inline-flex items-center gap-1 cursor-pointer"
                        title={s.published ? 'ড্রাফট করুন' : 'প্রকাশ করুন'}
                      >
                        {s.published ? (
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
                          onClick={() => openEditModal(s)}
                          className="p-1.5 rounded-lg text-stone-500 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-sand-200/60 dark:hover:bg-emerald-900/40 transition-colors"
                          title="সম্পাদনা করুন"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingSeries(s)}
                          className="p-1.5 rounded-lg text-stone-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="মুছে ফেলুন"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <Card className="text-center py-12 border-dashed space-y-3">
          <Headphones className="h-10 w-10 text-stone-400 mx-auto" />
          <h3 className="text-sm font-medium text-sand-900 dark:text-stone-200">
            কোনো সিরিজ পাওয়া যায়নি
          </h3>
          <p className="text-xs text-stone-400 max-w-xs mx-auto">
            উপরে "নতুন সিরিজ তৈরি করুন" বোতামে ক্লিক করে প্রথম সিরিজ যোগ করুন।
          </p>
        </Card>
      )}

      {/* Create / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => !formLoading && setIsModalOpen(false)}
        title={editingSeries ? 'সিরিজ সম্পাদনা' : 'নতুন সিরিজ তৈরি'}
        description="সিরিজের নাম, কভার ইমেজ, ক্যাটাগরি এবং স্ট্যাটাস নির্ধারণ করুন"
        maxWidth="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="সিরিজের নাম *"
              value={title}
              onChange={handleTitleChange}
              placeholder="যেমন: সীরাতুর রাসূল (সা.)"
              required
            />

            <Input
              label="স্লাগ (URL Slug) *"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="seerat-ur-rasool"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-sand-800 dark:text-stone-300">
              ক্যাটাগরি
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full rounded-xl border border-sand-300 dark:border-emerald-800/60 bg-white/70 dark:bg-emerald-deep/40 px-3.5 py-2.5 text-sm text-sand-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            >
              <option value="">— ক্যাটাগরি নেই —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Cover image upload container */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-sand-800 dark:text-stone-300">
              কভার ইমেজ (পাবলিক 'covers' বাকেট)
            </label>
            <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-xl border border-dashed border-sand-300 dark:border-emerald-800/60 bg-sand-50/50 dark:bg-emerald-night/40">
              {coverPreviewUrl ? (
                <div className="relative h-20 w-20 rounded-xl overflow-hidden shrink-0 border border-sand-300 dark:border-emerald-800">
                  <img
                    src={coverPreviewUrl}
                    alt="Cover preview"
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : (
                <div className="h-20 w-20 rounded-xl bg-sand-200 dark:bg-emerald-deep flex items-center justify-center shrink-0">
                  <ImageIcon className="h-8 w-8 text-stone-400" />
                </div>
              )}

              <div className="flex-1 space-y-1 text-center sm:text-left">
                <input
                  type="file"
                  id="cover-file-input"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleCoverFileSelected}
                  disabled={uploadingCover}
                  className="hidden"
                />
                <label
                  htmlFor="cover-file-input"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-sand-300 dark:border-emerald-800 bg-white dark:bg-emerald-900/40 text-xs font-medium cursor-pointer hover:bg-sand-100 transition-colors"
                >
                  <UploadCloud className="h-4 w-4" />
                  <span>{uploadingCover ? 'আপলোড হচ্ছে...' : 'নতুন ছবি নির্বাচন করুন'}</span>
                </label>
                <p className="text-[11px] text-stone-400">
                  অনুমোদিত ফরম্যাট: JPG, PNG, WEBP (সর্বোচ্চ ৫ মেগাবাইট)
                </p>
                {uploadError && (
                  <p className="text-xs text-red-500">{uploadError}</p>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-sand-800 dark:text-stone-300">
              বিবরণ (ঐচ্ছিক)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="সিরিজের সারসংক্ষেপ বা আলোচকের বিবরণ..."
              className="w-full rounded-xl border border-sand-300 dark:border-emerald-800/60 bg-white/70 dark:bg-emerald-deep/40 px-3.5 py-2.5 text-sm text-sand-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 resize-none"
            />
          </div>

          <div className="flex items-center gap-6 pt-2">
            <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-sand-800 dark:text-stone-300">
              <input
                type="checkbox"
                checked={featured}
                onChange={(e) => setFeatured(e.target.checked)}
                className="h-4 w-4 rounded accent-emerald-600"
              />
              <span>ফিচার্ড তালিকায় দেখান</span>
            </label>

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
              disabled={formLoading || uploadingCover}
            >
              বাতিল
            </Button>
            <Button
              type="submit"
              size="sm"
              isLoading={formLoading || uploadingCover}
            >
              {editingSeries ? 'সংরক্ষণ করুন' : 'সিরিজ তৈরি করুন'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deletingSeries}
        onClose={() => setDeletingSeries(null)}
        onConfirm={confirmDelete}
        title="সিরিজ ও পর্বসমূহ মুছে ফেলা"
        message={
          deletingSeries?.episodes_count && deletingSeries.episodes_count > 0
            ? `সতর্কতা: "${deletingSeries.title}" সিরিজের অধীনে ${deletingSeries.episodes_count} টি পর্ব এবং সংশ্লিষ্ট অডিও ফাইল রয়েছে। সিরিজ মুছে ফেললে সমস্ত পর্ব ও অডিও স্টোরেজ ফাইল স্থায়ীভাবে মুছে যাবে।`
            : `আপনি কি নিশ্চিতভাবে "${deletingSeries?.title}" সিরিজ মুছে ফেলতে চান?`
        }
        confirmLabel="হ্যাঁ, নিশ্চিতভাবে মুছে ফেলুন"
        cancelLabel="না, রাখুন"
        isDangerous={true}
        isLoading={deleteLoading}
      />
    </div>
  );
};
