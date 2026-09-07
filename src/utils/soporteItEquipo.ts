import type { Equipo, EquipoResumen, TipoEquipo } from '@/types/soporte-it.types';

type EquipoLabelSource = {
  tipo: TipoEquipo;
  hostname?: string | null;
  imei?: string | null;
  linea?: string | null;
  modelo?: string | null;
  fabricante?: string | null;
  id?: string;
};

export function tipoEquipoLabel(tipo: TipoEquipo): string {
  return tipo === 'celular' ? 'Celular' : 'Notebook';
}

export function formatEquipoLabel(e: EquipoLabelSource | Equipo | EquipoResumen): string {
  const tipo = tipoEquipoLabel(e.tipo);
  if (e.tipo === 'celular') {
    const id =
      e.imei ||
      ('linea' in e ? e.linea : null) ||
      e.modelo ||
      e.id?.slice(0, 8) ||
      '—';
    return `${tipo} · ${id}`;
  }
  const id = e.hostname || e.modelo || e.id?.slice(0, 8) || '—';
  return `${tipo} · ${id}`;
}

export function formatEquipoSubtitle(e: EquipoLabelSource | Equipo | EquipoResumen): string {
  const marcaModelo = [e.fabricante, e.modelo].filter(Boolean).join(' ');
  if (e.tipo === 'celular') {
    const linea = 'linea' in e ? e.linea : null;
    const bits = [marcaModelo, linea ? `Línea ${linea}` : null].filter(Boolean);
    return bits.join(' · ') || '—';
  }
  return marcaModelo || '—';
}
