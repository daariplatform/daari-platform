import { View, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useEffect } from 'react';

import { daysBetween, fmtArabicDate } from '@/lib/format';

/**
 * شريط حالة الزبون — يحسب الأيام المتبقية حتى الموعد الإلزامي (٣٠ يوم من
 * آخر تعبئة). يبيّن للزبون "أين هو في الدورة" بدل ما يخمّن.
 *
 * ٣ حالات:
 *   - good:   متبقي ≥ ١٥ يوم → أخضر (بحالة جيدة)
 *   - warn:   متبقي ٥-١٤    → أصفر (تنبيه)
 *   - urgent: متبقي < ٥ أو متأخر → أحمر (عاجل — قد يُسحب الخزان)
 */

const REFILL_CYCLE_DAYS = 30;
const WARN_THRESHOLD = 14; // ≤ ١٤ يوم متبقي → تنبيه
const URGENT_THRESHOLD = 5; // ≤ ٥ أيام متبقي → عاجل

export interface RefillStatusStripProps {
  /** آخر تعبئة. إذا null (زبون جديد) — نعرض حالة prompt للتعبئة الأولى. */
  lastRefillAt: string | null;
}

type Variant = 'good' | 'warn' | 'urgent' | 'new';

interface Computed {
  variant: Variant;
  daysSince: number;
  daysUntilDue: number;
  dueDate: Date;
  progressPct: number;
}

function compute(lastRefillAt: string | null): Computed {
  if (!lastRefillAt) {
    return {
      variant: 'new',
      daysSince: 0,
      daysUntilDue: REFILL_CYCLE_DAYS,
      dueDate: new Date(),
      progressPct: 0,
    };
  }
  const daysSince = daysBetween(lastRefillAt);
  const daysUntilDue = REFILL_CYCLE_DAYS - daysSince;
  const dueDate = new Date(lastRefillAt);
  dueDate.setDate(dueDate.getDate() + REFILL_CYCLE_DAYS);
  const progressPct = Math.min(100, (daysSince / REFILL_CYCLE_DAYS) * 100);

  let variant: Variant;
  if (daysUntilDue >= WARN_THRESHOLD) variant = 'good';
  else if (daysUntilDue >= URGENT_THRESHOLD) variant = 'warn';
  else variant = 'urgent';

  return { variant, daysSince, daysUntilDue, dueDate, progressPct };
}

interface Theme {
  /** Tag background (rgba على شفاف). */
  tagBg: string;
  /** Tag text. */
  tagText: string;
  /** نص الـ tag (تنبيه / بحالة جيدة …). */
  tagLabel: string;
  /** Gradient stops للـ progress bar. */
  progressFrom: string;
  progressTo: string;
  /** نص أسفل (السطر السفلي). */
  subtleText: string;
  /** أيقونة الـ tag. */
  icon: 'check-circle' | 'schedule' | 'warning' | 'water-drop';
}

function themeFor(variant: Variant): Theme {
  switch (variant) {
    case 'good':
      return {
        tagBg: 'rgba(16,185,129,0.4)',
        tagText: '#fff',
        tagLabel: 'بحالة جيدة',
        progressFrom: '#34d399',
        progressTo: '#10b981',
        subtleText: '#d1fae5',
        icon: 'check-circle',
      };
    case 'warn':
      return {
        tagBg: 'rgba(245,158,11,0.4)',
        tagText: '#fff',
        tagLabel: 'تنبيه',
        progressFrom: '#fbbf24',
        progressTo: '#f59e0b',
        subtleText: '#fef3c7',
        icon: 'schedule',
      };
    case 'urgent':
      return {
        tagBg: 'rgba(239,68,68,0.5)',
        tagText: '#fff',
        tagLabel: 'عاجل',
        progressFrom: '#f87171',
        progressTo: '#ef4444',
        subtleText: '#fecaca',
        icon: 'warning',
      };
    case 'new':
      return {
        tagBg: 'rgba(20,184,166,0.4)',
        tagText: '#fff',
        tagLabel: 'زبون جديد',
        progressFrom: '#5eead4',
        progressTo: '#14b8a6',
        subtleText: '#ccfbf1',
        icon: 'water-drop',
      };
  }
}

/** Arabic-Indic digit formatting for nicer Iraqi feel. */
function ar(n: number): string {
  return n.toLocaleString('ar-IQ');
}

export function RefillStatusStrip({ lastRefillAt }: RefillStatusStripProps) {
  const c = compute(lastRefillAt);
  const theme = themeFor(c.variant);

  const progressW = useSharedValue(0);
  useEffect(() => {
    progressW.value = withTiming(c.progressPct, {
      duration: 900,
      easing: Easing.out(Easing.cubic),
    });
  }, [c.progressPct, progressW]);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progressW.value}%`,
  }));

  return (
    <View
      style={{
        marginTop: 14,
        borderRadius: 16,
        padding: 14,
        backgroundColor:
          c.variant === 'good'
            ? 'rgba(16,185,129,0.18)'
            : c.variant === 'warn'
              ? 'rgba(245,158,11,0.20)'
              : c.variant === 'urgent'
                ? 'rgba(239,68,68,0.20)'
                : 'rgba(20,184,166,0.18)',
        borderWidth: 1,
        borderColor:
          c.variant === 'good'
            ? 'rgba(16,185,129,0.3)'
            : c.variant === 'warn'
              ? 'rgba(245,158,11,0.3)'
              : c.variant === 'urgent'
                ? 'rgba(239,68,68,0.3)'
                : 'rgba(20,184,166,0.3)',
      }}
    >
      {/* Top row: label + tag */}
      <View
        style={{
          flexDirection: 'row-reverse',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
          <MaterialIcons name="history" size={18} color="#fff" />
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>
            حالتك مع المعمل
          </Text>
        </View>
        <View
          style={{
            backgroundColor: theme.tagBg,
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 6,
            flexDirection: 'row-reverse',
            alignItems: 'center',
            gap: 3,
          }}
        >
          {c.variant === 'urgent' && (
            <MaterialIcons name="warning" size={11} color={theme.tagText} />
          )}
          <Text style={{ color: theme.tagText, fontSize: 9, fontWeight: '900' }}>
            {theme.tagLabel}
          </Text>
        </View>
      </View>

      {/* Big number */}
      <View style={{ flexDirection: 'row-reverse', alignItems: 'baseline' }}>
        {c.variant === 'new' ? (
          <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>
            مرحباً بك — اطلب تعبئتك الأولى
          </Text>
        ) : c.variant === 'urgent' && c.daysUntilDue < 0 ? (
          <>
            <Text
              style={{
                color: '#fecaca',
                fontWeight: '900',
                fontSize: 32,
                lineHeight: 32,
              }}
            >
              −{ar(Math.abs(c.daysUntilDue))}
            </Text>
            <Text style={{ color: '#fff', fontSize: 13, opacity: 0.9 }}>
              {' '}
              أيام تأخير
            </Text>
          </>
        ) : (
          <>
            <Text
              style={{
                color: '#fff',
                fontWeight: '900',
                fontSize: 32,
                lineHeight: 32,
              }}
            >
              {ar(c.daysUntilDue)}
            </Text>
            <Text style={{ color: '#fff', fontSize: 13, opacity: 0.9 }}>
              {' '}
              {c.daysUntilDue === 1 ? 'يوم متبقي' : 'أيام متبقية قبل الموعد الإلزامي'}
            </Text>
          </>
        )}
      </View>

      {/* Progress bar — تتعبأ بحسب الـ daysSince / 30 */}
      {c.variant !== 'new' && (
        <View
          style={{
            marginTop: 10,
            height: 6,
            backgroundColor: 'rgba(255,255,255,0.18)',
            borderRadius: 99,
            overflow: 'hidden',
          }}
        >
          <Animated.View
            style={[
              {
                height: '100%',
                backgroundColor: theme.progressFrom,
                borderRadius: 99,
              },
              progressStyle,
            ]}
          />
        </View>
      )}

      {/* Bottom row: dates */}
      {c.variant !== 'new' && (
        <View
          style={{
            flexDirection: 'row-reverse',
            justifyContent: 'space-between',
            marginTop: 8,
          }}
        >
          <Text style={{ fontSize: 10, color: theme.subtleText }}>
            {c.variant === 'urgent' && c.daysUntilDue < 0
              ? `تخطّيت الموعد ${fmtArabicDate(c.dueDate)}`
              : `الموعد: ${fmtArabicDate(c.dueDate)}`}
          </Text>
          <Text style={{ fontSize: 10, color: theme.subtleText }}>
            آخر تعبئة: قبل {ar(c.daysSince)} يوم
          </Text>
        </View>
      )}
    </View>
  );
}
