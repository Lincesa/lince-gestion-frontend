/**
 * OcrConfigPage — Configuración de campos requeridos (SUPERADMIN)
 *
 * Permite al SUPERADMIN definir qué campos son obligatorios para cada tipo de documento.
 * Si un campo requerido no es detectado por el OCR → el documento queda en estado CON_ERRORES.
 */

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Save, RefreshCw, AlertTriangle } from 'lucide-react';
import * as ocrApi from '@/api/ocr';
import type { OcrConfig } from '@/types/ocr.types';
import { DocumentType } from '@/types/ocr.types';

const AVAILABLE_FIELDS: Record<DocumentType, { key: string; label: string }[]> = {
  [DocumentType.REMITO]: [
    { key: 'nroRemito',         label: 'Número de remito' },
    { key: 'fecha',             label: 'Fecha' },
    { key: 'cliente',           label: 'Cliente' },
    { key: 'firmaEstado',       label: 'Firma detectada' },
    { key: 'aclaracionEstado',  label: 'Aclaración detectada' },
    { key: 'dniEstado',         label: 'DNI detectado' },
  ],
  [DocumentType.FACTURA]: [
    { key: 'numero',    label: 'Número de comprobante' },
    { key: 'fecha',     label: 'Fecha de emisión' },
    { key: 'proveedor', label: 'Razón social / Proveedor' },
    { key: 'cuit',      label: 'CUIT' },
    { key: 'neto',      label: 'Importe Neto' },
    { key: 'iva',       label: 'IVA' },
    { key: 'total',     label: 'Total' },
    { key: 'tipo',      label: 'Tipo de comprobante (A/B/C)' },
  ],
  [DocumentType.RETENCION]: [
    { key: 'cuitEmisor',   label: 'CUIT del Agente de Retención' },
    { key: 'tipoImpuesto', label: 'Tipo de impuesto (GANANCIAS / IIBB)' },
    { key: 'provincia',    label: 'Provincia / jurisdicción IIBB' },
    { key: 'monto',        label: 'Monto de la retención' },
  ],
};

export function OcrConfigPage() {
  const [configs,  setConfigs]  = useState<OcrConfig[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState<DocumentType | null>(null);
  const [error,    setError]    = useState<string | null>(null);

  // Estado local de edición: tipo → conjunto de campos requeridos seleccionados
  const [required, setRequired] = useState<Record<DocumentType, Set<string>>>({
    [DocumentType.REMITO]:    new Set(['nroRemito', 'fecha']),
    [DocumentType.FACTURA]:   new Set(['numero', 'fecha', 'proveedor', 'cuit', 'total']),
    [DocumentType.RETENCION]: new Set(['cuitEmisor', 'tipoImpuesto', 'monto']),
  });

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await ocrApi.getOcrConfigs();
      setConfigs(data);
      // Sincronizar estado local con la DB
      const next = { ...required };
      for (const cfg of data) {
        next[cfg.type] = new Set(cfg.requiredFields);
      }
      setRequired(next);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const toggleField = (type: DocumentType, field: string) => {
    setRequired((prev) => {
      const next = new Set(prev[type]);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return { ...prev, [type]: next };
    });
  };

  const saveConfig = async (type: DocumentType) => {
    setSaving(type);
    try {
      await ocrApi.updateOcrConfig(type, Array.from(required[type]));
      toast.success(`Configuración de ${type === DocumentType.REMITO ? 'Remitos' : 'documento'} guardada`);
      await loadConfigs();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[300px]">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Configuración OCR</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Definí los campos obligatorios para cada tipo de documento.
          Si el OCR no detecta un campo requerido, el documento queda en estado "Con errores".
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800 flex items-start gap-2 text-sm text-red-700 dark:text-red-400">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Facturación y retenciones pausadas temporalmente en el front. */}
      {([DocumentType.REMITO] as DocumentType[]).map((type) => {
        const fields     = AVAILABLE_FIELDS[type];
        const lastSaved  = configs.find((c) => c.type === type);
        const isSaving   = saving === type;

        return (
          <div key={type} className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  Remitos
                </h2>
                {lastSaved && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Última actualización: {new Date(lastSaved.updatedAt).toLocaleString('es-AR')}
                  </p>
                )}
              </div>
              <button
                onClick={() => saveConfig(type)}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isSaving
                  ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Guardando…</>
                  : <><Save className="h-3.5 w-3.5" /> Guardar</>}
              </button>
            </div>

            <div className="px-5 py-4 space-y-2">
              <p className="text-xs text-muted-foreground mb-3">
                Campos marcados = obligatorios (si faltan → CON_ERRORES)
              </p>
              {fields.map(({ key, label }) => {
                const checked = required[type].has(key);
                return (
                  <label
                    key={key}
                    className="flex items-center gap-3 cursor-pointer group"
                  >
                    <div
                      onClick={() => toggleField(type, key)}
                      className={[
                        'w-5 h-5 rounded border-2 flex items-center justify-center transition-colors shrink-0',
                        checked
                          ? 'bg-primary border-primary'
                          : 'border-border group-hover:border-primary/50',
                      ].join(' ')}
                    >
                      {checked && (
                        <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <p className="text-sm text-foreground">{label}</p>
                      <p className="text-xs text-muted-foreground font-mono">{key}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="p-4 rounded-lg bg-blue-50 border border-blue-200 dark:bg-blue-900/20 dark:border-blue-800">
        <p className="text-xs text-blue-700 dark:text-blue-400 font-medium mb-1">Nota sobre el OCR</p>
        <p className="text-xs text-blue-600 dark:text-blue-400">
          Los campos se extraen con Google Document AI (u OCR fallback según configuración).
          La precisión depende de la calidad de la imagen.
          Los campos obligatorios no detectados generan alertas al equipo ADMIN y permiten corrección manual.
        </p>
      </div>
    </div>
  );
}
