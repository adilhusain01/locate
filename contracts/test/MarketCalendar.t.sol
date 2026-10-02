// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {MarketCalendar} from "../src/MarketCalendar.sol";

/// Requirements: Robinhood's equity feeds follow a 24/5 session, Sunday 20:00 ET to Friday 20:00 ET, closed on
/// US market holidays, with Eastern Time switching between EDT and EST. Timestamps below were produced with
/// GNU date, independently of the contract's own arithmetic.
contract MarketCalendarTest is Test {
    uint256 constant SAT_OCT3_1200Z = 1791028800;
    uint256 constant WED_OCT7_1500Z = 1791385200;
    uint256 constant SUN_OCT4_2330Z = 1791156600; // Sunday 19:30 EDT
    uint256 constant MON_OCT5_0030Z = 1791160200; // Sunday 20:30 EDT
    uint256 constant MON_OCT5_0000Z = 1791158400; // Sunday 20:00 EDT, session start
    uint256 constant SAT_OCT3_0000Z = 1790985600; // Friday 20:00 EDT, session end
    uint256 constant FRI_OCT9_2330Z = 1791588600; // Friday 19:30 EDT
    uint256 constant SAT_OCT10_0030Z = 1791592200; // Friday 20:30 EDT
    uint256 constant THU_NOV26_1500Z = 1795705200; // Thanksgiving
    uint256 constant THU_NOV26_0200Z = 1795658400; // Wednesday 21:00 EST, Thursday session
    uint256 constant WED_NOV25_2300Z = 1795647600; // Wednesday 18:00 EST
    uint256 constant FRI_NOV27_0100Z = 1795741200; // Thursday 20:00 EST, Friday session start
    uint256 constant SAT_NOV7_0030Z = 1794011400; // Friday 19:30 EST (after DST end)
    uint256 constant SAT_NOV7_0130Z = 1794015000; // Friday 20:30 EST
    uint256 constant SUN_MAR8_0659Z = 1772953140; // one minute before DST starts
    uint256 constant SUN_MAR8_0700Z = 1772953200; // DST starts

    MarketCalendar cal;
    address outsider = makeAddr("outsider");

    function setUp() public {
        cal = new MarketCalendar(address(this));
    }

    function test_weekendIsClosedAndWeekdayIsOpen() public view {
        assertFalse(cal.isOpen(SAT_OCT3_1200Z));
        assertTrue(cal.isOpen(WED_OCT7_1500Z));
    }

    function test_sessionOpensSundayEightPmEastern() public view {
        assertFalse(cal.isOpen(SUN_OCT4_2330Z));
        assertTrue(cal.isOpen(MON_OCT5_0000Z));
        assertTrue(cal.isOpen(MON_OCT5_0030Z));
    }

    function test_sessionClosesFridayEightPmEastern() public view {
        assertTrue(cal.isOpen(FRI_OCT9_2330Z));
        assertFalse(cal.isOpen(SAT_OCT10_0030Z));
    }

    function test_nextOpenAndClosedForOverAWeekend() public view {
        assertEq(cal.nextOpen(SAT_OCT3_1200Z), MON_OCT5_0000Z);
        assertEq(cal.nextOpen(WED_OCT7_1500Z), WED_OCT7_1500Z, "already open returns the input");
        assertEq(cal.closedFor(SAT_OCT3_1200Z), SAT_OCT3_1200Z - SAT_OCT3_0000Z);
        assertEq(cal.closedFor(WED_OCT7_1500Z), 0);
    }

    function test_holidayClosesItsWholeSession() public {
        assertTrue(cal.isOpen(THU_NOV26_1500Z), "open until the holiday is set");
        cal.setHoliday(2026, 11, 26, true);
        assertFalse(cal.isOpen(THU_NOV26_1500Z));
        assertFalse(cal.isOpen(THU_NOV26_0200Z), "the session that starts Wednesday 20:00 ET belongs to Thursday");
        assertTrue(cal.isOpen(WED_NOV25_2300Z), "Wednesday's own session stays open");
        assertEq(cal.nextOpen(THU_NOV26_1500Z), FRI_NOV27_0100Z);
        cal.setHoliday(2026, 11, 26, false);
        assertTrue(cal.isOpen(THU_NOV26_1500Z));
    }

    function test_easternTimeFollowsDaylightSaving() public view {
        assertEq(cal.etOffset(SUN_MAR8_0659Z), 5 hours);
        assertEq(cal.etOffset(SUN_MAR8_0700Z), 4 hours);
        assertEq(cal.etOffset(WED_OCT7_1500Z), 4 hours);
        assertEq(cal.etOffset(THU_NOV26_1500Z), 5 hours);
        assertTrue(cal.isOpen(SAT_NOV7_0030Z), "19:30 EST on a Friday is still inside the session");
        assertFalse(cal.isOpen(SAT_NOV7_0130Z));
    }

    function test_civilDateRoundTrip() public view {
        assertEq(cal.daysFromCivil(1970, 1, 1), 0);
        assertEq(cal.daysFromCivil(2026, 10, 3), SAT_OCT3_0000Z / 1 days);
        (uint256 y, uint256 m, uint256 d) = cal.civilFromDays(SAT_OCT3_0000Z / 1 days);
        assertEq(y, 2026);
        assertEq(m, 10);
        assertEq(d, 3);
    }

    function test_onlyOwnerSetsHolidays() public {
        vm.prank(outsider);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, outsider));
        cal.setHoliday(2026, 11, 26, true);
    }
}
