import { useCallback, useEffect, useState } from 'react';
import { NavLink, Outlet, useOutletContext } from 'react-router-dom';
import { balanceMasasApi } from '@/api/balanceMasas';
import { useCanPerform } from '@/hooks/useCanPerform';
import { ModuleKey } from '@/types/auth.types';
import type { EstadoBalance } from '@/types/balanceMasas.types';
import '@/components/balance-masas/balance-masas.css';

export interface BalanceMasasCtx {
  estado: EstadoBalance;
  recargarEstado: () => Promise<EstadoBalance | null>;
  canEdit: boolean;
  canAdmin: boolean;
}

export const useBalanceMasas = () => useOutletContext<BalanceMasasCtx>();

const fechaHora = (iso: string) =>
  new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Side menu of the original tool: Resumen + the 4 report histories (+ the history of changes). */
export function BalanceMasasLayout() {
  const { canEdit, canAdmin } = useCanPerform(ModuleKey.BALANCE_MASAS);
  const [estado, setEstado] = useState<EstadoBalance | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recargarEstado = useCallback(async () => {
    try {
      const e = await balanceMasasApi.estado();
      setEstado(e);
      setError(null);
      return e;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
    }
  }, []);

  useEffect(() => { void recargarEstado(); }, [recargarEstado]);

  const it = (to: string, ico: string, t: string, end = false) => (
    <NavLink to={to} end={end} className={({ isActive }) => `menu-it${isActive ? ' on' : ''}`}>
      <span className="mi" aria-hidden="true">{ico}</span>{t}
    </NavLink>
  );

  return (
    <div className="bm p-4 sm:p-6">
      <div className="layout">
        <nav className="menu" aria-label="Secciones">
          <div className="menu-brand"><div className="k">Balance de masas</div><div className="n">Lince y Lercara</div></div>
          {it('/balance-masas', '▦', 'Resumen', true)}
          <div className="menu-sep">Historial de reportes</div>
          {it('/balance-masas/reportes/registradas', '≡', 'TN registradas')}
          {it('/balance-masas/reportes/vendidas', '≡', 'TN vendidas')}
          {it('/balance-masas/reportes/compradas', '≡', 'TN compradas')}
          {it('/balance-masas/reportes/remitos', '≡', 'Informe de remitos')}
          <div className="menu-sep">Historial</div>
          {it('/balance-masas/historial', '⟲', 'Cambios y respaldo')}
          <div className="menu-pie">
            {estado?.actualizadoEn
              ? <>Último cambio: <b>{estado.actualizadoPor ?? 'sin usuario'}</b><br />{fechaHora(estado.actualizadoEn)}</>
              : 'El historial se guarda en Lince Gestión.'}
          </div>
        </nav>
        <div className="contenido">
          {error ? (
            <div className="banner bad" role="status">
              <div className="ico">✕</div>
              <div><div className="t1">No se pudo leer el balance de masas.</div><div className="t2">{error}</div></div>
            </div>
          ) : null}
          {estado
            ? <Outlet context={{ estado, recargarEstado, canEdit, canAdmin } satisfies BalanceMasasCtx} />
            : !error ? <p className="hint">Cargando…</p> : null}
        </div>
      </div>
    </div>
  );
}
