import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const CalendarGrid = ({ appointments = [], tasks = [], selectedDate, onSelectDate, onSelectAppointment, onSelectTask }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());

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
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  return (
    <div className="h-full flex flex-col bg-card rounded-lg border p-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-lg">
          {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </h3>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={handlePrevMonth}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleNextMonth}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Weekdays */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="text-center font-semibold text-sm text-muted-foreground py-2">
            {day}
          </div>
        ))}
      </div>

      {/* Days */}
      <div className="grid grid-cols-7 gap-1 flex-1">
        {days.map((date, index) => {
          if (!date) {
            return <div key={`empty-${index}`} className="bg-muted/30 rounded" />;
          }

          const { appointments: dayApts, tasks: dayTasks } = eventsForDate(date);
          const today = isToday(date);
          const selected = isSelected(date);

          return (
            <button
              key={date.toISOString()}
              onClick={() => onSelectDate(date)}
              className={`p-2 rounded border-2 transition text-left flex flex-col overflow-hidden ${
                selected
                  ? 'border-primary bg-primary/10'
                  : today
                  ? 'border-green-500 bg-green-50'
                  : 'border-transparent hover:border-muted-foreground/50 hover:bg-muted/50'
              }`}
            >
              <span className={`text-xs font-semibold ${selected || today ? 'text-primary' : 'text-muted-foreground'}`}>
                {date.getDate()}
              </span>
              <div className="text-xs space-y-0.5 mt-1">
                {dayApts.slice(0, 1).map(apt => (
                  <div
                    key={apt.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectAppointment(apt);
                    }}
                    className="w-full bg-blue-100 text-blue-800 rounded px-1 py-0.5 truncate text-left hover:bg-blue-200 cursor-pointer"
                    title={apt.title}
                  >
                    {apt.title.substring(0, 10)}
                  </div>
                ))}
                {dayApts.length > 1 && (
                  <p className="text-blue-600 text-xs px-1">+{dayApts.length - 1} more</p>
                )}
                {dayTasks.slice(0, 1).map(task => (
                  <div
                    key={task.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectTask(task);
                    }}
                    className={`w-full rounded px-1 py-0.5 truncate text-left text-xs cursor-pointer ${
                      task.status === 'completed'
                        ? 'bg-green-100 text-green-800 hover:bg-green-200 line-through'
                        : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                    }`}
                    title={task.title}
                  >
                    {task.title.substring(0, 10)}
                  </div>
                ))}
                {dayTasks.length > 1 && (
                  <p className={`text-xs px-1 ${dayTasks[0].status === 'completed' ? 'text-green-600' : 'text-yellow-600'}`}>
                    +{dayTasks.length - 1} more
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CalendarGrid;
