import React from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import type { BookkeepingSearchResult } from './bookkeeping-search';
import { minimumTouchTarget } from './design-system';
import { uiStyles } from './ui';

/** Minimum row touch height: 48, never below the platform touch-target floor. */
export const searchResultRowMinHeight = Math.max(48, minimumTouchTarget(Platform.OS));

const searchResultRowStyle = [uiStyles.rowItem, { minHeight: searchResultRowMinHeight }];

export function searchKindLabel(kind: BookkeepingSearchResult['kind']): string {
  switch (kind) {
    case 'business': return 'LLC';
    case 'member': return 'Member';
    case 'account': return 'Account';
    case 'transaction': return 'Transaction';
    case 'capital': return 'Capital activity';
    case 'guaranteed-payment': return 'Member payment';
    case 'loan': return 'Loan agreement';
    case 'loan-activity': return 'Loan activity';
    case 'recurring': return 'Recurring transaction';
    case 'reconciliation': return 'Reconciliation';
    case 'period': return 'Period history';
    case 'reminder': return 'Reminder';
  }
}

export function searchResultKey(result: BookkeepingSearchResult): string {
  return `${result.kind}:${result.id}`;
}

/** Spoken summary: kind, title, and details, in visual reading order. */
export function searchResultAccessibilityLabel(result: BookkeepingSearchResult): string {
  return `${searchKindLabel(result.kind)}: ${result.title}. ${result.details}`;
}

/** Separate hint describing what activating the row does. */
export function searchResultAccessibilityHint(result: BookkeepingSearchResult): string {
  return `Opens ${result.destination}.`;
}

/**
 * Presentation-only search result row. It forwards the exact result object it
 * was given to `onNavigate`; navigation behavior is owned by the caller.
 */
export function SearchResultRow({
  result,
  onNavigate,
}: {
  result: BookkeepingSearchResult;
  onNavigate: (result: BookkeepingSearchResult) => void;
}) {
  const kindLabel = searchKindLabel(result.kind);
  return <Pressable
    accessibilityRole="button"
    accessibilityLabel={searchResultAccessibilityLabel(result)}
    accessibilityHint={searchResultAccessibilityHint(result)}
    onPress={() => onNavigate(result)}
    style={searchResultRowStyle}
  >
    <View style={uiStyles.rowMain}>
      <Text style={uiStyles.badge}>{kindLabel}</Text>
      <Text style={uiStyles.rowTitle}>{result.title}</Text>
      <Text style={uiStyles.rowDetail}>{result.details}</Text>
    </View>
    <Text style={uiStyles.rowDetail}>Open</Text>
  </Pressable>;
}
