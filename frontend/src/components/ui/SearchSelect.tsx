import { Check, ChevronDown, Search } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { filterSearchOptions, type SearchOption } from "./searchOptions";

export interface SearchSelectProps {
  options: ReadonlyArray<SearchOption>;
  value?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  ariaLabel?: string;
  onChange: (value: string) => void;
}

export function SearchSelect({
  options,
  value,
  placeholder = "请选择",
  searchPlaceholder = "搜索选项",
  emptyText = "没有匹配项",
  disabled = false,
  ariaLabel = "可搜索选择器",
  onChange
}: SearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const listboxId = useId();
  const selected = options.find((option) => option.value === value);
  const visibleOptions = useMemo(() => filterSearchOptions(options, query), [options, query]);

  function close() {
    setOpen(false);
    setQuery("");
  }

  return (
    <div className="ui-search-select" onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) close();
    }}>
      <button
        className="ui-select-trigger"
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        onClick={() => setOpen((current) => !current)}
      >
        <span className={selected ? "" : "is-placeholder"}>{selected?.label ?? placeholder}</span>
        <ChevronDown aria-hidden="true" size={16} />
      </button>
      {open && (
        <div className="ui-select-popover">
          <div className="ui-select-search">
            <Search aria-hidden="true" size={16} />
            <input
              autoFocus
              value={query}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <div id={listboxId} className="ui-select-options" role="listbox" aria-label={ariaLabel}>
            {visibleOptions.length ? visibleOptions.map((option) => (
              <button
                className="ui-select-option"
                type="button"
                role="option"
                aria-selected={option.value === value}
                disabled={option.disabled}
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  close();
                }}
              >
                <span>{option.label}</span>
                {option.value === value && <Check aria-hidden="true" size={16} />}
              </button>
            )) : <div className="ui-select-empty">{emptyText}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
