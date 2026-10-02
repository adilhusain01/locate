//! Locate risk engine: the production implementation of `IRiskEngine`. Pure math over calldata, no storage.
//! ABI-equivalent with `contracts/src/RiskMathRef.sol`: structs travel as tuples, errors share selectors.
#![cfg_attr(not(any(test, feature = "export-abi")), no_main)]
extern crate alloc;

pub mod math;

use alloc::vec::Vec;
use math::{Irm, MathError, Position};
use stylus_sdk::{alloy_primitives::U256, alloy_sol_types::sol, prelude::*};

sol! {
    error InvalidKink();
    error InvalidIrm();
    error InvalidDuration();
    error InvalidDiscounts();
    error Overflow();
}

#[derive(SolidityError)]
pub enum RiskError {
    InvalidKink(InvalidKink),
    InvalidIrm(InvalidIrm),
    InvalidDuration(InvalidDuration),
    InvalidDiscounts(InvalidDiscounts),
    Overflow(Overflow),
}

impl From<MathError> for RiskError {
    fn from(e: MathError) -> Self {
        match e {
            MathError::InvalidKink => RiskError::InvalidKink(InvalidKink {}),
            MathError::InvalidIrm => RiskError::InvalidIrm(InvalidIrm {}),
            MathError::InvalidDuration => RiskError::InvalidDuration(InvalidDuration {}),
            MathError::InvalidDiscounts => RiskError::InvalidDiscounts(InvalidDiscounts {}),
            MathError::Overflow => RiskError::Overflow(Overflow {}),
        }
    }
}

#[storage]
#[entrypoint]
pub struct RiskEngine {}

#[public]
impl RiskEngine {
    /// evaluate((uint256,uint256,uint256,uint256)[] positions, uint256 collateralValueWad)
    /// -> (healthFactorWad, debtValueWad, requiredInitialWad)
    pub fn evaluate(
        &self,
        positions: Vec<(U256, U256, U256, U256)>,
        collateral_value_wad: U256,
    ) -> Result<(U256, U256, U256), RiskError> {
        let inputs: Vec<Position> = positions
            .into_iter()
            .map(|(debt_raw, price_wad, liq_threshold_wad, initial_ratio_wad)| Position {
                debt_raw,
                price_wad,
                liq_threshold_wad,
                initial_ratio_wad,
            })
            .collect();
        Ok(math::evaluate(&inputs, collateral_value_wad)?)
    }

    /// borrowRate(uint256 utilisationWad, (uint64,uint64,uint64,uint64) params) -> rateWadPerYear
    pub fn borrow_rate(&self, utilisation_wad: U256, params: (u64, u64, u64, u64)) -> Result<U256, RiskError> {
        let irm = Irm {
            base_wad: U256::from(params.0),
            kink_wad: U256::from(params.1),
            rate_at_kink_wad: U256::from(params.2),
            max_rate_wad: U256::from(params.3),
        };
        Ok(math::borrow_rate(utilisation_wad, &irm)?)
    }

    /// dutchDiscount(uint256 elapsed, uint256 minWad, uint256 maxWad, uint256 duration) -> discountWad
    pub fn dutch_discount(
        &self,
        elapsed: U256,
        min_wad: U256,
        max_wad: U256,
        duration: U256,
    ) -> Result<U256, RiskError> {
        Ok(math::dutch_discount(elapsed, min_wad, max_wad, duration)?)
    }
}
