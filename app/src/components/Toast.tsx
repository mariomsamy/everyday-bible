import { useUI } from '../state/ui';

export function Toast() {
  const toast = useUI((s) => s.toast);
  const dismiss = useUI((s) => s.dismissToast);
  if (!toast) return null;
  return (
    <div className="toast" role="status" key={toast.id}>
      <span>{toast.message}</span>
      {toast.action && (
        <button
          onClick={() => {
            toast.action!.run();
            dismiss();
          }}
        >
          {toast.action.label}
        </button>
      )}
    </div>
  );
}
