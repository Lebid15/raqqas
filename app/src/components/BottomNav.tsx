import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import React from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../theme/ThemeProvider';
import { Txt } from './ui';

/**
 * الشريط السفلي — مطابق لـ .bottom-nav في design/style.css،
 * بما في ذلك زر «أضف إعلان» البارز فوق مستوى الشريط.
 */
export function BottomNav({ state, descriptors, navigation }: BottomTabBarProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        backgroundColor: t.colors.surface,
        borderTopWidth: 1,
        borderTopColor: t.colors.line,
        paddingBottom: insets.bottom,
      }}
    >
      <View
        style={[
          t.row,
          {
            height: t.sizes.navHeight,
            alignItems: 'center',
            maxWidth: 560,
            width: '100%',
            alignSelf: 'center',
          },
        ]}
      >
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const label = options.title ?? route.name;
          const icon = (options as { tabBarIcon?: string }).tabBarIcon ?? '•';
          const isFab = route.name === 'AddTab';
          const focused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name as never);
            }
          };

          if (isFab) {
            return (
              <View key={route.key} style={{ flex: 1, height: '100%' }}>
                <Pressable
                  onPress={onPress}
                  accessibilityLabel={label}
                  style={({ pressed }) => ({
                    position: 'absolute',
                    top: -24,
                    alignSelf: 'center',
                    width: t.sizes.fabSize,
                    height: t.sizes.fabSize,
                    borderRadius: t.radius.full,
                    backgroundColor: t.colors.brand,
                    borderWidth: 5,
                    borderColor: t.colors.surface,
                    alignItems: 'center',
                    justifyContent: 'center',
                    transform: [{ scale: pressed ? 0.93 : 1 }],
                    ...t.shadow('md'),
                  })}
                >
                  <Txt size={30} weight={400} color={t.colors.onBrand} style={{ lineHeight: 34 }}>
                    +
                  </Txt>
                </Pressable>
                <Txt
                  size={10.5}
                  weight={800}
                  color={t.colors.brandText}
                  align="center"
                  style={{ position: 'absolute', bottom: 9, width: '100%' }}
                >
                  {label}
                </Txt>
              </View>
            );
          }

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              style={{
                flex: 1,
                height: '100%',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
              }}
            >
              <Txt size={20} color={focused ? t.colors.brandText : t.colors.ink3}>
                {icon}
              </Txt>
              <Txt size={10.5} weight={700} color={focused ? t.colors.brandText : t.colors.ink3}>
                {label}
              </Txt>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
