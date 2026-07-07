// KINEO-DISPOSABLE-BLOCK-2026-07-06 — block disposable / temp-mail signups.
//
// Free plan gives 2 real videos, so throwaway inboxes are pure abuse: they burn
// AI credits and never convert. This blocklist is checked in the email signup
// handler BEFORE supabase.auth.signUp. It is NOT applied to Google/Apple OAuth —
// those identities are owned by the provider and can't be disposable.
//
// Includes the usual temp-mail providers PLUS domains actually seen abusing this
// app (yopmail, doefy, kinws, gmeenramy, x-box.in, vtmpj, lovadio, asitrai,
// sages.us, etc.). Keep additions lowercase and bare (no leading "@").

export const DISPOSABLE_DOMAINS: Set<string> = new Set([
  // seen in this app
  'yopmail.com',
  'mailinator.com',
  'doefy.com',
  'kinws.com',
  'gmeenramy.com',
  'x-box.in',
  'vtmpj.com',
  'lovadio.com',
  'asitrai.com',
  'sages.us',
  // common disposable / temp-mail providers
  'guerrillamail.com',
  'guerrillamail.net',
  'guerrillamail.org',
  'guerrillamail.biz',
  'guerrillamail.de',
  'grr.la',
  'sharklasers.com',
  'spam4.me',
  '10minutemail.com',
  '10minutemail.net',
  '20minutemail.com',
  'temp-mail.org',
  'temp-mail.io',
  'tempmail.com',
  'tempmail.dev',
  'tempmailo.com',
  'tempr.email',
  'tmpmail.org',
  'tmpmail.net',
  'trashmail.com',
  'trashmail.de',
  'trashmail.net',
  'wegwerfmail.de',
  'getnada.com',
  'nada.email',
  'dispostable.com',
  'maildrop.cc',
  'mohmal.com',
  'fakeinbox.com',
  'fakemail.net',
  'throwawaymail.com',
  'throwawaymail.net',
  'mailnesia.com',
  'mailcatch.com',
  'mailnull.com',
  'emailondeck.com',
  'mytemp.email',
  'mail-temp.com',
  'mailtemp.io',
  'mail7.io',
  'moakt.com',
  'mailsac.com',
  'inboxkitten.com',
  'burnermail.io',
  'discard.email',
  'discardmail.com',
  'discardmail.de',
  'yopmail.fr',
  'yopmail.net',
  'cool.fr.nf',
  'jetable.org',
  'nospam.ze.tc',
  'nomail.xl.cx',
  'trbvm.com',
  'meltmail.com',
  'mintemail.com',
  'spambog.com',
  'spambox.us',
  'spamgourmet.com',
  'spamex.com',
  'anonbox.net',
  'anonymbox.com',
  'deadaddress.com',
  'despam.it',
  'devnullmail.com',
  'e4ward.com',
  'emailtemporario.com.br',
  'fudgerub.com',
  'gishpuppy.com',
  'incognitomail.com',
  'kurzepost.de',
  'lroid.com',
  'mailexpire.com',
  'mailforspam.com',
  'mailimate.com',
  'mailin8r.com',
  'mailinator.net',
  'mailinator.org',
  'mailinator2.com',
  'notmailinator.com',
  'reallymymail.com',
  'sogetthis.com',
  'thisisnotmyrealemail.com',
  'tradermail.info',
  'veryrealemail.com',
  'wh4f.org',
  'willselfdestruct.com',
  'yopmail.gq',
  'zoemail.com',
  'zetmail.com',
  'einrot.com',
  'fleckens.hu',
  'gustr.com',
  'jourrapide.com',
  'rhyta.com',
  'superrito.com',
  'teleworm.us',
  'armyspy.com',
  'cuvox.de',
  'dayrep.com',
  'dropmail.me',
  '10mail.org',
  'harakirimail.com',
  'mailismagic.com',
  'mailtothis.com',
  'no-spam.ws',
  'objectmail.com',
  'proxymail.eu',
  'rcpt.at',
  'trash-mail.com',
  'trash-mail.de',
  'tempinbox.com',
  'tempemail.net',
  'tempmailaddress.com',
  'temporaryemail.net',
  'temporaryforwarding.com',
  'temp-mail.ru',
  'luxusmail.org',
  'mailpoof.com',
  'linshiyouxiang.net',
  'byom.de',
  'crazymailing.com',
  'dropjar.com',
  'emailfake.com',
  'fakermail.com',
  'guerillamail.com',
  'inboxbear.com',
  'mail-temporaire.fr',
  'minuteinbox.com',
  'muellmail.com',
  'onemail.host',
  'yoggm.com',
])

/**
 * Returns true when `email` uses a known disposable / temp-mail domain.
 * Case-insensitive. Safe on malformed input — returns false when there is no
 * parseable domain (empty, missing "@", trailing "@", etc.).
 */
export function isDisposableEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false

  const at = email.lastIndexOf('@')
  if (at === -1) return false

  const domain = email
    .slice(at + 1)
    .trim()
    .toLowerCase()

  if (!domain || domain.includes('@') || !domain.includes('.')) return false

  return DISPOSABLE_DOMAINS.has(domain)
}
