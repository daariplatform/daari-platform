import { Redirect } from 'expo-router';

// Root route just bounces to either /(auth)/login or /(tabs)/home — the
// real decision happens in _layout.tsx after auth hydration.
export default function Index() {
  return <Redirect href="/(tabs)/home" />;
}
