import React from 'react';
import { Text } from 'react-native';
import { uiStyles } from './ui';

export const searchIdleMessage =
  'Search transactions, categories, accounts, members, capital, payments, loans, reminders, reconciliations, and period history.';

export const searchNoMatchMessage =
  'No matching records in this LLC. Check the spelling or try another term.';

export type SearchFeedbackState = 'idle' | 'no-match' | 'results';

export function searchFeedbackState(query: string, resultCount: number): SearchFeedbackState {
  if (!query.trim()) return 'idle';
  return resultCount > 0 ? 'results' : 'no-match';
}

export function searchResultCountMessage(resultCount: number): string {
  const noun = resultCount === 1 ? 'record' : 'records';
  return `${resultCount} matching ${noun} · select a result to open its section.`;
}

/**
 * Presentation-only feedback for the Search screen. It never searches or
 * filters records itself; it only describes the caller-supplied query and the
 * number of results already produced by the existing search.
 */
export function SearchFeedback({ query, resultCount }: { query: string; resultCount: number }) {
  const state = searchFeedbackState(query, resultCount);
  if (state === 'idle') {
    return <Text style={uiStyles.helper}>{searchIdleMessage}</Text>;
  }
  const message = state === 'no-match' ? searchNoMatchMessage : searchResultCountMessage(resultCount);
  return <Text
    style={uiStyles.helper}
    accessibilityRole="text"
    accessibilityLiveRegion="polite"
  >
    {message}
  </Text>;
}
