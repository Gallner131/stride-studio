/**
 * Binding grammar — Appendix C.
 *
 *   binding  := "{" field ( "|" modifier )* "}"
 *   field    := identifier ( "." identifier )*
 *   modifier := 0 | 1 | 2 | upper | lower | long | short | iso | elapsed | blank:text
 *
 * Unknown field renders literally, so a user typing {lol} sees {lol} and a template author
 * notices. `\{` escapes a brace.
 */

export type FieldValue = string | number | null | undefined;
export type FieldTable = Record<string, FieldValue>;

const BINDING = /\\?\{([^{}]+)\}/g;

function applyModifiers(raw: FieldValue, modifiers: string[]): string {
  let out: string;

  const decimals = modifiers.find((m) => /^[0-9]$/.test(m));
  if (decimals !== undefined && typeof raw === "number") {
    out = raw.toFixed(Number(decimals));
  } else {
    out = raw === null || raw === undefined ? "" : String(raw);
  }

  for (const m of modifiers) {
    if (m === "upper") out = out.toUpperCase();
    else if (m === "lower") out = out.toLowerCase();
  }

  if (out === "") {
    const fallback = modifiers.find((m) => m.startsWith("blank:"));
    if (fallback) out = fallback.slice("blank:".length);
  }

  return out;
}

/** Reads a dotted path such as `zoneMinutes.3` out of the field table. */
function lookup(fields: FieldTable, path: string): { found: boolean; value: FieldValue } {
  if (path in fields) return { found: true, value: fields[path] };

  // Support nested objects as well as flat dotted keys.
  const parts = path.split(".");
  let cursor: unknown = fields;
  for (const part of parts) {
    if (cursor && typeof cursor === "object" && part in (cursor as Record<string, unknown>)) {
      cursor = (cursor as Record<string, unknown>)[part];
    } else {
      return { found: false, value: undefined };
    }
  }
  return { found: true, value: cursor as FieldValue };
}

export function resolveBindings(text: string, fields: FieldTable): string {
  if (!text) return "";
  return text.replace(BINDING, (match, inner: string) => {
    if (match.startsWith("\\")) return match.slice(1); // escaped brace
    const [path, ...modifiers] = inner.split("|");
    const { found, value } = lookup(fields, (path ?? "").trim());
    if (!found) return match; // unknown field renders literally
    return applyModifiers(
      value,
      modifiers.map((m) => m.trim()),
    );
  });
}

/** Field names referenced by a string, for the "no data in this activity" hint (§4.6). */
export function bindingsUsed(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(BINDING)) {
    if (m[0].startsWith("\\")) continue;
    const path = (m[1] ?? "").split("|")[0]?.trim();
    if (path) out.push(path);
  }
  return out;
}

/** Chips offered above the keyboard when editing text (§6.4). */
export const BINDING_CHIPS: { label: string; token: string }[] = [
  { label: "Distance", token: "{distance}" },
  { label: "Unit", token: "{unit}" },
  { label: "Time", token: "{time}" },
  { label: "Pace", token: "{pace}" },
  { label: "Elevation", token: "{elevation}" },
  { label: "Heart rate", token: "{hr}" },
  { label: "Calories", token: "{calories}" },
  { label: "Name", token: "{name}" },
  { label: "Date", token: "{date}" },
  { label: "Sport", token: "{sport}" },
];
