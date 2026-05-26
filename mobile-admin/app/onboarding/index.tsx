/**
 * Onboarding wizard shell.
 *
 * Drives the 5-step setup flow shown to brand-new plant owners on their
 * first sign-in. Each step is a self-contained component in its own file
 * (see step1-plant.tsx ... step5-done.tsx); this shell owns:
 *
 *   - The current step (1..5) + per-step form draft
 *   - The progress bar across the top (5 dots, completed → check)
 *   - The "skip whole onboarding" link (calls `useSkipOnboarding`)
 *   - The forward transition after each step's submit
 *   - The final hop to /(tabs)/home once allComplete or user finishes step 5
 *
 * Steps that already look complete on the server are skipped on first
 * mount — if the owner closes the app halfway through, reopens, and steps
 * 1+2 are already done on the backend, we drop them straight on step 3.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useOnboardingStatus, useSkipOnboarding } from '@/lib/queries';

import { Step1Plant, type PlantStepValue } from './step1-plant';
import { Step2Pricing, type PricingStepValue } from './step2-pricing';
import { Step3Customer, type CustomerStepValue } from './step3-customer';
import { Step4Driver, type DriverStepValue } from './step4-driver';
import { Step5Done } from './step5-done';

const TOTAL_STEPS = 5;

/**
 * Convert the server's onboarding status into "which step should we be on".
 * Pure helper so the redirect heuristic on first mount is testable. We
 * advance past steps that are already true; once everything is true we
 * jump straight to step 5 (done screen) so the user gets the celebration
 * even if they finished mid-flow last session.
 */
function nextIncompleteStep(status: {
  plantInfoComplete: boolean;
  refillPriceSet: boolean;
  workingHoursSet: boolean;
  firstCustomerAdded: boolean;
  firstDriverHired: boolean;
}): number {
  if (!status.plantInfoComplete) return 1;
  if (!status.refillPriceSet || !status.workingHoursSet) return 2;
  if (!status.firstCustomerAdded) return 3;
  if (!status.firstDriverHired) return 4;
  return 5;
}

export default function OnboardingWizard() {
  const router = useRouter();
  const statusQuery = useOnboardingStatus();
  const skip = useSkipOnboarding();

  const [step, setStep] = useState<number>(1);
  const [resumedFromServer, setResumedFromServer] = useState(false);

  // Per-step drafts. Kept in the shell so swiping back to a previous step
  // doesn't wipe what the user typed — and so the (hypothetical) "review"
  // panel could read all values at once.
  const [plantValue, setPlantValue] = useState<PlantStepValue>({
    name: '',
    city: '',
    coverageLat: null,
    coverageLng: null,
  });
  const [pricingValue, setPricingValue] = useState<PricingStepValue>({
    refillPriceIqd: 1000,
    workingHoursStart: '08:00',
    workingHoursEnd: '22:00',
  });
  const [customerValue, setCustomerValue] = useState<CustomerStepValue>({
    fullName: '',
    phone: '',
    district: '',
    addressLine: '',
  });
  const [driverValue, setDriverValue] = useState<DriverStepValue>({
    fullName: '',
    phone: '',
    baseCommissionPct: 10,
    salaryIqd: 0,
  });

  // Resume mid-flow once the server tells us what's already done. Only
  // happens once per mount to avoid yanking the step out from under the
  // user every time the query refetches.
  useEffect(() => {
    if (resumedFromServer) return;
    const s = statusQuery.data;
    if (!s) return;
    setStep(nextIncompleteStep(s));
    setResumedFromServer(true);
  }, [statusQuery.data, resumedFromServer]);

  // Completed-step indicator. We treat steps before the current as "done"
  // visually even if the server's flags haven't refreshed yet — the
  // mutation succeeded and we advanced, so the user should see the green
  // check instead of a stale gray dot.
  const completedSteps = useMemo(() => {
    const set = new Set<number>();
    for (let i = 1; i < step; i++) set.add(i);
    const s = statusQuery.data;
    if (s) {
      if (s.plantInfoComplete) set.add(1);
      if (s.refillPriceSet && s.workingHoursSet) set.add(2);
      if (s.firstCustomerAdded) set.add(3);
      if (s.firstDriverHired) set.add(4);
    }
    return set;
  }, [step, statusQuery.data]);

  function advance() {
    if (step < TOTAL_STEPS) setStep(step + 1);
  }

  function finish() {
    router.replace('/(tabs)/home' as any);
  }

  async function onSkipAll() {
    Alert.alert(
      'تخطّي الإعداد؟',
      'تستطيع إكمال هذه الخطوات لاحقاً من الإعدادات. تخطّي الآن؟',
      [
        { text: 'تراجع', style: 'cancel' },
        {
          text: 'تخطّي',
          style: 'destructive',
          onPress: async () => {
            try {
              await skip.mutateAsync();
            } catch {
              // Backend miss isn't fatal — we still drop the user on the
              // dashboard; the redirect logic will not push back into
              // onboarding because the user explicitly chose to skip.
            } finally {
              finish();
            }
          },
        },
      ],
    );
  }

  // While the initial status is loading on a cold start, show a centered
  // spinner instead of flashing step 1 then jumping. After ~1s of dead air
  // we render step 1 anyway so a backend outage doesn't trap the user.
  const showSpinner =
    statusQuery.isLoading && !statusQuery.isFetched && !resumedFromServer;

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: '#fff' }}>
        <View
          style={{
            paddingHorizontal: 16,
            paddingTop: 8,
            paddingBottom: 14,
            backgroundColor: '#fff',
            borderBottomWidth: 1,
            borderBottomColor: '#e2e8f0',
          }}
        >
          <View
            style={{
              flexDirection: 'row-reverse',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 14,
            }}
          >
            <Text style={{ fontSize: 12, color: '#64748b', fontWeight: '800' }}>
              {step} من {TOTAL_STEPS}
            </Text>
            {step < TOTAL_STEPS && (
              <Pressable
                onPress={onSkipAll}
                hitSlop={8}
                disabled={skip.isPending}
                style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
              >
                <Text style={{ color: '#0e9384', fontSize: 13, fontWeight: '900' }}>
                  تخطّي
                </Text>
              </Pressable>
            )}
          </View>

          <ProgressDots
            current={step}
            completed={completedSteps}
            total={TOTAL_STEPS}
          />
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {showSpinner ? (
          <View
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
            }}
          >
            <ActivityIndicator size="large" color="#0e9384" />
            <Text style={{ color: '#64748b', fontSize: 13 }}>
              جارٍ تحميل الإعداد…
            </Text>
          </View>
        ) : (
          <View style={{ flex: 1, paddingTop: 4 }}>
            {step === 1 && (
              <Step1Plant
                value={plantValue}
                onChange={setPlantValue}
                onSubmitted={advance}
              />
            )}
            {step === 2 && (
              <Step2Pricing
                value={pricingValue}
                onChange={setPricingValue}
                onSubmitted={advance}
              />
            )}
            {step === 3 && (
              <Step3Customer
                value={customerValue}
                onChange={setCustomerValue}
                onSubmitted={advance}
                onSkip={advance}
              />
            )}
            {step === 4 && (
              <Step4Driver
                value={driverValue}
                onChange={setDriverValue}
                onSubmitted={advance}
                onSkip={advance}
              />
            )}
            {step === 5 && <Step5Done onFinish={finish} />}
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

/**
 * Five linked circles. Current = filled teal + ring; completed = teal with
 * check icon; pending = light gray. The connector lines between them turn
 * teal as soon as the previous step is marked done.
 */
function ProgressDots({
  current,
  completed,
  total,
}: {
  current: number;
  completed: Set<number>;
  total: number;
}) {
  return (
    <View
      style={{
        flexDirection: 'row-reverse',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 4,
      }}
    >
      {Array.from({ length: total }, (_, i) => i + 1).map((n, idx) => {
        const isCompleted = completed.has(n);
        const isCurrent = n === current;
        const isPast = n < current || isCompleted;

        return (
          <View
            key={n}
            style={{
              flexDirection: 'row-reverse',
              alignItems: 'center',
              flex: idx === total - 1 ? 0 : 1,
            }}
          >
            <View
              style={{
                width: 26,
                height: 26,
                borderRadius: 13,
                backgroundColor: isCurrent
                  ? '#0e9384'
                  : isPast
                    ? '#0e9384'
                    : '#e2e8f0',
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: isCurrent ? 3 : 0,
                borderColor: '#ccfbf1',
              }}
            >
              {isCompleted && !isCurrent ? (
                <MaterialIcons name="check" size={16} color="#fff" />
              ) : (
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '900',
                    color: isCurrent || isPast ? '#fff' : '#94a3b8',
                  }}
                >
                  {n}
                </Text>
              )}
            </View>
            {idx !== total - 1 && (
              <View
                style={{
                  flex: 1,
                  height: 2,
                  marginHorizontal: 4,
                  backgroundColor: isPast ? '#0e9384' : '#e2e8f0',
                }}
              />
            )}
          </View>
        );
      })}
    </View>
  );
}
