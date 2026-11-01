import type { AccountRecord, AccountReconciliationRecord } from '../../../packages/storage-native/src/bookkeeping-store';

export function selectBankAccountId(
  bankAccounts: Pick<AccountRecord, 'id'>[],
  reconciliations: Pick<AccountReconciliationRecord, 'accountId' | 'status'>[],
  requestedAccountId: string,
): string {
  if (bankAccounts.some((account) => account.id === requestedAccountId)) return requestedAccountId;
  const draft = reconciliations.find((item) => item.status === 'draft' && bankAccounts.some((account) => account.id === item.accountId));
  return draft?.accountId ?? bankAccounts[0]?.id ?? '';
}

export function findDraftForAccount<T extends Pick<AccountReconciliationRecord, 'accountId' | 'status'>>(
  reconciliations: T[],
  accountId: string,
): T | undefined {
  return reconciliations.find((item) => item.accountId === accountId && item.status === 'draft');
}
