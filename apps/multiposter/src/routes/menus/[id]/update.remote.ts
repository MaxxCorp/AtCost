import { form, requested } from '$app/server';
import { db, menu, menuItem, eq } from '@ac/db';
import { listMenus } from '../list.remote';
import { readMenu } from './read.remote';
import { getAuthenticatedUser, ensureAccess } from '$lib/server/authorization';
import { updateMenuSchema } from '@ac/validations';

export const updateMenu = form(updateMenuSchema, async (data) => {
    const user = getAuthenticatedUser();
    ensureAccess(user, 'menus');

    const result = await db.transaction(async (tx) => {
        const [updatedMenu] = await tx
            .update(menu)
            .set({
                name: data.name,
                description: data.description || null,
                isTemplate: data.isTemplate !== undefined ? Boolean(data.isTemplate) : true,
            })
            .where(eq(menu.id, data.id))
            .returning();

        if (!updatedMenu) {
            throw new Error('Menu not found');
        }

        // Delete existing items and re-insert
        await tx.delete(menuItem).where(eq(menuItem.menuId, data.id));

        let items: any[] = [];
        if (typeof data.items === 'string') {
            try { items = JSON.parse(data.items); } catch { items = []; }
        } else if (Array.isArray(data.items)) {
            items = data.items;
        }

        if (items.length > 0) {
            await tx.insert(menuItem).values(
                items.map((it: any, index: number) => ({
                    menuId: data.id,
                    itemType: it.itemType || 'consumable',
                    consumableId: it.itemType === 'consumable' ? (it.consumableId || null) : null,
                    recipeId: it.itemType === 'recipe' ? (it.recipeId || null) : null,
                    name: it.name || '',
                    description: it.description || null,
                    portionAmount: typeof it.portionAmount === 'number' ? it.portionAmount : parseFloat(String(it.portionAmount)) || 1,
                    unit: it.unit || null,
                    costPrice: typeof it.costPrice === 'number' ? it.costPrice : parseFloat(String(it.costPrice)) || 0,
                    factor: typeof it.factor === 'number' ? it.factor : parseFloat(String(it.factor)) || 2,
                    unitPrice: typeof it.unitPrice === 'number' ? it.unitPrice : parseFloat(String(it.unitPrice)) || 0,
                    sortOrder: it.sortOrder != null ? Number(it.sortOrder) : index,
                }))
            );
        }

        return updatedMenu;
    });

    try {
        await requested(listMenus, 20).refreshAll();
    } catch (e) {
        console.warn('--- updateMenu requested refresh warning ---', e);
    }
    try {
        await listMenus().refresh();
        await readMenu(data.id).refresh();
    } catch (refreshErr) {
        console.warn('--- updateMenu refresh warning ---', refreshErr);
    }

    return {
        success: true,
        menu: {
            ...result,
            createdAt: result.createdAt.toISOString(),
            updatedAt: result.updatedAt.toISOString(),
        }
    };
});
