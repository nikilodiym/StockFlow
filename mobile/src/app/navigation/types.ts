/** Route names and their params (typed navigation). */
import type { NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type AuthStackParamList = {
    Login: undefined;
};

export type TabParamList = {
    Home: undefined;
    Documents: undefined;
    Files: undefined;
    Profile: undefined;
};

export type RootStackParamList = {
    Tabs: NavigatorScreenParams<TabParamList> | undefined;
    Scanner: undefined;
    Search: { selectedProductId?: number } | undefined;
    CreateProduct: { barcode?: string } | undefined;
    /** Without docId — the current (unsaved) document. */
    DocumentDetail: { docId?: string } | undefined;
    Conflict: { docId: string };
    Settings: undefined;
    Import: undefined;
    Notifications: undefined;
};

export type RootScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, T>;

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace ReactNavigation {
        // eslint-disable-next-line @typescript-eslint/no-empty-object-type
        interface RootParamList extends RootStackParamList {}
    }
}
