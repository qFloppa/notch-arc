// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract Notch is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    error NotTabMember();
    error NotPayer();
    error NotPayee();
    error TabNotActive();
    error ItemNotInTab();
    error StatementNotOpen();
    error NotSettleable();
    error DisputeWindowExpired();
    error DuplicateDispute();
    error NotArbitrator();
    error InvalidOutcome();
    error AdjustedAmountTooLarge();
    error InsufficientCredit();
    error ZeroAddress();
    error ZeroBond();
    error ZeroWindow();
    error ZeroAmount();
    error CycleItemCapReached();
    error CycleTooEarly();

    enum StatementStatus {
        Open,
        Accepted,
        Disputed,
        Resolved,
        Settled
    }

    enum DisputeStatus {
        Pending,
        Resolved
    }

    struct Tab {
        bytes32 tabId;
        address creator;
        address payer;
        address payee;
        uint256 cycleSeconds;
        uint256 currentCycle;
        uint256 openedAt;
        bool active;
        address[] memberList;
    }

    struct LineItem {
        bytes32 itemId;
        bytes32 tabId;
        address payer;
        address payee;
        uint256 amount;
        string memo;
        string evidenceUri;
        bytes32 evidenceHash;
        uint256 cycle;
        uint256 createdAt;
    }

    struct Statement {
        bytes32 statementId;
        bytes32 tabId;
        uint256 cycle;
        uint256 closedAt;
        address closedBy;
        bytes32 statementHash;
        StatementStatus status;
        uint256 netAmount;
        bytes32[] itemIds;
        address acceptedBy;
        uint256 acceptedAt;
    }

    struct Dispute {
        bytes32 disputeId;
        bytes32 statementId;
        bytes32 itemId;
        address claimant;
        string claimKind;
        string claim;
        uint256 bondAmount;
        DisputeStatus status;
        string outcome;
        uint256 revisedItemAmount;
        uint256 claimantBondAward;
        string rationale;
        bool evidenceHashMatched;
        uint256 openedAt;
        uint256 resolvedAt;
        bool bondCredited;
    }

    IERC20 public immutable usdc;
    address public arbitrator;
    uint256 public bondAmount;
    uint256 public disputeWindowSeconds;

    mapping(bytes32 => Tab) public tabs;
    mapping(bytes32 => LineItem) public lineItems;
    mapping(bytes32 => Statement) public statements;
    mapping(bytes32 => Dispute) public disputes;
    mapping(address => uint256) public credits;

    mapping(bytes32 => mapping(uint256 => bytes32[])) private _tabCycleItemIds;
    mapping(bytes32 => mapping(uint256 => uint256)) private _cycleStartedAt;
    mapping(bytes32 => mapping(bytes32 => bytes32)) public disputeByStatementAndItem;
    mapping(bytes32 => uint256) public statementDisputeCount;
    mapping(bytes32 => uint256) public statementResolvedDisputeCount;
    mapping(bytes32 => bytes32[]) private _tabStatementIds;

    uint256 private _tabNonce;
    uint256 private _itemNonce;
    uint256 private _statementNonce;
    uint256 private _disputeNonce;

    uint256 public constant MAX_ITEMS_PER_CYCLE = 200;

    bytes32 private constant CLAIM_NOT_DELIVERED = keccak256("not_delivered");
    bytes32 private constant CLAIM_OFF_SPEC = keccak256("off_spec");
    bytes32 private constant CLAIM_OVERCHARGED = keccak256("overcharged");
    bytes32 private constant CLAIM_DUPLICATE = keccak256("duplicate");
    bytes32 private constant CLAIM_SLA_BREACH = keccak256("sla_breach");

    bytes32 private constant OUTCOME_UPHELD = keccak256("upheld");
    bytes32 private constant OUTCOME_ADJUSTED = keccak256("adjusted");
    bytes32 private constant OUTCOME_REJECTED = keccak256("rejected");

    event TabOpened(
        bytes32 indexed tabId,
        address indexed creator,
        address indexed payer,
        address payee,
        uint256 cycleSeconds
    );

    event ChargeRecorded(
        bytes32 indexed tabId,
        bytes32 indexed itemId,
        uint256 indexed cycle,
        address payer,
        address payee,
        uint256 amount,
        bytes32 evidenceHash
    );

    event CycleClosed(
        bytes32 indexed tabId,
        bytes32 indexed statementId,
        uint256 indexed cycle,
        bytes32 statementHash,
        uint256 netAmount,
        address closedBy
    );

    event StatementAccepted(bytes32 indexed statementId, address indexed acceptedBy, uint256 acceptedAt);

    event StatementSettled(
        bytes32 indexed statementId,
        uint256 netAmount,
        address indexed payer,
        address indexed payee
    );

    event DisputeOpened(
        bytes32 indexed statementId,
        bytes32 indexed disputeId,
        bytes32 indexed itemId,
        address claimant,
        uint256 bondAmount,
        string claimKind
    );

    event RulingSubmitted(
        bytes32 indexed disputeId,
        bytes32 indexed statementId,
        string outcome,
        uint256 revisedItemAmount,
        uint256 claimantBondAward,
        bool evidenceHashMatched
    );

    event ArbitratorChanged(address indexed oldArbitrator, address indexed newArbitrator);
    event BondCredited(bytes32 indexed disputeId, address indexed beneficiary, uint256 amount);
    event Withdrawn(address indexed account, uint256 amount);

    constructor(
        address _usdc,
        address _arbitrator,
        address _initialOwner,
        uint256 _bondAmount,
        uint256 _disputeWindowSeconds
    ) Ownable(_initialOwner) {
        if (_usdc == address(0) || _arbitrator == address(0) || _initialOwner == address(0)) revert ZeroAddress();
        if (_bondAmount == 0) revert ZeroBond();
        if (_disputeWindowSeconds == 0) revert ZeroWindow();

        usdc = IERC20(_usdc);
        arbitrator = _arbitrator;
        bondAmount = _bondAmount;
        disputeWindowSeconds = _disputeWindowSeconds;
    }

    function openTab(address payer, address payee, uint256 cycleSeconds) external returns (bytes32 tabId) {
        if (payer == address(0) || payee == address(0)) revert ZeroAddress();
        if (cycleSeconds == 0) revert ZeroWindow();

        uint256 nonce = ++_tabNonce;
        tabId = keccak256(abi.encodePacked(block.timestamp, msg.sender, payer, payee, nonce));

        Tab storage t = tabs[tabId];
        t.tabId = tabId;
        t.creator = msg.sender;
        t.payer = payer;
        t.payee = payee;
        t.cycleSeconds = cycleSeconds;
        t.currentCycle = 1;
        t.openedAt = block.timestamp;
        _cycleStartedAt[tabId][1] = block.timestamp;
        t.active = true;
        t.memberList.push(payer);
        t.memberList.push(payee);

        emit TabOpened(tabId, msg.sender, payer, payee, cycleSeconds);
    }

    function recordCharge(
        bytes32 tabId,
        uint256 amount,
        string calldata memo,
        string calldata evidenceUri,
        bytes32 evidenceHash
    ) external returns (bytes32 itemId) {
        Tab storage t = tabs[tabId];
        if (!t.active) revert TabNotActive();
        if (msg.sender != t.payer) revert NotPayer();
        if (amount == 0) revert ZeroAmount();
        if (_tabCycleItemIds[tabId][t.currentCycle].length >= MAX_ITEMS_PER_CYCLE) revert CycleItemCapReached();

        uint256 nonce = ++_itemNonce;
        itemId = keccak256(
            abi.encodePacked(block.timestamp, msg.sender, tabId, t.currentCycle, amount, evidenceHash, nonce)
        );

        LineItem storage item = lineItems[itemId];
        item.itemId = itemId;
        item.tabId = tabId;
        item.payer = t.payer;
        item.payee = t.payee;
        item.amount = amount;
        item.memo = memo;
        item.evidenceUri = evidenceUri;
        item.evidenceHash = evidenceHash;
        item.cycle = t.currentCycle;
        item.createdAt = block.timestamp;

        _tabCycleItemIds[tabId][t.currentCycle].push(itemId);

        emit ChargeRecorded(tabId, itemId, t.currentCycle, t.payer, t.payee, amount, evidenceHash);
    }

    function closeCycle(bytes32 tabId) external returns (bytes32 statementId) {
        Tab storage t = tabs[tabId];
        if (!t.active) revert TabNotActive();
        if (msg.sender != t.payer && msg.sender != t.payee) revert NotTabMember();
        if (block.timestamp < _cycleStartedAt[tabId][t.currentCycle] + t.cycleSeconds) revert CycleTooEarly();

        uint256 cycle = t.currentCycle;
        bytes32[] storage cycleItems = _tabCycleItemIds[tabId][cycle];

        bytes32[] memory itemIds = new bytes32[](cycleItems.length);
        uint256[] memory amounts = new uint256[](cycleItems.length);
        uint256 netAmount;

        for (uint256 i = 0; i < cycleItems.length; i++) {
            bytes32 id = cycleItems[i];
            itemIds[i] = id;
            uint256 amount = lineItems[id].amount;
            amounts[i] = amount;
            netAmount += amount;
        }

        _sortByItemId(itemIds, amounts);
        bytes32 statementHash = _computeStatementHash(itemIds, amounts);

        uint256 nonce = ++_statementNonce;
        statementId = keccak256(abi.encodePacked(block.timestamp, msg.sender, tabId, cycle, statementHash, nonce));

        Statement storage s = statements[statementId];
        s.statementId = statementId;
        s.tabId = tabId;
        s.cycle = cycle;
        s.closedAt = block.timestamp;
        s.closedBy = msg.sender;
        s.statementHash = statementHash;
        s.status = StatementStatus.Open;
        s.netAmount = netAmount;
        s.itemIds = cycleItems;

        _tabStatementIds[tabId].push(statementId);

        t.currentCycle = cycle + 1;
        _cycleStartedAt[tabId][t.currentCycle] = block.timestamp;

        emit CycleClosed(tabId, statementId, cycle, statementHash, netAmount, msg.sender);
    }

    function acceptStatement(bytes32 statementId) external {
        Statement storage s = statements[statementId];
        if (s.closedAt == 0) revert StatementNotOpen();
        if (s.status != StatementStatus.Open) revert StatementNotOpen();

        Tab storage t = tabs[s.tabId];
        if (msg.sender != t.payee) revert NotPayee();

        s.status = StatementStatus.Accepted;
        s.acceptedBy = msg.sender;
        s.acceptedAt = block.timestamp;

        emit StatementAccepted(statementId, msg.sender, s.acceptedAt);
    }

    function settleStatement(bytes32 statementId) external nonReentrant {
        Statement storage s = statements[statementId];
        if (s.closedAt == 0) revert StatementNotOpen();

        Tab storage t = tabs[s.tabId];
        if (msg.sender != t.payer) revert NotPayer();
        if (s.status != StatementStatus.Accepted && s.status != StatementStatus.Resolved) revert NotSettleable();

        uint256 netAmount = s.netAmount;

        s.status = StatementStatus.Settled;

        usdc.safeTransferFrom(msg.sender, t.payee, netAmount);

        emit StatementSettled(statementId, netAmount, t.payer, t.payee);
    }

    function openDispute(
        bytes32 statementId,
        bytes32 itemId,
        string calldata claimKind,
        string calldata claim
    ) external returns (bytes32 disputeId) {
        Statement storage s = statements[statementId];
        if (s.closedAt == 0) revert StatementNotOpen();
        if (
            s.status != StatementStatus.Open &&
            s.status != StatementStatus.Accepted &&
            s.status != StatementStatus.Disputed
        ) {
            revert StatementNotOpen();
        }

        if (block.timestamp > s.closedAt + disputeWindowSeconds) revert DisputeWindowExpired();

        Tab storage t = tabs[s.tabId];
        if (msg.sender != t.payer) revert NotPayer();

        if (!_statementContainsItem(s, itemId)) revert ItemNotInTab();
        if (disputeByStatementAndItem[statementId][itemId] != bytes32(0)) revert DuplicateDispute();
        if (!_isValidClaimKind(claimKind)) revert InvalidOutcome();

        uint256 nonce = ++_disputeNonce;
        disputeId = keccak256(abi.encodePacked(block.timestamp, msg.sender, statementId, itemId, nonce));

        disputeByStatementAndItem[statementId][itemId] = disputeId;

        Dispute storage d = disputes[disputeId];
        d.disputeId = disputeId;
        d.statementId = statementId;
        d.itemId = itemId;
        d.claimant = msg.sender;
        d.claimKind = claimKind;
        d.claim = claim;
        d.bondAmount = bondAmount;
        d.status = DisputeStatus.Pending;
        d.openedAt = block.timestamp;

        statementDisputeCount[statementId] += 1;
        s.status = StatementStatus.Disputed;

        usdc.safeTransferFrom(msg.sender, address(this), bondAmount);

        emit DisputeOpened(statementId, disputeId, itemId, msg.sender, bondAmount, claimKind);
    }

    function submitRuling(
        bytes32 disputeId,
        string calldata outcome,
        uint256 revisedItemAmount,
        uint256 claimantBondAward,
        bool evidenceHashMatched,
        string calldata rationale
    ) external nonReentrant {
        if (msg.sender != arbitrator) revert NotArbitrator();

        Dispute storage d = disputes[disputeId];
        if (d.openedAt == 0 || d.status != DisputeStatus.Pending) revert StatementNotOpen();

        Statement storage s = statements[d.statementId];
        LineItem storage item = lineItems[d.itemId];
        Tab storage t = tabs[s.tabId];

        bytes32 outcomeHash = keccak256(bytes(outcome));
        if (outcomeHash != OUTCOME_UPHELD && outcomeHash != OUTCOME_ADJUSTED && outcomeHash != OUTCOME_REJECTED) {
            revert InvalidOutcome();
        }

        if (revisedItemAmount > item.amount) revert AdjustedAmountTooLarge();
        if (claimantBondAward > d.bondAmount) revert AdjustedAmountTooLarge();

        d.status = DisputeStatus.Resolved;
        d.outcome = outcome;
        d.revisedItemAmount = revisedItemAmount;
        d.claimantBondAward = claimantBondAward;
        d.rationale = rationale;
        d.evidenceHashMatched = evidenceHashMatched;
        d.resolvedAt = block.timestamp;

        if (outcomeHash == OUTCOME_ADJUSTED && revisedItemAmount < item.amount) {
            uint256 adjustment = item.amount - revisedItemAmount;
            if (adjustment <= s.netAmount) {
                s.netAmount -= adjustment;
            }
        }

        if (d.bondCredited) revert DuplicateDispute();
        d.bondCredited = true;

        uint256 payeePortion = d.bondAmount - claimantBondAward;

        if (claimantBondAward > 0) {
            credits[d.claimant] += claimantBondAward;
            emit BondCredited(disputeId, d.claimant, claimantBondAward);
        }

        if (payeePortion > 0) {
            credits[t.payee] += payeePortion;
            emit BondCredited(disputeId, t.payee, payeePortion);
        }

        statementResolvedDisputeCount[d.statementId] += 1;
        if (statementResolvedDisputeCount[d.statementId] == statementDisputeCount[d.statementId]) {
            s.status = StatementStatus.Resolved;
        }

        emit RulingSubmitted(
            disputeId,
            d.statementId,
            outcome,
            revisedItemAmount,
            claimantBondAward,
            evidenceHashMatched
        );
    }

    function withdraw(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();

        uint256 available = credits[msg.sender];
        if (available < amount) revert InsufficientCredit();

        credits[msg.sender] = available - amount;
        usdc.safeTransfer(msg.sender, amount);

        emit Withdrawn(msg.sender, amount);
    }

    function setArbitrator(address newArbitrator) external onlyOwner {
        if (newArbitrator == address(0)) revert ZeroAddress();
        address oldArbitrator = arbitrator;
        arbitrator = newArbitrator;
        emit ArbitratorChanged(oldArbitrator, newArbitrator);
    }

    function setBondAmount(uint256 newBond) external onlyOwner {
        if (newBond == 0) revert ZeroBond();
        bondAmount = newBond;
    }

    function setDisputeWindow(uint256 newWindow) external onlyOwner {
        if (newWindow == 0) revert ZeroWindow();
        disputeWindowSeconds = newWindow;
    }

    function getTabCycleItemIds(bytes32 tabId, uint256 cycle) external view returns (bytes32[] memory) {
        return _tabCycleItemIds[tabId][cycle];
    }

    function getStatementItemIds(bytes32 statementId) external view returns (bytes32[] memory) {
        return statements[statementId].itemIds;
    }

    function getTab(bytes32 tabId) external view returns (Tab memory) {
        return tabs[tabId];
    }

    function getItem(bytes32 itemId) external view returns (LineItem memory) {
        return lineItems[itemId];
    }

    function getDispute(bytes32 disputeId) external view returns (Dispute memory) {
        return disputes[disputeId];
    }

    function getStatement(bytes32 statementId) external view returns (Statement memory) {
        return statements[statementId];
    }

    function getTabStatementIds(bytes32 tabId) external view returns (bytes32[] memory) {
        return _tabStatementIds[tabId];
    }

    function getCredit(address account) external view returns (uint256) {
        return credits[account];
    }

    function _computeStatementHash(bytes32[] memory itemIds, uint256[] memory amounts) private pure returns (bytes32) {
        bytes memory packed;
        for (uint256 i = 0; i < itemIds.length; i++) {
            packed = abi.encodePacked(packed, itemIds[i], amounts[i]);
        }
        return keccak256(packed);
    }

    function _sortByItemId(bytes32[] memory itemIds, uint256[] memory amounts) private pure {
        uint256 len = itemIds.length;
        for (uint256 i = 0; i < len; i++) {
            for (uint256 j = i + 1; j < len; j++) {
                if (itemIds[j] < itemIds[i]) {
                    (itemIds[i], itemIds[j]) = (itemIds[j], itemIds[i]);
                    (amounts[i], amounts[j]) = (amounts[j], amounts[i]);
                }
            }
        }
    }

    function _statementContainsItem(Statement storage s, bytes32 itemId) private view returns (bool) {
        uint256 len = s.itemIds.length;
        for (uint256 i = 0; i < len; i++) {
            if (s.itemIds[i] == itemId) {
                return true;
            }
        }
        return false;
    }

    function _isValidClaimKind(string calldata claimKind) private pure returns (bool) {
        bytes32 kind = keccak256(bytes(claimKind));
        return
            kind == CLAIM_NOT_DELIVERED ||
            kind == CLAIM_OFF_SPEC ||
            kind == CLAIM_OVERCHARGED ||
            kind == CLAIM_DUPLICATE ||
            kind == CLAIM_SLA_BREACH;
    }
}
