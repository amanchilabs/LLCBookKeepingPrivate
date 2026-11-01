import * as Crypto from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import {
  parseCsvTable,
  previewCashImport,
  suggestCsvColumnMapping,
  type CsvColumnMapping,
  type CsvImportPreviewRow,
} from '../../../packages/domain/src/transaction-csv-import';
import { importCashTransactions } from '../../../packages/storage-native/src/bookkeeping-service';
import type { BookkeepingSnapshot } from '../../../packages/storage-native/src/bookkeeping-store';
import { Button, Choice, FormError, Money, Panel, uiStyles } from './ui';

type MappingKey = keyof CsvColumnMapping;
type DuplicateMode = 'skip' | 'include';

const mappingLabels: Record<MappingKey, string> = {
  dateColumn: 'Date column',
  descriptionColumn: 'Description column',
  amountColumn: 'Signed amount column',
  categoryColumn: 'Category column',
};

const emptyMapping: Record<MappingKey, string> = {
  dateColumn: 'unmapped',
  descriptionColumn: 'unmapped',
  amountColumn: 'unmapped',
  categoryColumn: 'unmapped',
};

export function TransactionCsvImportPanel({
  snapshot,
  onImported,
}: {
  snapshot: BookkeepingSnapshot;
  onImported: () => Promise<void>;
}) {
  const [fileName, setFileName] = useState('');
  const [table, setTable] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<MappingKey, string>>(emptyMapping);
  const [accountId, setAccountId] = useState(
    snapshot.accounts.find((account) => account.kind === 'bank' || account.kind === 'cash')?.id ?? '',
  );
  const [duplicateMode, setDuplicateMode] = useState<DuplicateMode>('skip');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const cashAccounts = snapshot.accounts.filter((account) => account.kind === 'bank' || account.kind === 'cash');
  const categories = snapshot.accounts.flatMap((account) => account.kind === 'income' || account.kind === 'expense'
    ? [{ id: account.id, name: account.name, kind: account.kind }]
    : []);
  const headers = table[0] ?? [];
  const mappingOptions = [
    { value: 'unmapped', title: 'Choose a column' },
    ...headers.map((header, index) => ({ value: String(index), title: header.trim() || 'Column ' + (index + 1) })),
  ];
  const mappingReady = Object.values(mapping).every((value) => value !== 'unmapped');
  const preview = useMemo(() => {
    if (!mappingReady || table.length < 2) return { rows: [] as CsvImportPreviewRow[], error: null as string | null };
    try {
      return {
        rows: previewCashImport(
          table,
          {
            dateColumn: Number(mapping.dateColumn),
            descriptionColumn: Number(mapping.descriptionColumn),
            amountColumn: Number(mapping.amountColumn),
            categoryColumn: Number(mapping.categoryColumn),
          },
          accountId,
          categories,
          snapshot.transactions.map((transaction) => ({
            date: transaction.date,
            accountId: transaction.accountId,
            amountCents: transaction.amountCents,
            categoryAccountId: transaction.categoryAccountId,
            description: transaction.description,
          })),
          snapshot.business?.bookkeepingStartDate ?? '',
          snapshot.closedThroughDate,
        ),
        error: null as string | null,
      };
    } catch (previewError) {
      return { rows: [] as CsvImportPreviewRow[], error: previewError instanceof Error ? previewError.message : 'The CSV preview could not be prepared.' };
    }
  }, [accountId, categories, mapping, mappingReady, snapshot.business?.bookkeepingStartDate, snapshot.closedThroughDate, snapshot.transactions, table]);

  const invalidRows = preview.rows.filter((row) => row.errors.length > 0);
  const duplicateRows = preview.rows.filter((row) => row.possibleDuplicate);
  const validatedRows = preview.rows.filter((row) => row.errors.length === 0);
  const validRows = validatedRows.filter((row) => duplicateMode === 'include' || !row.possibleDuplicate);

  const chooseFile = async () => {
    setError(null);
    setNotice(null);
    try {
      const selection = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (selection.canceled || !selection.assets[0]) return;
      const asset = selection.assets[0];
      const cachedFile = new File(asset.uri);
      let source: string;
      try {
        source = await cachedFile.text();
      } finally {
        cachedFile.delete();
      }
      const parsed = parseCsvTable(source);
      if (parsed.length < 2) throw new Error('Choose a CSV with a header row and at least one transaction.');
      setFileName(asset.name);
      setTable(parsed);
      const suggested = suggestCsvColumnMapping(parsed[0]);
      setMapping({
        dateColumn: String(suggested.dateColumn),
        descriptionColumn: String(suggested.descriptionColumn),
        amountColumn: String(suggested.amountColumn),
        categoryColumn: String(suggested.categoryColumn),
      });
    } catch (pickError) {
      setError(pickError instanceof Error ? pickError.message : 'The CSV file could not be read.');
    }
  };

  const importRows = async () => {
    if (!snapshot.business || !accountId || invalidRows.length > 0 || validatedRows.length === 0) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await importCashTransactions({
        businessId: snapshot.business.id,
        accountId,
        includePossibleDuplicates: duplicateMode === 'include',
        rows: validatedRows.map((row) => ({
          id: Crypto.randomUUID(),
          journalEntryId: Crypto.randomUUID(),
          date: row.date,
          amountCents: row.amountCents,
          categoryAccountId: row.categoryAccountId!,
          description: row.description,
        })),
      });
      setNotice('Imported ' + result.importedCount + ' transaction' + (result.importedCount === 1 ? '' : 's')
        + '; skipped ' + result.skippedDuplicateCount + ' possible duplicate' + (result.skippedDuplicateCount === 1 ? '' : 's') + '.');
      setFileName('');
      setTable([]);
      setMapping(emptyMapping);
      await onImported();
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'The transaction import failed. No rows were posted.');
    } finally {
      setBusy(false);
    }
  };

  return <Panel>
    <Text style={uiStyles.sectionTitle}>Import transactions from CSV</Text>
    <Text style={uiStyles.rowDetail}>Choose a local CSV, map its columns, and review every row before posting. Use one signed amount per row: positive amounts post as income and negative amounts as operating expenses. Categories must match existing income or expense account names. Transfers, refunds, and split rows are not supported by this importer.</Text>
    <Button title={fileName || 'Choose CSV file'} secondary onPress={() => void chooseFile()} disabled={busy} />
    {table.length > 0 ? <>
      <Text style={uiStyles.helper}>{fileName} · {table.length - 1} data rows · maximum file size 5 MB.</Text>
      <Button title="Discard selected CSV" secondary onPress={() => {
        setFileName('');
        setTable([]);
        setMapping(emptyMapping);
        setNotice(null);
        setError(null);
      }} disabled={busy} />
      <Choice label="Deposit account" value={accountId} options={cashAccounts.map((account) => ({ value: account.id, title: account.name }))} onChange={setAccountId} />
      {(Object.keys(mappingLabels) as MappingKey[]).map((key) => <Choice
        key={key}
        label={mappingLabels[key]}
        value={mapping[key]}
        options={mappingOptions}
        onChange={(value) => setMapping((current) => ({ ...current, [key]: value }))}
      />)}
      <Choice label="Possible duplicate rows" value={duplicateMode} options={[
        { value: 'skip', title: 'Skip possible duplicates' },
        { value: 'include', title: 'Include possible duplicates' },
      ]} onChange={setDuplicateMode} />
      <FormError message={preview.error} />
      {preview.rows.length > 0 ? <>
        <Text style={uiStyles.rowDetail}>
          {validRows.length} ready · {invalidRows.length} invalid · {duplicateRows.length} possible duplicates.
          {invalidRows.length > 0 ? ' Fix the CSV or mapping before importing; this batch will not post partially.' : ''}
        </Text>
        {preview.rows.slice(0, 12).map((row) => <View key={row.rowNumber} style={uiStyles.loanCard}>
          <Text style={uiStyles.rowTitle}>CSV row {row.rowNumber} · {row.date || 'Invalid date'}</Text>
          <Text style={uiStyles.rowDetail}>{row.description || 'No description'} · {row.kind ?? 'Unknown type'}</Text>
          <View style={uiStyles.reportRow}><Text style={uiStyles.rowDetail}>Signed amount</Text><Money cents={row.amountCents} /></View>
          {row.possibleDuplicate ? <Text style={uiStyles.badge}>Possible duplicate</Text> : null}
          {row.errors.map((message) => <FormError key={message} message={message} />)}
        </View>)}
        {preview.rows.length > 12 ? <Text style={uiStyles.helper}>Showing the first 12 rows; all {preview.rows.length} rows are validated before posting.</Text> : null}
      </> : null}
      <Button
        title={busy ? 'Importing atomically…' : 'Import ' + validRows.length + ' new row' + (validRows.length === 1 ? '' : 's')
          + (duplicateMode === 'skip' && duplicateRows.length > 0 ? ' · skip ' + duplicateRows.length + ' duplicates' : '')}
        onPress={() => void importRows()}
        disabled={busy || !mappingReady || validatedRows.length === 0 || invalidRows.length > 0}
      />
    </> : null}
    <FormError message={error} />
    {notice ? <Text accessibilityLiveRegion="polite" style={uiStyles.helper}>{notice}</Text> : null}
  </Panel>;
}
