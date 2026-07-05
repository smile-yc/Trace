import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";

interface PeriodNavigatorProps {
  label: string;
  currentLabel: string;
  prevLabel: string;
  nextLabel: string;
  onPrev: () => void;
  onCurrent: () => void;
  onNext: () => void;
}

export function PeriodNavigator({
  label,
  currentLabel,
  prevLabel,
  nextLabel,
  onPrev,
  onCurrent,
  onNext
}: PeriodNavigatorProps) {
  return (
    <div className="period-nav" aria-label={label}>
      <button type="button" className="btn btn-soft" onClick={onPrev}>
        <ChevronLeft size={16} />
        {prevLabel}
      </button>
      <button type="button" className="btn btn-ghost period-current" onClick={onCurrent}>
        <RotateCcw size={16} />
        {currentLabel}
      </button>
      <button type="button" className="btn btn-soft" onClick={onNext}>
        {nextLabel}
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
