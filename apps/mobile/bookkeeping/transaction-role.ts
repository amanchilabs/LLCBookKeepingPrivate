import type { TransactionRecord } from '../../../packages/storage-native/src/bookkeeping-store';

type TransactionRoleInput = Pick<
  TransactionRecord,
  'id' | 'kind' | 'transferRole' | 'recurringTemplateId' | 'correctionRole' | 'originalTransactionId' | 'isGuaranteedPayment'
>;

export function transactionRoleLabel(transaction: TransactionRoleInput): string {
  if (transaction.transferRole === 'transfer-reversal') return 'Transfer reversal';
  if (transaction.correctionRole === 'reversal') return 'Reversal';
  if (transaction.correctionRole === 'replacement') return 'Replacement';
  if (transaction.isGuaranteedPayment && transaction.originalTransactionId === transaction.id) return 'Original · reversed';
  if (transaction.originalTransactionId) return 'Original · corrected';
  if (transaction.recurringTemplateId) return 'Recurring';
  if (transaction.kind === 'opening-balance') return 'Opening balance';
  if (transaction.kind === 'loan-advance') return 'Loan advance';
  if (transaction.kind === 'loan-repayment') return 'Loan repayment';
  if (transaction.kind === 'transfer') return 'Transfer';
  return transaction.kind === 'income' ? 'Income' : 'Operating expense';
}
