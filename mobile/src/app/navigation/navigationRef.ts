/** Navigation from outside screens (e.g. a dialog action after sync). */
import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export function navigateToDocuments(): void {
    if (navigationRef.isReady()) navigationRef.navigate('Tabs', { screen: 'Documents' });
}
