import type { Model } from 'mongoose';
import type { ICategory } from '~/types';
import { tenantSafeBulkWrite } from '~/utils/tenantBulkWrite';

const defaultMarketingCategories: Array<Pick<ICategory, 'label' | 'value' | 'icon' | 'order'>> = [
  { label: 'com_ui_cat_briefing', value: 'briefing', icon: '📋', order: 0 },
  { label: 'com_ui_cat_roteiro', value: 'roteiro', icon: '🎬', order: 1 },
  { label: 'com_ui_cat_planejamento', value: 'planejamento', icon: '📅', order: 2 },
  { label: 'com_ui_cat_copywriting', value: 'copywriting', icon: '✍️', order: 3 },
  { label: 'com_ui_cat_analise_dados', value: 'analise_dados', icon: '📊', order: 4 },
  { label: 'com_ui_cat_relatorios', value: 'relatorios', icon: '📄', order: 5 },
  { label: 'com_ui_cat_seo', value: 'seo', icon: '🔍', order: 6 },
  { label: 'com_ui_cat_midia_paga', value: 'midia_paga', icon: '💰', order: 7 },
  { label: 'com_ui_cat_social_media', value: 'social_media', icon: '📱', order: 8 },
  { label: 'com_ui_cat_email_marketing', value: 'email_marketing', icon: '📧', order: 9 },
  { label: 'com_ui_cat_criativo', value: 'criativo', icon: '🎨', order: 10 },
  { label: 'com_ui_cat_estrategia', value: 'estrategia', icon: '🎯', order: 11 },
];

export type CategoryOption = { label: string; value: string; icon?: string };

export function createCategoriesMethods(_mongoose: typeof import('mongoose')) {
  /**
   * Retrieves categories for the current tenant.
   * Falls back to seeding defaults if none exist.
   */
  async function getCategories(): Promise<CategoryOption[]> {
    const Category = _mongoose.models.Category as Model<ICategory>;
    const docs = await Category.find({}).sort({ order: 1, label: 1 }).lean();
    return docs.map((doc) => ({ label: doc.label, value: doc.value, icon: doc.icon }));
  }

  /**
   * Create a new category.
   */
  async function createPromptCategory(
    data: Pick<ICategory, 'label' | 'value' | 'icon' | 'order'>,
  ): Promise<ICategory> {
    const Category = _mongoose.models.Category as Model<ICategory>;
    return await Category.create(data);
  }

  /**
   * Update a category by its MongoDB _id.
   */
  async function updatePromptCategory(
    id: string,
    data: Partial<Pick<ICategory, 'label' | 'icon' | 'order'>>,
  ): Promise<ICategory | null> {
    const Category = _mongoose.models.Category as Model<ICategory>;
    return await Category.findByIdAndUpdate(id, { $set: data }, { new: true }).lean();
  }

  /**
   * Delete a category by its MongoDB _id.
   */
  async function deletePromptCategory(id: string): Promise<boolean> {
    const Category = _mongoose.models.Category as Model<ICategory>;
    const result = await Category.findByIdAndDelete(id);
    return result !== null;
  }

  /**
   * Count how many PromptGroups use a given category value.
   */
  async function countPromptCategoryUsage(value: string): Promise<number> {
    const PromptGroup = _mongoose.models.PromptGroup;
    if (!PromptGroup) {
      return 0;
    }
    return await PromptGroup.countDocuments({ category: value });
  }

  /**
   * Seed default marketing categories for the current tenant.
   * Uses bulk write for efficiency.
   */
  async function ensureDefaultPromptCategories(): Promise<boolean> {
    const Category = _mongoose.models.Category as Model<ICategory>;
    const existing = await Category.find({}).lean();
    if (existing.length > 0) {
      return false;
    }

    const ops = defaultMarketingCategories.map((cat) => ({
      insertOne: { document: { ...cat, isDefault: true } },
    }));

    await tenantSafeBulkWrite(Category, ops, { ordered: false });
    return true;
  }

  return {
    getCategories,
    createPromptCategory,
    updatePromptCategory,
    deletePromptCategory,
    countPromptCategoryUsage,
    ensureDefaultPromptCategories,
  };
}

export type CategoriesMethods = ReturnType<typeof createCategoriesMethods>;
