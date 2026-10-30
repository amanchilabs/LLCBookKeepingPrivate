const fs = require('node:fs');
const path = require('node:path');
const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');

const BACKUP_XML = `<?xml version="1.0" encoding="utf-8"?>
<full-backup-content>
  <exclude domain="root" path="." />
  <exclude domain="file" path="." />
  <exclude domain="database" path="." />
  <exclude domain="sharedpref" path="." />
  <exclude domain="external" path="." />
</full-backup-content>
`;

const EXTRACTION_XML = `<?xml version="1.0" encoding="utf-8"?>
<data-extraction-rules>
  <cloud-backup>
    <exclude domain="root" path="." />
    <exclude domain="file" path="." />
    <exclude domain="database" path="." />
    <exclude domain="sharedpref" path="." />
    <exclude domain="external" path="." />
  </cloud-backup>
  <device-transfer>
    <exclude domain="root" path="." />
    <exclude domain="file" path="." />
    <exclude domain="database" path="." />
    <exclude domain="sharedpref" path="." />
    <exclude domain="external" path="." />
  </device-transfer>
</data-extraction-rules>
`;

module.exports = function withAndroidBackupExclusions(config) {
  config = withAndroidManifest(config, (mod) => {
    const application = mod.modResults.manifest.application?.[0];
    if (!application) throw new Error('Android manifest has no application node for backup exclusions.');
    application.$['android:allowBackup'] = 'false';
    application.$['android:fullBackupContent'] = '@xml/llc_backup_rules';
    application.$['android:dataExtractionRules'] = '@xml/llc_data_extraction_rules';
    return mod;
  });

  return withDangerousMod(config, ['android', async (mod) => {
    const xmlDirectory = path.join(mod.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res', 'xml');
    await fs.promises.mkdir(xmlDirectory, { recursive: true });
    await Promise.all([
      fs.promises.writeFile(path.join(xmlDirectory, 'llc_backup_rules.xml'), BACKUP_XML),
      fs.promises.writeFile(path.join(xmlDirectory, 'llc_data_extraction_rules.xml'), EXTRACTION_XML),
    ]);
    return mod;
  }]);
};
