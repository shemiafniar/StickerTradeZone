import { describe, expect, it } from "vitest";
import { CHANGELOG, CURRENT_CHANGELOG_VERSION, shouldShowChangelogModal } from "@/lib/changelog";

describe("CHANGELOG data integrity", () => {
  it("has at least one entry", () => {
    expect(CHANGELOG.length).toBeGreaterThan(0);
  });

  it("every entry has a unique version", () => {
    const versions = CHANGELOG.map((e) => e.version);
    expect(new Set(versions).size).toBe(versions.length);
  });

  it("is ordered strictly newest-first by date", () => {
    for (let i = 1; i < CHANGELOG.length; i++) {
      const previous = new Date(CHANGELOG[i - 1].date).getTime();
      const current = new Date(CHANGELOG[i].date).getTime();
      expect(previous, `entry ${i - 1} (${CHANGELOG[i - 1].version}) should be newer than or equal to entry ${i} (${CHANGELOG[i].version})`).toBeGreaterThanOrEqual(current);
    }
  });

  it("every entry has a non-empty title, valid date, and at least one item", () => {
    for (const entry of CHANGELOG) {
      expect(entry.title.trim().length).toBeGreaterThan(0);
      expect(Number.isNaN(new Date(entry.date).getTime())).toBe(false);
      expect(entry.items.length).toBeGreaterThan(0);
      for (const item of entry.items) {
        expect(item.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("CURRENT_CHANGELOG_VERSION always matches the first (newest) entry, never hand-duplicated", () => {
    expect(CURRENT_CHANGELOG_VERSION).toBe(CHANGELOG[0].version);
  });
});

describe("shouldShowChangelogModal", () => {
  it("shows the modal when the user has never seen any changelog (null)", () => {
    expect(shouldShowChangelogModal(null)).toBe(true);
  });

  it("shows the modal when the user last saw an older version", () => {
    expect(shouldShowChangelogModal("0.9.0")).toBe(true);
  });

  it("hides the modal once the user has seen the current version", () => {
    expect(shouldShowChangelogModal(CURRENT_CHANGELOG_VERSION)).toBe(false);
  });

  it("a version bump reopens the modal: a user who dismissed the version before this one still sees it now", () => {
    // Simulates exactly what happens the instant a new CHANGELOG entry is
    // added and CURRENT_CHANGELOG_VERSION moves forward: everyone who had
    // dismissed the *previous* version (still stored on their profile,
    // completely unchanged) must see the modal again for the new one.
    const previousVersion = "0.0.1-before-this-release";
    expect(previousVersion).not.toBe(CURRENT_CHANGELOG_VERSION);
    expect(shouldShowChangelogModal(previousVersion)).toBe(true);
  });
});
