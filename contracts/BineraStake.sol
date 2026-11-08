// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address owner) external view returns (uint256);
}

/// @title BineraStake
/// @notice Agent stake with a per-wallet lock. The arbiter can slash only the
///         staked balance and only to an address chosen by the arbitration flow.
contract BineraStake {
    IERC20 public immutable token;
    address public immutable arbiter;
    uint64 public constant MAX_LOCK = 365 days;

    struct Position {
        uint192 amount;
        uint64 unlockAt;
    }

    mapping(address => Position) public positions;
    uint256 public totalStaked;

    event Staked(address indexed agent, uint256 amount, uint64 unlockAt);
    event Unstaked(address indexed agent, uint256 amount);
    event Slashed(address indexed agent, address indexed recipient, uint256 amount, bytes32 reason);

    error ZeroAddress();
    error ZeroAmount();
    error LockTooLong();
    error InsufficientStake();
    error Locked();
    error NotArbiter();
    error TransferFailed();

    constructor(IERC20 token_, address arbiter_) {
        if (address(token_) == address(0) || arbiter_ == address(0)) revert ZeroAddress();
        token = token_;
        arbiter = arbiter_;
    }

    function stake(uint256 amount, uint64 lockSeconds) external {
        if (amount == 0 || amount > type(uint192).max) revert ZeroAmount();
        if (lockSeconds > MAX_LOCK) revert LockTooLong();
        if (!token.transferFrom(msg.sender, address(this), amount)) revert TransferFailed();
        Position storage position = positions[msg.sender];
        position.amount += uint192(amount);
        position.unlockAt = uint64(block.timestamp) + lockSeconds;
        totalStaked += amount;
        emit Staked(msg.sender, amount, position.unlockAt);
    }

    function unstake(uint256 amount) external {
        Position storage position = positions[msg.sender];
        if (amount == 0 || amount > position.amount) revert InsufficientStake();
        if (block.timestamp < position.unlockAt) revert Locked();
        position.amount -= uint192(amount);
        totalStaked -= amount;
        if (!token.transfer(msg.sender, amount)) revert TransferFailed();
        emit Unstaked(msg.sender, amount);
    }

    /// @notice Slashes locked stake. Callable only by the arbiter contract or
    ///         operator configured at deployment; recipients must be explicit.
    function slash(address agent, address recipient, uint256 amount, bytes32 reason) external {
        if (msg.sender != arbiter) revert NotArbiter();
        if (recipient == address(0)) revert ZeroAddress();
        Position storage position = positions[agent];
        if (amount == 0 || amount > position.amount) revert InsufficientStake();
        position.amount -= uint192(amount);
        totalStaked -= amount;
        if (!token.transfer(recipient, amount)) revert TransferFailed();
        emit Slashed(agent, recipient, amount, reason);
    }
}
