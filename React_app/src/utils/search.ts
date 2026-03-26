export function normalizeSearchValue(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function matchesSearchTerm(
  searchTerm: string,
  values: unknown[],
): boolean {
  const normalizedTerm = normalizeSearchValue(searchTerm);

  if (!normalizedTerm) {
    return true;
  }

  return values.some((value) =>
    normalizeSearchValue(value).includes(normalizedTerm),
  );
}
