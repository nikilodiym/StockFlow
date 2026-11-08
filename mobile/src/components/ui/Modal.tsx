import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppStyles } from '../../constants/styles';
import { colors } from '../../constants/colors';
import type { AppDialog, DialogAction } from '../../types';
import Icon from './Icon';

type Props = {
    dialog: AppDialog;
    onClose: () => void;
    onAction: (action: DialogAction, value?: string) => void;
};

/** App dialog: info / success / error / confirm / bottom sheet / text input. */
export default function Modal({ dialog, onClose, onAction }: Props) {
    const s = useAppStyles();
    const { height } = useWindowDimensions();
    const insets = useSafeAreaInsets();

    const [value, setValue] = useState('');
    useEffect(() => setValue(''), [dialog]);

    const sheet = dialog.kind === 'sheet';
    const permission = dialog.kind === 'permission';
    const icon =
        dialog.kind === 'error' ? 'warning' : dialog.kind === 'success' ? 'check' : sheet ? 'folder' : 'warning';

    return (
        <View style={s.modalRoot}>
            <Pressable style={s.modalScrim} onPress={onClose} />
            <View
                style={[
                    s.dialogCard,
                    sheet && s.dialogSheet,
                    { padding: 0, maxHeight: height - insets.top - insets.bottom - 32 },
                ]}
            >
                <ScrollView
                    style={{ flexGrow: 0, flexShrink: 1 }}
                    contentContainerStyle={{ padding: s.dialogCard.padding }}
                    keyboardShouldPersistTaps="handled"
                >
                    {!permission && <View style={s.dialogHandle} />}
                    <View style={s.dialogHead}>
                        <View
                            style={[
                                s.dialogIcon,
                                dialog.kind === 'error' && s.dialogIconError,
                                dialog.kind === 'success' && s.dialogIconSuccess,
                                permission && { backgroundColor: '#FFF2C6' },
                            ]}
                        >
                            <Icon
                                name={icon}
                                size={21}
                                color={
                                    permission ? '#B78A10' : dialog.kind === 'error' ? colors.danger : colors.primary
                                }
                            />
                        </View>
                        {!permission && (
                            <Pressable style={s.dialogClose} onPress={onClose}>
                                <Icon name="close" size={18} color={colors.closeIcon} />
                            </Pressable>
                        )}
                    </View>
                    <Text style={s.dialogTitle}>{dialog.title}</Text>
                    {!!dialog.message && <Text style={s.dialogMessage}>{dialog.message}</Text>}
                    {dialog.kind === 'input' && (
                        <TextInput
                            autoFocus
                            style={s.dialogInput}
                            placeholder={dialog.placeholder || 'Назва папки'}
                            value={value}
                            onChangeText={setValue}
                        />
                    )}
                    <View style={[s.dialogActions, sheet && s.dialogSheetActions]}>
                        {dialog.actions.map((action, index) => (
                            <Pressable
                                key={action.label + index}
                                style={[
                                    s.dialogAction,
                                    action.tone === 'primary' && s.dialogPrimary,
                                    action.tone === 'danger' && s.dialogDanger,
                                    action.tone === 'neutral' && s.dialogNeutral,
                                    sheet && s.dialogSheetAction,
                                ]}
                                onPress={() => onAction(action, value)}
                            >
                                <Text
                                    style={[
                                        s.dialogActionText,
                                        action.tone === 'primary' && s.dialogPrimaryText,
                                        action.tone === 'danger' && s.dialogDangerText,
                                        action.tone === 'neutral' && s.dialogNeutralText,
                                        sheet && s.dialogSheetActionText,
                                    ]}
                                >
                                    {action.label}
                                </Text>
                            </Pressable>
                        ))}
                    </View>
                </ScrollView>
            </View>
        </View>
    );
}
