export type AppPlatform = 'web' | 'ios' | 'android';

export interface Capabilities {
  syntheticDataOnly: boolean;
  canImportFinancialCsv: boolean;
  canAttachReceipt: boolean;
  canOpenEncryptedBackup: boolean;
}

export const SYNTHETIC_PREVIEW_NOTICE = 'Synthetic-data preview. Native encryption, secure key storage, and device-security behavior are not validated in this browser.';

export function capabilitiesFor(platform: AppPlatform): Capabilities {
  if (platform === 'web') {
    return {
      syntheticDataOnly: true,
      canImportFinancialCsv: false,
      canAttachReceipt: false,
      canOpenEncryptedBackup: false,
    };
  }
  return {
    syntheticDataOnly: false,
    canImportFinancialCsv: true,
    canAttachReceipt: true,
    canOpenEncryptedBackup: true,
  };
}
