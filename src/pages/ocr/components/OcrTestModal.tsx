/**
 * OcrTestModal — Modal temporal para probar extracción OCR sin S3.
 * Muestra los campos extraídos por Document AI directamente sobre la imagen capturada.
 */

import { X, CheckCircle, AlertCircle, FileSearch } from 'lucide-react';
import { DocumentType } from '@/types/ocr.types';

// Labels legibles por campo
const REMITO_LABELS: Record<string, string> = {
  fecha:                  'Fecha',
  ptoVenta:               'Punto de venta',
  nroRemito:              'Nro. de remito',
  cliente:                'Cliente',
  cuitCliente:            'CUIT cliente',
  domicilioCliente:       'Domicilio fiscal cliente',
  lugarEntrega:           'Lugar de entrega',
  toneladas:              'Toneladas',
  producto:               'Producto',
  nroMercaderia:          'Nro. mercadería en planta',
  firmado:                'Firmado',
  chofer:                 'Chofer',
  camion:                 'Camión',
  batea:                  'Batea',
  cuitTransportista:      'CUIT transportista',
  domicilioTransportista: 'Domicilio transportista',
};

const FACTURA_LABELS: Record<string, string> = {
  numero:    'Nro. de factura',
  tipo:      'Tipo',
  fecha:     'Fecha',
  proveedor: 'Proveedor',
  cuit:      'CUIT',
  neto:      'Neto gravado',
  iva:       'IVA',
  total:     'Total',
};

const RETENCION_LABELS: Record<string, string> = {
  cuitEmisor:   'CUIT del Agente de Retención',
  tipoImpuesto: 'Tipo de impuesto',
  provincia:    'Provincia / jurisdicción IIBB',
  monto:        'Monto de la retención',
};

interface OcrTestModalProps {
  open:     boolean;
  onClose:  () => void;
  loading:  boolean;
  error:    string | null;
  type:     DocumentType;
  fields:   Record<string, string> | null;
  preview:  string | null;
}

export function OcrTestModal({ open, onClose, loading, error, type, fields, preview }: OcrTestModalProps) {
  if (!open) return null;

  const labels   = type === DocumentType.FACTURA    ? FACTURA_LABELS
                 : type === DocumentType.RETENCION ? RETENCION_LABELS
                 : REMITO_LABELS;
  const hasFields = fields && Object.keys(fields).length > 0;

  // Campos conocidos en orden, más los desconocidos al final
  const orderedKeys = [
    ...Object.keys(labels).filter((k) => fields?.[k]),
    ...(fields ? Object.keys(fields).filter((k) => !labels[k] && fields[k]) : []),
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <FileSearch className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-foreground">
              Resultado OCR — {type === DocumentType.FACTURA ? 'Factura' : type === DocumentType.RETENCION ? 'Retención' : 'Remito'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-accent text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-4 space-y-4">

          {/* Preview miniatura */}
          {preview && (
            <img
              src={preview}
              alt="Documento"
              className="w-full max-h-40 object-contain rounded-lg border border-border bg-muted"
            />
          )}

          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center gap-3 py-8 text-muted-foreground">
              <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm">Procesando con Document AI…</p>
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800 text-sm text-red-700 dark:text-red-200">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Campos extraídos */}
          {!loading && !error && hasFields && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                Campos extraídos
              </p>
              <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
                {orderedKeys.map((key) => {
                  const value = fields![key];
                  const label = labels[key] ?? key;
                  const isFirmado = key === 'firmado';

                  return (
                    <div key={key} className="flex items-start gap-3 px-3 py-2.5 bg-card hover:bg-accent/40 transition-colors">
                      <span className="text-xs text-muted-foreground w-36 shrink-0 pt-0.5">{label}</span>
                      {isFirmado ? (
                        <span className={`flex items-center gap-1 text-sm font-medium ${
                          value === 'si'
                            ? 'text-green-600 dark:text-green-200'
                            : 'text-red-600 dark:text-red-200'
                        }`}>
                          {value === 'si'
                            ? <><CheckCircle className="h-3.5 w-3.5" /> Sí</>
                            : <><AlertCircle className="h-3.5 w-3.5" /> No</>
                          }
                        </span>
                      ) : (
                        <span className="text-sm text-foreground break-words flex-1">{value}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Sin campos */}
          {!loading && !error && !hasFields && (
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No se pudieron extraer campos del documento.</p>
              <p className="text-xs mt-1">Intentá con una imagen más nítida.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border shrink-0">
          <button
            onClick={onClose}
            className="w-full py-2 text-sm rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
