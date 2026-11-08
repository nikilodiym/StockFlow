import type { SQLiteDatabase } from 'expo-sqlite';
import { apiRequest, readJson } from '../../../services/api/client';
import { PermissionError } from '../../auth/services/PermissionService';
import { ProductRepository } from '../repositories/ProductRepository';
import type { Product, ProductDraft, ServerProduct } from '../types/product.types';

export function validateProductDraft(draft: ProductDraft): ProductDraft {
    const value = {
        sku: draft.sku.trim(),
        name: draft.name.trim(),
        barcode: draft.barcode.trim(),
        unit: draft.unit.trim(),
    };
    if (!value.name) throw new Error('Введіть назву товару.');
    if (!value.sku) throw new Error('Введіть SKU товару.');
    if (value.sku.length > 64) throw new Error('SKU не може перевищувати 64 символи.');
    if (!value.unit) throw new Error('Оберіть одиницю виміру.');
    if (value.barcode && !/^[\x21-\x7E]{1,64}$/.test(value.barcode))
        throw new Error('Штрихкод має містити від 1 до 64 латинських літер, цифр або знаків без пробілів.');
    return value;
}

function errorMessage(data: Record<string, unknown>): string {
    return (
        Object.entries(data)
            .map(
                ([field, value]) =>
                    `${field === 'detail' ? '' : field + ': '}${Array.isArray(value) ? value.join(' ') : String(value)}`,
            )
            .join('\n') || 'Не вдалося створити товар.'
    );
}

export const ProductCreationService = {
    async create(db: SQLiteDatabase, serverUrl: string, token: string, draft: ProductDraft): Promise<Product> {
        const value = validateProductDraft(draft);
        const duplicate = await ProductRepository.duplicate(db, value.sku, value.barcode);
        if (duplicate) throw new Error(`Товар «${duplicate.name}» із таким SKU або штрихкодом уже є в каталозі.`);
        // The API is authoritative: a successful server write is required before
        // a product becomes available for shared warehouse documents.
        const response = await apiRequest(serverUrl, '/products/', { method: 'POST', token, body: value });
        if (response.status === 403)
            throw new PermissionError(
                'Створювати товари може лише адміністратор. Зверніться до адміністратора складу.',
            );
        const data = await readJson<ServerProduct & Record<string, unknown>>(response);
        if (response.status === 401) throw new Error('Сеанс завершився. Увійдіть до облікового запису ще раз.');
        if (!response.ok) throw new Error(errorMessage(data));
        if (!data.id || !data.sku)
            throw new Error('Сервер повернув некоректну картку товару. Оновіть каталог перед повторною спробою.');
        await ProductRepository.upsertFromServer(db, data);
        const product = await ProductRepository.getBySku(db, data.sku);
        if (!product) throw new Error('Товар створено на сервері. Оновіть каталог на пристрої.');
        return product;
    },
};
