export function Stepper({
  steps,
  current,
}: {
  steps: string[];
  current: number; // 0-based index of the active step
}) {
  return (
    <ol className="mb-8 flex items-center gap-2">
      {steps.map((label, i) => {
        const state =
          i < current ? "done" : i === current ? "active" : "todo";
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              className={
                "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium " +
                (state === "active"
                  ? "bg-indigo-500 text-white"
                  : state === "done"
                    ? "bg-indigo-500/20 text-indigo-300"
                    : "bg-zinc-800 text-zinc-500")
              }
            >
              {i + 1}
            </span>
            <span
              className={
                "text-sm " + (state === "todo" ? "text-zinc-500" : "text-zinc-200")
              }
            >
              {label}
            </span>
            {i < steps.length - 1 && <span className="mx-1 h-px w-8 bg-zinc-700" />}
          </li>
        );
      })}
    </ol>
  );
}
