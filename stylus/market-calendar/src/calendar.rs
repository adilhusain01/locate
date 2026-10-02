//! Robinhood's 24/5 equity session in pure arithmetic. Mirrors `contracts/src/MarketCalendar.sol`.
//! Session day D covers [D-1 20:00 ET, D 20:00 ET); it is open when D is a weekday and not a holiday.

pub const DAY: u64 = 86_400;
pub const SESSION_BOUNDARY: u64 = 20 * 3_600;
pub const MAX_LOOKAHEAD: u64 = 14;

/// Days since 1970-01-01 for a civil date (Howard Hinnant's algorithm).
pub fn days_from_civil(mut year: u64, month: u64, day: u64) -> u64 {
    if month <= 2 {
        year -= 1;
    }
    let era = year / 400;
    let yoe = year - era * 400;
    let mp = if month > 2 { month - 3 } else { month + 9 };
    let doy = (153 * mp + 2) / 5 + day - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    era * 146_097 + doe - 719_468
}

/// Civil date for days since 1970-01-01.
pub fn civil_from_days(z: u64) -> (u64, u64, u64) {
    let z = z + 719_468;
    let era = z / 146_097;
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = doy - (153 * mp + 2) / 5 + 1;
    let month = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = yoe + era * 400 + if month <= 2 { 1 } else { 0 };
    (year, month, day)
}

fn nth_sunday(year: u64, month: u64, n: u64) -> u64 {
    let first = days_from_civil(year, month, 1);
    let weekday = (first + 4) % 7;
    first + (7 - weekday) % 7 + (n - 1) * 7
}

/// Eastern Time offset from UTC in seconds: 4 hours in daylight time, else 5.
pub fn et_offset(timestamp: u64) -> u64 {
    let (year, _, _) = civil_from_days(timestamp / DAY);
    let dst_start = nth_sunday(year, 3, 2) * DAY + 7 * 3_600;
    let dst_end = nth_sunday(year, 11, 1) * DAY + 6 * 3_600;
    if timestamp >= dst_start && timestamp < dst_end { 4 * 3_600 } else { 5 * 3_600 }
}

pub fn session_of(timestamp: u64) -> u64 {
    let local = timestamp - et_offset(timestamp);
    let day_index = local / DAY;
    if local % DAY >= SESSION_BOUNDARY { day_index + 1 } else { day_index }
}

pub fn is_weekday_session(session: u64) -> bool {
    let weekday = (session + 4) % 7;
    weekday != 0 && weekday != 6
}

fn to_utc(local: u64) -> u64 {
    let mut utc = local + et_offset(local + 5 * 3_600);
    let offset = et_offset(utc);
    if utc - local != offset {
        utc = local + offset;
    }
    utc
}

pub fn session_start(session: u64) -> u64 {
    to_utc((session - 1) * DAY + SESSION_BOUNDARY)
}

pub fn session_end(session: u64) -> u64 {
    to_utc(session * DAY + SESSION_BOUNDARY)
}

/// `timestamp` when open, otherwise the UTC start of the next open session. `None` when nothing opens within
/// MAX_LOOKAHEAD sessions.
pub fn next_open(timestamp: u64, is_open: impl Fn(u64) -> bool) -> Option<u64> {
    let session = session_of(timestamp);
    if is_open(session) {
        return Some(timestamp);
    }
    (1..=MAX_LOOKAHEAD).find(|i| is_open(session + i)).map(|i| session_start(session + i))
}

/// Seconds since the last session closed, zero while open.
pub fn closed_for(timestamp: u64, is_open: impl Fn(u64) -> bool) -> Option<u64> {
    let session = session_of(timestamp);
    if is_open(session) {
        return Some(0);
    }
    (1..=MAX_LOOKAHEAD).find(|i| is_open(session - i)).map(|i| timestamp - session_end(session - i))
}

#[cfg(test)]
mod tests {
    use super::*;

    // Timestamps produced with GNU date (see contracts/test/MarketCalendar.t.sol for the same anchors).
    const SAT_OCT3_1200Z: u64 = 1791028800;
    const WED_OCT7_1500Z: u64 = 1791385200;
    const SUN_OCT4_2330Z: u64 = 1791156600;
    const MON_OCT5_0000Z: u64 = 1791158400;
    const SAT_OCT3_0000Z: u64 = 1790985600;
    const FRI_OCT9_2330Z: u64 = 1791588600;
    const SAT_OCT10_0030Z: u64 = 1791592200;
    const THU_NOV26_1500Z: u64 = 1795705200;
    const THU_NOV26_0200Z: u64 = 1795658400;
    const WED_NOV25_2300Z: u64 = 1795647600;
    const FRI_NOV27_0100Z: u64 = 1795741200;
    const SAT_NOV7_0030Z: u64 = 1794011400;
    const SAT_NOV7_0130Z: u64 = 1794015000;
    const SUN_MAR8_0659Z: u64 = 1772953140;
    const SUN_MAR8_0700Z: u64 = 1772953200;

    fn weekdays(session: u64) -> bool {
        is_weekday_session(session)
    }

    #[test]
    fn weekend_closed_weekday_open() {
        assert!(!weekdays(session_of(SAT_OCT3_1200Z)));
        assert!(weekdays(session_of(WED_OCT7_1500Z)));
        assert!(!weekdays(session_of(SUN_OCT4_2330Z)));
        assert!(weekdays(session_of(MON_OCT5_0000Z)));
        assert!(weekdays(session_of(FRI_OCT9_2330Z)));
        assert!(!weekdays(session_of(SAT_OCT10_0030Z)));
    }

    #[test]
    fn next_open_and_closed_for_over_a_weekend() {
        assert_eq!(next_open(SAT_OCT3_1200Z, weekdays), Some(MON_OCT5_0000Z));
        assert_eq!(next_open(WED_OCT7_1500Z, weekdays), Some(WED_OCT7_1500Z));
        assert_eq!(closed_for(SAT_OCT3_1200Z, weekdays), Some(SAT_OCT3_1200Z - SAT_OCT3_0000Z));
        assert_eq!(closed_for(WED_OCT7_1500Z, weekdays), Some(0));
    }

    #[test]
    fn holiday_closes_its_whole_session() {
        let thanksgiving = days_from_civil(2026, 11, 26);
        let open = |s: u64| is_weekday_session(s) && s != thanksgiving;
        assert!(!open(session_of(THU_NOV26_1500Z)));
        assert!(!open(session_of(THU_NOV26_0200Z)));
        assert!(open(session_of(WED_NOV25_2300Z)));
        assert_eq!(next_open(THU_NOV26_1500Z, open), Some(FRI_NOV27_0100Z));
    }

    #[test]
    fn daylight_saving() {
        assert_eq!(et_offset(SUN_MAR8_0659Z), 5 * 3600);
        assert_eq!(et_offset(SUN_MAR8_0700Z), 4 * 3600);
        assert_eq!(et_offset(WED_OCT7_1500Z), 4 * 3600);
        assert_eq!(et_offset(THU_NOV26_1500Z), 5 * 3600);
        assert!(weekdays(session_of(SAT_NOV7_0030Z)));
        assert!(!weekdays(session_of(SAT_NOV7_0130Z)));
    }

    #[test]
    fn civil_round_trip() {
        assert_eq!(days_from_civil(1970, 1, 1), 0);
        assert_eq!(days_from_civil(2026, 10, 3), SAT_OCT3_0000Z / DAY);
        assert_eq!(civil_from_days(SAT_OCT3_0000Z / DAY), (2026, 10, 3));
        for z in [0u64, 10_957, 20_729, 30_000, 50_000] {
            let (y, m, d) = civil_from_days(z);
            assert_eq!(days_from_civil(y, m, d), z);
        }
    }
}
