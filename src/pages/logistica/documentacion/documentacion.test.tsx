import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { GlobalRole } from '@/types/auth.types';
import type {
  ComplianceFileView,
  ComplianceOverviewRow,
  ComplianceSlotView,
} from '@/types/logistica.types';
import { DocumentacionHeader, SlotList } from '../DocumentacionPage';
import { defaultExpiryFor } from './expiry';
import { complianceAbilities } from './permissions';
import { EMPTY_OVERVIEW_FILTERS, filterOverviewRows, OverviewBoard } from './OverviewBoard';

function file(overrides: Partial<ComplianceFileView>): ComplianceFileView {
  return {
    id: 'file-1',
    originalName: 'doc.jpg',
    status: 'ok',
    expiresAt: null,
    reviewStatus: 'NONE',
    confirmedAt: '2026-11-01T10:00:00Z',
    ...overrides,
  } as ComplianceFileView;
}

function slot(overrides: Partial<ComplianceSlotView>): ComplianceSlotView {
  return {
    typeKey: 'seguro',
    label: 'Seguro',
    status: 'ok',
    cadence: 'annual',
    twoSided: false,
    pendingReview: 0,
    subjectUserId: null,
    vehicleId: null,
    files: [],
    ...overrides,
  } as ComplianceSlotView;
}

const noop = () => {};
const baseProps = {
  onUpload: async () => {},
  onPreview: noop,
  onExpiry: noop,
  onRemove: noop,
};

/** Expands function components so the props of the rendered host elements can be inspected. */
function collectElements(node: ReactNode, out: ReactElement[] = []): ReactElement[] {
  if (Array.isArray(node)) {
    node.forEach((child) => collectElements(child, out));
    return out;
  }
  if (!isValidElement(node)) return out;
  const element = node as ReactElement<{ children?: ReactNode }>;
  if (typeof element.type === 'function') {
    collectElements((element.type as (props: unknown) => ReactNode)(element.props), out);
    return out;
  }
  out.push(element);
  collectElements(element.props.children, out);
  return out;
}

function textOf(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (isValidElement(node)) return textOf((node.props as { children?: ReactNode }).children);
  return '';
}

describe('two-sided slots', () => {
  it('renders front and back uploads for any twoSided type, not only DNI', () => {
    const html = renderToStaticMarkup(
      <SlotList
        {...baseProps}
        slots={[slot({ typeKey: 'carnet', label: 'Carnet de conducir', twoSided: true, files: [file({ dniSide: 'back', originalName: 'back.jpg' })] })]}
      />,
    );
    expect(html).toContain('Subir frente');
    expect(html).not.toContain('Subir dorso');
    expect(html).toContain('back.jpg');
  });

  it('keeps sideless legacy files in their own group', () => {
    const html = renderToStaticMarkup(
      <SlotList
        {...baseProps}
        slots={[slot({ typeKey: 'cedula_verde', twoSided: true, files: [file({ dniSide: null, originalName: 'old.pdf' })] })]}
      />,
    );
    expect(html).toContain('Archivos anteriores sin lado identificado');
    expect(html).toContain('old.pdf');
  });

  it('keeps a single upload for one-file types', () => {
    const html = renderToStaticMarkup(<SlotList {...baseProps} slots={[slot({})]} />);
    expect(html).toContain('aria-label="Subir"');
    expect(html).not.toContain('Subir frente');
  });
});

describe('review status', () => {
  it('shows pending for NONE/PENDING/REJECTED and approved with reviewer', () => {
    const html = renderToStaticMarkup(
      <SlotList
        {...baseProps}
        slots={[slot({
          files: [
            file({ id: 'a', reviewStatus: 'NONE' }),
            file({ id: 'b', reviewStatus: 'PENDING' }),
            file({ id: 'c', reviewStatus: 'APPROVED', reviewedByName: 'Luis Lujan', reviewedAt: '2026-11-02T12:00:00Z' }),
          ],
        })]}
      />,
    );
    expect(html.match(/Pendiente de revisión/g)).toHaveLength(2);
    expect(html).toContain('Aprobado');
    expect(html).toContain('Luis Lujan');
  });

  it('shows the pending review count in the slot header only when above zero', () => {
    const withPending = renderToStaticMarkup(<SlotList {...baseProps} slots={[slot({ pendingReview: 2 })]} />);
    expect(withPending).toContain('2 pendientes de revisión');
    const without = renderToStaticMarkup(<SlotList {...baseProps} slots={[slot({ pendingReview: 0 })]} />);
    expect(without).not.toContain('pendientes de revisión');
  });

  it('offers Aprobar only to approvers, only on pending confirmed files, and calls onApprove', () => {
    const pending = file({ id: 'pending' });
    const files = [pending, file({ id: 'approved', reviewStatus: 'APPROVED' }), file({ id: 'draft', confirmedAt: null })];
    const hidden = renderToStaticMarkup(<SlotList {...baseProps} slots={[slot({ files })]} />);
    expect(hidden).not.toContain('Aprobar');

    const onApprove = vi.fn();
    const tree = collectElements(
      <SlotList {...baseProps} onApprove={onApprove} slots={[slot({ files })]} />,
    );
    const buttons = tree.filter((el) => textOf(el) === 'Aprobar' && typeof (el.props as { onClick?: unknown }).onClick === 'function');
    expect(buttons).toHaveLength(1);
    (buttons[0].props as { onClick: () => void }).onClick();
    expect(onApprove).toHaveBeenCalledWith(pending);
  });
});

describe('complianceAbilities', () => {
  const office = { isField: false, globalRole: GlobalRole.USER };
  it('lets Logística EDITOR approve but not configure types', () => {
    expect(complianceAbilities({ ...office, canEdit: true, canAdmin: false })).toEqual({
      isOffice: true, canApprove: true, canConfigureTypes: false,
    });
  });
  it('lets Logística ADMIN and global ADMIN do both', () => {
    expect(complianceAbilities({ ...office, canEdit: true, canAdmin: true }).canConfigureTypes).toBe(true);
    expect(complianceAbilities({ isField: false, globalRole: GlobalRole.ADMIN, canEdit: false, canAdmin: false }))
      .toEqual({ isOffice: true, canApprove: true, canConfigureTypes: true });
  });
  it('never lets VIEWER or field profiles approve', () => {
    expect(complianceAbilities({ ...office, canEdit: false, canAdmin: false }).canApprove).toBe(false);
    expect(complianceAbilities({ isField: true, globalRole: GlobalRole.USER, canEdit: true, canAdmin: true }))
      .toEqual({ isOffice: false, canApprove: false, canConfigureTypes: false });
  });
});

describe('DocumentacionHeader', () => {
  const props = { view: 'detail' as const, onView: noop, onConfigure: noop, onRefresh: noop };
  it('shows Configurar tipos only to type configurers and Tablero only to office users', () => {
    const admin = renderToStaticMarkup(
      <DocumentacionHeader {...props} abilities={{ isOffice: true, canApprove: true, canConfigureTypes: true }} />,
    );
    expect(admin).toContain('Configurar tipos');
    expect(admin).toContain('Tablero');
    const editor = renderToStaticMarkup(
      <DocumentacionHeader {...props} abilities={{ isOffice: true, canApprove: true, canConfigureTypes: false }} />,
    );
    expect(editor).not.toContain('Configurar tipos');
    expect(editor).toContain('Tablero');
    const field = renderToStaticMarkup(
      <DocumentacionHeader {...props} abilities={{ isOffice: false, canApprove: false, canConfigureTypes: false }} />,
    );
    expect(field).not.toContain('Tablero');
  });
});

describe('defaultExpiryFor', () => {
  const today = new Date(2026, 10, 3);
  it('adds the cadence period to today', () => {
    expect(defaultExpiryFor('semiannual', today)).toBe('2027-05-03');
    expect(defaultExpiryFor('monthly', today)).toBe('2026-12-03');
    expect(defaultExpiryFor('annual', today)).toBe('2027-11-03');
  });
  it('clamps to the end of a shorter month', () => {
    expect(defaultExpiryFor('semiannual', new Date(2026, 7, 31))).toBe('2027-02-28');
  });
  it('leaves undated cadences empty as before', () => {
    expect(defaultExpiryFor('once', today)).toBe('');
    expect(defaultExpiryFor('custom', today)).toBe('');
  });
});

describe('overview board', () => {
  const rows: ComplianceOverviewRow[] = [
    { transportId: 't1', transportName: 'Alfa', subject: 'TRANSPORT', subjectUserId: null, vehicleId: null, role: null, name: 'Alfa SRL', status: 'expired', nextExpiresAt: '2026-10-01', counts: { ok: 1, expiring: 0, expired: 1, missing: 0 }, pendingReview: 0 },
    { transportId: 't1', transportName: 'Alfa', subject: 'PERSON', subjectUserId: 'u1', vehicleId: null, role: 'CHOFER', name: 'Juan Pérez', status: 'ok', nextExpiresAt: null, counts: { ok: 2, expiring: 0, expired: 0, missing: 0 }, pendingReview: 1 },
    { transportId: 't2', transportName: 'Beta', subject: 'VEHICLE', subjectUserId: null, vehicleId: 'v1', role: null, name: 'AB123CD', status: 'missing', nextExpiresAt: null, counts: { ok: 0, expiring: 0, expired: 0, missing: 3 }, pendingReview: 0 },
  ];

  it('filters by transport, subject, status and pending review', () => {
    expect(filterOverviewRows(rows, EMPTY_OVERVIEW_FILTERS)).toHaveLength(3);
    expect(filterOverviewRows(rows, { ...EMPTY_OVERVIEW_FILTERS, transportId: 't1' }).map((r) => r.name)).toEqual(['Alfa SRL', 'Juan Pérez']);
    expect(filterOverviewRows(rows, { ...EMPTY_OVERVIEW_FILTERS, subject: 'VEHICLE' }).map((r) => r.name)).toEqual(['AB123CD']);
    expect(filterOverviewRows(rows, { ...EMPTY_OVERVIEW_FILTERS, status: 'expired' }).map((r) => r.name)).toEqual(['Alfa SRL']);
    expect(filterOverviewRows(rows, { ...EMPTY_OVERVIEW_FILTERS, pendingOnly: true }).map((r) => r.name)).toEqual(['Juan Pérez']);
  });

  it('renders the columns and status labels', () => {
    const html = renderToStaticMarkup(<OverviewBoard rows={rows} loading={false} onOpen={noop} />);
    for (const text of ['Transporte', 'Nombre', 'Estado', 'Próximo vencimiento', 'Pendientes de revisión', 'Solo pendientes de revisión', 'Vencido', 'Al día', 'Faltante', 'Juan Pérez', 'Empresa', 'Persona', 'Vehículo']) {
      expect(html).toContain(text);
    }
  });
});
