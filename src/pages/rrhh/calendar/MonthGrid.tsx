import { useMemo, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  buildMonthGrid,
  DIAS_CORTOS,
  MESES_ES,
  todayYmd,
  type CalendarCell,
} from './calendarHelpers';

export interface DayDecoration {
  bgClass?: string;
  textClass?: string;
  badges?: ReactNode;
  tooltip?: string;
}

interface MonthGridProps {
  year: number;
  month: number;
  onChangeMonth: (year: number, month: number) => void;
  // Renderiza el contenido visual de cada día (chips/colores).
  decorateDay?: (cell: CalendarCell) => DayDecoration | undefined;
  onDayClick?: (cell: CalendarCell, target: HTMLElement) => void;
  // Habilita drag-select de rango (para ausencias).
  selectableRange?: boolean;
  onRangeSelected?: (desde: string, hasta: string, target: HTMLElement) => void;
}

export function MonthGrid({
  year,
  month,
  onChangeMonth,
  decorateDay,
  onDayClick,
  selectableRange,
  onRangeSelected,
}: MonthGridProps) {
  const weeks = useMemo(() => buildMonthGrid(year, month), [year, month]);
  const hoy = todayYmd();

  const [dragStart, setDragStart] = useState<string | null>(null);
  const [dragEnd, setDragEnd] = useState<string | null>(null);
  const lastTargetRef = useRef<HTMLElement | null>(null);

  const goPrev = () => {
    if (month === 0) onChangeMonth(year - 1, 11);
    else onChangeMonth(year, month - 1);
  };
  const goNext = () => {
    if (month === 11) onChangeMonth(year + 1, 0);
    else onChangeMonth(year, month + 1);
  };

  const inDragRange = (ymd: string): boolean => {
    if (!dragStart || !dragEnd) return false;
    const [a, b] = dragStart <= dragEnd ? [dragStart, dragEnd] : [dragEnd, dragStart];
    return ymd >= a && ymd <= b;
  };

  return (
    <div className="select-none">
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={goPrev}
          className="p-1.5 rounded-md hover:bg-accent"
          aria-label="Mes anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="text-base font-semibold capitalize">
          {MESES_ES[month]} {year}
        </div>
        <button
          type="button"
          onClick={goNext}
          className="p-1.5 rounded-md hover:bg-accent"
          aria-label="Mes siguiente"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-xs font-medium text-muted-foreground mb-1">
        {DIAS_CORTOS.map((d) => (
          <div key={d} className="text-center px-1 py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {weeks.flat().map((cell) => {
          const deco = decorateDay?.(cell);
          const isToday = cell.ymd === hoy;
          const isWeekend = cell.dow >= 5;
          const isDragSelected = inDragRange(cell.ymd);

          const baseClasses = [
            'relative aspect-square min-h-[44px] rounded-md border text-xs flex flex-col items-stretch p-1 transition-colors',
            cell.inMonth ? 'opacity-100' : 'opacity-40',
            isToday ? 'ring-2 ring-sky-500 ring-offset-1 ring-offset-background' : '',
            !deco?.bgClass && isWeekend && cell.inMonth ? 'bg-muted/50' : '',
            deco?.bgClass ?? '',
            deco?.textClass ?? '',
            isDragSelected ? 'ring-2 ring-violet-500' : '',
            'hover:brightness-105 cursor-pointer',
          ].join(' ');

          return (
            <button
              key={cell.ymd}
              type="button"
              title={deco?.tooltip}
              className={baseClasses}
              onMouseDown={(e) => {
                if (selectableRange) {
                  setDragStart(cell.ymd);
                  setDragEnd(cell.ymd);
                  lastTargetRef.current = e.currentTarget;
                }
              }}
              onMouseEnter={() => {
                if (selectableRange && dragStart) {
                  setDragEnd(cell.ymd);
                }
              }}
              onMouseUp={(e) => {
                if (selectableRange && dragStart && dragEnd && onRangeSelected) {
                  const [a, b] = dragStart <= dragEnd ? [dragStart, dragEnd] : [dragEnd, dragStart];
                  onRangeSelected(a, b, e.currentTarget);
                  setDragStart(null);
                  setDragEnd(null);
                  return;
                }
                if (onDayClick) onDayClick(cell, e.currentTarget);
              }}
              onMouseLeave={() => {
                // nothing
              }}
            >
              <div className="flex justify-end text-[10px] font-semibold opacity-70">
                {cell.day}
              </div>
              <div className="flex-1 flex flex-col items-stretch justify-end gap-0.5">
                {deco?.badges}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
