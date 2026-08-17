import { describe, expect, it } from "vitest";
import {
  MAX_PAGE_SIZE,
  clampPageToCount,
  getPageRange,
  getPaginationSummary,
} from "@/lib/pagination";
import {
  APP_VERSION,
  APP_VERSION_LABEL,
  USER_MANUAL_FILENAME,
  USER_MANUAL_URL,
} from "@/lib/app-info";
import { buildIlikeOrFilter } from "@/lib/repositories/query-helpers";

describe("pagination", () => {
  it("caps every query range at 50 rows", () => {
    expect(MAX_PAGE_SIZE).toBe(50);
    expect(getPageRange(1, 500)).toEqual({ from: 0, to: 49, pageSize: 50 });
    expect(getPageRange(2, 50)).toEqual({ from: 50, to: 99, pageSize: 50 });
  });

  it("normalizes invalid page values", () => {
    expect(getPageRange(0, 25)).toEqual({ from: 0, to: 24, pageSize: 25 });
    expect(getPageRange(Number.NaN, 25)).toEqual({ from: 0, to: 24, pageSize: 25 });
  });

  it("clamps a page after the result count shrinks", () => {
    expect(clampPageToCount(5, 199, 50)).toBe(4);
    expect(clampPageToCount(5, 0, 50)).toBe(1);
    expect(clampPageToCount(2, 51, 50)).toBe(2);
  });

  it("builds an inclusive result summary", () => {
    expect(getPaginationSummary(2, 50, 347)).toEqual({
      from: 51,
      to: 100,
      totalPages: 7,
    });
    expect(getPaginationSummary(1, 50, 0)).toEqual({ from: 0, to: 0, totalPages: 1 });
  });
});

describe("application release metadata", () => {
  it("builds the visible release label from one version constant", () => {
    expect(APP_VERSION).toBe("1.0");
    expect(APP_VERSION_LABEL).toBe(`O3S v${APP_VERSION}`);
  });

  it("keeps the manual download filename while encoding its public URL", () => {
    expect(USER_MANUAL_FILENAME).toBe("Manual de usuario.pdf");
    expect(USER_MANUAL_URL).toBe("/Manual%20de%20usuario.pdf");
  });
});

describe("PostgREST search filters", () => {
  it("quotes reserved commas inside a server-side ilike filter", () => {
    expect(buildIlikeOrFilter(["name", "tax_id"], " AC,ME ")).toBe(
      'name.ilike."%AC,ME%",tax_id.ilike."%AC,ME%"',
    );
  });
});
