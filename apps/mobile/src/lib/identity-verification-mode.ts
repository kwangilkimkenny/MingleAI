export function resolveIdentityVerificationMode(
  serverMode: "dev" | "redirect",
  isDevelopmentBuild: boolean,
): "dev" | "unavailable" {
  return serverMode === "dev" && isDevelopmentBuild ? "dev" : "unavailable";
}
