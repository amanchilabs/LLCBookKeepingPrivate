import React, { useMemo, useState } from 'react';
import type { BookkeepingSnapshot } from '../../../packages/storage-native/src/bookkeeping-store';
import { searchBookkeepingRecords, type BookkeepingSearchResult } from './bookkeeping-search';
import { SearchFeedback } from './search-feedback';
import { SearchResultRow, searchResultKey } from './search-result-row';
import { Button, Field, Heading, Page, Panel } from './ui';

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
        ? results.map((result) => <SearchResultRow key={searchResultKey(result)} result={result} onNavigate={onNavigate} />)
        : null}
    </Panel>
  </Page>;
}
