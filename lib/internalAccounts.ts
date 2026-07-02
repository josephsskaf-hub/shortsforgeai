// Push #482 — Internal accounts: single source of truth.
//
// WHY THIS EXISTS: all 4 "paying" accounts in prod are the founder and his
// sister testing (confirmed by Joseph 02/07/2026 — josephsskaf@gmail.com,
// josephskaf@hotmail.com, victoriaskaf96@gmail.com, joseph+teste01@gmail.com).
// Any admin metric that does NOT exclude them shows fake MRR/activation.
// This module is the ONLY place the list lives — admin pages and routes
// import isInternalEmail() (TS-side filtering) or the SQL condition helpers.
//
// UI rule: every surface that filters with this module must show the label
// INTERNAL_ACCOUNTS_LABEL ("internal accounts excluded") so numbers are
// never mistaken for raw totals.

/** Exact e-mails confirmed by the founder (him + sister + named test accounts). */
export const INTERNAL_EXACT_EMAILS: string[] = [
  'josephsskaf@gmail.com',
  'josephskaf@hotmail.com',
  'victoriaskaf96@gmail.com',
  'joseph+teste01@gmail.com',
  'teste01@shortsforgeai.com',
]

/**
 * SQL LIKE patterns (% = wildcard, matched case-insensitively).
 * Founder-confirmed patterns first, then the legacy throwaway patterns that
 * /api/admin/overview has excluded since Push #417 (kept so numbers do not
 * silently jump when routes migrate to this module).
 */
export const INTERNAL_LIKE_PATTERNS: string[] = [
  'josephsskaf+%@gmail.com', // founder plus-aliases
  'joseph+%@gmail.com', // founder plus-aliases (joseph+teste02…)
  '%@theresanaiforthat.com', // TAAFT reviewer account
  'josephsskaf%', // legacy #417 — typo'd domains (…@gmai.com etc.)
  'josephskaf%', // legacy #417 — hotmail variants
  '%@shortsforgeai.com', // legacy #417 — internal domain (joseph-test, faststest…)
  'test%', // legacy #417 — throwaways
  '%mailinator%', // legacy #417
  'smoketest%', // legacy #417
]

/** Compile a SQL LIKE pattern into an anchored case-insensitive RegExp. */
function likeToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`^${escaped.replace(/%/g, '.*').replace(/_/g, '.')}$`, 'i')
}

const EXACT_SET = new Set(INTERNAL_EXACT_EMAILS.map((e) => e.toLowerCase()))
const PATTERN_REGEXPS = INTERNAL_LIKE_PATTERNS.map(likeToRegExp)

/** True when the e-mail belongs to an internal (founder/test) account. */
export function isInternalEmail(email: string | null | undefined): boolean {
  const e = (email ?? '').trim().toLowerCase()
  if (!e) return false
  if (EXACT_SET.has(e)) return true
  return PATTERN_REGEXPS.some((re) => re.test(e))
}

/**
 * Reusable SQL fragment matching INTERNAL rows, e.g.
 *   `SELECT … WHERE ${internalAccountsSqlCondition('p.email')}`
 * All values are hardcoded module constants (never user input), so inlining
 * is injection-safe. Wrap with NOT (or use externalAccountsSqlCondition) to
 * keep only real customers.
 */
export function internalAccountsSqlCondition(column: string = 'email'): string {
  const c = `lower(${column})`
  const exact = INTERNAL_EXACT_EMAILS.map((e) => `'${e}'`).join(',')
  const likes = INTERNAL_LIKE_PATTERNS.map((p) => `${c} LIKE '${p}'`).join(' OR ')
  return `(${c} IN (${exact}) OR ${likes})`
}

/** SQL fragment matching EXTERNAL (real customer) rows. */
export function externalAccountsSqlCondition(column: string = 'email'): string {
  return `NOT ${internalAccountsSqlCondition(column)}`
}

/** Badge text every filtered admin surface must display. */
export const INTERNAL_ACCOUNTS_LABEL = 'internal accounts excluded'
