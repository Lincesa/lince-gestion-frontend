import { useState } from 'react';
import { ChevronDown, ChevronUp, Layers, Plus } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store';
import { openCreatePoint, setAllLayersVisible, toggleLayerVisibility } from '@/store/logistica/geoLayersSlice';

export function GeoLayersPanel() {
  const dispatch = useAppDispatch();
  const { layers, visibility } = useAppSelector((s) => s.geoLayers);
  const [collapsed, setCollapsed] = useState(false);

  if (layers.length === 0) return null;

  const allVisible = layers.every((l) => visibility[l.carpeta] === true);
  const hasEnabledLayers = layers.some((l) => visibility[l.carpeta] === true);

  return (
    <div
      className="absolute top-3 right-3 z-[900] w-56 rounded-lg border border-border bg-card shadow-lg"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="flex cursor-pointer items-center justify-between px-3 py-2 select-none"
        onClick={() => setCollapsed((c) => !c)}
      >
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Layers size={14} />
          Capas
        </div>
        {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
      </div>

      {!collapsed && (
        <>
          <div className="flex items-center justify-between border-t border-border px-3 py-1.5">
            <span className="text-xs text-muted-foreground">
              {layers.reduce((acc, l) => acc + l.points.length, 0)} puntos
            </span>
            <div className="flex gap-2">
              {!allVisible && (
                <button
                  className="text-xs text-primary hover:underline"
                  onClick={() => dispatch(setAllLayersVisible(true))}
                >
                  Ver todas
                </button>
              )}
              {hasEnabledLayers && (
                <button
                  className="text-xs text-muted-foreground hover:underline"
                  onClick={() => dispatch(setAllLayersVisible(false))}
                >
                  Ocultar
                </button>
              )}
            </div>
          </div>

          <ul className="max-h-72 overflow-y-auto border-t border-border py-1">
            {layers.map((layer) => {
              const isVisible = visibility[layer.carpeta] === true;
              return (
                <li
                  key={layer.carpeta}
                  className="flex cursor-pointer items-center gap-2 px-3 py-1.5 hover:bg-muted/50"
                  onClick={() => dispatch(toggleLayerVisibility(layer.carpeta))}
                >
                  <img
                    src={`/geo-icons/${layer.iconFile}`}
                    alt=""
                    className="h-4 w-4 shrink-0 object-contain"
                    style={{ opacity: isVisible ? 1 : 0.35 }}
                  />
                  <span
                    className="flex-1 truncate text-xs"
                    style={{ opacity: isVisible ? 1 : 0.45 }}
                  >
                    {layer.carpeta}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {layer.points.length}
                  </span>
                  <input
                    type="checkbox"
                    checked={isVisible}
                    readOnly
                    className="pointer-events-none h-3 w-3 accent-primary"
                  />
                </li>
              );
            })}
          </ul>

          <div className="border-t border-border p-2">
            <button
              className="flex w-full items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              onClick={() => dispatch(openCreatePoint())}
            >
              <Plus size={12} />
              Nuevo punto
            </button>
          </div>
        </>
      )}
    </div>
  );
}
