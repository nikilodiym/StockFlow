/** Backup of local data (Files and Settings screens). */
import { useInventory } from '../../inventory/hooks/useInventory';
import { useProducts } from '../../products/hooks/useProducts';
import { FilesService } from '../services/FilesService';

export function useBackup() {
    const { products } = useProducts();
    const { savedDocs, items } = useInventory();
    return {
        createBackup: () => FilesService.shareBackup(products, savedDocs, items),
        exportProducts: () => FilesService.exportProducts(products),
    };
}
