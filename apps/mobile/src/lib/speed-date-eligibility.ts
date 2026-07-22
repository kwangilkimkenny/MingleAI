const ELIGIBLE_SPEED_DATE_GENDERS = new Set(["male", "female"]);

export function isSpeedDateEligibleGender(gender: string): boolean {
  return ELIGIBLE_SPEED_DATE_GENDERS.has(gender);
}
