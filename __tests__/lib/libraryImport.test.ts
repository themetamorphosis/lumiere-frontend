import { describe, expect, it } from "vitest";
import { parseLibraryImport } from "@/lib/libraryImport";

describe("library import", () => {
  it("preserves CSV quotes, multiline notes, editions, statuses and favorites", () => {
    const input = 'Title,Year,Status,Favorite,Notes\r\n"Paris, Texas",1984,watching,yes,"First line\r\n\""Quoted\"" line"\r\nDune,2021,wishlist,false,Later';
    expect(parseLibraryImport(input, "movie", "watched")).toEqual([
      { row: 2, title: "Paris, Texas", entry: {
        title: "Paris, Texas", year: 1984, mediaType: "movie", status: "pending", favorite: true,
        notes: 'First line\r\n"Quoted" line',
      } },
      { row: 4, title: "Dune", entry: {
        title: "Dune", year: 2021, mediaType: "movie", status: "wishlist", favorite: false, notes: "Later",
      } },
    ]);
  });

  it("keeps a row for invalid input and detects all 1,001 records", () => {
    const input = JSON.stringify(Array.from({ length: 1001 }, (_, i) =>
      i === 500 ? { title: "", favorite: true } : { title: `Film ${i}`, tmdbId: i + 1 },
    ));
    const rows = parseLibraryImport(input, "movie", "wishlist");
    expect(rows).toHaveLength(1001);
    expect(rows[500]).toMatchObject({ row: 501, error: expect.any(String) });
    expect(rows[1000]).toMatchObject({ row: 1001, entry: { tmdbId: 1001, status: "wishlist" } });
  });

  it("uses an uploaded CSV header even when it has a single column", () => {
    const rows = parseLibraryImport('Title\n"Paris, Texas"', "movie", "watched", "csv");
    expect(rows).toMatchObject([{ row: 2, title: "Paris, Texas" }]);
    const invalid = parseLibraryImport("Year,Status\n2021,watched", "movie", "watched", "csv");
    expect(invalid).toMatchObject([{ row: 1, error: expect.stringContaining("Title or Name") }]);
  });

  it("keeps dashes in text titles and handles date ranges", () => {
    const rows = parseLibraryImport("X - A Story (1982)\nDark (2017–2020)", "tv", "watched");
    expect(rows[0]).toMatchObject({ title: "X - A Story", entry: { year: 1982 } });
    expect(rows[1]).toMatchObject({ entry: { year: 2017, endYear: 2020 } });
  });
});
