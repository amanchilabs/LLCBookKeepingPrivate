import React from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { designTokens, minimumTouchTarget } from './design-system';

const colors = designTokens.color;

// Kept as a small compatibility surface while screens migrate to semantic tokens.
export const palette = {
  ink: colors.navy,
  muted: colors.muted,
  green: colors.emerald,
  greenSoft: colors.emeraldTint,
  border: colors.border,
  surface: colors.surface,
  canvas: colors.canvas,
  error: colors.error,
  warning: colors.warning,
};

export function Page({ children, contentStyle }: React.PropsWithChildren<{ contentStyle?: StyleProp<ViewStyle> }>) {
  return <ScrollView
    style={styles.page}
    contentContainerStyle={[styles.pageContent, contentStyle]}
    keyboardShouldPersistTaps="handled"
    keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
  >{children}</ScrollView>;
}

export function Panel({ children, style }: React.PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.panel, style]}>{children}</View>;
}

export const Card = Panel;

export function Heading({ title, subtitle, eyebrow }: { title: string; subtitle?: string; eyebrow?: string }) {
  return <View style={styles.heading}>
    {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
    <Text accessibilityRole="header" style={styles.title}>{title}</Text>
    {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
  </View>;
}

export function NavigationHeader({ title, businessName, subtitle }: { title: string; businessName?: string; subtitle?: string }) {
  return <View style={styles.navigationHeader}>
    {businessName ? <Text style={styles.eyebrow}>{businessName}</Text> : null}
    <Heading title={title} subtitle={subtitle} />
  </View>;
}

export function BottomTabBar<T extends string>({
  items,
  selected,
  onSelect,
}: {
  items: readonly T[];
  selected: T;
  onSelect: (item: T) => void;
}) {
  return <View accessibilityRole="tablist" style={styles.bottomBar}>
    {items.map((item) => <Pressable
      key={item}
      accessibilityRole="tab"
      accessibilityLabel={item}
      accessibilityState={{ selected: item === selected }}
      onPress={() => onSelect(item)}
      style={({ pressed }) => [styles.tab, item === selected && styles.tabSelected, pressed && styles.choicePressed]}
    ><Text style={[styles.tabLabel, item === selected && styles.tabLabelSelected]}>{item}</Text></Pressable>)}
  </View>;
}

export function Field({ label, helper, error, ...props }: TextInputProps & { label: string; helper?: string; error?: string }) {
  return <View style={styles.field}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput
      accessibilityLabel={label}
      accessibilityHint={error ? `Invalid value: ${error}` : undefined}
      placeholderTextColor="#687789"
      selectionColor={colors.emerald}
      style={[styles.input, error ? styles.inputError : null]}
      {...props}
    />
    {helper ? <Text style={styles.helper}>{helper}</Text> : null}
    {error ? <Text accessibilityRole="alert" style={styles.fieldError}>{error}</Text> : null}
  </View>;
}

export function Button({
  title,
  onPress,
  disabled = false,
  secondary = false,
  destructive = false,
  accessibilityLabel,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
  destructive?: boolean;
  accessibilityLabel?: string;
}) {
  return <Pressable
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel ?? title}
    accessibilityState={{ disabled }}
    disabled={disabled}
    onPress={onPress}
    style={({ pressed }) => [
      styles.button,
      secondary && styles.buttonSecondary,
      destructive && styles.buttonDestructive,
      disabled && styles.buttonDisabled,
      pressed && !disabled && styles.buttonPressed,
    ]}
  >
    <Text style={[
      styles.buttonText,
      secondary && styles.buttonSecondaryText,
      destructive && styles.buttonDestructiveText,
    ]}>{title}</Text>
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
    <View accessibilityLabel={label} style={styles.choiceRow}>
      {options.map((option) => <Pressable
        key={option.value}
        accessibilityRole="radio"
        accessibilityLabel={option.title}
        accessibilityState={{ selected: value === option.value }}
        onPress={() => onChange(option.value)}
        style={({ pressed }) => [styles.choice, value === option.value && styles.choiceSelected, pressed && styles.choicePressed]}
      ><Text style={[styles.choiceText, value === option.value && styles.choiceTextSelected]}>{option.title}</Text></Pressable>)}
    </View>
  </View>;
}

export function FormError({ message }: { message: string | null }) {
  return message ? <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={styles.error}>{message}</Text> : null;
}

export function Loading({ label = 'Loading encrypted books…' }: { label?: string }) {
  return <View accessibilityRole="progressbar" style={styles.loading}>
    <ActivityIndicator color={colors.emerald} />
    <Text accessibilityLiveRegion="polite" style={styles.subtitle}>{label}</Text>
  </View>;
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return <View style={styles.emptyState}>
    <Text accessibilityRole="header" style={styles.emptyTitle}>{title}</Text>
    <Text style={styles.subtitle}>{body}</Text>
    {action}
  </View>;
}

export function StatusIndicator({ label, tone = 'neutral' }: { label: string; tone?: 'positive' | 'warning' | 'error' | 'neutral' }) {
  return <Text accessibilityLabel={`Status: ${label}`} style={[styles.status, styles[`status_${tone}`]]}>{label}</Text>;
}

export function FinancialSummaryTile({ label, cents, detail }: { label: string; cents: bigint; detail?: string }) {
  return <View style={styles.summaryTile}>
    <Text style={styles.summaryLabel}>{label}</Text>
    <Money cents={cents} />
    {detail ? <Text style={styles.helper}>{detail}</Text> : null}
  </View>;
}

export function TransactionSummaryRow({
  title,
  date,
  category,
  account,
  role,
  cents,
  onPress,
}: {
  title: string;
  date: string;
  category: string;
  account: string;
  role: string;
  cents: bigint;
  onPress?: () => void;
}) {
  const content = <>
    <View style={uiStyles.rowMain}>
      <Text style={uiStyles.rowTitle}>{title}</Text>
      <Text style={uiStyles.rowDetail}>{date} · {category} · {account} · {role}</Text>
    </View>
    <Money cents={cents} />
  </>;
  return onPress
    ? <Pressable accessibilityRole="button" onPress={onPress} style={styles.dataRow}>{content}</Pressable>
    : <View style={styles.dataRow}>{content}</View>;
}

export function MemberSummaryCard({
  name,
  ownership,
  capitalCents,
  onPress,
}: {
  name: string;
  ownership: string;
  capitalCents?: bigint;
  onPress?: () => void;
}) {
  return <Pressable
    accessibilityRole={onPress ? 'button' : undefined}
    accessibilityLabel={`${name}, ${ownership}% ownership${capitalCents === undefined ? '' : `, ${formatMoneyLabel(capitalCents)} book capital activity`}`}
    disabled={!onPress}
    onPress={onPress}
    style={({ pressed }) => [styles.memberCard, pressed && styles.cardPressed]}
  >
    <View style={uiStyles.rowMain}>
      <Text style={uiStyles.rowTitle}>{name}</Text>
      <Text style={uiStyles.rowDetail}>{ownership}% ownership interest</Text>
    </View>
    {capitalCents !== undefined ? <View style={styles.memberCapital}>
      <Text style={uiStyles.rowDetail}>Book capital activity</Text><Money cents={capitalCents} />
    </View> : null}
  </Pressable>;
}

export function ReportSection({ title, description, children }: React.PropsWithChildren<{ title: string; description?: string }>) {
  return <Panel>
    <Text accessibilityRole="header" style={uiStyles.sectionTitle}>{title}</Text>
    {description ? <Text style={uiStyles.rowDetail}>{description}</Text> : null}
    {children}
  </Panel>;
}

export function Money({ cents, size = 'normal' }: { cents: bigint; size?: 'normal' | 'large' }) {
  const amount = cents < 0n ? `−$${formatCents(-cents)}` : `$${formatCents(cents)}`;
  return <Text accessibilityLabel={amount} style={[styles.money, size === 'large' && styles.moneyLarge]}>{amount}</Text>;
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

function formatMoneyLabel(cents: bigint): string {
  return `${cents < 0n ? 'minus ' : ''}${formatCents(cents < 0n ? -cents : cents)} dollars`;
}

export const uiStyles = StyleSheet.create({
  helper: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 4 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'flex-start' },
  sectionTitle: { color: colors.navy, fontSize: 20, lineHeight: 26, fontWeight: '700' },
  rowItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: 14 },
  rowMain: { flex: 1, minWidth: 0, gap: 4 },
  metricPanel: { flex: 1, minWidth: 145 },
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  reportRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: 12 },
  reportTotal: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderTopWidth: 2, borderTopColor: colors.emerald, paddingTop: 14, marginTop: 5 },
  loanCard: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12, marginTop: 2 },
  rowTitle: { color: colors.navy, fontSize: 16, lineHeight: 22, fontWeight: '700' },
  rowDetail: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  badge: { color: colors.emeraldDark, backgroundColor: colors.emeraldTint, paddingHorizontal: 10, paddingVertical: 5, borderRadius: designTokens.radius.pill, overflow: 'hidden', fontSize: 13, fontWeight: '700' },
  field: { flex: 1, minWidth: 0, marginBottom: 4 },
  fieldLabel: { color: colors.navy, fontSize: 15, lineHeight: 20, fontWeight: '600', marginBottom: 7 },
  input: { minHeight: Math.max(48, minimumTouchTarget(Platform.OS)), borderWidth: 1, borderColor: colors.border, borderRadius: designTokens.radius.control, backgroundColor: colors.surface, paddingHorizontal: 14, paddingVertical: 11, color: colors.navy, fontSize: 16 },
  remove: { minHeight: 48, minWidth: 48, alignItems: 'center', justifyContent: 'center', borderRadius: designTokens.radius.control, backgroundColor: '#FCEDEA' },
  removeText: { color: colors.error, fontSize: 17, fontWeight: '700' },
});

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.canvas },
  pageContent: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 18, paddingTop: 20, paddingBottom: 32, gap: 16 },
  panel: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: designTokens.radius.card, padding: 18, gap: 14 },
  heading: { gap: 6, marginBottom: 2 },
  navigationHeader: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 18, paddingTop: 16, paddingBottom: 2 },
  eyebrow: { color: colors.emeraldDark, fontSize: 13, lineHeight: 18, fontWeight: '700', letterSpacing: 0.3 },
  title: { color: colors.navy, fontSize: 30, lineHeight: 37, fontWeight: '700', letterSpacing: -0.45 },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  fieldLabel: { color: colors.navy, fontSize: 15, lineHeight: 20, fontWeight: '600', marginBottom: 7 },
  input: { minHeight: Math.max(48, minimumTouchTarget(Platform.OS)), borderWidth: 1, borderColor: colors.border, borderRadius: designTokens.radius.control, backgroundColor: colors.surface, paddingHorizontal: 14, paddingVertical: 11, color: colors.navy, fontSize: 16 },
  inputError: { borderColor: colors.error },
  field: { flex: 1, minWidth: 0, marginBottom: 4 },
  helper: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 4 },
  fieldError: { color: colors.error, fontSize: 14, lineHeight: 20, marginTop: 4 },
  button: { minHeight: Math.max(48, minimumTouchTarget(Platform.OS)), borderRadius: designTokens.radius.control, paddingHorizontal: 18, backgroundColor: colors.emerald, alignItems: 'center', justifyContent: 'center' },
  buttonSecondary: { backgroundColor: colors.emeraldTint, borderWidth: 1, borderColor: colors.sage },
  buttonDestructive: { backgroundColor: '#FCEDEA', borderWidth: 1, borderColor: '#E7B8B2' },
  buttonDisabled: { opacity: 0.45 },
  buttonPressed: { opacity: 0.82 },
  buttonText: { color: '#FFFFFF', fontSize: 16, lineHeight: 21, fontWeight: '700', textAlign: 'center' },
  buttonSecondaryText: { color: colors.emeraldDark },
  buttonDestructiveText: { color: colors.error },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { minHeight: Math.max(44, minimumTouchTarget(Platform.OS)), justifyContent: 'center', paddingHorizontal: 15, borderRadius: designTokens.radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  choiceSelected: { borderColor: colors.emerald, backgroundColor: colors.emeraldTint },
  choicePressed: { opacity: 0.78 },
  choiceText: { color: colors.muted, fontSize: 15, lineHeight: 20, fontWeight: '600' },
  choiceTextSelected: { color: colors.emeraldDark, fontWeight: '700' },
  error: { color: colors.error, fontSize: 14, lineHeight: 20, paddingVertical: 5 },
  loading: { minHeight: 200, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: colors.canvas },
  emptyState: { alignItems: 'flex-start', gap: 10, backgroundColor: colors.surfaceSubtle, borderRadius: designTokens.radius.card, padding: 18 },
  emptyTitle: { color: colors.navy, fontSize: 18, lineHeight: 24, fontWeight: '700' },
  status: { alignSelf: 'flex-start', overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 5, borderRadius: designTokens.radius.pill, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  status_positive: { color: colors.emeraldDark, backgroundColor: colors.emeraldTint },
  status_warning: { color: '#684300', backgroundColor: '#FFF1CC' },
  status_error: { color: '#8D1E14', backgroundColor: '#FCEDEA' },
  status_neutral: { color: colors.navy, backgroundColor: colors.surfaceSubtle },
  summaryTile: { flex: 1, minWidth: 145, gap: 8, borderRadius: designTokens.radius.control, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 16 },
  summaryLabel: { color: colors.muted, fontSize: 14, lineHeight: 19, fontWeight: '600' },
  money: { color: colors.navy, fontSize: 17, lineHeight: 23, fontWeight: '700', fontVariant: ['tabular-nums'] },
  moneyLarge: { fontSize: 30, lineHeight: 38 },
  dataRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: 13 },
  memberCard: { minHeight: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: designTokens.radius.control, padding: 14 },
  memberCapital: { alignItems: 'flex-end', gap: 3 },
  cardPressed: { backgroundColor: colors.surfaceSubtle },
  bottomBar: { minHeight: 64, flexDirection: 'row', alignItems: 'stretch', justifyContent: 'space-around', gap: 4, paddingHorizontal: 8, paddingTop: 7, paddingBottom: 5, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  tab: { flex: 1, minHeight: Math.max(48, minimumTouchTarget(Platform.OS)), alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderRadius: designTokens.radius.control },
  tabSelected: { backgroundColor: colors.emeraldTint },
  tabLabel: { color: colors.muted, fontSize: 13, lineHeight: 18, fontWeight: '600', textAlign: 'center' },
  tabLabelSelected: { color: colors.emeraldDark, fontWeight: '700' },
});
