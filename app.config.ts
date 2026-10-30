import type { ExpoConfig } from 'expo/config';

const sqlCipherEnabled = process.env.LLCB_SQLCIPHER !== 'false';

const config: ExpoConfig = {
  name: 'LLCBookKeepingPrivate',
  slug: 'llc-bookkeeping-private',
  version: '0.1.0',
  scheme: 'llcbookkeepingprivate',
  orientation: 'portrait',
  updates: {
    enabled: false,
    checkAutomatically: 'NEVER',
  },
  ios: {
    bundleIdentifier: 'com.amanchilabs.llcbookkeepingprivate',
    supportsTablet: true,
  },
  android: {
    package: 'com.amanchilabs.llcbookkeepingprivate',
    allowBackup: false,
  },
  web: {
    bundler: 'metro',
    output: 'single',
  },
  plugins: [
    ['expo-sqlite', { useSQLCipher: sqlCipherEnabled }],
    ['expo-secure-store', { configureAndroidBackup: true }],
    'react-native-quick-crypto',
  ],
  extra: {
    sqlCipherRequired: true,
    securityProofBuild: true,
  },
};

export default config;
