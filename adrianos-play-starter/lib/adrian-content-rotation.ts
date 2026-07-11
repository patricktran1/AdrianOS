export function shuffled<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5);
}

export function pickFreshItems<T>(
  items: T[],
  count: number,
  storageKey: string,
  getId: (item: T) => string,
  historyLimit = 80
): T[] {
  if (items.length <= count) return shuffled(items);
  if (typeof window === "undefined") return shuffled(items).slice(0, count);

  let history: string[] = [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(storageKey) ?? "[]");
    if (Array.isArray(parsed)) {
      history = parsed.filter((value): value is string => typeof value === "string");
    }
  } catch {
    history = [];
  }

  const historyRank = new Map(history.map((id, index) => [id, index]));
  const unseen = shuffled(items.filter((item) => !historyRank.has(getId(item))));
  const seenOldestFirst = items
    .filter((item) => historyRank.has(getId(item)))
    .sort((a, b) => (historyRank.get(getId(b)) ?? 0) - (historyRank.get(getId(a)) ?? 0));
  const selected = [...unseen, ...seenOldestFirst].slice(0, count);
  const selectedIds = selected.map(getId);
  const nextHistory = [
    ...selectedIds,
    ...history.filter((id) => !selectedIds.includes(id)),
  ].slice(0, historyLimit);

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(nextHistory));
  } catch {
    // Content rotation is optional; the game still works without storage.
  }

  return shuffled(selected);
}
