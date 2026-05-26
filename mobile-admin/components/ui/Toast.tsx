/**
 * Toast — a non-blocking confirmation chip that slides in from the top.
 *
 * Replaces the project's previous use of `Alert.alert('تم', 'سُجّل الطلب')`
 * which is functional but jarring — a system modal stops the user mid-
 * flow, demands a tap on "OK", and looks like an OS error message. A
 * toast feels like the app responding to your action instead of
 * interrupting it.
 *
 * Use `useToast()` from a screen, then `toast.show({ ... })`. The
 * `<ToastProvider>` belongs at the root (`app/_layout.tsx`), exactly
 * once per app, so the toast can outlive any screen unmount.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { View, Text, Animated, Pressable, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '@/lib/theme';

type ToastTone = 'success' | 'info' | 'warning' | 'danger';

interface ToastConfig {
  title: string;
  description?: string;
  tone?: ToastTone;
  /** Milliseconds before auto-dismiss. Default 3000. */
  duration?: number;
}

interface ToastContextValue {
  show: (cfg: ToastConfig) => void;
  hide: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [cfg, setCfg] = useState<ToastConfig | null>(null);
  const translateY = useRef(new Animated.Value(-200)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -200,
        duration: theme.motion.duration.fast,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: theme.motion.duration.fast,
        useNativeDriver: true,
      }),
    ]).start(() => setCfg(null));
  }, [opacity, translateY]);

  const show = useCallback(
    (next: ToastConfig) => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      setCfg(next);
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          damping: 18,
          stiffness: 180,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: theme.motion.duration.base,
          useNativeDriver: true,
        }),
      ]).start();
      hideTimerRef.current = setTimeout(hide, next.duration ?? 3000);
    },
    [hide, opacity, translateY],
  );

  useEffect(() => () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
  }, []);

  return (
    <ToastContext.Provider value={{ show, hide }}>
      {children}
      {cfg && (
        <Animated.View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: theme.z.toast,
            transform: [{ translateY }],
            opacity,
          }}
        >
          <SafeAreaView edges={['top']}>
            <Pressable
              onPress={hide}
              style={{
                marginHorizontal: theme.space.lg,
                marginTop: theme.space.sm,
              }}
            >
              <ToastSurface cfg={cfg} />
            </Pressable>
          </SafeAreaView>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

function ToastSurface({ cfg }: { cfg: ToastConfig }) {
  const tone = cfg.tone ?? 'success';
  const palette = theme.color.state[tone];
  const icon: Record<ToastTone, React.ComponentProps<typeof MaterialIcons>['name']> = {
    success: 'check-circle',
    info: 'info',
    warning: 'warning',
    danger: 'error',
  };
  return (
    <View
      style={{
        backgroundColor: theme.color.surface.card,
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: palette.border,
        flexDirection: 'row-reverse',
        gap: theme.space.md,
        alignItems: 'center',
        paddingVertical: theme.space.md,
        paddingHorizontal: theme.space.lg,
        ...theme.shadow.lg,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: theme.radius.md,
          backgroundColor: palette.bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <MaterialIcons name={icon[tone]} size={20} color={palette.fg} />
      </View>
      <View style={{ flex: 1, alignItems: 'flex-end' }}>
        <Text
          style={{
            ...theme.font.headingSm,
            color: theme.color.text.primary,
            textAlign: 'right',
          }}
        >
          {cfg.title}
        </Text>
        {cfg.description && (
          <Text
            style={{
              ...theme.font.bodySm,
              color: theme.color.text.secondary,
              textAlign: 'right',
              marginTop: 2,
            }}
          >
            {cfg.description}
          </Text>
        )}
      </View>
    </View>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Lazy fallback so a screen used outside the provider doesn't crash
    // — common while iterating. In production the provider will exist.
    return {
      show: (c) => Platform.OS !== 'web' && console.warn('[toast] no provider', c),
      hide: () => undefined,
    };
  }
  return ctx;
}
