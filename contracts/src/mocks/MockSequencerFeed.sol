// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Chainlink L2 sequencer uptime feed shape: answer 0 means up, 1 means down, startedAt is when the
///         current status began.
contract MockSequencerFeed is Ownable {
    uint80 private _roundId;
    int256 private _answer;
    uint256 private _startedAt;

    constructor(address owner_) Ownable(owner_) {
        _startedAt = block.timestamp;
    }

    function setDown(bool down) external onlyOwner {
        _roundId += 1;
        _answer = down ? int256(1) : int256(0);
        _startedAt = block.timestamp;
    }

    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
    {
        return (_roundId, _answer, _startedAt, _startedAt, _roundId);
    }
}
