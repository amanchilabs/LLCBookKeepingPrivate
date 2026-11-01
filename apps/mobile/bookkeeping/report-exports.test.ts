import { describe, expect, it } from 'vitest';
import {
  balanceSheetCsv,
  cashBasisCsv,
  generalLedgerCsv,
  guaranteedPaymentCashCsv,
  isValidDateRange,
  loanCashActivityCsv,
  memberCapitalMovementCsv,
  trialBalanceCsv,
} from './report-exports';
import type {
  CashBasisReport,
  GeneralLedgerReport,
  GuaranteedPaymentCashEvent,
  JournalBalanceReport,
  LoanActivityRecord,
  LoanAgreementRecord,
  MemberCapitalActivityRecord,
} from '../../../packages/storage-native/src/bookkeeping-store';

const cashBasis: CashBasisReport = {
  fromDate: '2026-01-01', throughDate: '2026-10-31',
  incomeCents: 10_000n, expenseCents: 2_500n, netIncomeCents: 7_500n,
};

const balances: JournalBalanceReport = {
  asOfDate: '2026-10-31',
  trialBalance: [
    { accountId: 'cash-1', code: 'cash-1', name: 'Checking, main', kind: 'bank', debitCents: 15_000n, creditCents: 0n },
    { accountId: 'equity-1', code: '3000', name: 'Opening equity', kind: 'equity', debitCents: 0n, creditCents: 15_000n },
  ],
  totalDebitsCents: 15_000n,
  totalCreditsCents: 15_000n,
  balanceSheet: {
    assets: [{ accountId: 'cash-1', code: 'cash-1', name: 'Checking, main', balanceCents: 15_000n }],
    liabilities: [],
    equity: [{ accountId: 'equity-1', code: '3000', name: 'Opening equity', balanceCents: 10_000n }],
    currentEarningsCents: 5_000n,
    totalAssetsCents: 15_000n,
    totalLiabilitiesCents: 0n,
    bookEquityCents: 10_000n,
    totalEquityCents: 15_000n,
    differenceCents: 0n,
  },
};

const ledger: GeneralLedgerReport = {
  accountId: 'cash-1', accountName: 'Checking, main', accountKind: 'bank', asOfDate: '2026-10-31',
  lines: [{
    journalEntryId: 'entry-1', date: '2026-10-02', description: 'Owner said "rent"',
    debitCents: 10_000n, creditCents: 0n, runningBalanceCents: 10_000n,
  }],
  totalDebitsCents: 10_000n, totalCreditsCents: 0n, endingBalanceCents: 10_000n,
};

describe('CPA report CSV exports', () => {
  it('accepts only valid ISO dates in an ordered inclusive report range', () => {
    expect(isValidDateRange('2026-03-01', '2026-03-31')).toBe(true);
    expect(isValidDateRange('2026-03-31', '2026-03-31')).toBe(true);
    expect(isValidDateRange('', '2026-03-31')).toBe(false);
    expect(isValidDateRange('2026-02-30', '2026-03-31')).toBe(false);
    expect(isValidDateRange('2026-04-01', '2026-03-31')).toBe(false);
  });

  it('exports a cash-basis P&L whose net equals income less expenses', () => {
    expect(cashBasisCsv(cashBasis).split('\r\n')).toEqual([
      '"From date","Through date","Basis","Line item","Amount"',
      '"2026-01-01","2026-10-31","Cash basis","Income","100.00"',
      '"2026-01-01","2026-10-31","Cash basis","Operating expenses","25.00"',
      '"2026-01-01","2026-10-31","Cash basis","Net income","75.00"',
    ]);
  });

  it('exports Balance Sheet sections and totals without changing their reconciliation', () => {
    expect(balanceSheetCsv(balances).split('\r\n')).toContain('"2026-10-31","Reconciliation","Assets − liabilities − equity","","0.00"');
    expect(balanceSheetCsv(balances).split('\r\n')).toContain('"2026-10-31","Equity","Current earnings through date","","50.00"');
  });

  it('exports Trial Balance debit and credit totals that match', () => {
    expect(trialBalanceCsv(balances).split('\r\n')).toEqual([
      '"As of date","Account","Account type","Debit","Credit"',
      '"2026-10-31","Checking, main","bank","150.00","0.00"',
      '"2026-10-31","Opening equity","equity","0.00","150.00"',
      '"2026-10-31","TOTALS","","150.00","150.00"',
    ]);
  });

  it('quotes delimiters in General Ledger descriptions and includes running balances', () => {
    expect(generalLedgerCsv(ledger).split('\r\n')).toEqual([
      '"As of date","Account","Date","Journal entry","Description","Debit","Credit","Running balance"',
      '"2026-10-31","Checking, main","2026-10-02","entry-1","Owner said ""rent""","100.00","0.00","100.00"',
      '"2026-10-31","Checking, main","TOTALS","","","100.00","0.00","100.00"',
    ]);
  });

  it('exports selected-period member capital and cash movements as signed book activity', () => {
    const activities: MemberCapitalActivityRecord[] = [
      {
        id: 'capital-1', journalEntryId: 'journal-1', memberId: 'member-1', memberName: 'Jordan, Lee',
        date: '2026-03-02', kind: 'cash-contribution', amountCents: 10_000n,
        description: 'Initial cash', cashAccountName: 'Checking', propertyDescription: null, requiresCpaReview: false,
      },
      {
        id: 'capital-2', journalEntryId: 'journal-2', memberId: 'member-1', memberName: 'Jordan, Lee',
        date: '2026-03-04', kind: 'property-contribution', amountCents: 2_500n,
        description: 'Used laptop', cashAccountName: null, propertyDescription: 'Laptop, 2024 model', requiresCpaReview: true,
      },
      {
        id: 'capital-3', journalEntryId: 'journal-3', memberId: 'member-2', memberName: 'Casey',
        date: '2026-03-05', kind: 'distribution', amountCents: 3_000n,
        description: 'Member draw', cashAccountName: 'Checking', propertyDescription: null, requiresCpaReview: false,
      },
      {
        id: 'capital-outside-range', journalEntryId: 'journal-4', memberId: 'member-2', memberName: 'Casey',
        date: '2026-04-01', kind: 'cash-contribution', amountCents: 99_000n,
        description: 'Outside range', cashAccountName: 'Checking', propertyDescription: null, requiresCpaReview: false,
      },
    ];

    expect(memberCapitalMovementCsv('2026-03-01', '2026-03-31', activities).split('\r\n')).toEqual([
      '"From date","Through date","Date","Journal entry","Member","Activity","Book capital movement","Cash movement","Cash account","Property description","Description","CPA review"',
      '"2026-03-01","2026-03-31","2026-03-02","journal-1","Jordan, Lee","Cash contribution","100.00","100.00","Checking","","Initial cash","No"',
      '"2026-03-01","2026-03-31","2026-03-04","journal-2","Jordan, Lee","Property contribution","25.00","0.00","","Laptop, 2024 model","Used laptop","Yes"',
      '"2026-03-01","2026-03-31","2026-03-05","journal-3","Casey","Distribution","-30.00","-30.00","Checking","","Member draw","No"',
      '"2026-03-01","2026-03-31","2026-03-31","","TOTAL","Selected-period totals","95.00","70.00","","","",""',
    ]);
  });

  it('exports actual guaranteed-payment cash events with reversals and classification totals', () => {
    const events: GuaranteedPaymentCashEvent[] = [
      {
        id: 'event-1', paymentId: 'payment-1', transactionId: 'transaction-1', memberId: 'member-1', memberName: 'Jordan, Lee',
        classification: 'services', date: '2026-03-02', kind: 'payment', amountCents: 10_000n,
        cashAccountName: 'Checking', description: 'March installment', reason: null,
      },
      {
        id: 'event-2', paymentId: 'payment-1', transactionId: 'transaction-2', memberId: 'member-1', memberName: 'Jordan, Lee',
        classification: 'services', date: '2026-03-04', kind: 'reversal', amountCents: -10_000n,
        cashAccountName: 'Savings', description: 'March installment', reason: 'Returned funds',
      },
      {
        id: 'event-3', paymentId: 'payment-2', transactionId: 'transaction-3', memberId: 'member-2', memberName: 'Casey',
        classification: 'use-of-capital', date: '2026-03-05', kind: 'payment', amountCents: 2_500n,
        cashAccountName: 'Checking', description: 'Capital use', reason: null,
      },
      {
        id: 'event-4', paymentId: 'payment-3', transactionId: 'transaction-4', memberId: 'member-1', memberName: 'Jordan, Lee',
        classification: 'services', date: '2026-03-06', kind: 'payment', amountCents: 6_000n,
        cashAccountName: 'Checking', description: 'Second service installment', reason: null,
      },
      {
        id: 'event-outside-range', paymentId: 'payment-4', transactionId: 'transaction-5', memberId: 'member-2', memberName: 'Casey',
        classification: 'services', date: '2026-04-01', kind: 'payment', amountCents: 99_000n,
        cashAccountName: 'Checking', description: 'Outside range', reason: null,
      },
    ];

    expect(guaranteedPaymentCashCsv('2026-03-01', '2026-03-31', [...events].reverse()).split('\r\n')).toEqual([
      '"From date","Through date","Date","Event","Member","Classification","Signed workpaper amount (+ paid / - returned)","Cash movement (- paid / + returned)","Cash account","Description","Payment ID","Transaction ID","Reversal reason"',
      '"2026-03-01","2026-03-31","2026-03-02","Payment","Jordan, Lee","Services","100.00","-100.00","Checking","March installment","payment-1","transaction-1",""',
      '"2026-03-01","2026-03-31","2026-03-04","Reversal","Jordan, Lee","Services","-100.00","100.00","Savings","March installment","payment-1","transaction-2","Returned funds"',
      '"2026-03-01","2026-03-31","2026-03-05","Payment","Casey","Use of capital","25.00","-25.00","Checking","Capital use","payment-2","transaction-3",""',
      '"2026-03-01","2026-03-31","2026-03-06","Payment","Jordan, Lee","Services","60.00","-60.00","Checking","Second service installment","payment-3","transaction-4",""',
      '"2026-03-01","2026-03-31","2026-03-31","Period total","","Services net","60.00","-60.00","","","","",""',
      '"2026-03-01","2026-03-31","2026-03-31","Period total","","Use of capital net","25.00","-25.00","","","","",""',
      '"2026-03-01","2026-03-31","2026-03-31","Period total","","All cash activity net","85.00","-85.00","","","","",""',
    ]);
    expect(() => guaranteedPaymentCashCsv('', '2026-03-31', events)).toThrow('Enter a valid date range');
  });

  it('exports funded loan cash, principal, and paid-interest movements that reconcile', () => {
    const agreements: LoanAgreementRecord[] = [
      {
        id: 'loan-member', lenderType: 'member', memberId: 'member-1', lenderName: 'Jordan, Lee',
        agreementDate: '2026-03-01', commitmentCents: 100_000n, annualRateBasisPoints: 500,
        dayCount: 'ACT/365F', description: 'Member note', liabilityAccountId: 'liability-member',
      },
      {
        id: 'loan-third-party', lenderType: 'third-party', memberId: null, lenderName: 'Acme Lender',
        agreementDate: '2026-03-01', commitmentCents: 50_000n, annualRateBasisPoints: 600,
        dayCount: 'ACT/ACT ISDA', description: 'Vendor note', liabilityAccountId: 'liability-third-party',
      },
    ];
    const activities: LoanActivityRecord[] = [
      {
        id: 'activity-advance-member', loanId: 'loan-member', transactionId: 'transaction-1', journalEntryId: 'journal-1',
        date: '2026-03-02', kind: 'advance', cashAccountId: 'cash-1', cashAccountName: 'Checking',
        amountCents: 50_000n, principalCents: 0n, interestCents: 0n, description: 'Advance, March',
      },
      {
        id: 'activity-advance-third-party', loanId: 'loan-third-party', transactionId: 'transaction-2', journalEntryId: 'journal-2',
        date: '2026-03-05', kind: 'advance', cashAccountId: 'cash-1', cashAccountName: 'Checking',
        amountCents: 10_000n, principalCents: 0n, interestCents: 0n, description: 'Vendor advance',
      },
      {
        id: 'activity-repayment-member', loanId: 'loan-member', transactionId: 'transaction-3', journalEntryId: 'journal-3',
        date: '2026-03-10', kind: 'repayment', cashAccountId: 'cash-1', cashAccountName: 'Checking',
        amountCents: -26_000n, principalCents: 25_000n, interestCents: 1_000n, description: 'Principal and interest',
      },
      {
        id: 'activity-outside-period', loanId: 'loan-third-party', transactionId: 'transaction-4', journalEntryId: 'journal-4',
        date: '2026-04-01', kind: 'advance', cashAccountId: 'cash-1', cashAccountName: 'Checking',
        amountCents: 99_000n, principalCents: 0n, interestCents: 0n, description: 'Outside period',
      },
    ];

    expect(loanCashActivityCsv('2026-03-01', '2026-03-31', [...activities].reverse(), agreements).split('\r\n')).toEqual([
      '"From date","Through date","Date","Event","Lender","Lender type","Loan ID","Cash account","Cash movement (+ advance / - repayment)","Principal movement (+ advance / - repayment)","Interest paid","Description","Activity ID","Transaction ID","Journal entry ID"',
      '"2026-03-01","2026-03-31","2026-03-02","Advance","Jordan, Lee","Member","loan-member","Checking","500.00","500.00","0.00","Advance, March","activity-advance-member","transaction-1","journal-1"',
      '"2026-03-01","2026-03-31","2026-03-05","Advance","Acme Lender","Third party","loan-third-party","Checking","100.00","100.00","0.00","Vendor advance","activity-advance-third-party","transaction-2","journal-2"',
      '"2026-03-01","2026-03-31","2026-03-10","Repayment","Jordan, Lee","Member","loan-member","Checking","-260.00","-250.00","10.00","Principal and interest","activity-repayment-member","transaction-3","journal-3"',
      '"2026-03-01","2026-03-31","2026-03-31","Period totals","","","","","340.00","350.00","10.00","","","",""',
    ]);
    expect(() => loanCashActivityCsv('2026-04-01', '2026-03-31', activities, agreements)).toThrow('Enter a valid date range');
  });
});
