import React from 'react';
import Svg, { Path } from 'react-native-svg';
import paths from '../../assets/icons/logo.json';
export default function Logo() {
    return (
        <Svg width={48} height={54} viewBox="177 58 48 54" accessible={false}>
            {paths.map((p, i) => (
                <Path key={i} d={p.d} fill={p.fill} />
            ))}
        </Svg>
    );
}
