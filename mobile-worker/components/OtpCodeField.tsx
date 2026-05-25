/**
 * OtpCodeField — 6-cell pin input مبنّى على react-native-confirmation-code-field.
 * نسخة طبق الأصل من تلك في mobile-customer، حفاظاً على وحدة الـ UX.
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  CodeField,
  Cursor,
  useBlurOnFulfill,
  useClearByFocusCell,
} from 'react-native-confirmation-code-field';

interface OtpCodeFieldProps {
  value: string;
  onChange: (val: string) => void;
  onFilled?: (code: string) => void;
  cellCount?: number;
  error?: boolean;
  autoFocus?: boolean;
}

export function OtpCodeField({
  value,
  onChange,
  onFilled,
  cellCount = 6,
  error = false,
  autoFocus = true,
}: OtpCodeFieldProps) {
  const ref = useBlurOnFulfill({ value, cellCount });
  const [props, getCellOnLayoutHandler] = useClearByFocusCell({
    value,
    setValue: onChange,
  });

  useEffect(() => {
    if (value.length === cellCount && onFilled) {
      onFilled(value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, cellCount]);

  return (
    <CodeField
      ref={ref}
      {...props}
      value={value}
      onChangeText={(t) => onChange(t.replace(/\D/g, ''))}
      cellCount={cellCount}
      rootStyle={styles.root}
      keyboardType="number-pad"
      textContentType="oneTimeCode"
      autoComplete="sms-otp"
      autoFocus={autoFocus}
      renderCell={({ index, symbol, isFocused }) => (
        <View
          key={index}
          onLayout={getCellOnLayoutHandler(index)}
          style={[
            styles.cell,
            isFocused && styles.cellFocused,
            error && styles.cellError,
          ]}
        >
          <Text style={styles.cellText}>
            {symbol || (isFocused ? <Cursor /> : null)}
          </Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 16,
    writingDirection: 'ltr',
  },
  cell: {
    width: 48,
    height: 56,
    flex: 1,
    maxWidth: 56,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellFocused: {
    borderColor: '#0284c7',
    backgroundColor: '#fff',
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 3,
  },
  cellError: {
    borderColor: '#ef4444',
    backgroundColor: '#fef2f2',
  },
  cellText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
  },
});
