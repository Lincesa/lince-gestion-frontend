export interface RemitoLogistica {
  id: string;
  status: string;
  uploadedByName: string;
  uploadedByEmail: string;
  createdAt: string;
  latitude: number | null;
  longitude: number | null;
  nroRemito: string | null;
  fecha: string | null;
  cliente: string | null;
}

export interface RemitoDetalle extends RemitoLogistica {
  producto: string | null;
  toneladas: string | null;
  camion: string | null;
  chofer: string | null;
  lugarEntrega: string | null;
  observaciones: string | null;
  viewUrl: string;
  isPdf: boolean;
}

export interface PaginatedRemitos {
  items: RemitoLogistica[];
  total: number;
  page: number;
  pages: number;
  limit: number;
}

export interface GeoPoint {
  id: string;
  carpeta: string;
  nombre: string;
  descripcion: string | null;
  lat: number;
  lng: number;
  iconFile: string;
  orden: number;
}

export interface GeoLayer {
  carpeta: string;
  iconFile: string;
  points: GeoPoint[];
}
