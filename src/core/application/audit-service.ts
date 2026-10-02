import type { AuditEntryInput } from "../domain/audit/audit-entry";
import type { AuditRepository } from "./ports/audit-repository";

export interface AuditLogger {
  record(entry: AuditEntryInput): Promise<void>;
}

/** Never throws: an audit failure must not break the business flow. */
export class AuditService implements AuditLogger {
  constructor(
    private readonly repo: AuditRepository,
    private readonly onError: (err: unknown) => void = () => {},
  ) {}

  async record(entry: AuditEntryInput): Promise<void> {
    try {
      await this.repo.append(entry);
    } catch (err) {
      this.onError(err);
    }
  }
}
