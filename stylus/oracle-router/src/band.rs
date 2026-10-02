//! Pure pricing rules shared by `quote`: pool price from a sqrt ratio, the band around the last Chainlink
//! print, clamping and the conservative max. Everything is WAD (1e18) USD per whole stock token.
use alloy_primitives::{U256, U512};

pub const WAD: U256 = U256::from_limbs([1_000_000_000_000_000_000u64, 0, 0, 0]);
pub const BPS: U256 = U256::from_limbs([10_000, 0, 0, 0]);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct BandParams {
    pub base_bps: U256,
    pub per_hour_bps: U256,
    pub max_bps: U256,
}

fn u512_to_u256(v: U512) -> Option<U256> {
    let limbs = v.as_limbs();
    if limbs[4..].iter().any(|l| *l != 0) {
        return None;
    }
    Some(U256::from_limbs([limbs[0], limbs[1], limbs[2], limbs[3]]))
}

/// USD per whole stock token (WAD) implied by a Uniswap v3 sqrt price, for a stock token with 18 decimals
/// quoted against a dollar token with `quote_decimals` decimals.
pub fn pool_price_wad(sqrt_price_x96: U256, stock_is_token0: bool, quote_decimals: u8) -> Option<U256> {
    if sqrt_price_x96.is_zero() {
        return None;
    }
    let ratio: U512 = sqrt_price_x96.widening_mul(sqrt_price_x96); // token1 per token0, Q192
    // one whole stock token is 1e18 raw units; the dollar token has 10^quote_decimals raw units per dollar
    let scale = U512::from(U256::from(10u8).pow(U256::from(36 - quote_decimals as u64)));
    let price = if stock_is_token0 {
        // dollars per stock = ratio / 2^192 x 1e18 / 10^qd  -> WAD: x 1e18
        (ratio * scale) >> 192usize
    } else {
        // stock per dollar = ratio / 2^192 ; dollars per stock = 2^192 / ratio, same scaling
        (scale << 192usize) / ratio
    };
    u512_to_u256(price)
}

/// Band width in bps after `hours_closed` hours, capped at `max_bps`.
pub fn band_bps(p: &BandParams, hours_closed: U256) -> U256 {
    let widened = p.base_bps.saturating_add(p.per_hour_bps.saturating_mul(hours_closed));
    if widened > p.max_bps { p.max_bps } else { widened }
}

/// Clamp `price` into [anchor x (1 - band), anchor x (1 + band)].
pub fn clamp_to_band(price: U256, anchor: U256, band: U256) -> U256 {
    let low = anchor * (BPS - band) / BPS;
    let high = anchor * (BPS + band) / BPS;
    if price < low {
        low
    } else if price > high {
        high
    } else {
        price
    }
}

/// |a - b| / b in bps.
pub fn deviation_bps(a: U256, b: U256) -> U256 {
    if b.is_zero() {
        return U256::MAX;
    }
    let diff = if a > b { a - b } else { b - a };
    diff * BPS / b
}

pub fn max(a: U256, b: U256) -> U256 {
    if a > b { a } else { b }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn wad(x: u64) -> U256 {
        U256::from(x) * WAD
    }

    #[test]
    fn pool_price_both_orderings() {
        // $100 per share: stock token0 (18d), USDG token1 (6d): ratio = 100e6 / 1e18 = 1e-10
        // sqrtP = sqrt(1e-10) * 2^96 = 1e-5 * 2^96
        let two96 = U256::from(1u8) << 96usize;
        let sqrt_p = two96 / U256::from(100_000u64);
        let p = pool_price_wad(sqrt_p, true, 6).unwrap();
        assert!(p > wad(99) && p < wad(101), "got {p}");
        // reversed ordering: ratio = 1e18 / 100e6 = 1e10, sqrtP = 1e5 * 2^96
        let sqrt_p = two96 * U256::from(100_000u64);
        let p = pool_price_wad(sqrt_p, false, 6).unwrap();
        assert!(p > wad(99) && p < wad(101), "got {p}");
        assert!(pool_price_wad(U256::ZERO, true, 6).is_none());
    }

    #[test]
    fn band_widens_and_caps() {
        let p = BandParams { base_bps: U256::from(200u64), per_hour_bps: U256::from(10u64), max_bps: U256::from(1000u64) };
        assert_eq!(band_bps(&p, U256::ZERO), U256::from(200u64));
        assert_eq!(band_bps(&p, U256::from(30u64)), U256::from(500u64));
        assert_eq!(band_bps(&p, U256::from(500u64)), U256::from(1000u64));
    }

    #[test]
    fn clamp_and_deviation() {
        let anchor = wad(100);
        let band = U256::from(500u64); // 5%
        assert_eq!(clamp_to_band(wad(120), anchor, band), wad(105));
        assert_eq!(clamp_to_band(wad(80), anchor, band), wad(95));
        assert_eq!(clamp_to_band(wad(103), anchor, band), wad(103));
        assert_eq!(deviation_bps(wad(110), wad(100)), U256::from(1000u64));
        assert_eq!(deviation_bps(wad(90), wad(100)), U256::from(1000u64));
        assert_eq!(max(wad(1), wad(2)), wad(2));
    }
}
