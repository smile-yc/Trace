export interface SearchOption {
  value: string;
  label: string;
  keywords?: ReadonlyArray<string>;
  disabled?: boolean;
  hiddenUntilSearch?: boolean;
}

export function filterSearchOptions<T extends SearchOption>(options: ReadonlyArray<T>, query: string): ReadonlyArray<T> {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const candidates = normalizedQuery ? options : options.filter((option) => !option.hiddenUntilSearch);
  if (!normalizedQuery) return candidates;

  return candidates.filter((option) => {
    const searchableText = [option.label, option.value, ...(option.keywords ?? [])].join(" ").toLocaleLowerCase();
    return searchableText.includes(normalizedQuery);
  });
}
