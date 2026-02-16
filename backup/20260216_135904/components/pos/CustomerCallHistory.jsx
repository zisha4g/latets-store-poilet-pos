import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';

const CustomerCallHistory = ({ callLogs }) => {
  const formatDuration = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      <div className="border rounded-lg h-full flex flex-col">
        <div className="grid grid-cols-5 p-3 font-semibold border-b bg-muted/50">
          <span>Date</span>
          <span>Direction</span>
          <span>Status</span>
          <span>Duration</span>
          <span>Notes</span>
        </div>
        <ScrollArea className="h-64">
          {callLogs.map(log => (
            <div key={log.id} className="grid grid-cols-5 p-3 border-b last:border-b-0 text-sm">
              <span>{new Date(log.created_at).toLocaleString()}</span>
              <span className="capitalize">{log.direction}</span>
              <span className="capitalize">{log.status}</span>
              <span>{formatDuration(log.duration_seconds)}</span>
              <span className="text-muted-foreground italic truncate">{log.notes || 'No notes'}</span>
            </div>
          ))}
          {callLogs.length === 0 && (
            <p className="p-4 text-center text-muted-foreground">No call history for this customer.</p>
          )}
        </ScrollArea>
      </div>
    </div>
  );
};

export default CustomerCallHistory;