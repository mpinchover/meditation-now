export function ModalSelectFooter(props: { onSelect: () => void }) {
  return (
    <div className="shrink-0 px-4 py-3 backdrop-blur-sm">
      <button
        type="button"
        onClick={props.onSelect}
        className="w-full rounded-xl border border-zinc-600 bg-zinc-800 py-3 text-center text-sm font-semibold text-zinc-50 transition hover:border-zinc-500 hover:bg-zinc-700 active:scale-[0.99]"
      >
        Select
      </button>
    </div>
  );
}
