/**
 * Web preview has no Expo device-push transport. Keeping a platform-specific no-op
 * prevents expo-notifications from registering unsupported web listeners while the
 * notification inbox and preference UI remain fully testable.
 */
export function usePushRegistration(_enabled: boolean) {}
