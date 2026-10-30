import { describe, expect, it } from 'vitest';
import { capabilitiesFor, SYNTHETIC_PREVIEW_NOTICE } from './preview-capabilities';

describe('web preview capabilities', () => {
  it('allows synthetic navigation but blocks all real record intake', () => {
    expect(capabilitiesFor('web')).toEqual({
      syntheticDataOnly: true,
      canImportFinancialCsv: false,
      canAttachReceipt: false,
      canOpenEncryptedBackup: false,
    });
  });

  it('shows the required native-security limitation verbatim', () => {
    expect(SYNTHETIC_PREVIEW_NOTICE).toBe('Synthetic-data preview. Native encryption, secure key storage, and device-security behavior are not validated in this browser.');
  });
});
