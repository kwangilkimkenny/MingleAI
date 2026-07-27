import {
  getAccountStatus,
  getMyProfile,
  nextGate,
  type GateStep,
} from "@mingle/client-core";
import { getCameraMicStatus } from "./permissions";

export type AccountGateResolution = {
  phase: GateStep;
  profileId?: string;
};

let primedGate: AccountGateResolution | null = null;

/**
 * Resolve the onboarding gate once. Login primes this result before its exit animation so the
 * authenticated layout can render the correct destination on its first frame instead of flashing
 * an intermediate loading screen.
 */
export async function resolveAccountGate(): Promise<AccountGateResolution> {
  const [status, permissions] = await Promise.all([
    getAccountStatus(),
    getCameraMicStatus(),
  ]);
  const phase = nextGate(status, permissions);
  if (phase !== "ready") return { phase };

  const profile = await getMyProfile();
  return { phase, profileId: profile?.id };
}

export function primeAccountGate(resolution: AccountGateResolution): void {
  primedGate = resolution;
}

/** One-shot read: a result prepared for one navigation must never leak into a later app launch. */
export function takePrimedAccountGate(): AccountGateResolution | null {
  const resolution = primedGate;
  primedGate = null;
  return resolution;
}
