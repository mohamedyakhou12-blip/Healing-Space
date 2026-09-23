/**
 * Reserved admin account — email + password login grants admin role.
 *
 * The account admin@gmail.com / 052307 is locked to the platform owner:
 * - register/route.ts rejects creating any other user with this email
 * - login/route.ts treats this email as an admin account: the ONLY accepted
 *   password is ADMIN_PASSWORD (profile password changes are ignored for admin
 *   login), so the owner can never be locked out
 * - the Firestore user doc is auto-provisioned on the first successful login
 *
 * Override via env vars (server-side only): ADMIN_EMAIL, ADMIN_PASSWORD.
 */

export const ADMIN_EMAIL: string = (process.env.ADMIN_EMAIL || "admin@gmail.com")
  .trim()
  .toLowerCase();

export const ADMIN_PASSWORD: string = process.env.ADMIN_PASSWORD || "052307";

/**
 * True when ADMIN_PASSWORD was NOT provided via the environment, i.e. the
 * hardcoded fallback above is in effect. In production this is a Critical
 * vulnerability (the fallback is public), so login blocks it at login-time
 * (fail-closed) without crashing the whole app at module load.
 */
export const ADMIN_PASSWORD_IS_DEFAULT: boolean = !process.env.ADMIN_PASSWORD;

export const ADMIN_NAME: string = process.env.ADMIN_NAME || "Admin";

export function isReservedAdminEmail(email: string): boolean {
  return email.trim().toLowerCase() === ADMIN_EMAIL;
}

export function isAdminLogin(email: string, password: string): boolean {
  return isReservedAdminEmail(email) && password === ADMIN_PASSWORD;
}