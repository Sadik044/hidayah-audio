import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Folder, Layers, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '../common/Button';
import { Card } from '../common/Card';
import { Input } from '../common/Input';
import { Modal } from '../common/Modal';
import { ConfirmDialog } from '../common/ConfirmDialog';
import {
  type CategoryWithCount,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../../services/adminService';
import { toBengaliNumber } from '../../lib/utils';

interface CategoryManagerProps {
  categories: CategoryWithCount[];
  onRefresh: () => void;
}

export const CategoryManager: React.FC<CategoryManagerProps> = ({ categories, onRefresh }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryWithCount | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Delete states
  const [deletingCategory, setDeletingCategory] = useState<CategoryWithCount | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const openCreateModal = () => {
    setEditingCategory(null);
    setName('');
    setSlug('');
    setDescription('');
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (cat: CategoryWithCount) => {
    setEditingCategory(cat);
    setName(cat.name);
    setSlug(cat.slug);
    setDescription(cat.description || '');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setName(val);
    // If creating new category, auto-generate slug
    if (!editingCategory) {
      const generated = val
        .toLowerCase()
        .trim()
        .replace(/[\s_]+/g, '-')
        .replace(/[^\w-]/g, '');
      setSlug(generated);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('ক্যাটাগরির নাম প্রদান করা আবশ্যক।');
      return;
    }
    if (!slug.trim()) {
      setFormError('ক্যাটাগরির স্লাগ (slug) প্রদান করা আবশ্যক।');
      return;
    }

    setFormLoading(true);
    setFormError(null);

    if (editingCategory) {
      const res = await updateCategory(editingCategory.id, {
        name,
        slug,
        description,
      });

      if (res.error) {
        setFormError(res.error);
        setFormLoading(false);
        return;
      }
      setSuccessMessage('ক্যাটাগরি সফলভাবে হালনাগাদ করা হয়েছে।');
    } else {
      const res = await createCategory({
        name,
        slug,
        description,
      });

      if (res.error) {
        setFormError(res.error);
        setFormLoading(false);
        return;
      }
      setSuccessMessage('নতুন ক্যাটাগরি সফলভাবে তৈরি করা হয়েছে।');
    }

    setFormLoading(false);
    setIsModalOpen(false);
    onRefresh();
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const confirmDelete = async () => {
    if (!deletingCategory) return;
    setDeleteLoading(true);
    setDeleteError(null);

    const res = await deleteCategory(deletingCategory.id);
    setDeleteLoading(false);

    if (res.error) {
      setDeleteError(res.error);
      setDeletingCategory(null);
      return;
    }

    setDeletingCategory(null);
    setSuccessMessage('ক্যাটাগরি মুছে ফেলা হয়েছে।');
    onRefresh();
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Top action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-sand-900 dark:text-stone-100">
            ক্যাটাগরি ব্যবস্থাপনা ({toBengaliNumber(categories.length)})
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            অডিও সিরিজের বিষয় ও শ্রেণীবিন্যাস পরিচালনা করুন
          </p>
        </div>

        <Button onClick={openCreateModal} size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          <span>নতুন ক্যাটাগরি</span>
        </Button>
      </div>

      {/* Success notification */}
      {successMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
          <CheckCircle className="h-4 w-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Delete error notification if any */}
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
            বন্ধ করুন
          </button>
        </div>
      )}

      {/* Categories table / cards */}
      {categories.length > 0 ? (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-sand-100/70 dark:bg-emerald-950/60 text-stone-500 dark:text-stone-400 border-b border-sand-200 dark:border-emerald-900/40">
                <tr>
                  <th className="py-3 px-4">ক্যাটাগরির নাম</th>
                  <th className="py-3 px-4">স্লাগ (Slug)</th>
                  <th className="py-3 px-4">বিবরণ</th>
                  <th className="py-3 px-4">সিরিজ সংখ্যা</th>
                  <th className="py-3 px-4 text-right">পদক্ষেপ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-200/50 dark:divide-emerald-900/30">
                {categories.map((cat) => (
                  <tr
                    key={cat.id}
                    className="hover:bg-sand-50/50 dark:hover:bg-emerald-900/20 transition-colors"
                  >
                    <td className="py-3.5 px-4 font-semibold text-sand-900 dark:text-stone-200">
                      <div className="flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 flex items-center justify-center shrink-0">
                          <Folder className="h-3.5 w-3.5" />
                        </div>
                        <span>{cat.name}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-stone-500 dark:text-stone-400">
                      {cat.slug}
                    </td>
                    <td className="py-3.5 px-4 text-stone-600 dark:text-stone-300 max-w-xs truncate">
                      {cat.description || '—'}
                    </td>
                    <td className="py-3.5 px-4 text-stone-600 dark:text-stone-300">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sand-200/60 dark:bg-emerald-900/40 font-medium">
                        <Layers className="h-3 w-3 text-stone-400" />
                        {toBengaliNumber(cat.series_count || 0)} টি
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openEditModal(cat)}
                          className="p-1.5 rounded-lg text-stone-500 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-sand-200/60 dark:hover:bg-emerald-900/40 transition-colors"
                          title="সম্পাদনা করুন"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingCategory(cat)}
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
          <Folder className="h-10 w-10 text-stone-400 mx-auto" />
          <h3 className="text-sm font-medium text-sand-900 dark:text-stone-200">
            কোনো ক্যাটাগরি তৈরি করা নেই
          </h3>
          <p className="text-xs text-stone-400 max-w-xs mx-auto">
            অডিও সিরিজের জন্য প্রথম বিষয় বা ক্যাটাগরি তৈরি করতে উপরের বোতামে ক্লিক করুন।
          </p>
        </Card>
      )}

      {/* Create / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => !formLoading && setIsModalOpen(false)}
        title={editingCategory ? 'ক্যাটাগরি সম্পাদনা' : 'নতুন ক্যাটাগরি তৈরি'}
        description="ক্যাটাগরির নাম, স্লাগ এবং সংক্ষিপ্ত পরিচিতি নির্ধারণ করুন"
        maxWidth="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <Input
            label="ক্যাটাগরির নাম *"
            value={name}
            onChange={handleNameChange}
            placeholder="যেমন: তাফসীরুল কুরআন"
            required
          />

          <Input
            label="স্লাগ (URL Slug) *"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="tafsir-ul-quran"
            required
          />

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-sand-800 dark:text-stone-300">
              বিবরণ (ঐচ্ছিক)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="এই ক্যাটাগরির অন্তর্ভুক্ত আলোচনার সংক্ষিপ্ত বিবরণ..."
              className="w-full rounded-xl border border-sand-300 dark:border-emerald-800/60 bg-white/70 dark:bg-emerald-deep/40 px-3.5 py-2.5 text-sm text-sand-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent transition-colors resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-sand-200 dark:border-emerald-900/40">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsModalOpen(false)}
              disabled={formLoading}
            >
              বাতিল
            </Button>
            <Button type="submit" size="sm" isLoading={formLoading}>
              {editingCategory ? 'সংরক্ষণ করুন' : 'তৈরি করুন'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deletingCategory}
        onClose={() => setDeletingCategory(null)}
        onConfirm={confirmDelete}
        title="ক্যাটাগরি মুছে ফেলা"
        message={
          deletingCategory?.series_count && deletingCategory.series_count > 0
            ? `সতর্কতা: "${deletingCategory.name}" ক্যাটাগরির অধীনে ${deletingCategory.series_count} টি সিরিজ বিদ্যমান। আগে সিরিজগুলো থেকে ক্যাটাগরি পরিবর্তন করুন।`
            : `আপনি কি নিশ্চিতভাবে "${deletingCategory?.name}" ক্যাটাগরি মুছে ফেলতে চান? এটি ফিরিয়ে আনা সম্ভব নয়।`
        }
        confirmLabel="হ্যাঁ, মুছে ফেলুন"
        cancelLabel="না, রাখুন"
        isDangerous={true}
        isLoading={deleteLoading}
      />
    </div>
  );
};
