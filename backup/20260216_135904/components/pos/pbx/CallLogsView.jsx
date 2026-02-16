import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

const CallLogsView = ({ callLogs }) => {
  const formatDuration = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle>Call History</CardTitle>
        <CardDescription>Complete log of all inbound and outbound calls.</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow overflow-hidden">
        <div className="border rounded-lg h-full flex flex-col">
          <div className="grid grid-cols-6 p-3 font-semibold border-b bg-muted/50">
            <span>Date</span>
            <span>Time</span>
            <span>Number/Customer</span>
            <span>Direction</span>
            <span>Status</span>
            <span>Duration</span>
          </div>
          <ScrollArea className="flex-grow">
            {callLogs.map(log => (
              <div key={log.id} className="grid grid-cols-6 p-3 border-b last:border-b-0 text-sm">
                <span>{new Date(log.created_at).toLocaleDateString()}</span>
                <span>{new Date(log.created_at).toLocaleTimeString()}</span>
                <span className="font-medium">{log.customers?.name || log.phone_number}</span>
                <span className="capitalize">{log.direction}</span>
                <span className="capitalize">{log.status}</span>
                <span>{formatDuration(log.duration_seconds)}</span>
              </div>
            ))}
            {callLogs.length === 0 && (
              <p className="p-4 text-center text-muted-foreground">No call logs found.</p>
            )}
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
};

export default CallLogsView;