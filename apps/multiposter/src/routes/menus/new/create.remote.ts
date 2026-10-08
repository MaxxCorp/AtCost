import { form, requested } from '$app/server';
import { db, menu, menuItem } from '@ac/db';
import { listMenus } from '../list.remote';
import { getAuthenticatedUser, ensureAccess } from '#lib/server/authorization.js';
import { createMenuSchema } from '@ac/validations';

export const createMenu = form(createMenuSchema, async (data) => {
    console.log('--- createMenu START ---', JSON.stringify(data));
    try {
        const user = getAuthenticatedUser();
        ensureAccess(user, 'menus');

        const result = await db.transaction(async (tx) => {
            const [newMenu] = await tx.insert(menu).values({
                userId: user.id,
                name: data.name,
                description: data.description || null,
                isTemplate: data.isTemplate !== undefined ? Boolean(data.isTemplate) : true,
            }).returning();

            let items: any[] = [];
            if (typeof data.items === 'string') {
                try { items = JSON.parse(data.items); } catch { items = []; }
            } else if (Array.isArray(data.items)) {
                items = data.items;
            }

            if (items.length > 0) {
                await tx.insert(menuItem).values(
                    items.map((it: any, index: number) => ({
                        menuId: newMenu.id,
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

            return newMenu;
        });

        try {
            await requested(listMenus, 20).refreshAll();
        } catch (e) {
            console.warn('--- createMenu requested refresh warning ---', e);
        }
        try {
            await listMenus().refresh();
        } catch (refreshErr) {
            console.warn('--- createMenu refresh warning ---', refreshErr);
        }
        console.log('--- createMenu SUCCESS ---', result.id);

        return {
            success: true,
            menu: {
                ...result,
                createdAt: result.createdAt.toISOString(),
                updatedAt: result.updatedAt.toISOString(),
            }
        };
    } catch (err: any) {
        console.error('--- createMenu ERROR ---', err);
        return {
            success: false,
            error: {
                message: err?.message || 'Failed to create menu'
            }
        };
    }
});
