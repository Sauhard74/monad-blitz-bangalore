// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * AgentPayroll — the on-chain payroll for an autonomous AI company on Monad.
 *
 * Living Company's AI agents earn real MON every time they ship a work product.
 * The company funds a treasury here; the company backend (owner) settles each
 * shipped deliverable on-chain, paying the responsible agent. Every hire and
 * every payment is an event on Monad — a transparent "agent economy".
 */
contract AgentPayroll {
    address public owner;
    string public company;

    struct Agent {
        bool registered;
        string name;
        string role;
        uint256 earned; // total MON paid to this agent (wei)
        uint256 jobs; // number of work products paid
    }

    mapping(address => Agent) public agents;
    address[] public roster;
    uint256 public totalPaid;
    uint256 public totalJobs;

    event AgentRegistered(address indexed agent, string name, string role);
    event WorkPaid(address indexed agent, string workId, uint256 amount, string note);
    event TreasuryFunded(address indexed from, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor(string memory _company) payable {
        owner = msg.sender;
        company = _company;
        if (msg.value > 0) emit TreasuryFunded(msg.sender, msg.value);
    }

    /// Top up the company treasury.
    receive() external payable {
        emit TreasuryFunded(msg.sender, msg.value);
    }

    /// Put an agent on the on-chain roster (idempotent; updates name/role).
    function registerAgent(address agent, string calldata name, string calldata role) external onlyOwner {
        Agent storage a = agents[agent];
        if (!a.registered) {
            a.registered = true;
            roster.push(agent);
        }
        a.name = name;
        a.role = role;
        emit AgentRegistered(agent, name, role);
    }

    /// Pay an agent for one shipped work product. Auto-registers if needed.
    function payForWork(
        address agent,
        string calldata name,
        string calldata role,
        string calldata workId,
        uint256 amount,
        string calldata note
    ) external onlyOwner {
        Agent storage a = agents[agent];
        if (!a.registered) {
            a.registered = true;
            a.name = name;
            a.role = role;
            roster.push(agent);
            emit AgentRegistered(agent, name, role);
        }
        require(address(this).balance >= amount, "treasury low");
        a.earned += amount;
        a.jobs += 1;
        totalPaid += amount;
        totalJobs += 1;
        (bool ok, ) = payable(agent).call{value: amount}("");
        require(ok, "transfer failed");
        emit WorkPaid(agent, workId, amount, note);
    }

    function treasury() external view returns (uint256) {
        return address(this).balance;
    }

    function rosterSize() external view returns (uint256) {
        return roster.length;
    }

    /// Convenience read for the office UI: a slice of the roster with earnings.
    function rosterAt(uint256 i) external view returns (address addr, string memory name, string memory role, uint256 earned, uint256 jobs) {
        addr = roster[i];
        Agent storage a = agents[addr];
        return (addr, a.name, a.role, a.earned, a.jobs);
    }
}
