import * as Crypto from 'expo-crypto';
import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  assertValidBusinessSetup,
  parseOwnershipPercent,
  SUGGESTED_MEMBER_INTERESTS_BASIS_POINTS,
  type BusinessSetupInput,
} from '../../../packages/domain/src/bookkeeping';
import { parseUsd } from '../../../packages/domain/src/money';
import {
  createBusiness,
  createBusinessWithInitialAccount,
} from '../../../packages/storage-native/src/bookkeeping-service';
import type { CashAccountInput } from '../../../packages/storage-native/src/bookkeeping-store';
import { getNextOnboardingStep, getPreviousOnboardingStep, type OnboardingStep } from './onboarding-flow';
import { Button, Choice, Field, FormError, Heading, Page, Panel, StatusIndicator, formatCents, todayLocalDate, uiStyles } from './ui';

interface SetupMemberDraft {
  id: string;
  name: string;
  percent: string;
}

type SetupAccountKind = 'bank' | 'cash';
type AccountSetupChoice = 'now' | 'later';

const setupStepLabels = ['Your LLC', 'Members', 'First account', 'Review'] as const;

export function BusinessSetupScreen({ onCreated }: { onCreated: () => Promise<void> }) {
  const [step, setStep] = useState<OnboardingStep>('welcome');
  const [name, setName] = useState('');
  const [formationState, setFormationState] = useState('');
  const [formationDate, setFormationDate] = useState('');
  const [bookkeepingStartDate, setBookkeepingStartDate] = useState('');
  const [memberMode, setMemberMode] = useState<'single' | 'multi'>('multi');
  const [members, setMembers] = useState<SetupMemberDraft[]>(createSuggestedMembers);
  const [ownershipConfirmed, setOwnershipConfirmed] = useState(false);
  const [accountChoice, setAccountChoice] = useState<AccountSetupChoice>('now');
  const [accountName, setAccountName] = useState('Operating checking');
  const [accountKind, setAccountKind] = useState<SetupAccountKind>('bank');
  const [openingBalance, setOpeningBalance] = useState('');
  const [openingDate, setOpeningDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);

  const ownershipTotal = useMemo(() => members.reduce((total, member) => {
    try { return total + parseOwnershipPercent(member.percent); } catch { return total; }
  }, 0), [members]);

  const moveTo = (next: OnboardingStep) => {
    setError(null);
    setStep(next);
  };

  const businessInput = (): BusinessSetupInput => ({
    id: Crypto.randomUUID(),
    name,
    formationState,
    formationDate,
    bookkeepingStartDate,
    ownershipConfirmed,
    members: members.map((member) => ({
      id: member.id,
      name: member.name,
      ownershipBasisPoints: parseOwnershipPercent(member.percent),
    })),
  });

  const validateBusinessDetails = () => {
    assertValidBusinessSetup({
      id: 'setup-validation',
      name,
      formationState,
      formationDate,
      bookkeepingStartDate,
      ownershipConfirmed: true,
      members: [{ id: 'setup-validation-member', name: 'Setup validation', ownershipBasisPoints: 10_000 }],
    });
  };

  const validateMembers = () => {
    if (!ownershipConfirmed) throw new Error('Confirm that the ownership interests shown are correct before continuing.');
    assertValidBusinessSetup(businessInput());
  };

  const parseOpeningAmount = (): bigint => {
    const normalized = openingBalance.trim();
    if (!normalized) return 0n;
    const isNegative = normalized.startsWith('-');
    const unsigned = isNegative ? normalized.slice(1) : normalized;
    const amount = parseUsd(unsigned);
    if (accountKind === 'cash' && isNegative) throw new Error('A cash account opening balance cannot be negative.');
    return isNegative ? -amount : amount;
  };

  const validateAccount = () => {
    if (accountChoice === 'later') return;
    if (!accountName.trim()) throw new Error('Enter a name for the first bank or cash account.');
    const balance = parseOpeningAmount();
    if (balance !== 0n) {
      const effectiveDate = openingDate.trim() || bookkeepingStartDate;
      if (!effectiveDate) throw new Error('Enter an opening balance date.');
      if (effectiveDate < bookkeepingStartDate) throw new Error('Opening balance cannot precede the bookkeeping start date.');
      const [year, month, day] = effectiveDate.split('-').map(Number);
      const parsed = new Date(Date.UTC(year, month - 1, day));
      if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate)
        || parsed.toISOString().slice(0, 10) !== effectiveDate) {
        throw new Error('Enter a valid opening balance date in YYYY-MM-DD format.');
      }
    }
  };

  const continueFromCurrentStep = () => {
    setError(null);
    try {
      if (step === 'business') validateBusinessDetails();
      if (step === 'members') validateMembers();
      if (step === 'account') validateAccount();
      const next = getNextOnboardingStep(step, { skipAccount: step === 'account' && accountChoice === 'later' });
      moveTo(next);
    } catch (validationError) {
      setError(validationError instanceof Error ? validationError.message : 'Review the highlighted setup values.');
    }
  };

  const setMemberModeChoice = (mode: 'single' | 'multi') => {
    if (mode === memberMode) return;
    const firstName = members[0]?.name ?? '';
    setMemberMode(mode);
    setMembers(mode === 'single'
      ? [{ id: members[0]?.id ?? Crypto.randomUUID(), name: firstName, percent: '100' }]
      : createSuggestedMembers(firstName));
    setOwnershipConfirmed(false);
  };

  const updateMember = (index: number, patch: Partial<SetupMemberDraft>) => {
    setMembers((current) => current.map((member, memberIndex) => memberIndex === index ? { ...member, ...patch } : member));
    setOwnershipConfirmed(false);
  };

  const removeMember = (index: number) => {
    if (members.length <= 2) setMemberMode('single');
    setMembers((current) => {
      const next = current.filter((_, memberIndex) => memberIndex !== index);
      if (next.length === 1) next[0] = { ...next[0], percent: '100' };
      return next;
    });
    setOwnershipConfirmed(false);
  };

  const addMember = () => {
    setMemberMode('multi');
    setMembers((current) => [...current, { id: Crypto.randomUUID(), name: '', percent: '0' }]);
    setOwnershipConfirmed(false);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      validateBusinessDetails();
      validateMembers();
      validateAccount();
      const business = businessInput();
      if (accountChoice === 'later') {
        await createBusiness(business);
      } else {
        const openingBalanceCents = parseOpeningAmount();
        const effectiveDate = openingDate.trim() || bookkeepingStartDate;
        const initialAccount: CashAccountInput = {
          id: Crypto.randomUUID(),
          businessId: business.id,
          name: accountName,
          kind: accountKind,
          openingBalanceCents,
          ...(openingBalanceCents === 0n ? {} : {
            openingDate: effectiveDate,
            openingTransactionId: Crypto.randomUUID(),
            openingJournalEntryId: Crypto.randomUUID(),
          }),
        };
        await createBusinessWithInitialAccount({ business, initialAccount });
      }
      setCreated(true);
      setStep('complete');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'The LLC setup could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const finish = async () => {
    await onCreated();
  };

  const back = () => {
    setError(null);
    setStep(getPreviousOnboardingStep(step));
  };

  return <Page>
    {step !== 'welcome' && step !== 'complete' ? <SetupProgress step={step} /> : null}
    {step === 'welcome' ? <>
      <Panel style={{ backgroundColor: '#FFFDF8' }}>
        <StatusIndicator label="On device" tone="positive" />
        <Heading title="Your LLC books, kept private." subtitle="Set up your business once, then keep its bookkeeping close at hand." />
        <Text style={uiStyles.helper}>No mandatory account, automatic cloud sync, or bank connection. You choose when to export or back up a copy.</Text>
        <Button title="Get started" onPress={() => moveTo('business')} />
      </Panel>
      <Panel>
        <Text style={uiStyles.sectionTitle}>What you’ll set up</Text>
        <Text style={uiStyles.rowDetail}>Business details, member ownership interests, and an optional first bank or cash account.</Text>
        <Text style={uiStyles.rowDetail}>Ownership is recorded separately from income, profit, capital, payments, and loans.</Text>
      </Panel>
    </> : null}

    {step === 'business' ? <>
      <Heading title="Your LLC" subtitle="Enter the business facts used to identify this local bookkeeping workspace." />
      <Panel>
        <Field label="LLC business name" value={name} onChangeText={setName} placeholder="Example: Northstar Studio LLC" autoCapitalize="words" returnKeyType="next" />
        <Field label="Formation state or territory" value={formationState} onChangeText={(value) => setFormationState(value.toUpperCase().slice(0, 2))} placeholder="Two-letter code, such as AZ" autoCapitalize="characters" maxLength={2} />
        <Field label="Formation date" value={formationDate} onChangeText={setFormationDate} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />
        <Field label="Bookkeeping start date" value={bookkeepingStartDate} onChangeText={(value) => {
          setBookkeepingStartDate(value);
          if (!openingDate.trim()) setOpeningDate(value);
        }} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />
      </Panel>
      <FormError message={error} />
      <WizardActions onBack={back} onContinue={continueFromCurrentStep} continueLabel="Continue to members" />
    </> : null}

    {step === 'members' ? <>
      <Heading title="Members and ownership" subtitle="Ownership interests must total exactly 100%. They do not automatically allocate income or profit." />
      <Panel>
        <Choice label="LLC member structure" value={memberMode} options={[
          { value: 'single', title: 'Single member' }, { value: 'multi', title: 'Multiple members' },
        ]} onChange={setMemberModeChoice} />
        {memberMode === 'multi' ? <Button title="Use suggested 40% / 20% / 20% / 20% interests" secondary onPress={() => {
          setMembers(createSuggestedMembers(members[0]?.name ?? ''));
          setOwnershipConfirmed(false);
        }} /> : null}
        {members.map((member, index) => <Panel key={member.id} style={{ gap: 10 }}>
          <View style={uiStyles.row}>
            <Field label={`Member ${index + 1} name`} value={member.name} onChangeText={(value) => updateMember(index, { name: value })} placeholder="Full name" autoCapitalize="words" />
            <Field label={`Member ${index + 1} ownership percentage`} value={member.percent} onChangeText={(value) => updateMember(index, { percent: value })} placeholder="20" keyboardType="decimal-pad" />
          </View>
          {members.length > 1 ? <Button title={`Remove member ${index + 1}`} secondary onPress={() => removeMember(index)} /> : null}
        </Panel>)}
        {memberMode === 'multi' ? <Button title="Add member" secondary onPress={addMember} /> : null}
        <View style={uiStyles.reportTotal}>
          <Text style={uiStyles.sectionTitle}>Ownership total</Text>
          <Text style={uiStyles.sectionTitle}>{formatPercent(ownershipTotal)}%</Text>
        </View>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: ownershipConfirmed }}
          onPress={() => setOwnershipConfirmed((current) => !current)}
          style={confirmationStyle}
        >
          <Text style={uiStyles.rowTitle}>{ownershipConfirmed ? '✓ ' : '○ '}I confirm these ownership interests are correct</Text>
        </Pressable>
      </Panel>
      <FormError message={error} />
      <WizardActions onBack={back} onContinue={continueFromCurrentStep} continueLabel="Continue to first account" />
    </> : null}

    {step === 'account' ? <>
      <Heading title="Your first account" subtitle="An opening balance is recorded through Opening Balance Equity, not as income or an automatic member contribution." />
      <Panel>
        <Choice label="Set up an account now" value={accountChoice} options={[
          { value: 'now', title: 'Set up now' }, { value: 'later', title: 'Do this later' },
        ]} onChange={setAccountChoice} />
        {accountChoice === 'now' ? <>
          <Choice label="Account type" value={accountKind} options={[
            { value: 'bank', title: 'Bank' }, { value: 'cash', title: 'Cash' },
          ]} onChange={setAccountKind} />
          <Field label="Account name" value={accountName} onChangeText={setAccountName} placeholder="Operating checking" autoCapitalize="words" />
          <Field label="Opening balance in USD (optional)" value={openingBalance} onChangeText={setOpeningBalance} placeholder="0.00" keyboardType="decimal-pad" helper="Leave blank for a zero balance. Bank overdrafts may be entered with a leading minus sign." />
          {openingBalance.trim() ? <Field label="Opening balance date" value={openingDate || bookkeepingStartDate} onChangeText={setOpeningDate} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" /> : null}
        </> : <Text style={uiStyles.helper}>You can create a bank or cash account later from More → Accounts.</Text>}
      </Panel>
      <FormError message={error} />
      <WizardActions onBack={back} onContinue={continueFromCurrentStep} continueLabel="Review setup" />
    </> : null}

    {step === 'review' ? <>
      <Heading title="Review your LLC" subtitle="Check these details before creating the local bookkeeping workspace." />
      <Panel>
        <ReviewSection title="Business" onEdit={() => moveTo('business')}>
          <Text style={uiStyles.rowTitle}>{name.trim() || 'Business name missing'}</Text>
          <Text style={uiStyles.rowDetail}>{formationState.toUpperCase()} · formed {formationDate} · books begin {bookkeepingStartDate}</Text>
        </ReviewSection>
        <ReviewSection title="Members and ownership" onEdit={() => moveTo('members')}>
          {members.map((member) => <View key={member.id} style={uiStyles.rowItem}>
            <Text style={uiStyles.rowTitle}>{member.name.trim() || 'Name missing'}</Text>
            <Text style={uiStyles.badge}>{member.percent}%</Text>
          </View>)}
          <Text style={uiStyles.rowDetail}>Total ownership: {formatPercent(ownershipTotal)}%. Ownership is not an income allocation.</Text>
        </ReviewSection>
        <ReviewSection title="First account" onEdit={() => moveTo('account')}>
          {accountChoice === 'later' ? <Text style={uiStyles.rowDetail}>Account setup skipped for now. No account or opening entry will be created.</Text> : <>
            <Text style={uiStyles.rowTitle}>{accountName.trim()} · {accountKind}</Text>
            <Text style={uiStyles.rowDetail}>Opening balance {formatOpeningAmount(openingBalance)}{openingBalance.trim() ? ` as of ${openingDate || bookkeepingStartDate}` : ''}</Text>
            <Text style={uiStyles.rowDetail}>Any non-zero opening balance posts to Opening Balance Equity.</Text>
          </>}
        </ReviewSection>
      </Panel>
      <FormError message={error} />
      <View style={uiStyles.row}>
        <Button title="Back" secondary onPress={back} disabled={saving} />
        <Button title={saving ? 'Creating LLC…' : 'Create LLC'} onPress={() => void save()} disabled={saving} />
      </View>
      <Text style={uiStyles.helper}>Your business and first account are saved together when an account is included. No capital contribution is inferred from the opening balance.</Text>
    </> : null}

    {step === 'complete' && created ? <>
      <Panel style={{ backgroundColor: '#FFFDF8' }}>
        <StatusIndicator label="Workspace created" tone="positive" />
        <Heading title="Your books are ready." subtitle={`${name.trim()} is saved on this device.`} />
        <Text style={uiStyles.rowDetail}>{members.length} member{members.length === 1 ? '' : 's'} · {formatPercent(ownershipTotal)}% ownership confirmed</Text>
        {accountChoice === 'now' ? <Text style={uiStyles.rowDetail}>{accountName.trim()} · opening balance {formatOpeningAmount(openingBalance)}</Text> : <Text style={uiStyles.rowDetail}>You can add an account from More → Accounts.</Text>}
        <Button title="Go to dashboard" onPress={() => void finish()} />
      </Panel>
    </> : null}
  </Page>;
}

function SetupProgress({ step }: { step: OnboardingStep }) {
  const stepIndex = step === 'business' ? 0 : step === 'members' ? 1 : step === 'account' ? 2 : 3;
  return <View style={progressContainer}>
    <Text style={uiStyles.rowDetail}>Setup · {stepIndex + 1} of {setupStepLabels.length}</Text>
    <View accessibilityLabel={`${stepIndex + 1} of ${setupStepLabels.length} setup steps`} style={progressTrack}>
      {setupStepLabels.map((label, index) => <View key={label} style={[progressSegment, index <= stepIndex ? progressSegmentActive : null]} />)}
    </View>
    <Text style={uiStyles.rowTitle}>{setupStepLabels[stepIndex]}</Text>
  </View>;
}

function WizardActions({ onBack, onContinue, continueLabel }: { onBack: () => void; onContinue: () => void; continueLabel: string }) {
  return <View style={uiStyles.row}>
    <Button title="Back" secondary onPress={onBack} />
    <Button title={continueLabel} onPress={onContinue} />
  </View>;
}

function ReviewSection({ title, onEdit, children }: React.PropsWithChildren<{ title: string; onEdit: () => void }>) {
  return <View style={reviewSection}>
    <View style={uiStyles.headingRow}>
      <Text accessibilityRole="header" style={uiStyles.sectionTitle}>{title}</Text>
      <Button title={`Edit ${title.toLowerCase()}`} secondary onPress={onEdit} />
    </View>
    {children}
  </View>;
}

function createSuggestedMembers(firstName = ''): SetupMemberDraft[] {
  return SUGGESTED_MEMBER_INTERESTS_BASIS_POINTS.map((basisPoints, index) => ({
    id: Crypto.randomUUID(),
    name: index === 0 ? firstName : '',
    percent: formatPercent(basisPoints),
  }));
}

function formatPercent(basisPoints: number): string {
  const whole = Math.floor(basisPoints / 100);
  const fraction = basisPoints % 100;
  return fraction === 0 ? String(whole) : `${whole}.${String(fraction).padStart(2, '0').replace(/0$/, '')}`;
}

function formatOpeningAmount(value: string): string {
  if (!value.trim()) return '$0.00';
  try {
    const negative = value.trim().startsWith('-');
    const cents = parseUsd(negative ? value.trim().slice(1) : value.trim());
    return `${negative ? '−' : ''}$${formatCents(cents)}`;
  } catch {
    return 'Amount needs review';
  }
}

const progressContainer = { width: '100%' as const, gap: 8, paddingHorizontal: 2 };
const progressTrack = { flexDirection: 'row' as const, gap: 5 };
const progressSegment = { flex: 1, height: 5, borderRadius: 999, backgroundColor: '#D9E0DC' };
const progressSegmentActive = { backgroundColor: '#087A55' };
const reviewSection = { gap: 10, borderTopWidth: 1, borderTopColor: '#D9E0DC', paddingTop: 14 };
const confirmationStyle = { minHeight: 48, justifyContent: 'center' as const, borderWidth: 1, borderColor: '#D9E0DC', borderRadius: 12, paddingHorizontal: 12, backgroundColor: '#F7F5F0' };
