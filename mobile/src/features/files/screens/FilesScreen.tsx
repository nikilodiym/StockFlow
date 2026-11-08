import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import s from '../../../constants/styles';
import { colors } from '../../../constants/colors';
import Button from '../../../components/ui/Button';
import Icon from '../../../components/ui/Icon';
import Header, { HeaderIconButton } from '../../../components/layout/Header';
import ScreenContainer from '../../../components/layout/ScreenContainer';
import { useDialog } from '../../../app/providers/DialogProvider';
import FileRow from '../components/FileRow';
import { useBackup } from '../hooks/useBackup';
import { FILE_TABS, SAMPLE_FILES } from '../services/FilesService';
import type { FilesTab } from '../types/files.types';

/** Files tab: CSV import, folders, price lists, invoices, export and backup. */
export default function FilesScreen() {
    const navigation = useNavigation();
    const { showDialog } = useDialog();
    const { createBackup, exportProducts } = useBackup();
    const [tab, setTab] = useState<FilesTab>('price');
    const [folder, setFolder] = useState('');
    const [customFolders, setCustomFolders] = useState<string[]>([]);

    const createFolder = () => showDialog('Створити папку', 'Введіть назву нової папки.', [
        { label: 'Скасувати', tone: 'neutral' },
        {
            label: 'Створити',
            tone: 'primary',
            onPress: value => {
                const name = (value ?? '').trim();
                if (!name) {
                    showDialog('Введіть назву папки', 'Назва не може бути порожньою.', undefined, 'error');
                    return;
                }
                setCustomFolders(list => (list.includes(name) ? list : [...list, name]));
                setFolder(name);
                showDialog('Папку створено', `Папка «${name}» готова до використання.`, undefined, 'success');
            },
        },
    ], 'input');

    const openImport = () => navigation.navigate('Import');
    const files = tab === 'export' ? [] : SAMPLE_FILES[tab];

    return (
        <ScreenContainer withTabBar>
            <Header title="Файли та імпорт" right={<HeaderIconButton label="Резервна копія" onPress={() => void createBackup()}><Icon name="plus" size={20} color={colors.text} /></HeaderIconButton>} />
            <ScrollView contentContainerStyle={s.pageBody}>
                <View style={s.importHero}>
                    <View style={s.importBadge}><Icon name="upload" size={22} color={colors.primary} /></View>
                    <Text style={s.emptyTitle}>Імпорт CSV / Excel</Text>
                    <Text style={s.mutedCenter}>Завантажте товари або накладну. Формати .csv, .xlsx · до 20 MB</Text>
                    <Button variant="yellow" icon="upload" label="Обрати файл" onPress={openImport} />
                    <Text style={s.importFootnote}>Поля: штрихкод, SKU, назва, кількість</Text>
                </View>
                <Pressable style={s.createFolderButton} onPress={createFolder}>
                    <Icon name="plus" size={17} color={colors.primary} />
                    <Text style={s.linkText}>Створити папку</Text>
                </Pressable>
                <ScrollView horizontal style={{ flexGrow: 0 }} showsHorizontalScrollIndicator={false} contentContainerStyle={s.filesTabs}>
                    {FILE_TABS.map(([key, label]) => (
                        <Pressable key={key} style={[s.fileTab, tab === key && s.fileTabActive]} onPress={() => setTab(key)}>
                            <Text style={[s.fileTabText, tab === key && s.fileTabTextActive]}>{label}  ·  {key === 'export' ? 0 : SAMPLE_FILES[key].length}</Text>
                        </Pressable>
                    ))}
                </ScrollView>
                {folder !== '' && <Pressable style={s.folderFilter} onPress={() => setFolder('')}><Text style={s.linkText}>{folder}  ×</Text></Pressable>}
                {files.map(file => <FileRow key={file.name} title={file.name} meta={file.meta} onPress={openImport} />)}
                {tab === 'export' && (
                    <>
                        <FileRow icon="upload" title="Експорт товарів у CSV" onPress={() => void exportProducts()} />
                        <FileRow icon="database" title="Створити резервну копію" onPress={() => void createBackup()} />
                    </>
                )}
                <Text style={s.centerCaption}>Локальні файли · доступні в офлайн-режимі</Text>
            </ScrollView>
        </ScreenContainer>
    );
}
