import { ulid } from "ulidx";

/** Sortable, coordination-free ids (§11.1). */
export const newId = (prefix: "doc" | "ly" | "as" | "lk"): string => `${prefix}_${ulid()}`;
