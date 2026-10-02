// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @notice Conservative USD prices per raw token plus the regime the market is in.
interface IOracleRouter {
    enum Regime {
        Open, // fresh Chainlink print during the 24/5 session
        Closed, // session closed: pool price clamped to a band around the last print
        Paused, // feed paused, sequencer down or recently restarted: no new borrows
        Degraded // sources disagree or the feed is stale while the session is open: no new borrows
    }

    struct Quote {
        uint256 priceWad; // USD per whole token, 1e18, already the conservative (higher) side
        Regime regime;
        uint256 updatedAt; // timestamp of the Chainlink print the quote rests on
    }

    function quote(address token) external view returns (Quote memory);
    function usdgPriceWad() external view returns (uint256);
    function borrowAllowed(address token) external view returns (bool);
}
