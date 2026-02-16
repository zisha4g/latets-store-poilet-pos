import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PhoneIncoming, PhoneCall, PhoneMissed, Clock } from 'lucide-react';

const PbxDashboard = ({ pbxData, onSimulateCall }) => {
  const { callLogs } = pbxData;

  const totalCalls = callLogs.length;
  const inboundCalls = callLogs.filter(c => c.direction === 'inbound').length;
  const outboundCalls = callLogs.filter(c => c.direction === 'outbound').length;
  const missedCalls = callLogs.filter(c => c.status === 'missed' || c.status === 'declined').length;
  const totalDuration = callLogs.reduce((acc, c) => acc + (c.duration_seconds || 0), 0);
  const avgDuration = totalCalls > 0 ? (totalDuration / totalCalls) : 0;

  const formatDuration = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return [
      h > 0 ? `${h}h` : '',
      m > 0 ? `${m}m` : '',
      s > 0 ? `${s}s` : ''
    ].filter(Boolean).join(' ') || '0s';
  };

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
            <CardTitle className="text-sm font-medium">Avg. Call Duration</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatDuration(avgDuration)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Calls</CardTitle>
          <CardDescription>Your last 5 calls.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {callLogs.slice(0, 5).map(log => (
              <div key={log.id} className="flex items-center">
                <div className="ml-4 space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {log.customers?.name || log.phone_number}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {log.direction} - {log.status} - {formatDuration(log.duration_seconds)}
                  </p>
                </div>
                <div className="ml-auto font-medium">{new Date(log.created_at).toLocaleTimeString()}</div>
              </div>
            ))}
            {callLogs.length === 0 && <p className="text-center text-muted-foreground">No calls logged yet.</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PbxDashboard;