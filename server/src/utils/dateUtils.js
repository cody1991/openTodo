/** Returns 'YYYY-MM-DD' in the given IANA timezone. */
function getLocalDate(timezone, offsetDays = 0) {
  const d = new Date();
  if (offsetDays) d.setUTCDate(d.getUTCDate() + offsetDays);
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(d);
}

/** Returns 'HH:MM' (24-hour, zero-padded) in the given IANA timezone. */
function getLocalHHMM(timezone) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date());
}

/**
 * Returns [startUTC, endUTC] ISO strings covering the full local day
 * (localDate = 'YYYY-MM-DD') in the given IANA timezone.
 */
function getLocalDayUTCBounds(localDate, timezone) {
  const refTime = new Date(localDate + 'T12:00:00Z');
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    timeZoneName: 'longOffset',
  }).formatToParts(refTime);
  const tzOffset = parts.find((p) => p.type === 'timeZoneName')?.value || 'GMT+0:00';
  const m = tzOffset.match(/GMT([+-])(\d{1,2}):(\d{2})/);
  const sign = m ? (m[1] === '+' ? 1 : -1) : 0;
  const offsetMs = m ? sign * (parseInt(m[2]) * 60 + parseInt(m[3])) * 60000 : 0;
  const startUTC = new Date(localDate + 'T00:00:00.000Z').getTime() - offsetMs;
  return [new Date(startUTC).toISOString(), new Date(startUTC + 86400000).toISOString()];
}

/** Format a UTC date string for display in the user's timezone. */
function formatDueDate(utcString, timezone) {
  return new Date(utcString).toLocaleString('zh-CN', { timeZone: timezone });
}

/** Convert a UTC ISO string to 'YYYY-MM-DD' in the given IANA timezone. */
function utcToLocalDate(utcString, timezone) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date(utcString));
}

module.exports = { getLocalDate, getLocalHHMM, getLocalDayUTCBounds, formatDueDate, utcToLocalDate };
