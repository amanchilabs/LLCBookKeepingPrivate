import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';

export const palette = {
  ink: '#20352a',
  muted: '#697970',
  green: '#28543d',
  greenSoft: '#edf3eb',
  border: '#dfe6df',
  surface: '#ffffff',
  canvas: '#f5f7f3',
  error: '#9b3228',
};

export function Page({ children }: React.PropsWithChildren) {
  return <ScrollView style={styles.page} contentContainerStyle={styles.pageContent} keyboardShouldPersistTaps="handled">{children}</ScrollView>;
}

export function Panel({ children, style }: React.PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.panel, style]}>{children}</View>;
}

export function Heading({ title, subtitle }: { title: string; subtitle?: string }) {
  return <View style={styles.heading}><Text style={styles.title}>{title}</Text>{subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}</View>;
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return <View style={styles.field}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput
      accessibilityLabel={label}
      placeholderTextColor="#8b978e"
      style={styles.input}
      {...props}
    />
  </View>;
}

export function Button({
  title,
  onPress,
  disabled = false,
  secondary = false,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
}) {
  return <Pressable
    accessibilityRole="button"
    accessibilityState={{ disabled }}
    disabled={disabled}
    onPress={onPress}
    style={({ pressed }) => [styles.button, secondary && styles.buttonSecondary, disabled && styles.buttonDisabled, pressed && !disabled && styles.buttonPressed]}
  >
    <Text style={[styles.buttonText, secondary && styles.buttonSecondaryText]}>{title}</Text>
  </Pressable>;
}

export function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; title: string }[];
  onChange: (value: T) => void;
}) {
  return <View style={styles.field}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <View style={styles.choiceRow}>
      {options.map((option) => <Pressable
        key={option.value}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${option.title}`}
        accessibilityState={{ selected: value === option.value }}
        onPress={() => onChange(option.value)}
        style={[styles.choice, value === option.value && styles.choiceSelected]}
      ><Text style={[styles.choiceText, value === option.value && styles.choiceTextSelected]}>{option.title}</Text></Pressable>)}
    </View>
  </View>;
}

export function FormError({ message }: { message: string | null }) {
  return message ? <Text accessibilityRole="alert" style={styles.error}>{message}</Text> : null;
}

export function Loading({ label = 'Loading encrypted books…' }: { label?: string }) {
  return <View style={styles.loading}><ActivityIndicator color={palette.green} /><Text style={styles.subtitle}>{label}</Text></View>;
}

export function Money({ cents, size = 'normal' }: { cents: bigint; size?: 'normal' | 'large' }) {
  const amount = cents < 0n ? `−$${formatCents(-cents)}` : `$${formatCents(cents)}`;
  return <Text style={[styles.money, size === 'large' && styles.moneyLarge]}>{amount}</Text>;
}

export function formatCents(cents: bigint): string {
  const whole = cents / 100n;
  const fraction = (cents % 100n).toString().padStart(2, '0');
  return `${whole.toLocaleString('en-US')}.${fraction}`;
}

export function todayLocalDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export const uiStyles = StyleSheet.create({
  helper: { color: palette.muted, fontSize: 12, lineHeight: 18, marginTop: 3 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  sectionTitle: { color: palette.ink, fontSize: 17, lineHeight: 22, fontWeight: '800' },
  rowItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderTopWidth: 1, borderTopColor: palette.border, paddingVertical: 13 },
  rowMain: { flex: 1, gap: 3 },
  metricPanel: { flex: 1, minWidth: 140 },
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  reportRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: palette.border, paddingVertical: 12 },
  reportTotal: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 2, borderTopColor: palette.green, paddingTop: 14, marginTop: 5 },
  loanCard: { borderTopWidth: 1, borderTopColor: palette.border, paddingTop: 12, marginTop: 2 },
  rowTitle: { color: palette.ink, fontSize: 14, fontWeight: '700' },
  rowDetail: { color: palette.muted, fontSize: 12, lineHeight: 17 },
  badge: { color: palette.green, backgroundColor: palette.greenSoft, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, overflow: 'hidden', fontSize: 11, fontWeight: '800' },
  field: { flex: 1 },
  fieldLabel: { color: palette.ink, fontSize: 13, fontWeight: '700', marginBottom: 7 },
  input: { minHeight: 46, borderWidth: 1, borderColor: palette.border, borderRadius: 9, backgroundColor: palette.surface, paddingHorizontal: 12, paddingVertical: 10, color: palette.ink, fontSize: 15 },
  remove: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: '#f7ecea' },
  removeText: { color: palette.error, fontSize: 17, fontWeight: '800' },
});

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: palette.canvas },
  pageContent: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 18, paddingBottom: 34, gap: 14 },
  panel: { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, borderRadius: 12, padding: 16, gap: 12 },
  heading: { gap: 5, marginTop: 4, marginBottom: 3 },
  title: { color: palette.ink, fontSize: 25, lineHeight: 31, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { color: palette.muted, fontSize: 13, lineHeight: 19 },
  fieldLabel: { color: palette.ink, fontSize: 13, fontWeight: '700', marginBottom: 7 },
  input: { minHeight: 46, borderWidth: 1, borderColor: palette.border, borderRadius: 9, backgroundColor: palette.surface, paddingHorizontal: 12, paddingVertical: 10, color: palette.ink, fontSize: 15 },
  field: { flex: 1, marginBottom: 2 },
  button: { minHeight: 48, borderRadius: 9, paddingHorizontal: 16, backgroundColor: palette.green, alignItems: 'center', justifyContent: 'center' },
  buttonSecondary: { backgroundColor: '#eef2ee', borderWidth: 1, borderColor: palette.border },
  buttonDisabled: { opacity: 0.48 },
  buttonPressed: { opacity: 0.82 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '800', textAlign: 'center' },
  buttonSecondaryText: { color: palette.green },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 13, borderRadius: 8, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface },
  choiceSelected: { borderColor: palette.green, backgroundColor: palette.greenSoft },
  choiceText: { color: palette.muted, fontSize: 13, fontWeight: '600' },
  choiceTextSelected: { color: palette.green, fontWeight: '800' },
  error: { color: palette.error, fontSize: 13, lineHeight: 18, paddingVertical: 5 },
  loading: { minHeight: 200, alignItems: 'center', justifyContent: 'center', gap: 12 },
  money: { color: palette.ink, fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },
  moneyLarge: { fontSize: 23 },
});
