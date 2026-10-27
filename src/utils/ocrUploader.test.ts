import { describe, expect, it } from 'vitest';
import { formatUploader } from './ocrUploader';

describe('formatUploader', () => {
  it('shows the driver declared in the mobile app', () => {
    expect(formatUploader({ driverName: 'MARIN Cristian', uploadedByName: 'Transporte Veliz' })).toBe('MARIN Cristian');
  });

  it('falls back to the account that uploaded it from the web', () => {
    expect(formatUploader({ driverName: null, uploadedByName: 'Operaciones' })).toBe('Operaciones');
  });

  it('shows a dash when nothing identifies the uploader', () => {
    expect(formatUploader({ driverName: null, uploadedByName: null })).toBe('—');
    expect(formatUploader({ driverName: '  ' })).toBe('—');
  });
});
