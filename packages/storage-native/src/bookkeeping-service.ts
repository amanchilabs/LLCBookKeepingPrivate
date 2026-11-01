import { withActiveDatabase } from './storage-access';
import {
  cashBasisReportFromDatabase,
  cashMovementReportFromDatabase,
  completeAccountReconciliationInDatabase,
  createCategoryAccountInDatabase,
  createRecurringTransactionInDatabase,
  updateRecurringTransactionInDatabase,
  createAccountReconciliationInDatabase,
  closeAccountingPeriodInDatabase,
  createBusinessInDatabase,
  createCashAccountInDatabase,
  correctCashTransactionInDatabase,
  ensureBookkeepingSchema,
  createLoanAgreementInDatabase,
  createGuaranteedPaymentObligationInDatabase,
  getBookkeepingSnapshotFromDatabase,
  generalLedgerReportFromDatabase,
  journalBalanceReportFromDatabase,
  recordGuaranteedPaymentInDatabase,
  recordLoanAdvanceInDatabase,
  recordLoanRepaymentInDatabase,
  recordMemberCapitalActivityInDatabase,
  recordCashTransactionInDatabase,
  recordSplitCashTransactionInDatabase,
  postRecurringTransactionInDatabase,
  recordTransferInDatabase,
  reopenAccountReconciliationInDatabase,
  reopenAccountingPeriodInDatabase,
  reverseGuaranteedPaymentInDatabase,
  setAccountReconciliationItemClearedInDatabase,
  setRecurringTransactionActiveInDatabase,
  replaceMembersInDatabase,
  type BookkeepingSnapshot,
  type CreateAccountReconciliationInput,
  type CloseAccountingPeriodInput,
  type ReopenAccountingPeriodInput,
  type CashAccountInput,
  type CategoryAccountInput,
  type CreateRecurringTransactionInput,
  type CashBasisReport,
  type CashMovementReport,
  type GeneralLedgerReport,
  type JournalBalanceReport,
  type CorrectCashTransactionInput,
  type CashTransactionInput,
  type SplitCashTransactionInput,
  type PostRecurringTransactionInput,
  type TransferInput,
  type CreateGuaranteedPaymentObligationInput,
  type CreateLoanAgreementInput,
  type RecordLoanAdvanceInput,
  type RecordLoanRepaymentInput,
  type RecordGuaranteedPaymentInput,
  type ReverseGuaranteedPaymentInput,
  type MemberCapitalActivityInput,
  type ReplaceMembersInput,
} from './bookkeeping-store';
import type { BusinessSetupInput } from '../../domain/src/bookkeeping';

function emptySnapshot(): BookkeepingSnapshot {
  return {
    business: null,
    members: [],
    memberHistory: [],
    accounts: [],
    transactions: [],
    capitalActivities: [],
    memberCapitalSummaries: [],
    guaranteedPaymentInstallments: [],
    guaranteedPaymentCashEvents: [],
    loanAgreements: [],
    loanActivities: [],
    accountReconciliations: [],
    accountReconciliationEvents: [],
    accountingPeriodEvents: [],
    closedThroughDate: null,
    recurringTransactions: [],
    cashBasis: { incomeCents: 0n, expenseCents: 0n, netIncomeCents: 0n },
  };
}

async function useActiveBooks<T>(operation: (database: Parameters<typeof createBusinessInDatabase>[0]) => Promise<T>): Promise<T> {
  return await withActiveDatabase(async (database) => {
    await ensureBookkeepingSchema(database);
    return await operation(database);
  });
}

export async function createBusiness(input: BusinessSetupInput): Promise<void> {
  await useActiveBooks((database) => createBusinessInDatabase(database, input));
}

export async function createCashAccount(input: CashAccountInput): Promise<void> {
  await useActiveBooks((database) => createCashAccountInDatabase(database, input));
}

export async function createCategoryAccount(input: CategoryAccountInput): Promise<void> {
  await useActiveBooks((database) => createCategoryAccountInDatabase(database, input));
}

export async function createRecurringTransaction(input: CreateRecurringTransactionInput): Promise<void> {
  await useActiveBooks((database) => createRecurringTransactionInDatabase(database, input));
}

export async function updateRecurringTransaction(input: CreateRecurringTransactionInput): Promise<void> {
  await useActiveBooks((database) => updateRecurringTransactionInDatabase(database, input));
}

export async function postRecurringTransaction(input: PostRecurringTransactionInput): Promise<void> {
  await useActiveBooks((database) => postRecurringTransactionInDatabase(database, input));
}

export async function setRecurringTransactionActive(templateId: string, isActive: boolean): Promise<void> {
  await useActiveBooks(async (database) => {
    const snapshot = await getBookkeepingSnapshotFromDatabase(database);
    if (!snapshot?.business) throw new Error('Create an LLC before changing recurring transactions.');
    await setRecurringTransactionActiveInDatabase(database, snapshot.business.id, templateId, isActive);
  });
}

export async function recordCashTransaction(input: CashTransactionInput): Promise<void> {
  await useActiveBooks((database) => recordCashTransactionInDatabase(database, input));
}

export async function recordSplitCashTransaction(input: SplitCashTransactionInput): Promise<void> {
  await useActiveBooks((database) => recordSplitCashTransactionInDatabase(database, input));
}

export async function recordTransfer(input: TransferInput): Promise<void> {
  await useActiveBooks((database) => recordTransferInDatabase(database, input));
}

export async function createAccountReconciliation(input: CreateAccountReconciliationInput): Promise<void> {
  await useActiveBooks((database) => createAccountReconciliationInDatabase(database, input));
}

export async function closeAccountingPeriod(input: CloseAccountingPeriodInput): Promise<void> {
  await useActiveBooks((database) => closeAccountingPeriodInDatabase(database, input));
}

export async function reopenAccountingPeriod(input: ReopenAccountingPeriodInput): Promise<void> {
  await useActiveBooks((database) => reopenAccountingPeriodInDatabase(database, input));
}

export async function setAccountReconciliationItemCleared(
  reconciliationId: string,
  transactionId: string,
  cleared: boolean,
): Promise<void> {
  await useActiveBooks((database) => setAccountReconciliationItemClearedInDatabase(database, reconciliationId, transactionId, cleared));
}

export async function completeAccountReconciliation(reconciliationId: string): Promise<void> {
  await useActiveBooks((database) => completeAccountReconciliationInDatabase(database, reconciliationId));
}

export async function reopenAccountReconciliation(reconciliationId: string): Promise<void> {
  await useActiveBooks((database) => reopenAccountReconciliationInDatabase(database, reconciliationId));
}

export async function recordMemberCapitalActivity(input: MemberCapitalActivityInput): Promise<void> {
  await useActiveBooks((database) => recordMemberCapitalActivityInDatabase(database, input));
}

export async function createGuaranteedPaymentObligation(input: CreateGuaranteedPaymentObligationInput): Promise<void> {
  await useActiveBooks((database) => createGuaranteedPaymentObligationInDatabase(database, input));
}

export async function createLoanAgreement(input: CreateLoanAgreementInput): Promise<void> {
  await useActiveBooks((database) => createLoanAgreementInDatabase(database, input));
}

export async function recordLoanAdvance(input: RecordLoanAdvanceInput): Promise<void> {
  await useActiveBooks((database) => recordLoanAdvanceInDatabase(database, input));
}

export async function recordLoanRepayment(input: RecordLoanRepaymentInput): Promise<void> {
  await useActiveBooks((database) => recordLoanRepaymentInDatabase(database, input));
}

export async function recordGuaranteedPayment(input: RecordGuaranteedPaymentInput): Promise<void> {
  await useActiveBooks((database) => recordGuaranteedPaymentInDatabase(database, input));
}

export async function reverseGuaranteedPayment(input: ReverseGuaranteedPaymentInput): Promise<void> {
  await useActiveBooks((database) => reverseGuaranteedPaymentInDatabase(database, input));
}

export async function correctCashTransaction(input: CorrectCashTransactionInput): Promise<void> {
  await useActiveBooks((database) => correctCashTransactionInDatabase(database, input));
}

export async function replaceMembers(input: ReplaceMembersInput): Promise<void> {
  await useActiveBooks((database) => replaceMembersInDatabase(database, input));
}

export async function getBookkeepingSnapshot(businessId?: string): Promise<BookkeepingSnapshot> {
  return await useActiveBooks(async (database) => (
    await getBookkeepingSnapshotFromDatabase(database, businessId)
  ) ?? emptySnapshot());
}

export async function getCashBasisReport(
  businessId: string,
  fromDate: string,
  throughDate: string,
): Promise<CashBasisReport> {
  return await useActiveBooks((database) => cashBasisReportFromDatabase(database, businessId, fromDate, throughDate));
}

export async function getCashMovementReport(
  businessId: string,
  fromDate: string,
  throughDate: string,
): Promise<CashMovementReport> {
  return await useActiveBooks((database) => cashMovementReportFromDatabase(database, businessId, fromDate, throughDate));
}

export async function getJournalBalanceReport(businessId: string, asOfDate: string): Promise<JournalBalanceReport> {
  return await useActiveBooks((database) => journalBalanceReportFromDatabase(database, businessId, asOfDate));
}

export async function getGeneralLedgerReport(
  businessId: string,
  accountId: string,
  asOfDate: string,
): Promise<GeneralLedgerReport> {
  return await useActiveBooks((database) => generalLedgerReportFromDatabase(database, businessId, accountId, asOfDate));
}
