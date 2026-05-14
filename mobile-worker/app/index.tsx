import { Redirect } from 'expo-router';

// Bounces to either auth or main tabs — real routing is in _layout.tsx
// after auth hydration.
export default function Index() {
  return <Redirect href="/(tabs)/home" />;
}
