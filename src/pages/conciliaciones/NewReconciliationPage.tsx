import { useEffect, useState, ChangeEvent, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { conciliacionesApi } from '@/api/conciliaciones';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Label } from '@/components/ui/Label';
import { Select } from '@/components/ui/Select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import type { ExtractMapping, SystemMapping, ExpenseCategory } from '@/types/conciliaciones.types';
import { groupConceptVariants, normConcept } from '@/utils/conciliaciones';

type FileState = {
  file: File | null;
  sheets: string[];
  rows: Record<string, unknown>[];
  columns: string[];
  selectedSheet: string;
  headerRow: number;
  isLoading: boolean;
  error: string | null;
};

const initFileState = (headerRow = 1): FileState => ({
  file: null, sheets: [], rows: [], columns: [], selectedSheet: '', headerRow, isLoading: false, error: null,
});

// Mapeo automático para el archivo de Sistema — busca los nombres de columna habituales
// (insensible a mayúsculas/acentos) y devuelve un SystemMapping parcial.
function autoMapSystem(cols: string[]): Partial<ReturnType<typeof initSystemMapping>> {
  const find = (...candidates: string[]) =>
    cols.find((c) => candidates.some((k) => c.toLowerCase().includes(k.toLowerCase()))) ?? '';

  const issueDateCol = find('emisi', 'fecha emis', 'f. emis', 'fecha_emis');
  const dueDateCol   = find('vencim', 'fecha venc', 'f. venc', 'fecha_venc');
  const descriptionCol = find('comentario', 'descripci', 'concepto', 'detalle', 'glosa');
  const debeCol  = find('debe');
  const haberCol = find('haber');

  const amountMode: 'single' | 'debe-haber' =
    debeCol && haberCol ? 'debe-haber' : 'single';

  return { issueDateCol, dueDateCol, descriptionCol, debeCol, haberCol, amountMode };
}

const initExtractMapping = (): ExtractMapping => ({ amountMode: 'single', dateCol: '', conceptCol: '', amountCol: '', debeCol: '', haberCol: '' });
const initSystemMapping = (): SystemMapping => ({ amountMode: 'single', issueDateCol: '', dueDateCol: '', descriptionCol: '', amountCol: '', debeCol: '', haberCol: '' });

const BANK_OPTIONS = ['Banco Nación', 'Banco Galicia', 'Banco Santander', 'Banco Provincia', 'Banco Macro', 'Banco Supervielle', 'Mercado Pago'];
const COMPANY_OPTIONS = ['Lince', 'Lercara', 'Zumbi'];

export function NewReconciliationPage() {
  const navigate = useNavigate();
  const [extract, setExtract] = useState<FileState>(initFileState());
  const [system, setSystem] = useState<FileState>(initFileState(6));
  const [extractMapping, setExtractMapping] = useState<ExtractMapping>(initExtractMapping());
  const [systemMapping, setSystemMapping] = useState<SystemMapping>(initSystemMapping());
  const [bankName, setBankName] = useState('');
  const [company, setCompany] = useState('');
  const [windowDays, setWindowDays] = useState(0);
  const [cutDate, setCutDate] = useState('');
  const [excludeConcepts, setExcludeConcepts] = useState<string[]>([]);
  const [conceptSearch, setConceptSearch] = useState('');
  const [enabledCategoryIds, setEnabledCategoryIds] = useState<string[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    conciliacionesApi.listCategories().then(setCategories).catch(() => {});
  }, []);

  const parseFile = useCallback(async (state: FileState, setState: React.Dispatch<React.SetStateAction<FileState>>, file: File, sheet?: string, row?: number) => {
    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      const result = await conciliacionesApi.parseFile(file, sheet, row);
      const cols = result.rows.length ? Object.keys(result.rows[0] as object) : [];
      setState((s) => ({ ...s, sheets: result.sheets, rows: result.rows, columns: cols, selectedSheet: sheet || result.sheets[0] || '', headerRow: row ?? s.headerRow, isLoading: false }));
    } catch (err: unknown) {
      setState((s) => ({ ...s, error: err instanceof Error ? err.message : 'Error al procesar archivo', isLoading: false }));
    }
  }, []);

  const handleExtractFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExtract((s) => ({ ...initFileState(), file }));
    void parseFile({ ...initFileState(), file }, setExtract, file);
  };

  const handleSystemFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSystem({ ...initFileState(6), file, isLoading: true, error: null });
    void conciliacionesApi.parseFile(file, undefined, 6)
      .then((result) => {
        const cols = result.rows.length ? Object.keys(result.rows[0] as object) : [];
        setSystem((s) => ({ ...s, sheets: result.sheets, rows: result.rows, columns: cols, selectedSheet: result.sheets[0] ?? '', isLoading: false }));
        setSystemMapping((m) => ({ ...m, ...autoMapSystem(cols) }));
      })
      .catch((err: unknown) => {
        setSystem((s) => ({ ...s, isLoading: false, error: err instanceof Error ? err.message : 'Error al procesar archivo' }));
      });
  };

  const conceptOptions = (() => {
    if (!extractMapping.conceptCol) return [];
    const raw: string[] = [];
    for (const row of extract.rows) {
      const value = row[extractMapping.conceptCol];
      if (value == null) continue;
      const text = String(value).trim();
      if (text) raw.push(text);
    }
    return groupConceptVariants(raw);
  })();

  const handleRun = async () => {
    if (!extract.rows.length || !system.rows.length) { toast.error('Cargá ambos archivos antes de continuar'); return; }
    setIsRunning(true);
    try {
      const result = await conciliacionesApi.createRun({
        bankName: bankName || undefined,
        company: company || undefined,
        windowDays,
        cutDate: cutDate || undefined,
        enabledCategoryIds: enabledCategoryIds.length ? enabledCategoryIds : undefined,
        extract: { rows: extract.rows, mapping: extractMapping, excludeConcepts: excludeConcepts.length ? excludeConcepts : undefined },
        system: { rows: system.rows, mapping: systemMapping },
      });
      toast.success('Conciliación completada exitosamente');
      navigate(`/conciliaciones/run/${result.runId}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al ejecutar la conciliación');
    } finally {
      setIsRunning(false);
    }
  };

  const renderFileCard = (
    label: string,
    step: number,
    colorClass: string,
    state: FileState,
    setState: React.Dispatch<React.SetStateAction<FileState>>,
    onFile: (e: ChangeEvent<HTMLInputElement>) => void,
  ) => (
    <Card className={`border-l-4 ${colorClass}`}>
      <CardHeader>
        <CardTitle className={colorClass.replace('border-l-', 'text-').replace('-500', '-700 dark:' + colorClass.replace('border-l-', 'text-').replace('-500', '-400'))}>{step}. {label}</CardTitle>
        <CardDescription>Archivo Excel o CSV</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input type="file" accept=".xlsx,.xls,.csv" onChange={onFile} />
        {state.error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{state.error}</div>}
        {state.isLoading && <p className="text-sm text-muted-foreground">Procesando...</p>}
        {state.sheets.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Hoja</Label>
              <Select value={state.selectedSheet} onChange={(e) => { const s = e.target.value; setState((prev) => ({ ...prev, selectedSheet: s })); if (state.file) void parseFile(state, setState, state.file, s, state.headerRow); }}>
                {state.sheets.map((n) => <option key={n} value={n}>{n}</option>)}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fila de encabezados</Label>
              <Input type="number" min={1} value={state.headerRow} onChange={(e) => setState((prev) => ({ ...prev, headerRow: Number(e.target.value) }))} onBlur={() => { if (state.file) void parseFile(state, setState, state.file, state.selectedSheet, state.headerRow); }} />
            </div>
          </div>
        )}
        {state.rows.length > 0 && (
          <div className="rounded-md border">
            <div className="max-h-64 overflow-auto">
              <Table>
                <TableHeader><TableRow>{state.columns.map((c) => <TableHead key={c}>{c}</TableHead>)}</TableRow></TableHeader>
                <TableBody>
                  {state.rows.slice(0, 5).map((row, idx) => (
                    <TableRow key={idx}>{state.columns.map((c) => <TableCell key={`${idx}-${c}`}>{String(row[c] ?? '')}</TableCell>)}</TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="p-2 text-sm text-muted-foreground border-t">Mostrando 5 de {state.rows.length} filas</div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const colSelect = (value: string, onChange: (v: string) => void, cols: string[], placeholder: string) => (
    <Select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {cols.map((c) => <option key={c} value={c}>{c}</option>)}
    </Select>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Nueva Conciliación</h1>
        <p className="text-muted-foreground">Cargá los archivos y configurá el proceso de conciliación</p>
      </div>

      {renderFileCard('Cargar Extracto Bancario', 1, 'border-l-blue-500', extract, setExtract, handleExtractFile)}
      {renderFileCard('Cargar Sistema', 2, 'border-l-purple-500', system, setSystem, handleSystemFile)}

      <Card className="border-l-4 border-l-indigo-500">
        <CardHeader>
          <CardTitle className="text-indigo-700 dark:text-indigo-400">3. Mapeo de Columnas</CardTitle>
          <CardDescription>Selecciona las columnas correspondientes de cada archivo</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <h3 className="font-semibold">Extracto</h3>
              <div className="space-y-2"><Label>Fecha</Label>{colSelect(extractMapping.dateCol, (v) => setExtractMapping((m) => ({ ...m, dateCol: v })), extract.columns, 'Seleccionar')}</div>
              <div className="space-y-2"><Label>Concepto</Label>{colSelect(extractMapping.conceptCol, (v) => setExtractMapping((m) => ({ ...m, conceptCol: v })), extract.columns, 'Seleccionar')}</div>
              <div className="space-y-2">
                <Label>Modo Importe</Label>
                <Select value={extractMapping.amountMode} onChange={(e) => setExtractMapping((m) => ({ ...m, amountMode: e.target.value as 'single' | 'debe-haber' }))}>
                  <option value="single">Columna única</option><option value="debe-haber">Debe / Haber</option>
                </Select>
              </div>
              {extractMapping.amountMode === 'single'
                ? <div className="space-y-2"><Label>Importe</Label>{colSelect(extractMapping.amountCol, (v) => setExtractMapping((m) => ({ ...m, amountCol: v })), extract.columns, 'Seleccionar')}</div>
                : <>
                    <div className="space-y-2"><Label>Debe</Label>{colSelect(extractMapping.debeCol, (v) => setExtractMapping((m) => ({ ...m, debeCol: v })), extract.columns, 'Seleccionar')}</div>
                    <div className="space-y-2"><Label>Haber</Label>{colSelect(extractMapping.haberCol, (v) => setExtractMapping((m) => ({ ...m, haberCol: v })), extract.columns, 'Seleccionar')}</div>
                  </>
              }
            </div>
            <div className="space-y-4">
              <h3 className="font-semibold">Sistema</h3>
              <div className="space-y-2"><Label>Fecha Emisión</Label>{colSelect(systemMapping.issueDateCol, (v) => setSystemMapping((m) => ({ ...m, issueDateCol: v })), system.columns, 'Seleccionar')}</div>
              <div className="space-y-2"><Label>Fecha Vencimiento</Label>{colSelect(systemMapping.dueDateCol, (v) => setSystemMapping((m) => ({ ...m, dueDateCol: v })), system.columns, 'Seleccionar')}</div>
              <div className="space-y-2"><Label>Descripción</Label>{colSelect(systemMapping.descriptionCol, (v) => setSystemMapping((m) => ({ ...m, descriptionCol: v })), system.columns, 'Seleccionar (opcional)')}</div>
              <div className="space-y-2">
                <Label>Modo Importe</Label>
                <Select value={systemMapping.amountMode} onChange={(e) => setSystemMapping((m) => ({ ...m, amountMode: e.target.value as 'single' | 'debe-haber' }))}>
                  <option value="single">Columna única</option><option value="debe-haber">Debe / Haber</option>
                </Select>
              </div>
              {systemMapping.amountMode === 'single'
                ? <div className="space-y-2"><Label>Importe</Label>{colSelect(systemMapping.amountCol, (v) => setSystemMapping((m) => ({ ...m, amountCol: v })), system.columns, 'Seleccionar')}</div>
                : <>
                    <div className="space-y-2"><Label>Debe</Label>{colSelect(systemMapping.debeCol, (v) => setSystemMapping((m) => ({ ...m, debeCol: v })), system.columns, 'Seleccionar')}</div>
                    <div className="space-y-2"><Label>Haber</Label>{colSelect(systemMapping.haberCol, (v) => setSystemMapping((m) => ({ ...m, haberCol: v })), system.columns, 'Seleccionar')}</div>
                  </>
              }
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-green-500">
        <CardHeader>
          <CardTitle className="text-green-700 dark:text-green-400">4. Parámetros de Conciliación</CardTitle>
          <CardDescription>Configura las opciones de conciliación</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Empresa</Label>
            <Select value={company} onChange={(e) => setCompany(e.target.value)}>
              <option value="">Seleccionar empresa</option>
              {COMPANY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Banco</Label>
            <Select value={BANK_OPTIONS.includes(bankName) ? bankName : (bankName ? 'Otro' : '')} onChange={(e) => { const v = e.target.value; setBankName(v === 'Otro' ? 'Otro' : v); }}>
              <option value="">Seleccionar banco</option>
              {BANK_OPTIONS.map((b) => <option key={b} value={b}>{b}</option>)}
              <option value="Otro">Otro</option>
            </Select>
            {!BANK_OPTIONS.includes(bankName) && (
              <Input placeholder="Nombre del banco" value={bankName === 'Otro' ? '' : bankName} onChange={(e) => setBankName(e.target.value.trim() || 'Otro')} />
            )}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Ventana de días</Label>
              <Input type="number" min={0} value={windowDays} onChange={(e) => setWindowDays(Number(e.target.value))} />
              <p className="text-xs text-muted-foreground">0 = matchear solo por importe (comportamiento de la app anterior)</p>
            </div>
            <div className="space-y-2">
              <Label>Fecha de corte</Label>
              <Input type="date" value={cutDate} onChange={(e) => setCutDate(e.target.value)} />
            </div>
          </div>
          {conceptOptions.length > 0 && (
            <div className="space-y-3">
              <div>
                <Label>Excluir conceptos del extracto</Label>
                <p className="text-sm text-muted-foreground mt-1">Seleccioná los conceptos que querés excluir de la conciliación</p>
              </div>
              <div className="rounded-md border bg-card">
                <div className="p-3 border-b space-y-2">
                  <Input
                    placeholder="Buscar concepto..."
                    value={conceptSearch}
                    onChange={(e) => setConceptSearch(e.target.value)}
                  />
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      {(() => {
                        const q = conceptSearch.trim().toLowerCase();
                        const filtered = conceptOptions.filter(
                          (o) =>
                            !q ||
                            o.label.toLowerCase().includes(q) ||
                            o.variants.some((v) => v.toLowerCase().includes(q)),
                        );
                        return q
                          ? `${filtered.length} de ${conceptOptions.length} conceptos`
                          : `${conceptOptions.length} concepto${conceptOptions.length !== 1 ? 's' : ''}`;
                      })()}
                      {excludeConcepts.length > 0 && ` · ${excludeConcepts.length} seleccionado${excludeConcepts.length !== 1 ? 's' : ''}`}
                    </p>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        className="text-xs text-primary underline hover:no-underline"
                        onClick={() => {
                          const q = conceptSearch.trim().toLowerCase();
                          const visible = conceptOptions.filter(
                            (o) =>
                              !q ||
                              o.label.toLowerCase().includes(q) ||
                              o.variants.some((v) => v.toLowerCase().includes(q)),
                          );
                          setExcludeConcepts((prev) =>
                            Array.from(new Set([...prev, ...visible.flatMap((o) => o.variants)])),
                          );
                        }}
                      >
                        Seleccionar todos
                      </button>
                      <span className="text-xs text-muted-foreground">·</span>
                      <button
                        type="button"
                        className="text-xs text-primary underline hover:no-underline"
                        onClick={() => setExcludeConcepts([])}
                      >
                        Quitar selección
                      </button>
                    </div>
                  </div>
                </div>
                <div className="max-h-[200px] overflow-y-auto p-2 space-y-0.5">
                  {conceptOptions
                    .filter(
                      (o) =>
                        !conceptSearch.trim() ||
                        o.label.toLowerCase().includes(conceptSearch.toLowerCase()) ||
                        o.variants.some((v) => v.toLowerCase().includes(conceptSearch.toLowerCase())),
                    )
                    .map((group) => {
                      const excluded = group.variants.some((v) =>
                        excludeConcepts.some((e) => normConcept(e) === normConcept(v)),
                      );
                      return (
                        <label key={group.key} className="flex items-center gap-3 p-2 rounded-md hover:bg-accent cursor-pointer transition-colors">
                          <input
                            type="checkbox"
                            checked={excluded}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setExcludeConcepts((prev) =>
                                  Array.from(new Set([...prev, ...group.variants])),
                                );
                              } else {
                                const keys = new Set(group.variants.map(normConcept));
                                setExcludeConcepts((prev) =>
                                  prev.filter((c) => !keys.has(normConcept(c))),
                                );
                              }
                            }}
                            className="h-4 w-4 rounded border-input text-primary"
                          />
                          <span className="text-sm flex-1">{group.label}</span>
                          {group.variants.length > 1 && (
                            <span className="text-xs text-muted-foreground">{group.variants.length} variantes</span>
                          )}
                        </label>
                      );
                    })}
                  {conceptOptions.filter(
                    (o) =>
                      !conceptSearch.trim() ||
                      o.label.toLowerCase().includes(conceptSearch.toLowerCase()) ||
                      o.variants.some((v) => v.toLowerCase().includes(conceptSearch.toLowerCase())),
                  ).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-3">Sin resultados para "{conceptSearch}"</p>
                  )}
                </div>
              </div>
            </div>
          )}
          {categories.length > 0 && (
            <div className="space-y-3">
              <div>
                <Label>Categorías que aplican a esta conciliación</Label>
                <p className="text-sm text-muted-foreground mt-1">Solo se usarán las reglas de las categorías marcadas para clasificar conceptos del extracto</p>
              </div>
              <div className="rounded-md border bg-card max-h-[200px] overflow-y-auto p-4 space-y-2">
                {categories.map((cat) => (
                  <label key={cat.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-accent cursor-pointer transition-colors">
                    <input type="checkbox" checked={enabledCategoryIds.includes(cat.id)} onChange={(e) => { if (e.target.checked) setEnabledCategoryIds([...enabledCategoryIds, cat.id]); else setEnabledCategoryIds(enabledCategoryIds.filter((id) => id !== cat.id)); }} className="h-4 w-4 rounded border-input" />
                    <span className="text-sm font-medium">{cat.name}</span>
                    <span className="text-xs text-muted-foreground">({(cat.rules ?? []).length} regla(s))</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <Button onClick={handleRun} disabled={isRunning || extract.rows.length === 0 || system.rows.length === 0} className="w-full">
            {isRunning ? 'Procesando...' : 'Ejecutar Conciliación'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
