// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console} from "forge-std/Script.sol";
import {LocateDeployer} from "./LocateDeployer.sol";

/// @notice Deploys the whole Locate testnet stack and writes deployments/<chainid>.json.
///         forge script script/DeployTestnet.s.sol --rpc-url robinhood_testnet --broadcast --private-key $DEPLOYER_PRIVATE_KEY
contract DeployTestnet is Script, LocateDeployer {
    function run() external {
        MarketConfig[] memory markets = loadConfig("script/config/testnet-markets.json");
        vm.startBroadcast();
        address owner = msg.sender;
        Deployment memory d = deployAll(markets, owner, true);
        vm.stopBroadcast();
        _write(d);
        console.log("Controller", d.controller);
        console.log("ShortRouter", d.shortRouter);
        console.log("Liquidator", d.liquidator);
        console.log("markets", d.tokens.length);
    }

    function _write(Deployment memory d) internal {
        string memory root = "deployment";
        vm.serializeUint(root, "chainId", block.chainid);
        vm.serializeAddress(root, "usdg", d.usdg);
        vm.serializeAddress(root, "weth", d.weth);
        vm.serializeAddress(root, "uniswapV3Factory", d.factory);
        vm.serializeAddress(root, "swapRouter", d.swapRouter);
        vm.serializeAddress(root, "liquiditySeeder", d.seeder);
        vm.serializeAddress(root, "calendar", d.calendar);
        vm.serializeAddress(root, "oracle", d.oracle);
        vm.serializeAddress(root, "riskEngine", d.riskEngine);
        vm.serializeAddress(root, "controller", d.controller);
        vm.serializeAddress(root, "shortRouter", d.shortRouter);
        vm.serializeAddress(root, "liquidator", d.liquidator);
        vm.serializeAddress(root, "sequencerFeed", d.sequencerFeed);
        vm.serializeAddress(root, "usdgFeed", d.usdgFeed);
        vm.serializeString(root, "tickers", d.tickers);
        vm.serializeAddress(root, "tokens", d.tokens);
        vm.serializeAddress(root, "pools", d.pools);
        vm.serializeAddress(root, "feeds", d.feeds);
        string memory out = vm.serializeAddress(root, "uniswapPools", d.uniswapPools);
        vm.writeJson(out, string.concat("deployments/", vm.toString(block.chainid), ".json"));
    }
}
