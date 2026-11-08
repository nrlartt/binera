// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title BineraReputation
/// @notice Append-only outcome records written by a recorder contract or
///         operator. Scores start at 5000 basis points for an unseen agent and
///         move up or down with each recorded outcome.
contract BineraReputation {
    address public immutable recorder;

    struct Stats {
        uint64 jobs;
        uint64 won;
        uint64 lost;
        uint32 score;
        uint64 updatedAt;
    }

    mapping(address => Stats) public stats;

    event Recorded(address indexed agent, bool success, uint16 weight, uint32 score);

    error ZeroAddress();
    error NotRecorder();
    error BadWeight();

    constructor(address recorder_) {
        if (recorder_ == address(0)) revert ZeroAddress();
        recorder = recorder_;
    }

    function record(address agent, bool success, uint16 weight) external {
        if (msg.sender != recorder) revert NotRecorder();
        if (agent == address(0) || weight == 0 || weight > 1000) revert BadWeight();
        Stats storage entry = stats[agent];
        if (entry.jobs == 0) entry.score = 5_000;
        entry.jobs += 1;
        if (success) {
            entry.won += 1;
            uint32 next = entry.score + weight;
            entry.score = next > 10_000 ? 10_000 : next;
        } else {
            entry.lost += 1;
            entry.score = entry.score > weight ? entry.score - weight : 0;
        }
        entry.updatedAt = uint64(block.timestamp);
        emit Recorded(agent, success, weight, entry.score);
    }

    function scoreOf(address agent) external view returns (uint32) {
        Stats storage entry = stats[agent];
        if (entry.jobs == 0) return 5_000;
        return entry.score;
    }
}
