import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PhotoLocation } from './PhotoLocation';
import type { GeoPoint } from '@/types/logistica.types';

const PLANTA: GeoPoint = {
  id: 'p1', carpeta: 'Plantas', nombre: 'Planta Arcor Misky', descripcion: null,
  lat: -26.833, lng: -65.2038, iconFile: 'planta.png', orden: 0,
};

const render = (props: Parameters<typeof PhotoLocation>[0]) => renderToStaticMarkup(<PhotoLocation {...props} />);
const textOf = (html: string) => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ');

describe('PhotoLocation', () => {
  it('sin GPS explica por qué en lugar de mostrar un guion', () => {
    const html = render({ lat: null, lng: null, nearest: null, referencesLoading: false });
    expect(html).toContain('Ubicación de la foto');
    expect(html).toContain('Esta foto no trae ubicación');
    expect(html).not.toContain('Google Maps');
  });

  it('cerca de un punto cargado dice a cuánto y de cuál', () => {
    const html = render({
      lat: -26.8303, lng: -65.2038, nearest: { point: PLANTA, meters: 300 }, referencesLoading: false,
    });
    expect(textOf(html)).toContain('A 300 m de Planta Arcor Misky · Plantas');
    expect(html).toContain('href="https://www.google.com/maps/search/?api=1&amp;query=-26.8303%2C-65.2038"');
    expect(html).toContain('-26.830300, -65.203800');
  });

  it('lejos de todo lo avisa con el más cercano como referencia', () => {
    const html = render({
      lat: -24.78, lng: -65.41, nearest: { point: PLANTA, meters: 228_000 }, referencesLoading: false,
    });
    expect(html).toContain('Lejos de los puntos cargados');
    expect(html).toContain('228 km');
  });

  it('sin puntos de referencia muestra solo la ubicación y el link', () => {
    const html = render({ lat: -26.8303, lng: -65.2038, nearest: null, referencesLoading: false });
    expect(textOf(html)).not.toMatch(/A [\d,]+ (m|km) de/);
    expect(textOf(html)).not.toContain('Lejos de los puntos cargados');
    expect(html).toContain('Abrir en Google Maps');
  });
});
