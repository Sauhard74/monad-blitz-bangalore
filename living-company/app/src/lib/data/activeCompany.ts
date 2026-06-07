/**
 * The company the office is currently showing. Stored client-side so the office
 * can switch between provisioned companies; the server routes accept it as a
 * `?company=` param (and verify access with the board key).
 */
const KEY = 'lc-active-company';

export function getActiveCompany(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setActiveCompany(id: string): void {
  try {
    window.localStorage.setItem(KEY, id);
  } catch {
    /* ignore */
  }
}

/** `?company=<id>` (or empty) to append to a same-origin route URL. */
export function companyQuery(): string {
  const id = getActiveCompany();
  return id ? `?company=${encodeURIComponent(id)}` : '';
}
