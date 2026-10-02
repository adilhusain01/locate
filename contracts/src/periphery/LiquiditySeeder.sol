// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IUniswapV3Factory, IUniswapV3Pool, IUniswapV3MintCallback} from "../interfaces/IUniswapV3.sol";

/// @title LiquiditySeeder
/// @notice Creates a Uniswap v3 pool if needed, initialises it at the ratio of the two amounts and mints one
///         full-range position for the caller. Testnet tooling: it needs no NonfungiblePositionManager.
contract LiquiditySeeder is IUniswapV3MintCallback {
    using SafeERC20 for IERC20;

    int24 internal constant MIN_TICK = -887272;
    int24 internal constant MAX_TICK = 887272;
    uint256 internal constant Q96 = 2 ** 96;

    IUniswapV3Factory public immutable factory;

    error NotPool();

    constructor(IUniswapV3Factory factory_) {
        factory = factory_;
    }

    /// @notice Seed `amountA` of `tokenA` and `amountB` of `tokenB` across the full range at fee tier `fee`.
    ///         A new pool is initialised at amountB per amountA.
    function seed(address tokenA, address tokenB, uint24 fee, uint256 amountA, uint256 amountB)
        external
        returns (address pool, uint128 liquidity, uint256 used0, uint256 used1)
    {
        (address token0, address token1, uint256 amount0, uint256 amount1) =
            tokenA < tokenB ? (tokenA, tokenB, amountA, amountB) : (tokenB, tokenA, amountB, amountA);
        pool = _poolFor(token0, token1, fee, amount0, amount1);
        liquidity = _fullRangeLiquidity(pool, amount0, amount1);
        IERC20(token0).safeTransferFrom(msg.sender, address(this), amount0);
        IERC20(token1).safeTransferFrom(msg.sender, address(this), amount1);
        (used0, used1) = _mint(pool, token0, token1, fee, liquidity);
        _refund(token0);
        _refund(token1);
    }

    /// @inheritdoc IUniswapV3MintCallback
    function uniswapV3MintCallback(uint256 amount0Owed, uint256 amount1Owed, bytes calldata data) external {
        (address token0, address token1, uint24 fee) = abi.decode(data, (address, address, uint24));
        if (msg.sender != factory.getPool(token0, token1, fee)) revert NotPool();
        if (amount0Owed > 0) IERC20(token0).safeTransfer(msg.sender, amount0Owed);
        if (amount1Owed > 0) IERC20(token1).safeTransfer(msg.sender, amount1Owed);
    }

    // ------------------------------------------------------------------ internals

    function _poolFor(address token0, address token1, uint24 fee, uint256 amount0, uint256 amount1)
        internal
        returns (address pool)
    {
        pool = factory.getPool(token0, token1, fee);
        if (pool == address(0)) pool = factory.createPool(token0, token1, fee);
        (uint160 sqrtPriceX96,,,,,,) = IUniswapV3Pool(pool).slot0();
        if (sqrtPriceX96 == 0) {
            IUniswapV3Pool(pool).initialize(uint160(Math.sqrt(Math.mulDiv(amount1, 2 ** 192, amount0))));
        }
    }

    /// @dev Liquidity implied by each side over the full range; the pool asks for slightly less than this.
    function _fullRangeLiquidity(address pool, uint256 amount0, uint256 amount1) internal view returns (uint128) {
        (uint160 sqrtPriceX96,,,,,,) = IUniswapV3Pool(pool).slot0();
        uint256 fromToken1 = Math.mulDiv(amount1, Q96, sqrtPriceX96);
        uint256 fromToken0 = Math.mulDiv(amount0, sqrtPriceX96, Q96);
        return uint128(Math.min(fromToken0, fromToken1));
    }

    function _mint(address pool, address token0, address token1, uint24 fee, uint128 liquidity)
        internal
        returns (uint256 used0, uint256 used1)
    {
        int24 spacing = IUniswapV3Pool(pool).tickSpacing();
        (used0, used1) = IUniswapV3Pool(pool).mint(
            msg.sender, (MIN_TICK / spacing) * spacing, (MAX_TICK / spacing) * spacing, liquidity, abi.encode(token0, token1, fee)
        );
    }

    function _refund(address token) internal {
        uint256 left = IERC20(token).balanceOf(address(this));
        if (left > 0) IERC20(token).safeTransfer(msg.sender, left);
    }
}
