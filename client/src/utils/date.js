import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Parse a UTC date string and return a dayjs object in the user's timezone.
 * Falls back to 'UTC' if tz is not provided.
 */
export function toUserTz(utcString, tz) {
  if (!utcString) return null;
  return dayjs.utc(utcString).tz(tz || 'UTC');
}

/**
 * Format a UTC date string for display in the user's timezone.
 * @param {string} utcString - ISO date string (UTC)
 * @param {string} tz - IANA timezone, e.g. 'Asia/Shanghai'
 * @param {string} fmt - dayjs format string
 */
export function formatDate(utcString, tz, fmt = 'YYYY-MM-DD') {
  const d = toUserTz(utcString, tz);
  return d ? d.format(fmt) : '';
}

/**
 * Convert a dayjs object that represents a time in the user's preferred
 * timezone into a UTC ISO string for storage.
 *
 * When the user picks "2026-04-01 09:00" and their preferred tz is
 * Asia/Shanghai, this returns "2026-04-01T01:00:00.000Z".
 */
export function toUTCString(dayjsValue, tz) {
  if (!dayjsValue) return null;
  const localStr = dayjsValue.format('YYYY-MM-DD HH:mm:ss');
  return dayjs.tz(localStr, tz || 'UTC').utc().toISOString();
}

/**
 * Given a UTC ISO string, return a dayjs object initialised in the user's
 * timezone — suitable for binding to an Ant Design DatePicker.
 */
export function utcToDayjsInTz(utcString, tz) {
  if (!utcString) return null;
  return dayjs.utc(utcString).tz(tz || 'UTC');
}
