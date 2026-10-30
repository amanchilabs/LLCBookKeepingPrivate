import type { ExpoConfig } from 'expo/config';
import { nativeBuildPolicy } from './apps/mobile/native-build-policy.cjs';

const buildPolicy = nativeBuildPolicy(process.env);

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
    ['expo-sqlite', { useSQLCipher: buildPolicy.sqlCipherEnabled }],
    ['expo-secure-store', { configureAndroidBackup: false }],
    'react-native-quick-crypto',
    './plugins/with-ios-backup-exclusion.cjs',
    './plugins/with-android-backup-exclusions.cjs',
  ],
  extra: {
    sqlCipherRequired: buildPolicy.sqlCipherEnabled,
    securityNegativeBuild: buildPolicy.securityNegativeBuild,
    securityProofBuild: true,
  },
};

export default config;
