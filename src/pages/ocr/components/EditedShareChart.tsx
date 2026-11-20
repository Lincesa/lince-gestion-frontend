import { Cell, Pie, PieChart, Tooltip } from 'recharts';

const EDITED_COLOR = 'hsl(var(--primary))';
const NOT_EDITED_COLOR = 'hsl(var(--muted-foreground) / 0.35)';

export interface EditedShare {
  edited: number;
  notEdited: number;
  /** Edited remitos over uploaded ones, 0-100, one decimal. */
  percent: number;
}

/** Splits the uploaded remitos into edited and not edited. Null when there are none. */
export function editedShare(total: number, edited: number): EditedShare | null {
  if (total <= 0) return null;
  const editedCount = Math.min(Math.max(edited, 0), total);
  return {
    edited: editedCount,
    notEdited: total - editedCount,
    percent: Math.round((editedCount / total) * 1000) / 10,
  };
}

function formatPercent(value: number): string {
  return `${value.toLocaleString('es-AR', { maximumFractionDigits: 1 })}%`;
}

interface EditedShareChartProps {
  /** Remitos matching the current filters. */
  total: number;
  /** Of those, the ones an operator corrected. */
  edited: number;
}

/** Donut with the share of uploaded remitos that an operator had to edit. */
export function EditedShareChart({ total, edited }: EditedShareChartProps) {
  const share = editedShare(total, edited);
  const slices = share
    ? [
        { name: 'Editados', value: share.edited, color: EDITED_COLOR },
        { name: 'Sin editar', value: share.notEdited, color: NOT_EDITED_COLOR },
      ]
    : [];

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Editados / subidos</p>
      {share ? (
        <div className="mt-2 flex items-center gap-4">
          <div className="relative h-[120px] w-[120px] shrink-0">
            <PieChart width={120} height={120}>
              <Pie
                data={slices}
                dataKey="value"
                nameKey="name"
                innerRadius={38}
                outerRadius={58}
                startAngle={90}
                endAngle={-270}
                paddingAngle={share.edited > 0 && share.notEdited > 0 ? 2 : 0}
                stroke="none"
                isAnimationActive={false}
              >
                {slices.map((slice) => (
                  <Cell key={slice.name} fill={slice.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => [`${value} de ${total}`, undefined]}
                contentStyle={{
                  background: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 6,
                  fontSize: 12,
                }}
              />
            </PieChart>
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-lg font-bold text-foreground">
              {formatPercent(share.percent)}
            </span>
          </div>
          <ul className="space-y-1.5 text-sm">
            {slices.map((slice) => (
              <li key={slice.name} className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: slice.color }} />
                <span className="text-foreground">{slice.name}</span>
                <span className="font-medium text-foreground">{slice.value}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">No hay remitos para estos filtros.</p>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        Según los filtros. Para un período, usá "Fecha remito desde / hasta".
      </p>
    </div>
  );
}
