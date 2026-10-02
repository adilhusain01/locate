// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Controller} from "../src/Controller.sol";
import {LendingPool} from "../src/LendingPool.sol";
import {RiskMathRef} from "../src/RiskMathRef.sol";
import {ShortRouter} from "../src/periphery/ShortRouter.sol";
import {Liquidator} from "../src/periphery/Liquidator.sol";
import {LiquiditySeeder} from "../src/periphery/LiquiditySeeder.sol";
import {IOracleRouter} from "../src/interfaces/IOracleRouter.sol";
import {IRiskEngine} from "../src/interfaces/IRiskEngine.sol";
import {ISwapRouterV3} from "../src/interfaces/ISwapRouterV3.sol";
import {IUniswapV3Factory, IUniswapV3Pool} from "../src/interfaces/IUniswapV3.sol";
import {MockStockToken} from "../src/mocks/MockStockToken.sol";
import {MockUSDG} from "../src/mocks/MockUSDG.sol";
import {MockWETH} from "../src/mocks/MockWETH.sol";
import {MockOracleRouter} from "../src/mocks/MockOracleRouter.sol";
import {UniswapV3Deployer} from "./helpers/UniswapV3Deployer.sol";

/// The periphery must work against the real Uniswap v3 bytecode, not only the swap mock:
///  U1 the seeder creates and initialises a pool at the given ratio and mints a full-range position
///  U2 a short sells on the real router and books proceeds close to the oracle value (fee and impact aside)
///  U3 a cover buys back on the real router
///  U4 a flash liquidation clears through the real router and pays the keeper
contract UniswapIntegrationTest is Test {
    MockUSDG usdg;
    MockStockToken nvda;
    MockWETH weth;
    IUniswapV3Factory factory;
    ISwapRouterV3 router;
    LiquiditySeeder seeder;
    MockOracleRouter oracle;
    Controller ctl;
    LendingPool pool;
    ShortRouter shortRouter;
    Liquidator liquidator;

    address lp = makeAddr("lp");
    address lender = makeAddr("lender");
    address trader = makeAddr("trader");
    address keeper = makeAddr("keeper");

    function setUp() public {
        usdg = new MockUSDG(address(this));
        nvda = new MockStockToken("NVIDIA Robinhood Token", "NVDA", address(this));
        weth = new MockWETH();
        factory = IUniswapV3Factory(UniswapV3Deployer.deployFactory());
        router = ISwapRouterV3(UniswapV3Deployer.deploySwapRouter(address(factory), address(weth)));
        seeder = new LiquiditySeeder(factory);

        // 10,000 NVDA against 1,000,000 USDG: $100 per share
        nvda.mint(lp, 10_000e18);
        usdg.mint(lp, 1_000_000e6);
        vm.startPrank(lp);
        nvda.approve(address(seeder), type(uint256).max);
        usdg.approve(address(seeder), type(uint256).max);
        seeder.seed(address(nvda), address(usdg), 3000, 10_000e18, 1_000_000e6);
        vm.stopPrank();

        oracle = new MockOracleRouter();
        oracle.setQuote(address(nvda), 100e18, IOracleRouter.Regime.Open);
        ctl = new Controller(IERC20(address(usdg)), oracle, new RiskMathRef(), address(this));
        pool = new LendingPool(IERC20(address(nvda)), "Locate NVDA", "lNVDA", address(ctl), 0.9e18);
        ctl.listMarket(
            address(nvda),
            pool,
            Controller.MarketParams({
                initialRatioWad: 1.5e18,
                liqThresholdWad: 1.25e18,
                dutchMinWad: 0.01e18,
                dutchMaxWad: 0.12e18,
                dutchDuration: 20 minutes,
                borrowCapRaw: 1_000e18,
                irm: IRiskEngine.IrmParams({baseWad: 0.01e18, kinkWad: 0.8e18, rateAtKinkWad: 0.10e18, maxRateWad: 1.5e18})
            })
        );
        shortRouter = new ShortRouter(ctl, router);
        liquidator = new Liquidator(ctl, router);

        nvda.mint(lender, 100e18);
        vm.startPrank(lender);
        nvda.approve(address(pool), 100e18);
        pool.deposit(100e18, lender);
        vm.stopPrank();

        usdg.mint(trader, 600e6);
        vm.startPrank(trader);
        usdg.approve(address(ctl), 600e6);
        ctl.depositCollateral(600e6, trader);
        ctl.setOperator(address(shortRouter), true);
        vm.stopPrank();
    }

    function _path() internal view returns (bytes memory) {
        return abi.encodePacked(address(nvda), uint24(3000), address(usdg));
    }

    function test_seederInitialisesAtTheRatioAndMintsFullRange() public view {
        IUniswapV3Pool p = IUniswapV3Pool(factory.getPool(address(nvda), address(usdg), 3000));
        assertTrue(address(p) != address(0));
        (uint160 sqrtPriceX96,,,,,,) = p.slot0();
        uint256 price = (uint256(sqrtPriceX96) * uint256(sqrtPriceX96)) >> 96; // token1 per token0, Q96
        uint256 expected = p.token0() == address(nvda)
            ? (uint256(1_000_000e6) << 96) / 10_000e18
            : (uint256(10_000e18) << 96) / 1_000_000e6;
        assertApproxEqRel(price, expected, 1e12);
        assertGt(p.liquidity(), 0);
        assertLt(nvda.balanceOf(lp), 1e18, "nearly all NVDA went into the pool");
    }

    function test_shortSellsOnTheRealRouter() public {
        vm.prank(trader);
        uint256 proceeds = shortRouter.short(address(nvda), 10e18, _path(), 990e6);
        assertGt(proceeds, 996e6, "0.3 percent fee plus tiny impact on a deep pool");
        assertLt(proceeds, 1_000e6);
        assertEq(ctl.collateralOf(trader), 600e6 + proceeds);
        assertEq(ctl.positionOf(trader, address(nvda)), 10e18);
    }

    function test_coverBuysBackOnTheRealRouter() public {
        vm.prank(trader);
        uint256 proceeds = shortRouter.short(address(nvda), 10e18, _path(), 0);
        vm.prank(trader);
        uint256 spent = shortRouter.cover(address(nvda), 10e18, _path(), 1_020e6);
        assertGt(spent, 1_000e6);
        assertLt(spent, 1_010e6);
        assertEq(ctl.positionOf(trader, address(nvda)), 0);
        assertEq(ctl.collateralOf(trader), 600e6 + proceeds - spent, "round trip cost is fee and impact");
    }

    function test_flashLiquidationClearsThroughTheRealRouter() public {
        usdg.mint(trader, 900e6);
        vm.startPrank(trader);
        usdg.approve(address(ctl), 900e6);
        ctl.depositCollateral(900e6, trader); // 1500 total
        ctl.borrow(address(nvda), 10e18, trader);
        vm.stopPrank();
        oracle.setQuote(address(nvda), 125e18, IOracleRouter.Regime.Open); // oracle says $125, pool still near $100

        vm.prank(keeper);
        uint256 profit = liquidator.liquidateWithFlash(trader, address(nvda), 5e18, _path(), 100e6);
        assertGt(profit, 100e6, "bought near 100 on the pool, paid at 125 by the auction");
        assertEq(usdg.balanceOf(keeper), profit);
        assertEq(ctl.positionOf(trader, address(nvda)), 5e18);
    }
}
