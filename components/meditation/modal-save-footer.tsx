export function ModalSaveFooter(props: {
  onSave: () => void;
  disabled?: boolean;
  saveLabel?: string;
}) {
  const disabled = props.disabled ?? false;
  const label = props.saveLabel ?? "Save";
  return (
    <div className="shrink-0 px-4 py-3 backdrop-blur-sm">
      <button
        type="button"
        disabled={disabled}
        onClick={props.onSave}
        className={`w-full rounded-xl py-3 text-center text-sm font-semibold transition active:scale-[0.99] ${
          disabled
            ? "cursor-not-allowed bg-zinc-700 text-zinc-500"
            : "border border-zinc-600 bg-zinc-800 text-zinc-50 hover:border-zinc-500 hover:bg-zinc-700"
        }`}
      >
        {label}
      </button>
    </div>
  );
}
