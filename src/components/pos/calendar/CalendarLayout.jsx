import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Calendar, Plus, CheckCircle, Clock, AlertCircle, Edit, Star, Sunset, Sun } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import CalendarGrid from './CalendarGrid';
import WeeklyView from './WeeklyView';
import AppointmentModal from './AppointmentModal';
import TaskModal from './TaskModal';
import TaskList from './TaskList';
import useHebrewCalendar, { getHolidayColor, getHolidayCategoryLabel } from '@/hooks/useHebrewCalendar';
import { ZMANIM_LABELS } from '@/components/pos/settings/SettingsCalendar';

const HEBREW_WEEKDAYS = ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי', 'שבת'];
const HEBREW_GREG_MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

const CalendarLayout = ({ appointments = [], tasks = [], handlers = {}, refreshData, calendarSettings }) => {
  const [activeTab, setActiveTab] = useState('calendar');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date()); // Lifted from CalendarGrid so hook year stays in sync
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [newAppointmentTime, setNewAppointmentTime] = useState(null); // For weekly view
  
  // Local state for surgical updates - avoid full refreshes
  const [localAppointments, setLocalAppointments] = useState(appointments);
  const [localTasks, setLocalTasks] = useState(tasks);

  // Hebrew calendar (local computation, no API) — use currentMonth's year so navigation updates events
  const hebrewCal = useHebrewCalendar(currentMonth.getFullYear(), null, calendarSettings);

  // Parse calendar settings for conditional rendering
  const calSettings = hebrewCal.parsedSettings || {};
  const jewishCalEnabled = calSettings.enableJewishCalendar !== false;
  const zmanimEnabled = jewishCalEnabled && calSettings.enableZmanim !== false;
  const candleLightingEnabled = jewishCalEnabled && calSettings.enableCandleLighting !== false;
  const havdalahEnabled = jewishCalEnabled && calSettings.enableHavdalah !== false;
  
  // Sync with parent props when they change
  React.useEffect(() => {
    setLocalAppointments(appointments);
  }, [appointments]);
  
  React.useEffect(() => {
    setLocalTasks(tasks);
  }, [tasks]);

  // Get appointments for selected date
  const appointmentsForDate = useMemo(() => {
    const dateStr = selectedDate.toISOString().split('T')[0];
    return localAppointments.filter(apt => 
      apt.date?.split('T')[0] === dateStr || apt.date?.split(' ')[0] === dateStr
    );
  }, [localAppointments, selectedDate]);

  // Get tasks for selected date
  const tasksForDate = useMemo(() => {
    const dateStr = selectedDate.toISOString().split('T')[0];
    return localTasks.filter(task => 
      task.due_date?.split('T')[0] === dateStr || task.due_date?.split(' ')[0] === dateStr
    );
  }, [localTasks, selectedDate]);

  // Calculate task statistics
  const taskStats = useMemo(() => {
    const completed = localTasks.filter(t => t.status === 'completed').length;
    const pending = localTasks.filter(t => t.status === 'pending').length;
    const overdue = localTasks.filter(t => {
      if (t.status === 'completed') return false;
      const dueDate = new Date(t.due_date);
      return dueDate < new Date();
    }).length;

    return { completed, pending, overdue, total: localTasks.length };
  }, [localTasks]);

  const handleSaveAppointment = async (appointmentData) => {
    try {
      if (selectedAppointment?.id) {
        // Editing existing appointment - update locally
        await handlers.appointments?.update(appointmentData);
        toast({ title: 'Success', description: 'Appointment updated' });
        // Surgical update: replace the updated appointment in local state
        setLocalAppointments(prev => 
          prev.map(apt => apt.id === appointmentData.id ? appointmentData : apt)
        );
      } else {
        // Creating new appointment
        const result = await handlers.appointments?.add(appointmentData);
        toast({ title: 'Success', description: 'Appointment created' });
        // Surgical update: add new appointment to local state
        if (result) {
          setLocalAppointments(prev => [...prev, result]);
        }
      }
      setIsAppointmentModalOpen(false);
      setSelectedAppointment(null);
    } catch (error) {
      console.error('Error saving appointment:', error);
      toast({ title: 'Error', description: error.message || 'Failed to save appointment', variant: 'destructive' });
    }
  };

  const handleSaveTask = async (taskData) => {
    try {
      if (taskData?.id) {
        // Editing existing task - update locally
        await handlers.tasks?.update(taskData);
        toast({ title: 'Success', description: 'Task updated' });
        // Surgical update: replace the updated task in local state
        setLocalTasks(prev => 
          prev.map(task => task.id === taskData.id ? taskData : task)
        );
      } else {
        // Creating new task - don't include ID
        const result = await handlers.tasks?.add(taskData);
        toast({ title: 'Success', description: 'Task created' });
        // Surgical update: add new task to local state
        if (result) {
          setLocalTasks(prev => [...prev, result]);
        }
      }
      setIsTaskModalOpen(false);
      setSelectedTask(null);
    } catch (error) {
      console.error('Error saving task:', error);
      toast({ title: 'Error', description: error.message || 'Failed to save task', variant: 'destructive' });
    }
  };

  const handleDeleteAppointment = async (id) => {
    if (window.confirm('Are you sure you want to delete this appointment?')) {
      try {
        await handlers.appointments?.delete(id);
        setSelectedAppointment(null);
        toast({ title: 'Success', description: 'Appointment deleted' });
        // Surgical update: remove deleted appointment from local state
        setLocalAppointments(prev => prev.filter(apt => apt.id !== id));
      } catch (error) {
        console.error('Error deleting appointment:', error);
        toast({ title: 'Error', description: error.message || 'Failed to delete appointment', variant: 'destructive' });
      }
    }
  };

  const handleDeleteTask = async (id) => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      try {
        await handlers.tasks?.delete(id);
        setSelectedTask(null);
        toast({ title: 'Success', description: 'Task deleted' });
        // Surgical update: remove deleted task from local state
        setLocalTasks(prev => prev.filter(task => task.id !== id));
      } catch (error) {
        console.error('Error deleting task:', error);
        toast({ title: 'Error', description: error.message || 'Failed to delete task', variant: 'destructive' });
      }
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden p-4 bg-card/5">
      {/* Header */}
      <div className="flex-none mb-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Calendar & Tasks</h2>
          <div className="flex gap-2">
            <Button 
              onClick={() => {
                setSelectedAppointment(null);
                setIsAppointmentModalOpen(true);
              }}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              New Appointment
            </Button>
            <Button 
              variant="outline"
              onClick={() => {
                setSelectedTask(null);
                setIsTaskModalOpen(true);
              }}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              New Task
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Tasks</p>
                  <h3 className="text-2xl font-bold mt-2">{taskStats.total}</h3>
                </div>
                <Calendar className="w-8 h-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <h3 className="text-2xl font-bold mt-2 text-blue-600">{taskStats.pending}</h3>
                </div>
                <Clock className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Completed</p>
                  <h3 className="text-2xl font-bold mt-2 text-green-600">{taskStats.completed}</h3>
                </div>
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Overdue</p>
                  <h3 className="text-2xl font-bold mt-2 text-red-600">{taskStats.overdue}</h3>
                </div>
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <TabsList>
          <TabsTrigger value="calendar">
            <Calendar className="w-4 h-4 mr-2" />
            Month View
          </TabsTrigger>
          <TabsTrigger value="week">
            <Calendar className="w-4 h-4 mr-2" />
            Week View
          </TabsTrigger>
          <TabsTrigger value="tasks">
            <CheckCircle className="w-4 h-4 mr-2" />
            Tasks
          </TabsTrigger>
          <TabsTrigger value="appointments">
            <Clock className="w-4 h-4 mr-2" />
            Appointments
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calendar" className="flex-1 overflow-hidden">
          <div className="grid grid-cols-4 gap-4 h-full">
            <div className="col-span-3 overflow-auto">
              <CalendarGrid 
                appointments={localAppointments}
                tasks={localTasks}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                currentMonth={currentMonth}
                onMonthChange={setCurrentMonth}
                onSelectAppointment={(apt) => {
                  setSelectedAppointment(apt);
                  setIsAppointmentModalOpen(true);
                }}
                onSelectTask={(task) => {
                  setSelectedTask(task);
                  setIsTaskModalOpen(true);
                }}
                hebrewCal={hebrewCal}
              />
            </div>
            <div className="overflow-auto border-l pl-4">
              <h3 className="font-bold text-lg mb-1">
                {calSettings.hebrewMonthNames !== false
                  ? `${HEBREW_WEEKDAYS[selectedDate.getDay()]}, ${selectedDate.getDate()} ${HEBREW_GREG_MONTHS[selectedDate.getMonth()]}`
                  : selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
                }
              </h3>

              {/* Hebrew date */}
              {jewishCalEnabled && (
              <p className="text-sm text-muted-foreground mb-3 font-medium" dir="rtl">
                📅 {hebrewCal.getHebrewDate(selectedDate)}
              </p>
              )}

              {/* Jewish holidays for selected date */}
              {jewishCalEnabled && (() => {
                const holidays = hebrewCal.getHolidaysForDate(selectedDate);
                if (holidays.length === 0) return null;
                // Pre-compute zmanim for overriding fast begin/end times
                const zmanimForFast = hebrewCal.getZmanim(selectedDate);
                return (
                  <div className="mb-4">
                    <h4 className="font-semibold text-sm text-muted-foreground mb-2">
                      <Star className="w-3.5 h-3.5 inline mr-1" />
                      לוח עברי
                    </h4>
                    <div className="space-y-2">
                      {holidays.map((ev, i) => {
                        const colors = getHolidayColor(ev);
                        const desc = ev.getDesc();
                        let hebrewName = ev.render('he') || ev.render();
                        // Override hebcal's fast begin/end times with our calculation
                        if (zmanimForFast) {
                          if (desc === 'Fast begins') {
                            hebrewName = `\u05ea\u05d7\u05d9\u05dc\u05ea \u05d4\u05e6\u05d5\u05dd: ${zmanimForFast.alotHaShachar}`;
                          } else if (desc === 'Fast ends') {
                            hebrewName = `\u05e1\u05d9\u05d5\u05dd \u05d4\u05e6\u05d5\u05dd: ${zmanimForFast.tzeit}`;
                          }
                        }
                        return (
                          <div key={`heb-${i}`} className={`p-2 rounded border ${colors.bg} ${colors.border}`} dir="rtl">
                            <div className="flex items-center justify-between gap-2">
                              <p className={`font-medium text-sm ${colors.text}`}>{hebrewName}</p>
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${colors.bg} ${colors.text} border ${colors.border} whitespace-nowrap`}>
                                {getHolidayCategoryLabel(ev)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Zmanim / Shabbat times */}
              {zmanimEnabled && (() => {
                const shabbatTimes = hebrewCal.getShabbatTimesForDate(selectedDate);
                const zmanim = hebrewCal.getZmanim(selectedDate);
                if (!zmanim && !shabbatTimes) return null;

                const isFriday = selectedDate.getDay() === 5;
                const isSaturday = selectedDate.getDay() === 6;

                // Filter zmanim based on settings
                const zmanimToShow = calSettings.zmanimToShow || { sunrise: true, chatzot: true, sunset: true };

                return (
                  <div className="mb-4">
                    <h4 className="font-semibold text-sm text-muted-foreground mb-2">
                      🕐 זמנים
                    </h4>
                    <div className="bg-amber-50 border border-amber-200 rounded p-2 text-xs space-y-1" dir="rtl">
                      {zmanim && Object.entries(zmanimToShow).filter(([_, show]) => show).map(([key]) => {
                        if (!zmanim[key]) return null;
                        const label = ZMANIM_LABELS[key];
                        return (
                          <div key={key} className="flex justify-between">
                            <span>{label?.he || key}</span>
                            <span className="font-mono">{zmanim[key]}</span>
                          </div>
                        );
                      })}
                      {shabbatTimes && (isFriday || isSaturday) && (
                        <>
                          <hr className="border-amber-300 my-1" />
                          <p className="font-semibold text-amber-800">🕯️ שבת</p>
                          {candleLightingEnabled && (
                            <div className="flex justify-between"><span>הדלקת נרות</span><span className="font-mono">{shabbatTimes.candleLighting}</span></div>
                          )}
                          <div className="flex justify-between"><span>שקיעה (ערב שבת)</span><span className="font-mono">{shabbatTimes.sunset}</span></div>
                          {havdalahEnabled && (
                            <div className="flex justify-between"><span>הבדלה</span><span className="font-mono">{shabbatTimes.havdalah}</span></div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })()}

              {appointmentsForDate.length > 0 && (
                <div className="mb-6">
                  <h4 className="font-semibold text-sm text-muted-foreground mb-2">Appointments</h4>
                  <div className="space-y-2">
                    {appointmentsForDate.map(apt => (
                      <button
                        key={apt.id}
                        onClick={() => {
                          setSelectedAppointment(apt);
                          setIsAppointmentModalOpen(true);
                        }}
                        className="w-full text-left p-2 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 transition"
                      >
                        <p className="font-medium text-sm">{apt.title}</p>
                        <p className="text-xs text-muted-foreground">{apt.time || 'All day'}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {tasksForDate.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm text-muted-foreground mb-2">Tasks</h4>
                  <div className="space-y-2">
                    {tasksForDate.map(task => (
                      <div
                        key={task.id}
                        className={`flex items-center justify-between p-2 border rounded ${
                          task.status === 'completed'
                            ? 'bg-green-50 border-green-200'
                            : 'bg-yellow-50 border-yellow-200'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className={`font-medium text-sm ${task.status === 'completed' ? 'line-through text-green-600' : ''}`}>{task.title}</p>
                          <p className="text-xs text-muted-foreground capitalize">{task.priority} priority</p>
                        </div>
                        <div className="flex gap-1 ml-2 flex-shrink-0">
                          {task.status !== 'completed' && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              className="h-7 px-2 text-green-600 hover:bg-green-100 hover:text-green-700"
                              onClick={() => handleSaveTask({...task, status: 'completed'})}
                              title="Mark done"
                            >
                              <CheckCircle className="w-3 h-3" />
                            </Button>
                          )}
                          <Button 
                            size="sm" 
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={() => {
                              setSelectedTask(task);
                              setIsTaskModalOpen(true);
                            }}
                            title="Edit"
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {appointmentsForDate.length === 0 && tasksForDate.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">No events for this day</p>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="week" className="flex-1 overflow-hidden">
          <WeeklyView 
            appointments={localAppointments}
            selectedDate={selectedDate}
            onDateSelect={setSelectedDate}
            onSelectAppointment={(apt) => {
              setSelectedAppointment(apt);
              setIsAppointmentModalOpen(true);
            }}
            onNewAppointment={(day, hour) => {
              setSelectedAppointment(null);
              setNewAppointmentTime({
                date: day.toISOString().split('T')[0],
                time: `${String(hour).padStart(2, '0')}:00`
              });
              setSelectedDate(day);
              setIsAppointmentModalOpen(true);
            }}
            hebrewCal={hebrewCal}
          />
        </TabsContent>

        <TabsContent value="tasks" className="flex-1 overflow-hidden">
          <TaskList 
            tasks={localTasks}
            onEditTask={(task) => {
              setSelectedTask(task);
              setIsTaskModalOpen(true);
            }}
            onDeleteTask={handleDeleteTask}
            onUpdateTask={handleSaveTask}
          />
        </TabsContent>

        <TabsContent value="appointments" className="flex-1 overflow-auto">
          <div className="grid gap-4">
            {localAppointments.length > 0 ? (
              localAppointments.map(apt => (
                <Card key={apt.id} className="cursor-pointer hover:shadow-md transition">
                  <CardContent className="pt-6">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold">{apt.title}</h3>
                        <p className="text-sm text-muted-foreground">{apt.description}</p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {new Date(apt.date).toLocaleDateString()} at {apt.time}
                        </p>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => {
                          setSelectedAppointment(apt);
                          setIsAppointmentModalOpen(true);
                        }}
                      >
                        Edit
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>No appointments scheduled</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Modals */}
      {isAppointmentModalOpen && (
        <AppointmentModal
          isOpen={isAppointmentModalOpen}
          onClose={() => {
            setIsAppointmentModalOpen(false);
            setSelectedAppointment(null);
            setNewAppointmentTime(null);
          }}
          appointment={selectedAppointment}
          selectedDate={selectedDate}
          onSave={handleSaveAppointment}
          onDelete={handleDeleteAppointment}
          allAppointments={localAppointments}
          newAppointmentTime={newAppointmentTime}
        />
      )}

      {isTaskModalOpen && (
        <TaskModal
          isOpen={isTaskModalOpen}
          onClose={() => {
            setIsTaskModalOpen(false);
            setSelectedTask(null);
          }}
          task={selectedTask}
          selectedDate={selectedDate}
          onSave={handleSaveTask}
          onDelete={handleDeleteTask}
        />
      )}
    </div>
  );
};

export default CalendarLayout;
