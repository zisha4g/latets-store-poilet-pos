import { useMemo, useState, useEffect, useCallback } from 'react';
import { HDate, HebrewCalendar, Location, Zmanim, Event, flags, gematriya, months } from '@hebcal/core';

// ─── Color mapping ───────────────────────────────────────────
export const HOLIDAY_COLORS = {
  major:      { bg: 'bg-red-100',     text: 'text-red-800',     border: 'border-red-300' },
  minor:      { bg: 'bg-blue-100',    text: 'text-blue-800',    border: 'border-blue-300' },
  fast:       { bg: 'bg-orange-100',  text: 'text-orange-800',  border: 'border-orange-300' },
  modern:     { bg: 'bg-purple-100',  text: 'text-purple-800',  border: 'border-purple-300' },
  shabbat:    { bg: 'bg-indigo-100',  text: 'text-indigo-800',  border: 'border-indigo-300' },
  parsha:     { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-300' },
  roshchodesh:{ bg: 'bg-teal-100',    text: 'text-teal-800',    border: 'border-teal-300' },
  default:    { bg: 'bg-gray-100',    text: 'text-gray-800',    border: 'border-gray-300' },
};

/**
 * Return the color set for a hebcal Event
 */
export function getHolidayColor(ev) {
  const mask = ev.getFlags();
  if (mask & flags.PARSHA_HASHAVUA) return HOLIDAY_COLORS.parsha;
  if (mask & flags.ROSH_CHODESH)    return HOLIDAY_COLORS.roshchodesh;
  if (mask & flags.MINOR_FAST)      return HOLIDAY_COLORS.fast;
  if (mask & flags.MAJOR_FAST)      return HOLIDAY_COLORS.fast;
  if (mask & flags.MODERN_HOLIDAY)  return HOLIDAY_COLORS.modern;
  if (mask & flags.SPECIAL_SHABBAT) return HOLIDAY_COLORS.shabbat;
  if (mask & flags.MINOR_HOLIDAY)   return HOLIDAY_COLORS.minor;
  if (mask & flags.CHAG)            return HOLIDAY_COLORS.major;
  return HOLIDAY_COLORS.default;
}

/**
 * Return a Hebrew category label for an event
 */
export function getHolidayCategoryLabel(ev) {
  const mask = ev.getFlags();
  if (mask & flags.PARSHA_HASHAVUA) return 'פרשה';
  if (mask & flags.ROSH_CHODESH)    return 'ר״ח';
  if (mask & flags.MINOR_FAST)      return 'צום';
  if (mask & flags.MAJOR_FAST)      return 'צום';
  if (mask & flags.MODERN_HOLIDAY)  return 'יום מיוחד';
  if (mask & flags.SPECIAL_SHABBAT) return 'שבת מיוחדת';
  if (mask & flags.MINOR_HOLIDAY)   return 'מועד';
  if (mask & flags.CHAG)            return 'חג';
  return 'אירוע';
}

// ─── Hebrew month name mapping ──────────────────────────────
const HEBREW_MONTH_NAMES = {
  1:  'ניסן',
  2:  'אייר',
  3:  'סיון',
  4:  'תמוז',
  5:  'אב',
  6:  'אלול',
  7:  'תשרי',
  8:  'חשון',
  9:  'כסלו',
  10: 'טבת',
  11: 'שבט',
  12: 'אדר',
  13: 'אדר ב׳',
};

// ─── Hebrew date formatting ──────────────────────────────────

/**
 * Convert a JS Date → Hebrew date string like "כ״ה שבט תשפ״ו"
 */
export function getHebrewDateString(date) {
  if (!date) return '';
  try {
    const hd = new HDate(date);
    const day = gematriya(hd.getDate());
    const monthName = HEBREW_MONTH_NAMES[hd.getMonth()] || hd.getMonthName();
    const year = gematriya(hd.getFullYear());
    return `${day} ${monthName} ${year}`;
  } catch { return ''; }
}

/**
 * Short Hebrew date (day + month) like "כ״ה שבט" or "כ״ה Sh'vat"
 * @param {Date} date
 * @param {boolean} hebrewMonthNames - if true, month in Hebrew script; if false, transliterated
 */
export function getHebrewDateShort(date, hebrewMonthNames = true) {
  if (!date) return '';
  try {
    const hd = new HDate(date);
    const day = gematriya(hd.getDate());
    if (hebrewMonthNames) {
      const monthName = HEBREW_MONTH_NAMES[hd.getMonth()] || hd.getMonthName();
      return `${day} ${monthName}`;
    } else {
      const monthName = hd.getMonthName();
      return `${day} ${monthName}`;
    }
  } catch { return ''; }
}

// ─── Zmanim formatting ──────────────────────────────────────

function formatTime(dt, use12h = true) {
  if (!dt || isNaN(dt.getTime())) return '--:--';
  if (use12h) {
    return dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }
  return dt.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false });
}

/**
 * Get zmanim (halachic times) for a given date and location.
 * Returns null if no location available.
 */
export function getZmanimForDate(date, location, use12h = true, havdalahMins = 0) {
  if (!date || !location) return null;
  try {
    const zman = new Zmanim(location, date, false);
    // For tzeit: if havdalahMins > 0, use minutes after sunset; else use astronomical tzeit
    const sunsetDt = zman.sunset();
    const tzeitDt = havdalahMins > 0
      ? new Date(sunsetDt.getTime() + havdalahMins * 60 * 1000)
      : zman.tzeit();
    return {
      alotHaShachar: formatTime(zman.alotHaShachar(), use12h),
      misheyakir: formatTime(zman.misheyakir(), use12h),
      sunrise: formatTime(zman.sunrise(), use12h),
      sofZmanShmaMGA: formatTime(zman.sofZmanShmaMGA(), use12h),
      sofZmanShma: formatTime(zman.sofZmanShma(), use12h),
      sofZmanTfilla: formatTime(zman.sofZmanTfilla(), use12h),
      chatzot: formatTime(zman.chatzot(), use12h),
      minchaGedola: formatTime(zman.minchaGedola(), use12h),
      minchaKetana: formatTime(zman.minchaKetana(), use12h),
      plagHaMincha: formatTime(zman.plagHaMincha(), use12h),
      sunset: formatTime(sunsetDt, use12h),
      tzeit: formatTime(tzeitDt, use12h),
    };
  } catch { return null; }
}

/**
 * Get Shabbat/candle-lighting times for a Friday date.
 * candleLightingMins = minutes before sunset (default 18)
 * havdalahMins = minutes after sunset for havdalah (default 42). If 0, uses tzeit.
 */
export function getShabbatTimes(date, location, candleLightingMins = 18, havdalahMins = 42, use12h = true) {
  if (!date || !location) return null;
  try {
    const friday = new Date(date);
    // Adjust to Friday: if Saturday go back 1 day, otherwise go forward
    const day = friday.getDay();
    if (day === 6) {
      friday.setDate(friday.getDate() - 1); // Saturday → previous Friday
    } else if (day !== 5) {
      friday.setDate(friday.getDate() + (5 - day + 7) % 7); // forward to next Friday
    }
    
    const saturday = new Date(friday);
    saturday.setDate(saturday.getDate() + 1);

    const fridayZman = new Zmanim(location, friday, false);
    const saturdayZman = new Zmanim(location, saturday, false);

    const sunset = fridayZman.sunset();
    const candleLighting = new Date(sunset.getTime() - candleLightingMins * 60 * 1000);
    
    // Havdalah: use minutes after Saturday sunset, or tzeit if 0
    const satSunset = saturdayZman.sunset();
    const havdalah = havdalahMins > 0
      ? new Date(satSunset.getTime() + havdalahMins * 60 * 1000)
      : saturdayZman.tzeit();

    return {
      candleLighting: formatTime(candleLighting, use12h),
      sunset: formatTime(sunset, use12h),
      havdalah: formatTime(havdalah, use12h),
      fridayDate: friday,
      saturdayDate: saturday,
    };
  } catch { return null; }
}

// ─── Main Hook ───────────────────────────────────────────────

/**
 * Custom hook for Hebrew calendar data.
 * Uses @hebcal/core — everything is computed locally, no API calls.
 *
 * @param {number} year - Gregorian year to compute events for
 * @param {{ latitude: number, longitude: number, cityName?: string }} geoLocation - optional user location for zmanim
 * @param {object} calendarSettings - calendar settings from the database
 */
export default function useHebrewCalendar(year = new Date().getFullYear(), geoLocation = null, calendarSettings = null) {
  const [location, setLocation] = useState(null);

  // Parse settings
  const parsedSettings = useMemo(() => {
    if (!calendarSettings) return null;
    try {
      const val = calendarSettings?.value;
      return typeof val === 'string' ? JSON.parse(val) : val;
    } catch { return null; }
  }, [calendarSettings?.value]);

  // Try to create a Location from provided geoLocation or browser geolocation
  useEffect(() => {
    if (geoLocation?.latitude && geoLocation?.longitude) {
      setLocation(
        new Location(geoLocation.latitude, geoLocation.longitude, false, 'America/New_York', geoLocation.cityName || 'Custom')
      );
      return;
    }

    // Fallback: try browser geolocation
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York';
          setLocation(
            new Location(pos.coords.latitude, pos.coords.longitude, false, tz, 'My Location')
          );
        },
        () => {
          // Default: New York
          setLocation(new Location(40.7128, -74.006, false, 'America/New_York', 'New York'));
        }
      );
    } else {
      // Default: New York
      setLocation(new Location(40.7128, -74.006, false, 'America/New_York', 'New York'));
    }
  }, [geoLocation?.latitude, geoLocation?.longitude, geoLocation?.cityName]);

  // Build events index for the year (± 1 year for boundary cases)
  const eventsByDate = useMemo(() => {
    const map = {};

    for (const y of [year - 1, year, year + 1]) {
      const options = {
        year: y,
        isHebrewYear: false,
        candlelighting: !!location,
        location: location || undefined,
        sedrot: true,
        omer: true,
        il: false, // diaspora
      };

      const events = HebrewCalendar.calendar(options);

      for (const ev of events) {
        const dt = ev.getDate().greg();
        const key = dt.toISOString().split('T')[0];
        if (!map[key]) map[key] = [];
        map[key].push(ev);
      }
    }

    return map;
  }, [year, location]);

  // Get Hebrew date for any JS Date
  const getHebrewDate = useCallback((date) => getHebrewDateString(date), []);
  const getHebrewDateShortFn = useCallback((date) => {
    const useHebrew = parsedSettings?.hebrewMonthNames ?? true;
    return getHebrewDateShort(date, useHebrew);
  }, [parsedSettings?.hebrewMonthNames]);

  // Get events for a date
  const getEventsForDate = useCallback((date) => {
    if (!date) return [];
    const key = date.toISOString().split('T')[0];
    return eventsByDate[key] || [];
  }, [eventsByDate]);

  // Get only holidays (filter out candle lighting, havdalah, modern/Israeli, etc.)
  const getHolidaysForDate = useCallback((date) => {
    return getEventsForDate(date).filter(ev => {
      const mask = ev.getFlags();
      // Skip Modern/Israeli holidays (Yom HaAliyah, Yom HaShoah, Yom HaZikaron, etc.)
      if (mask & flags.MODERN_HOLIDAY) return false;
      // Skip Chag HaBanot
      const desc = ev.getDesc();
      if (desc === 'Chag HaBanot') return false;
      return (
        (mask & flags.CHAG) ||
        (mask & flags.MINOR_HOLIDAY) ||
        (mask & flags.ROSH_CHODESH) ||
        (mask & flags.SPECIAL_SHABBAT) ||
        (mask & flags.PARSHA_HASHAVUA) ||
        (mask & flags.MINOR_FAST) ||
        (mask & flags.MAJOR_FAST)
      );
    });
  }, [getEventsForDate]);

  // Resolve havdalah minutes from shita
  const resolvedHavdalahMinutes = useMemo(() => {
    const shita = parsedSettings?.havdalahShita || '42min';
    if (shita === 'custom') return parsedSettings?.havdalahCustomMinutes ?? 42;
    if (shita === '8.5deg') return 0; // signal to use tzeit (8.5° below horizon)
    // Extract minutes from id like '35min', '40min', '72min'
    const match = shita.match(/(\d+)min/);
    return match ? parseInt(match[1]) : 42;
  }, [parsedSettings?.havdalahShita, parsedSettings?.havdalahCustomMinutes]);

  const use12h = (parsedSettings?.timeFormat ?? '12h') === '12h';

  // Get zmanim for a date
  const getZmanim = useCallback((date) => {
    return getZmanimForDate(date, location, use12h, resolvedHavdalahMinutes);
  }, [location, use12h, resolvedHavdalahMinutes]);

  // Get Shabbat times for a week containing a date
  const getShabbatTimesForDate = useCallback((date) => {
    const candleMin = parsedSettings?.candleLightingMinutes ?? 18;
    return getShabbatTimes(date, location, candleMin, resolvedHavdalahMinutes, use12h);
  }, [location, parsedSettings?.candleLightingMinutes, resolvedHavdalahMinutes, use12h]);

  return {
    getHebrewDate,
    getHebrewDateShort: getHebrewDateShortFn,
    getEventsForDate,
    getHolidaysForDate,
    getZmanim,
    getShabbatTimesForDate,
    location,
    eventsByDate,
    parsedSettings,
  };
}
