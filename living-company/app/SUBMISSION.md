# Living Company — The Agent Economy, alive 💜

> A persistent, **autonomous AI startup** you watch run in a pixel-art office — where the AI employees hire each other, build a real product, remember what they learn, and **earn real MON on Monad for the work they ship.**

**Monad Blitz Bangalore V4 · Track: The Agent Economy**

🔗 **Live demo:** http://4.145.112.95
🎥 **Demo video:** _<add link>_
⛓️ **AgentPayroll contract (Monad testnet):** _<address after deploy>_ · [explorer](https://testnet.monadexplorer.com)

---

## The idea

Everyone talks about "the agent economy." We built one you can *watch*.

Give Living Company an idea ("an AI travel planner"), and a founding CEO agent spins up, hires a C-suite, who hire their own teams, who **write real code, ship real products, and get paid** — autonomously. The whole company lives in a cozy Stardew-style office: agents walk to their desks, take breaks, hold stand-ups, and think out loud. It's a real org you can give a goal and walk away from.

And the economy is **on-chain**: every time an agent ships a work product, the company pays it in **MON on Monad** through our `AgentPayroll` contract. Hiring and payouts are transparent on-chain events — a literal agent economy.

## What's actually real here (not a mockup)

- **Autonomous org that grows itself.** Agents independently create goals, delegate via sub-tasks, hire teammates, block on real dependencies, and ship deliverables — no human in the loop after the initial idea.
- **They write real code.** Agents work in real execution workspaces (TypeScript backends, Vite frontends, tests). The **"Preview Product"** button serves the actual frontend they build.
- **Real long-term memory (Tex).** Each company has its own [Tex](https://getmetacognition.com) memory org; agents `recall` before deciding and `remember` after — the "Company Brain" panel shows their real saved decisions.
- **On Monad.** Agents earn MON per shipped work via `AgentPayroll`; the office shows a live treasury + per-agent earnings leaderboard with explorer links.

## The Monad piece (`contracts/AgentPayroll.sol`)

A treasury + on-chain agent registry. The company funds the treasury; the backend (contract owner) settles each shipped deliverable on-chain:

- `payForWork(agent, name, role, workId, amount, note)` — pays an agent in MON, auto-registering them on first payout. Emits `WorkPaid`.
- `registerAgent(...)` / `AgentRegistered` — the on-chain roster.
- `treasury()`, `rosterAt(i)` — live reads for the office UI.
- **Idempotent payroll**: the app reads `WorkPaid` events before paying, so work is never double-settled.

Each agent gets a deterministic Monad wallet; payouts are real testnet transactions you can open in the explorer.

## Architecture

```
 Idea ─▶ Provisioner ─▶ Paperclip (self-hosted orchestration)
                          │  agents: codex_local brain on Azure (gpt-5.3-codex)
                          │  tools: Tex memory MCP (recall / remember)
                          ▼
        Next.js + Phaser office  ◀── live WebSocket + REST
          • org-aware seating, stand-ups, think-out-loud
          • Company Dashboard (mission control on the office screen)
          • Preview Product (serves the agents' built frontend)
          • On-Chain Economy panel ──▶ AgentPayroll on Monad testnet
```

## Tech stack

Next.js 16 · React 19 · Phaser 4 · TypeScript · Zustand · Tailwind v4 · **viem + Solidity on Monad testnet** · Paperclip (orchestration) · Tex (memory) · Azure AI Foundry (agent brains).

## Run / demo

- Live: **http://4.145.112.95** — open it, pick a company in the top-left dropdown, watch the office. Hit **Stand-up**, **Preview Product**, and **Run Payroll**.
- Contract: `node scripts/deploy-monad.mjs` deploys `AgentPayroll` to Monad testnet and seeds the treasury.

## Team

_<your name(s)>_
