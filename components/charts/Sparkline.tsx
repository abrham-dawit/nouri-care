/** Tiny trend line: history in a de-emphasised ink, the latest point in the accent. */
export function Sparkline({ values, width = 96, height = 28, label }: { values: (number | null)[]; width?: number; height?: number; label: string }) {
  const nums = values.filter((v): v is number => v !== null);
  if (nums.length < 2) return <span className="text-sm text-mist-500">Not enough data</span>;
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const x = (i: number) => 2 + (i / (values.length - 1)) * (width - 4);
  const y = (v: number) => height - 3 - ((v - min) / (max - min || 1)) * (height - 6);
  let d = "";
  let pen = false;
  values.forEach((v, i) => {
    if (v === null) {
      pen = false;
      return;
    }
    d += `${pen ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`;
    pen = true;
  });
  const lastIndex = values.map((v, i) => (v === null ? -1 : i)).filter((i) => i >= 0).pop()!;
  return (
    <svg width={width} height={height} role="img" aria-label={label} className="overflow-visible">
      <path d={d} fill="none" stroke="var(--color-mist-500)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(lastIndex)} cy={y(values[lastIndex]!)} r="3" fill="var(--color-glow-400)" />
    </svg>
  );
}
