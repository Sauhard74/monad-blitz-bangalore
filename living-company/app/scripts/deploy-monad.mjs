// Deploy AgentPayroll to Monad testnet and (optionally) seed the treasury.
// Usage: node scripts/deploy-monad.mjs [treasuryMON]
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { createWalletClient, createPublicClient, http, parseEther, formatEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

function loadEnv() {
  const env = {};
  for (const f of ['.env.local', '.env']) {
    if (!existsSync(f)) continue;
    for (const line of readFileSync(f, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
  return env;
}

const env = loadEnv();
const RPC = env.MONAD_RPC_URL || 'https://testnet-rpc.monad.xyz';
const CHAIN_ID = Number(env.MONAD_CHAIN_ID || 10143);
const EXPLORER = env.MONAD_EXPLORER || 'https://testnet.monadexplorer.com';
const KEY = env.MONAD_DEPLOYER_KEY;
if (!KEY) throw new Error('MONAD_DEPLOYER_KEY missing in .env.local');

const monad = {
  id: CHAIN_ID,
  name: 'Monad Testnet',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
  blockExplorers: { default: { name: 'Monad Explorer', url: EXPLORER } },
};

const account = privateKeyToAccount(KEY);
const pub = createPublicClient({ chain: monad, transport: http(RPC) });
const wallet = createWalletClient({ account, chain: monad, transport: http(RPC) });
const artifact = JSON.parse(readFileSync('contracts/out/AgentPayroll.json', 'utf8'));

const seedMON = process.argv[2] ? Number(process.argv[2]) : 0.5;

const bal = await pub.getBalance({ address: account.address });
console.log('Deployer:', account.address, '· balance:', formatEther(bal), 'MON');
if (bal === 0n) throw new Error('Deployer has 0 MON — fund it at blitz.devnads.com first.');

console.log('Deploying AgentPayroll …');
const hash = await wallet.deployContract({
  abi: artifact.abi,
  bytecode: artifact.bytecode,
  args: ['Living Company'],
  value: parseEther(String(seedMON)), // seed the treasury at deploy
});
console.log('  deploy tx:', `${EXPLORER}/tx/${hash}`);
const receipt = await pub.waitForTransactionReceipt({ hash });
const address = receipt.contractAddress;
console.log('  AgentPayroll deployed at:', address);
console.log('  treasury seeded with', seedMON, 'MON');

// Persist the address to .env.local
let envText = existsSync('.env.local') ? readFileSync('.env.local', 'utf8') : '';
if (/MONAD_PAYROLL_ADDRESS=/.test(envText)) {
  envText = envText.replace(/MONAD_PAYROLL_ADDRESS=.*/g, `MONAD_PAYROLL_ADDRESS=${address}`);
} else {
  envText += `MONAD_PAYROLL_ADDRESS=${address}\n`;
}
writeFileSync('.env.local', envText);
console.log('Saved MONAD_PAYROLL_ADDRESS to .env.local');
console.log('\nExplorer:', `${EXPLORER}/address/${address}`);
