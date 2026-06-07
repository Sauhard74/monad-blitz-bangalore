'use client';

import { TopBar } from '@/components/hud/TopBar';
import { AgentRoster } from '@/components/hud/AgentRoster';
import { ActivityFeed } from '@/components/hud/ActivityFeed';
import { MemoryPanel } from '@/components/hud/MemoryPanel';
import { AgentDetailCard } from '@/components/hud/AgentDetailCard';
import { ProjectInput } from '@/components/hud/ProjectInput';
import { StandupButton } from '@/components/hud/StandupButton';
import { StandupPanel } from '@/components/hud/StandupPanel';
import { NewCompany } from '@/components/hud/NewCompany';
import { CompanyDashboard } from '@/components/hud/CompanyDashboard';
import { ProductPreview } from '@/components/hud/ProductPreview';
import { MonadEconomy } from '@/components/hud/MonadEconomy';

/**
 * The React HUD that floats over the Phaser canvas. The container ignores
 * pointer events so the world stays interactive; each panel re-enables them.
 */
export function Hud() {
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col gap-3 p-3">
      {/* Live mission-control screen anchored to the office's screen wall. */}
      <CompanyDashboard />

      <div className="flex justify-start">
        <TopBar />
      </div>

      <div className="flex min-h-0 flex-1 items-start justify-between gap-3">
        <div className="flex flex-col gap-3">
          <AgentRoster />
          <AgentDetailCard />
        </div>

        <div className="flex min-h-0 flex-col items-center gap-3">
          <StandupPanel />
        </div>

        <div className="flex min-h-0 flex-col gap-3">
          <ActivityFeed />
          <MemoryPanel />
          <MonadEconomy />
        </div>
      </div>

      <div className="flex items-end justify-center gap-3">
        <ProjectInput />
        <StandupButton />
        <ProductPreview />
        <NewCompany />
      </div>
    </div>
  );
}
