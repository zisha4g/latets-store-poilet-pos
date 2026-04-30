import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Clock,
  Hash,
  Mic,
} from 'lucide-react';
import {
  callCounterparty,
  callTalkSeconds,
  formatDurationShort,
  formatPhone,
  statusLabel,
  statusTone,
} from './callFormat';

const Row = ({ label, children }) => (
  <div className="grid grid-cols-3 gap-2 py-2 border-b last:border-b-0 text-sm">
    <span className="text-muted-foreground">{label}</span>
    <span className="col-span-2 font-medium break-all">{children}</span>
  </div>
);

const CallLogDetailsDialog = ({ log, open, onOpenChange }) => {
  if (!log) return null;

  const isOutbound = log.direction === 'outbound';
  const Icon = log.status === 'missed' || log.status === 'no-answer' || log.status === 'failed'
    ? PhoneMissed
    : isOutbound
      ? PhoneOutgoing
      : PhoneIncoming;

  const counterparty = callCounterparty(log);
  const talk = callTalkSeconds(log);
  const totalLeg = Number(log.duration_seconds) || 0;
  const ringSeconds = log.answered_at && log.started_at
    ? Math.max(0, Math.round(
        (new Date(log.answered_at).getTime() - new Date(log.started_at).getTime()) / 1000,
      ))
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5" />
            <span>{counterparty || 'Unknown'}</span>
          </DialogTitle>
          <DialogDescription>
            {isOutbound ? 'Outbound call' : 'Inbound call'}
            {' · '}
            <span className={statusTone(log.status)}>{statusLabel(log.status)}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2">
          <Row label="From">
            {log.from_number ? formatPhone(log.from_number) : '—'}
          </Row>
          <Row label="To">
            {log.to_number ? formatPhone(log.to_number) : '—'}
          </Row>
          <Row label="Status">
            <Badge variant="outline" className={statusTone(log.status)}>
              {statusLabel(log.status)}
            </Badge>
          </Row>
          <Row label="Started">
            {log.started_at
              ? new Date(log.started_at).toLocaleString()
              : new Date(log.created_at).toLocaleString()}
          </Row>
          {log.answered_at && (
            <Row label="Answered">
              {new Date(log.answered_at).toLocaleString()}
            </Row>
          )}
          {log.ended_at && (
            <Row label="Ended">
              {new Date(log.ended_at).toLocaleString()}
            </Row>
          )}
          {ringSeconds !== null && (
            <Row label="Rang for">
              {formatDurationShort(ringSeconds)}
            </Row>
          )}
          <Row label="Talk time">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {formatDurationShort(talk)}
            </span>
          </Row>
          {totalLeg > 0 && totalLeg !== talk && (
            <Row label="Total leg">
              {formatDurationShort(totalLeg)}
            </Row>
          )}
          {log.recording_url && (
            <Row label="Recording">
              <a
                href={log.recording_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                <Mic className="h-3.5 w-3.5" />
                Open recording
              </a>
            </Row>
          )}
          {log.signalwire_call_sid && (
            <Row label="Call SID">
              <span className="inline-flex items-center gap-1 font-mono text-xs">
                <Hash className="h-3 w-3" />
                {log.signalwire_call_sid}
              </span>
            </Row>
          )}
          {log.notes && <Row label="Notes">{log.notes}</Row>}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CallLogDetailsDialog;
