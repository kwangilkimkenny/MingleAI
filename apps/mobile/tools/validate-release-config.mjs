import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readJson = async (relativePath) =>
  JSON.parse(await readFile(new URL(relativePath, import.meta.url), 'utf8'));

const eas = await readJson('../eas.json');
const app = await readJson('../app.json');
const expo = app.expo;

assert.equal(eas.cli.requireCommit, true, 'EAS builds must require a committed revision');
assert.equal(eas.build.preview.environment, 'preview');
assert.equal(eas.build.preview.distribution, 'internal');
assert.equal(eas.build.preview.android.buildType, 'apk');
assert.equal(eas.build.production.environment, 'production');
assert.equal(eas.build.production.android.buildType, 'app-bundle');
assert.equal(eas.build.production.android.credentialsSource, 'remote');
assert.equal(eas.submit.production.android.track, 'internal');
assert.equal(
  Object.hasOwn(eas.build.preview, 'env'),
  false,
  'Preview secrets must come from the EAS preview environment',
);
assert.equal(
  Object.hasOwn(eas.build.production, 'env'),
  false,
  'Production secrets must come from the EAS production environment',
);

assert.equal(expo.android.package, 'com.mingles.app');
assert.equal(expo.ios.bundleIdentifier, 'com.mingles.app');
assert.match(expo.extra.eas.projectId, /^[0-9a-f-]{36}$/i);
assert.equal(expo.userInterfaceStyle, 'dark');
assert.deepEqual(
  [...expo.android.permissions].sort(),
  ['android.permission.CAMERA', 'android.permission.RECORD_AUDIO'].sort(),
  'Explicit Android permissions must stay on the reviewed allowlist',
);
assert.deepEqual(
  [...expo.android.blockedPermissions].sort(),
  [
    'android.permission.READ_EXTERNAL_STORAGE',
    'android.permission.SYSTEM_ALERT_WINDOW',
    'android.permission.WRITE_EXTERNAL_STORAGE',
  ].sort(),
  'Unnecessary overlay and broad storage permissions must stay blocked',
);

const serializedConfig = JSON.stringify({ eas, app });
assert.doesNotMatch(serializedConfig, /api\.example\.com/i);

console.log('Release configuration validated.');
