// Dependency-free helpers shared by the store and the sync engine, kept
// separate so the sync engine can be unit-tested in plain Node.

export const newId = (prefix) =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

export const DONE_RETENTION_DAYS = 60;
export const DONE_RETENTION_MS = DONE_RETENTION_DAYS * 24 * 60 * 60 * 1000;
