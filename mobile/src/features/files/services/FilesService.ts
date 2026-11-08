/** Export, backup and the sample file lists of the Files screen. */
import { Share } from 'react-native';
import type { DocumentItem, SavedDocument } from '../../inventory/types/document.types';
import { productsToCsv } from '../../products/services/ProductService';
import type { Product } from '../../products/types/product.types';
import type { FileEntry, FilesTab } from '../types/files.types';

export const FILE_TABS: [FilesTab, string][] = [['price', 'Прайс-листи'], ['invoice', 'Накладні'], ['export', 'Експорт']];

/** Demo entries until files are stored on the device. */
export const SAMPLE_FILES: Record<'price' | 'invoice', FileEntry[]> = {
    price: [{ name: 'pricelist_жовтень.xlsx', meta: '244 KB · Excel' }, { name: 'pricelist_вересень.xlsx', meta: '231 KB · Excel' }],
    invoice: [{ name: 'invoice_0213.csv', meta: '12 KB · CSV' }, { name: 'invoice_0229.csv', meta: '9 KB · CSV' }],
};

export function buildBackup(products: Product[], documents: SavedDocument[], currentDocument: DocumentItem[]) {
    return { created_at: new Date().toISOString(), products, documents, current_document: currentDocument };
}

export const FilesService = {
    exportProducts: (products: Product[]) => Share.share({ title: 'WareGo — товари CSV', message: productsToCsv(products) }),

    shareBackup: (products: Product[], documents: SavedDocument[], currentDocument: DocumentItem[]) =>
        Share.share({ title: 'Резервна копія WareGo', message: JSON.stringify(buildBackup(products, documents, currentDocument), null, 2) }),
};
