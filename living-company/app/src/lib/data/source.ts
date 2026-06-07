import type { CompanyDataSource } from '@/lib/data/CompanyDataSource';
import { MockCompanyAdapter } from '@/lib/data/MockCompanyAdapter';
import { PaperclipAdapter } from '@/lib/data/PaperclipAdapter';

let instance: CompanyDataSource | null = null;

/**
 * The single company data source shared by the Phaser scene (which consumes its
 * event stream) and the React HUD (which calls `startProject`).
 *
 * `NEXT_PUBLIC_DATA_SOURCE=paperclip` switches the whole office onto a real,
 * self-hosted Paperclip company; anything else uses the simulated mock.
 */
export function getCompanySource(): CompanyDataSource {
  if (!instance) {
    instance =
      process.env.NEXT_PUBLIC_DATA_SOURCE === 'paperclip'
        ? new PaperclipAdapter()
        : new MockCompanyAdapter();
  }
  return instance;
}
