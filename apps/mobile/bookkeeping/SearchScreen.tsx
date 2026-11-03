import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { BookkeepingSnapshot } from '../../../packages/storage-native/src/bookkeeping-store';
import { searchBookkeepingRecords, type BookkeepingSearchResult } from './bookkeeping-search';
import { SearchFeedback } from './search-feedback';
import { Button, Field, Heading, Page, Panel, uiStyles } from './ui';

export function SearchScreen({
  snapshot,
  onNavigate,
}: {
  snapshot: BookkeepingSnapshot;
  onNavigate: (result: BookkeepingSearchResult) => void;
}) {
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchBookkeepingRecords(snapshot, query), [snapshot, query]);

  return <Page>
    <Heading
      title="Search"
      subtitle={`Search the locally stored records for ${snapshot.business?.name ?? 'this LLC'}. Results follow the active workspace.`}
    />
    <Panel>
      <Field
        label="Search this LLC"
        value={query}
        onChangeText={setQuery}
        placeholder="Description, member, account, amount, date…"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
      />
      {query.length > 0 ? <Button title="Clear search" secondary onPress={() => setQuery('')} /> : null}
      <SearchFeedback query={query} resultCount={results.length} />
      {query.trim().length > 0 && results.length > 0
        ? results.map((result) => <SearchResultRow key={`${result.kind}:${result.id}`} result={result} onNavigate={onNavigate} />)
        : null}
    </Panel>
  </Page>;
}

function SearchResultRow({
  result,
  onNavigate,
}: {
  result: BookkeepingSearchResult;
  onNavigate: (result: BookkeepingSearchResult) => void;
}) {
  return <Pressable
    accessibilityRole="button"
    accessibilityLabel={`${searchKindLabel(result.kind)}: ${result.title}. Open ${result.destination}.`}
    onPress={() => onNavigate(result)}
    style={uiStyles.rowItem}
  >
    <View style={uiStyles.rowMain}>
      <Text style={uiStyles.badge}>{searchKindLabel(result.kind)}</Text>
      <Text style={uiStyles.rowTitle}>{result.title}</Text>
      <Text style={uiStyles.rowDetail}>{result.details}</Text>
    </View>
    <Text style={uiStyles.rowDetail}>Open</Text>
  </Pressable>;
}

function searchKindLabel(kind: BookkeepingSearchResult['kind']): string {
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
