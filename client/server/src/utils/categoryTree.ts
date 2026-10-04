import mongoose from 'mongoose';
import Category from '../models/Category';

/** Look a category up by `_id`, falling back to `slug` for older links. */
export async function resolveCategory(categoryKey: string) {
    if (mongoose.isValidObjectId(categoryKey)) {
        const byId = await Category.findById(categoryKey);
        if (byId) return byId;
    }
    return Category.findOne({ slug: categoryKey });
}

/** The category plus every descendant — products are often tagged only with a subcategory. */
export async function getCategoryTreeIds(rootId: mongoose.Types.ObjectId): Promise<mongoose.Types.ObjectId[]> {
    const all = await Category.find({}, '_id parentId').lean<{ _id: mongoose.Types.ObjectId; parentId?: mongoose.Types.ObjectId | null }[]>();
    const childrenByParent = new Map<string, mongoose.Types.ObjectId[]>();
    for (const c of all) {
        if (!c.parentId) continue;
        const key = String(c.parentId);
        if (!childrenByParent.has(key)) childrenByParent.set(key, []);
        childrenByParent.get(key)!.push(c._id);
    }
    const ids: mongoose.Types.ObjectId[] = [rootId];
    const seen = new Set([String(rootId)]);
    for (let i = 0; i < ids.length; i++) {
        for (const child of childrenByParent.get(String(ids[i])) ?? []) {
            if (seen.has(String(child))) continue;
            seen.add(String(child));
            ids.push(child);
        }
    }
    return ids;
}
