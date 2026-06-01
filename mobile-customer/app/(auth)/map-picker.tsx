/**
 * MAP-PICKER — full-screen map for the customer to drop a pin on their
 * exact address during the signup wizard.
 *
 * ⚠️  Requires a native build via EAS (not Expo Go) because it pulls in
 *     `react-native-maps`. After installing, run one of:
 *         npx expo prebuild --clean
 *         eas build --profile development --platform android
 *         expo run:ios
 *
 * Flow:
 *   1. Open with `router.push({ pathname: '/(auth)/map-picker', params: { lat, lng } })`
 *      — `lat`/`lng` are optional initial centers (we use the device GPS
 *      when not provided).
 *   2. User drags the pin to the precise location.
 *   3. "تأكيد العنوان" → reverse-geocodes via `expo-location.reverseGeocodeAsync`
 *      and returns to caller with `{ lat, lng, addressString }` as router
 *      params (read with `useLocalSearchParams` on the caller).
 *
 * The caller (signup.tsx) listens for those params via expo-router's
 * params and copies them into the address field + saves the coords for
 * the lead submission.
 */

import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import MapView, { Marker, type Region } from 'react-native-maps';

// Baghdad (Tahrir Sq.) as the fallback center if GPS fails. Anywhere
// reasonable in Iraq beats centering the map on Null Island.
const BAGHDAD_FALLBACK = { latitude: 33.3152, longitude: 44.3661 };

export default function MapPicker() {
  const router = useRouter();
  const params = useLocalSearchParams<{ lat?: string; lng?: string; returnTo?: string }>();
  const mapRef = useRef<MapView | null>(null);

  const initialLat = params.lat ? Number(params.lat) : null;
  const initialLng = params.lng ? Number(params.lng) : null;

  const [coord, setCoord] = useState<{ latitude: number; longitude: number } | null>(
    initialLat != null && initialLng != null
      ? { latitude: initialLat, longitude: initialLng }
      : null,
  );
  const [loading, setLoading] = useState(coord == null);
  const [reverseLoading, setReverseLoading] = useState(false);

  useEffect(() => {
    if (coord != null) return; // caller supplied initial coords
    (async () => {
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.status !== 'granted') {
          // Permission denied — still let the user pan the map manually
          // from the Baghdad fallback rather than blocking the whole flow.
          setCoord(BAGHDAD_FALLBACK);
          return;
        }
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setCoord({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      } catch {
        setCoord(BAGHDAD_FALLBACK);
      } finally {
        setLoading(false);
      }
    })();
  }, [coord]);

  async function confirm() {
    if (!coord) return;
    setReverseLoading(true);
    let addressString = '';
    try {
      const results = await Location.reverseGeocodeAsync({
        latitude: coord.latitude,
        longitude: coord.longitude,
      });
      const r = results[0];
      if (r) {
        // expo-location's reverse geocode in Iraq tends to return city +
        // district reliably; street is hit-or-miss, so build a friendly
        // composite. The caller can still let the user edit the resulting
        // text field manually before submit.
        const parts = [r.name, r.street, r.district, r.city, r.region].filter(Boolean);
        addressString = parts.join('، ');
      }
    } catch {
      // Geocode failure isn't fatal — return just coords; the signup form
      // already has a free-text "address line" field the user can fill in.
    } finally {
      setReverseLoading(false);
    }
    // Pass back via replace so back-button on the caller doesn't reopen
    // the picker. The caller reads these params on focus. Defaults to the
    // signup wizard, but any screen can pass `returnTo` (e.g. /addresses).
    router.replace({
      pathname: (params.returnTo as any) ?? '/(auth)/signup',
      params: {
        pickedLat: String(coord.latitude),
        pickedLng: String(coord.longitude),
        pickedAddress: addressString,
      },
    } as any);
  }

  if (loading || !coord) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#0284c7" />
        <Text style={{ marginTop: 12, color: '#475569' }}>جارٍ تحديد موقعك...</Text>
      </SafeAreaView>
    );
  }

  const region: Region = {
    latitude: coord.latitude,
    longitude: coord.longitude,
    latitudeDelta: 0.005,
    longitudeDelta: 0.005,
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
      <MapView
        ref={(r) => {
          mapRef.current = r;
        }}
        style={StyleSheet.absoluteFillObject}
        initialRegion={region}
        showsUserLocation
        showsMyLocationButton
        onRegionChangeComplete={(r) => {
          // Keep the pin under the visual map center as the user pans —
          // a single draggable marker that follows the screen center is
          // the simplest, most reliable UX (no fiddly drag on tiny pins).
          setCoord({ latitude: r.latitude, longitude: r.longitude });
        }}
      >
        <Marker
          draggable
          coordinate={coord}
          onDragEnd={(e) =>
            setCoord({
              latitude: e.nativeEvent.coordinate.latitude,
              longitude: e.nativeEvent.coordinate.longitude,
            })
          }
        />
      </MapView>

      {/* Header — back button + title */}
      <SafeAreaView edges={['top']} style={styles.headerWrap}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            style={styles.headerBtn}
          >
            <MaterialIcons name="arrow-forward-ios" size={18} color="#0f172a" />
          </Pressable>
          <Text style={styles.title}>اسحب لتحديد موقع البيت</Text>
          <View style={{ width: 36 }} />
        </View>
      </SafeAreaView>

      {/* Bottom action bar */}
      <SafeAreaView edges={['bottom']} style={styles.footerWrap}>
        <View style={styles.footer}>
          <Text style={styles.coordText}>
            {coord.latitude.toFixed(5)}, {coord.longitude.toFixed(5)}
          </Text>
          <Pressable
            onPress={confirm}
            disabled={reverseLoading}
            style={[styles.confirmBtn, reverseLoading && { opacity: 0.6 }]}
          >
            {reverseLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.confirmText}>تأكيد العنوان</Text>
            )}
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' },
  headerWrap: { position: 'absolute', top: 0, left: 0, right: 0 },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: 'white',
    backgroundColor: 'rgba(15,23,42,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  footerWrap: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  footer: {
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 12,
  },
  coordText: { textAlign: 'center', color: '#475569', fontSize: 11, marginBottom: 10 },
  confirmBtn: {
    backgroundColor: '#0284c7',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  confirmText: { color: 'white', fontWeight: '700', fontSize: 15 },
});
