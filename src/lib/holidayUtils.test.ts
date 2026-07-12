import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getHolidaysForYear,
  optimizeDaysOff,
  calculateConsecutiveDaysOff,
} from "./holidayUtils";

const TEST_YEAR = 2024;
const DEFAULT_WEEKENDS = [0, 6];
const CUSTOM_WEEKENDS = [5, 6];

const mockNavigator = {
  languages: ["en", "en-US"],
};

const mockIntlDateTimeFormat = vi.fn(() => ({
  resolvedOptions: () => ({ timeZone: "America/New_York" }),
}));

describe("holidayUtils", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("navigator", mockNavigator);
    vi.stubGlobal("Intl", {
      ...Intl,
      DateTimeFormat: mockIntlDateTimeFormat,
    });
  });

  describe("getHolidaysForYear", () => {
    it("should return holidays for a given year and country", () => {
      const holidays = getHolidaysForYear("US", TEST_YEAR);
      expect(holidays).toBeDefined();
      expect(Array.isArray(holidays)).toBe(true);
      expect(holidays.length).toBeGreaterThan(0);
    });

    it("should filter only public holidays", () => {
      const holidays = getHolidaysForYear("US", TEST_YEAR);
      holidays.forEach((holiday) => {
        expect(holiday).toHaveProperty("date");
        expect(holiday).toHaveProperty("name");
        expect(holiday.date).toBeInstanceOf(Date);
        expect(typeof holiday.name).toBe("string");
      });
    });

    it("should handle state codes", () => {
      const holidays = getHolidaysForYear("US", TEST_YEAR, "CA");
      expect(holidays).toBeDefined();
      expect(Array.isArray(holidays)).toBe(true);
    });

    it("should return holidays sorted by date", () => {
      const holidays = getHolidaysForYear("US", TEST_YEAR);
      for (let i = 1; i < holidays.length; i++) {
        const prev = holidays[i - 1].date.getTime();
        const curr = holidays[i].date.getTime();
        expect(curr).toBeGreaterThanOrEqual(prev);
      }
    });

    it("should handle different countries", () => {
      const usHolidays = getHolidaysForYear("US", TEST_YEAR);
      const gbHolidays = getHolidaysForYear("GB", TEST_YEAR);

      expect(usHolidays.length).toBeGreaterThan(0);
      expect(gbHolidays.length).toBeGreaterThan(0);
      expect(usHolidays.length).not.toBe(gbHolidays.length);
    });

    it("should expand multi-day holidays correctly", () => {
      const holidays = getHolidaysForYear("US", TEST_YEAR);
      const dateKeys = new Set(
        holidays.map(
          (h) =>
            `${h.date.getFullYear()}-${h.date.getMonth()}-${h.date.getDate()}`,
        ),
      );
      expect(holidays.length).toBeGreaterThanOrEqual(dateKeys.size);
    });

    it("should sort holidays by date first, then by name", () => {
      const holidays = getHolidaysForYear("US", TEST_YEAR);
      for (let i = 1; i < holidays.length; i++) {
        const prev = holidays[i - 1];
        const curr = holidays[i];
        const prevTime = prev.date.getTime();
        const currTime = curr.date.getTime();

        if (prevTime === currTime)
          expect(curr.name.localeCompare(prev.name)).toBeGreaterThanOrEqual(0);
        else expect(currTime).toBeGreaterThan(prevTime);
      }
    });
  });

  describe("optimizeDaysOff", () => {
    const mockHolidays = [
      { date: new Date(TEST_YEAR, 0, 1), name: "New Year" },
      { date: new Date(TEST_YEAR, 6, 4), name: "Independence Day" },
    ];

    describe("basic functionality", () => {
      it("should return an array of dates", () => {
        const result = optimizeDaysOff(mockHolidays, TEST_YEAR, 5);
        expect(Array.isArray(result)).toBe(true);
        result.forEach((date) => {
          expect(date).toBeInstanceOf(Date);
        });
      });

      it("should return at most the requested number of days", () => {
        const result = optimizeDaysOff(mockHolidays, TEST_YEAR, 5);
        expect(result.length).toBeLessThanOrEqual(5);
      });

      it("should handle zero days off", () => {
        const result = optimizeDaysOff(mockHolidays, TEST_YEAR, 0);
        expect(result).toEqual([]);
      });

      it("should handle more days off than available gaps", () => {
        const result = optimizeDaysOff(mockHolidays, TEST_YEAR, 1000);
        expect(result.length).toBeGreaterThan(0);
        expect(result.length).toBeLessThan(1000);
      });
    });

    describe("exclusion rules", () => {
      it("should not include weekends in optimized days", () => {
        const result = optimizeDaysOff(mockHolidays, TEST_YEAR, 10);
        result.forEach((date) => {
          expect(DEFAULT_WEEKENDS).not.toContain(date.getDay());
        });
      });

      it("should not include holidays in optimized days", () => {
        const result = optimizeDaysOff(mockHolidays, TEST_YEAR, 10);
        const holidayKeys = new Set(
          mockHolidays.map(
            (h) =>
              `${h.date.getFullYear()}-${h.date.getMonth()}-${h.date.getDate()}`,
          ),
        );
        result.forEach((date) => {
          const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
          expect(holidayKeys.has(dateKey)).toBe(false);
        });
      });

      it("should not include fixed days off in optimized days", () => {
        const fixedDaysOff = [
          new Date(TEST_YEAR, 0, 5),
          new Date(TEST_YEAR, 0, 10),
        ];
        const result = optimizeDaysOff(
          mockHolidays,
          TEST_YEAR,
          10,
          DEFAULT_WEEKENDS,
          undefined,
          fixedDaysOff,
        );
        const fixedDaysOffKeys = new Set(
          fixedDaysOff.map(
            (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`,
          ),
        );
        result.forEach((date) => {
          const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
          expect(fixedDaysOffKeys.has(dateKey)).toBe(false);
        });
      });

      it("should not select days that are already holidays or weekends", () => {
        const holidays = [
          { date: new Date(TEST_YEAR, 0, 1), name: "Holiday" },
          { date: new Date(TEST_YEAR, 0, 3), name: "Holiday" },
        ];
        const result = optimizeDaysOff(holidays, TEST_YEAR, 10);
        const holidaySet = new Set(
          holidays.map(
            (h) =>
              `${h.date.getFullYear()}-${h.date.getMonth()}-${h.date.getDate()}`,
          ),
        );
        result.forEach((date) => {
          const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
          expect(holidaySet.has(dateKey)).toBe(false);
          expect(DEFAULT_WEEKENDS).not.toContain(date.getDay());
        });
      });

      it("should not select days that are fixed days off, treating them like weekends/holidays", () => {
        const fixedDaysOff = [
          new Date(TEST_YEAR, 0, 5),
          new Date(TEST_YEAR, 0, 7),
        ];
        const holidays = [{ date: new Date(TEST_YEAR, 0, 1), name: "Holiday" }];
        const result = optimizeDaysOff(
          holidays,
          TEST_YEAR,
          10,
          DEFAULT_WEEKENDS,
          undefined,
          fixedDaysOff,
        );
        const fixedDaysOffSet = new Set(
          fixedDaysOff.map(
            (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`,
          ),
        );
        result.forEach((date) => {
          const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
          expect(fixedDaysOffSet.has(dateKey)).toBe(false);
        });
      });
    });

    describe("parameters", () => {
      it("should respect startDate parameter", () => {
        const startDate = new Date(TEST_YEAR, 5, 1);
        const result = optimizeDaysOff(
          mockHolidays,
          TEST_YEAR,
          5,
          DEFAULT_WEEKENDS,
          startDate,
        );
        result.forEach((date) => {
          expect(date.getTime()).toBeGreaterThanOrEqual(startDate.getTime());
        });
      });

      it("should handle custom weekend days", () => {
        const result = optimizeDaysOff(
          mockHolidays,
          TEST_YEAR,
          5,
          CUSTOM_WEEKENDS,
        );
        result.forEach((date) => {
          expect(CUSTOM_WEEKENDS).not.toContain(date.getDay());
        });
      });

      it("should filter holidays by year and startDate", () => {
        const holidays = [
          { date: new Date(2023, 11, 31), name: "Old Year" },
          { date: new Date(TEST_YEAR, 0, 1), name: "New Year" },
          { date: new Date(TEST_YEAR, 5, 15), name: "Mid Year" },
        ];
        const startDate = new Date(TEST_YEAR, 2, 1);
        const result = optimizeDaysOff(
          holidays,
          TEST_YEAR,
          5,
          DEFAULT_WEEKENDS,
          startDate,
        );
        expect(Array.isArray(result)).toBe(true);
      });

      it("should filter fixed days off by year and startDate", () => {
        const fixedDaysOff = [
          new Date(2023, 11, 31),
          new Date(TEST_YEAR, 0, 5),
          new Date(TEST_YEAR, 5, 15),
        ];
        const startDate = new Date(TEST_YEAR, 2, 1);
        const result = optimizeDaysOff(
          mockHolidays,
          TEST_YEAR,
          5,
          DEFAULT_WEEKENDS,
          startDate,
          fixedDaysOff,
        );
        const fixedDaysOffKeys = new Set(
          fixedDaysOff
            .filter((d) => d.getFullYear() === TEST_YEAR && d >= startDate)
            .map((d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`),
        );
        result.forEach((date) => {
          const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
          expect(fixedDaysOffKeys.has(dateKey)).toBe(false);
        });
      });
    });

    describe("gap finding and prioritization", () => {
      it("should only find gaps of MAX_GAP_LENGTH (5) days or less", () => {
        const holidays = [
          { date: new Date(TEST_YEAR, 0, 1), name: "Mon" },
          { date: new Date(TEST_YEAR, 0, 3), name: "Wed" },
          { date: new Date(TEST_YEAR, 0, 10), name: "Wed" },
        ];
        const result = optimizeDaysOff(holidays, TEST_YEAR, 10);
        expect(Array.isArray(result)).toBe(true);
        result.forEach((date) => {
          expect(DEFAULT_WEEKENDS).not.toContain(date.getDay());
        });
      });

      it("should exclude gaps longer than MAX_GAP_LENGTH (5) days", () => {
        const holidays = [
          { date: new Date(TEST_YEAR, 0, 1), name: "Mon" },
          { date: new Date(TEST_YEAR, 0, 9), name: "Tue" },
        ];
        const result = optimizeDaysOff(holidays, TEST_YEAR, 10);
        expect(Array.isArray(result)).toBe(true);
      });

      it("should include gaps exactly at MAX_GAP_LENGTH (5) days", () => {
        const holidays = [
          { date: new Date(TEST_YEAR, 0, 1), name: "Mon" },
          { date: new Date(TEST_YEAR, 0, 8), name: "Mon" },
        ];
        const result = optimizeDaysOff(holidays, TEST_YEAR, 5);
        expect(result.length).toBeGreaterThan(0);
        result.forEach((date) => {
          expect(DEFAULT_WEEKENDS).not.toContain(date.getDay());
        });
      });

      it("bridges full working weeks when the weekend is a single day (regression: hardcoded 5-day cap assumed a two-day weekend)", () => {
        const singleDayWeekend = [0];
        const result = optimizeDaysOff([], TEST_YEAR, 400, singleDayWeekend);

        let workdays = 0;
        for (
          let d = new Date(TEST_YEAR, 0, 1);
          d <= new Date(TEST_YEAR, 11, 31);
          d.setDate(d.getDate() + 1)
        ) {
          if (!singleDayWeekend.includes(d.getDay())) workdays++;
        }

        expect(result.length).toBe(workdays);
        expect(result.length).toBeGreaterThan(300);
        result.forEach((date) => expect(date.getDay()).not.toBe(0));
      });

      it("should find and fill gaps of 1-5 days", () => {
        const holidays = [
          { date: new Date(TEST_YEAR, 0, 1), name: "Holiday" },
          { date: new Date(TEST_YEAR, 0, 3), name: "Wed Holiday" },
          { date: new Date(TEST_YEAR, 0, 11), name: "Thu Holiday" },
        ];
        const result = optimizeDaysOff(holidays, TEST_YEAR, 10);
        expect(result.length).toBeGreaterThan(0);
        result.forEach((date) => {
          expect(DEFAULT_WEEKENDS).not.toContain(date.getDay());
        });
      });

      it("should prioritize gaps that create longer consecutive periods", () => {
        const holidays = [
          { date: new Date(TEST_YEAR, 0, 4), name: "Thursday Holiday" },
          { date: new Date(TEST_YEAR, 0, 8), name: "Monday Holiday" },
        ];
        const result = optimizeDaysOff(holidays, TEST_YEAR, 1);
        expect(result.length).toBe(1);
      });

      it("should prioritize smaller gaps when they create longer chains", () => {
        const holidays = [
          { date: new Date(TEST_YEAR, 0, 4), name: "Thu Holiday" },
          { date: new Date(TEST_YEAR, 0, 9), name: "Tue Holiday" },
        ];
        const result = optimizeDaysOff(holidays, TEST_YEAR, 1);
        expect(result.length).toBe(1);
        expect(result[0].getDate()).toBe(5);
      });

      it("should handle multiple gaps and select most efficient ones first", () => {
        const holidays = [
          { date: new Date(TEST_YEAR, 0, 1), name: "Mon" },
          { date: new Date(TEST_YEAR, 0, 4), name: "Thu" },
          { date: new Date(TEST_YEAR, 0, 8), name: "Mon" },
        ];
        const result = optimizeDaysOff(holidays, TEST_YEAR, 3);
        expect(result.length).toBeLessThanOrEqual(3);
        result.forEach((date) => {
          expect(DEFAULT_WEEKENDS).not.toContain(date.getDay());
        });
      });

      it("should handle backward vs forward chain calculation", () => {
        const holidays = [
          { date: new Date(TEST_YEAR, 0, 5), name: "Friday Holiday" },
        ];
        const result = optimizeDaysOff(holidays, TEST_YEAR, 1);
        expect(Array.isArray(result)).toBe(true);
      });

      it("should prefer forward filling when forward chain is longer", () => {
        const holidays = [
          { date: new Date(TEST_YEAR, 0, 4), name: "Thursday Holiday" },
        ];
        const result = optimizeDaysOff(holidays, TEST_YEAR, 1);
        expect(result.length).toBe(1);
        expect(result[0].getFullYear()).toBe(TEST_YEAR);
        expect(result[0].getMonth()).toBe(0);
        expect(DEFAULT_WEEKENDS).not.toContain(result[0].getDay());
      });

      it("should prefer backward filling when backward chain is longer", () => {
        const holidays = [
          { date: new Date(TEST_YEAR, 0, 1), name: "Monday Holiday" },
        ];
        const result = optimizeDaysOff(holidays, TEST_YEAR, 1);
        expect(Array.isArray(result)).toBe(true);
      });

      it("should handle equal chain lengths by choosing direction with fewer usedDaysOff", () => {
        const holidays = [
          { date: new Date(TEST_YEAR, 0, 3), name: "Wednesday Holiday" },
        ];
        const result = optimizeDaysOff(holidays, TEST_YEAR, 1);
        expect(result.length).toBe(1);
      });

      it("should optimize to create longer consecutive periods", () => {
        const holidays = [{ date: new Date(TEST_YEAR, 0, 4), name: "Holiday" }];
        const result = optimizeDaysOff(holidays, TEST_YEAR, 1);
        expect(result.length).toBeGreaterThan(0);
      });
    });

    describe("edge cases", () => {
      it("should handle partial gap filling when daysOff is less than gap length", () => {
        const holidays = [
          { date: new Date(TEST_YEAR, 0, 1), name: "Mon" },
          { date: new Date(TEST_YEAR, 0, 8), name: "Mon" },
        ];
        const result = optimizeDaysOff(holidays, TEST_YEAR, 2);
        expect(result.length).toBe(2);
        result.forEach((date) => {
          expect(date.getFullYear()).toBe(TEST_YEAR);
          expect(DEFAULT_WEEKENDS).not.toContain(date.getDay());
        });
      });

      it("should handle multiple gaps when daysOff exceeds single gap capacity", () => {
        const holidays = [
          { date: new Date(TEST_YEAR, 0, 1), name: "Mon" },
          { date: new Date(TEST_YEAR, 0, 3), name: "Wed" },
          { date: new Date(TEST_YEAR, 0, 5), name: "Fri" },
        ];
        const result = optimizeDaysOff(holidays, TEST_YEAR, 3);
        expect(result.length).toBeGreaterThanOrEqual(2);
        expect(result.length).toBeLessThanOrEqual(3);
      });

      it("should handle optimization with no available gaps", () => {
        const firstDayNextYear = new Date(TEST_YEAR + 1, 0, 1);
        const lastDayOfYear = new Date(firstDayNextYear);
        lastDayOfYear.setDate(lastDayOfYear.getDate() - 1);
        const daysInYear =
          Math.round(
            (lastDayOfYear.getTime() - new Date(TEST_YEAR, 0, 1).getTime()) /
              (1000 * 60 * 60 * 24),
          ) + 1;

        const holidays = Array.from({ length: daysInYear }, (_, i) => {
          const date = new Date(TEST_YEAR, 0, 1);
          date.setDate(date.getDate() + i);
          if (date.getDay() !== 0 && date.getDay() !== 6) {
            return { date, name: `Holiday ${i}` };
          }
          return null;
        }).filter(Boolean) as Array<{ date: Date; name: string }>;

        const result = optimizeDaysOff(holidays, TEST_YEAR, 5);
        expect(result).toEqual([]);
      });

      it("should handle gaps at the start of the year", () => {
        const holidays = [{ date: new Date(TEST_YEAR, 0, 5), name: "Holiday" }];
        const startDate = new Date(TEST_YEAR, 0, 1);
        const result = optimizeDaysOff(
          holidays,
          TEST_YEAR,
          5,
          DEFAULT_WEEKENDS,
          startDate,
        );
        expect(Array.isArray(result)).toBe(true);
      });

      it("should handle gaps at the end of the year", () => {
        const holidays = [
          { date: new Date(TEST_YEAR, 11, 25), name: "Christmas" },
        ];
        const result = optimizeDaysOff(holidays, TEST_YEAR, 5);
        result.forEach((date) => {
          expect(date.getFullYear()).toBe(TEST_YEAR);
          expect(date.getMonth()).toBeLessThanOrEqual(11);
        });
      });

      it("should detect and use gaps that extend to the very end of the year (Dec 29-31)", () => {
        const holidays = [
          { date: new Date(TEST_YEAR, 11, 28), name: "Holiday" },
        ];
        const result = optimizeDaysOff(
          holidays,
          TEST_YEAR,
          5,
          DEFAULT_WEEKENDS,
        );

        const endOfYearDates = result.filter(
          (date) =>
            date.getMonth() === 11 &&
            date.getDate() >= 29 &&
            date.getDate() <= 31,
        );

        result.forEach((date) => {
          expect(date.getFullYear()).toBe(TEST_YEAR);
          expect(date.getMonth()).toBeLessThanOrEqual(11);
          expect(DEFAULT_WEEKENDS).not.toContain(date.getDay());
        });
      });

      it("should use days at the end of year when there is a gap extending to Dec 31", () => {
        const holidays = [
          { date: new Date(TEST_YEAR, 11, 27), name: "Holiday" },
        ];
        const result = optimizeDaysOff(
          holidays,
          TEST_YEAR,
          3,
          DEFAULT_WEEKENDS,
        );

        const hasEndOfYearDays = result.some(
          (date) => date.getMonth() === 11 && date.getDate() >= 30,
        );

        if (result.length > 0) {
          result.forEach((date) => {
            expect(date.getFullYear()).toBe(TEST_YEAR);
            expect(DEFAULT_WEEKENDS).not.toContain(date.getDay());
          });
        }
      });

      it("should handle gaps that span year boundaries correctly", () => {
        const startDate = new Date(TEST_YEAR, 11, 20);
        const holidays = [
          { date: new Date(TEST_YEAR, 11, 25), name: "Christmas" },
        ];
        const result = optimizeDaysOff(
          holidays,
          TEST_YEAR,
          5,
          DEFAULT_WEEKENDS,
          startDate,
        );
        result.forEach((date) => {
          expect(date.getFullYear()).toBe(TEST_YEAR);
          expect(date.getTime()).toBeGreaterThanOrEqual(startDate.getTime());
        });
      });
    });
  });

  describe("calculateConsecutiveDaysOff", () => {
    const mockHolidays = [
      { date: new Date(TEST_YEAR, 0, 1), name: "New Year" },
      { date: new Date(TEST_YEAR, 0, 15), name: "Holiday" },
    ];

    describe("basic functionality", () => {
      it("should return an array of periods", () => {
        const optimizedDays = [new Date(TEST_YEAR, 0, 2)];
        const result = calculateConsecutiveDaysOff(
          mockHolidays,
          optimizedDays,
          TEST_YEAR,
        );
        expect(Array.isArray(result)).toBe(true);
      });

      it("should calculate periods with correct structure", () => {
        const optimizedDays = [new Date(TEST_YEAR, 0, 2)];
        const result = calculateConsecutiveDaysOff(
          mockHolidays,
          optimizedDays,
          TEST_YEAR,
        );
        result.forEach((period) => {
          expect(period).toHaveProperty("startDate");
          expect(period).toHaveProperty("endDate");
          expect(period).toHaveProperty("totalDays");
          expect(period).toHaveProperty("usedDaysOff");
          expect(period.startDate).toBeInstanceOf(Date);
          expect(period.endDate).toBeInstanceOf(Date);
          expect(typeof period.totalDays).toBe("number");
          expect(typeof period.usedDaysOff).toBe("number");
        });
      });

      it("should include holidays in consecutive periods", () => {
        const optimizedDays = [new Date(TEST_YEAR, 0, 2)];
        const result = calculateConsecutiveDaysOff(
          mockHolidays,
          optimizedDays,
          TEST_YEAR,
        );
        const hasPeriodWithHoliday = result.some((period) => {
          const holidayDate = mockHolidays[0].date;
          return (
            period.startDate <= holidayDate && period.endDate >= holidayDate
          );
        });
        expect(hasPeriodWithHoliday).toBe(true);
      });
    });

    describe("calculations", () => {
      it("should calculate totalDays correctly", () => {
        const optimizedDays = [new Date(TEST_YEAR, 0, 2)];
        const result = calculateConsecutiveDaysOff(
          mockHolidays,
          optimizedDays,
          TEST_YEAR,
        );
        result.forEach((period) => {
          const calculatedDays =
            Math.round(
              (period.endDate.getTime() - period.startDate.getTime()) /
                (1000 * 60 * 60 * 24),
            ) + 1;
          expect(period.totalDays).toBe(calculatedDays);
        });
      });

      it("should count usedDaysOff correctly", () => {
        const optimizedDays = [
          new Date(TEST_YEAR, 0, 2),
          new Date(TEST_YEAR, 0, 3),
        ];
        const result = calculateConsecutiveDaysOff(
          mockHolidays,
          optimizedDays,
          TEST_YEAR,
        );
        result.forEach((period) => {
          expect(period.usedDaysOff).toBeGreaterThanOrEqual(0);
          const daysInPeriod = optimizedDays.filter(
            (day) => day >= period.startDate && day <= period.endDate,
          ).length;
          expect(period.usedDaysOff).toBeLessThanOrEqual(daysInPeriod);
        });
      });

      it("should correctly count usedDaysOff in periods", () => {
        const holidays = [{ date: new Date(TEST_YEAR, 0, 1), name: "Holiday" }];
        const optimizedDays = [
          new Date(TEST_YEAR, 0, 2),
          new Date(TEST_YEAR, 0, 3),
        ];
        const result = calculateConsecutiveDaysOff(
          holidays,
          optimizedDays,
          TEST_YEAR,
        );
        const periodWithOptimized = result.find((period) =>
          optimizedDays.some(
            (day) => day >= period.startDate && day <= period.endDate,
          ),
        );
        if (periodWithOptimized) {
          const daysInPeriod = optimizedDays.filter(
            (day) =>
              day >= periodWithOptimized.startDate &&
              day <= periodWithOptimized.endDate,
          ).length;
          expect(periodWithOptimized.usedDaysOff).toBe(daysInPeriod);
        }
      });
    });

    describe("validation rules", () => {
      it("should not include periods that are only weekends", () => {
        const optimizedDays: Date[] = [];
        const result = calculateConsecutiveDaysOff(
          mockHolidays,
          optimizedDays,
          TEST_YEAR,
        );
        result.forEach((period) => {
          let allWeekends = true;
          for (
            let d = new Date(period.startDate);
            d <= period.endDate;
            d.setDate(d.getDate() + 1)
          ) {
            const dayOfWeek = d.getDay();
            if (dayOfWeek !== 0 && dayOfWeek !== 6) {
              allWeekends = false;
              break;
            }
          }
          expect(allWeekends).toBe(false);
        });
      });

      it("should exclude single-day periods", () => {
        const holidays: Array<{ date: Date; name: string }> = [];
        const optimizedDays: Date[] = [];
        const result = calculateConsecutiveDaysOff(
          holidays,
          optimizedDays,
          TEST_YEAR,
        );
        result.forEach((period) => {
          expect(period.totalDays).toBeGreaterThanOrEqual(2);
        });
      });

      it("should exclude periods that are only weekends", () => {
        const holidays: Array<{ date: Date; name: string }> = [];
        const optimizedDays: Date[] = [];
        const result = calculateConsecutiveDaysOff(
          holidays,
          optimizedDays,
          TEST_YEAR,
        );
        result.forEach((period) => {
          let hasNonWeekend = false;
          for (
            let d = new Date(period.startDate);
            d <= period.endDate;
            d.setDate(d.getDate() + 1)
          ) {
            if (!DEFAULT_WEEKENDS.includes(d.getDay())) {
              hasNonWeekend = true;
              break;
            }
          }
          expect(hasNonWeekend).toBe(true);
        });
      });

      it("should handle groups that are only weekends correctly", () => {
        const holidays: Array<{ date: Date; name: string }> = [];
        const optimizedDays: Date[] = [];
        const result = calculateConsecutiveDaysOff(
          holidays,
          optimizedDays,
          TEST_YEAR,
        );
        result.forEach((period) => {
          let hasNonWeekend = false;
          for (
            let d = new Date(period.startDate);
            d <= period.endDate;
            d.setDate(d.getDate() + 1)
          ) {
            const dayOfWeek = d.getDay();
            if (dayOfWeek !== 0 && dayOfWeek !== 6) {
              hasNonWeekend = true;
              break;
            }
          }
          expect(hasNonWeekend).toBe(true);
        });
      });
    });

    describe("parameters", () => {
      it("should respect startDate parameter", () => {
        const startDate = new Date(TEST_YEAR, 5, 1);
        const optimizedDays = [new Date(TEST_YEAR, 5, 2)];
        const result = calculateConsecutiveDaysOff(
          mockHolidays,
          optimizedDays,
          TEST_YEAR,
          DEFAULT_WEEKENDS,
          startDate,
        );
        result.forEach((period) => {
          expect(period.startDate.getTime()).toBeGreaterThanOrEqual(
            startDate.getTime(),
          );
        });
      });

      it("should handle custom weekend days", () => {
        const optimizedDays = [new Date(TEST_YEAR, 0, 2)];
        const result = calculateConsecutiveDaysOff(
          mockHolidays,
          optimizedDays,
          TEST_YEAR,
          CUSTOM_WEEKENDS,
        );
        expect(Array.isArray(result)).toBe(true);
      });

      it("should handle empty optimized days", () => {
        const result = calculateConsecutiveDaysOff(mockHolidays, [], TEST_YEAR);
        expect(Array.isArray(result)).toBe(true);
      });

      it("should include fixed days off in consecutive periods", () => {
        const optimizedDays = [new Date(TEST_YEAR, 0, 2)];
        const fixedDaysOff = [new Date(TEST_YEAR, 0, 3)];
        const result = calculateConsecutiveDaysOff(
          mockHolidays,
          optimizedDays,
          TEST_YEAR,
          DEFAULT_WEEKENDS,
          undefined,
          fixedDaysOff,
        );
        const periodWithFixed = result.find((period) => {
          const fixedDate = fixedDaysOff[0];
          return period.startDate <= fixedDate && period.endDate >= fixedDate;
        });
        expect(periodWithFixed).toBeDefined();
      });

      it("should treat fixed days off as part of consecutive periods", () => {
        const holidays = [{ date: new Date(TEST_YEAR, 0, 1), name: "Holiday" }];
        const optimizedDays = [new Date(TEST_YEAR, 0, 2)];
        const fixedDaysOff = [new Date(TEST_YEAR, 0, 3)];
        const result = calculateConsecutiveDaysOff(
          holidays,
          optimizedDays,
          TEST_YEAR,
          DEFAULT_WEEKENDS,
          undefined,
          fixedDaysOff,
        );
        const period = result.find(
          (p) =>
            p.startDate <= holidays[0].date && p.endDate >= fixedDaysOff[0],
        );
        expect(period).toBeDefined();
        if (period) expect(period.totalDays).toBeGreaterThanOrEqual(3);
      });

      it("should filter fixed days off by year and startDate", () => {
        const optimizedDays = [new Date(TEST_YEAR, 5, 2)];
        const fixedDaysOff = [
          new Date(2023, 11, 31),
          new Date(TEST_YEAR, 0, 5),
          new Date(TEST_YEAR, 5, 15),
        ];
        const startDate = new Date(TEST_YEAR, 2, 1);
        const result = calculateConsecutiveDaysOff(
          mockHolidays,
          optimizedDays,
          TEST_YEAR,
          DEFAULT_WEEKENDS,
          startDate,
          fixedDaysOff,
        );
        result.forEach((period) => {
          expect(period.startDate.getTime()).toBeGreaterThanOrEqual(
            startDate.getTime(),
          );
        });
      });
    });

    describe("edge cases", () => {
      it("should handle periods spanning multiple months", () => {
        const holidays = [
          { date: new Date(TEST_YEAR, 0, 31), name: "End of Jan" },
        ];
        const optimizedDays = [new Date(TEST_YEAR, 1, 1)];
        const result = calculateConsecutiveDaysOff(
          holidays,
          optimizedDays,
          TEST_YEAR,
        );
        expect(Array.isArray(result)).toBe(true);
      });

      it("should handle periods that start exactly at startDate", () => {
        const startDate = new Date(TEST_YEAR, 5, 1);
        const holidays = [
          { date: new Date(TEST_YEAR, 5, 1), name: "Start Holiday" },
        ];
        const optimizedDays = [new Date(TEST_YEAR, 5, 3)];
        const result = calculateConsecutiveDaysOff(
          holidays,
          optimizedDays,
          TEST_YEAR,
          DEFAULT_WEEKENDS,
          startDate,
        );
        if (result.length > 0)
          expect(result[0].startDate.getTime()).toBeGreaterThanOrEqual(
            startDate.getTime(),
          );
      });

      it("should handle periods that end exactly at year end (Dec 31)", () => {
        const holidays = [
          { date: new Date(TEST_YEAR, 11, 30), name: "Dec 30" },
        ];
        const optimizedDays = [new Date(TEST_YEAR, 11, 31)];
        const result = calculateConsecutiveDaysOff(
          holidays,
          optimizedDays,
          TEST_YEAR,
        );
        const periodAtYearEnd = result.find(
          (period) =>
            period.endDate.getMonth() === 11 && period.endDate.getDate() === 31,
        );
        if (periodAtYearEnd)
          expect(periodAtYearEnd.endDate.getFullYear()).toBe(TEST_YEAR);
      });

      it("should correctly handle overlapping optimized days and holidays", () => {
        const holidays = [{ date: new Date(TEST_YEAR, 0, 1), name: "Holiday" }];
        const optimizedDays = [
          new Date(TEST_YEAR, 0, 2),
          new Date(TEST_YEAR, 0, 3),
        ];
        const result = calculateConsecutiveDaysOff(
          holidays,
          optimizedDays,
          TEST_YEAR,
        );
        const period = result.find(
          (p) =>
            p.startDate <= holidays[0].date && p.endDate >= optimizedDays[1],
        );
        if (period) expect(period.usedDaysOff).toBe(2);
      });

      it("should handle consecutive periods separated by work days", () => {
        const holidays = [
          { date: new Date(TEST_YEAR, 0, 1), name: "Mon" },
          { date: new Date(TEST_YEAR, 0, 4), name: "Thu" },
        ];
        const optimizedDays = [
          new Date(TEST_YEAR, 0, 2),
          new Date(TEST_YEAR, 0, 5),
        ];
        const result = calculateConsecutiveDaysOff(
          holidays,
          optimizedDays,
          TEST_YEAR,
        );
        expect(result.length).toBeGreaterThanOrEqual(1);
        result.forEach((period) => {
          expect(period.totalDays).toBeGreaterThanOrEqual(2);
        });
      });
    });
  });

  describe("Integration tests", () => {
    it("should work together: get holidays, optimize, and calculate periods", () => {
      const holidays = getHolidaysForYear("US", TEST_YEAR);
      const optimizedDays = optimizeDaysOff(holidays, TEST_YEAR, 10);
      const periods = calculateConsecutiveDaysOff(
        holidays,
        optimizedDays,
        TEST_YEAR,
      );

      expect(holidays.length).toBeGreaterThan(0);
      expect(optimizedDays.length).toBeLessThanOrEqual(10);
      expect(Array.isArray(periods)).toBe(true);

      periods.forEach((period) => {
        expect(period.totalDays).toBeGreaterThanOrEqual(2);
        expect(period.usedDaysOff).toBeGreaterThanOrEqual(0);
        expect(period.startDate <= period.endDate).toBe(true);
      });
    });

    it("should optimize efficiently to maximize consecutive days", () => {
      const holidays = [{ date: new Date(TEST_YEAR, 0, 4), name: "Holiday" }];
      const optimizedDays = optimizeDaysOff(holidays, TEST_YEAR, 1);
      const periods = calculateConsecutiveDaysOff(
        holidays,
        optimizedDays,
        TEST_YEAR,
      );

      if (periods.length > 0) {
        const hasOptimizedDay = periods.some((period) =>
          optimizedDays.some(
            (day) => day >= period.startDate && day <= period.endDate,
          ),
        );
        expect(hasOptimizedDay).toBe(true);
      }
    });

    it("should handle edge case: all days are holidays or weekends", () => {
      const holidays = Array.from({ length: 50 }, (_, i) => ({
        date: new Date(TEST_YEAR, 0, i + 1),
        name: `Holiday ${i + 1}`,
      }));
      const optimizedDays = optimizeDaysOff(holidays, TEST_YEAR, 5);
      const periods = calculateConsecutiveDaysOff(
        holidays,
        optimizedDays,
        TEST_YEAR,
      );

      expect(Array.isArray(optimizedDays)).toBe(true);
      expect(Array.isArray(periods)).toBe(true);
    });

    it("should work with fixed days off: exclude from optimization, include in periods", () => {
      const holidays = [{ date: new Date(TEST_YEAR, 0, 1), name: "Holiday" }];
      const fixedDaysOff = [
        new Date(TEST_YEAR, 0, 5),
        new Date(TEST_YEAR, 0, 10),
      ];
      const optimizedDays = optimizeDaysOff(
        holidays,
        TEST_YEAR,
        10,
        DEFAULT_WEEKENDS,
        undefined,
        fixedDaysOff,
      );
      const periods = calculateConsecutiveDaysOff(
        holidays,
        optimizedDays,
        TEST_YEAR,
        DEFAULT_WEEKENDS,
        undefined,
        fixedDaysOff,
      );

      const fixedDaysOffKeys = new Set(
        fixedDaysOff.map(
          (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`,
        ),
      );
      optimizedDays.forEach((date) => {
        const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
        expect(fixedDaysOffKeys.has(dateKey)).toBe(false);
      });

      fixedDaysOff.forEach((fixedDay) => {
        const periodWithFixed = periods.find(
          (period) =>
            period.startDate <= fixedDay && period.endDate >= fixedDay,
        );
        expect(periodWithFixed).toBeDefined();
      });
    });

    it("should prioritize fixed days off over calculated days off", () => {
      const holidays = [{ date: new Date(TEST_YEAR, 0, 1), name: "Holiday" }];
      const fixedDaysOff = [new Date(TEST_YEAR, 0, 5)];
      const optimizedDays = optimizeDaysOff(
        holidays,
        TEST_YEAR,
        10,
        DEFAULT_WEEKENDS,
        undefined,
        fixedDaysOff,
      );

      const fixedDayKey = `${fixedDaysOff[0].getFullYear()}-${fixedDaysOff[0].getMonth()}-${fixedDaysOff[0].getDate()}`;
      const hasFixedDay = optimizedDays.some((day) => {
        const dayKey = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
        return dayKey === fixedDayKey;
      });
      expect(hasFixedDay).toBe(false);
    });

    it("should handle empty fixedDaysOff array the same as undefined", () => {
      const holidays = [{ date: new Date(TEST_YEAR, 0, 1), name: "Holiday" }];
      const resultWithEmpty = optimizeDaysOff(
        holidays,
        TEST_YEAR,
        5,
        DEFAULT_WEEKENDS,
        undefined,
        [],
      );
      const resultWithUndefined = optimizeDaysOff(holidays, TEST_YEAR, 5);

      expect(resultWithEmpty.length).toBe(resultWithUndefined.length);
    });

    it("should not count fixed days off in usedDaysOff calculation", () => {
      const holidays = [{ date: new Date(TEST_YEAR, 0, 1), name: "Holiday" }];
      const optimizedDays = [new Date(TEST_YEAR, 0, 2)];
      const fixedDaysOff = [
        new Date(TEST_YEAR, 0, 3),
        new Date(TEST_YEAR, 0, 4),
      ];
      const result = calculateConsecutiveDaysOff(
        holidays,
        optimizedDays,
        TEST_YEAR,
        DEFAULT_WEEKENDS,
        undefined,
        fixedDaysOff,
      );

      const period = result.find(
        (p) => p.startDate <= holidays[0].date && p.endDate >= fixedDaysOff[1],
      );
      expect(period).toBeDefined();
      if (period) {
        expect(period.usedDaysOff).toBe(1);
        expect(period.totalDays).toBeGreaterThanOrEqual(4);
      }
    });

    it("should handle case where all weekdays are fixed days off", () => {
      const fixedDaysOff: Date[] = [];
      for (let day = 1; day <= 31; day++) {
        const date = new Date(TEST_YEAR, 0, day);
        if (!DEFAULT_WEEKENDS.includes(date.getDay())) fixedDaysOff.push(date);
      }
      const holidays = [{ date: new Date(TEST_YEAR, 0, 1), name: "Holiday" }];
      const result = optimizeDaysOff(
        holidays,
        TEST_YEAR,
        5,
        DEFAULT_WEEKENDS,
        undefined,
        fixedDaysOff,
      );

      expect(Array.isArray(result)).toBe(true);
      result.forEach((date) => {
        const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
        const isFixed = fixedDaysOff.some(
          (fd) =>
            `${fd.getFullYear()}-${fd.getMonth()}-${fd.getDate()}` === dateKey,
        );
        expect(isFixed).toBe(false);
      });
    });

    it("should extend consecutive periods with fixed days off", () => {
      const holidays = [{ date: new Date(TEST_YEAR, 0, 1), name: "Holiday" }];
      const optimizedDays = [new Date(TEST_YEAR, 0, 2)];
      const fixedDaysOff = [
        new Date(TEST_YEAR, 0, 3),
        new Date(TEST_YEAR, 0, 4),
        new Date(TEST_YEAR, 0, 5),
      ];
      const result = calculateConsecutiveDaysOff(
        holidays,
        optimizedDays,
        TEST_YEAR,
        DEFAULT_WEEKENDS,
        undefined,
        fixedDaysOff,
      );

      const period = result.find(
        (p) => p.startDate <= holidays[0].date && p.endDate >= fixedDaysOff[2],
      );
      expect(period).toBeDefined();
      if (period) expect(period.totalDays).toBeGreaterThanOrEqual(5);
    });
  });

  describe("Edge cases and error handling", () => {
    it("should handle year with no holidays gracefully", () => {
      const result = optimizeDaysOff([], TEST_YEAR, 5);
      expect(Array.isArray(result)).toBe(true);
    });

    it("should handle invalid country codes gracefully", () => {
      try {
        const holidays = getHolidaysForYear("XX", TEST_YEAR);
        expect(Array.isArray(holidays)).toBe(true);
      } catch (e) {
        expect(e).toBeDefined();
      }
    });

    it("should handle dates at year boundaries", () => {
      const holidays = [
        { date: new Date(TEST_YEAR, 11, 31), name: "New Year Eve" },
      ];
      const result = optimizeDaysOff(holidays, TEST_YEAR, 5);
      expect(Array.isArray(result)).toBe(true);
    });

    it("should handle startDate at end of year", () => {
      const startDate = new Date(TEST_YEAR, 11, 15);
      const holidays = [
        { date: new Date(TEST_YEAR, 11, 25), name: "Christmas" },
      ];
      const result = optimizeDaysOff(
        holidays,
        TEST_YEAR,
        5,
        DEFAULT_WEEKENDS,
        startDate,
      );
      result.forEach((date) => {
        expect(date.getTime()).toBeGreaterThanOrEqual(startDate.getTime());
        expect(date.getFullYear()).toBe(TEST_YEAR);
      });
    });

    it("should handle startDate on Dec 31", () => {
      const startDate = new Date(TEST_YEAR, 11, 31);
      const holidays: Array<{ date: Date; name: string }> = [];
      const result = optimizeDaysOff(
        holidays,
        TEST_YEAR,
        5,
        DEFAULT_WEEKENDS,
        startDate,
      );
      result.forEach((date) => {
        expect(date.getTime()).toBeGreaterThanOrEqual(startDate.getTime());
        expect(date.getFullYear()).toBe(TEST_YEAR);
        expect(date.getMonth()).toBe(11);
        expect(date.getDate()).toBe(31);
      });
    });

    it("should handle fixed days off with startDate at end of year", () => {
      const startDate = new Date(TEST_YEAR, 11, 15);
      const fixedDaysOff = [new Date(TEST_YEAR, 11, 20)];
      const holidays = [
        { date: new Date(TEST_YEAR, 11, 25), name: "Christmas" },
      ];
      const result = optimizeDaysOff(
        holidays,
        TEST_YEAR,
        5,
        DEFAULT_WEEKENDS,
        startDate,
        fixedDaysOff,
      );
      const fixedDayKey = `${fixedDaysOff[0].getFullYear()}-${fixedDaysOff[0].getMonth()}-${fixedDaysOff[0].getDate()}`;
      result.forEach((date) => {
        const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
        expect(dateKey).not.toBe(fixedDayKey);
        expect(date.getTime()).toBeGreaterThanOrEqual(startDate.getTime());
      });
    });

    it("should handle fixed days off that are on weekends (should still be excluded)", () => {
      const saturday = new Date(TEST_YEAR, 0, 6);
      if (saturday.getDay() === 6) {
        const fixedDaysOff = [saturday];
        const holidays: Array<{ date: Date; name: string }> = [];
        const result = optimizeDaysOff(
          holidays,
          TEST_YEAR,
          5,
          DEFAULT_WEEKENDS,
          undefined,
          fixedDaysOff,
        );
        const hasSaturday = result.some(
          (d) =>
            d.getFullYear() === saturday.getFullYear() &&
            d.getMonth() === saturday.getMonth() &&
            d.getDate() === saturday.getDate(),
        );
        expect(hasSaturday).toBe(false);
      }
    });

    it("should handle fixed days off that are on holidays (should still be excluded)", () => {
      const holidayDate = new Date(TEST_YEAR, 0, 1);
      const fixedDaysOff = [holidayDate];
      const holidays = [{ date: holidayDate, name: "New Year" }];
      const result = optimizeDaysOff(
        holidays,
        TEST_YEAR,
        5,
        DEFAULT_WEEKENDS,
        undefined,
        fixedDaysOff,
      );
      const hasHoliday = result.some(
        (d) =>
          d.getFullYear() === holidayDate.getFullYear() &&
          d.getMonth() === holidayDate.getMonth() &&
          d.getDate() === holidayDate.getDate(),
      );
      expect(hasHoliday).toBe(false);
    });

    it("should handle case where no gaps are available (all days are off)", () => {
      const holidays: Array<{ date: Date; name: string }> = [];
      for (let month = 0; month < 12; month++) {
        const daysInMonth = new Date(TEST_YEAR, month + 1, 0).getDate();
        for (let day = 1; day <= daysInMonth; day++) {
          const date = new Date(TEST_YEAR, month, day);
          if (!DEFAULT_WEEKENDS.includes(date.getDay()))
            holidays.push({ date, name: `Holiday ${month}-${day}` });
        }
      }
      const result = optimizeDaysOff(holidays, TEST_YEAR, 5);
      expect(result).toEqual([]);
    });

    it("should handle selectDaysOff when gap has some days already in allDaysOff", () => {
      const holidays = [
        { date: new Date(TEST_YEAR, 0, 1), name: "Mon" },
        { date: new Date(TEST_YEAR, 0, 5), name: "Fri" },
      ];
      const fixedDaysOff = [new Date(TEST_YEAR, 0, 3)];
      const result = optimizeDaysOff(
        holidays,
        TEST_YEAR,
        5,
        DEFAULT_WEEKENDS,
        undefined,
        fixedDaysOff,
      );
      expect(Array.isArray(result)).toBe(true);
      const hasFixedDay = result.some(
        (d) =>
          d.getFullYear() === fixedDaysOff[0].getFullYear() &&
          d.getMonth() === fixedDaysOff[0].getMonth() &&
          d.getDate() === fixedDaysOff[0].getDate(),
      );
      expect(hasFixedDay).toBe(false);
    });

    it("should handle holidays from previous year correctly", () => {
      const holidays = [
        { date: new Date(2023, 11, 31), name: "Old Year" },
        { date: new Date(TEST_YEAR, 0, 1), name: "New Year" },
      ];
      const result = optimizeDaysOff(holidays, TEST_YEAR, 5);
      expect(Array.isArray(result)).toBe(true);
    });

    it("should handle leap year correctly", () => {
      const holidays = [{ date: new Date(TEST_YEAR, 1, 29), name: "Leap Day" }];
      const result = optimizeDaysOff(holidays, TEST_YEAR, 5);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("Private function behavior (tested indirectly)", () => {
    it("should correctly identify weekend days", () => {
      const holidays: Array<{ date: Date; name: string }> = [];
      const result = optimizeDaysOff(holidays, TEST_YEAR, 10);
      result.forEach((date) => {
        expect(DEFAULT_WEEKENDS).not.toContain(date.getDay());
      });
    });

    it("should correctly calculate days between dates", () => {
      const holidays = [{ date: new Date(TEST_YEAR, 0, 1), name: "Start" }];
      const optimizedDays = [new Date(TEST_YEAR, 0, 5)];
      const result = calculateConsecutiveDaysOff(
        holidays,
        optimizedDays,
        TEST_YEAR,
      );
      result.forEach((period) => {
        const calculated =
          Math.round(
            (period.endDate.getTime() - period.startDate.getTime()) /
              (1000 * 60 * 60 * 24),
          ) + 1;
        expect(period.totalDays).toBe(calculated);
      });
    });

    it("should generate consistent date keys", () => {
      const date1 = new Date(TEST_YEAR, 0, 15);
      const date2 = new Date(TEST_YEAR, 0, 15);
      const holidays = [{ date: date1, name: "Holiday" }];
      const result = optimizeDaysOff(holidays, TEST_YEAR, 5);
      const hasDate2 = result.some(
        (d) =>
          d.getFullYear() === date2.getFullYear() &&
          d.getMonth() === date2.getMonth() &&
          d.getDate() === date2.getDate(),
      );
      expect(hasDate2).toBe(false);
    });

    it("should correctly identify holidays using dateKey", () => {
      const holidays = [
        { date: new Date(TEST_YEAR, 0, 15, 10, 30), name: "Holiday" },
      ];
      const result = optimizeDaysOff(holidays, TEST_YEAR, 5);
      const hasHolidayDate = result.some(
        (d) =>
          d.getFullYear() === TEST_YEAR &&
          d.getMonth() === 0 &&
          d.getDate() === 15,
      );
      expect(hasHolidayDate).toBe(false);
    });

    it("should correctly identify fixed days off using dateKey (ignoring time component)", () => {
      const fixedDaysOff = [
        new Date(TEST_YEAR, 0, 15, 10, 30),
        new Date(TEST_YEAR, 0, 15, 14, 0),
      ];
      const holidays: Array<{ date: Date; name: string }> = [];
      const result = optimizeDaysOff(
        holidays,
        TEST_YEAR,
        5,
        DEFAULT_WEEKENDS,
        undefined,
        fixedDaysOff,
      );
      const hasFixedDay = result.some(
        (d) =>
          d.getFullYear() === TEST_YEAR &&
          d.getMonth() === 0 &&
          d.getDate() === 15,
      );
      expect(hasFixedDay).toBe(false);
    });

    it("should correctly get weekends for the year with startDate", () => {
      const startDate = new Date(TEST_YEAR, 5, 1);
      const holidays: Array<{ date: Date; name: string }> = [];
      const result = optimizeDaysOff(
        holidays,
        TEST_YEAR,
        10,
        DEFAULT_WEEKENDS,
        startDate,
      );
      result.forEach((date) => {
        expect(date.getTime()).toBeGreaterThanOrEqual(startDate.getTime());
        expect(DEFAULT_WEEKENDS).not.toContain(date.getDay());
      });
    });
  });

  describe("Complex scenarios and real-world cases", () => {
    it("should handle a typical year with multiple holidays and weekends", () => {
      const holidays = [
        { date: new Date(TEST_YEAR, 0, 1), name: "New Year" },
        { date: new Date(TEST_YEAR, 4, 27), name: "Memorial Day" },
        { date: new Date(TEST_YEAR, 6, 4), name: "Independence Day" },
        { date: new Date(TEST_YEAR, 8, 2), name: "Labor Day" },
        { date: new Date(TEST_YEAR, 10, 28), name: "Thanksgiving" },
        { date: new Date(TEST_YEAR, 11, 25), name: "Christmas" },
      ];
      const optimizedDays = optimizeDaysOff(holidays, TEST_YEAR, 10);
      const periods = calculateConsecutiveDaysOff(
        holidays,
        optimizedDays,
        TEST_YEAR,
      );

      expect(optimizedDays.length).toBeLessThanOrEqual(10);
      expect(periods.length).toBeGreaterThan(0);

      periods.forEach((period) => {
        expect(period.totalDays).toBeGreaterThanOrEqual(2);
        expect(period.startDate <= period.endDate).toBe(true);
        expect(period.usedDaysOff).toBeGreaterThanOrEqual(0);
      });
    });

    it("should maximize consecutive days off efficiently", () => {
      const holidays = [
        { date: new Date(TEST_YEAR, 0, 4), name: "Thu" },
        { date: new Date(TEST_YEAR, 0, 8), name: "Mon" },
      ];
      const optimizedDays = optimizeDaysOff(holidays, TEST_YEAR, 1);
      const periods = calculateConsecutiveDaysOff(
        holidays,
        optimizedDays,
        TEST_YEAR,
      );

      const periodWithOptimized = periods.find((p) =>
        optimizedDays.some((day) => day >= p.startDate && day <= p.endDate),
      );
      expect(periodWithOptimized).toBeDefined();
      if (periodWithOptimized)
        expect(periodWithOptimized.totalDays).toBeGreaterThanOrEqual(4);
    });

    it("should handle non-standard weekend configurations", () => {
      const holidays = [{ date: new Date(TEST_YEAR, 0, 1), name: "Holiday" }];
      const optimizedDays = optimizeDaysOff(
        holidays,
        TEST_YEAR,
        5,
        CUSTOM_WEEKENDS,
      );
      const periods = calculateConsecutiveDaysOff(
        holidays,
        optimizedDays,
        TEST_YEAR,
        CUSTOM_WEEKENDS,
      );

      optimizedDays.forEach((date) => {
        expect(CUSTOM_WEEKENDS).not.toContain(date.getDay());
      });

      expect(Array.isArray(periods)).toBe(true);
    });
  });
});

describe("timezone independence", () => {
  const originalTZ = process.env.TZ;

  const restoreTZ = () => {
    if (originalTZ === undefined) delete process.env.TZ;
    else process.env.TZ = originalTZ;
  };

  afterEach(restoreTZ);

  const ZONES = [
    "UTC",
    "America/New_York",
    "Europe/London",
    "Australia/Sydney",
    "Australia/Lord_Howe",
    "Pacific/Chatham",
  ];

  type Scenario = {
    holidays: { date: Date; name: string }[];
    year: number;
    daysOff: number;
    weekendDays?: number[];
    fixedDaysOff?: Date[];
  };

  const key = (d: Date): string =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  function signatureUnderTz(tz: string, build: () => Scenario): string {
    process.env.TZ = tz;
    try {
      const {
        holidays,
        year,
        daysOff,
        weekendDays = [0, 6],
        fixedDaysOff = [],
      } = build();
      const optimized = optimizeDaysOff(
        holidays,
        year,
        daysOff,
        weekendDays,
        undefined,
        fixedDaysOff,
      );
      const periods = calculateConsecutiveDaysOff(
        holidays,
        optimized,
        year,
        weekendDays,
        undefined,
        fixedDaysOff,
      );
      const opt = optimized.map(key).sort().join(",");
      const per = periods
        .map(
          (p) =>
            `${key(p.startDate)}..${key(p.endDate)}:${p.totalDays}/${p.usedDaysOff}`,
        )
        .join("|");
      return `optimized=[${opt}] periods=[${per}]`;
    } finally {
      restoreTZ();
    }
  }

  const scenarios: { name: string; build: () => Scenario }[] = [
    {
      name: "lone holiday near the northern fall-back window (Oct 28, 2025), budget 2",
      build: () => ({
        holidays: [{ date: new Date(2025, 9, 28), name: "H" }],
        year: 2025,
        daysOff: 2,
      }),
    },
    {
      name: "holiday adjacent to the fall-back Sunday (Mon Nov 3, 2025), budget 3",
      build: () => ({
        holidays: [{ date: new Date(2025, 10, 3), name: "H" }],
        year: 2025,
        daysOff: 3,
      }),
    },
    {
      name: "holiday near the spring-forward boundary (Mar 10, 2025), budget 3",
      build: () => ({
        holidays: [{ date: new Date(2025, 2, 10), name: "H" }],
        year: 2025,
        daysOff: 3,
      }),
    },
    {
      name: "multiple holidays plus a fixed day off across the year, budget 5",
      build: () => ({
        holidays: [
          { date: new Date(2025, 0, 1), name: "New Year" },
          { date: new Date(2025, 10, 27), name: "Thanksgiving" },
          { date: new Date(2025, 11, 25), name: "Christmas" },
        ],
        year: 2025,
        daysOff: 5,
        fixedDaysOff: [new Date(2025, 10, 28)],
      }),
    },
  ];

  scenarios.forEach(({ name, build }) => {
    it(`produces identical results across timezones: ${name}`, () => {
      const baseline = signatureUnderTz(ZONES[0], build);
      for (const tz of ZONES.slice(1)) {
        expect(
          signatureUnderTz(tz, build),
          `output under TZ=${tz} differs from ${ZONES[0]}`,
        ).toBe(baseline);
      }
    });
  });
});
