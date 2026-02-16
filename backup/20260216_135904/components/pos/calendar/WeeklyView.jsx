import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Clock, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const WeeklyView = ({ 
  appointments = [], 
  selectedDate = new Date(), 
  onDateSelect, 
  onSelectAppointment,
  onNewAppointment 
}) => {
  const [weekOffset, setWeekOffset] = useState(0);
  const scrollContainerRef = useRef(null);
  const [scrollPosition, setScrollPosition] = useState(0);
  const ROW_HEIGHT = 48; // px per hour row for better visibility

  const formatHour = (hour) => {
    const suffix = hour < 12 ? 'AM' : 'PM';
    const h = hour % 12 === 0 ? 12 : hour % 12;
    return `${h}:00 ${suffix}`;
  };

  // Calculate the start of the week (Sunday)
  const getWeekStart = (date, offset = 0) => {
    const d = new Date(date);
    d.setDate(d.getDate() - d.getDay() + (offset * 7));
    return d;
  };

  const weekStart = getWeekStart(selectedDate, weekOffset);
  const weekDays = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(weekStart);
    day.setDate(day.getDate() + i);
    weekDays.push(day);
  }

  // Generate hours (0-23)
  const hours = Array.from({ length: 24 }, (_, i) => i);

  // Get appointments for each day
  const appointmentsByDay = useMemo(() => {
    const result = {};
    weekDays.forEach(day => {
      const dateStr = day.toISOString().split('T')[0];
      result[dateStr] = appointments.filter(apt => 
        apt.date?.split('T')[0] === dateStr || apt.date?.split(' ')[0] === dateStr
      );
    });
    return result;
  }, [appointments, weekDays]);

  // Get appointments for a specific hour and day
  const getAppointmentsForHour = (day, hour) => {
    const dateStr = day.toISOString().split('T')[0];
    return (appointmentsByDay[dateStr] || []).filter(apt => {
      if (!apt.time) return false;
      const aptHour = parseInt(apt.time.split(':')[0]);
      return aptHour === hour;
    });
  };

  // Scroll to current hour on mount
  useEffect(() => {
    const now = new Date();
    const currentHour = now.getHours();
    if (scrollContainerRef.current) {
      const scrollTop = currentHour * ROW_HEIGHT; // Match our row height
      scrollContainerRef.current.scrollTop = scrollTop;
      setScrollPosition(scrollTop);
    }
  }, []);

  const handleScroll = () => {
    if (scrollContainerRef.current) {
      setScrollPosition(scrollContainerRef.current.scrollTop);
    }
  };

  const isToday = (date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isSelected = (date) => {
    return date.toDateString() === selectedDate.toDateString();
  };

  return (
    <div className="h-full flex flex-col bg-card rounded-lg border overflow-hidden">
      {/* Header with week navigation */}
      <div className="flex-none border-b p-4">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="font-bold text-lg">Week View</h3>
            <p className="text-sm text-muted-foreground">
              {weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {
                new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              }
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setWeekOffset(weekOffset - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                const today = new Date();
                setWeekOffset(0);
                onDateSelect(today);
              }}
            >
              Today
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setWeekOffset(weekOffset + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Header aligned with time gutter + 7 day columns */}
        <div className="grid grid-cols-8 gap-0 items-end">
          <div className="text-right pr-2 text-xs text-muted-foreground select-none">Time</div>
          {weekDays.map((day, index) => (
            <div key={index} className="text-center">
              <div className="text-xs font-semibold text-muted-foreground">
                {day.toLocaleDateString('en-US', { weekday: 'short' })}
              </div>
              <Button
                variant={isSelected(day) ? 'default' : isToday(day) ? 'outline' : 'ghost'}
                size="sm"
                className="w-full mt-1"
                onClick={() => onDateSelect(day)}
              >
                <span className={isToday(day) && !isSelected(day) ? 'font-bold' : ''}>
                  {day.getDate()}
                </span>
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Time grid container */}
      <div 
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overflow-x-hidden"
      >
        <div className="min-w-full">
          {/* Hours and appointments grid */}
          <div className="grid grid-cols-8 gap-0 border-collapse">
            {/* Time column */}
            <div className="col-span-1 bg-muted/30 border-r sticky left-0 z-10">
              <div style={{ height: ROW_HEIGHT }} /> {/* Header spacer */}
              {hours.map(hour => (
                <div 
                  key={hour} 
                  className="border-b px-2 py-1 text-xs font-semibold text-muted-foreground text-right pr-2"
                  style={{ height: ROW_HEIGHT }}
                >
                  {formatHour(hour)}
                </div>
              ))}
            </div>

            {/* Days grid */}
            {weekDays.map((day, dayIndex) => {
              const dateStr = day.toISOString().split('T')[0];
              return (
                <div
                  key={dayIndex}
                  className={`col-span-1 border-l relative ${
                    isToday(day) ? 'bg-blue-50/30' : 'bg-background'
                  }`}
                >
                  {/* Hour slots */}
                  {hours.map(hour => {
                    const appts = getAppointmentsForHour(day, hour);
                    return (
                      <div
                        key={`${dayIndex}-${hour}`}
                        className="border-b border-muted/30 p-1 hover:bg-muted/20 transition relative group"
                        style={{ height: ROW_HEIGHT }}
                      >
                        {/* Hour slot indicator line for current hour */}
                        {(() => {
                          const now = new Date();
                          if (
                            isToday(day) &&
                            now.getHours() === hour
                          ) {
                            return (
                              <div className="absolute top-0 left-0 right-0 h-0.5 bg-red-500 z-20" />
                            );
                          }
                        })()}

                        {/* Add appointment button */}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="opacity-0 group-hover:opacity-100 transition absolute right-1 top-1 w-6 h-6 p-0"
                          onClick={() => onNewAppointment(day, hour)}
                          title="Add appointment"
                        >
                          <Plus className="w-3 h-3" />
                        </Button>

                        {/* Appointments in this slot */}
                        <div className="space-y-1" style={{ marginTop: 6 }}>
                          {appts.map(apt => {
                            const aptEndHour = parseInt(apt.time.split(':')[0]) + (apt.duration || 1);
                            const overlap = appts.filter(a => a.id !== apt.id).length > 0;
                            
                            return (
                              <div
                                key={apt.id}
                                onClick={() => onSelectAppointment(apt)}
                                className={`text-xs p-1 rounded cursor-pointer truncate font-medium transition ${
                                  overlap
                                    ? 'bg-red-100 text-red-900 hover:bg-red-200'
                                    : 'bg-blue-100 text-blue-900 hover:bg-blue-200'
                                }`}
                                title={`${apt.title} - ${apt.time} (${apt.duration}h)`}
                              >
                                <Clock className="w-2.5 h-2.5 inline mr-0.5" />
                                {apt.title.substring(0, 12)}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer info */}
      <div className="flex-none border-t bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
        <p>💡 Click any hour slot to add an appointment • Scroll to see all hours • Overlapping appointments shown in red</p>
      </div>
    </div>
  );
};

export default WeeklyView;
