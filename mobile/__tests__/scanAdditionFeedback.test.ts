jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: jest.fn() }) }));
jest.mock('expo-sqlite', () => ({ useSQLiteContext: () => ({}) }));
jest.mock('../src/app/providers/DialogProvider', () => ({ useDialog: () => ({ showDialog: jest.fn() }) }));
jest.mock('../src/app/providers/SettingsProvider', () => ({
    useSettings: () => ({ soundOn: true, vibrationOn: true }),
}));
jest.mock('../src/features/products/hooks/useProducts', () => ({ useProducts: () => ({ products: [] }) }));
jest.mock('../src/features/inventory/hooks/useInventory', () => ({
    useInventory: () => ({ addItem: mockAddItem, quantity: '1' }),
}));
jest.mock('../src/hooks/usePermissions', () => ({
    usePermissions: () => ({ requirePermission: jest.fn(), reportError: jest.fn() }),
}));
jest.mock('../src/features/products/services/ProductService', () => ({
    ProductService: { findByBarcode: jest.fn(), find: jest.fn() },
}));
jest.mock('../src/features/scanner/services/ScanFeedbackService', () => ({
    ScanFeedbackService: { play: jest.fn().mockResolvedValue(undefined) },
}));

import { useAddProduct } from '../src/features/inventory/hooks/useAddProduct';
import { ProductService } from '../src/features/products/services/ProductService';
import { ScanFeedbackService } from '../src/features/scanner/services/ScanFeedbackService';
const mockAddItem = jest.fn();
const product = { id: 1, sku: 'A1', barcode: '4820119020001', name: 'Товар', unit: 'шт', stock: 0 };
beforeEach(() => {
    jest.clearAllMocks();
    mockAddItem.mockResolvedValue(undefined);
});

it('emits one success after the scanned item has been written, with no duplicate vibration', async () => {
    jest.mocked(ProductService.findByBarcode).mockResolvedValue(product);
    expect(await useAddProduct().find(product.barcode, 'scan')).toBe(true);
    expect(mockAddItem).toHaveBeenCalledTimes(1);
    expect(ScanFeedbackService.play).toHaveBeenCalledTimes(1);
    expect(ScanFeedbackService.play).toHaveBeenCalledWith('success', { soundOn: true, vibrationOn: true });
    expect(mockAddItem.mock.invocationCallOrder[0]).toBeLessThan(
        jest.mocked(ScanFeedbackService.play).mock.invocationCallOrder[0],
    );
});
it('emits an error instead of success if adding the item fails', async () => {
    jest.mocked(ProductService.findByBarcode).mockResolvedValue(product);
    mockAddItem.mockRejectedValueOnce(new Error('Database busy'));
    expect(await useAddProduct().find(product.barcode, 'scan')).toBe(false);
    expect(ScanFeedbackService.play).toHaveBeenCalledTimes(1);
    expect(ScanFeedbackService.play).toHaveBeenCalledWith('error', expect.anything());
});
it('does not add an unknown barcode or play a success sound', async () => {
    jest.mocked(ProductService.findByBarcode).mockResolvedValue(null);
    expect(await useAddProduct().find('unknown', 'scan')).toBe(false);
    expect(mockAddItem).not.toHaveBeenCalled();
    expect(ScanFeedbackService.play).toHaveBeenCalledTimes(1);
    expect(ScanFeedbackService.play).toHaveBeenCalledWith('error', expect.anything());
});
