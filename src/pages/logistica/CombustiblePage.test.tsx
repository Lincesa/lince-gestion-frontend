import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { UserProfile } from '@/types';
import type { FuelLoadView, TransportView } from '@/types/logistica.types';
import { resolveFieldJailRedirect } from '@/router/fieldJail';
import * as XLSX from 'xlsx';
import { FuelLoadsTable, buildFuelLoadsSheet, canDeleteFuelLoads, excelSerial, fuelLoadsQuery, fuelLoadPhotoPath, fuelPlates, parseKm } from './CombustiblePage';
import { GlobalRole } from '@/types/auth.types';
import { toggleTransportFuelLoads } from './TransportesPage';

function load(overrides: Partial<FuelLoadView> = {}): FuelLoadView {
  return {
    id: 'load-1',
    transportId: 't-1',
    transportName: 'TTe. LINCE',
    driverId: 'u-1',
    driverName: 'Juan Pérez',
    vehicleId: 'v-1',
    vehiclePlate: 'AB123CD',
    vehicleLabel: 'Scania',
    liters: 152.5,
    odometerKm: 123456,
    latitude: -26.8241,
    longitude: -65.2226,
    placeNote: 'YPF Ruta 9',
    tankFilled: true,
    notFilledReason: null,
    fuelBrand: 'YPF',
    loadedAt: '2026-11-02T13:30:00.000Z',
    createdAt: '2026-11-02T13:31:00.000Z',
    ticketUrl: 'https://s3.test/ticket.jpg',
    odometerUrl: null,
    ...overrides,
  };
}

describe('FuelLoadsTable', () => {
  it('renders liters, truck, driver, place and a maps link when the load has coordinates', () => {
    const html = renderToStaticMarkup(<FuelLoadsTable items={[load()]} onPreview={() => {}} />);
    expect(html).toContain('152,5');
    expect(html).toContain('AB123CD · Scania');
    expect(html).toContain('Juan Pérez');
    expect(html).toContain('TTe. LINCE');
    expect(html).toContain('YPF Ruta 9');
    expect(html).toContain('https://www.google.com/maps?q=-26.8241,-65.2226');
    expect(html).toContain('https://s3.test/ticket.jpg');
  });

  it('omits the maps link without coordinates', () => {
    const html = renderToStaticMarkup(
      <FuelLoadsTable items={[load({ latitude: null, longitude: null })]} onPreview={() => {}} />,
    );
    expect(html).toContain('YPF Ruta 9');
    expect(html).not.toContain('google.com/maps');
  });

  it('shows the empty state', () => {
    const html = renderToStaticMarkup(<FuelLoadsTable items={[]} onPreview={() => {}} />);
    expect(html).toContain('No hay cargas de combustible');
  });
});

describe('fuelLoadsQuery', () => {
  it('passes the filters through to the list request', () => {
    expect(fuelLoadsQuery({
      page: 3,
      transportId: 't-1',
      vehicleId: 'v-1',
      dateFrom: '2026-11-01',
      dateTo: '2026-11-30',
    })).toEqual({
      page: 3,
      limit: 20,
      transportId: 't-1',
      vehicleId: 'v-1',
      dateFrom: '2026-11-01',
      dateTo: '2026-11-30',
    });
  });

  it('drops the truck filter when no transport is selected', () => {
    expect(fuelLoadsQuery({ page: 1, vehicleId: 'v-1' })).toEqual({ page: 1, limit: 20 });
  });
});

describe('toggleTransportFuelLoads', () => {
  it('sends the inverted fuelLoadsEnabled flag', async () => {
    const setFlag = vi.fn().mockResolvedValue({});
    const transport = { id: 't-1', fuelLoadsEnabled: false } as TransportView;
    await toggleTransportFuelLoads(transport, setFlag);
    expect(setFlag).toHaveBeenCalledWith('t-1', true);

    await toggleTransportFuelLoads({ ...transport, fuelLoadsEnabled: true }, setFlag);
    expect(setFlag).toHaveBeenLastCalledWith('t-1', false);
  });
});

describe('Combustible route access', () => {
  it('keeps field users out of the office fuel loads page', () => {
    expect(resolveFieldJailRedirect({ profile: UserProfile.TRANSPORTE, pathname: '/logistica/combustible' }))
      .toBe('/logistica/mi-transporte');
    expect(resolveFieldJailRedirect({ profile: UserProfile.TAG, pathname: '/logistica/combustible' }))
      .toBe('/ocr/remitos');
  });
});

describe('fuel load deletion', () => {
  it('is only for the superadmin', () => {
    expect(canDeleteFuelLoads({ globalRole: GlobalRole.SUPERADMIN })).toBe(true);
    expect(canDeleteFuelLoads({ globalRole: GlobalRole.ADMIN })).toBe(false);
    expect(canDeleteFuelLoads({ globalRole: GlobalRole.USER })).toBe(false);
    expect(canDeleteFuelLoads(null)).toBe(false);
  });

  it('shows a delete button per row when deletion is allowed', () => {
    const html = renderToStaticMarkup(
      <FuelLoadsTable items={[load()]} onPreview={() => {}} onDelete={() => {}} />,
    );
    expect(html).toContain('aria-label="Eliminar carga"');
  });

  it('hides the delete button otherwise', () => {
    const html = renderToStaticMarkup(<FuelLoadsTable items={[load()]} onPreview={() => {}} />);
    expect(html).not.toContain('Eliminar carga');
  });
});

describe('fuel load correction', () => {
  it('shows an edit button per row when editing is allowed', () => {
    const html = renderToStaticMarkup(
      <FuelLoadsTable items={[load()]} onPreview={() => {}} onEdit={() => {}} />,
    );
    expect(html).toContain('aria-label="Corregir carga"');
  });

  it('hides the edit button otherwise', () => {
    const html = renderToStaticMarkup(<FuelLoadsTable items={[load()]} onPreview={() => {}} />);
    expect(html).not.toContain('Corregir carga');
  });

  it('reads the km as typed, with or without thousands dots', () => {
    expect(parseKm('687716')).toBe(687716);
    expect(parseKm(' 687.716 ')).toBe(687716);
    expect(parseKm('')).toBeNull();
    expect(parseKm('68a')).toBeNull();
    expect(parseKm('-5')).toBeNull();
    expect(parseKm('687,5')).toBeNull();
  });
});

describe('fuel loads Excel report', () => {
  const ORIGIN = 'https://gestion.test';
  const rows = (sheet: XLSX.WorkSheet) => XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: null });

  it('follows the order of the old form sheet', () => {
    const [header] = rows(buildFuelLoadsSheet([load()], ORIGIN));
    expect(header).toEqual([
      'Marca temporal', 'Chofer', 'Transporte', 'Patente', 'Fecha', 'Litros',
      '¿Se llenó?', 'Motivo', 'Bandera', 'Km tacómetro', 'Foto ticket', 'Foto tacómetro',
    ]);
  });

  it('keeps numbers and dates as numbers and blanks for missing data', () => {
    const sheet = buildFuelLoadsSheet([
      load({ odometerUrl: 'https://s3.test/odo.jpg' }),
      load({
        id: 'load-2', vehiclePlate: null, odometerKm: null, placeNote: null, odometerUrl: null,
        tankFilled: false, notFilledReason: 'Se cortó el sistema', fuelBrand: 'Shell',
      }),
      load({ id: 'load-3', tankFilled: null, fuelBrand: null }),
    ], ORIGIN);
    const [, first, second, third] = rows(sheet);
    expect(first).toEqual([
      excelSerial(new Date('2026-11-02T13:31:00.000Z')), 'Juan Pérez', 'TTe. LINCE', 'AB123CD',
      excelSerial(new Date('2026-11-02T13:30:00.000Z')), 152.5, 'SI', null, 'YPF',
      123456, 'Ver ticket', 'Ver tacómetro',
    ]);
    expect(second.slice(3, 12)).toEqual([
      null, expect.any(Number), 152.5, 'NO', 'Se cortó el sistema', 'Shell', null, 'Ver ticket', null,
    ]);
    // Loads recorded before the app asked stay blank, never "NO".
    expect(third.slice(6, 9)).toEqual([null, null, null]);
    expect(sheet.A2.z).toBe('dd/mm/yyyy hh:mm');
    expect(sheet.E2.z).toBe('dd/mm/yyyy hh:mm');
  });

  it('links the photos to the web app, never to an expiring storage link', () => {
    const sheet = buildFuelLoadsSheet([load({ odometerUrl: 'https://s3.test/odo.jpg' })], ORIGIN);
    expect(sheet.K2.l?.Target).toBe('https://gestion.test/logistica/combustible/load-1/foto/ticket');
    expect(sheet.L2.l?.Target).toBe('https://gestion.test/logistica/combustible/load-1/foto/odometer');
    expect(JSON.stringify(sheet)).not.toContain('s3.test');
  });

  it('builds the photo path the route serves', () => {
    expect(fuelLoadPhotoPath('load-1', 'ticket')).toBe('/logistica/combustible/load-1/foto/ticket');
  });
});

describe('excelSerial', () => {
  it('shows in Excel the same local date and minute the page shows', () => {
    const date = new Date('2026-11-03T23:53:00.000Z');
    const pad = (n: number) => String(n).padStart(2, '0');
    const local = `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    expect(XLSX.SSF.format('dd/mm/yyyy hh:mm', excelSerial(date))).toBe(local);
  });
});

describe('fuel loads table answers', () => {
  it('shows whether the tank was filled, why not, and the brand', () => {
    const html = renderToStaticMarkup(
      <FuelLoadsTable
        items={[load({ tankFilled: false, notFilledReason: 'Pq cortó la tarjeta', fuelBrand: 'Shell' })]}
        onPreview={() => {}}
      />,
    );
    expect(html).toContain('NO');
    expect(html).toContain('Pq cortó la tarjeta');
    expect(html).toContain('Shell');
  });
});

describe('fuelPlates', () => {
  it('lists the active trucks of a transport by plate, without bateas', () => {
    const v = (id: string, plate: string, kind: 'camion' | 'batea' | 'otro' | null, active = true) =>
      ({ id, transportId: 't-1', plate, label: null, kind, active });
    expect(fuelPlates([
      v('1', 'OUJ944', 'camion'),
      v('2', 'BAT001', 'batea'),
      v('3', 'AB080SH', null),
      v('4', 'AA000AA', 'camion', false),
    ]).map((x) => x.plate)).toEqual(['AB080SH', 'OUJ944']);
  });
});
