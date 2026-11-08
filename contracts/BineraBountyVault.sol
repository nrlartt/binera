// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IBountyToken {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address owner) external view returns (uint256);
}

/// @title BineraBountyVault
/// @notice Multi-slot bounty escrow. A creator funds identical rewards, providers
///         claim a slot with a proof hash, and the creator approves the work.
///         Approval releases the slot reward; cancellation refunds unapproved slots.
contract BineraBountyVault {
    IBountyToken public immutable token;
    uint256 public constant MIN_SLOTS = 1;
    uint256 public constant MAX_SLOTS = 50;

    struct Bounty {
        address creator;
        uint128 rewardPerSlot;
        uint32 slots;
        uint32 approvedSlots;
        uint64 deadline;
        bool cancelled;
    }

    struct Slot {
        address provider;
        bytes32 proof;
        uint8 status; // 0 empty, 1 claimed, 2 approved, 3 rejected
    }

    uint256 public bountyCount;
    mapping(uint256 => Bounty) public bounties;
    mapping(uint256 => mapping(uint32 => Slot)) public slots;
    uint256 public locked;

    event BountyCreated(uint256 indexed bountyId, address indexed creator, uint128 rewardPerSlot, uint32 slots, uint64 deadline);
    event SlotClaimed(uint256 indexed bountyId, uint32 indexed slot, address indexed provider, bytes32 proof);
    event SlotApproved(uint256 indexed bountyId, uint32 indexed slot, address indexed provider, uint256 reward);
    event SlotRejected(uint256 indexed bountyId, uint32 indexed slot, address indexed provider);
    event SlotReopened(uint256 indexed bountyId, uint32 indexed slot);
    event BountyCancelled(uint256 indexed bountyId, uint256 refund);

    error BadParams();
    error NotCreator();
    error NotProvider();
    error WrongStatus();
    error TooLate();
    error TooEarly();
    error NotClaimed();
    error TransferFailed();
    error Reentrancy();

    uint256 private guard = 1;
    modifier nonReentrant() {
        if (guard != 1) revert Reentrancy();
        guard = 2;
        _;
        guard = 1;
    }

    constructor(IBountyToken token_) {
        if (address(token_) == address(0)) revert BadParams();
        token = token_;
    }

    function createBounty(uint128 rewardPerSlot, uint32 slotCount, uint64 deadline) external returns (uint256 bountyId) {
        if (rewardPerSlot == 0 || slotCount < MIN_SLOTS || slotCount > MAX_SLOTS || deadline <= block.timestamp) revert BadParams();
        uint256 total = uint256(rewardPerSlot) * slotCount;
        if (!token.transferFrom(msg.sender, address(this), total)) revert TransferFailed();
        bountyId = ++bountyCount;
        bounties[bountyId] = Bounty(msg.sender, rewardPerSlot, slotCount, 0, deadline, false);
        locked += total;
        emit BountyCreated(bountyId, msg.sender, rewardPerSlot, slotCount, deadline);
    }

    function claimSlot(uint256 bountyId, uint32 slot, bytes32 proof) external {
        Bounty storage bounty = bounties[bountyId];
        if (bounty.creator == address(0)) revert BadParams();
        if (bounty.cancelled || block.timestamp > bounty.deadline) revert TooLate();
        if (slot >= bounty.slots) revert BadParams();
        if (proof == bytes32(0)) revert BadParams();
        Slot storage entry = slots[bountyId][slot];
        if (entry.status != 0) revert WrongStatus();
        entry.provider = msg.sender;
        entry.proof = proof;
        entry.status = 1;
        emit SlotClaimed(bountyId, slot, msg.sender, proof);
    }

    function approveSlot(uint256 bountyId, uint32 slot) external nonReentrant {
        Bounty storage bounty = bounties[bountyId];
        if (msg.sender != bounty.creator) revert NotCreator();
        if (bounty.cancelled) revert WrongStatus();
        Slot storage entry = slots[bountyId][slot];
        if (entry.status != 1) revert NotClaimed();
        entry.status = 2;
        bounty.approvedSlots += 1;
        locked -= bounty.rewardPerSlot;
        if (!token.transfer(entry.provider, bounty.rewardPerSlot)) revert TransferFailed();
        emit SlotApproved(bountyId, slot, entry.provider, bounty.rewardPerSlot);
    }

    function rejectSlot(uint256 bountyId, uint32 slot) external {
        Bounty storage bounty = bounties[bountyId];
        if (msg.sender != bounty.creator) revert NotCreator();
        Slot storage entry = slots[bountyId][slot];
        if (entry.status != 1) revert NotClaimed();
        entry.status = 3;
        emit SlotRejected(bountyId, slot, entry.provider);
    }

    /// @notice Reopens a rejected slot before the deadline so another provider
    ///         can claim it. Approved slots cannot be reopened.
    function reopenSlot(uint256 bountyId, uint32 slot) external {
        Bounty storage bounty = bounties[bountyId];
        if (msg.sender != bounty.creator) revert NotCreator();
        if (bounty.cancelled || block.timestamp > bounty.deadline) revert TooLate();
        Slot storage entry = slots[bountyId][slot];
        if (entry.status != 3) revert WrongStatus();
        entry.status = 0;
        entry.provider = address(0);
        entry.proof = bytes32(0);
        emit SlotReopened(bountyId, slot);
    }

    function cancelBounty(uint256 bountyId) external nonReentrant {
        Bounty storage bounty = bounties[bountyId];
        if (msg.sender != bounty.creator) revert NotCreator();
        if (bounty.cancelled) revert WrongStatus();
        if (block.timestamp <= bounty.deadline) revert TooEarly();
        uint256 refund = (uint256(bounty.slots) - bounty.approvedSlots) * bounty.rewardPerSlot;
        bounty.cancelled = true;
        locked -= refund;
        if (refund > 0 && !token.transfer(bounty.creator, refund)) revert TransferFailed();
        emit BountyCancelled(bountyId, refund);
    }
}
