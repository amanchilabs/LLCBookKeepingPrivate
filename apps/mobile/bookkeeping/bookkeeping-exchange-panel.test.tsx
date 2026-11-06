import React from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { CashBasisReport } from '../../../packages/storage-native/src/bookkeeping-store';
import {
  BOOKKEEPING_EXCHANGE_CONTROL_LABEL,
  BOOKKEEPING_EXCHANGE_EXCLUSIONS,
  BOOKKEEPING_EXCHANGE_MIME_TYPE,
  BOOKKEEPING_EXCHANGE_PREPARE_LABEL,
  BOOKKEEPING_EXCHANGE_SECTION_TITLE,
  BookkeepingExchangePanel,
  evaluateBookkeepingExchange,
  type BookkeepingExchangePanelProps,
  type BookkeepingExchangePayload,
} from './BookkeepingExchangePanel';
import {
  BOOKKEEPING_TAX_EXCHANGE_LIMITATIONS,
  buildBookkeepingTaxExchange,
  parseBookkeepingTaxExchange,
} from './bookkeeping-tax-exchange';
import { Button } from './ui';

// Minimal React Native host mocks so react-dom/server can render the panel in Node.
vi.mock('react-native', async () => {
  const ReactModule = await import('react');
  type HostProps = {
    children?: React.ReactNode;
    accessibilityLabel?: string;
    accessibilityRole?: string;
    disabled?: boolean;
  };
  const host = (tag: string) => function MockHost({ children, accessibilityLabel, accessibilityRole, disabled }: HostProps) {
    return ReactModule.createElement(tag, {
      'aria-label': accessibilityLabel,
      role: accessibilityRole,
      ...(tag === 'button' ? { type: 'button', disabled: disabled === true } : {}),
    }, children);
  };
  return {
    ActivityIndicator: host('div'),
    Platform: { OS: 'ios', select: <T,>(options: { ios?: T; default?: T }) => options.ios ?? options.default },
    Pressable: host('button'),
    ScrollView: host('div'),
    StyleSheet: { create: <T,>(styles: T) => styles },
    Text: host('span'),
    TextInput: host('input'),
    View: host('div'),
  };
});

type RenderToStaticMarkup = (element: React.ReactElement) => string;
// Loaded through a variable specifier: react-dom ships no bundled type declarations here.
const reactDomServerSpecifier = 'react-dom/server';
let renderToStaticMarkup: RenderToStaticMarkup;

beforeAll(async () => {
  const server = await import(reactDomServerSpecifier) as { renderToStaticMarkup: RenderToStaticMarkup };
  renderToStaticMarkup = server.renderToStaticMarkup;
});

const BUSINESS = { id: 'biz-synthetic-001', name: 'Synthetic Maple Studio LLC' };

function syntheticReport(overrides: Partial<CashBasisReport> = {}): CashBasisReport {
  return {
    fromDate: '2026-01-01',
    throughDate: '2026-06-30',
    incomeCents: 1_250_000n,
    expenseCents: 432_150n,
    netIncomeCents: 817_850n,
    ...overrides,
  };
}

function props(overrides: Partial<BookkeepingExchangePanelProps> = {}): BookkeepingExchangePanelProps {
  return {
    business: BUSINESS,
    report: syntheticReport(),
    reportBusinessId: BUSINESS.id,
    fromDate: '2026-01-01',
    throughDate: '2026-06-30',
    loading: false,
    error: null,
    sharing: false,
    shareNotice: null,
    shareError: null,
    onShareJson: vi.fn(),
    ...overrides,
  };
}

function renderText(panelProps: BookkeepingExchangePanelProps): { html: string; text: string } {
  const html = renderToStaticMarkup(<BookkeepingExchangePanel {...panelProps} />);
  const text = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ');
  return { html, text };
}

type ButtonElement = React.ReactElement<React.ComponentProps<typeof Button>>;

function findPrepareButton(node: React.ReactNode): ButtonElement | null {
  if (node === null || node === undefined || typeof node === 'boolean' || typeof node === 'string' || typeof node === 'number' || typeof node === 'bigint') return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findPrepareButton(child);
      if (found) return found;
    }
    return null;
  }
  if (!React.isValidElement(node)) return null;
  const element = node as React.ReactElement<{ children?: React.ReactNode; accessibilityLabel?: string }>;
  if (element.type === Button && element.props.accessibilityLabel === BOOKKEEPING_EXCHANGE_PREPARE_LABEL) {
    return element as unknown as ButtonElement;
  }
  return findPrepareButton(element.props.children);
}

/** Calls the hookless panel directly and returns its Prepare button element. */
function prepareButton(panelProps: BookkeepingExchangePanelProps): ButtonElement {
  const button = findPrepareButton(BookkeepingExchangePanel(panelProps));
  if (!button) throw new Error('Prepare bookkeeping JSON button not found');
  return button;
}

function renderedPrepareButtonTag(html: string): string {
  const match = html.match(new RegExp(`<button[^>]*aria-label="${BOOKKEEPING_EXCHANGE_PREPARE_LABEL}"[^>]*>`));
  if (!match) throw new Error('rendered Prepare button not found');
  return match[0];
}

function expectBlocked(panelProps: BookkeepingExchangePanelProps, reason: RegExp): void {
  const state = evaluateBookkeepingExchange(panelProps);
  expect(state.status).toBe('blocked');
  if (state.status === 'blocked') expect(state.reason).toMatch(reason);

  const { html, text } = renderText(panelProps);
  expect(text).toContain('Export unavailable:');
  expect(text).toMatch(reason);
  expect(renderedPrepareButtonTag(html)).toContain('disabled');
  expect(text).not.toContain('Net income');

  const button = prepareButton(panelProps);
  expect(button.props.disabled).toBe(true);
  button.props.onPress();
  expect(panelProps.onShareJson).not.toHaveBeenCalled();
}

describe('BookkeepingExchangePanel · ready state', () => {
  it('uses the agreed section title, control label and button label', () => {
    expect(BOOKKEEPING_EXCHANGE_SECTION_TITLE).toBe('Bookkeeping exchange');
    expect(BOOKKEEPING_EXCHANGE_CONTROL_LABEL).toBe('Exchange');
    expect(BOOKKEEPING_EXCHANGE_PREPARE_LABEL).toBe('Prepare bookkeeping JSON');
  });

  it('shows source, period, cash basis, review-needed status, amounts and exclusions', () => {
    const { html, text } = renderText(props());
    expect(html).toContain('role="header"');
    expect(text).toContain('Bookkeeping exchange');
    expect(text).toContain('Synthetic Maple Studio LLC');
    expect(text).toContain('2026-01-01 through 2026-06-30');
    expect(text).toContain('Cash basis · USD');
    expect(text).toContain('Unreviewed · review needed');
    expect(text).toContain('$12,500.00');
    expect(text).toContain('$4,321.50');
    expect(text).toContain('$8,178.50');
    for (const line of [...BOOKKEEPING_EXCHANGE_EXCLUSIONS, ...BOOKKEEPING_TAX_EXCHANGE_LIMITATIONS]) {
      expect(text).toContain(line);
    }
    expect(text).not.toContain('Export unavailable');
    expect(renderedPrepareButtonTag(html)).not.toContain('disabled');
  });

  it('invokes the share callback exactly once with only the validated v1 payload', () => {
    const panelProps = props();
    const button = prepareButton(panelProps);
    expect(button.props.disabled).toBe(false);
    expect(button.props.title).toBe('Prepare bookkeeping JSON');
    button.props.onPress();

    const onShareJson = vi.mocked(panelProps.onShareJson);
    expect(onShareJson).toHaveBeenCalledTimes(1);
    const payload: BookkeepingExchangePayload = onShareJson.mock.calls[0][0];
    const expectedRecord = buildBookkeepingTaxExchange({
      report: syntheticReport(),
      expectedPeriod: { fromDate: '2026-01-01', throughDate: '2026-06-30' },
      source: {
        businessId: BUSINESS.id,
        businessName: BUSINESS.name,
        reference: 'cash-basis-profit-and-loss:2026-01-01:2026-06-30',
      },
    });
    expect(Object.keys(payload).sort()).toEqual(['fileName', 'json', 'mimeType', 'record']);
    expect(payload.record).toEqual(expectedRecord);
    expect(payload.mimeType).toBe(BOOKKEEPING_EXCHANGE_MIME_TYPE);
    expect(payload.mimeType).toBe('application/json');
    expect(payload.fileName).toBe('llc-bookkeeping-exchange-v1-biz-synthetic-001-2026-01-01-to-2026-06-30.json');
    expect(parseBookkeepingTaxExchange(payload.json)).toEqual(expectedRecord);
    expect(payload.record.totals).toEqual({ incomeCents: '1250000', expenseCents: '432150', netIncomeCents: '817850' });
    expect(payload.record.basis).toBe('cash');
    expect(payload.record.reviewStatus).toBe('unreviewed');
  });

  it('copies large bigint cents losslessly into the JSON payload', () => {
    const report = syntheticReport({ incomeCents: 9_007_199_254_740_993n, expenseCents: 1n, netIncomeCents: 9_007_199_254_740_992n });
    const state = evaluateBookkeepingExchange(props({ report }));
    expect(state.status).toBe('ready');
    if (state.status !== 'ready') return;
    expect(state.payload.json).toContain('"incomeCents": "9007199254740993"');
    expect(state.payload.json).toContain('"netIncomeCents": "9007199254740992"');
  });

  it('allows a zero-activity report and states that totals are zero', () => {
    const panelProps = props({ report: syntheticReport({ incomeCents: 0n, expenseCents: 0n, netIncomeCents: 0n }) });
    const { html, text } = renderText(panelProps);
    expect(text).toContain('No income or operating-expense activity was posted in this period');
    expect(text).toContain('$0.00');
    expect(renderedPrepareButtonTag(html)).not.toContain('disabled');
    prepareButton(panelProps).props.onPress();
    expect(panelProps.onShareJson).toHaveBeenCalledTimes(1);
  });

  it('disables the button while a share is in progress and does not re-invoke the callback', () => {
    const panelProps = props({ sharing: true });
    const { html, text } = renderText(panelProps);
    expect(text).toContain('Preparing JSON…');
    expect(renderedPrepareButtonTag(html)).toContain('disabled');
    const button = prepareButton(panelProps);
    expect(button.props.disabled).toBe(true);
    button.props.onPress();
    expect(panelProps.onShareJson).not.toHaveBeenCalled();
  });

  it('shows share outcome text supplied by Reports without claiming delivery itself', () => {
    const notice = 'Bookkeeping JSON prepared and the system share sheet was opened. This app cannot confirm whether a copy was sent or saved.';
    const { text } = renderText(props({ shareNotice: notice }));
    expect(text).toContain(notice);
    const failure = renderText(props({ shareError: 'Bookkeeping JSON could not be prepared: disk full. Nothing was shared.' }));
    expect(failure.html).toContain('role="alert"');
    expect(failure.text).toContain('Nothing was shared.');
    expect(text).not.toMatch(/\b(delivered|was sent to|sent successfully)\b/i);
  });
});

describe('BookkeepingExchangePanel · blocked states', () => {
  it('blocks when no report has been calculated (empty)', () => {
    expectBlocked(props({ report: null, reportBusinessId: null }), /No calculated report is available/);
  });

  it('blocks when no business is set up (missing data)', () => {
    const panelProps = props({ business: null });
    expectBlocked(panelProps, /Set up a business/);
    expect(renderText(panelProps).text).toContain('No business set up');
  });

  it('blocks while the report is loading', () => {
    expectBlocked(props({ loading: true }), /report is calculating/);
  });

  it('blocks when the report failed to load and shows the failure', () => {
    expectBlocked(props({ error: 'Encrypted database is locked.' }), /could not be calculated.*Encrypted database is locked\./);
  });

  it('blocks a stale report whose period differs from the selected dates', () => {
    expectBlocked(
      props({ throughDate: '2026-07-31' }),
      /covers 2026-01-01 through 2026-06-30, but the selected period is 2026-01-01 through 2026-07-31/,
    );
    expectBlocked(props({ fromDate: '2026-02-01' }), /Update the report before preparing JSON/);
  });

  it('blocks a report calculated for a different business', () => {
    expectBlocked(props({ reportBusinessId: 'biz-other' }), /different business/);
  });

  it('blocks malformed, impossible or reversed dates', () => {
    expectBlocked(props({ fromDate: '2026-1-01' }), /Enter valid dates/);
    expectBlocked(props({ throughDate: '2026-02-30' }), /Enter valid dates/);
    expectBlocked(props({ fromDate: '2026-07-01', throughDate: '2026-06-30' }), /Enter valid dates/);
  });

  it('blocks when the source fails contract validation instead of exporting', () => {
    expectBlocked(props({ business: { id: BUSINESS.id, name: 'Bad\u0007Name' } }), /could not be validated for exchange.*source\.businessName/);
  });

  it('blocks when report amounts are not bigint cents', () => {
    const report = { ...syntheticReport(), incomeCents: 12.5 } as unknown as CashBasisReport;
    expectBlocked(props({ report }), /report\.incomeCents must be bigint cents/);
  });
});
