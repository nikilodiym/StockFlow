import React from 'react';
import RootNavigator from './src/app/navigation/RootNavigator';
import AppProviders from './src/app/providers/AppProviders';

/** WareGo (StockFlow) mobile app: providers + navigation. */
export default function App() {
    return (
        <AppProviders>
            <RootNavigator />
        </AppProviders>
    );
}
