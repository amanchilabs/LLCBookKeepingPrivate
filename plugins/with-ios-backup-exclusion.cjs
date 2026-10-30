const { withAppDelegate } = require('@expo/config-plugins');

const MARKER = 'LLCBookKeepingPrivate backup exclusion';

module.exports = function withIosBackupExclusion(config) {
  return withAppDelegate(config, (mod) => {
    let source = mod.modResults.contents;
    if (source.includes(MARKER)) return mod;
    const launchReturn = '    return super.application(application, didFinishLaunchingWithOptions: launchOptions)';
    if (!source.includes(launchReturn)) throw new Error('Could not add the iOS backup exclusion to the generated AppDelegate.');
    source = source.replace(launchReturn, `    precondition(llcExcludeBookkeepingDirectoryFromBackup(), "${MARKER} failed")\n${launchReturn}`);
    source += `

// ${MARKER}. The entire app-private database generation directory, including
// SQLite WAL/journal siblings, remains available in encrypted user exports.
private func llcExcludeBookkeepingDirectoryFromBackup() -> Bool {
  do {
    let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
    var directory = documents.appendingPathComponent("LLCBookKeepingPrivate", isDirectory: true)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    var values = URLResourceValues()
    values.isExcludedFromBackup = true
    try directory.setResourceValues(values)
    return try directory.resourceValues(forKeys: [.isExcludedFromBackupKey]).isExcludedFromBackup == true
  } catch {
    return false
  }
}
`;
    mod.modResults.contents = source;
    return mod;
  });
};
