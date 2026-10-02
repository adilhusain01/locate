//! Pure risk formulas. Must match `contracts/src/libraries/RiskMath.sol` to the wei; the differential fuzzer
//! checks that against the deployed contracts. Debt rounds up, health rounds down.
use alloy_primitives::{U256, U512};

pub const WAD: U256 = U256::from_limbs([1_000_000_000_000_000_000u64, 0, 0, 0]);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MathError {
    InvalidKink,
    InvalidIrm,
    InvalidDuration,
    InvalidDiscounts,
    Overflow,
}

#[derive(Debug, Clone, Copy)]
pub struct Position {
    pub debt_raw: U256,
    pub price_wad: U256,
    pub liq_threshold_wad: U256,
    pub initial_ratio_wad: U256,
}

#[derive(Debug, Clone, Copy)]
pub struct Irm {
    pub base_wad: U256,
    pub kink_wad: U256,
    pub rate_at_kink_wad: U256,
    pub max_rate_wad: U256,
}

/// floor(a * b / d), or ceil when `round_up`, computed over 512 bits like OpenZeppelin's Math.mulDiv.
pub fn mul_div(a: U256, b: U256, denominator: U256, round_up: bool) -> Result<U256, MathError> {
    if denominator.is_zero() {
        return Err(MathError::Overflow);
    }
    let product: U512 = a.widening_mul(b);
    let denominator = U512::from(denominator);
    let mut quotient = product / denominator;
    if round_up && product % denominator != U512::ZERO {
        quotient += U512::from(1u8);
    }
    let limbs = quotient.as_limbs();
    if limbs[4..].iter().any(|l| *l != 0) {
        return Err(MathError::Overflow);
    }
    Ok(U256::from_limbs([limbs[0], limbs[1], limbs[2], limbs[3]]))
}

fn add(a: U256, b: U256) -> Result<U256, MathError> {
    a.checked_add(b).ok_or(MathError::Overflow)
}

/// Returns (health factor, plain debt value, collateral required under the initial ratios), all WAD.
pub fn evaluate(positions: &[Position], collateral_value_wad: U256) -> Result<(U256, U256, U256), MathError> {
    let mut weighted = U256::ZERO;
    let mut debt = U256::ZERO;
    let mut required = U256::ZERO;
    for p in positions {
        let value = mul_div(p.debt_raw, p.price_wad, WAD, true)?;
        debt = add(debt, value)?;
        weighted = add(weighted, mul_div(value, p.liq_threshold_wad, WAD, true)?)?;
        required = add(required, mul_div(value, p.initial_ratio_wad, WAD, true)?)?;
    }
    let health = if weighted.is_zero() {
        U256::MAX
    } else {
        mul_div(collateral_value_wad, WAD, weighted, false)?
    };
    Ok((health, debt, required))
}

/// Kinked yearly rate, clamped at full utilisation.
pub fn borrow_rate(utilisation_wad: U256, p: &Irm) -> Result<U256, MathError> {
    if p.kink_wad.is_zero() || p.kink_wad >= WAD {
        return Err(MathError::InvalidKink);
    }
    if p.rate_at_kink_wad < p.base_wad || p.max_rate_wad < p.rate_at_kink_wad {
        return Err(MathError::InvalidIrm);
    }
    let u = if utilisation_wad > WAD { WAD } else { utilisation_wad };
    if u <= p.kink_wad {
        add(p.base_wad, mul_div(p.rate_at_kink_wad - p.base_wad, u, p.kink_wad, false)?)
    } else {
        add(
            p.rate_at_kink_wad,
            mul_div(p.max_rate_wad - p.rate_at_kink_wad, u - p.kink_wad, WAD - p.kink_wad, false)?,
        )
    }
}

/// Linear Dutch auction discount from `min` at zero to `max` at `duration`, flat afterwards.
pub fn dutch_discount(elapsed: U256, min_wad: U256, max_wad: U256, duration: U256) -> Result<U256, MathError> {
    if duration.is_zero() {
        return Err(MathError::InvalidDuration);
    }
    if max_wad < min_wad || max_wad >= WAD {
        return Err(MathError::InvalidDiscounts);
    }
    if elapsed >= duration {
        return Ok(max_wad);
    }
    add(min_wad, mul_div(max_wad - min_wad, elapsed, duration, false)?)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn wad(x: f64) -> U256 {
        // test helper for round decimals only
        U256::from((x * 1e6).round() as u64) * U256::from(1_000_000_000_000u64)
    }

    fn irm() -> Irm {
        Irm { base_wad: wad(0.01), kink_wad: wad(0.8), rate_at_kink_wad: wad(0.10), max_rate_wad: wad(1.5) }
    }

    #[test]
    fn single_position_health_matches_solidity_reference() {
        let p = [Position { debt_raw: wad(10.0), price_wad: wad(100.0), liq_threshold_wad: wad(1.25), initial_ratio_wad: wad(1.5) }];
        let (hf, debt, required) = evaluate(&p, wad(1500.0)).unwrap();
        assert_eq!(debt, wad(1000.0));
        assert_eq!(required, wad(1500.0));
        assert_eq!(hf, wad(1.2));
        let (hf, _, _) = evaluate(&p, wad(1250.0)).unwrap();
        assert_eq!(hf, WAD);
        let (hf, _, _) = evaluate(&p, wad(1250.0) - U256::from(1u8)).unwrap();
        assert!(hf < WAD);
    }

    #[test]
    fn debt_rounds_up_and_no_debt_is_unlimited() {
        let one = U256::from(1u8);
        let p = [Position { debt_raw: one, price_wad: one, liq_threshold_wad: WAD + one, initial_ratio_wad: WAD + one }];
        let (hf, debt, required) = evaluate(&p, one).unwrap();
        assert_eq!(debt, one);
        assert_eq!(required, U256::from(2u8));
        assert!(hf < WAD);
        let (hf, debt, required) = evaluate(&[], U256::ZERO).unwrap();
        assert_eq!(hf, U256::MAX);
        assert_eq!(debt, U256::ZERO);
        assert_eq!(required, U256::ZERO);
    }

    #[test]
    fn rate_anchors() {
        let p = irm();
        assert_eq!(borrow_rate(U256::ZERO, &p).unwrap(), wad(0.01));
        assert_eq!(borrow_rate(wad(0.4), &p).unwrap(), wad(0.055));
        assert_eq!(borrow_rate(wad(0.8), &p).unwrap(), wad(0.10));
        assert_eq!(borrow_rate(wad(0.9), &p).unwrap(), wad(0.80));
        assert_eq!(borrow_rate(WAD, &p).unwrap(), wad(1.5));
        assert_eq!(borrow_rate(wad(2.0), &p).unwrap(), wad(1.5));
    }

    #[test]
    fn rate_rejects_bad_params_and_never_decreases() {
        let mut p = irm();
        p.kink_wad = U256::ZERO;
        assert_eq!(borrow_rate(wad(0.5), &p), Err(MathError::InvalidKink));
        let mut p = irm();
        p.max_rate_wad = wad(0.05);
        assert_eq!(borrow_rate(wad(0.5), &p), Err(MathError::InvalidIrm));
        let p = irm();
        let mut last = U256::ZERO;
        for step in 0..=200u64 {
            let u = WAD * U256::from(step) / U256::from(100u64);
            let r = borrow_rate(u, &p).unwrap();
            assert!(r >= last);
            last = r;
        }
    }

    #[test]
    fn dutch_curve() {
        let (min, max, dur) = (wad(0.01), wad(0.12), U256::from(1200u64));
        assert_eq!(dutch_discount(U256::ZERO, min, max, dur).unwrap(), min);
        assert_eq!(dutch_discount(U256::from(600u64), min, max, dur).unwrap(), wad(0.065));
        assert_eq!(dutch_discount(dur, min, max, dur).unwrap(), max);
        assert_eq!(dutch_discount(U256::from(1_000_000u64), min, max, dur).unwrap(), max);
        assert_eq!(dutch_discount(U256::from(1u8), min, max, U256::ZERO), Err(MathError::InvalidDuration));
        assert_eq!(dutch_discount(U256::from(1u8), max, min, dur), Err(MathError::InvalidDiscounts));
        assert_eq!(dutch_discount(U256::from(1u8), min, WAD, dur), Err(MathError::InvalidDiscounts));
    }

    #[test]
    fn mul_div_handles_512_bit_intermediates() {
        let big = U256::MAX / U256::from(2u8);
        assert_eq!(mul_div(big, U256::from(2u8), U256::from(2u8), false).unwrap(), big);
        assert_eq!(mul_div(U256::MAX, U256::MAX, U256::MAX, false).unwrap(), U256::MAX);
        assert_eq!(mul_div(U256::MAX, U256::from(2u8), U256::from(1u8), false), Err(MathError::Overflow));
        assert_eq!(mul_div(U256::from(1u8), U256::from(1u8), U256::ZERO, false), Err(MathError::Overflow));
        assert_eq!(mul_div(U256::from(10_001u64), U256::from(5u8), U256::from(10_000u64), true), Ok(U256::from(6u8)));
    }
}
