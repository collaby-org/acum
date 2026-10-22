export const ADMIN_EMAIL = "gmgmethereum@gmail.com";

export function isAdmin(
  email?: string | null,
  plan?: string | null,
): boolean {
  if (email && email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) return true;
  return plan === "comp" || plan === "bypass";
}
