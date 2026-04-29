import React, { useState, useCallback } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { OGDialog, OGDialogTitle, OGDialogContent } from '@librechat/client';
import { Pencil, Trash2 } from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';
import type { TCategory } from 'librechat-data-provider';
import {
  useGetCategories,
  useCreateCategoryMutation,
  useUpdateCategoryMutation,
  useDeleteCategoryMutation,
} from '~/data-provider';
import { useLocalize } from '~/hooks';

interface CategoryAdminModalProps extends Omit<DialogPrimitive.DialogProps, 'onOpenChange'> {
  onClose: () => void;
}

const CategoryAdminModal: React.FC<CategoryAdminModalProps> = ({ open, onClose }) => {
  const localize = useLocalize();
  const { data: categories = [] } = useGetCategories();
  const createMutation = useCreateCategoryMutation();
  const updateMutation = useUpdateCategoryMutation();
  const deleteMutation = useDeleteCategoryMutation();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editIcon, setEditIcon] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);

  const [newLabel, setNewLabel] = useState('');
  const [newIcon, setNewIcon] = useState('📋');
  const [showNewEmojiPicker, setShowNewEmojiPicker] = useState(false);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };

  const slugify = (text: string) =>
    text
      .toLowerCase()
      .trim()
      .replace(/[\s_]+/g, '_')
      .replace(/[^a-z0-9_]/g, '');

  const handleCreate = useCallback(() => {
    if (!newLabel.trim()) return;
    createMutation.mutate(
      {
        label: newLabel.trim(),
        value: slugify(newLabel.trim()),
        icon: newIcon,
        order: categories.length,
      },
      {
        onSuccess: () => {
          setNewLabel('');
          setNewIcon('📋');
        },
      },
    );
  }, [newLabel, newIcon, categories.length, createMutation]);

  const handleUpdate = useCallback(
    (id: string) => {
      updateMutation.mutate({ id, payload: { label: editLabel, icon: editIcon } });
      setEditingId(null);
    },
    [editLabel, editIcon, updateMutation],
  );

  const handleDelete = useCallback(
    (id: string, value: string) => {
      if (window.confirm(localize('com_ui_delete_prompt') as string)) {
        deleteMutation.mutate({ id, value });
      }
    },
    [deleteMutation, localize],
  );

  const startEdit = useCallback((category: TCategory) => {
    setEditingId(category.id ?? null);
    setEditLabel(category.label);
    setEditIcon(category.icon ?? '');
  }, []);

  const moveCategory = useCallback(
    (index: number, direction: -1 | 1) => {
      const target = index + direction;
      if (target < 0 || target >= categories.length) return;
      const category = categories[index];
      const swap = categories[target];
      if (category.id && swap.id) {
        updateMutation.mutate({ id: category.id, payload: { order: target } });
        updateMutation.mutate({ id: swap.id, payload: { order: index } });
      }
    },
    [categories, updateMutation],
  );

  return (
    <OGDialog open={open} onOpenChange={handleOpenChange}>
      <OGDialogContent className="max-h-[90vh] max-w-full overflow-y-auto bg-surface-primary text-text-primary md:max-w-[500px]">
        <OGDialogTitle>{localize('com_ui_manage_categories')}</OGDialogTitle>

        <div className="mt-4 space-y-4">
          {/* Create new */}
          <div className="rounded-lg border border-border-medium p-3">
            <h4 className="mb-2 text-sm font-medium">{localize('com_ui_create_category')}</h4>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowNewEmojiPicker(!showNewEmojiPicker)}
                className="grid h-9 w-9 place-items-center rounded-lg border border-border-medium text-lg"
              >
                {newIcon}
              </button>
              {showNewEmojiPicker && (
                <div className="absolute z-50 mt-10">
                  <EmojiPicker
                    onEmojiClick={(emojiData) => {
                      setNewIcon(emojiData.emoji);
                      setShowNewEmojiPicker(false);
                    }}
                    width={300}
                    height={350}
                  />
                </div>
              )}
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder={localize('com_ui_category_name') as string}
                className="flex-1 rounded-lg border border-border-medium bg-transparent px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-ring-primary"
              />
              <button
                type="button"
                onClick={handleCreate}
                disabled={!newLabel.trim() || createMutation.isLoading}
                className="rounded-lg bg-text-primary px-3 py-2 text-sm font-medium text-background disabled:opacity-50"
              >
                {localize('com_ui_create')}
              </button>
            </div>
          </div>

          {/* List */}
          <div className="space-y-2">
            {categories.map((category, index) => (
              <div
                key={category.id ?? category.value}
                className="flex items-center gap-2 rounded-lg border border-border-medium p-2"
              >
                {editingId === category.id ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowEmojiPicker(category.id ?? null)}
                      className="grid h-8 w-8 place-items-center rounded-lg border border-border-medium text-lg"
                    >
                      {editIcon || '📋'}
                    </button>
                    {showEmojiPicker === category.id && (
                      <div className="absolute z-50 mt-10">
                        <EmojiPicker
                          onEmojiClick={(emojiData) => {
                            setEditIcon(emojiData.emoji);
                            setShowEmojiPicker(null);
                          }}
                          width={300}
                          height={350}
                        />
                      </div>
                    )}
                    <input
                      type="text"
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      className="flex-1 rounded-lg border border-border-medium bg-transparent px-2 py-1 text-sm text-text-primary"
                    />
                    <button
                      type="button"
                      onClick={() => category.id && handleUpdate(category.id)}
                      className="rounded-lg bg-text-primary px-2 py-1 text-xs font-medium text-background"
                    >
                      {localize('com_ui_save')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="rounded-lg border border-border-medium px-2 py-1 text-xs"
                    >
                      {localize('com_ui_cancel')}
                    </button>
                  </>
                ) : (
                  <>
                    <span className="text-lg">{category.icon}</span>
                    <span className="flex-1 text-sm">{category.label}</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => moveCategory(index, -1)}
                        disabled={index === 0}
                        className="rounded p-1 text-xs disabled:opacity-30"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveCategory(index, 1)}
                        disabled={index === categories.length - 1}
                        className="rounded p-1 text-xs disabled:opacity-30"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => startEdit(category)}
                        className="rounded p-1 text-xs"
                        aria-label={localize('com_ui_edit')}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => category.id && handleDelete(category.id, category.value)}
                        className="rounded p-1 text-xs text-red-500"
                        aria-label={localize('com_ui_delete')}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </OGDialogContent>
    </OGDialog>
  );
};

export default CategoryAdminModal;
