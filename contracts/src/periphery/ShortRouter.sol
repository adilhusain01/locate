// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Controller} from "../Controller.sol";
import {IControllerCallback} from "../interfaces/IControllerCallback.sol";
import {ISwapRouterV3} from "../interfaces/ISwapRouterV3.sol";

/// @title ShortRouter
/// @notice One-transaction short and cover on top of the Controller's deferred-check borrow and withdrawal.
///         Short: borrow the tokens, sell them for USDG on Uniswap, credit the USDG as collateral, then the
///         Controller checks the initial ratio with the proceeds counted. Cover: take USDG out of collateral,
///         buy the tokens back, repay, put the change back, then the ratio is checked.
/// @dev    Routes come encoded from the caller, so no venue is hard-coded. Users approve this contract once as
///         an operator on the Controller.
contract ShortRouter is IControllerCallback {
    using SafeERC20 for IERC20;

    Controller public immutable controller;
    IERC20 public immutable usdg;
    ISwapRouterV3 public immutable swapRouter;

    uint256 private _lastAmount;

    event Shorted(address indexed account, address indexed token, uint256 rawAmount, uint256 usdgProceeds);
    event Covered(address indexed account, address indexed token, uint256 rawAmount, uint256 usdgSpent);

    error NotController();

    modifier onlyController() {
        if (msg.sender != address(controller)) revert NotController();
        _;
    }

    constructor(Controller controller_, ISwapRouterV3 swapRouter_) {
        controller = controller_;
        usdg = controller_.usdg();
        swapRouter = swapRouter_;
    }

    /// @notice Borrow `rawAmount` of `token` and sell it along `path` (token first, USDG last).
    function short(address token, uint256 rawAmount, bytes calldata path, uint256 minUsdgOut)
        external
        returns (uint256 usdgProceeds)
    {
        controller.borrowWithCallback(msg.sender, token, rawAmount, address(this), abi.encode(path, minUsdgOut));
        usdgProceeds = _lastAmount;
        _lastAmount = 0;
    }

    /// @notice Buy back `rawAmount` of `token` with up to `maxUsdgIn` of collateral along `path` (token first,
    ///         USDG last, the exactOutput order) and repay it. Any change goes back into collateral.
    function cover(address token, uint256 rawAmount, bytes calldata path, uint256 maxUsdgIn)
        external
        returns (uint256 usdgSpent)
    {
        controller.withdrawWithCallback(msg.sender, maxUsdgIn, address(this), abi.encode(token, rawAmount, path));
        usdgSpent = _lastAmount;
        _lastAmount = 0;
    }

    /// @inheritdoc IControllerCallback
    function onLocateBorrow(address account, address token, uint256 rawAmount, bytes calldata data)
        external
        onlyController
    {
        (bytes memory path, uint256 minUsdgOut) = abi.decode(data, (bytes, uint256));
        IERC20(token).forceApprove(address(swapRouter), rawAmount);
        uint256 proceeds = swapRouter.exactInput(
            ISwapRouterV3.ExactInputParams({
                path: path,
                recipient: address(this),
                deadline: block.timestamp,
                amountIn: rawAmount,
                amountOutMinimum: minUsdgOut
            })
        );
        usdg.forceApprove(address(controller), proceeds);
        controller.depositCollateral(proceeds, account);
        _lastAmount = proceeds;
        emit Shorted(account, token, rawAmount, proceeds);
    }

    /// @inheritdoc IControllerCallback
    function onLocateWithdraw(address account, uint256 usdgAmount, bytes calldata data) external onlyController {
        (address token, uint256 rawAmount, bytes memory path) = abi.decode(data, (address, uint256, bytes));
        usdg.forceApprove(address(swapRouter), usdgAmount);
        uint256 spent = swapRouter.exactOutput(
            ISwapRouterV3.ExactOutputParams({
                path: path,
                recipient: address(this),
                deadline: block.timestamp,
                amountOut: rawAmount,
                amountInMaximum: usdgAmount
            })
        );
        IERC20(token).forceApprove(address(controller), rawAmount);
        controller.repay(token, rawAmount, account);
        uint256 change = usdgAmount - spent;
        if (change > 0) {
            usdg.forceApprove(address(controller), change);
            controller.depositCollateral(change, account);
        }
        _lastAmount = spent;
        emit Covered(account, token, rawAmount, spent);
    }
}
