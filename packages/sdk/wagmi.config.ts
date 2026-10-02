import { defineConfig } from "@wagmi/cli";
import { foundry } from "@wagmi/cli/plugins";

export default defineConfig({
  out: "src/abis.ts",
  plugins: [
    foundry({
      project: "../../contracts",
      include: [
        "Controller.sol/**",
        "LendingPool.sol/**",
        "OracleRouter.sol/**",
        "MarketCalendar.sol/**",
        "RiskMathRef.sol/**",
        "ShortRouter.sol/**",
        "Liquidator.sol/**",
        "LiquiditySeeder.sol/**",
        "MockStockToken.sol/**",
        "MockUSDG.sol/**",
        "MockFeed.sol/**",
        "MockSequencerFeed.sol/**",
        "IUniswapV3.sol/**",
        "ISwapRouterV3.sol/**",
      ],
    }),
  ],
});
