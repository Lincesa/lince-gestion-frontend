import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { useAppDispatch } from '@/store';
import { createCustomer, updateCustomer } from '@/store/crm/clientsSlice';
import type { Customer, GeoResult } from '@/types/crm.types';
import { ProductSelect } from './ProductSelect';
import { LocationSearch } from './LocationSearch';

interface ClientFormModalProps {
  customer?: Customer | null;
  onClose: () => void;
  readOnly?: boolean;
}

type FormData = {
  nombre: string;
  apellido: string;
  telefono: string;
  correo: string;
  producto: string;
  actividad: string;
  medioAdquisicion: string;
  estado: string;
  siguiendo: string;
  observaciones: string;
  cabezas: string;
  mesesSuplemento: string;
};

const DEFAULT_FORM: FormData = {
  nombre: '',
  apellido: '',
  telefono: '',
  correo: '',
  producto: '',
  actividad: '',
  medioAdquisicion: '',
  estado: '',
  siguiendo: '',
  observaciones: '',
  cabezas: '',
  mesesSuplemento: '',
};

function toFormData(c: Customer): FormData {
  return {
    nombre: c.nombre ?? '',
    apellido: c.apellido ?? '',
    telefono: c.telefono ?? '',
    correo: c.correo ?? '',
    producto: c.producto ?? '',
    actividad: c.actividad ?? '',
    medioAdquisicion: c.medioAdquisicion ?? '',
    estado: c.estado ?? '',
    siguiendo: c.siguiendo ?? '',
    observaciones: c.observaciones ?? '',
    cabezas: c.cabezas != null ? String(c.cabezas) : '',
    mesesSuplemento: c.mesesSuplemento != null ? String(c.mesesSuplemento) : '',
  };
}

export function ClientFormModal({ customer, onClose, readOnly = false }: ClientFormModalProps) {
  const dispatch = useAppDispatch();
  const isEdit = !!customer;

  const [form, setForm] = useState<FormData>(customer ? toFormData(customer) : DEFAULT_FORM);
  const [geoResult, setGeoResult] = useState<GeoResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (customer?.ubicacion) {
      setGeoResult({
        id: '',
        label: [customer.ubicacion.localidad, customer.ubicacion.provincia].filter(Boolean).join(', '),
        pais: customer.ubicacion.pais,
        provincia: customer.ubicacion.provincia,
        localidad: customer.ubicacion.localidad,
        zona: customer.ubicacion.zona,
        lat: customer.ubicacion.coordenadas?.lat,
        lon: customer.ubicacion.coordenadas?.lon,
      });
    }
  }, [customer]);

  function set(field: keyof FormData, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function buildPayload(): Omit<Customer, 'id' | 'createdAt' | 'updatedAt'> {
    return {
      telefono: form.telefono,
      nombre: form.nombre || undefined,
      apellido: form.apellido || undefined,
      correo: form.correo || undefined,
      producto: form.producto || undefined,
      actividad: (form.actividad || undefined) as Customer['actividad'],
      medioAdquisicion: (form.medioAdquisicion || undefined) as Customer['medioAdquisicion'],
      estado: (form.estado || undefined) as Customer['estado'],
      siguiendo: (form.siguiendo || undefined) as Customer['siguiendo'],
      observaciones: form.observaciones || undefined,
      cabezas: form.cabezas ? Number(form.cabezas) : undefined,
      mesesSuplemento: form.mesesSuplemento ? Number(form.mesesSuplemento) : undefined,
      ubicacion: geoResult
        ? {
            pais: geoResult.pais,
            provincia: geoResult.provincia,
            localidad: geoResult.localidad,
            zona: geoResult.zona,
            coordenadas:
              geoResult.lat != null && geoResult.lon != null
                ? { lat: geoResult.lat, lon: geoResult.lon }
                : undefined,
          }
        : undefined,
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.telefono.trim()) {
      setError('El teléfono es obligatorio.');
      return;
    }
    setLoading(true);
    try {
      const payload = buildPayload();
      if (isEdit && customer) {
        await dispatch(updateCustomer({ id: customer.id, data: payload })).unwrap();
        toast.success('Cliente actualizado');
      } else {
        await dispatch(createCustomer(payload)).unwrap();
        toast.success('Cliente creado');
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    'w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60 disabled:cursor-default';
  const selectClass = inputClass;
  const labelClass = 'block text-sm font-medium text-foreground mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto py-6">
      <div className="bg-card border border-border rounded-lg w-full max-w-2xl mx-4 shadow-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold text-foreground">
              {readOnly ? 'Ver cliente' : isEdit ? 'Editar cliente' : 'Nuevo cliente'}
            </h2>
            {customer?.isReconsulta && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary font-medium">
                Reconsulta
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)}>
          <div className="px-6 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Nombre</label>
                <input type="text" value={form.nombre} onChange={(e) => set('nombre', e.target.value)} placeholder="Nombre" className={inputClass} disabled={readOnly} />
              </div>
              <div>
                <label className={labelClass}>Apellido</label>
                <input type="text" value={form.apellido} onChange={(e) => set('apellido', e.target.value)} placeholder="Apellido" className={inputClass} disabled={readOnly} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Teléfono <span className="text-destructive">*</span></label>
                <input type="text" value={form.telefono} onChange={(e) => set('telefono', e.target.value)} placeholder="+54 9 ..." className={inputClass} disabled={readOnly} />
              </div>
              <div>
                <label className={labelClass}>Correo</label>
                <input type="email" value={form.correo} onChange={(e) => set('correo', e.target.value)} placeholder="email@ejemplo.com" className={inputClass} disabled={readOnly} />
              </div>
            </div>

            <div>
              <label className={labelClass}>Producto</label>
              <ProductSelect value={form.producto} onChange={(v) => set('producto', v)} disabled={readOnly} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Actividad</label>
                <select value={form.actividad} onChange={(e) => set('actividad', e.target.value)} className={selectClass} disabled={readOnly}>
                  <option value="">Seleccionar...</option>
                  <option value="CRIA">Cría</option>
                  <option value="RECRIA">Recría</option>
                  <option value="MIXTO">Mixto</option>
                  <option value="DISTRIBUIDOR">Distribuidor</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Medio de adquisición</label>
                <select value={form.medioAdquisicion} onChange={(e) => set('medioAdquisicion', e.target.value)} className={selectClass} disabled={readOnly}>
                  <option value="">Seleccionar...</option>
                  <option value="INSTAGRAM">Instagram</option>
                  <option value="WEB">Web</option>
                  <option value="WHATSAPP">WhatsApp</option>
                  <option value="FACEBOOK">Facebook</option>
                  <option value="OTRO">Otro</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Estado</label>
                <select value={form.estado} onChange={(e) => set('estado', e.target.value)} className={selectClass} disabled={readOnly}>
                  <option value="">Seleccionar...</option>
                  <option value="PENDIENTE">Pendiente</option>
                  <option value="DERIVADO_A_DISTRIBUIDOR">Derivado a distribuidor</option>
                  <option value="NO_CONTESTO">No contestó</option>
                  <option value="SE_COTIZO_Y_PENDIENTE">Se cotizó y pendiente</option>
                  <option value="SE_COTIZO_Y_NO_INTERESO">Se cotizó y no interesó</option>
                  <option value="COMPRO">Compró</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Asesor asignado</label>
                <select value={form.siguiendo} onChange={(e) => set('siguiendo', e.target.value)} className={selectClass} disabled={readOnly}>
                  <option value="">Seleccionar...</option>
                  <option value="EZEQUIEL">Ezequiel</option>
                  <option value="DENIS">Denis</option>
                  <option value="MARTIN">Martín</option>
                  <option value="JULIAN">Julián</option>
                  <option value="SIN_ASIGNAR">Sin asignar</option>
                </select>
              </div>
            </div>

            <div>
              <label className={labelClass}>Ubicación</label>
              <LocationSearch value={geoResult} onSelect={setGeoResult} placeholder="Buscar localidad o provincia..." disabled={readOnly} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Cabezas</label>
                <input type="number" value={form.cabezas} onChange={(e) => set('cabezas', e.target.value)} placeholder="0" min="0" className={inputClass} disabled={readOnly} />
              </div>
              <div>
                <label className={labelClass}>Meses de suplemento</label>
                <input type="number" value={form.mesesSuplemento} onChange={(e) => set('mesesSuplemento', e.target.value)} placeholder="0" min="0" className={inputClass} disabled={readOnly} />
              </div>
            </div>

            <div>
              <label className={labelClass}>Observaciones</label>
              <textarea value={form.observaciones} onChange={(e) => set('observaciones', e.target.value)} rows={3} placeholder="Notas adicionales..." className={`${inputClass} resize-none`} disabled={readOnly} />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <div className="flex justify-end gap-2 px-6 py-4 border-t border-border">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground">
              {readOnly ? 'Cerrar' : 'Cancelar'}
            </button>
            {!readOnly && (
              <button type="submit" disabled={loading} className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                {loading ? 'Guardando...' : isEdit ? 'Actualizar' : 'Guardar'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
