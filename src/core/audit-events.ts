import { hit, type HitInput } from './audit.js';

export type AuditEvent = HitInput;

export interface AuditSink {
  hit(event: AuditEvent): void;
}

export const writeAuditSink: AuditSink = {
  hit(event: AuditEvent): void {
    hit(event);
  },
};

export class CollectingAuditSink implements AuditSink {
  readonly events: AuditEvent[] = [];

  hit(event: AuditEvent): void {
    this.events.push(event);
  }
}

export function recordAuditHit(event: AuditEvent, sink: AuditSink = writeAuditSink): void {
  sink.hit(event);
}
