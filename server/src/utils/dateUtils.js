const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');

dayjs.extend(utc);
dayjs.extend(timezone);

/** Returns 'YYYY-MM-DD' in the given IANA timezone. */
function getLocalDate(tz, offsetDays = 0) {
  let d = dayjs().tz(tz || 'UTC');
  if (offsetDays) d = d.add(offsetDays, 'day');
  return d.format('YYYY-MM-DD');
}

/** Returns 'HH:MM' (24-hour, zero-padded) in the given IANA timezone. */
function getLocalHHMM(tz) {
  return dayjs().tz(tz || 'UTC').format('HH:mm');
}

/**
 * Returns [startUTC, endUTC] ISO strings covering the full local day
 * (localDate = 'YYYY-MM-DD') in the given IANA timezone.
 * Uses dayjs so DST transition days (23h / 25h) are handled correctly.
 */
function getLocalDayUTCBounds(localDate, tz) {
  const start = dayjs.tz(localDate, tz || 'UTC').startOf('day').utc().toISOString();
  const end   = dayjs.tz(localDate, tz || 'UTC').endOf('day').utc().toISOString();
  return [start, end];
}

/** Format a UTC date string for display in the user's timezone. */
function formatDueDate(utcString, tz) {
  if (!utcString) return '';
  return dayjs.utc(utcString).tz(tz || 'UTC').format('YYYY-MM-DD HH:mm');
}

/** Convert a UTC ISO string to 'YYYY-MM-DD' in the given IANA timezone. */
function utcToLocalDate(utcString, tz) {
  if (!utcString) return '';
  return dayjs.utc(utcString).tz(tz || 'UTC').format('YYYY-MM-DD');
}

module.exports = { getLocalDate, getLocalHHMM, getLocalDayUTCBounds, formatDueDate, utcToLocalDate };
