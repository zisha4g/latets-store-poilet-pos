import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { getHolidayColor } from '@/hooks/useHebrewCalendar';

const HEBREW_GREGORIAN_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
];

const CalendarGrid = ({ appointments = [], tasks = [], selectedDate, onSelectDate, onSelectAppointment, onSelectTask, hebrewCal, currentMonth, onMonthChange }) => {

  const getDaysInMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const daysInMonth = getDaysInMonth(currentMonth);
  const firstDay = getFirstDayOfMonth(currentMonth);
  const days = [];

  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }

  for (let i = 1; i <= daysInMonth; i++) {
    days.push(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i));
  }

  const eventsForDate = (date) => {
    if (!date) return { appointments: [], tasks: [] };
    const dateStr = date.toISOString().split('T')[0];
    const apts = appointments.filter(apt => apt.date?.split('T')[0] === dateStr || apt.date?.split(' ')[0] === dateStr);
    const tsk = tasks.filter(task => task.due_date?.split('T')[0] === dateStr || task.due_date?.split(' ')[0] === dateStr);
    return { appointments: apts, tasks: tsk };
  };

  const isToday = (date) => {
    const today = new Date();
    return date && date.toDateString() === today.toDateString();
  };

  const isSelected = (date) => {
    return date && date.toDateString() === selectedDate.toDateString();
  };

  const handlePrevMonth = () => {
    onMonthChange(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const handleNextMonth = () => {
    onMonthChange(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  return (
    <div className="h-full flex flex-col bg-card rounded-xl border shadow-sm">
      {/* Header */}
      <div className="flex justify-between items-center px-6 py-4 border-b">
        <h3 className="font-bold text-xl">
          {hebrewCal?.parsedSettings?.hebrewMonthNames !== false
            ? `${HEBREW_GREGORIAN_MONTHS[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`
            : currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
          }
        </h3>
        <div className="flex gap-1">
          <Button variant="outline" size="sm" onClick={handlePrevMonth} className="h-9 w-9 p-0">
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => onMonthChange(new Date())} className="h-9 px-3 text-sm">
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={handleNextMonth} className="h-9 w-9 p-0">
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Weekdays */}
      <div className="grid grid-cols-7 border-b">
        {(hebrewCal?.parsedSettings?.hebrewMonthNames !== false
          ? ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
          : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Shabbat']
        ).map((day, i) => (
          <div key={day} className={`text-center font-semibold text-sm py-3 ${
            i === 6 ? 'text-indigo-600 bg-indigo-50/50' : 'text-muted-foreground'
          }`}>
            {day}
          </div>
        ))}
      </div>

      {/* Days */}
      <div className="grid grid-cols-7 flex-1 auto-rows-fr">
        {days.map((date, index) => {
          if (!date) {
            return <div key={`empty-${index}`} className="bg-muted/20 border-b border-r" />;
          }

          const { appointments: dayApts, tasks: dayTasks } = eventsForDate(date);
          const today = isToday(date);
          const selected = isSelected(date);

          // Hebrew calendar data
          const jewishCalEnabled = hebrewCal?.parsedSettings?.enableJewishCalendar !== false;
          const hebrewDate = jewishCalEnabled ? hebrewCal?.getHebrewDateShort(date) : '';
          const holidays = jewishCalEnabled ? (hebrewCal?.getHolidaysForDate(date) || []) : [];
          const isSaturday = date.getDay() === 6;
          const hasHoliday = holidays.some(ev => {
            const m = ev.getFlags();
            return (m & 0x1); // CHAG flag
          });

          return (
            <button
              key={date.toISOString()}
              onClick={() => onSelectDate(date)}
              className={`p-2 border-b border-r transition-colors text-left flex flex-col overflow-hidden relative ${
                selected
                  ? 'bg-primary/10 ring-2 ring-inset ring-primary'
                  : today
                  ? 'bg-green-50/70'
                  : hasHoliday
                  ? 'bg-red-50/40'
                  : isSaturday
                  ? 'bg-indigo-50/30'
                  : 'hover:bg-muted/40'
              }`}
            >
              {/* Date header */}
              <div className="flex justify-between items-center w-full mb-1">
                <span className={`text-sm font-bold leading-none ${
                  today
                    ? 'bg-primary text-white rounded-full w-7 h-7 flex items-center justify-center'
                    : selected
                    ? 'text-primary'
                    : 'text-foreground'
                }`}>
                  {date.getDate()}
                </span>
                <span className="text-[11px] text-muted-foreground font-medium" dir="rtl">
                  {hebrewDate}
                </span>
              </div>

              {/* Jewish holidays */}
              {holidays.length > 0 && (
                <div className="space-y-0.5 w-full">
                  {holidays.slice(0, 2).map((ev, i) => {
                    const colors = getHolidayColor(ev);
                    const name = ev.render('he') || ev.render();
                    return (
                      <div
                        key={`h-${i}`}
                        className={`w-full ${colors.bg} ${colors.text} rounded-md px-1.5 py-0.5 truncate text-[11px] font-semibold`}
                        dir="rtl"
                        title={name}
                      >
                        {name}
                      </div>
                    );
                  })}
                  {holidays.length > 2 && (
                    <p className="text-[10px] text-muted-foreground px-1">+{holidays.length - 2} more</p>
                  )}
                </div>
              )}

              {/* Appointments & tasks */}
              {(dayApts.length > 0 || dayTasks.length > 0) && (
                <div className="space-y-0.5 mt-auto w-full pt-1">
                  {dayApts.slice(0, 1).map(apt => (
                  <div
                    key={apt.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectAppointment(apt);
                    }}
                    className="w-full bg-blue-100 text-blue-800 rounded-md px-1.5 py-0.5 truncate text-left text-[11px] font-medium hover:bg-blue-200 cursor-pointer"
                    title={apt.title}
                  >
                    {apt.title.substring(0, 15)}
                  </div>
                ))}
                {dayApts.length > 1 && (
                  <p className="text-blue-600 text-[10px] px-1">+{dayApts.length - 1} more</p>
                )}
                {dayTasks.slice(0, 1).map(task => (
                  <div
                    key={task.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectTask(task);
                    }}
                    className={`w-full rounded-md px-1.5 py-0.5 truncate text-left text-[11px] font-medium cursor-pointer ${
                      task.status === 'completed'
                        ? 'bg-green-100 text-green-800 hover:bg-green-200 line-through'
                        : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                    }`}
                    title={task.title}
                  >
                    {task.title.substring(0, 15)}
                  </div>
                ))}
                {dayTasks.length > 1 && (
                  <p className={`text-[10px] px-1 ${dayTasks[0].status === 'completed' ? 'text-green-600' : 'text-yellow-600'}`}>
                    +{dayTasks.length - 1} more
                  </p>
                )}
              </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CalendarGrid;
