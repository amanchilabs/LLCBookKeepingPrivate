import * as Crypto from 'expo-crypto';
import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { parseOwnershipPercent, type MemberInterestInput } from '../../../packages/domain/src/bookkeeping';
import { formatUsd, parseUsd } from '../../../packages/domain/src/money';
import { canCreateGuaranteedPayment, canReverseHistoricalPayment, shouldShowPaymentHistoryControls } from './member-payment-history';
import {
  createGuaranteedPaymentObligation,
  recordGuaranteedPayment,
  recordMemberCapitalActivity,
  replaceMembers,
  reverseGuaranteedPayment,
} from '../../../packages/storage-native/src/bookkeeping-service';
import type { BookkeepingSnapshot, GuaranteedPaymentClassification } from '../../../packages/storage-native/src/bookkeeping-store';
import { Button, Choice, Field, FormError, Heading, Money, Page, Panel, todayLocalDate, uiStyles } from './ui';

interface MemberDraft {
  id: string;
  name: string;
  percent: string;
}

type CapitalActivityKind = 'cash-contribution' | 'property-contribution' | 'distribution';
type PaymentRecurrence = 'one-time' | 'monthly' | 'quarterly';
type MemberSection = 'members' | 'capital' | 'payments';
interface PaymentAllocationDraft { key: string; installmentId: string; amount: string }

export function MembersScreen({ snapshot, onSaved, onOpenMemberLoans }: { snapshot: BookkeepingSnapshot; onSaved: () => Promise<void>; onOpenMemberLoans: (memberId: string) => void }) {
  const [section, setSection] = useState<MemberSection>('members');
  const [members, setMembers] = useState<MemberDraft[]>([]);
  const [effectiveDate, setEffectiveDate] = useState(todayLocalDate());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cashAccounts = snapshot.accounts.filter((account) => account.kind === 'bank' || account.kind === 'cash');
  const [capitalKind, setCapitalKind] = useState<CapitalActivityKind>('cash-contribution');
  const [capitalMemberId, setCapitalMemberId] = useState(snapshot.members[0]?.id ?? '');
  const [capitalAccountId, setCapitalAccountId] = useState(cashAccounts[0]?.id ?? '');
  const [capitalDate, setCapitalDate] = useState(todayLocalDate());
  const [capitalAmount, setCapitalAmount] = useState('');
  const [capitalDescription, setCapitalDescription] = useState('');
  const [propertyDescription, setPropertyDescription] = useState('');
  const [capitalSaving, setCapitalSaving] = useState(false);
  const [capitalError, setCapitalError] = useState<string | null>(null);
  const [capitalNotice, setCapitalNotice] = useState<string | null>(null);
  const [paymentMemberId, setPaymentMemberId] = useState(snapshot.members[0]?.id ?? '');
  const [paymentClassification, setPaymentClassification] = useState<GuaranteedPaymentClassification>('services');
  const [paymentRecurrence, setPaymentRecurrence] = useState<PaymentRecurrence>('one-time');
  const [paymentFirstDueDate, setPaymentFirstDueDate] = useState(todayLocalDate());
  const [paymentInstallmentCount, setPaymentInstallmentCount] = useState('1');
  const [paymentInstallmentAmount, setPaymentInstallmentAmount] = useState('');
  const [paymentObligationDescription, setPaymentObligationDescription] = useState('');
  const [cashPaymentMemberId, setCashPaymentMemberId] = useState(snapshot.members[0]?.id ?? '');
  const [cashPaymentClassification, setCashPaymentClassification] = useState<GuaranteedPaymentClassification>('services');
  const [cashPaymentAccountId, setCashPaymentAccountId] = useState(cashAccounts[0]?.id ?? '');
  const [cashPaymentDate, setCashPaymentDate] = useState(todayLocalDate());
  const [cashPaymentDescription, setCashPaymentDescription] = useState('');
  const [paymentAllocations, setPaymentAllocations] = useState<PaymentAllocationDraft[]>([
    { key: 'payment-allocation-1', installmentId: '', amount: '' },
  ]);
  const [paymentReversalDate, setPaymentReversalDate] = useState(todayLocalDate());
  const [paymentReturnCashAccountId, setPaymentReturnCashAccountId] = useState(cashAccounts[0]?.id ?? '');
  const [paymentReversalReason, setPaymentReversalReason] = useState('');
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentNotice, setPaymentNotice] = useState<string | null>(null);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const availablePaymentInstallments = snapshot.guaranteedPaymentInstallments.filter((installment) =>
    installment.memberId === cashPaymentMemberId
      && installment.classification === cashPaymentClassification
      && installment.outstandingAmountCents > 0n);
  const paymentAllocationTotal = paymentAllocations.reduce((total, allocation) => {
    try { return total + parseUsd(allocation.amount); } catch { return total; }
  }, 0n);
  const today = todayLocalDate();
  const totalPaymentOutstanding = snapshot.guaranteedPaymentInstallments
    .reduce((sum, installment) => sum + installment.outstandingAmountCents, 0n);
  const duePaymentBalance = snapshot.guaranteedPaymentInstallments
    .filter((installment) => installment.dueDate <= today)
    .reduce((sum, installment) => sum + installment.outstandingAmountCents, 0n);
  const overduePaymentBalance = snapshot.guaranteedPaymentInstallments
    .filter((installment) => installment.dueDate < today)
    .reduce((sum, installment) => sum + installment.outstandingAmountCents, 0n);
  const reversedPaymentIds = new Set(snapshot.guaranteedPaymentCashEvents
    .filter((event) => event.kind === 'reversal').map((event) => event.paymentId));
  const showPaymentHistoryControls = shouldShowPaymentHistoryControls(
    snapshot.members.length,
    snapshot.guaranteedPaymentCashEvents,
  );

  useEffect(() => {
    setMembers(snapshot.members.map((member) => ({
      id: member.id,
      name: member.name,
      percent: fromBasisPoints(member.ownershipBasisPoints),
    })));
  }, [snapshot.members]);

  useEffect(() => {
    if (!snapshot.members.some((member) => member.id === capitalMemberId)) {
      setCapitalMemberId(snapshot.members[0]?.id ?? '');
    }
  }, [snapshot.members, capitalMemberId]);

  useEffect(() => {
    if (!cashAccounts.some((account) => account.id === capitalAccountId)) {
      setCapitalAccountId(cashAccounts[0]?.id ?? '');
    }
  }, [snapshot.accounts, capitalAccountId]);

  useEffect(() => {
    if (!snapshot.members.some((member) => member.id === paymentMemberId)) setPaymentMemberId(snapshot.members[0]?.id ?? '');
    if (!snapshot.members.some((member) => member.id === cashPaymentMemberId)) setCashPaymentMemberId(snapshot.members[0]?.id ?? '');
    if (!cashAccounts.some((account) => account.id === cashPaymentAccountId)) setCashPaymentAccountId(cashAccounts[0]?.id ?? '');
    if (!cashAccounts.some((account) => account.id === paymentReturnCashAccountId)) setPaymentReturnCashAccountId(cashAccounts[0]?.id ?? '');
  }, [snapshot.members, snapshot.accounts, paymentMemberId, cashPaymentMemberId, cashPaymentAccountId, paymentReturnCashAccountId]);

  useEffect(() => {
    setPaymentAllocations((current) => current.map((allocation) => ({
      ...allocation,
      installmentId: availablePaymentInstallments.some((installment) => installment.id === allocation.installmentId)
        ? allocation.installmentId
        : availablePaymentInstallments[0]?.id ?? '',
    })));
  }, [snapshot.guaranteedPaymentInstallments, cashPaymentMemberId, cashPaymentClassification]);

  const update = (index: number, patch: Partial<MemberDraft>) => {
    setMembers((current) => current.map((member, memberIndex) => memberIndex === index ? { ...member, ...patch } : member));
  };

  const removeMember = (index: number) => {
    setMembers((current) => {
      const next = current.filter((_, memberIndex) => memberIndex !== index);
      if (next.length === 1) next[0] = { ...next[0], percent: '100' };
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const values: MemberInterestInput[] = members.map((member) => ({
        id: member.id,
        name: member.name,
        ownershipBasisPoints: parseOwnershipPercent(member.percent),
      }));
      await replaceMembers({
        businessId: snapshot.business!.id,
        effectiveDate,
        ownershipConfirmed: true,
        members: values,
      });
      await onSaved();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Member changes could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const saveCapitalActivity = async () => {
    setCapitalSaving(true);
    setCapitalError(null);
    setCapitalNotice(null);
    try {
      const amountCents = parseUsd(capitalAmount);
      if (amountCents <= 0n) throw new Error('Enter an amount greater than zero.');
      if (!capitalMemberId) throw new Error('Choose a member for this capital activity.');
      if (capitalKind !== 'property-contribution' && !capitalAccountId) {
        throw new Error('Create a bank or cash account before recording this activity.');
      }
      await recordMemberCapitalActivity({
        id: Crypto.randomUUID(),
        journalEntryId: Crypto.randomUUID(),
        businessId: snapshot.business!.id,
        memberId: capitalMemberId,
        date: capitalDate,
        kind: capitalKind,
        amountCents,
        description: capitalDescription,
        cashAccountId: capitalKind === 'property-contribution' ? undefined : capitalAccountId,
        propertyDescription: capitalKind === 'property-contribution' ? propertyDescription : undefined,
      });
      setCapitalAmount('');
      setCapitalDescription('');
      setPropertyDescription('');
      setCapitalNotice('Capital activity posted to the member ledger and balanced journal.');
      await onSaved();
    } catch (saveError) {
      setCapitalError(saveError instanceof Error ? saveError.message : 'Capital activity could not be posted.');
    } finally {
      setCapitalSaving(false);
    }
  };

  const savePaymentObligation = async () => {
    setPaymentSaving(true);
    setPaymentError(null);
    setPaymentNotice(null);
    try {
      const amountCents = parseUsd(paymentInstallmentAmount);
      const count = paymentRecurrence === 'one-time' ? 1 : Number(paymentInstallmentCount);
      if (amountCents <= 0n) throw new Error('Enter a positive installment amount.');
      if (!paymentMemberId) throw new Error('Choose a member for this obligation.');
      if (!Number.isInteger(count)) throw new Error('Enter a whole number of installments.');
      await createGuaranteedPaymentObligation({
        id: Crypto.randomUUID(),
        businessId: snapshot.business!.id,
        memberId: paymentMemberId,
        classification: paymentClassification,
        recurrence: paymentRecurrence,
        firstDueDate: paymentFirstDueDate,
        installmentCount: count,
        installmentAmountCents: amountCents,
        description: paymentObligationDescription,
      });
      setPaymentInstallmentAmount('');
      setPaymentObligationDescription('');
      setPaymentNotice('Obligation and dated installments saved. No journal or cash entry was posted.');
      await onSaved();
    } catch (saveError) {
      setPaymentError(saveError instanceof Error ? saveError.message : 'The guaranteed payment obligation could not be saved.');
    } finally {
      setPaymentSaving(false);
    }
  };

  const postGuaranteedPayment = async () => {
    setPaymentSaving(true);
    setPaymentError(null);
    setPaymentNotice(null);
    try {
      if (!cashPaymentAccountId) throw new Error('Create a bank or cash account before recording a member payment.');
      await recordGuaranteedPayment({
        id: Crypto.randomUUID(),
        transactionId: Crypto.randomUUID(),
        journalEntryId: Crypto.randomUUID(),
        businessId: snapshot.business!.id,
        memberId: cashPaymentMemberId,
        date: cashPaymentDate,
        cashAccountId: cashPaymentAccountId,
        description: cashPaymentDescription,
        allocations: paymentAllocations.map((allocation) => ({
          installmentId: allocation.installmentId,
          amountCents: parseUsd(allocation.amount),
        })),
      });
      setCashPaymentDescription('');
      setPaymentAllocations([{ key: Crypto.randomUUID(), installmentId: '', amount: '' }]);
      setPaymentNotice('Cash payment and installment allocations were posted to the journal and member history.');
      await onSaved();
    } catch (saveError) {
      setPaymentError(saveError instanceof Error ? saveError.message : 'The guaranteed payment could not be posted.');
    } finally {
      setPaymentSaving(false);
    }
  };

  const reversePayment = async (paymentId: string) => {
    setPaymentSaving(true);
    setPaymentError(null);
    setPaymentNotice(null);
    try {
      await reverseGuaranteedPayment({
        id: Crypto.randomUUID(),
        paymentId,
        reversalTransactionId: Crypto.randomUUID(),
        reversalJournalEntryId: Crypto.randomUUID(),
        date: paymentReversalDate,
        returnCashAccountId: paymentReturnCashAccountId,
        reason: paymentReversalReason,
      });
      setPaymentNotice('Payment reversal posted on its cash return date. The original payment and allocations remain in history.');
      setPaymentReversalReason('');
      await onSaved();
    } catch (saveError) {
      setPaymentError(saveError instanceof Error ? saveError.message : 'The guaranteed payment could not be reversed.');
    } finally {
      setPaymentSaving(false);
    }
  };

  return <Page>
    <Heading title="Members" subtitle="Edit member names and ownership interests. Every ownership change keeps its prior effective dates in the local history." />
    <Choice label="Member workspace" value={section} options={[
      { value: 'members', title: 'Members' },
      { value: 'capital', title: 'Capital' },
      { value: 'payments', title: 'Payments' },
    ]} onChange={setSection} />
    {section === 'members' ? <>
    {snapshot.members.length ? <Panel>
      <Text style={uiStyles.sectionTitle}>Member records</Text>
      <Text style={uiStyles.helper}>Ownership and book capital are separate records. Member loans are recorded as debt, not capital.</Text>
      {snapshot.members.map((member) => {
        const capital = snapshot.memberCapitalSummaries.find((summary) => summary.memberId === member.id)?.bookCapitalActivityCents;
        return <View key={member.id} style={uiStyles.rowItem}>
          <View style={uiStyles.rowMain}>
            <Text style={uiStyles.rowTitle}>{member.name}</Text>
            <Text style={uiStyles.rowDetail}>{fromBasisPoints(member.ownershipBasisPoints)}% ownership</Text>
            {capital !== undefined ? <Text style={uiStyles.rowDetail}>Book capital activity ${formatUsd(capital)}</Text> : null}
          </View>
          <Button title={`Loans · ${member.name}`} secondary onPress={() => onOpenMemberLoans(member.id)} />
        </View>;
      })}
    </Panel> : null}
    <Panel>
      {members.map((member, index) => <View key={member.id}>
        <View style={uiStyles.fieldStack}>
          <Field wide label={`Member ${index + 1} name`} value={member.name} onChangeText={(value) => update(index, { name: value })} autoCapitalize="words" />
          <Field wide label={`Member ${index + 1} ownership percent`} value={member.percent} onChangeText={(value) => update(index, { percent: value })} keyboardType="decimal-pad" />
          {members.length > 1 ? <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${member.name || `member ${index + 1}`}`} onPress={() => removeMember(index)} style={[uiStyles.remove, { alignSelf: 'flex-end' }]}>
            <Text style={uiStyles.removeText}>×</Text>
          </Pressable> : null}
        </View>
      </View>)}
      <Button title="Add member" secondary onPress={() => setMembers((current) => [...current, { id: Crypto.randomUUID(), name: '', percent: '0' }])} disabled={saving} />
      <Field label="Change effective date" value={effectiveDate} onChangeText={setEffectiveDate} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />
      <Text style={uiStyles.helper}>Active member interests must total exactly 100%. Removing members down to one sets the remaining interest to 100%. Saving confirms the percentages above. Effective dates cannot rewrite an existing ownership period.</Text>
      <FormError message={error} />
      <Button title="Confirm and save member changes" onPress={() => void save()} disabled={saving} />
    </Panel>
    </> : null}
    {section === 'capital' ? <>
    <Panel>
      <Text style={uiStyles.sectionTitle}>Record member capital activity</Text>
      <Choice label="Capital activity type" value={capitalKind} options={[
        { value: 'cash-contribution', title: 'Cash contribution' },
        { value: 'property-contribution', title: 'Property contribution' },
        { value: 'distribution', title: 'Distribution' },
      ]} onChange={setCapitalKind} />
      <Choice label="Member receiving capital activity" value={capitalMemberId} options={snapshot.members.map((member) => ({ value: member.id, title: member.name }))} onChange={setCapitalMemberId} />
      {capitalKind !== 'property-contribution' ? <Choice label="Cash or bank account for capital activity" value={capitalAccountId} options={cashAccounts.map((account) => ({ value: account.id, title: account.name }))} onChange={setCapitalAccountId} /> : null}
      <View style={uiStyles.fieldStack}>
        <Field wide label="Capital activity date" value={capitalDate} onChangeText={setCapitalDate} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />
        <Field wide label="Capital activity amount in USD" value={capitalAmount} onChangeText={setCapitalAmount} placeholder="0.00" keyboardType="decimal-pad" />
      </View>
      {capitalKind === 'property-contribution' ? <>
        <Field label="Property description — CPA review required" value={propertyDescription} onChangeText={setPropertyDescription} placeholder="Describe contributed property" />
        <Text style={uiStyles.helper}>The amount is recorded as book value only. Confirm property description and valuation with a CPA; tax basis and outside basis are not calculated.</Text>
      </> : null}
      <Field label="Capital activity description" value={capitalDescription} onChangeText={setCapitalDescription} placeholder="Describe the contribution or distribution" />
      {capitalKind !== 'property-contribution' && cashAccounts.length === 0
        ? <Text style={uiStyles.helper}>Create a bank or cash account before recording a cash contribution or distribution.</Text>
        : null}
      <FormError message={capitalError} />
      {capitalNotice ? <Text accessibilityLiveRegion="polite" style={uiStyles.helper}>{capitalNotice}</Text> : null}
      <Button title={capitalSaving ? 'Posting…' : 'Post capital activity'} onPress={() => void saveCapitalActivity()} disabled={capitalSaving || snapshot.members.length === 0} />
    </Panel>
    <Panel>
      <Text style={uiStyles.sectionTitle}>Member capital ledgers</Text>
      <Text style={uiStyles.helper}>Book capital activity only: contributions less distributions. This is not tax-basis capital or outside basis.</Text>
      {snapshot.memberCapitalSummaries.map((summary) => <View key={summary.memberId} style={uiStyles.rowItem}>
        <View style={uiStyles.rowMain}>
          <Text style={uiStyles.rowTitle}>{summary.memberName}</Text>
          <Text style={uiStyles.rowDetail}>Cash ${formatUsd(summary.cashContributionsCents)} · Property ${formatUsd(summary.propertyContributionsCents)} · Distributions ${formatUsd(summary.distributionsCents)}</Text>
        </View>
        <Money cents={summary.bookCapitalActivityCents} />
      </View>)}
      <Text style={uiStyles.sectionTitle}>Dated capital activity</Text>
      {snapshot.capitalActivities.length ? snapshot.capitalActivities.map((activity) => <View key={activity.id} style={uiStyles.rowItem}>
        <View style={uiStyles.rowMain}>
          <Text style={uiStyles.rowTitle}>{activity.memberName} · {capitalActivityLabel(activity.kind)}</Text>
          <Text style={uiStyles.rowDetail}>{activity.date} · {activity.description}{activity.cashAccountName ? ` · ${activity.cashAccountName}` : ''}</Text>
          {activity.requiresCpaReview ? <Text style={uiStyles.helper}>CPA review required · book value only · {activity.propertyDescription}</Text> : null}
        </View>
        <Money cents={activity.kind === 'distribution' ? -activity.amountCents : activity.amountCents} />
      </View>) : <Text style={uiStyles.helper}>No capital activity recorded yet.</Text>}
    </Panel>
    </> : null}
    {section === 'payments' ? <>
    <Panel>
      <Text style={uiStyles.sectionTitle}>Guaranteed-payment obligations</Text>
      <Text style={uiStyles.helper}>Contracts and installments are memo-only. Unpaid obligations do not post an expense, liability, or cash movement. CPA review is needed for tax classification, deductibility, and capitalization.</Text>
      {canCreateGuaranteedPayment(snapshot.members.length) ? <>
      <Choice label="Obligation member" value={paymentMemberId} options={snapshot.members.map((member) => ({ value: member.id, title: member.name }))} onChange={setPaymentMemberId} />
      <Choice label="Guaranteed payment classification" value={paymentClassification} options={[
        { value: 'services', title: 'Services' },
        { value: 'use-of-capital', title: 'Use of capital' },
      ]} onChange={setPaymentClassification} />
      <Choice label="Installment schedule" value={paymentRecurrence} options={[
        { value: 'one-time', title: 'One-time' },
        { value: 'monthly', title: 'Monthly' },
        { value: 'quarterly', title: 'Quarterly' },
      ]} onChange={(recurrence) => {
        setPaymentRecurrence(recurrence);
        setPaymentInstallmentCount(recurrence === 'one-time' ? '1' : '2');
      }} />
      <View style={uiStyles.fieldStack}>
        <Field wide label="First due date" value={paymentFirstDueDate} onChangeText={setPaymentFirstDueDate} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />
        <Field wide label="Amount per installment in USD" value={paymentInstallmentAmount} onChangeText={setPaymentInstallmentAmount} placeholder="0.00" keyboardType="decimal-pad" />
      </View>
      {paymentRecurrence !== 'one-time'
        ? <Field label="Number of installments (2–120)" value={paymentInstallmentCount} onChangeText={setPaymentInstallmentCount} keyboardType="number-pad" />
        : null}
      <Field label="Obligation description" value={paymentObligationDescription} onChangeText={setPaymentObligationDescription} placeholder="Agreement or service description" />
      <Text style={uiStyles.helper}>Monthly and quarterly due dates use the original day when possible and the last day of shorter months.</Text>
      <Button title={paymentSaving ? 'Saving…' : 'Save obligation and installments'} onPress={() => void savePaymentObligation()} disabled={paymentSaving || snapshot.members.length === 0} />
      </> : <Text style={uiStyles.helper}>Owner equity only: new guaranteed-payment obligations are disabled for a single-member LLC. Owner labor and tax classification require CPA review; this app does not infer them.</Text>}
      <View style={uiStyles.reportTotal}><Text style={uiStyles.sectionTitle}>Outstanding</Text><Money cents={totalPaymentOutstanding} /></View>
      <Text style={uiStyles.rowDetail}>Due ${formatUsd(duePaymentBalance)} · Overdue ${formatUsd(overduePaymentBalance)} as of {today}</Text>
      {snapshot.guaranteedPaymentInstallments.length ? snapshot.guaranteedPaymentInstallments.map((installment) => {
        const status = installment.outstandingAmountCents === 0n ? 'Paid'
          : installment.dueDate < today ? 'Overdue'
            : installment.dueDate === today ? 'Due today' : 'Upcoming';
        return <View key={installment.id} style={uiStyles.rowItem}>
          <View style={uiStyles.rowMain}>
            <Text style={uiStyles.rowTitle}>{installment.memberName} · {guaranteedPaymentClassificationLabel(installment.classification)}</Text>
            <Text style={uiStyles.rowDetail}>{installment.dueDate} · {status} · {installment.description}</Text>
            <Text style={uiStyles.rowDetail}>Scheduled ${formatUsd(installment.scheduledAmountCents)} · Paid ${formatUsd(installment.paidAmountCents)}</Text>
          </View>
          <Money cents={installment.outstandingAmountCents} />
        </View>;
      }) : <Text style={uiStyles.helper}>No guaranteed-payment obligations recorded.</Text>}
    </Panel>
    {snapshot.members.length > 1 ? <Panel>
      <Text style={uiStyles.sectionTitle}>Record an actual member payment</Text>
      <Text style={uiStyles.helper}>Only cash actually paid posts an expense. Allocate the payment to one or more installments; partial allocations are allowed.</Text>
      <Choice label="Payment member" value={cashPaymentMemberId} options={snapshot.members.map((member) => ({ value: member.id, title: member.name }))} onChange={setCashPaymentMemberId} />
      <Choice label="Payment classification" value={cashPaymentClassification} options={[
        { value: 'services', title: 'Services' },
        { value: 'use-of-capital', title: 'Use of capital' },
      ]} onChange={setCashPaymentClassification} />
      <Choice label="Payment bank or cash account" value={cashPaymentAccountId} options={cashAccounts.map((account) => ({ value: account.id, title: account.name }))} onChange={setCashPaymentAccountId} />
      <View style={uiStyles.row}>
        <Field label="Cash payment date" value={cashPaymentDate} onChangeText={setCashPaymentDate} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />
        <Money cents={paymentAllocationTotal} />
      </View>
      <Field label="Payment description" value={cashPaymentDescription} onChangeText={setCashPaymentDescription} placeholder="What was actually paid?" />
      {availablePaymentInstallments.length ? <>
        {paymentAllocations.map((allocation, index) => {
          const options = availablePaymentInstallments
            .filter((installment) => !paymentAllocations.some((other) => other.key !== allocation.key && other.installmentId === installment.id))
            .map((installment) => ({
              value: installment.id,
              title: `${installment.dueDate} · ${formatUsd(installment.outstandingAmountCents)} remaining`,
            }));
          return <View key={allocation.key} style={uiStyles.row}>
            <Choice label={`Allocation ${index + 1} installment`} value={allocation.installmentId} options={options} onChange={(installmentId) => setPaymentAllocations((current) => current.map((line) => line.key === allocation.key ? { ...line, installmentId } : line))} />
            <Field label={`Allocation ${index + 1} amount in USD`} value={allocation.amount} onChangeText={(amount) => setPaymentAllocations((current) => current.map((line) => line.key === allocation.key ? { ...line, amount } : line))} placeholder="0.00" keyboardType="decimal-pad" />
            {paymentAllocations.length > 1 ? <Pressable accessibilityRole="button" accessibilityLabel={`Remove allocation ${index + 1}`} onPress={() => setPaymentAllocations((current) => current.filter((line) => line.key !== allocation.key))} style={uiStyles.remove}><Text style={uiStyles.removeText}>×</Text></Pressable> : null}
          </View>;
        })}
        <Button title="＋ Add allocation line" secondary onPress={() => {
          const next = availablePaymentInstallments.find((installment) => !paymentAllocations.some((line) => line.installmentId === installment.id));
          if (next) setPaymentAllocations((current) => [...current, { key: Crypto.randomUUID(), installmentId: next.id, amount: '' }]);
        }} disabled={paymentAllocations.length >= availablePaymentInstallments.length} />
        <Button title={paymentSaving ? 'Posting…' : 'Post actual payment'} onPress={() => void postGuaranteedPayment()} disabled={paymentSaving} />
      </> : <Text style={uiStyles.helper}>There are no unpaid installments for this member and classification.</Text>}
      <FormError message={paymentError} />
      {paymentNotice ? <Text accessibilityLiveRegion="polite" style={uiStyles.helper}>{paymentNotice}</Text> : null}
    </Panel> : null}
    <Panel>
      <Text style={uiStyles.sectionTitle}>Member payment history</Text>
      {showPaymentHistoryControls ? <>
        <Field label="Cash return date for reversals" value={paymentReversalDate} onChangeText={setPaymentReversalDate} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />
        <Choice label="Account receiving returned cash" value={paymentReturnCashAccountId} options={cashAccounts.map((account) => ({ value: account.id, title: account.name }))} onChange={setPaymentReturnCashAccountId} />
        <Field label="Payment reversal reason" value={paymentReversalReason} onChangeText={setPaymentReversalReason} placeholder="Why were funds returned?" />
      </> : <Text style={uiStyles.helper}>Single-member books retain prior payment records for reference. New obligations and payments are disabled; ask a CPA about prior obligations and owner labor.</Text>}
      {snapshot.guaranteedPaymentCashEvents.length ? snapshot.guaranteedPaymentCashEvents.map((event) => {
        const paymentReversed = reversedPaymentIds.has(event.paymentId);
        return <View key={event.id} style={uiStyles.rowItem}>
          <View style={uiStyles.rowMain}>
            <Text style={uiStyles.rowTitle}>{event.memberName} · {guaranteedPaymentClassificationLabel(event.classification)} · {event.kind === 'payment' ? 'Payment' : 'Reversal'}</Text>
            <Text style={uiStyles.rowDetail}>{event.date} · {event.cashAccountName} · {event.description}</Text>
            {event.reason ? <Text style={uiStyles.rowDetail}>Reversal reason: {event.reason}</Text> : null}
            {event.kind === 'payment' && paymentReversed ? <Text style={uiStyles.badge}>Reversed · original retained</Text> : null}
            {canReverseHistoricalPayment(event.kind, paymentReversed)
              ? <Button title="Reverse returned payment" secondary onPress={() => void reversePayment(event.paymentId)} disabled={paymentSaving} />
              : null}
          </View>
          <Money cents={event.amountCents} />
        </View>;
      }) : <Text style={uiStyles.helper}>No member payments recorded.</Text>}
    </Panel>
    </> : null}
    {section === 'members' ? <Panel>
      <Text style={uiStyles.sectionTitle}>Ownership history</Text>
      {snapshot.memberHistory.map((record) => <View key={record.id + record.effectiveFrom} style={uiStyles.rowItem}>
        <View style={uiStyles.rowMain}>
          <Text style={uiStyles.rowTitle}>{record.name}</Text>
          <Text style={uiStyles.rowDetail}>{record.effectiveFrom}{record.effectiveTo ? ` through ${record.effectiveTo}` : ' onward'}</Text>
        </View>
        <Text style={uiStyles.badge}>{fromBasisPoints(record.ownershipBasisPoints)}%</Text>
      </View>)}
    </Panel> : null}
  </Page>;
}

function capitalActivityLabel(kind: CapitalActivityKind): string {
  if (kind === 'cash-contribution') return 'Cash contribution';
  if (kind === 'property-contribution') return 'Property contribution';
  return 'Distribution';
}

function guaranteedPaymentClassificationLabel(classification: GuaranteedPaymentClassification): string {
  return classification === 'services' ? 'Services' : 'Use of capital';
}

function fromBasisPoints(basisPoints: number): string {
  const whole = Math.floor(basisPoints / 100);
  const fraction = basisPoints % 100;
  return fraction === 0 ? String(whole) : `${whole}.${String(fraction).padStart(2, '0').replace(/0$/, '')}`;
}
