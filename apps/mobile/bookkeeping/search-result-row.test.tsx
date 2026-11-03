import React from 'react';
// The repository ships react-dom without @types/react-dom; this story may not add
// dependencies or declaration files, so the one server API used here is typed locally.
// @ts-expect-error -- untyped package entry point; narrowed by renderToStaticMarkup below.
import * as reactDomServer from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BookkeepingSearchResult } from './bookkeeping-search';

const renderToStaticMarkup = (reactDomServer as { renderToStaticMarkup: (element: React.ReactElement) => string })
  .renderToStaticMarkup;

type HostRecord = { type: string; props: Record<string, unknown>; text: string };

// Host-boundary mock only: React Native primitives become DOM hosts that keep the
// native props they received so tests can inspect what the real component passed.
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
      for (const key of ['accessibilityRole', 'accessibilityLabel', 'accessibilityHint']) {
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

const {
  SearchResultRow, searchKindLabel, searchResultKey, searchResultRowMinHeight,
} = await import('./search-result-row');
const { minimumTouchTarget } = await import('./design-system');
const { uiStyles } = await import('./ui');

function syntheticResult(overrides: Partial<BookkeepingSearchResult> = {}): BookkeepingSearchResult {
  return {
    id: 'txn-synthetic-1',
    kind: 'transaction',
    title: 'Synthetic office rent',
    details: '2024-02-01 · expense · Synthetic Checking · Rent · $1,200.00',
    date: '2024-02-01',
    destination: 'Transactions',
    ...overrides,
  };
}

function renderRow(result: BookkeepingSearchResult, onNavigate = vi.fn()) {
  host.records.length = 0;
  const html = renderToStaticMarkup(<SearchResultRow result={result} onNavigate={onNavigate} />);
  const pressables = host.records.filter((record) => record.type === 'Pressable');
  expect(pressables).toHaveLength(1);
  const texts = host.records.filter((record) => record.type === 'Text');
  return { html, pressable: pressables[0]!, texts, onNavigate };
}

function flattenStyle(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) return Object.assign({}, ...style.map(flattenStyle));
  return (style ?? {}) as Record<string, unknown>;
}

const kindCases: [BookkeepingSearchResult['kind'], string, BookkeepingSearchResult['destination']][] = [
  ['business', 'LLC', 'Settings'],
  ['member', 'Member', 'Members'],
  ['account', 'Account', 'Accounts'],
  ['transaction', 'Transaction', 'Transactions'],
  ['capital', 'Capital activity', 'Members'],
  ['guaranteed-payment', 'Member payment', 'Members'],
  ['loan', 'Loan agreement', 'Loans'],
  ['loan-activity', 'Loan activity', 'Loans'],
  ['recurring', 'Recurring transaction', 'Transactions'],
  ['reconciliation', 'Reconciliation', 'Accounts'],
  ['period', 'Period history', 'Settings'],
  ['reminder', 'Reminder', 'Settings'],
];

beforeEach(() => {
  host.records.length = 0;
});

describe('searchKindLabel', () => {
  it.each(kindCases)('maps %s to the existing label "%s"', (kind, label) => {
    expect(searchKindLabel(kind)).toBe(label);
  });

  it('covers every kind exactly once', () => {
    expect(new Set(kindCases.map(([kind]) => kind)).size).toBe(12);
  });
});

describe('searchResultKey', () => {
  it('preserves the original kind:id key format', () => {
    expect(searchResultKey(syntheticResult({ kind: 'loan-activity', id: 'loan-act-7' }))).toBe('loan-activity:loan-act-7');
  });
});

describe('SearchResultRow', () => {
  it.each(kindCases)('renders %s with its badge, announcement, and exact destination hint', (kind, label, destination) => {
    const result = syntheticResult({ kind, destination, id: `${kind}-1`, title: `Synthetic ${label} title`, details: `Synthetic ${label} details` });
    const { pressable, texts } = renderRow(result);

    expect(pressable.props.accessibilityRole).toBe('button');
    expect(pressable.props.accessibilityLabel).toBe(`${label}: Synthetic ${label} title. Synthetic ${label} details`);
    expect(pressable.props.accessibilityHint).toBe(`Opens ${destination}.`);
    expect(String(pressable.props.accessibilityLabel)).not.toContain('Open ');
    expect(texts.map((record) => record.text)).toEqual([label, `Synthetic ${label} title`, `Synthetic ${label} details`, 'Open']);
  });

  it('renders the visual details text and keeps existing text styles', () => {
    const result = syntheticResult();
    const { texts, html } = renderRow(result);
    expect(texts[0]!.props.style).toBe(uiStyles.badge);
    expect(texts[1]!.props.style).toBe(uiStyles.rowTitle);
    expect(texts[2]!.props.style).toBe(uiStyles.rowDetail);
    expect(texts[3]!.props.style).toBe(uiStyles.rowDetail);
    expect(html).toContain('2024-02-01 · expense · Synthetic Checking · Rent · $1,200.00');
    const main = host.records.find((record) => record.type === 'View');
    expect(main?.props.style).toBe(uiStyles.rowMain);
  });

  it('keeps long titles and details complete in both visual text and the announcement', () => {
    const title = `Synthetic ${'very long vendor description '.repeat(12).trim()}`;
    const details = `2024-03-15 · ${'Synthetic category segment · '.repeat(10).trim()} $98,765.43`;
    const { pressable, texts } = renderRow(syntheticResult({ title, details }));
    expect(texts[1]!.text).toBe(title);
    expect(texts[2]!.text).toBe(details);
    expect(texts[1]!.props.numberOfLines).toBeUndefined();
    expect(texts[2]!.props.numberOfLines).toBeUndefined();
    expect(pressable.props.accessibilityLabel).toBe(`Transaction: ${title}. ${details}`);
    expect(pressable.props.accessibilityHint).toBe('Opens Transactions.');
  });

  it('sets a minimum touch height of 48 while retaining the existing row layout', () => {
    const { pressable } = renderRow(syntheticResult());
    const style = flattenStyle(pressable.props.style);
    expect(searchResultRowMinHeight).toBe(48);
    expect(style.minHeight).toBe(48);
    expect(style.minHeight as number).toBeGreaterThanOrEqual(minimumTouchTarget('ios'));
    expect(style.minHeight as number).toBeGreaterThanOrEqual(minimumTouchTarget('android'));
    for (const [key, value] of Object.entries(uiStyles.rowItem)) expect(style[key]).toEqual(value);
  });

  it('forwards the exact original result object to onNavigate once per press', () => {
    const result = syntheticResult({ kind: 'member', id: 'member-synthetic-a', destination: 'Members' });
    const { pressable, onNavigate } = renderRow(result);
    expect(onNavigate).not.toHaveBeenCalled();
    (pressable.props.onPress as () => void)();
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate.mock.calls[0]![0]).toBe(result);
    expect(onNavigate.mock.calls[0]).toHaveLength(1);
  });
});
