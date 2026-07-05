import { AlertCircle, CheckCircle2, Info } from "lucide-react";

export type ToastKind = "success" | "error" | "info";

interface ToastProps {
  message: string;
  kind: ToastKind;
}

export function Toast({ message, kind }: ToastProps) {
  const Icon = kind === "success" ? CheckCircle2 : kind === "error" ? AlertCircle : Info;
  return (
    <div className={`toast ${kind}`} role="status">
      <Icon size={18} />
      <span>{message}</span>
    </div>
  );
}
