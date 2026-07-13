export interface SearchOption {
  value: string;
  label: string;
  keywords?: ReadonlyArray<string>;
  disabled?: boolean;
}

export function filterSearchOptions<T extends SearchOption>(options: ReadonlyArray<T>, query: string): ReadonlyArray<T> {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return options;

  return options.filter((option) => {
    const searchableText = [option.label, option.value, ...(option.keywords ?? [])].join(" ").toLocaleLowerCase();
    return searchableText.includes(normalizedQuery);
  });
}
