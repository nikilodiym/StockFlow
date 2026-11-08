import React from 'react';
import { Text, View } from 'react-native';
import s from '../../../constants/styles';
import { colors } from '../../../constants/colors';
import Icon from '../../../components/ui/Icon';
import Switch from '../../../components/ui/Switch';

/** Online/offline work mode switch with the network status. */
export default function OnlineModeCard({ onlineMode, online, onToggle }: { onlineMode: boolean; online: boolean; onToggle: () => void }) {
    return (
        <View style={[s.onlineCard, onlineMode ? s.onlineCardOn : s.onlineCardOff]}>
            <View style={s.rowBetween}>
                <View style={s.rowInline}>
                    <Icon name="wifi" size={20} color={onlineMode ? colors.primary : colors.black} />
                    <View>
                        <Text style={s.onlineTitle}>{onlineMode ? 'Онлайн' : 'Офлайн'}</Text>
                        <Text style={s.mutedSmall}>{onlineMode ? (online ? 'Мережа доступна' : 'Режим онлайн увімкнено') : 'Застосунок працює без мережі'}</Text>
                    </View>
                </View>
                <Switch value={onlineMode} onToggle={onToggle} offlineStyle />
            </View>
        </View>
    );
}
