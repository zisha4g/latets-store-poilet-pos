import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  PhoneIncoming,
  PhoneOutgoing,
  PhoneCall,
  PhoneMissed,
  Clock,
} from 'lucide-react';
import {
  callCounterparty,
  callTalkSeconds,
  formatDurationShort,
  statusLabel,
  statusTone,
} from './callFormat';
import CallLogDetailsDialog from './CallLogDetailsDialog';

const PbxDashboard = ({ pbxData, onSimulateCall }) => {
  const { callLogs } = pbxData;
  const [selectedLog, setSelectedLog] = useState(null);

  const totalCalls = callLogs.length;
  const inboundCalls = callLogs.filter(c => c.direction === 'inbound').length;
  const outboundCalls = callLogs.filter(c => c.direction === 'outbound').length;
  const missedCalls = callLogs.filter(c =>
    ['missed', 'declined', 'no-answer', 'busy', 'failed', 'canceled'].includes(c.status)
  ).length;
  const totalDuration = callLogs.reduce((acc, c) => acc + callTalkSeconds(c), 0);
  const avgDuration = totalCalls > 0 ? Math.round(totalDuration / totalCalls) : 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-2xl font-bold">PBX Dashboard</h3>
          <p className="text-muted-foreground">Overview of your phone system activity.</p>
        </div>
        <Button onClick={onSimulateCall}>Simulate Incoming Call</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
            <PhoneCall className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCalls}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inbound / Outbound</CardTitle>
            <PhoneIncoming className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inboundCalls} / {outboundCalls}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Missed Calls</CardTitle>
            <PhoneMissed className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{missedCalls}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Talk Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatDurationShort(avgDuration)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Calls</CardTitle>
          <CardDescription>Your last 5 calls. Click a row for details.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {callLogs.slice(0, 5).map((log) => {
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
                  className="w-full flex items-center gap-3 py-3 px-2 text-left rounded-md hover:bg-muted/50 transition-colors"
                >
                  <Icon className={`h-5 w-5 shrink-0 ${statusTone(log.status)}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {callCounterparty(log) || 'Unknown'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <span className="capitalize">{log.direction}</span>
                      {' · '}
                      <span className={statusTone(log.status)}>{statusLabel(log.status)}</span>
                      {talk > 0 && <> {' · '} {formatDurationShort(talk)}</>}
                    </p>
                  </div>
                  <div className="text-xs text-muted-foreground shrink-0">
                    {when ? new Date(when).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </div>
                </button>
              );
            })}
            {callLogs.length === 0 && (
              <p className="text-center text-muted-foreground py-6">No calls logged yet.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <CallLogDetailsDialog
        log={selectedLog}
        open={!!selectedLog}
        onOpenChange={(open) => !open && setSelectedLog(null)}
      />
    </div>
  );
};

export default PbxDashboard;