export function resolveIdentityVerificationMode(
  serverMode: "dev" | "portone",
  isDevelopmentBuild: boolean,
): "dev" | "portone" | "unavailable" {
  if (serverMode === "portone") return "portone";
  return isDevelopmentBuild ? "dev" : "unavailable";
}
