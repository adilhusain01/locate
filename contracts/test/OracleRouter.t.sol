// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {OracleRouter} from "../src/OracleRouter.sol";
import {MarketCalendar} from "../src/MarketCalendar.sol";
import {IOracleRouter} from "../src/interfaces/IOracleRouter.sol";
import {IAggregatorV3} from "../src/interfaces/IAggregatorV3.sol";
import {MockFeed} from "../src/mocks/MockFeed.sol";
import {MockSequencerFeed} from "../src/mocks/MockSequencerFeed.sol";
import {MockStockToken} from "../src/mocks/MockStockToken.sol";

/// Requirements (docs/spec.md, "Oracle regimes"), with two facts read from mainnet on 2026-10-02: feeds answer
/// with 8 decimals per raw token, and the pause flag lives on the Stock Token (`oraclePaused()`), not the feed.
///  O1 prices are scaled from feed decimals to 1e18
///  O2 Open: session open and the print is within heartbeat plus grace; borrowing allowed
///  O3 Degraded: session open but the print is older than that; borrowing blocked, price still served
///  O4 Closed: session closed; borrowing allowed except in the last 30 minutes before the next open
///  O5 Paused: token oraclePaused or paused, sequencer down, or sequencer back for less than the grace period
///  O6 USDG is worth min(1, feed) and 1 when the feed is missing, stale or broken
///  O7 an unconfigured token or a non-positive answer reverts instead of pricing at zero
contract OracleRouterTest is Test {
    uint256 constant WED_OPEN = 1791385200;
    uint256 constant SAT_CLOSED = 1791028800;
    uint256 constant SUN_1900_ET = 1791154800; // one hour before the session opens
    uint256 constant SUN_1945_ET = 1791157500; // inside the pre-open guard

    MarketCalendar cal;
    OracleRouter router;
    MockFeed feed;
    MockFeed usdgFeed;
    MockSequencerFeed sequencer;
    MockStockToken nvda;
    address outsider = makeAddr("outsider");

    function setUp() public {
        vm.warp(WED_OPEN);
        cal = new MarketCalendar(address(this));
        router = new OracleRouter(cal, address(this));
        nvda = new MockStockToken("NVIDIA Robinhood Token", "NVDA", address(this));
        feed = new MockFeed(8, "RHNVDA / USD", address(this));
        usdgFeed = new MockFeed(8, "USDG / USD", address(this));
        sequencer = new MockSequencerFeed(address(this));
        feed.setAnswer(23755399953, block.timestamp);
        router.setFeed(address(nvda), IAggregatorV3(address(feed)), 1 days);
    }

    function _regime() internal view returns (IOracleRouter.Regime) {
        return router.quote(address(nvda)).regime;
    }

    // ------------------------------------------------------------------ O1, O2

    function test_priceIsScaledToWad() public view {
        IOracleRouter.Quote memory q = router.quote(address(nvda));
        assertEq(q.priceWad, 237.55399953e18);
        assertEq(q.updatedAt, block.timestamp);
    }

    function test_openSessionWithFreshPrintIsOpen() public view {
        assertEq(uint8(_regime()), uint8(IOracleRouter.Regime.Open));
        assertTrue(router.borrowAllowed(address(nvda)));
    }

    // ------------------------------------------------------------------ O3

    function test_stalePrintDuringTheSessionIsDegraded() public {
        feed.setAnswer(23755399953, block.timestamp - 25 hours - 1);
        assertEq(uint8(_regime()), uint8(IOracleRouter.Regime.Degraded));
        assertFalse(router.borrowAllowed(address(nvda)));
        assertEq(router.quote(address(nvda)).priceWad, 237.55399953e18, "price is still served");
        feed.setAnswer(23755399953, block.timestamp - 25 hours);
        assertEq(uint8(_regime()), uint8(IOracleRouter.Regime.Open), "heartbeat plus one hour grace is the limit");
    }

    // ------------------------------------------------------------------ O4

    function test_closedSessionServesLastPrintAndGuardsTheOpen() public {
        vm.warp(SAT_CLOSED);
        assertEq(uint8(_regime()), uint8(IOracleRouter.Regime.Closed));
        assertTrue(router.borrowAllowed(address(nvda)), "weekend borrows allowed on the last print");
        vm.warp(SUN_1900_ET);
        assertTrue(router.borrowAllowed(address(nvda)));
        vm.warp(SUN_1945_ET);
        assertEq(uint8(_regime()), uint8(IOracleRouter.Regime.Closed));
        assertFalse(router.borrowAllowed(address(nvda)), "pre-open guard");
    }

    // ------------------------------------------------------------------ O5

    function test_tokenFlagsPauseTheMarket() public {
        nvda.setOraclePaused(true);
        assertEq(uint8(_regime()), uint8(IOracleRouter.Regime.Paused));
        assertFalse(router.borrowAllowed(address(nvda)));
        nvda.setOraclePaused(false);
        nvda.pause();
        assertEq(uint8(_regime()), uint8(IOracleRouter.Regime.Paused));
        nvda.unpause();
        assertEq(uint8(_regime()), uint8(IOracleRouter.Regime.Open));
    }

    function test_sequencerOutageAndGracePauseTheMarket() public {
        router.setSequencerFeed(IAggregatorV3(address(sequencer)), 1 hours);
        assertFalse(router.sequencerHealthy(), "feed deployed just now: inside the grace period");
        assertEq(uint8(_regime()), uint8(IOracleRouter.Regime.Paused));
        vm.warp(block.timestamp + 1 hours);
        feed.setAnswer(23755399953, block.timestamp);
        assertTrue(router.sequencerHealthy());
        assertEq(uint8(_regime()), uint8(IOracleRouter.Regime.Open));

        sequencer.setDown(true);
        assertEq(uint8(_regime()), uint8(IOracleRouter.Regime.Paused));
        sequencer.setDown(false);
        assertEq(uint8(_regime()), uint8(IOracleRouter.Regime.Paused), "still inside the grace period");
        vm.warp(block.timestamp + 1 hours);
        feed.setAnswer(23755399953, block.timestamp);
        assertEq(uint8(_regime()), uint8(IOracleRouter.Regime.Open));
    }

    // ------------------------------------------------------------------ O6

    function test_usdgPriceIsCappedAtOne() public {
        assertEq(router.usdgPriceWad(), 1e18, "no feed configured");
        router.setUsdgFeed(IAggregatorV3(address(usdgFeed)), 1 days);
        usdgFeed.setAnswer(99_800_000, block.timestamp);
        assertEq(router.usdgPriceWad(), 0.998e18);
        usdgFeed.setAnswer(100_200_000, block.timestamp);
        assertEq(router.usdgPriceWad(), 1e18);
        usdgFeed.setAnswer(99_000_000, block.timestamp - 26 hours);
        assertEq(router.usdgPriceWad(), 1e18, "stale feed falls back to par");
        usdgFeed.setAnswer(0, block.timestamp);
        assertEq(router.usdgPriceWad(), 1e18, "broken feed falls back to par");
    }

    // ------------------------------------------------------------------ O7, admin

    function test_unconfiguredOrBrokenFeedsRevert() public {
        vm.expectRevert(abi.encodeWithSelector(OracleRouter.FeedNotConfigured.selector, address(usdgFeed)));
        router.quote(address(usdgFeed));
        feed.setAnswer(0, block.timestamp);
        vm.expectRevert(abi.encodeWithSelector(OracleRouter.InvalidAnswer.selector, address(feed), 0));
        router.quote(address(nvda));
    }

    function test_onlyOwnerConfigures() public {
        vm.prank(outsider);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, outsider));
        router.setFeed(address(nvda), IAggregatorV3(address(feed)), 1 days);
    }
}
