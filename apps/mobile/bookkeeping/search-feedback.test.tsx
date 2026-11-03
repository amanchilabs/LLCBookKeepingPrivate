import React from 'react';
// The repository ships react-dom without @types/react-dom; this story may not add
// dependencies or declaration files, so the one server API used here is typed locally.
// @ts-expect-error -- untyped package entry point; narrowed by renderToStaticMarkup below.
import * as reactDomServer from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BookkeepingSnapshot } from '../../../packages/storage-native/src/bookkeeping-store';

const renderToStaticMarkup = (reactDomServer as { renderToStaticMarkup: (element: React.ReactElement) => string })
  .renderToStaticMarkup;

type HostRecord = { type: string; props: Record<string, unknown>; text: string };

// Host-boundary mock only: React Native primitives become DOM hosts that keep the
// native props they received so tests can inspect what the real components passed.
const host = vi.hoisted(() => ({ records: [] as HostRecord[] }));

vi.mock('react-native', async () => {
  const ReactModule = await import('react');
  const textOf = (children: unknown): string => {
    if (children === null || children === undefined || typeof children === 'boolean') return '';
    if (typeof children === 'string' || typeof children === 'number') return String(children);
    if (Array.isArray(children)) return children.map(textOf).join('');
    if (typeof children === 'object' && children !== null && 'props' in children) {
      return textOf((children as { props: { children?: unknown } }).props.children);
    }
    return '';
  };
  const hostComponent = (type: string, tag: 'div' | 'span' | 'input' = 'div') =>
    function HostComponent(props: Record<string, unknown>) {
      host.records.push({ type, props, text: textOf(props.children) });
      const attributes: Record<string, string> = { 'data-rn': type };
      for (const key of ['accessibilityRole', 'accessibilityLiveRegion', 'accessibilityLabel', 'placeholder', 'value']) {
        if (typeof props[key] === 'string') attributes[`data-${key.toLowerCase()}`] = props[key] as string;
      }
      if (tag === 'input') return ReactModule.createElement('input', { ...attributes, readOnly: true });
      return ReactModule.createElement(tag, attributes, props.children as React.ReactNode);
    };
  return {
    ActivityIndicator: hostComponent('ActivityIndicator'),
    Platform: { OS: 'ios', select: (options: Record<string, unknown>) => options.ios ?? options.default },
    Pressable: hostComponent('Pressable'),
    ScrollView: hostComponent('ScrollView'),
    StyleSheet: { create: <T,>(styles: T) => styles },
    Text: hostComponent('Text', 'span'),
    TextInput: hostComponent('TextInput', 'input'),
    View: hostComponent('View'),
  };
});

const { SearchFeedback, searchIdleMessage, searchNoMatchMessage } = await import('./search-feedback');
const { SearchScreen } = await import('./SearchScreen');
const { uiStyles } = await import('./ui');

function renderFeedback(query: string, resultCount: number) {
  host.records.length = 0;
  const html = renderToStaticMarkup(<SearchFeedback query={query} resultCount={resultCount} />);
  const texts = host.records.filter((record) => record.type === 'Text');
  expect(texts).toHaveLength(1);
  return { html, text: texts[0]! };
}

function syntheticSnapshot(): BookkeepingSnapshot {
  return {
    business: {
      id: 'business-synthetic', name: 'Synthetic Harbor LLC', formationState: 'AZ',
      formationDate: '2024-03-01', bookkeepingStartDate: '2024-01-01',
    },
    members: [], memberHistory: [], accounts: [], transactions: [], capitalActivities: [],
    memberCapitalSummaries: [], guaranteedPaymentInstallments: [], guaranteedPaymentCashEvents: [],
    loanAgreements: [], loanActivities: [], accountReconciliations: [], accountReconciliationEvents: [],
    accountingPeriodEvents: [], closedThroughDate: null, recurringTransactions: [], reminders: [],
    cashBasis: { incomeCents: 0n, expenseCents: 0n, netIncomeCents: 0n },
  };
}

beforeEach(() => {
  host.records.length = 0;
});

describe('SearchFeedback', () => {
  it('keeps the existing helpful idle guidance for an empty query without a live region', () => {
    const { text, html } = renderFeedback('', 0);
    expect(text.text).toBe(searchIdleMessage);
    expect(text.text).toContain('Search transactions, categories, accounts, members');
    expect(text.props.accessibilityLiveRegion).toBeUndefined();
    expect(text.props.style).toBe(uiStyles.helper);
    expect(html).not.toContain('data-accessibilityliveregion');
  });

  it('treats a whitespace-only query as idle even if a stale count is supplied', () => {
    const { text } = renderFeedback('   \t ', 4);
    expect(text.text).toBe(searchIdleMessage);
    expect(text.props.accessibilityLiveRegion).toBeUndefined();
  });

  it('advises checking spelling or trying another term when nothing matches', () => {
    const { text, html } = renderFeedback('zzqx', 0);
    expect(text.text).toBe(searchNoMatchMessage);
    expect(text.text).toMatch(/No matching records in this LLC\./);
    expect(text.text).toMatch(/check the spelling/i);
    expect(text.text).toMatch(/try another term/i);
    expect(html).toContain('data-accessibilityliveregion="polite"');
  });

  it('uses the singular noun for exactly one result', () => {
    const { text } = renderFeedback('rent', 1);
    expect(text.text).toBe('1 matching record · select a result to open its section.');
    expect(text.text).not.toContain('records');
  });

  it.each([2, 12])('uses the plural noun for %i results', (count) => {
    const { text } = renderFeedback(' rent ', count);
    expect(text.text).toBe(`${count} matching records · select a result to open its section.`);
  });

  it.each([
    ['no-match', 'zzqx', 0],
    ['one result', 'rent', 1],
    ['multiple results', 'rent', 3],
  ])('passes native polite live-region props for %s feedback', (_label, query, count) => {
    const { text } = renderFeedback(query as string, count as number);
    expect(text.props.accessibilityLiveRegion).toBe('polite');
    expect(text.props.accessibilityRole).toBe('text');
    expect(text.props.style).toBe(uiStyles.helper);
  });
});

describe('SearchScreen integration', () => {
  it('renders the extracted idle feedback, no Clear search button, and no result rows before a query', () => {
    const onNavigate = vi.fn();
    const html = renderToStaticMarkup(<SearchScreen snapshot={syntheticSnapshot()} onNavigate={onNavigate} />);

    const texts = host.records.filter((record) => record.type === 'Text').map((record) => record.text);
    expect(texts).toContain(searchIdleMessage);
    expect(html).toContain('Search the locally stored records for Synthetic Harbor LLC.');
    expect(html).not.toContain('Clear search');
    expect(host.records.some((record) => record.type === 'Pressable'
      && String(record.props.accessibilityLabel ?? '').includes('. Open '))).toBe(false);

    const input = host.records.find((record) => record.type === 'TextInput');
    expect(input?.props.value).toBe('');
    expect(input?.props.placeholder).toBe('Description, member, account, amount, date…');
    expect(typeof input?.props.onChangeText).toBe('function');
    expect(onNavigate).not.toHaveBeenCalled();
  });
});
