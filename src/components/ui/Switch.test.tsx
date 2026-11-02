import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Switch } from './Switch';

describe('Switch', () => {
  it('renders an accessible switch that is on', () => {
    const html = renderToStaticMarkup(<Switch checked onCheckedChange={() => {}} label="Carga de combustible" />);
    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain('aria-label="Carga de combustible"');
    expect(html).toContain('bg-primary');
  });

  it('renders off and disabled', () => {
    const html = renderToStaticMarkup(<Switch checked={false} disabled onCheckedChange={() => {}} label="x" />);
    expect(html).toContain('aria-checked="false"');
    expect(html).toContain('disabled=""');
    expect(html).not.toContain('bg-primary');
  });
});
