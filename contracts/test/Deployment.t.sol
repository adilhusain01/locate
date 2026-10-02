// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {LocateDeployer} from "../script/LocateDeployer.sol";
import {Controller} from "../src/Controller.sol";
import {LendingPool} from "../src/LendingPool.sol";
import {ShortRouter} from "../src/periphery/ShortRouter.sol";
import {Liquidator} from "../src/periphery/Liquidator.sol";
import {MockUSDG} from "../src/mocks/MockUSDG.sol";
import {MockFeed} from "../src/mocks/MockFeed.sol";

/// The testnet deployment must come up wired: every configured market listed with a live feed and a seeded
/// Uniswap pool, lending seeded, and the short, cover and flash liquidation flows working end to end.
contract DeploymentTest is Test, LocateDeployer {
    Deployment d;
    address trader = makeAddr("trader");
    address keeper = makeAddr("keeper");

    function setUp() public {
        vm.warp(1791385200); // Wednesday 2026-10-07 15:00 UTC, session open
        MarketConfig[] memory markets = loadConfig("script/config/testnet-markets.json");
        d = deployAll(markets, address(this), true);
        // the sequencer feed starts its grace period at deployment; markets open for borrowing an hour later
        vm.warp(block.timestamp + 1 hours);
    }

    function test_everyMarketIsListedPricedAndSeeded() public view {
        Controller ctl = Controller(d.controller);
        assertGe(d.tokens.length, 8);
        assertEq(ctl.marketCount(), d.tokens.length);
        for (uint256 i; i < d.tokens.length; ++i) {
            assertTrue(ctl.market(d.tokens[i]).listed);
            assertEq(LendingPool(d.pools[i]).totalAssets(), LENDER_SEED_TOKENS);
            assertTrue(d.uniswapPools[i] != address(0));
            assertGt(ctl.oracle().quote(d.tokens[i]).priceWad, 0);
            assertTrue(ctl.oracle().borrowAllowed(d.tokens[i]));
        }
    }

    function test_shortCoverAndFlashLiquidationOnTheDeployedStack() public {
        Controller ctl = Controller(d.controller);
        MockUSDG usdg = MockUSDG(d.usdg);
        address nvda = d.tokens[0];
        uint256 price = ctl.oracle().quote(nvda).priceWad;
        bytes memory path = abi.encodePacked(nvda, uint24(3000), d.usdg);

        // 1,300 USDG of margin for a ~2,375 USDG short: the proceeds take it past the 1.5x initial ratio,
        // and a 30 percent rally takes it below liquidation
        usdg.mint(trader, 1_300e6);
        vm.startPrank(trader);
        usdg.approve(d.controller, 1_300e6);
        ctl.depositCollateral(1_300e6, trader);
        ctl.setOperator(d.shortRouter, true);
        uint256 proceeds = ShortRouter(d.shortRouter).short(nvda, 10e18, path, 0);
        vm.stopPrank();
        assertApproxEqRel(proceeds, 10 * price / 1e12, 0.01e18, "within 1 percent of the oracle value");
        assertEq(ctl.positionOf(trader, nvda), 10e18);

        // the stock rallies 30 percent on the oracle; the pool still trades near the old price
        MockFeed(d.feeds[0]).setAnswer(int256(price * 130 / 100 / 1e10), block.timestamp);
        assertLt(ctl.healthFactor(trader), 1e18);
        vm.prank(keeper);
        uint256 profit = Liquidator(d.liquidator).liquidateWithFlash(trader, nvda, 5e18, path, 1);
        assertGt(profit, 300e6, "paid at 130 percent by the auction, bought near 100 percent on the pool");
        assertEq(ctl.positionOf(trader, nvda), 5e18);

        // the trader covers the rest once the print comes back
        MockFeed(d.feeds[0]).setAnswer(int256(price / 1e10), block.timestamp);
        vm.prank(trader);
        ShortRouter(d.shortRouter).cover(nvda, 5e18, path, 1_500e6);
        assertEq(ctl.positionOf(trader, nvda), 0);
    }
}
