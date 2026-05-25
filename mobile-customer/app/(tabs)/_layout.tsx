import { Tabs } from 'expo-router';
import { View, Pressable, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { hap } from '@/lib/haptics';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

/**
 * Custom Tab bar — Ionicons، active dot متحرّك، scale on press.
 */
function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  return (
    <View
      style={{
        flexDirection: 'row-reverse',
        backgroundColor: 'white',
        paddingTop: 10,
        paddingBottom: 22,
        paddingHorizontal: 10,
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      }}
    >
      {state.routes.map((route, index) => {
        const isFocused = state.index === index;
        const { options } = descriptors[route.key];
        const label = options.title ?? route.name;

        const iconName: IoniconName = ICONS[route.name as keyof typeof ICONS] ?? 'home';
        const iconNameFocused: IoniconName = ICONS_FOCUSED[route.name as keyof typeof ICONS_FOCUSED] ?? 'home';

        const onPress = () => {
          hap.tap();
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            style={{ flex: 1, alignItems: 'center' }}
          >
            <MotiView
              animate={{
                scale: isFocused ? 1.1 : 1,
                translateY: isFocused ? -2 : 0,
              }}
              transition={{ type: 'spring', damping: 15 }}
              style={{ alignItems: 'center' }}
            >
              <Ionicons
                name={isFocused ? iconNameFocused : iconName}
                size={26}
                color={isFocused ? '#0284c7' : '#94a3b8'}
              />
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '700',
                  marginTop: 2,
                  color: isFocused ? '#0284c7' : '#94a3b8',
                }}
              >
                {label}
              </Text>
              <MotiView
                animate={{
                  width: isFocused ? 18 : 0,
                  opacity: isFocused ? 1 : 0,
                }}
                transition={{ type: 'timing', duration: 200 }}
                style={{
                  height: 3,
                  borderRadius: 2,
                  backgroundColor: '#0284c7',
                  marginTop: 4,
                }}
              />
            </MotiView>
          </Pressable>
        );
      })}
    </View>
  );
}

const ICONS: Record<string, IoniconName> = {
  home: 'home-outline',
  orders: 'receipt-outline',
  profile: 'person-circle-outline',
};

const ICONS_FOCUSED: Record<string, IoniconName> = {
  home: 'home',
  orders: 'receipt',
  profile: 'person-circle',
};

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <CustomTabBar {...props} />}
    >
      <Tabs.Screen name="home" options={{ title: 'الرئيسية' }} />
      <Tabs.Screen name="orders" options={{ title: 'طلباتي' }} />
      <Tabs.Screen name="profile" options={{ title: 'حسابي' }} />
    </Tabs>
  );
}
