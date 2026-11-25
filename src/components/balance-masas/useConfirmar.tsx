import { useCallback, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';

/**
 * Promise-based confirm with the app's Dialog (replaces the HTML's window.confirm).
 * `confirmar(texto)` resolves true on "Aceptar", false on "Cancelar" / close.
 */
export function useConfirmar() {
  const [texto, setTexto] = useState<string | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const confirmar = useCallback((t: string) => new Promise<boolean>((resolve) => {
    resolver.current = resolve;
    setTexto(t);
  }), []);

  const responder = (ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setTexto(null);
  };

  const [titulo, ...resto] = (texto ?? '').split('\n\n');
  const dialogo = (
    <Dialog open={texto !== null} onClose={() => responder(false)} title="Balance de masas">
      <p className="text-sm whitespace-pre-line">{titulo}</p>
      {resto.length ? <p className="mt-3 text-sm text-muted-foreground whitespace-pre-line">{resto.join('\n\n')}</p> : null}
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="outline" onClick={() => responder(false)}>Cancelar</Button>
        <Button autoFocus onClick={() => responder(true)}>Aceptar</Button>
      </div>
    </Dialog>
  );

  return { confirmar, dialogo };
}
