import { useEffect, useState } from 'react';
import { ACCOUNT_TYPE_OPTIONS } from '@/constants/conciliaciones';
import { formatAccountRef, parseAccountRef } from '@/utils/conciliaciones';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Label } from '@/components/ui/Label';

type AccountRefFieldsProps = {
  value: string | null | undefined;
  onChange: (next: string | null) => void;
  disabled?: boolean;
  compact?: boolean;
  showLabels?: boolean;
  idPrefix?: string;
  commitMode?: 'change' | 'blur';
};

export function AccountRefFields({
  value,
  onChange,
  disabled = false,
  compact = false,
  showLabels = true,
  idPrefix = 'account-ref',
  commitMode = 'change',
}: AccountRefFieldsProps) {
  const [draft, setDraft] = useState(value ?? null);

  useEffect(() => {
    setDraft(value ?? null);
  }, [value]);

  const parsed = parseAccountRef(commitMode === 'blur' ? draft : value);
  const selectClass = compact ? 'w-48 h-8 text-sm' : 'w-full';
  const inputClass = compact ? 'w-28 h-8 text-sm' : 'w-full';

  const apply = (type: string, number: string, commit: boolean) => {
    const next = formatAccountRef(type, number);
    if (commitMode === 'blur') {
      setDraft(next);
      if (commit) onChange(next);
      return;
    }
    onChange(next);
  };

  const clear = (commit: boolean) => {
    if (commitMode === 'blur') {
      setDraft(null);
      if (commit) onChange(null);
      return;
    }
    onChange(null);
  };

  if (parsed.isLegacy) {
    return (
      <div className={compact ? 'flex flex-wrap items-center gap-2' : 'space-y-2'}>
        {showLabels && !compact && <Label>Cuenta (legado)</Label>}
        {compact && showLabels && <Label className="text-muted-foreground font-normal">Cuenta:</Label>}
        <Input
          id={`${idPrefix}-legacy`}
          className={compact ? 'w-36 h-8 text-sm' : 'w-full'}
          value={parsed.raw}
          disabled
          title="Valor legado. Elegí un tipo abajo para reemplazarlo."
        />
        <Select
          id={`${idPrefix}-type`}
          className={selectClass}
          value=""
          disabled={disabled}
          onChange={(e) => {
            const type = e.target.value;
            if (!type) return;
            apply(type, '', true);
          }}
        >
          <option value="">Reemplazar por tipo…</option>
          {ACCOUNT_TYPE_OPTIONS.map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </Select>
      </div>
    );
  }

  return (
    <div className={compact ? 'flex flex-wrap items-center gap-2' : 'grid gap-3 sm:grid-cols-2'}>
      <div className={compact ? 'contents' : 'space-y-2'}>
        {compact && showLabels && <Label className="text-muted-foreground font-normal">Cuenta:</Label>}
        {showLabels && !compact && <Label htmlFor={`${idPrefix}-type`}>Tipo de cuenta</Label>}
        <Select
          id={`${idPrefix}-type`}
          className={selectClass}
          value={parsed.type ?? ''}
          disabled={disabled}
          onChange={(e) => {
            const type = e.target.value;
            if (!type) {
              clear(true);
              return;
            }
            apply(type, parsed.number, true);
          }}
        >
          <option value="">Sin cuenta</option>
          {ACCOUNT_TYPE_OPTIONS.map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </Select>
      </div>
      {parsed.type && (
        <div className={compact ? 'contents' : 'space-y-2'}>
          {showLabels && !compact && (
            <Label htmlFor={`${idPrefix}-number`}>Nº / ref (opcional)</Label>
          )}
          <Input
            id={`${idPrefix}-number`}
            className={inputClass}
            value={parsed.number}
            disabled={disabled}
            placeholder={compact ? 'Nº opc.' : 'Ej. 001'}
            onChange={(e) => apply(parsed.type!, e.target.value, commitMode === 'change')}
            onBlur={(e) => {
              if (commitMode === 'blur') apply(parsed.type!, e.target.value, true);
            }}
          />
        </div>
      )}
    </div>
  );
}
