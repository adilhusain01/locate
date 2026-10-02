// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IOracleRouter} from "./interfaces/IOracleRouter.sol";
import {IAggregatorV3} from "./interfaces/IAggregatorV3.sol";
import {IStockTokenFlags} from "./interfaces/IStockTokenFlags.sol";
import {MarketCalendar} from "./MarketCalendar.sol";

/// @title OracleRouter (Solidity v0)
/// @notice Chainlink per-token prices with the regime the market is in. Robinhood Chain feeds price one raw
///         token (multiplier included) and update 24/5, so the regime leans on the MarketCalendar: outside the
///         session the last print is served as Closed, a stale print inside the session is Degraded, and a
///         paused token or an unhealthy sequencer is Paused. The pool TWAP cross-check and the price band arrive
///         with the Stylus router; this version is the behavioural reference for it.
contract OracleRouter is IOracleRouter, Ownable {
    uint256 public constant WAD = 1e18;

    struct FeedConfig {
        IAggregatorV3 feed;
        uint8 decimals;
        uint32 heartbeat;
        bool configured;
    }

    MarketCalendar public calendar;
    IAggregatorV3 public sequencerFeed;
    IAggregatorV3 public usdgFeed;
    uint256 public sequencerGrace = 1 hours;
    uint256 public stalenessGrace = 1 hours;
    uint256 public usdgHeartbeat = 1 days;
    uint256 public preOpenGuard = 30 minutes;
    mapping(address token => FeedConfig) public feeds;

    event FeedSet(address indexed token, address feed, uint8 decimals, uint32 heartbeat);
    event SequencerFeedSet(address feed, uint256 grace);
    event UsdgFeedSet(address feed, uint256 heartbeat);
    event GuardsSet(uint256 stalenessGrace, uint256 preOpenGuard);

    error FeedNotConfigured(address token);
    error InvalidAnswer(address feed, int256 answer);
    error InvalidDecimals();

    constructor(MarketCalendar calendar_, address owner_) Ownable(owner_) {
        calendar = calendar_;
    }

    // ------------------------------------------------------------------ admin

    function setFeed(address token, IAggregatorV3 feed, uint32 heartbeat) external onlyOwner {
        uint8 decimals = feed.decimals();
        if (decimals > 18) revert InvalidDecimals();
        feeds[token] = FeedConfig({feed: feed, decimals: decimals, heartbeat: heartbeat, configured: true});
        emit FeedSet(token, address(feed), decimals, heartbeat);
    }

    function setSequencerFeed(IAggregatorV3 feed, uint256 grace) external onlyOwner {
        sequencerFeed = feed;
        sequencerGrace = grace;
        emit SequencerFeedSet(address(feed), grace);
    }

    function setUsdgFeed(IAggregatorV3 feed, uint256 heartbeat) external onlyOwner {
        usdgFeed = feed;
        usdgHeartbeat = heartbeat;
        emit UsdgFeedSet(address(feed), heartbeat);
    }

    function setGuards(uint256 stalenessGrace_, uint256 preOpenGuard_) external onlyOwner {
        stalenessGrace = stalenessGrace_;
        preOpenGuard = preOpenGuard_;
        emit GuardsSet(stalenessGrace_, preOpenGuard_);
    }

    // ------------------------------------------------------------------ views

    /// @inheritdoc IOracleRouter
    function quote(address token) public view returns (Quote memory q) {
        FeedConfig memory c = feeds[token];
        if (!c.configured) revert FeedNotConfigured(token);
        (, int256 answer,, uint256 updatedAt,) = c.feed.latestRoundData();
        if (answer <= 0) revert InvalidAnswer(address(c.feed), answer);
        q.priceWad = uint256(answer) * (10 ** (18 - c.decimals));
        q.updatedAt = updatedAt;
        q.regime = _regime(token, updatedAt, c.heartbeat);
    }

    /// @inheritdoc IOracleRouter
    function borrowAllowed(address token) external view returns (bool) {
        Quote memory q = quote(token);
        if (q.regime == Regime.Paused || q.regime == Regime.Degraded) return false;
        if (q.regime == Regime.Closed && calendar.nextOpen(block.timestamp) - block.timestamp <= preOpenGuard) {
            return false;
        }
        return true;
    }

    /// @inheritdoc IOracleRouter
    function usdgPriceWad() external view returns (uint256) {
        if (address(usdgFeed) == address(0)) return WAD;
        (, int256 answer,, uint256 updatedAt,) = usdgFeed.latestRoundData();
        if (answer <= 0 || block.timestamp > updatedAt + usdgHeartbeat + stalenessGrace) return WAD;
        uint256 price = uint256(answer) * (10 ** (18 - usdgFeed.decimals()));
        return price < WAD ? price : WAD;
    }

    function sequencerHealthy() public view returns (bool) {
        if (address(sequencerFeed) == address(0)) return true;
        (, int256 answer, uint256 startedAt,,) = sequencerFeed.latestRoundData();
        if (answer != 0) return false;
        return block.timestamp - startedAt >= sequencerGrace;
    }

    function tokenPaused(address token) public view returns (bool) {
        try IStockTokenFlags(token).oraclePaused() returns (bool paused) {
            if (paused) return true;
        } catch {}
        try IStockTokenFlags(token).paused() returns (bool paused) {
            return paused;
        } catch {}
        return false;
    }

    // ------------------------------------------------------------------ internals

    function _regime(address token, uint256 updatedAt, uint256 heartbeat) internal view returns (Regime) {
        if (tokenPaused(token) || !sequencerHealthy()) return Regime.Paused;
        if (!calendar.isOpen(block.timestamp)) return Regime.Closed;
        if (block.timestamp > updatedAt + heartbeat + stalenessGrace) return Regime.Degraded;
        return Regime.Open;
    }
}
