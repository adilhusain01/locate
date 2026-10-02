// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title MarketCalendar
/// @notice Robinhood's 24/5 equity session: Sunday 20:00 ET to Friday 20:00 ET, closed on US market holidays.
///         Each calendar day D owns the session [D-1 20:00 ET, D 20:00 ET); the session is open when D is a
///         weekday and not a holiday. Eastern Time follows US daylight saving (second Sunday of March 02:00 to
///         first Sunday of November 02:00). Holidays are set by the owner once a year.
contract MarketCalendar is Ownable {
    uint256 internal constant DAY = 86400;
    uint256 internal constant SESSION_BOUNDARY = 20 hours;
    uint256 internal constant MAX_LOOKAHEAD = 14;

    mapping(uint256 sessionDay => bool closed) public holiday;

    event HolidaySet(uint256 indexed sessionDay, uint256 year, uint256 month, uint256 day, bool closed);

    error NoSessionFound();

    constructor(address owner_) Ownable(owner_) {}

    // ------------------------------------------------------------------ admin

    function setHoliday(uint256 year, uint256 month, uint256 day, bool closed) external onlyOwner {
        uint256 sessionDay = daysFromCivil(year, month, day);
        holiday[sessionDay] = closed;
        emit HolidaySet(sessionDay, year, month, day, closed);
    }

    // ------------------------------------------------------------------ views

    /// @notice True while the 24/5 session is running at `timestamp`.
    function isOpen(uint256 timestamp) public view returns (bool) {
        return _sessionOpen(_sessionOf(timestamp));
    }

    /// @notice `timestamp` itself when the session is open, otherwise the UTC time the next session starts.
    function nextOpen(uint256 timestamp) public view returns (uint256) {
        uint256 session = _sessionOf(timestamp);
        if (_sessionOpen(session)) return timestamp;
        for (uint256 i = 1; i <= MAX_LOOKAHEAD; ++i) {
            if (_sessionOpen(session + i)) return _sessionStart(session + i);
        }
        revert NoSessionFound();
    }

    /// @notice Seconds since the last session closed, zero while open.
    function closedFor(uint256 timestamp) public view returns (uint256) {
        uint256 session = _sessionOf(timestamp);
        if (_sessionOpen(session)) return 0;
        for (uint256 i = 1; i <= MAX_LOOKAHEAD; ++i) {
            if (_sessionOpen(session - i)) return timestamp - _sessionEnd(session - i);
        }
        revert NoSessionFound();
    }

    /// @notice Eastern Time offset from UTC in seconds at `timestamp` (4 hours in daylight time, else 5).
    function etOffset(uint256 timestamp) public pure returns (uint256) {
        (uint256 year,,) = civilFromDays(timestamp / DAY);
        uint256 dstStart = _nthSunday(year, 3, 2) * DAY + 7 hours; // 02:00 EST
        uint256 dstEnd = _nthSunday(year, 11, 1) * DAY + 6 hours; // 02:00 EDT
        return (timestamp >= dstStart && timestamp < dstEnd) ? 4 hours : 5 hours;
    }

    /// @notice Days since 1970-01-01 for a civil date (Howard Hinnant's algorithm).
    function daysFromCivil(uint256 year, uint256 month, uint256 day) public pure returns (uint256) {
        if (month <= 2) year -= 1;
        uint256 era = year / 400;
        uint256 yoe = year - era * 400;
        uint256 mp = month > 2 ? month - 3 : month + 9;
        uint256 doy = (153 * mp + 2) / 5 + day - 1;
        uint256 doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
        return era * 146097 + doe - 719468;
    }

    /// @notice Civil date for days since 1970-01-01.
    function civilFromDays(uint256 z) public pure returns (uint256 year, uint256 month, uint256 day) {
        z += 719468;
        uint256 era = z / 146097;
        uint256 doe = z - era * 146097;
        uint256 yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
        uint256 doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
        uint256 mp = (5 * doy + 2) / 153;
        day = doy - (153 * mp + 2) / 5 + 1;
        month = mp < 10 ? mp + 3 : mp - 9;
        year = yoe + era * 400 + (month <= 2 ? 1 : 0);
    }

    // ------------------------------------------------------------------ internals

    function _sessionOf(uint256 timestamp) internal pure returns (uint256) {
        uint256 local = timestamp - etOffset(timestamp);
        uint256 dayIndex = local / DAY;
        return local % DAY >= SESSION_BOUNDARY ? dayIndex + 1 : dayIndex;
    }

    function _sessionOpen(uint256 session) internal view returns (bool) {
        uint256 weekday = (session + 4) % 7; // 0 = Sunday
        if (weekday == 0 || weekday == 6) return false;
        return !holiday[session];
    }

    function _sessionStart(uint256 session) internal pure returns (uint256) {
        return _toUtc((session - 1) * DAY + SESSION_BOUNDARY);
    }

    function _sessionEnd(uint256 session) internal pure returns (uint256) {
        return _toUtc(session * DAY + SESSION_BOUNDARY);
    }

    function _toUtc(uint256 local) internal pure returns (uint256) {
        uint256 utc = local + etOffset(local + 5 hours);
        uint256 offset = etOffset(utc);
        if (utc - local != offset) utc = local + offset;
        return utc;
    }

    function _nthSunday(uint256 year, uint256 month, uint256 n) internal pure returns (uint256) {
        uint256 first = daysFromCivil(year, month, 1);
        uint256 weekday = (first + 4) % 7;
        return first + (7 - weekday) % 7 + (n - 1) * 7;
    }
}
