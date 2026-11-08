// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title BineraArbitration
/// @notice Records a three-evaluator verdict for a disputed delivery. It does
///         not move funds: settlement stays in the escrow contract and reads
///         this verdict. The panel is fixed when the case opens.
contract BineraArbitration {
    enum Phase { None, Evidence, Voting, Resolved }

    struct Case {
        address buyer;
        address provider;
        Phase phase;
        uint64 evidenceDeadline;
        uint64 voteDeadline;
        uint8 votesForProvider;
        uint8 votesForBuyer;
        uint8 votesCast;
        bool providerUpheld;
        bool finalVerdict;
        address[3] evaluators;
        mapping(address => bool) voted;
    }

    uint64 public constant MIN_EVIDENCE = 5 minutes;
    uint64 public constant MAX_EVIDENCE = 30 days;
    uint64 public constant MIN_VOTING = 5 minutes;
    uint64 public constant MAX_VOTING = 30 days;

    uint256 public caseCount;
    mapping(uint256 => Case) private cases;

    event CaseOpened(uint256 indexed caseId, address indexed buyer, address indexed provider, uint64 evidenceDeadline, uint64 voteDeadline);
    event VoteCast(uint256 indexed caseId, address indexed evaluator, bool providerUpheld, uint8 votesCast);
    event Resolved(uint256 indexed caseId, bool providerUpheld, bool finalVerdict);

    error BadWindow();
    error BadPanel();
    error UnknownCase();
    error WrongPhase();
    error NotEvaluator();
    error AlreadyVoted();
    error NotSeated();

    function openCase(address provider, address[3] calldata evaluators, uint64 evidenceSeconds, uint64 voteSeconds) external returns (uint256 caseId) {
        if (provider == address(0) || provider == msg.sender) revert BadPanel();
        if (evidenceSeconds < MIN_EVIDENCE || evidenceSeconds > MAX_EVIDENCE) revert BadWindow();
        if (voteSeconds < MIN_VOTING || voteSeconds > MAX_VOTING) revert BadWindow();
        for (uint256 i = 0; i < 3; i++) {
            address evaluator = evaluators[i];
            if (evaluator == address(0) || evaluator == msg.sender || evaluator == provider) revert BadPanel();
            for (uint256 j = 0; j < i; j++) if (evaluators[j] == evaluator) revert BadPanel();
        }
        caseId = ++caseCount;
        Case storage record = cases[caseId];
        record.buyer = msg.sender;
        record.provider = provider;
        record.phase = Phase.Evidence;
        record.evidenceDeadline = uint64(block.timestamp) + evidenceSeconds;
        record.voteDeadline = record.evidenceDeadline + voteSeconds;
        record.evaluators = evaluators;
        emit CaseOpened(caseId, msg.sender, provider, record.evidenceDeadline, record.voteDeadline);
    }

    function vote(uint256 caseId, bool providerUpheld) external {
        Case storage record = cases[caseId];
        if (record.phase == Phase.None) revert UnknownCase();
        if (record.phase == Phase.Resolved) revert WrongPhase();
        if (block.timestamp < record.evidenceDeadline) revert WrongPhase();
        if (block.timestamp >= record.voteDeadline) revert WrongPhase();
        if (record.phase == Phase.Evidence) record.phase = Phase.Voting;
        bool seated = false;
        for (uint256 i = 0; i < 3; i++) if (record.evaluators[i] == msg.sender) seated = true;
        if (!seated) revert NotSeated();
        if (record.voted[msg.sender]) revert AlreadyVoted();
        record.voted[msg.sender] = true;
        record.votesCast += 1;
        if (providerUpheld) record.votesForProvider += 1;
        else record.votesForBuyer += 1;
        emit VoteCast(caseId, msg.sender, providerUpheld, record.votesCast);
        if (record.votesForProvider == 2 || record.votesForBuyer == 2) {
            record.providerUpheld = record.votesForProvider == 2;
            record.finalVerdict = true;
            record.phase = Phase.Resolved;
            emit Resolved(caseId, record.providerUpheld, true);
        }
    }

    /// @notice After the voting window, a majority of cast votes resolves the
    ///         case. Ties resolve for the buyer; fewer than two votes leave the
    ///         case unresolved and emit a non-final result for manual review.
    function closeExpired(uint256 caseId) external {
        Case storage record = cases[caseId];
        if (record.phase == Phase.None) revert UnknownCase();
        if (record.phase == Phase.Resolved) revert WrongPhase();
        if (block.timestamp < record.voteDeadline) revert WrongPhase();
        bool finalVerdict = record.votesCast >= 2;
        record.providerUpheld = record.votesForProvider > record.votesForBuyer;
        record.finalVerdict = finalVerdict;
        record.phase = Phase.Resolved;
        emit Resolved(caseId, record.providerUpheld, finalVerdict);
    }

    function getCase(uint256 caseId) external view returns (
        address buyer, address provider, Phase phase, uint64 evidenceDeadline, uint64 voteDeadline,
        uint8 votesForProvider, uint8 votesForBuyer, uint8 votesCast, bool providerUpheld, bool finalVerdict, address[3] memory evaluators
    ) {
        Case storage record = cases[caseId];
        if (record.phase == Phase.None) revert UnknownCase();
        return (record.buyer, record.provider, record.phase, record.evidenceDeadline, record.voteDeadline,
            record.votesForProvider, record.votesForBuyer, record.votesCast, record.providerUpheld, record.finalVerdict, record.evaluators);
    }
}
