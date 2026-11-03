export type TransactionWorkspaceSection = 'history' | 'recurring' | 'import';

export const transactionWorkspaceSections = [
  { value: 'history', title: 'History' },
  { value: 'recurring', title: 'Recurring' },
  { value: 'import', title: 'Import CSV' },
] as const satisfies readonly { value: TransactionWorkspaceSection; title: string }[];
