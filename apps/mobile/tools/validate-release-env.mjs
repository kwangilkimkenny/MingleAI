import { validateReleaseEnvironment } from './release-env.mjs';

try {
  const result = validateReleaseEnvironment(process.env);
  if (result.skipped) {
    console.log(`Release environment validation skipped for ${result.profile} profile.`);
  } else {
    console.log(
      `Release environment validated for ${result.profile}: ${result.apiOrigin}, ${result.configuredSocialProviders.length} social provider(s).`,
    );
  }
} catch (error) {
  console.error(`Release environment validation failed: ${error.message}`);
  process.exitCode = 1;
}
