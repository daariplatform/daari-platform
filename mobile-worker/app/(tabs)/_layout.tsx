import { Tabs } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

const ICONS: Record<string, { active: IconName; idle: IconName }> = {
  home: { active: 'home', idle: 'home' },
  history: { active: 'history', idle: 'history' },
  profile: { active: 'person', idle: 'person-outline' },
};

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => {
        const icons = ICONS[route.name] ?? ICONS.home;
        return {
          headerShown: false,
          tabBarActiveTintColor: '#0284c7',
          tabBarInactiveTintColor: '#94a3b8',
          tabBarStyle: {
            backgroundColor: '#fff',
            borderTopColor: '#e2e8f0',
            borderTopWidth: 1,
            height: 76,
            paddingBottom: 16,
            paddingTop: 8,
            shadowColor: '#0f172a',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.05,
            shadowRadius: 8,
            elevation: 8,
          },
          tabBarLabelStyle: { fontSize: 12, fontWeight: '700', marginTop: 2 },
          tabBarIcon: ({ color, focused }) => (
            <MaterialIcons name={focused ? icons.active : icons.idle} size={26} color={color} />
          ),
        };
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'الرئيسية' }} />
      <Tabs.Screen name="history" options={{ title: 'السجل' }} />
      <Tabs.Screen name="profile" options={{ title: 'حسابي' }} />
    </Tabs>
  );
}
