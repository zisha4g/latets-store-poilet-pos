import React from 'react';
import { useOutletContext } from 'react-router-dom';
import CalendarLayout from '@/components/pos/calendar/CalendarLayout';
import { Button } from '@/components/ui/button';

const CalendarPage = () => {
  const context = useOutletContext();

  if (!context) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center space-y-4">
        <p className="text-muted-foreground">Initializing calendar...</p>
        <Button variant="outline" onClick={() => window.location.reload()}>Reload</Button>
      </div>
    );
  }

  const {
    data = {},
    handlers = {},
    loading = false,
    error = null,
    refreshData,
  } = context;

  const { appointments = [], tasks = [], settings = {} } = data || {};

  if (loading && (!appointments || appointments.length === 0)) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg">Loading Calendar...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center max-w-md">
          <h2 className="text-xl font-bold text-destructive mb-2">Error</h2>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <CalendarLayout
      appointments={appointments}
      tasks={tasks}
      handlers={handlers}
      refreshData={refreshData}
      calendarSettings={settings.calendarSettings}
    />
  );
};

export default CalendarPage;
