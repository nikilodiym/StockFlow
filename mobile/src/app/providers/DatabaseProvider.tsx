import React from 'react';
import { SQLiteProvider } from 'expo-sqlite';
import { DATABASE_NAME, initDatabase } from '../../database';

/** Opens the local SQLite database and runs migrations before rendering the app. */
export default function DatabaseProvider({ children }: { children: React.ReactNode }) {
    return (
        <SQLiteProvider databaseName={DATABASE_NAME} onInit={initDatabase}>
            {children}
        </SQLiteProvider>
    );
}
