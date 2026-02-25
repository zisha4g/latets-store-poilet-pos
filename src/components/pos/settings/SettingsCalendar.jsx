import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { Calendar, Clock, Sun, Moon, Flame, Eye, EyeOff } from 'lucide-react';

// ─── Tzeit / Havdalah Shitot ────────────────────────────────
export const TZEITOT = [
  { id: '8.5deg',   minutes: null, label: 'ר"ת 8.5°',          he: 'רבינו תם (8.5 מעלות)',       desc: '~35 min after sunset (3 medium stars, 8.5° below horizon)' },
  { id: '35min',    minutes: 35,   label: '35 min',             he: '35 דקות אחרי שקיעה',         desc: '35 minutes after sunset' },
  { id: '40min',    minutes: 40,   label: '40 min',             he: '40 דקות אחרי שקיעה',         desc: '40 minutes after sunset' },
  { id: '42min',    minutes: 42,   label: '42 min',             he: '42 דקות אחרי שקיעה',         desc: '42 minutes after sunset (common Ashkenazi)' },
  { id: '50min',    minutes: 50,   label: 'ר\' משה פיינשטיין',  he: 'ר\' משה פיינשטיין (50 דקות)', desc: '50 minutes after sunset' },
  { id: '60min',    minutes: 60,   label: '60 min',             he: '60 דקות אחרי שקיעה',         desc: '60 minutes after sunset' },
  { id: '72min',    minutes: 72,   label: 'ר"ת 72 min',         he: 'רבינו תם (72 דקות)',          desc: '72 minutes after sunset (Rabbeinu Tam fixed)' },
  { id: 'custom',   minutes: null, label: 'Custom',             he: 'מותאם אישית',                desc: 'Set your own minutes' },
];

// Default calendar settings
export const DEFAULT_CALENDAR_SETTINGS = {
  enableJewishCalendar: true,
  hebrewMonthNames: true, // true = שבט, false = Sh'vat
  timeFormat: '12h', // '12h' or '24h'
  enableZmanim: true,
  zmanimToShow: {
    alotHaShachar: false,
    misheyakir: false,
    sunrise: true,
    sofZmanShmaMGA: false,
    sofZmanShma: false,
    sofZmanTfilla: false,
    chatzot: true,
    minchaGedola: false,
    minchaKetana: false,
    plagHaMincha: false,
    sunset: true,
    tzeit: false,
  },
  enableCandleLighting: true,
  candleLightingMinutes: 18,
  enableHavdalah: true,
  havdalahShita: '42min', // id from TZEIT_SHITOT
  havdalahCustomMinutes: 42, // only used when havdalahShita === 'custom'
};

// Hebrew labels for zmanim
const ZMANIM_LABELS = {
  alotHaShachar: { he: 'עלות השחר', en: 'Alot HaShachar' },
  misheyakir: { he: 'משיכיר', en: 'Misheyakir' },
  sunrise: { he: 'הנץ החמה', en: 'Sunrise' },
  sofZmanShmaMGA: { he: 'סוף זמן ק"ש (מג"א)', en: 'Sof Zman Shma (MGA)' },
  sofZmanShma: { he: 'סוף זמן ק"ש (גר"א)', en: "Sof Zman Shma (GRA)" },
  sofZmanTfilla: { he: 'סוף זמן תפילה', en: 'Sof Zman Tefilla' },
  chatzot: { he: 'חצות', en: 'Chatzot' },
  minchaGedola: { he: 'מנחה גדולה', en: 'Mincha Gedola' },
  minchaKetana: { he: 'מנחה קטנה', en: 'Mincha Ketana' },
  plagHaMincha: { he: 'פלג המנחה', en: 'Plag HaMincha' },
  sunset: { he: 'שקיעה', en: 'Sunset' },
  tzeit: { he: 'צאת הכוכבים', en: 'Tzeit HaKochavim' },
};

export { ZMANIM_LABELS };

const SettingsCalendar = ({ settings, onUpdate }) => {
  // Parse saved settings or use defaults
  const savedSettings = settings.calendarSettings?.value
    ? (typeof settings.calendarSettings.value === 'string'
      ? JSON.parse(settings.calendarSettings.value)
      : settings.calendarSettings.value)
    : DEFAULT_CALENDAR_SETTINGS;

  const [calSettings, setCalSettings] = useState({ ...DEFAULT_CALENDAR_SETTINGS, ...savedSettings });
  const [isDirty, setIsDirty] = useState(false);

  const updateField = (field, value) => {
    setCalSettings(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
  };

  const updateZman = (key, enabled) => {
    setCalSettings(prev => ({
      ...prev,
      zmanimToShow: { ...prev.zmanimToShow, [key]: enabled },
    }));
    setIsDirty(true);
  };

  const handleSave = async () => {
    try {
      await onUpdate({ key: 'calendarSettings', value: JSON.stringify(calSettings) });
      setIsDirty(false);
      toast({ title: 'Calendar settings saved!' });
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-bold mb-1">Calendar Settings</h2>
      <p className="text-muted-foreground mb-6">Configure Jewish calendar, Hebrew dates, and zmanim display.</p>

      {/* ── Section 1: Jewish Calendar Toggle ── */}
      <div className="bg-card border rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-primary" />
            <div>
              <h3 className="font-semibold">Jewish Calendar</h3>
              <p className="text-sm text-muted-foreground">Show Hebrew dates and holidays on the calendar</p>
            </div>
          </div>
          <button
            onClick={() => updateField('enableJewishCalendar', !calSettings.enableJewishCalendar)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              calSettings.enableJewishCalendar ? 'bg-primary' : 'bg-muted'
            }`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              calSettings.enableJewishCalendar ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>
      </div>

      {calSettings.enableJewishCalendar && (
        <>
          {/* ── Section 2: Hebrew Month Names ── */}
          <div className="bg-card border rounded-xl p-5 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold text-primary">א</span>
                <div>
                  <h3 className="font-semibold">Hebrew Month Names</h3>
                  <p className="text-sm text-muted-foreground">
                    {calSettings.hebrewMonthNames
                      ? 'Currently showing: כ״ה שבט'
                      : "Currently showing: Sh'vat כ״ה"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => updateField('hebrewMonthNames', !calSettings.hebrewMonthNames)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  calSettings.hebrewMonthNames ? 'bg-primary' : 'bg-muted'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  calSettings.hebrewMonthNames ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>
          </div>

          {/* ── Section 3: Zmanim ── */}
          <div className="bg-card border rounded-xl p-5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-primary" />
                <div>
                  <h3 className="font-semibold">Zmanim (Halachic Times)</h3>
                  <p className="text-sm text-muted-foreground">Show daily halachic times in the sidebar</p>
                </div>
              </div>
              <button
                onClick={() => updateField('enableZmanim', !calSettings.enableZmanim)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  calSettings.enableZmanim ? 'bg-primary' : 'bg-muted'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  calSettings.enableZmanim ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>

            {calSettings.enableZmanim && (
              <div className="grid grid-cols-2 gap-2 mt-4 border-t pt-4">
                {Object.entries(ZMANIM_LABELS).map(([key, label]) => (
                  <label
                    key={key}
                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition"
                  >
                    <input
                      type="checkbox"
                      checked={calSettings.zmanimToShow[key] || false}
                      onChange={(e) => updateZman(key, e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <span className="text-sm" dir="rtl">{label.he}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{label.en}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* ── Section 4: Candle Lighting ── */}
          <div className="bg-card border rounded-xl p-5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Flame className="w-5 h-5 text-orange-500" />
                <div>
                  <h3 className="font-semibold">Candle Lighting</h3>
                  <p className="text-sm text-muted-foreground">Show candle lighting time for Shabbat and holidays</p>
                </div>
              </div>
              <button
                onClick={() => updateField('enableCandleLighting', !calSettings.enableCandleLighting)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  calSettings.enableCandleLighting ? 'bg-primary' : 'bg-muted'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  calSettings.enableCandleLighting ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>

            {calSettings.enableCandleLighting && (
              <div className="flex items-center gap-4 border-t pt-4">
                <Label className="text-sm whitespace-nowrap">Minutes before sunset:</Label>
                <Input
                  type="number"
                  min={0}
                  max={60}
                  value={calSettings.candleLightingMinutes}
                  onChange={(e) => updateField('candleLightingMinutes', parseInt(e.target.value) || 18)}
                  className="w-24"
                />
                <span className="text-xs text-muted-foreground">({calSettings.candleLightingMinutes} min before שקיעה)</span>
              </div>
            )}
          </div>

          {/* ── Section 5: Havdalah / Tzeit Shitot ── */}
          <div className="bg-card border rounded-xl p-5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Moon className="w-5 h-5 text-indigo-500" />
                <div>
                  <h3 className="font-semibold">הבדלה / צאת הכוכבים</h3>
                  <p className="text-sm text-muted-foreground">Choose your שיטה for tzeit hakochavim</p>
                </div>
              </div>
              <button
                onClick={() => updateField('enableHavdalah', !calSettings.enableHavdalah)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  calSettings.enableHavdalah ? 'bg-primary' : 'bg-muted'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  calSettings.enableHavdalah ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>

            {calSettings.enableHavdalah && (
              <div className="border-t pt-4 space-y-2">
                {TZEITOT.map((shita) => (
                  <label
                    key={shita.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${
                      calSettings.havdalahShita === shita.id
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : 'border-transparent hover:bg-muted/50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="havdalahShita"
                      value={shita.id}
                      checked={calSettings.havdalahShita === shita.id}
                      onChange={() => updateField('havdalahShita', shita.id)}
                      className="w-4 h-4 text-primary focus:ring-primary"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm" dir="rtl">{shita.he}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{shita.desc}</p>
                    </div>
                  </label>
                ))}

                {calSettings.havdalahShita === 'custom' && (
                  <div className="flex items-center gap-4 pl-7 pt-2">
                    <Label className="text-sm whitespace-nowrap">Minutes after sunset:</Label>
                    <Input
                      type="number"
                      min={15}
                      max={90}
                      value={calSettings.havdalahCustomMinutes}
                      onChange={(e) => updateField('havdalahCustomMinutes', parseInt(e.target.value) || 42)}
                      className="w-24"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Section 6: Time Format ── */}
          <div className="bg-card border rounded-xl p-5 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <Clock className="w-5 h-5 text-primary" />
              <div>
                <h3 className="font-semibold">Time Format</h3>
                <p className="text-sm text-muted-foreground">How zmanim and Shabbat times are displayed</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => updateField('timeFormat', '12h')}
                className={`flex-1 p-3 rounded-lg border text-center transition ${
                  calSettings.timeFormat === '12h'
                    ? 'border-primary bg-primary/5 ring-1 ring-primary font-semibold'
                    : 'hover:bg-muted/50'
                }`}
              >
                <span className="text-lg">5:42 PM</span>
                <p className="text-xs text-muted-foreground mt-1">12-hour</p>
              </button>
              <button
                onClick={() => updateField('timeFormat', '24h')}
                className={`flex-1 p-3 rounded-lg border text-center transition ${
                  calSettings.timeFormat === '24h'
                    ? 'border-primary bg-primary/5 ring-1 ring-primary font-semibold'
                    : 'hover:bg-muted/50'
                }`}
              >
                <span className="text-lg">17:42</span>
                <p className="text-xs text-muted-foreground mt-1">24-hour</p>
              </button>
            </div>
          </div>
        </>
      )}

      {/* Save Button */}
      <Button onClick={handleSave} disabled={!isDirty} className="w-full sm:w-auto">
        Save Calendar Settings
      </Button>
    </div>
  );
};

export default SettingsCalendar;
