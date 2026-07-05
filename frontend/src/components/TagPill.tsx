interface TagPillProps {
  tag: string;
  active?: boolean;
  onClick?: (tag: string) => void;
}

export function TagPill({ tag, active = false, onClick }: TagPillProps) {
  const clickable = Boolean(onClick);
  return (
    <button
      className={`tag-pill ${active ? "active" : ""} ${clickable ? "clickable" : ""}`}
      disabled={!clickable}
      onClick={() => onClick?.(tag)}
      type="button"
    >
      {tag}
    </button>
  );
}
