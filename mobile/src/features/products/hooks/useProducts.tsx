/** Products state shared by Home, Search, Scanner, Files and Profile. */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { ProductRepository } from '../repositories/ProductRepository';
import type { Product } from '../types/product.types';

type ProductsContextValue = {
    products: Product[];
    reload: () => Promise<void>;
};

const ProductsContext = createContext<ProductsContextValue | null>(null);

export function ProductsProvider({ children }: { children: React.ReactNode }) {
    const db = useSQLiteContext();
    const [products, setProducts] = useState<Product[]>([]);

    const reload = useCallback(async () => {
        setProducts(await ProductRepository.getAll(db));
    }, [db]);

    useEffect(() => {
        let active = true;
        ProductRepository.getAll(db)
            .then(rows => { if (active) setProducts(rows); })
            // Fast Refresh may close the previous SQLite context mid-query.
            .catch(error => { if (active) console.error('Помилка бази даних:', error); });
        return () => { active = false; };
    }, [db]);

    const value = useMemo(() => ({ products, reload }), [products, reload]);
    return <ProductsContext.Provider value={value}>{children}</ProductsContext.Provider>;
}

export function useProducts(): ProductsContextValue {
    const context = useContext(ProductsContext);
    if (!context) throw new Error('useProducts must be used inside ProductsProvider');
    return context;
}
