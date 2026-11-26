import { z } from "zod";
import { MediaTypeSchema, StatusSchema } from "@/lib/validators";
import type { Item, MediaType, Status } from "@/lib/types";

const integerField = z.number().int().min(-2147483648).max(2147483647);

const importFields = z.object({
  title: z.string().trim().min(1).max(500),
  mediaType: MediaTypeSchema,
  status: StatusSchema,
  favorite: z.boolean(),
  year: integerField.optional(),
  endYear: integerField.optional(),
  running: z.boolean().optional(),
  tmdbId: z.number().int().positive().optional(),
  genres: z.array(z.string()).optional(),
  notes: z.string().max(1000).optional(),
  description: z.string().max(2000).optional(),
  coverUrl: z.string().optional(),
  runtime: integerField.nonnegative().optional(),
});

export type LibraryImportFormat = "csv" | "json" | "txt";

export type LibraryImportEntry = Omit<Item, "id" | "createdAt" | "updatedAt">;
export type LibraryImportRow = { row: number; title: string } & (
  { entry: LibraryImportEntry } | { error: string }
);

const statuses: Record<string, Status> = {
  watched: "watched",
  pending: "pending",
  watching: "pending",
  wishlist: "wishlist",
};

function parseBoolean(value: unknown): unknown {
  if (typeof value === "string") {
    const word = value.toLowerCase().trim();
    if (["true", "yes", "1"].includes(word)) return true;
    if (["false", "no", "0"].includes(word)) return false;
  }
  return value;
}

function parseInteger(value: unknown): unknown {
  if (typeof value === "string" && /^[+-]?\d+$/.test(value.trim())) return Number(value);
  return value;
}

function parseEntry(input: unknown, mediaType: MediaType, status: Status, row: number): LibraryImportRow {
  if (typeof input === "string") {
    const title = input.trim().replace(/^([-*•]|\d+\.)\s+/, "");
    const dated = title.match(/^(.+?)\s*\((\d{4})(?:\s*[-–—]\s*(\d{4}|running|ongoing|present))?\)$/i);
    input = dated ? {
      title: dated[1],
      year: Number(dated[2]),
      endYear: /^\d+$/.test(dated[3] ?? "") ? Number(dated[3]) : undefined,
      running: /running|ongoing|present/i.test(dated[3] ?? "") || undefined,
    } : { title };
  }

  const fields = input && typeof input === "object" && !Array.isArray(input)
    ? new Map(Object.entries(input).map(([key, value]) => [key.toLowerCase().replace(/[\s_-]/g, ""), value]))
    : new Map<string, unknown>();
  const val = (key: string) => {
    const field = fields.get(key);
    return field === "" || field == null ? undefined : field;
  };
  const rawTitle = val("title") ?? val("name");
  const rawStatus = typeof val("status") === "string" ? String(val("status")).trim().toLowerCase() : val("status");
  const running = rawStatus === "running" || rawStatus === "ongoing";
  const ended = rawStatus === "ended";
  const rawGenres = val("genres");
  const parsed = importFields.safeParse({
    title: rawTitle,
    mediaType: val("mediatype") ?? mediaType,
    status: rawStatus === undefined || running || ended
      ? status
      : (typeof rawStatus === "string" && Object.hasOwn(statuses, rawStatus) ? statuses[rawStatus] : rawStatus),
    favorite: parseBoolean(val("favorite") ?? false),
    running: parseBoolean(val("running") ?? (running ? true : ended ? false : undefined)),
    year: parseInteger(val("year") ?? val("releaseyear")),
    endYear: parseInteger(val("endyear")),
    tmdbId: parseInteger(val("tmdbid")),
    runtime: parseInteger(val("runtime")),
    genres: typeof rawGenres === "string" ? rawGenres.split(/[,;|]/).map((v) => v.trim()).filter(Boolean) : rawGenres,
    notes: val("notes"),
    description: val("description"),
    coverUrl: val("coverurl"),
  });

  if (parsed.success) return { row, title: parsed.data.title, entry: parsed.data };
  const field = parsed.error.issues[0].path[0];
  return {
    row,
    title: typeof rawTitle === "string" ? rawTitle.trim() : "",
    error: field === "title" ? "Provide a title of 1–500 characters." : `Check the ${String(field)} value.`,
  };
}

/** Read quoted CSV fields as a single value, including commas and line breaks. */
function readCsv(text: string): { fields: string[]; row: number; error?: string }[] {
  const rows: { fields: string[]; row: number; error?: string }[] = [];
  let fields: string[] = [];
  let field = "";
  let quoted = false;
  let closed = false;
  let line = 1;
  let row = 1;
  let error: string | undefined;

  for (let index = 0; index <= text.length; index++) {
    const char = text[index];
    if (char === "\r" && text[index + 1] === "\n" && !quoted) continue;
    if (quoted && char !== undefined) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index++;
      } else if (char === '"') {
        quoted = false;
        closed = true;
      } else {
        field += char;
        if (char === "\n" || (char === "\r" && text[index + 1] !== "\n")) line++;
      }
      continue;
    }

    if (char === "," || char === "\n" || char === "\r" || char === undefined) {
      if (quoted) error = "A quoted field is missing its closing quote.";
      fields.push(field);
      field = "";
      closed = false;
      if (char === ",") continue;
      if (fields.some((value) => value.trim()) || error) rows.push({ fields, row, error });
      fields = [];
      error = undefined;
      row = ++line;
    } else if (char === '"' && field.length === 0 && !closed) {
      quoted = true;
    } else {
      if (char === '"' || (closed && char.trim())) error = "Check the placement of quotation marks.";
      if (!closed) field += char;
    }
  }
  return rows;
}

export function parseLibraryImport(
  text: string,
  mediaType: MediaType,
  status: Status,
  format?: LibraryImportFormat,
): LibraryImportRow[] {
  const source = text.replace(/^\uFEFF/, "");
  if (!source.trim()) return [];

  if (format === "json" || (!format && /^\s*[\[{]/.test(source))) {
    try {
      const entries: unknown = JSON.parse(source);
      if (Array.isArray(entries)) {
        return entries.map((item, index) => parseEntry(item, mediaType, status, index + 1));
      }
    } catch {
      // Surface invalid JSON as a file error instead of importing the text.
    }
    return [{ row: 1, title: "", error: "JSON imports need a valid array of titles or records." }];
  }

  const lines = source.split(/\r\n|\n|\r/);
  const header = lines.find((line) => line.trim()) ?? "";
  const hasTitleHeader = /(?:^|,)\s*"?\s*(title|name)\s*"?(?=\s*,|\s*$)/i.test(header);
  if (format === "csv" || (!format && header.includes(",") && hasTitleHeader)) {
    const [columns, ...rows] = readCsv(source);
    if (columns.error) return [{ row: columns.row, title: "", error: columns.error }];
    if (!columns.fields.some((name) => /^(title|name)$/i.test(name.trim()))) {
      return [{ row: columns.row, title: "", error: "The CSV header needs a Title or Name column." }];
    }
    return rows.map(({ fields, row, error }) => {
      if (error || fields.length !== columns.fields.length) {
        return { row, title: fields[0], error: error ?? "Column count does not match the CSV header." };
      }
      return parseEntry(
        Object.fromEntries(columns.fields.map((name, index) => [name, fields[index]])),
        mediaType, status, row,
      );
    });
  }

  return lines.flatMap((line, index) => line.trim() ? [parseEntry(line, mediaType, status, index + 1)] : []);
}
