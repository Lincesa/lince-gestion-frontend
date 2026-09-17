import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ComplianceFileView, ComplianceSlotView } from '@/types/logistica.types';
import { SlotList } from './DocumentacionPage';

describe('DNI side uploads', () => {
  it('offers upload only for missing sides and replacement for an existing side', () => {
    const front = {
      id: 'front-file',
      dniSide: 'front',
      originalName: 'front.jpg',
      status: 'ok',
      expiresAt: null,
    } as ComplianceFileView;
    const slot = {
      typeKey: 'dni',
      label: 'DNI (frente y dorso)',
      status: 'missing',
      files: [front],
    } as ComplianceSlotView;

    const html = renderToStaticMarkup(
      <SlotList
        slots={[slot]}
        onUpload={async () => {}}
        onPreview={() => {}}
        onExpiry={() => {}}
        onRemove={() => {}}
      />,
    );

    expect(html).not.toContain('Subir frente');
    expect(html).toContain('Subir dorso');
    expect(html).toContain('Reemplazar');
    expect(html).toContain('front.jpg');
  });
});
