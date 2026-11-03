import type { BookkeepingSearchResult } from './bookkeeping-search';
import type { TransactionWorkspaceSection } from './transaction-workspace';

export const primaryTabs = ['Dashboard', 'Transactions', 'Members', 'Reports', 'More'] as const;
export type PrimaryTab = typeof primaryTabs[number];
export type MoreSection = 'Accounts' | 'Settings';
export type MemberSection = 'Loans';
export type AppDestination = PrimaryTab | MoreSection | MemberSection | 'Search';

export function primaryTabForDestination(destination: AppDestination): PrimaryTab {
  if (destination === 'Accounts' || destination === 'Settings') return 'More';
  if (destination === 'Loans') return 'Members';
  if (destination === 'Search') return 'Dashboard';
  return destination;
}

export type MemberWorkspaceSection = 'members' | 'capital' | 'payments';

export function searchResultSections(result: Pick<BookkeepingSearchResult, 'kind'>): {
  member: MemberWorkspaceSection;
  transaction: TransactionWorkspaceSection;
} {
  return {
    member: result.kind === 'capital' ? 'capital' : result.kind === 'guaranteed-payment' ? 'payments' : 'members',
    transaction: result.kind === 'recurring' ? 'recurring' : 'history',
  };
}
