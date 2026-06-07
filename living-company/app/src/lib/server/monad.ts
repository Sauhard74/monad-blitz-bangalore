import 'server-only';
import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  toHex,
  formatEther,
  parseEther,
  getContract,
  type Address,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import artifact from '@/lib/monad/AgentPayroll.json';

/**
 * Monad testnet wiring for the on-chain agent economy. The company's AI agents
 * earn real MON on Monad each time they ship a work product, settled through the
 * AgentPayroll contract by the company's deployer/treasury wallet.
 */

export const MONAD = {
  rpc: process.env.MONAD_RPC_URL || 'https://testnet-rpc.monad.xyz',
  chainId: Number(process.env.MONAD_CHAIN_ID || 10143),
  explorer: process.env.MONAD_EXPLORER || 'https://testnet.monadexplorer.com',
};

const chain = {
  id: MONAD.chainId,
  name: 'Monad Testnet',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: { default: { http: [MONAD.rpc] } },
  blockExplorers: { default: { name: 'Monad Explorer', url: MONAD.explorer } },
} as const;

export function isMonadConfigured(): boolean {
  return Boolean(process.env.MONAD_DEPLOYER_KEY && process.env.MONAD_PAYROLL_ADDRESS);
}

export function payrollAddress(): Address | null {
  const a = process.env.MONAD_PAYROLL_ADDRESS;
  return a ? (a as Address) : null;
}

export const publicClient = createPublicClient({ chain, transport: http(MONAD.rpc) });

function ownerAccount() {
  const key = process.env.MONAD_DEPLOYER_KEY as `0x${string}` | undefined;
  if (!key) throw new Error('MONAD_DEPLOYER_KEY not set');
  return privateKeyToAccount(key);
}

/** A stable Monad address per agent, derived from a server seed + the agent id.
 *  We only ever need the address (agents receive, never spend), so the derived
 *  key is never used to sign — just to produce a deterministic wallet. */
export function agentAddress(agentId: string): Address {
  const seed = process.env.MONAD_AGENT_SEED || 'living-company-agent-seed';
  const pk = keccak256(toHex(`${seed}:${agentId}`));
  return privateKeyToAccount(pk).address;
}

function contractRead() {
  const address = payrollAddress();
  if (!address) throw new Error('MONAD_PAYROLL_ADDRESS not set');
  return getContract({ address, abi: artifact.abi, client: publicClient });
}

function contractWrite() {
  const address = payrollAddress();
  if (!address) throw new Error('MONAD_PAYROLL_ADDRESS not set');
  const wallet = createWalletClient({ account: ownerAccount(), chain, transport: http(MONAD.rpc) });
  return getContract({ address, abi: artifact.abi, client: wallet });
}

/** Pay an agent on-chain for one shipped work product. Returns the tx hash. */
export async function payForWork(args: {
  agentId: string;
  name: string;
  role: string;
  workId: string;
  note: string;
  rewardMon?: string;
}): Promise<`0x${string}`> {
  const reward = parseEther(args.rewardMon || process.env.MONAD_WORK_REWARD || '0.02');
  const c = contractWrite();
  return c.write.payForWork([
    agentAddress(args.agentId),
    args.name.slice(0, 40),
    args.role.slice(0, 24),
    args.workId.slice(0, 64),
    reward,
    args.note.slice(0, 80),
  ]) as Promise<`0x${string}`>;
}

/** Work products already paid on-chain (from WorkPaid events) — so payroll
 *  sync is idempotent and never double-pays, even across restarts. */
export async function paidWorkIds(): Promise<Set<string>> {
  const address = payrollAddress();
  if (!address) return new Set();
  try {
    const logs = await publicClient.getLogs({
      address,
      event: {
        type: 'event',
        name: 'WorkPaid',
        inputs: [
          { name: 'agent', type: 'address', indexed: true },
          { name: 'workId', type: 'string', indexed: false },
          { name: 'amount', type: 'uint256', indexed: false },
          { name: 'note', type: 'string', indexed: false },
        ],
      },
      fromBlock: BigInt(0),
      toBlock: 'latest',
    });
    const set = new Set<string>();
    for (const l of logs) {
      const w = (l as { args?: { workId?: string } }).args?.workId;
      if (w) set.add(w);
    }
    return set;
  } catch {
    return new Set();
  }
}

export interface OnchainAgent {
  address: string;
  name: string;
  role: string;
  earned: string; // MON, formatted
  jobs: number;
}

/** Read the live treasury + roster earnings from the contract. */
export async function getEconomy(): Promise<{
  treasury: string;
  totalPaid: string;
  totalJobs: number;
  agents: OnchainAgent[];
  address: string;
  explorer: string;
} | null> {
  if (!payrollAddress()) return null;
  const c = contractRead();
  const [treasury, totalPaid, totalJobs, size] = (await Promise.all([
    c.read.treasury(),
    c.read.totalPaid(),
    c.read.totalJobs(),
    c.read.rosterSize(),
  ])) as [bigint, bigint, bigint, bigint];

  const n = Number(size);
  const agents: OnchainAgent[] = [];
  for (let i = 0; i < n; i++) {
    const [addr, name, role, earned, jobs] = (await c.read.rosterAt([BigInt(i)])) as [
      Address,
      string,
      string,
      bigint,
      bigint,
    ];
    agents.push({ address: addr, name, role, earned: formatEther(earned), jobs: Number(jobs) });
  }
  agents.sort((a, b) => Number(b.earned) - Number(a.earned));

  return {
    treasury: formatEther(treasury),
    totalPaid: formatEther(totalPaid),
    totalJobs: Number(totalJobs),
    agents,
    address: payrollAddress() as string,
    explorer: MONAD.explorer,
  };
}
