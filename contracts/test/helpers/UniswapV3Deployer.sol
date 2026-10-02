// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Vm} from "forge-std/Vm.sol";

/// @notice Deploys the real Uniswap v3 factory and SwapRouter from the vendored Hardhat artifacts.
library UniswapV3Deployer {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function deployFactory() internal returns (address factory) {
        bytes memory code = vm.parseJsonBytes(vm.readFile("external/uniswap-v3/UniswapV3Factory.json"), ".bytecode");
        factory = _create(code);
    }

    function deploySwapRouter(address factory, address weth) internal returns (address router) {
        bytes memory code = vm.parseJsonBytes(vm.readFile("external/uniswap-v3/SwapRouter.json"), ".bytecode");
        router = _create(abi.encodePacked(code, abi.encode(factory, weth)));
    }

    function _create(bytes memory initCode) private returns (address deployed) {
        assembly {
            deployed := create(0, add(initCode, 0x20), mload(initCode))
        }
        require(deployed != address(0), "deploy failed");
    }
}
