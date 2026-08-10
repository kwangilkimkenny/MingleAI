const fs = require('node:fs');
const path = require('node:path');
const { withDangerousMod } = require('@expo/config-plugins');

/**
 * Expo SDK 56 currently generates a wrapper newer than the Android toolchain
 * used by React Native 0.83 can reliably configure. Keep local and EAS
 * prebuilds on the version validated by the Android release build.
 */
module.exports = function withCompatibleGradle(config) {
  return withDangerousMod(config, [
    'android',
    async (modConfig) => {
      const wrapperPath = path.join(
        modConfig.modRequest.platformProjectRoot,
        'gradle',
        'wrapper',
        'gradle-wrapper.properties',
      );
      const wrapper = fs.readFileSync(wrapperPath, 'utf8');
      const distributionPattern = /gradle-[0-9.]+-(?:bin|all)\.zip/;
      if (!distributionPattern.test(wrapper)) {
        throw new Error(`Unable to pin the Gradle wrapper at ${wrapperPath}`);
      }

      const updated = wrapper.replace(distributionPattern, 'gradle-8.13-bin.zip');
      fs.writeFileSync(wrapperPath, updated);
      return modConfig;
    },
  ]);
};
