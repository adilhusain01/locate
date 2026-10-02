// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Vm} from "forge-std/Vm.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Controller} from "../src/Controller.sol";
import {LendingPool} from "../src/LendingPool.sol";
import {RiskMathRef} from "../src/RiskMathRef.sol";
import {MarketCalendar} from "../src/MarketCalendar.sol";
import {OracleRouter} from "../src/OracleRouter.sol";
import {ShortRouter} from "../src/periphery/ShortRouter.sol";
import {Liquidator} from "../src/periphery/Liquidator.sol";
import {LiquiditySeeder} from "../src/periphery/LiquiditySeeder.sol";
import {IAggregatorV3} from "../src/interfaces/IAggregatorV3.sol";
import {IRiskEngine} from "../src/interfaces/IRiskEngine.sol";
import {ISwapRouterV3} from "../src/interfaces/ISwapRouterV3.sol";
import {IUniswapV3Factory} from "../src/interfaces/IUniswapV3.sol";
import {MockUSDG} from "../src/mocks/MockUSDG.sol";
import {MockWETH} from "../src/mocks/MockWETH.sol";
import {MockStockToken} from "../src/mocks/MockStockToken.sol";
import {MockFeed} from "../src/mocks/MockFeed.sol";
import {MockSequencerFeed} from "../src/mocks/MockSequencerFeed.sol";

/// @notice Shared deployment logic for the testnet script and the deployment test. Everything a testnet needs:
///         mock USDG, mock stock tokens with mirrored mainnet prices, feeds, calendar, router, engine,
///         controller, one pool per ticker, the periphery and Uniswap v3 pools seeded with 1,000,000 USDG a side.
abstract contract LocateDeployer {
    Vm internal constant vmDeployer = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    uint24 internal constant POOL_FEE = 3000;
    uint256 internal constant SEED_USDG_PER_MARKET = 1_000_000e6; // deep enough that a 10-share short moves the pool well under 1 percent
    uint256 internal constant LENDER_SEED_TOKENS = 1_000e18;

    struct MarketConfig {
        string ticker;
        string name;
        uint256 price8; // 8-decimal USD price per raw token, as on mainnet
        string tier;
        address token; // zero for a mock to deploy, else an existing Stock Token on this chain
        uint256 lendSeed; // raw units the owner deposits as first lender (mocks: LENDER_SEED_TOKENS)
        uint256 poolSeed; // raw units the owner puts into the Uniswap pool (mocks: worth SEED_USDG_PER_MARKET)
    }

    struct Deployment {
        address usdg;
        address weth;
        address factory;
        address swapRouter;
        address seeder;
        address calendar;
        address oracle;
        address riskEngine;
        address controller;
        address shortRouter;
        address liquidator;
        address sequencerFeed;
        address usdgFeed;
        string[] tickers;
        address[] tokens;
        address[] pools;
        address[] feeds;
        address[] uniswapPools;
    }

    function loadConfig(string memory path) internal view returns (MarketConfig[] memory markets) {
        string memory json = vmDeployer.readFile(path);
        string[] memory tickers = vmDeployer.parseJsonStringArray(json, ".tickers");
        string[] memory names = vmDeployer.parseJsonStringArray(json, ".names");
        string[] memory prices = vmDeployer.parseJsonStringArray(json, ".prices8");
        string[] memory tiers = vmDeployer.parseJsonStringArray(json, ".tiers");
        string[] memory realTickers = vmDeployer.parseJsonStringArray(json, ".real.tickers");
        address[] memory realTokens = vmDeployer.parseJsonAddressArray(json, ".real.tokens");
        string[] memory realPrices = vmDeployer.parseJsonStringArray(json, ".real.prices8");
        string[] memory realLendSeeds = vmDeployer.parseJsonStringArray(json, ".real.lendSeed");
        string[] memory realPoolSeeds = vmDeployer.parseJsonStringArray(json, ".real.poolSeed");

        // real tokens only exist on the chain they were issued on; skip them anywhere else (local tests)
        uint256 realCount;
        for (uint256 i; i < realTokens.length; ++i) {
            if (realTokens[i].code.length > 0) realCount++;
        }
        markets = new MarketConfig[](tickers.length + realCount);
        for (uint256 i; i < tickers.length; ++i) {
            markets[i] = MarketConfig({
                ticker: tickers[i],
                name: names[i],
                price8: vmDeployer.parseUint(prices[i]),
                tier: tiers[i],
                token: address(0),
                lendSeed: LENDER_SEED_TOKENS,
                poolSeed: 0
            });
        }
        uint256 k = tickers.length;
        for (uint256 i; i < realTokens.length; ++i) {
            if (realTokens[i].code.length == 0) continue;
            markets[k++] = MarketConfig({
                ticker: realTickers[i],
                name: string.concat(realTickers[i], " Robinhood Stock Token (faucet)"),
                price8: vmDeployer.parseUint(realPrices[i]),
                tier: "B",
                token: realTokens[i],
                lendSeed: vmDeployer.parseUint(realLendSeeds[i]),
                poolSeed: vmDeployer.parseUint(realPoolSeeds[i])
            });
        }
    }

    function tierParams(string memory tier) internal pure returns (Controller.MarketParams memory p) {
        bool a = keccak256(bytes(tier)) == keccak256("A");
        p.initialRatioWad = a ? 1.5e18 : 2e18;
        p.liqThresholdWad = a ? 1.25e18 : 1.5e18;
        p.dutchMinWad = a ? 0.01e18 : 0.02e18;
        p.dutchMaxWad = a ? 0.12e18 : 0.15e18;
        p.dutchDuration = 20 minutes;
        p.borrowCapRaw = a ? 600e18 : 300e18; // 60 percent of the 1,000 token lender seed, half for tier B
        p.irm = a
            ? IRiskEngine.IrmParams({baseWad: 0.01e18, kinkWad: 0.8e18, rateAtKinkWad: 0.10e18, maxRateWad: 1.5e18})
            : IRiskEngine.IrmParams({baseWad: 0.02e18, kinkWad: 0.8e18, rateAtKinkWad: 0.15e18, maxRateWad: 2e18});
    }

    /// @dev `owner` receives admin of everything and the seeded lender shares. The caller must be `owner`
    ///      (it mints and approves on its behalf).
    function deployAll(MarketConfig[] memory markets, address owner, bool withUniswap)
        internal
        returns (Deployment memory d)
    {
        _deployCore(d, owner, withUniswap);
        _deployMarkets(d, markets, owner, withUniswap);
    }

    function _deployCore(Deployment memory d, address owner, bool withUniswap) internal {
        d.usdg = address(new MockUSDG(owner));
        if (withUniswap) {
            d.weth = address(new MockWETH());
            d.factory = _deployArtifact("external/uniswap-v3/UniswapV3Factory.json", "");
            d.swapRouter = _deployArtifact("external/uniswap-v3/SwapRouter.json", abi.encode(d.factory, d.weth));
            d.seeder = address(new LiquiditySeeder(IUniswapV3Factory(d.factory)));
        }
        d.sequencerFeed = address(new MockSequencerFeed(owner));
        d.usdgFeed = address(new MockFeed(8, "USDG / USD", owner));
        MockFeed(d.usdgFeed).setAnswer(1e8, block.timestamp);

        d.calendar = address(new MarketCalendar(owner));
        _setHolidays(MarketCalendar(d.calendar));

        d.oracle = address(new OracleRouter(MarketCalendar(d.calendar), owner));
        OracleRouter(d.oracle).setUsdgFeed(IAggregatorV3(d.usdgFeed), 1 days);
        OracleRouter(d.oracle).setSequencerFeed(IAggregatorV3(d.sequencerFeed), 1 hours);

        d.riskEngine = address(new RiskMathRef());
        d.controller =
            address(new Controller(IERC20(d.usdg), OracleRouter(d.oracle), RiskMathRef(d.riskEngine), owner));
        if (withUniswap) {
            d.shortRouter = address(new ShortRouter(Controller(d.controller), ISwapRouterV3(d.swapRouter)));
            d.liquidator = address(new Liquidator(Controller(d.controller), ISwapRouterV3(d.swapRouter)));
        }
    }

    function _deployMarkets(Deployment memory d, MarketConfig[] memory markets, address owner, bool withUniswap)
        internal
    {
        uint256 n = markets.length;
        d.tickers = new string[](n);
        d.tokens = new address[](n);
        d.pools = new address[](n);
        d.feeds = new address[](n);
        d.uniswapPools = new address[](n);
        for (uint256 i; i < n; ++i) {
            _deployMarket(d, i, markets[i], owner, withUniswap);
        }
    }

    function _deployMarket(Deployment memory d, uint256 i, MarketConfig memory m, address owner, bool withUniswap)
        internal
    {
        d.tickers[i] = m.ticker;
        bool isMock = m.token == address(0);
        MockStockToken stock = isMock ? new MockStockToken(m.name, m.ticker, owner) : MockStockToken(m.token);
        d.tokens[i] = address(stock);

        d.feeds[i] = address(new MockFeed(8, string.concat("RH", m.ticker, " / USD"), owner));
        MockFeed(d.feeds[i]).setAnswer(int256(m.price8), block.timestamp);
        OracleRouter(d.oracle).setFeed(address(stock), IAggregatorV3(d.feeds[i]), 1 days);

        LendingPool lendingPool = new LendingPool(
            IERC20(address(stock)), string.concat("Locate ", m.ticker), string.concat("l", m.ticker), d.controller, 0.9e18
        );
        d.pools[i] = address(lendingPool);
        Controller.MarketParams memory params = tierParams(m.tier);
        if (!isMock) params.borrowCapRaw = m.lendSeed * 60 / 100; // faucet balances are small
        Controller(d.controller).listMarket(address(stock), lendingPool, params);

        // first lender: the owner seeds the pool so borrowing works from day one
        if (isMock) stock.mint(owner, m.lendSeed);
        stock.approve(address(lendingPool), m.lendSeed);
        lendingPool.deposit(m.lendSeed, owner);

        if (withUniswap) _seedUniswap(d, i, stock, m, owner, isMock);
    }

    function _seedUniswap(
        Deployment memory d,
        uint256 i,
        MockStockToken stock,
        MarketConfig memory m,
        address owner,
        bool isMock
    ) internal {
        uint256 usdgAmount = SEED_USDG_PER_MARKET;
        uint256 tokenAmount = usdgAmount * 1e12 * 1e8 / m.price8; // tokens worth the USDG seed
        if (!isMock) {
            tokenAmount = m.poolSeed;
            usdgAmount = tokenAmount * m.price8 / 1e8 / 1e12; // USDG worth the tokens we actually hold
        } else {
            stock.mint(owner, tokenAmount);
        }
        MockUSDG(d.usdg).mint(owner, usdgAmount);
        stock.approve(d.seeder, tokenAmount);
        MockUSDG(d.usdg).approve(d.seeder, usdgAmount);
        (d.uniswapPools[i],,,) =
            LiquiditySeeder(d.seeder).seed(address(stock), d.usdg, POOL_FEE, tokenAmount, usdgAmount);
    }

    /// @dev NYSE holidays for the rest of 2026 and 2027. Verify against the exchange calendar each year.
    function _setHolidays(MarketCalendar calendar) internal {
        calendar.setHoliday(2026, 11, 26, true);
        calendar.setHoliday(2026, 12, 25, true);
        calendar.setHoliday(2027, 1, 1, true);
        calendar.setHoliday(2027, 1, 18, true);
        calendar.setHoliday(2027, 2, 15, true);
        calendar.setHoliday(2027, 3, 26, true);
        calendar.setHoliday(2027, 5, 31, true);
        calendar.setHoliday(2027, 6, 18, true);
        calendar.setHoliday(2027, 7, 5, true);
        calendar.setHoliday(2027, 9, 6, true);
        calendar.setHoliday(2027, 11, 25, true);
        calendar.setHoliday(2027, 12, 24, true);
    }

    function _deployArtifact(string memory path, bytes memory constructorArgs) internal returns (address deployed) {
        bytes memory code = vmDeployer.parseJsonBytes(vmDeployer.readFile(path), ".bytecode");
        bytes memory initCode = abi.encodePacked(code, constructorArgs);
        assembly {
            deployed := create(0, add(initCode, 0x20), mload(initCode))
        }
        require(deployed != address(0), "artifact deploy failed");
    }
}
