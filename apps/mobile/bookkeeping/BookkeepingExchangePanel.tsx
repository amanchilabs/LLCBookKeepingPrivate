// Reports · Bookkeeping exchange section.
//
// Presentation only. This panel never fetches, recomputes, or mutates ledger
// data. It copies the already computed cash-basis report supplied by Reports
// into the v1 exchange contract (bookkeeping-tax-exchange.ts) and hands the
// validated payload to an explicit, user-pressed share callback. It makes no
// tax calculation, classification, deductibility, basis or liability claim.
import React from 'react';
import { Text, View } from 'react-native';
import type { CashBasisReport } from '../../../packages/storage-native/src/bookkeeping-store';
import {
  BOOKKEEPING_TAX_EXCHANGE_LIMITATIONS,
  BookkeepingTaxExchangeError,
  buildBookkeepingTaxExchange,
  serializeBookkeepingTaxExchange,
  type BookkeepingTaxExchangeV1,
} from './bookkeeping-tax-exchange';
import { isValidDateRange } from './report-exports';
import { Button, FormError, Money, Panel, StatusIndicator, uiStyles } from './ui';

export const BOOKKEEPING_EXCHANGE_SECTION_TITLE = 'Bookkeeping exchange';
export const BOOKKEEPING_EXCHANGE_CONTROL_LABEL = 'Exchange';
export const BOOKKEEPING_EXCHANGE_PREPARE_LABEL = 'Prepare bookkeeping JSON';
export const BOOKKEEPING_EXCHANGE_MIME_TYPE = 'application/json';

export const BOOKKEEPING_EXCHANGE_EXCLUSIONS = Object.freeze([
  'Only income and operating-expense account activity from posted journal lines is included.',
  'Excluded: member contributions and distributions, transfers between accounts, loan proceeds and principal, opening balances, and other balance-sheet activity.',
  'Excluded: individual transactions, members, accounts, attachments, and receipts.',
] as const);

export interface BookkeepingExchangeBusiness {
  id: string;
  name: string;
}

export interface BookkeepingExchangePayload {
  record: BookkeepingTaxExchangeV1;
  json: string;
  fileName: string;
  mimeType: typeof BOOKKEEPING_EXCHANGE_MIME_TYPE;
}

export interface BookkeepingExchangeInput {
  /** Current business from the persisted snapshot; null when none is set up. */
  business: BookkeepingExchangeBusiness | null;
  /** Existing cash-basis report already computed by Reports. */
  report: CashBasisReport | null;
  /** Business the report was computed for; must equal business.id. */
  reportBusinessId: string | null;
  /** Dates currently requested in the Reports period fields. */
  fromDate: string;
  throughDate: string;
  /** Reports is (re)calculating. */
  loading: boolean;
  /** Last report calculation failure, if any. */
  error: string | null;
}

export type BookkeepingExchangeState =
  | { status: 'ready'; payload: BookkeepingExchangePayload }
  | { status: 'blocked'; reason: string };

export interface BookkeepingExchangePanelProps extends BookkeepingExchangeInput {
  /** A share of this or another report file is in progress. */
  sharing: boolean;
  /** Honest outcome text set by Reports after the share sheet returns. */
  shareNotice: string | null;
  shareError: string | null;
  /** Explicit user action. Receives only a validated payload. */
  onShareJson: (payload: BookkeepingExchangePayload) => void;
}

export function bookkeepingExchangeFileName(businessId: string, fromDate: string, throughDate: string): string {
  const safeId = businessId.replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 40) || 'business';
  return `llc-bookkeeping-exchange-v1-${safeId}-${fromDate}-to-${throughDate}.json`;
}

/** Pure state derivation: validates inputs and builds the payload, or explains why export is blocked. */
export function evaluateBookkeepingExchange(input: BookkeepingExchangeInput): BookkeepingExchangeState {
  const { business, report, reportBusinessId, fromDate, throughDate, loading, error } = input;
  if (!business) {
    return { status: 'blocked', reason: 'Set up a business before preparing a bookkeeping exchange file.' };
  }
  if (!isValidDateRange(fromDate, throughDate)) {
    return { status: 'blocked', reason: 'Enter valid dates in YYYY-MM-DD format, with From date on or before Through date, then update the report.' };
  }
  if (loading) {
    return { status: 'blocked', reason: 'The report is calculating. Export is available once it finishes.' };
  }
  if (error) {
    return { status: 'blocked', reason: `The report could not be calculated, so no exchange file can be prepared: ${error}` };
  }
  if (!report) {
    return { status: 'blocked', reason: 'No calculated report is available. Update the report to calculate cash-basis totals from journal lines.' };
  }
  if (reportBusinessId !== business.id) {
    return { status: 'blocked', reason: 'The calculated report belongs to a different business. Update the report before preparing JSON.' };
  }
  if (report.fromDate !== fromDate || report.throughDate !== throughDate) {
    return {
      status: 'blocked',
      reason: `The calculated report covers ${report.fromDate} through ${report.throughDate}, but the selected period is ${fromDate} through ${throughDate}. Update the report before preparing JSON.`,
    };
  }
  try {
    const record = buildBookkeepingTaxExchange({
      report,
      expectedPeriod: { fromDate, throughDate },
      source: {
        businessId: business.id,
        businessName: business.name,
        reference: `cash-basis-profit-and-loss:${fromDate}:${throughDate}`,
      },
    });
    return {
      status: 'ready',
      payload: {
        record,
        json: serializeBookkeepingTaxExchange(record),
        fileName: bookkeepingExchangeFileName(business.id, fromDate, throughDate),
        mimeType: BOOKKEEPING_EXCHANGE_MIME_TYPE,
      },
    };
  } catch (buildError) {
    const detail = buildError instanceof BookkeepingTaxExchangeError
      ? buildError.issues.join('; ')
      : buildError instanceof Error ? buildError.message : 'unknown validation failure';
    return { status: 'blocked', reason: `The report values could not be validated for exchange: ${detail}` };
  }
}

/** Stateless panel. Reports owns loading, report, and share outcome state. */
export function BookkeepingExchangePanel(props: BookkeepingExchangePanelProps) {
  const { business, fromDate, throughDate, sharing, shareNotice, shareError, onShareJson } = props;
  const state = evaluateBookkeepingExchange(props);
  const ready = state.status === 'ready' ? state.payload : null;
  return <Panel>
    <Text accessibilityRole="header" style={uiStyles.sectionTitle}>{BOOKKEEPING_EXCHANGE_SECTION_TITLE}</Text>
    <Text style={uiStyles.rowDetail}>Prepare a versioned JSON file (exchange v1) of cash-basis book totals for your CPA or tax workpapers. Preparing it does not send anything; you choose in the system share sheet whether a copy leaves this device.</Text>
    <View style={uiStyles.reportRow}><Text style={uiStyles.rowTitle}>Source</Text><Text style={uiStyles.rowDetail}>{business ? business.name : 'No business set up'}</Text></View>
    <View style={uiStyles.reportRow}><Text style={uiStyles.rowTitle}>Period</Text><Text style={uiStyles.rowDetail}>{ready ? `${ready.record.period.fromDate} through ${ready.record.period.throughDate}` : `${fromDate} through ${throughDate} (selected)`}</Text></View>
    <View style={uiStyles.reportRow}><Text style={uiStyles.rowTitle}>Basis</Text><Text style={uiStyles.rowDetail}>Cash basis · USD</Text></View>
    <View style={uiStyles.reportRow}>
      <Text style={uiStyles.rowTitle}>Review status</Text>
      <StatusIndicator label="Unreviewed · review needed" tone="warning" />
    </View>
    {ready && props.report ? <>
      <View style={uiStyles.reportRow}><Text style={uiStyles.rowTitle}>Income</Text><Money cents={props.report.incomeCents} /></View>
      <View style={uiStyles.reportRow}><Text style={uiStyles.rowTitle}>Operating expenses</Text><Money cents={props.report.expenseCents} /></View>
      <View style={uiStyles.reportTotal}><Text style={uiStyles.sectionTitle}>Net income</Text><Money cents={props.report.netIncomeCents} /></View>
      {props.report.incomeCents === 0n && props.report.expenseCents === 0n
        ? <Text style={uiStyles.helper}>No income or operating-expense activity was posted in this period. The file will contain zero totals.</Text>
        : null}
    </> : null}
    {state.status === 'blocked'
      ? <Text accessibilityRole="alert" style={uiStyles.helper}>Export unavailable: {state.reason}</Text>
      : null}
    <Button
      title={sharing ? 'Preparing JSON…' : BOOKKEEPING_EXCHANGE_PREPARE_LABEL}
      accessibilityLabel={BOOKKEEPING_EXCHANGE_PREPARE_LABEL}
      secondary
      disabled={!ready || sharing}
      onPress={() => {
        if (ready && !sharing) onShareJson(ready);
      }}
    />
    <FormError message={shareError} />
    {shareNotice ? <Text accessibilityLiveRegion="polite" style={uiStyles.helper}>{shareNotice}</Text> : null}
    <Text style={uiStyles.rowTitle}>Exclusions and limitations</Text>
    {[...BOOKKEEPING_EXCHANGE_EXCLUSIONS, ...BOOKKEEPING_TAX_EXCHANGE_LIMITATIONS].map((line) => <Text key={line} style={uiStyles.rowDetail}>• {line}</Text>)}
  </Panel>;
}
