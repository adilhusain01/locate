//! Locate oracle router on Stylus. Same ABI as `contracts/src/OracleRouter.sol` (`quote`, `borrowAllowed`,
//! `usdgPriceWad`, `sequencerHealthy`, `tokenPaused`) plus the pool leg: a Uniswap v3 TWAP per token, a band
//! around the last Chainlink print that widens with hours since the session closed, and debt valued at the
//! higher of the two. Regimes: 0 Open, 1 Closed, 2 Paused, 3 Degraded.
#![cfg_attr(not(any(test, feature = "export-abi")), no_main)]
extern crate alloc;

pub mod band;
pub mod tick_math;

use alloc::vec::Vec;
use band::{BandParams, BPS, WAD};
use stylus_sdk::{
    alloy_primitives::{Address, I256, U256},
    alloy_sol_types::sol,
    call::RawCall,
    stylus_core::calls::Call,
    prelude::*,
    storage::{StorageAddress, StorageBool, StorageMap, StorageU256, StorageU32, StorageU8},
};

sol_interface! {
    interface IAggregatorV3 {
        function decimals() external view returns (uint8);
        function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80);
    }
    interface IMarketCalendar {
        function isOpen(uint256 timestamp) external view returns (bool);
        function nextOpen(uint256 timestamp) external view returns (uint256);
        function closedFor(uint256 timestamp) external view returns (uint256);
    }
    interface IUniswapV3PoolView {
        function token0() external view returns (address);
        function observe(uint32[] calldata secondsAgos) external view returns (int56[] memory, uint160[] memory);
    }
}

sol! {
    event FeedSet(address indexed token, address feed, uint8 decimals, uint32 heartbeat);
    event TwapPoolSet(address indexed token, address pool, uint32 window, bool stockIsToken0);
    event SequencerFeedSet(address feed, uint256 grace);
    event UsdgFeedSet(address feed, uint256 heartbeat);
    event GuardsSet(uint256 stalenessGrace, uint256 preOpenGuard);
    event BandSet(uint256 baseBps, uint256 perHourBps, uint256 maxBps);

    error FeedNotConfigured(address token);
    error InvalidAnswer(address feed, int256 answer);
    error InvalidDecimals();
    error NotOwner();
    error AlreadyInitialized();
    error ExternalCallFailed();
}

#[derive(SolidityError)]
pub enum RouterError {
    FeedNotConfigured(FeedNotConfigured),
    InvalidAnswer(InvalidAnswer),
    InvalidDecimals(InvalidDecimals),
    NotOwner(NotOwner),
    AlreadyInitialized(AlreadyInitialized),
    ExternalCallFailed(ExternalCallFailed),
}

const REGIME_OPEN: u8 = 0;
const REGIME_CLOSED: u8 = 1;
const REGIME_PAUSED: u8 = 2;
const REGIME_DEGRADED: u8 = 3;

const SEL_ORACLE_PAUSED: [u8; 4] = [0x77, 0x06, 0xba, 0x52]; // oraclePaused()
const SEL_PAUSED: [u8; 4] = [0x5c, 0x97, 0x5a, 0xbb]; // paused()

#[storage]
pub struct FeedConfig {
    feed: StorageAddress,
    decimals: StorageU8,
    heartbeat: StorageU32,
    configured: StorageBool,
    twap_pool: StorageAddress,
    twap_window: StorageU32,
    stock_is_token0: StorageBool,
}

#[storage]
#[entrypoint]
pub struct OracleRouter {
    owner: StorageAddress,
    calendar: StorageAddress,
    sequencer_feed: StorageAddress,
    usdg_feed: StorageAddress,
    usdg_decimals: StorageU8,
    sequencer_grace: StorageU256,
    staleness_grace: StorageU256,
    usdg_heartbeat: StorageU256,
    pre_open_guard: StorageU256,
    band_base_bps: StorageU256,
    band_per_hour_bps: StorageU256,
    band_max_bps: StorageU256,
    open_deviation_bps: StorageU256,
    feeds: StorageMap<Address, FeedConfig>,
}

struct Print {
    price_wad: U256,
    updated_at: U256,
}

impl OracleRouter {
    fn require_owner(&self) -> Result<(), RouterError> {
        if self.vm().msg_sender() != self.owner.get() {
            return Err(RouterError::NotOwner(NotOwner {}));
        }
        Ok(())
    }

    fn now(&self) -> U256 {
        U256::from(self.vm().block_timestamp())
    }

    fn read_feed(&self, feed: Address, decimals: u8) -> Result<Print, RouterError> {
        let (_, answer, _, updated_at, _) = IAggregatorV3::new(feed)
            .latest_round_data(self.vm(), Call::new())
            .map_err(|_| RouterError::ExternalCallFailed(ExternalCallFailed {}))?;
        if answer <= I256::ZERO {
            return Err(RouterError::InvalidAnswer(InvalidAnswer { feed, answer }));
        }
        let scale = U256::from(10u8).pow(U256::from(18 - decimals as u64));
        Ok(Print { price_wad: answer.into_raw() * scale, updated_at })
    }

    /// A static call that may legitimately revert or return nothing (optional token flags).
    fn optional_bool(&self, target: Address, selector: [u8; 4]) -> bool {
        let result = unsafe { RawCall::new_static(self.vm()).call(target, &selector) };
        match result {
            Ok(data) if data.len() >= 32 => data[31] == 1,
            _ => false,
        }
    }

    fn calendar(&self) -> IMarketCalendar {
        IMarketCalendar::new(self.calendar.get())
    }

    fn band_params(&self) -> BandParams {
        BandParams {
            base_bps: self.band_base_bps.get(),
            per_hour_bps: self.band_per_hour_bps.get(),
            max_bps: self.band_max_bps.get(),
        }
    }

    /// Pool TWAP in WAD USD per whole token, or zero when no pool is configured or the pool cannot answer.
    fn twap(&self, token: Address) -> U256 {
        let cfg = self.feeds.get(token);
        let pool = cfg.twap_pool.get();
        if pool.is_zero() {
            return U256::ZERO;
        }
        let window = cfg.twap_window.get().to::<u32>();
        let Ok((ticks, _)) = IUniswapV3PoolView::new(pool).observe(self.vm(), Call::new(), [window, 0u32].to_vec()) else {
            return U256::ZERO;
        };
        if ticks.len() < 2 {
            return U256::ZERO;
        }
        let tick = tick_math::mean_tick(ticks[0].as_i64(), ticks[1].as_i64(), window);
        let Some(sqrt_price) = tick_math::get_sqrt_ratio_at_tick(tick) else {
            return U256::ZERO;
        };
        band::pool_price_wad(sqrt_price, cfg.stock_is_token0.get(), self.usdg_decimals.get().to::<u8>())
            .unwrap_or(U256::ZERO)
    }

    fn regime_and_price(&self, token: Address, print: &Print, heartbeat: U256) -> Result<(u8, U256), RouterError> {
        if self.token_paused(token) || !self.sequencer_healthy() {
            return Ok((REGIME_PAUSED, print.price_wad));
        }
        let now = self.now();
        let open = self
            .calendar()
            .is_open(self.vm(), Call::new(), now)
            .map_err(|_| RouterError::ExternalCallFailed(ExternalCallFailed {}))?;
        let twap = self.twap(token);
        if open {
            if now > print.updated_at + heartbeat + self.staleness_grace.get() {
                return Ok((REGIME_DEGRADED, band::max(print.price_wad, twap)));
            }
            if !twap.is_zero() && band::deviation_bps(twap, print.price_wad) > self.open_deviation_bps.get() {
                return Ok((REGIME_DEGRADED, band::max(print.price_wad, twap)));
            }
            return Ok((REGIME_OPEN, band::max(print.price_wad, twap)));
        }
        let closed_for = self
            .calendar()
            .closed_for(self.vm(), Call::new(), now)
            .map_err(|_| RouterError::ExternalCallFailed(ExternalCallFailed {}))?;
        let band = band::band_bps(&self.band_params(), closed_for / U256::from(3600u64));
        let pool_leg = if twap.is_zero() { print.price_wad } else { band::clamp_to_band(twap, print.price_wad, band) };
        Ok((REGIME_CLOSED, band::max(print.price_wad, pool_leg)))
    }
}

#[public]
impl OracleRouter {
    pub fn initialize(&mut self, calendar: Address, usdg_decimals: u8, owner: Address) -> Result<(), RouterError> {
        if !self.owner.get().is_zero() {
            return Err(RouterError::AlreadyInitialized(AlreadyInitialized {}));
        }
        if usdg_decimals > 18 {
            return Err(RouterError::InvalidDecimals(InvalidDecimals {}));
        }
        self.owner.set(owner);
        self.calendar.set(calendar);
        self.usdg_decimals.set(stylus_sdk::alloy_primitives::Uint::<8, 1>::from(usdg_decimals));
        self.sequencer_grace.set(U256::from(3600u64));
        self.staleness_grace.set(U256::from(3600u64));
        self.usdg_heartbeat.set(U256::from(86_400u64));
        self.pre_open_guard.set(U256::from(1800u64));
        self.band_base_bps.set(U256::from(200u64));
        self.band_per_hour_bps.set(U256::from(10u64));
        self.band_max_bps.set(U256::from(1000u64));
        self.open_deviation_bps.set(U256::from(1000u64));
        Ok(())
    }

    pub fn owner(&self) -> Address {
        self.owner.get()
    }

    pub fn calendar_address(&self) -> Address {
        self.calendar.get()
    }

    // ------------------------------------------------------------------ admin

    pub fn set_feed(&mut self, token: Address, feed: Address, heartbeat: u32) -> Result<(), RouterError> {
        self.require_owner()?;
        let decimals = IAggregatorV3::new(feed)
            .decimals(self.vm(), Call::new())
            .map_err(|_| RouterError::ExternalCallFailed(ExternalCallFailed {}))?;
        if decimals > 18 {
            return Err(RouterError::InvalidDecimals(InvalidDecimals {}));
        }
        let mut cfg = self.feeds.setter(token);
        cfg.feed.set(feed);
        cfg.decimals.set(stylus_sdk::alloy_primitives::Uint::<8, 1>::from(decimals));
        cfg.heartbeat.set(stylus_sdk::alloy_primitives::Uint::<32, 1>::from(heartbeat));
        cfg.configured.set(true);
        self.vm().log(FeedSet { token, feed, decimals, heartbeat });
        Ok(())
    }

    pub fn set_twap_pool(&mut self, token: Address, pool: Address, window: u32) -> Result<(), RouterError> {
        self.require_owner()?;
        let stock_is_token0 = if pool.is_zero() {
            false
        } else {
            IUniswapV3PoolView::new(pool)
                .token_0(self.vm(), Call::new())
                .map_err(|_| RouterError::ExternalCallFailed(ExternalCallFailed {}))?
                == token
        };
        let mut cfg = self.feeds.setter(token);
        cfg.twap_pool.set(pool);
        cfg.twap_window.set(stylus_sdk::alloy_primitives::Uint::<32, 1>::from(window));
        cfg.stock_is_token0.set(stock_is_token0);
        self.vm().log(TwapPoolSet { token, pool, window, stockIsToken0: stock_is_token0 });
        Ok(())
    }

    pub fn set_sequencer_feed(&mut self, feed: Address, grace: U256) -> Result<(), RouterError> {
        self.require_owner()?;
        self.sequencer_feed.set(feed);
        self.sequencer_grace.set(grace);
        self.vm().log(SequencerFeedSet { feed, grace });
        Ok(())
    }

    pub fn set_usdg_feed(&mut self, feed: Address, heartbeat: U256) -> Result<(), RouterError> {
        self.require_owner()?;
        self.usdg_feed.set(feed);
        self.usdg_heartbeat.set(heartbeat);
        self.vm().log(UsdgFeedSet { feed, heartbeat });
        Ok(())
    }

    pub fn set_guards(&mut self, staleness_grace: U256, pre_open_guard: U256) -> Result<(), RouterError> {
        self.require_owner()?;
        self.staleness_grace.set(staleness_grace);
        self.pre_open_guard.set(pre_open_guard);
        self.vm().log(GuardsSet { stalenessGrace: staleness_grace, preOpenGuard: pre_open_guard });
        Ok(())
    }

    pub fn set_band(&mut self, base_bps: U256, per_hour_bps: U256, max_bps: U256, open_deviation_bps: U256) -> Result<(), RouterError> {
        self.require_owner()?;
        if max_bps >= BPS || base_bps > max_bps {
            return Err(RouterError::InvalidDecimals(InvalidDecimals {}));
        }
        self.band_base_bps.set(base_bps);
        self.band_per_hour_bps.set(per_hour_bps);
        self.band_max_bps.set(max_bps);
        self.open_deviation_bps.set(open_deviation_bps);
        self.vm().log(BandSet { baseBps: base_bps, perHourBps: per_hour_bps, maxBps: max_bps });
        Ok(())
    }

    // ------------------------------------------------------------------ views (same ABI as the Solidity router)

    /// quote(address) -> (uint256 priceWad, uint8 regime, uint256 updatedAt)
    pub fn quote(&self, token: Address) -> Result<(U256, u8, U256), RouterError> {
        let cfg = self.feeds.get(token);
        if !cfg.configured.get() {
            return Err(RouterError::FeedNotConfigured(FeedNotConfigured { token }));
        }
        let print = self.read_feed(cfg.feed.get(), cfg.decimals.get().to::<u8>())?;
        let heartbeat = U256::from(cfg.heartbeat.get().to::<u32>());
        let (regime, price) = self.regime_and_price(token, &print, heartbeat)?;
        Ok((price, regime, print.updated_at))
    }

    pub fn borrow_allowed(&self, token: Address) -> Result<bool, RouterError> {
        let (_, regime, _) = self.quote(token)?;
        if regime == REGIME_PAUSED || regime == REGIME_DEGRADED {
            return Ok(false);
        }
        if regime == REGIME_CLOSED {
            let now = self.now();
            let next_open = self
                .calendar()
                .next_open(self.vm(), Call::new(), now)
                .map_err(|_| RouterError::ExternalCallFailed(ExternalCallFailed {}))?;
            if next_open - now <= self.pre_open_guard.get() {
                return Ok(false);
            }
        }
        Ok(true)
    }

    pub fn usdg_price_wad(&self) -> U256 {
        let feed = self.usdg_feed.get();
        if feed.is_zero() {
            return WAD;
        }
        let Ok((_, answer, _, updated_at, _)) = IAggregatorV3::new(feed).latest_round_data(self.vm(), Call::new()) else {
            return WAD;
        };
        if answer <= I256::ZERO || self.now() > updated_at + self.usdg_heartbeat.get() + self.staleness_grace.get() {
            return WAD;
        }
        let Ok(decimals) = IAggregatorV3::new(feed).decimals(self.vm(), Call::new()) else {
            return WAD;
        };
        let price = answer.into_raw() * U256::from(10u8).pow(U256::from(18 - decimals as u64));
        if price < WAD { price } else { WAD }
    }

    pub fn sequencer_healthy(&self) -> bool {
        let feed = self.sequencer_feed.get();
        if feed.is_zero() {
            return true;
        }
        let Ok((_, answer, started_at, _, _)) = IAggregatorV3::new(feed).latest_round_data(self.vm(), Call::new()) else {
            return false;
        };
        if answer != I256::ZERO {
            return false;
        }
        self.now() - started_at >= self.sequencer_grace.get()
    }

    pub fn token_paused(&self, token: Address) -> bool {
        self.optional_bool(token, SEL_ORACLE_PAUSED) || self.optional_bool(token, SEL_PAUSED)
    }

    pub fn twap_price_wad(&self, token: Address) -> U256 {
        self.twap(token)
    }
}
