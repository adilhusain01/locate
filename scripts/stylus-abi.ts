import { parseAbi } from "viem";

export const calendarAbi = parseAbi([
  "function initialize(address owner)",
  "function owner() view returns (address)",
  "function setHoliday(uint256 year, uint256 month, uint256 day, bool closed)",
  "function holiday(uint256 sessionDay) view returns (bool)",
  "function daysFromCivil(uint256 year, uint256 month, uint256 day) view returns (uint256)",
  "function isOpen(uint256 timestamp) view returns (bool)",
  "function nextOpen(uint256 timestamp) view returns (uint256)",
  "function closedFor(uint256 timestamp) view returns (uint256)",
]);

export const routerAbi = parseAbi([
  "function initialize(address calendar, uint8 usdgDecimals, address owner)",
  "function owner() view returns (address)",
  "function setFeed(address token, address feed, uint32 heartbeat)",
  "function setTwapPool(address token, address pool, uint32 window)",
  "function setSequencerFeed(address feed, uint256 grace)",
  "function setUsdgFeed(address feed, uint256 heartbeat)",
  "function quote(address token) view returns (uint256 priceWad, uint8 regime, uint256 updatedAt)",
  "function borrowAllowed(address token) view returns (bool)",
  "function usdgPriceWad() view returns (uint256)",
  "function twapPriceWad(address token) view returns (uint256)",
  "function sequencerHealthy() view returns (bool)",
  "function tokenPaused(address token) view returns (bool)",
]);

export const engineAbi = parseAbi([
  "struct PositionInput { uint256 debtRaw; uint256 priceWad; uint256 liqThresholdWad; uint256 initialRatioWad; }",
  "struct IrmParams { uint64 baseWad; uint64 kinkWad; uint64 rateAtKinkWad; uint64 maxRateWad; }",
  "function evaluate(PositionInput[] positions, uint256 collateralValueWad) view returns (uint256, uint256, uint256)",
  "function borrowRate(uint256 utilisationWad, IrmParams params) view returns (uint256)",
  "function dutchDiscount(uint256 elapsed, uint256 minWad, uint256 maxWad, uint256 duration) view returns (uint256)",
]);

export const solidityRouterAbi = parseAbi([
  "function quote(address token) view returns ((uint256 priceWad, uint8 regime, uint256 updatedAt))",
  "function borrowAllowed(address token) view returns (bool)",
  "function usdgPriceWad() view returns (uint256)",
]);

export const controllerAbi = parseAbi([
  "function owner() view returns (address)",
  "function oracle() view returns (address)",
  "function riskEngine() view returns (address)",
  "function setOracle(address oracle)",
  "function setRiskEngine(address engine)",
  "function marketCount() view returns (uint256)",
]);

export const poolAbi = parseAbi(["function increaseObservationCardinalityNext(uint16 n)"]);
export const feedAbi = parseAbi(["function setKeeper(address keeper)", "function keeper() view returns (address)"]);
