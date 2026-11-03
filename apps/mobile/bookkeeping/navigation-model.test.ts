import { describe, expect, it } from 'vitest';
import { primaryTabs, primaryTabForDestination, searchResultSections } from './navigation-model';

describe('five-tab navigation model', () => {
  it('uses the approved five primary destinations', () => {
    expect(primaryTabs).toEqual(['Dashboard', 'Transactions', 'Members', 'Reports', 'More']);
  });

  it('keeps accounts and settings under More and loans in member context', () => {
    expect(primaryTabForDestination('Accounts')).toBe('More');
    expect(primaryTabForDestination('Settings')).toBe('More');
    expect(primaryTabForDestination('Loans')).toBe('Members');
  });

  it('keeps each primary destination on its own tab', () => {
    expect(primaryTabs.map((tab) => primaryTabForDestination(tab))).toEqual(primaryTabs);
  });
});

describe('search result section navigation', () => {
  it.each([
    ['capital', 'capital', 'history'],
    ['guaranteed-payment', 'payments', 'history'],
    ['recurring', 'members', 'recurring'],
    ['member', 'members', 'history'],
    ['transaction', 'members', 'history'],
    ['loan', 'members', 'history'],
  ] as const)('opens the visible section for %s results', (kind, member, transaction) => {
    expect(searchResultSections({ kind })).toEqual({ member, transaction });
  });
});
