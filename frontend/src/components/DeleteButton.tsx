import { useState } from "react";
import { Icon } from "./Icon";

/** A sibling of the row link/button: deletion must never trigger navigation. */
export function DeleteButton({ label, message, onDelete, onError, disabled = false }: {
  label: string;
  message: string;
  onDelete: () => Promise<void>;
  onError: (message: string) => void;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  return <button type="button" className="zh-delete-button" aria-label={label}
    title={disabled ? "请先停止未结束的研究，再删除" : label} disabled={disabled || busy}
    onClick={async (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (busy || !window.confirm(message)) return;
      setBusy(true);
      try { await onDelete(); }
      catch (error) { onError(error instanceof Error ? error.message : String(error)); }
      finally { setBusy(false); }
    }}><Icon name="trash" size={16} /></button>;
}
