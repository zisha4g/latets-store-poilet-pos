import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { PhoneIncoming, PhoneOutgoing, PhoneMissed, Search } from 'lucide-react';
import {
  callCounterparty,
  callTalkSeconds,
  formatDurationShort,
  statusLabel,
  statusTone,
} from './callFormat';
import CallLogDetailsDialog from './CallLogDetailsDialog';

const CallLogsView = ({ callLogs }) => {
  const [query, setQuery] = useState('');
  const [selectedLog, setSelectedLog] = useState(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return callLogs;
    const q = query.trim().toLowerCase();
    return callLogs.filter((log) => {
      const counterparty = (callCounterparty(log) || '').toLowerCase();
      return (
        counterparty.includes(q) ||
        (log.from_number || '').toLowerCase().includes(q) ||
        (log.to_number || '').toLowerCase().includes(q) ||
        (log.phone_number || '').toLowerCase().includes(q) ||
        (log.status || '').toLowerCase().includes(q) ||
        (log.direction || '').toLowerCase().includes(q)
      );
    });
  }, [callLogs, query]);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <CardTitle>Call History</CardTitle>
            <CardDescription>Complete log of all inbound and outbound calls.</CardDescription>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search number, status..."
              className="pl-8"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-grow overflow-hidden">
        <div className="border rounded-lg h-full flex flex-col">
          <div className="grid grid-cols-[2.5rem_1fr_8rem_8rem_6rem_5rem] gap-2 px-3 py-2 font-semibold border-b bg-muted/50 text-sm">
            <span></span>
            <span>Number / Customer</span>
            <span>Date</span>
            <span>Time</span>
            <span>Status</span>
            <span className="text-right">Duration</span>
          </div>
          <ScrollArea className="flex-grow">
            {filtered.map((log) => {
              const isOut = log.direction === 'outbound';
              const isFailed = ['missed', 'no-answer', 'failed', 'busy', 'canceled', 'declined'].includes(log.status);
              const Icon = isFailed ? PhoneMissed : isOut ? PhoneOutgoing : PhoneIncoming;
              const when = log.started_at || log.created_at;
              const talk = callTalkSeconds(log);
              return (
                <button
                  key={log.id}
                  type="button"
                  onClick={() => setSelectedLog(log)}
                  className="w-full grid grid-cols-[2.5rem_1fr_8rem_8rem_6rem_5rem] gap-2 px-3 py-2 border-b last:border-b-0 text-sm text-left hover:bg-muted/50 transition-colors items-center"
                >
                  <Icon className={`h-4 w-4 ${statusTone(log.status)}`} />
                  <span className="font-medium truncate">
                    {callCounterparty(log) || 'Unknown'}
                  </span>
                  <span className="text-muted-foreground">
                    {when ? new Date(when).toLocaleDateString() : ''}
                  </span>
                  <span className="text-muted-foreground">
                    {when ? new Date(when).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                  <span className={`capitalize ${statusTone(log.status)}`}>
                    {statusLabel(log.status)}
                  </span>
                  <span className="text-right tabular-nums">
                    {talk > 0 ? formatDurationShort(talk) : '—'}
                  </span>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="p-4 text-center text-muted-foreground">
                {callLogs.length === 0 ? 'No call logs found.' : 'No calls match your search.'}
              </p>
            )}
          </ScrollArea>
        </div>
      </CardContent>

      <CallLogDetailsDialog
        log={selectedLog}
        open={!!selectedLog}
        onOpenChange={(open) => !open && setSelectedLog(null)}
      />
    </Card>
  );
};

export default CallLogsView;