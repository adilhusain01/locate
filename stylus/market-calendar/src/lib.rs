//! Locate market calendar on Stylus: Robinhood's 24/5 session with US daylight saving and owner-set holidays.
//! ABI-equivalent with `contracts/src/MarketCalendar.sol` (plus `initialize`, since Stylus has no constructor
//! arguments here).
#![cfg_attr(not(any(test, feature = "export-abi")), no_main)]
extern crate alloc;

pub mod calendar;

use stylus_sdk::{
    alloy_primitives::{Address, U256},
    alloy_sol_types::sol,
    prelude::*,
    storage::{StorageAddress, StorageBool, StorageMap},
};

sol! {
    event HolidaySet(uint256 indexed sessionDay, uint256 year, uint256 month, uint256 day, bool closed);
    error NoSessionFound();
    error NotOwner();
    error AlreadyInitialized();
}

#[derive(SolidityError)]
pub enum CalendarError {
    NoSessionFound(NoSessionFound),
    NotOwner(NotOwner),
    AlreadyInitialized(AlreadyInitialized),
}

#[storage]
#[entrypoint]
pub struct MarketCalendar {
    owner: StorageAddress,
    holiday: StorageMap<U256, StorageBool>,
}

impl MarketCalendar {
    fn session_open(&self, session: u64) -> bool {
        calendar::is_weekday_session(session) && !self.holiday.get(U256::from(session))
    }

    fn require_owner(&self) -> Result<(), CalendarError> {
        if self.vm().msg_sender() != self.owner.get() {
            return Err(CalendarError::NotOwner(NotOwner {}));
        }
        Ok(())
    }
}

#[public]
impl MarketCalendar {
    pub fn initialize(&mut self, owner: Address) -> Result<(), CalendarError> {
        if !self.owner.get().is_zero() {
            return Err(CalendarError::AlreadyInitialized(AlreadyInitialized {}));
        }
        self.owner.set(owner);
        Ok(())
    }

    pub fn owner(&self) -> Address {
        self.owner.get()
    }

    pub fn set_holiday(&mut self, year: U256, month: U256, day: U256, closed: bool) -> Result<(), CalendarError> {
        self.require_owner()?;
        let session_day = calendar::days_from_civil(year.to::<u64>(), month.to::<u64>(), day.to::<u64>());
        self.holiday.setter(U256::from(session_day)).set(closed);
        self.vm().log(HolidaySet { sessionDay: U256::from(session_day), year, month, day, closed });
        Ok(())
    }

    pub fn holiday(&self, session_day: U256) -> bool {
        self.holiday.get(session_day)
    }

    pub fn is_open(&self, timestamp: U256) -> bool {
        self.session_open(calendar::session_of(timestamp.to::<u64>()))
    }

    pub fn next_open(&self, timestamp: U256) -> Result<U256, CalendarError> {
        calendar::next_open(timestamp.to::<u64>(), |s| self.session_open(s))
            .map(U256::from)
            .ok_or(CalendarError::NoSessionFound(NoSessionFound {}))
    }

    pub fn closed_for(&self, timestamp: U256) -> Result<U256, CalendarError> {
        calendar::closed_for(timestamp.to::<u64>(), |s| self.session_open(s))
            .map(U256::from)
            .ok_or(CalendarError::NoSessionFound(NoSessionFound {}))
    }

    pub fn et_offset(&self, timestamp: U256) -> U256 {
        U256::from(calendar::et_offset(timestamp.to::<u64>()))
    }

    pub fn days_from_civil(&self, year: U256, month: U256, day: U256) -> U256 {
        U256::from(calendar::days_from_civil(year.to::<u64>(), month.to::<u64>(), day.to::<u64>()))
    }

    pub fn civil_from_days(&self, z: U256) -> (U256, U256, U256) {
        let (y, m, d) = calendar::civil_from_days(z.to::<u64>());
        (U256::from(y), U256::from(m), U256::from(d))
    }
}
