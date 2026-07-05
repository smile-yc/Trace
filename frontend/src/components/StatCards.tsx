import type { StatItem } from "../types";

interface StatCardsProps {
  items: StatItem[];
}

export function StatCards({ items }: StatCardsProps) {
  return (
    <section className="stat-grid" aria-label="统计数据">
      {items.map((item) => (
        <div className="stat-card" key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
    </section>
  );
}
