import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAppDispatch, useAppSelector } from '@/store';
import {
  closeModal,
  createGeoPoint,
  deleteGeoPoint,
  updateGeoPoint,
} from '@/store/logistica/geoLayersSlice';
import type { GeoPoint } from '@/types/logistica.types';
import { useCanPerform } from '@/hooks/useCanPerform';
import { ModuleKey } from '@/types/auth.types';

const ICON_FILES = Array.from({ length: 27 }, (_, i) => `icon-${i + 1}.png`);

interface FormState {
  carpeta: string;
  nombre: string;
  descripcion: string;
  lat: string;
  lng: string;
  iconFile: string;
}

function emptyForm(carpeta = ''): FormState {
  return { carpeta, nombre: '', descripcion: '', lat: '', lng: '', iconFile: 'icon-1.png' };
}

function pointToForm(p: GeoPoint): FormState {
  return {
    carpeta: p.carpeta,
    nombre: p.nombre,
    descripcion: p.descripcion ?? '',
    lat: String(p.lat),
    lng: String(p.lng),
    iconFile: p.iconFile,
  };
}

export function GeoPointModal() {
  const dispatch = useAppDispatch();
  const { canEdit, canAdmin } = useCanPerform(ModuleKey.LOGISTICA);
  const { editingPoint, isCreating, submitting, layers } = useAppSelector((s) => s.geoLayers);
  const isOpen = !!editingPoint || isCreating;

  const carpetas = layers.map((l) => l.carpeta);

  const [form, setForm] = useState<FormState>(emptyForm());
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (editingPoint) {
      setForm(pointToForm(editingPoint));
      setConfirmDelete(false);
    } else if (isCreating) {
      setForm(emptyForm(carpetas[0] ?? ''));
      setConfirmDelete(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingPoint, isCreating]);

  if (!isOpen) return null;

  function set(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function validate(): string | null {
    if (!form.nombre.trim()) return 'El nombre es obligatorio';
    if (!form.carpeta.trim()) return 'La carpeta es obligatoria';
    const lat = parseFloat(form.lat);
    const lng = parseFloat(form.lng);
    if (isNaN(lat) || lat < -90 || lat > 90) return 'Latitud inválida (entre -90 y 90)';
    if (isNaN(lng) || lng < -180 || lng > 180) return 'Longitud inválida (entre -180 y 180)';
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validate();
    if (err) { toast.error(err); return; }

    const payload = {
      carpeta: form.carpeta.trim(),
      nombre: form.nombre.trim(),
      descripcion: form.descripcion.trim() || null,
      lat: parseFloat(form.lat),
      lng: parseFloat(form.lng),
      iconFile: form.iconFile,
    };

    try {
      if (editingPoint) {
        await dispatch(updateGeoPoint({ id: editingPoint.id, data: payload })).unwrap();
        toast.success('Punto actualizado');
      } else {
        await dispatch(createGeoPoint(payload)).unwrap();
        toast.success('Punto creado');
      }
    } catch {
      toast.error('Error al guardar el punto');
    }
  }

  async function handleDelete() {
    if (!editingPoint) return;
    if (!confirmDelete) { setConfirmDelete(true); return; }
    try {
      await dispatch(deleteGeoPoint(editingPoint.id)).unwrap();
      toast.success('Punto eliminado');
    } catch {
      toast.error('Error al eliminar el punto');
    }
  }

  const modal = (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => dispatch(closeModal())}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md rounded-xl border border-border bg-card shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold text-foreground">
            {editingPoint ? 'Editar punto' : 'Nuevo punto'}
          </h2>
          <button
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={() => dispatch(closeModal())}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 px-5 py-4">
          {/* Nombre */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">Nombre *</label>
            <input
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              value={form.nombre}
              onChange={(e) => set('nombre', e.target.value)}
              placeholder="Nombre del punto"
              required
            />
          </div>

          {/* Carpeta */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">Capa *</label>
            <input
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              value={form.carpeta}
              onChange={(e) => set('carpeta', e.target.value)}
              list="carpetas-list"
              placeholder="Nombre de la capa"
              required
            />
            <datalist id="carpetas-list">
              {carpetas.map((c) => <option key={c} value={c} />)}
            </datalist>
          </div>

          {/* Descripción */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">Descripción</label>
            <textarea
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              value={form.descripcion}
              onChange={(e) => set('descripcion', e.target.value)}
              placeholder="Contacto, horarios, dirección..."
              rows={3}
            />
          </div>

          {/* Coordenadas */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Latitud *</label>
              <input
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                value={form.lat}
                onChange={(e) => set('lat', e.target.value)}
                placeholder="-31.4201"
                type="number"
                step="any"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Longitud *</label>
              <input
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                value={form.lng}
                onChange={(e) => set('lng', e.target.value)}
                placeholder="-64.1888"
                type="number"
                step="any"
                required
              />
            </div>
          </div>

          {/* Ícono */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">Ícono</label>
            <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto rounded-md border border-border p-2">
              {ICON_FILES.map((file) => (
                <button
                  key={file}
                  type="button"
                  className={`rounded p-1 transition-colors ${
                    form.iconFile === file
                      ? 'bg-primary/20 ring-2 ring-primary'
                      : 'hover:bg-muted'
                  }`}
                  onClick={() => set('iconFile', file)}
                  title={file}
                >
                  <img
                    src={`/geo-icons/${file}`}
                    alt={file}
                    className="h-5 w-5 object-contain"
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-1">
            {editingPoint && canAdmin ? (
              <button
                type="button"
                className={`flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-colors ${
                  confirmDelete
                    ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                    : 'text-destructive hover:bg-destructive/10'
                }`}
                onClick={() => void handleDelete()}
                disabled={submitting}
              >
                <Trash2 size={13} />
                {confirmDelete ? '¿Confirmar eliminación?' : 'Eliminar'}
              </button>
            ) : (
              <div />
            )}

            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-md border border-border px-3 py-2 text-xs font-medium hover:bg-muted"
                onClick={() => dispatch(closeModal())}
                disabled={submitting}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                disabled={submitting || !canEdit}
              >
                {submitting && <Loader2 size={12} className="animate-spin" />}
                {editingPoint ? 'Guardar' : 'Crear'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
