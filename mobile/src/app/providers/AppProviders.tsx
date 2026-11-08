/**
 * Order matters: each provider may use the ones above it.
 * Database → Dialog → Settings → Auth → Products → Inventory → Sync.
 */
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { InventoryProvider } from '../../features/inventory/hooks/useInventory';
import { ProductsProvider } from '../../features/products/hooks/useProducts';
import { AuthProvider } from './AuthProvider';
import DatabaseProvider from './DatabaseProvider';
import { DialogProvider } from './DialogProvider';
import { SettingsProvider } from './SettingsProvider';
import { SyncProvider } from './SyncProvider';

export default function AppProviders({ children }: { children: React.ReactNode }) {
    return (
        <SafeAreaProvider>
            <DatabaseProvider>
                <DialogProvider>
                    <SettingsProvider>
                        <AuthProvider>
                            <ProductsProvider>
                                <InventoryProvider>
                                    <SyncProvider>{children}</SyncProvider>
                                </InventoryProvider>
                            </ProductsProvider>
                        </AuthProvider>
                    </SettingsProvider>
                </DialogProvider>
            </DatabaseProvider>
        </SafeAreaProvider>
    );
}
