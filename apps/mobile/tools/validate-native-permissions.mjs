import assert from 'node:assert/strict';

let input = '';
for await (const chunk of process.stdin) input += chunk;

const config = JSON.parse(input);
const manifest = config._internal?.modResults?.android?.manifest?.manifest;
assert.ok(manifest, 'Expo introspection did not return an Android manifest');

const activeAndroidPermissions = (manifest['uses-permission'] ?? [])
  .filter((entry) => entry?.$?.['tools:node'] !== 'remove')
  .map((entry) => entry?.$?.['android:name'])
  .filter(Boolean)
  .sort();

const reviewedAndroidPermissions = [
  'android.permission.ACCESS_COARSE_LOCATION',
  'android.permission.ACCESS_FINE_LOCATION',
  'android.permission.ACCESS_NETWORK_STATE',
  'android.permission.BLUETOOTH',
  'android.permission.CAMERA',
  'android.permission.INTERNET',
  'android.permission.MODIFY_AUDIO_SETTINGS',
  'android.permission.RECORD_AUDIO',
  'android.permission.VIBRATE',
  'android.permission.WAKE_LOCK',
].sort();

assert.deepEqual(
  activeAndroidPermissions,
  reviewedAndroidPermissions,
  'Merged Android permissions changed; review Play Data safety before releasing',
);

const infoPlist = config._internal?.modResults?.ios?.infoPlist;
assert.ok(infoPlist, 'Expo introspection did not return an iOS Info.plist');
assert.equal(
  infoPlist.NSAppTransportSecurity?.NSAllowsArbitraryLoads,
  false,
  'Release configuration must not allow arbitrary cleartext network loads',
);
assert.equal(
  Object.hasOwn(infoPlist, 'NSLocationAlwaysAndWhenInUseUsageDescription'),
  false,
  'The app only uses foreground location',
);
assert.equal(
  Object.hasOwn(infoPlist, 'NSLocationAlwaysUsageDescription'),
  false,
  'The app only uses foreground location',
);
assert.equal(
  Object.hasOwn(infoPlist, 'NSMotionUsageDescription'),
  false,
  'The app does not use motion activity',
);
assert.equal(
  Object.hasOwn(infoPlist, 'NSFaceIDUsageDescription'),
  false,
  'Secure token storage does not request biometric authentication',
);

console.log(`Native permission manifest validated (${activeAndroidPermissions.length} Android permissions).`);
