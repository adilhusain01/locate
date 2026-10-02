import { createConfig } from "ponder";
import { controllerAbi, lendingPoolAbi, liquidatorAbi, shortRouterAbi } from "@locate/sdk/abis";
import { deployment } from "@locate/sdk/deployments";

const d = deployment(46630);
const startBlock = d.deployedBlock ?? 0;

export default createConfig({
  chains: {
    robinhoodTestnet: {
      id: 46630,
      rpc: process.env.PONDER_RPC_URL_46630 ?? "https://rpc.testnet.chain.robinhood.com",
    },
  },
  contracts: {
    Controller: { chain: "robinhoodTestnet", abi: controllerAbi, address: d.controller, startBlock },
    LendingPool: { chain: "robinhoodTestnet", abi: lendingPoolAbi, address: d.pools, startBlock },
    ShortRouter: { chain: "robinhoodTestnet", abi: shortRouterAbi, address: d.shortRouter, startBlock },
    Liquidator: { chain: "robinhoodTestnet", abi: liquidatorAbi, address: d.liquidator, startBlock },
  },
});
