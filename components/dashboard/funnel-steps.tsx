// "lead" fica de fora do funil por decisão do usuário (etapa ainda não
// confirmada/consistente na LP atual) — a RPC funnel_counts continua
// retornando essa linha, só não é exibida aqui. Os dados de Lead em si
// continuam disponíveis nos cards do topo e na aba Páginas.
const STAGE_LABELS: Record<string, string> = {
  visited: "Visitou",
  checkout: "Checkout",
  purchase: "Compra",
};

const STAGE_ORDER = ["visited", "checkout", "purchase"];

const SVG_WIDTH = 400;
const BAND_HEIGHT = 68;
const BAND_GAP = 4;
const MIN_BAND_WIDTH = 90;
const SIDE_LABEL_WIDTH = 64;

export function FunnelSteps({ steps }: { steps: { stage: string; visitor_count: number | string }[] }) {
  const ordered = STAGE_ORDER.map(
    (stage) => steps.find((s) => s.stage === stage) ?? { stage, visitor_count: 0 },
  );
  const counts = ordered.map((s) => Number(s.visitor_count));
  const max = counts[0] || 1;
  const usableWidth = SVG_WIDTH - SIDE_LABEL_WIDTH;
  const widths = counts.map((c) => (c > 0 ? Math.max((c / max) * usableWidth, MIN_BAND_WIDTH) : 0));
  const svgHeight = ordered.length * BAND_HEIGHT + (ordered.length - 1) * BAND_GAP;

  return (
    <svg viewBox={`0 0 ${SVG_WIDTH} ${svgHeight}`} className="w-full">
      {ordered.map((step, i) => {
        const topWidth = widths[i];
        const bottomWidth = i < widths.length - 1 ? widths[i + 1] : widths[i];
        if (topWidth === 0 && bottomWidth === 0) return null;

        const count = counts[i];
        const prevCount = i > 0 ? counts[i - 1] : null;
        const stepRate = prevCount && prevCount > 0 ? (count / prevCount) * 100 : null;

        const y = i * (BAND_HEIGHT + BAND_GAP);
        const topX1 = (usableWidth - topWidth) / 2;
        const topX2 = topX1 + topWidth;
        const bottomX1 = (usableWidth - bottomWidth) / 2;
        const bottomX2 = bottomX1 + bottomWidth;

        return (
          <g key={step.stage}>
            <polygon
              points={`${topX1},${y} ${topX2},${y} ${bottomX2},${y + BAND_HEIGHT} ${bottomX1},${y + BAND_HEIGHT}`}
              className="fill-primary"
            />
            <foreignObject x={0} y={y} width={usableWidth} height={BAND_HEIGHT}>
              <div className="flex h-full w-full flex-col items-center justify-center text-primary-foreground">
                <span className="text-sm font-medium">{STAGE_LABELS[step.stage] ?? step.stage}</span>
                <span className="font-mono text-lg font-bold tabular-nums">{count}</span>
              </div>
            </foreignObject>
            {stepRate !== null && (
              <foreignObject x={usableWidth} y={y} width={SIDE_LABEL_WIDTH} height={BAND_HEIGHT}>
                <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                  {stepRate.toFixed(1)}%
                </div>
              </foreignObject>
            )}
          </g>
        );
      })}
    </svg>
  );
}
