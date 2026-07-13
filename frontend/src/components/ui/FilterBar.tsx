import { SlidersHorizontal, X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./Button";

export interface ActiveFilter {
  id: string;
  label: string;
}

export interface FilterBarProps {
  children: ReactNode;
  activeFilters?: ReadonlyArray<ActiveFilter>;
  moreFilters?: ReactNode;
  moreOpen?: boolean;
  sticky?: boolean;
  onMoreToggle?: () => void;
  onRemoveFilter?: (id: string) => void;
  onClearAll?: () => void;
}

export function FilterBar({
  children,
  activeFilters = [],
  moreFilters,
  moreOpen = false,
  sticky = true,
  onMoreToggle,
  onRemoveFilter,
  onClearAll
}: FilterBarProps) {
  return (
    <section className={`ui-filter-bar ${sticky ? "is-sticky" : ""}`} aria-label="筛选条件">
      <div className="ui-filter-main">
        <div className="ui-filter-controls">{children}</div>
        {moreFilters && (
          <Button variant="text" leadingIcon={<SlidersHorizontal size={16} />} aria-expanded={moreOpen} onClick={onMoreToggle}>
            更多筛选
          </Button>
        )}
      </div>
      {moreOpen && moreFilters && <div className="ui-filter-more">{moreFilters}</div>}
      {activeFilters.length > 0 && (
        <div className="ui-active-filters">
          {activeFilters.map((filter) => (
            <span className="ui-filter-chip" key={filter.id}>
              {filter.label}
              {onRemoveFilter && (
                <button type="button" aria-label={`移除筛选：${filter.label}`} title="移除筛选" onClick={() => onRemoveFilter(filter.id)}>
                  <X aria-hidden="true" size={14} />
                </button>
              )}
            </span>
          ))}
          {onClearAll && <button className="ui-filter-clear" type="button" onClick={onClearAll}>清除全部</button>}
        </div>
      )}
    </section>
  );
}
