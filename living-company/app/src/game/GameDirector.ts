import type { Agent, OfficeEvent } from '@/lib/domain/types';
import type { CompanyDataSource } from '@/lib/data/CompanyDataSource';

/**
 * The world surface the director drives. The Phaser scene implements this; tests
 * pass a spy. Keeping it an interface decouples routing logic from the engine.
 */
export interface OfficeWorld {
  /** A new hire arrives: spawn their character and seat them at a free desk. */
  spawnAgent(agent: Agent): void;
  moveAgentToRoom(agentId: string, roomId: string): void;
  speak(agentId: string, text: string): void;
  think(agentId: string, text: string): void;
  gather(roomId: string, agentIds: string[]): void;
  endMeeting(roomId: string): void;
}

/**
 * Consumes the `OfficeEvent` stream and drives both the world (Phaser) and the
 * store (HUD). This is the single place event → visible-behavior mapping lives.
 */
export class GameDirector {
  private running = false;

  constructor(
    private readonly world: OfficeWorld,
    private readonly applyEvent: (event: OfficeEvent) => void,
  ) {}

  /** Route one event to the store and the world. */
  handle(event: OfficeEvent): void {
    this.applyEvent(event);

    switch (event.t) {
      case 'agent.hired':
        this.world.spawnAgent(event.agent);
        break;
      case 'agent.move':
        this.world.moveAgentToRoom(event.agentId, event.toRoomId);
        break;
      case 'agent.speak':
        this.world.speak(event.agentId, event.text);
        break;
      case 'agent.think':
        this.world.think(event.agentId, event.text);
        break;
      case 'memory.recalled':
        this.world.think(event.agentId, event.snippet);
        break;
      case 'meeting.started':
        this.world.gather(event.roomId, event.agentIds);
        break;
      case 'meeting.ended':
        this.world.endMeeting(event.roomId);
        break;
      default:
        // project.started/completed, task.* affect the store only.
        break;
    }
  }

  /** Pump a data source's event stream through `handle` until it ends. */
  async run(source: CompanyDataSource): Promise<void> {
    this.running = true;
    for await (const event of source.events()) {
      if (!this.running) break;
      this.handle(event);
    }
  }

  stop(): void {
    this.running = false;
  }
}
