// Helpers for displaying SignalWire call logs in a friendly way.

// Strip a SIP URI down to the user/number portion. e.g.
//   sip:8452740451@4gonwheels-...sip.signalwire.com  -> 8452740451
//   "John" <sip:101@host>                            -> 101
export const stripSip = (raw) => {
  if (!raw) return '';
  const m = String(raw).match(/sip:([^@>;\s]+)@/i);
  return m ? m[1] : String(raw);
};

// Pretty E.164 / NANP formatter. Falls back to the raw string when we
// can't recognise it.
export const formatPhone = (raw) => {
  if (!raw) return '';
  const cleaned = stripSip(raw).trim();
  // E.164 NANP: +1XXXXXXXXXX
  const us = cleaned.match(/^\+?1?(\d{3})(\d{3})(\d{4})$/);
  if (us) return `(${us[1]}) ${us[2]}-${us[3]}`;
  // Other E.164: keep + and digits with grouping every 3
  if (/^\+\d{6,15}$/.test(cleaned)) return cleaned;
  // Pure digits without country code
  if (/^\d{10}$/.test(cleaned)) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return cleaned;
};

export const formatDurationShort = (seconds) => {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

export const formatDurationClock = (seconds) => {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

// Return the "other party" of the call (the number you called, or who
// called you), nicely formatted. Falls back to phone_number if the
// new from_number/to_number columns are not populated yet.
export const callCounterparty = (log) => {
  if (!log) return '';
  if (log.customers?.name) return log.customers.name;
  const raw = log.direction === 'outbound'
    ? (log.to_number || log.phone_number)
    : (log.from_number || log.phone_number);
  return formatPhone(raw);
};

// Compute the "talk time" we want to display. Prefer answered -> ended,
// fall back to the duration_seconds the function stored.
export const callTalkSeconds = (log) => {
  if (!log) return 0;
  if (log.answered_at && log.ended_at) {
    const ms = new Date(log.ended_at).getTime() - new Date(log.answered_at).getTime();
    if (ms > 0) return Math.round(ms / 1000);
  }
  return Number(log.duration_seconds) || 0;
};

export const statusLabel = (s) => {
  const map = {
    initiated: 'Initiated',
    ringing: 'Ringing',
    answered: 'Answered',
    'in-progress': 'In progress',
    completed: 'Completed',
    busy: 'Busy',
    'no-answer': 'No answer',
    canceled: 'Canceled',
    failed: 'Failed',
    missed: 'Missed',
    declined: 'Declined',
  };
  return map[s] || (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
};

export const statusTone = (s) => {
  switch (s) {
    case 'completed':
    case 'answered':
    case 'in-progress':
      return 'text-emerald-600';
    case 'ringing':
    case 'initiated':
      return 'text-amber-600';
    case 'busy':
    case 'no-answer':
    case 'canceled':
    case 'failed':
    case 'missed':
    case 'declined':
      return 'text-rose-600';
    default:
      return 'text-muted-foreground';
  }
};
