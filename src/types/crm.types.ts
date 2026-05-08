export interface Customer {
  id: string;
  nombre?: string;
  apellido?: string;
  telefono: string;
  correo?: string;
  producto?: string;
  actividad?: 'CRIA' | 'RECRIA' | 'MIXTO' | 'DISTRIBUIDOR';
  medioAdquisicion?: 'INSTAGRAM' | 'WEB' | 'WHATSAPP' | 'FACEBOOK' | 'OTRO';
  estado?: 'PENDIENTE' | 'DERIVADO_A_DISTRIBUIDOR' | 'NO_CONTESTO' | 'SE_COTIZO_Y_PENDIENTE' | 'SE_COTIZO_Y_NO_INTERESO' | 'COMPRO';
  siguiendo?: 'EZEQUIEL' | 'DENIS' | 'MARTIN' | 'JULIAN' | 'SIN_ASIGNAR';
  ubicacion?: {
    pais?: string;
    provincia?: string;
    localidad?: string;
    zona?: string;
    coordenadas?: { lat: number; lon: number };
  };
  observaciones?: string;
  cabezas?: number;
  mesesSuplemento?: number;
  isReconsulta?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Satisfaction {
  id: string;
  name?: string;
  phone?: string;
  product?: string;
  comoNosConocio?: 'VISITA_VENDEDOR' | 'RECOMENDACION_COLEGA' | 'VENDEDOR' | 'WEB' | 'EXPOSICIONES';
  productoComprado?: boolean;
  calidad?: number;
  tiempoForme?: number;
  atencion?: number;
  recomendacion?: 'SI' | 'NO' | 'MAYBE';
  anteInconvenientes?: 'EXCELENTE' | 'BUENA' | 'MALA' | 'N_A';
  valoracion?: 'CALIDAD' | 'TIEMPO_ENTREGA' | 'ATENCION' | 'RESOLUCION_INCONVENIENTES' | 'SIN_VALORACION';
  comentarios?: string;
  createdAt?: string;
}

export interface FollowUpEvent {
  id: string;
  customerName?: string;
  customerLastName?: string;
  assignedTo?: string;
  customerPhone?: string;
  product?: string;
  triggerStatus: string;
  templateId: string;
  message: string;
  channels: string[];
  contactValue?: string | null;
  scheduledFor: string;
  status: 'SCHEDULED' | 'READY' | 'COMPLETED' | 'CANCELLED';
  readyAt?: string | null;
  createdAt: string;
  completedAt?: string | null;
  notes?: string | null;
}

export interface GeoResult {
  id: string;
  label: string;
  pais?: string;
  provincia?: string;
  localidad?: string;
  zona?: string;
  lat?: number;
  lon?: number;
}
