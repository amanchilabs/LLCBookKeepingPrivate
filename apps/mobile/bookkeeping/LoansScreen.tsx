import * as Crypto from 'expo-crypto';
import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { parseAnnualRatePercent, summarizeLoanBalance } from '../../../packages/domain/src/loan-interest';
import { parseUsd } from '../../../packages/domain/src/money';
import {
  createLoanAgreement,
  recordLoanAdvance,
  recordLoanRepayment,
} from '../../../packages/storage-native/src/bookkeeping-service';
import type { LoanAgreementRecord, LoanActivityRecord, LoanDayCount, LoanLenderType } from '../../../packages/storage-native/src/bookkeeping-store';
import type { BookkeepingSnapshot } from '../../../packages/storage-native/src/bookkeeping-store';
import { Button, Choice, Field, FormError, Heading, Money, Page, Panel, todayLocalDate, uiStyles } from './ui';

export function LoansScreen({ snapshot, onSaved }: { snapshot: BookkeepingSnapshot; onSaved: () => Promise<void> }) {
  const cashAccounts = snapshot.accounts.filter((account) => account.kind === 'bank' || account.kind === 'cash');
  const [lenderType, setLenderType] = useState<LoanLenderType>('member');
  const [memberId, setMemberId] = useState(snapshot.members[0]?.id ?? '');
  const [lenderName, setLenderName] = useState('');
  const [agreementDate, setAgreementDate] = useState(todayLocalDate());
  const [commitmentText, setCommitmentText] = useState('');
  const [ratePercent, setRatePercent] = useState('');
  const [dayCount, setDayCount] = useState<LoanDayCount>('ACT/365F');
  const [agreementDescription, setAgreementDescription] = useState('');
  const [agreementError, setAgreementError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedLoanId, setSelectedLoanId] = useState(snapshot.loanAgreements[0]?.id ?? '');
  const [advanceDate, setAdvanceDate] = useState(todayLocalDate());
  const [advanceAccountId, setAdvanceAccountId] = useState(cashAccounts[0]?.id ?? '');
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [advanceDescription, setAdvanceDescription] = useState('');
  const [advanceError, setAdvanceError] = useState<string | null>(null);
  const [repaymentDate, setRepaymentDate] = useState(todayLocalDate());
  const [repaymentAccountId, setRepaymentAccountId] = useState(cashAccounts[0]?.id ?? '');
  const [principalAmount, setPrincipalAmount] = useState('');
  const [interestAmount, setInterestAmount] = useState('');
  const [repaymentDescription, setRepaymentDescription] = useState('');
  const [repaymentError, setRepaymentError] = useState<string | null>(null);
  const [activityNotice, setActivityNotice] = useState<string | null>(null);
  const today = todayLocalDate();

  useEffect(() => {
    if (!snapshot.members.some((member) => member.id === memberId)) setMemberId(snapshot.members[0]?.id ?? '');
    if (!snapshot.loanAgreements.some((loan) => loan.id === selectedLoanId)) setSelectedLoanId(snapshot.loanAgreements[0]?.id ?? '');
    if (!cashAccounts.some((account) => account.id === advanceAccountId)) setAdvanceAccountId(cashAccounts[0]?.id ?? '');
    if (!cashAccounts.some((account) => account.id === repaymentAccountId)) setRepaymentAccountId(cashAccounts[0]?.id ?? '');
  }, [snapshot.members, snapshot.loanAgreements, snapshot.accounts, memberId, selectedLoanId, advanceAccountId, repaymentAccountId]);

  const createAgreement = async () => {
    setSaving(true);
    setAgreementError(null);
    setActivityNotice(null);
    try {
      const id = Crypto.randomUUID();
      await createLoanAgreement({
        id,
        businessId: snapshot.business!.id,
        lenderType,
        memberId: lenderType === 'member' ? memberId : undefined,
        lenderName: lenderType === 'third-party' ? lenderName : undefined,
        agreementDate,
        commitmentCents: parseUsd(commitmentText),
        annualRateBasisPoints: parseAnnualRatePercent(ratePercent),
        dayCount,
        description: agreementDescription,
      });
      setSelectedLoanId(id);
      setLenderName('');
      setCommitmentText('');
      setRatePercent('');
      setAgreementDescription('');
      setActivityNotice('Loan agreement saved as a memorandum record. No cash, principal, income, or expense was posted.');
      await onSaved();
    } catch (saveError) {
      setAgreementError(saveError instanceof Error ? saveError.message : 'The loan agreement could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const postAdvance = async () => {
    setSaving(true);
    setAdvanceError(null);
    setActivityNotice(null);
    try {
      if (!selectedLoanId) throw new Error('Create or choose a loan agreement first.');
      if (!advanceAccountId) throw new Error('Create a bank or cash account before recording an advance.');
      await recordLoanAdvance({
        id: Crypto.randomUUID(), transactionId: Crypto.randomUUID(), journalEntryId: Crypto.randomUUID(),
        loanId: selectedLoanId, date: advanceDate, cashAccountId: advanceAccountId,
        amountCents: parseUsd(advanceAmount), description: advanceDescription,
      });
      setAdvanceAmount('');
      setAdvanceDescription('');
      setActivityNotice('Funded advance posted to cash and loan payable. Loan proceeds are excluded from income.');
      await onSaved();
    } catch (saveError) {
      setAdvanceError(saveError instanceof Error ? saveError.message : 'The loan advance could not be posted.');
    } finally {
      setSaving(false);
    }
  };

  const postRepayment = async () => {
    setSaving(true);
    setRepaymentError(null);
    setActivityNotice(null);
    try {
      if (!selectedLoanId) throw new Error('Create or choose a loan agreement first.');
      if (!repaymentAccountId) throw new Error('Create a bank or cash account before recording a repayment.');
      const principalCents = parseOptionalUsd(principalAmount);
      const interestCents = parseOptionalUsd(interestAmount);
      if (principalCents + interestCents <= 0n) throw new Error('Enter a positive principal amount, interest amount, or both.');
      await recordLoanRepayment({
        id: Crypto.randomUUID(), transactionId: Crypto.randomUUID(), journalEntryId: Crypto.randomUUID(),
        loanId: selectedLoanId, date: repaymentDate, cashAccountId: repaymentAccountId,
        principalCents, interestCents, description: repaymentDescription,
      });
      setPrincipalAmount('');
      setInterestAmount('');
      setRepaymentDescription('');
      setActivityNotice('Repayment posted. Principal reduced debt; only paid interest entered expenses.');
      await onSaved();
    } catch (saveError) {
      setRepaymentError(saveError instanceof Error ? saveError.message : 'The loan repayment could not be posted.');
    } finally {
      setSaving(false);
    }
  };

  const loanOptions = snapshot.loanAgreements.map((loan) => ({
    value: loan.id,
    title: `${loan.lenderType === 'member' ? loan.lenderName : loan.lenderName} · ${loan.id.slice(0, 6)}`,
  }));
  const cashOptions = cashAccounts.map((account) => ({ value: account.id, title: account.name }));

  return <Page>
    <Heading title="Loans" subtitle="Track member and third-party loan agreements, funded advances, principal, and actual interest payments in your encrypted local books." />
    {activityNotice ? <Panel><Text accessibilityRole="status" style={uiStyles.rowDetail}>{activityNotice}</Text></Panel> : null}
    <Panel>
      <Text style={uiStyles.sectionTitle}>Loan agreement</Text>
      <Text style={uiStyles.helper}>Commitment ceilings are memorandum records. Cash and liability move only when an advance is funded.</Text>
      <Choice label="Lender type" value={lenderType} options={[
        { value: 'member', title: 'LLC member' }, { value: 'third-party', title: 'Third party' },
      ]} onChange={setLenderType} />
      {lenderType === 'member'
        ? <Choice label="Lending member" value={memberId} options={snapshot.members.map((member) => ({ value: member.id, title: member.name }))} onChange={setMemberId} />
        : <Field label="Third-party lender" value={lenderName} onChangeText={setLenderName} placeholder="Lender name" autoCapitalize="words" />}
      <Field label="Agreement date" value={agreementDate} onChangeText={setAgreementDate} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />
      <Field label="Commitment ceiling in USD" value={commitmentText} onChangeText={setCommitmentText} placeholder="0.00" keyboardType="decimal-pad" />
      <Field label="Fixed annual rate from agreement (%)" value={ratePercent} onChangeText={setRatePercent} placeholder="10.00" keyboardType="decimal-pad" />
      <Choice label="Day-count convention from agreement" value={dayCount} options={[
        { value: 'ACT/365F', title: 'ACT/365F' }, { value: 'ACT/ACT ISDA', title: 'ACT/ACT ISDA' },
      ]} onChange={setDayCount} />
      <Field label="Agreement description" value={agreementDescription} onChangeText={setAgreementDescription} placeholder="Signed member loan agreement" />
      <Text style={uiStyles.helper}>Enter the fixed rate and day-count convention from the signed agreement. The app does not choose a rate or determine tax treatment.</Text>
      <FormError message={agreementError} />
      <Button title={saving ? 'Saving…' : 'Save loan agreement'} onPress={() => void createAgreement()} disabled={saving} />
    </Panel>

    <Panel>
      <Text style={uiStyles.sectionTitle}>Funded advance</Text>
      {loanOptions.length ? <>
        <Choice label="Loan agreement" value={selectedLoanId} options={loanOptions} onChange={setSelectedLoanId} />
        <Field label="Advance date" value={advanceDate} onChangeText={setAdvanceDate} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />
        <Choice label="Deposit account" value={advanceAccountId} options={cashOptions} onChange={setAdvanceAccountId} />
        <Field label="Advance amount in USD" value={advanceAmount} onChangeText={setAdvanceAmount} placeholder="0.00" keyboardType="decimal-pad" />
        <Field label="Advance description" value={advanceDescription} onChangeText={setAdvanceDescription} placeholder="First loan advance" />
        <FormError message={advanceError} />
        <Button title={saving ? 'Posting…' : 'Post funded advance'} onPress={() => void postAdvance()} disabled={saving || cashOptions.length === 0} />
        {cashOptions.length === 0 ? <Text style={uiStyles.helper}>Create a bank or cash account before recording an advance.</Text> : null}
      </> : <Text style={uiStyles.helper}>Save a loan agreement before entering funded advances.</Text>}
    </Panel>

    <Panel>
      <Text style={uiStyles.sectionTitle}>Principal and interest repayment</Text>
      {loanOptions.length ? <>
        <Choice label="Loan agreement" value={selectedLoanId} options={loanOptions} onChange={setSelectedLoanId} />
        <Field label="Repayment date" value={repaymentDate} onChangeText={setRepaymentDate} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />
        <Choice label="Payment account" value={repaymentAccountId} options={cashOptions} onChange={setRepaymentAccountId} />
        <View style={uiStyles.row}>
          <Field label="Principal in USD" value={principalAmount} onChangeText={setPrincipalAmount} placeholder="0.00" keyboardType="decimal-pad" />
          <Field label="Interest paid in USD" value={interestAmount} onChangeText={setInterestAmount} placeholder="0.00" keyboardType="decimal-pad" />
        </View>
        <Field label="Repayment description" value={repaymentDescription} onChangeText={setRepaymentDescription} placeholder="Monthly loan payment" />
        <Text style={uiStyles.helper}>Leave one amount blank or zero for principal-only or interest-only payments. Interest must be accrued through the repayment date; that date is excluded.</Text>
        <FormError message={repaymentError} />
        <Button title={saving ? 'Posting…' : 'Post loan repayment'} onPress={() => void postRepayment()} disabled={saving || cashOptions.length === 0} />
      </> : <Text style={uiStyles.helper}>Save a loan agreement before recording repayments.</Text>}
    </Panel>

    <Panel>
      <Text style={uiStyles.sectionTitle}>Loan balances through {today}</Text>
      {snapshot.loanAgreements.length ? snapshot.loanAgreements.map((loan) => <LoanBalanceRow
        key={loan.id} loan={loan} activities={snapshot.loanActivities.filter((activity) => activity.loanId === loan.id)} asOfDate={today}
      />) : <Text style={uiStyles.helper}>No loan agreements yet.</Text>}
      <Text style={uiStyles.helper}>Accrued interest is an estimate from dated principal events. It is not posted to expense until actually paid. Balances are book balances, not tax basis.</Text>
    </Panel>

    <Panel>
      <Text style={uiStyles.sectionTitle}>Dated loan history</Text>
      {snapshot.loanActivities.length ? snapshot.loanActivities.slice().sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)).map((activity) => <LoanActivityRow key={activity.id} activity={activity} agreements={snapshot.loanAgreements} />)
        : <Text style={uiStyles.helper}>Funded advances and repayments will appear here as immutable dated records.</Text>}
    </Panel>
  </Page>;
}

function LoanBalanceRow({ loan, activities, asOfDate }: { loan: LoanAgreementRecord; activities: LoanActivityRecord[]; asOfDate: string }) {
  const summary = summarizeLoanBalance({
    commitmentCents: loan.commitmentCents,
    annualRateBasisPoints: loan.annualRateBasisPoints,
    dayCount: loan.dayCount,
    asOfDate,
    activities: activities.map((activity) => ({
      date: activity.date, kind: activity.kind, amountCents: activity.amountCents,
      principalCents: activity.principalCents, interestCents: activity.interestCents,
    })),
  });
  return <View style={uiStyles.loanCard}>
    <View style={uiStyles.rowMain}>
      <Text style={uiStyles.rowTitle}>{loan.lenderType === 'member' ? 'Member loan' : 'Third-party loan'} · {loan.lenderName}</Text>
      <Text style={uiStyles.rowDetail}>Rate {rateLabel(loan.annualRateBasisPoints)} · {loan.dayCount}</Text>
      <View style={uiStyles.reportRow}><Text style={uiStyles.rowDetail}>Commitment remaining</Text><Money cents={summary.commitmentRemainingCents} /></View>
      <View style={uiStyles.reportRow}><Text style={uiStyles.rowDetail}>Principal outstanding</Text><Money cents={summary.principalOutstandingCents} /></View>
      <View style={uiStyles.reportRow}><Text style={uiStyles.rowDetail}>Interest accrued / paid / remaining</Text><Text style={uiStyles.rowTitle}>{formatMoney(summary.interestAccruedCents)} / {formatMoney(summary.interestPaidCents)} / {formatMoney(summary.interestOutstandingCents)}</Text></View>
    </View>
  </View>;
}

function LoanActivityRow({ activity, agreements }: { activity: LoanActivityRecord; agreements: LoanAgreementRecord[] }) {
  const agreement = agreements.find((loan) => loan.id === activity.loanId);
  return <View style={uiStyles.rowItem}>
    <View style={uiStyles.rowMain}>
      <Text style={uiStyles.rowTitle}>{activity.kind === 'advance' ? 'Funded advance' : 'Loan repayment'} · {agreement?.lenderName ?? 'Loan'}</Text>
      <Text style={uiStyles.rowDetail}>{activity.date} · {activity.cashAccountName} · {activity.description}</Text>
      {activity.kind === 'repayment' ? <Text style={uiStyles.rowDetail}>Principal {formatMoney(activity.principalCents)} · interest {formatMoney(activity.interestCents)}</Text> : null}
    </View>
    <Money cents={activity.amountCents} />
  </View>;
}

function parseOptionalUsd(text: string): bigint {
  return text.trim() ? parseUsd(text) : 0n;
}

function rateLabel(basisPoints: number): string {
  const whole = Math.floor(basisPoints / 100);
  const fraction = String(basisPoints % 100).padStart(2, '0');
  return `${whole}.${fraction}% fixed`;
}

function formatMoney(cents: bigint): string {
  const negative = cents < 0n;
  const absolute = negative ? -cents : cents;
  return `${negative ? '−' : ''}$${(absolute / 100n).toLocaleString('en-US')}.${String(absolute % 100n).padStart(2, '0')}`;
}
