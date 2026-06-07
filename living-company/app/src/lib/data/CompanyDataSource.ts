import type { Agent, OfficeEvent, Room } from '@/lib/domain/types';

/**
 * The single seam between the office UI and whatever is driving the company.
 * `MockCompanyAdapter` implements this now; `PaperclipAdapter` will implement it
 * later against the self-hosted Paperclip API — the UI never has to change.
 */
export interface CompanyDataSource {
  getAgents(): Promise<Agent[]>;
  getRooms(): Promise<Room[]>;
  /** Kick off a project; the resulting collaboration arrives via `events()`. */
  startProject(brief: string): Promise<{ projectId: string }>;
  /** A live stream of everything happening in the office. */
  events(): AsyncIterable<OfficeEvent>;
  /** Stop any scheduled work and release the event stream. */
  dispose?(): void;
}
