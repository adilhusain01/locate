//! Uniswap v3 TickMath.getSqrtRatioAtTick, ported for the TWAP leg of the oracle router.
use alloy_primitives::U256;

pub const MIN_TICK: i32 = -887272;
pub const MAX_TICK: i32 = 887272;

const MAGIC: [(u32, u128); 19] = [
    (0x2, 0xfff97272373d413259a46990580e213a),
    (0x4, 0xfff2e50f5f656932ef12357cf3c7fdcc),
    (0x8, 0xffe5caca7e10e4e61c3624eaa0941cd0),
    (0x10, 0xffcb9843d60f6159c9db58835c926644),
    (0x20, 0xff973b41fa98c081472e6896dfb254c0),
    (0x40, 0xff2ea16466c96a3843ec78b326b52861),
    (0x80, 0xfe5dee046a99a2a811c461f1969c3053),
    (0x100, 0xfcbe86c7900a88aedcffc83b479aa3a4),
    (0x200, 0xf987a7253ac413176f2b074cf7815e54),
    (0x400, 0xf3392b0822b70005940c7a398e4b70f3),
    (0x800, 0xe7159475a2c29b7443b29c7fa6e889d9),
    (0x1000, 0xd097f3bdfd2022b8845ad8f792aa5825),
    (0x2000, 0xa9f746462d870fdf8a65dc1f90e061e5),
    (0x4000, 0x70d869a156d2a1b890bb3df62baf32f7),
    (0x8000, 0x31be135f97d08fd981231505542fcfa6),
    (0x10000, 0x9aa508b5b7a84e1c677de54f3e99bc9),
    (0x20000, 0x5d6af8dedb81196699c329225ee604),
    (0x40000, 0x2216e584f5fa1ea926041bedfe98),
    (0x80000, 0x48a170391f7dc42444e8fa2),
];

/// sqrt(1.0001^tick) as a Q64.96 number, exactly as Uniswap v3 computes it. `None` outside the tick range.
pub fn get_sqrt_ratio_at_tick(tick: i32) -> Option<U256> {
    if !(MIN_TICK..=MAX_TICK).contains(&tick) {
        return None;
    }
    let abs_tick = tick.unsigned_abs();
    let mut ratio = if abs_tick & 1 != 0 {
        U256::from(0xfffcb933bd6fad37aa2d162d1a594001u128)
    } else {
        U256::from(1u8) << 128usize
    };
    for (bit, constant) in MAGIC {
        if abs_tick & bit != 0 {
            ratio = (ratio * U256::from(constant)) >> 128usize;
        }
    }
    if tick > 0 {
        ratio = U256::MAX / ratio;
    }
    let rounded = ratio >> 32usize;
    let remainder = ratio & ((U256::from(1u8) << 32usize) - U256::from(1u8));
    Some(if remainder.is_zero() { rounded } else { rounded + U256::from(1u8) })
}

/// Arithmetic mean tick over a window, rounding toward negative infinity like Uniswap's OracleLibrary.
pub fn mean_tick(tick_cumulative_start: i64, tick_cumulative_end: i64, window: u32) -> i32 {
    let delta = tick_cumulative_end - tick_cumulative_start;
    let window = window as i64;
    let mut tick = delta / window;
    if delta < 0 && delta % window != 0 {
        tick -= 1;
    }
    tick as i32
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn known_ticks() {
        assert_eq!(get_sqrt_ratio_at_tick(0).unwrap(), U256::from(1u8) << 96usize);
        assert_eq!(
            get_sqrt_ratio_at_tick(MIN_TICK).unwrap(),
            U256::from(4295128739u64),
            "MIN_SQRT_RATIO"
        );
        assert_eq!(
            get_sqrt_ratio_at_tick(MAX_TICK).unwrap().to_string(),
            "1461446703485210103287273052203988822378723970342",
            "MAX_SQRT_RATIO"
        );
        assert!(get_sqrt_ratio_at_tick(MAX_TICK + 1).is_none());
        assert!(get_sqrt_ratio_at_tick(MIN_TICK - 1).is_none());
    }

    #[test]
    fn sqrt_ratio_is_monotone() {
        let mut last = U256::ZERO;
        for tick in (MIN_TICK..=MAX_TICK).step_by(7919) {
            let r = get_sqrt_ratio_at_tick(tick).unwrap();
            assert!(r > last);
            last = r;
        }
    }

    #[test]
    fn mean_tick_rounds_down() {
        assert_eq!(mean_tick(0, 1000, 10), 100);
        assert_eq!(mean_tick(0, -1000, 10), -100);
        assert_eq!(mean_tick(0, -1001, 10), -101);
        assert_eq!(mean_tick(0, 1001, 10), 100);
    }
}
