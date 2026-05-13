export function SoundsBootstrapSpinner(props: {
  /** Optional message shown under the spinner. */
  message?: string;
}) {
  const message = props.message ?? "Loading sounds…";
  return (
    <div
      className="flex min-h-full flex-1 flex-col items-center justify-center gap-4 px-6 py-16"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="size-10 shrink-0 rounded-full border-2 border-zinc-700 border-t-zinc-300 animate-spin" />
      <p className="text-center text-sm text-zinc-400">{message}</p>
    </div>
  );
}
