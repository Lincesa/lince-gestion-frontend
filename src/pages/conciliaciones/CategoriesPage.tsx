import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { conciliacionesApi } from '@/api/conciliaciones';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Label } from '@/components/ui/Label';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { useCanPerform } from '@/hooks/useCanPerform';
import { ModuleKey } from '@/types/auth.types';
import type { ExpenseCategory } from '@/types/conciliaciones.types';

export function CategoriesPage() {
  const { canEdit, canAdmin } = useCanPerform(ModuleKey.CONCILIACIONES);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newCategory, setNewCategory] = useState('');
  const [ruleCategoryId, setRuleCategoryId] = useState('');
  const [rulePattern, setRulePattern] = useState('');
  const [ruleRegex, setRuleRegex] = useState(false);
  const [ruleCase, setRuleCase] = useState(false);

  const loadCategories = () => {
    conciliacionesApi.listCategories()
      .then(setCategories)
      .catch(() => toast.error('Error al cargar categorías'))
      .finally(() => setIsLoading(false));
  };

  useEffect(loadCategories, []);

  const handleAddCategory = async () => {
    if (!newCategory.trim()) return;
    try {
      await conciliacionesApi.createCategory(newCategory.trim());
      setNewCategory('');
      loadCategories();
      toast.success('Categoría creada');
    } catch { toast.error('Error al crear categoría'); }
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      await conciliacionesApi.deleteCategory(id);
      loadCategories();
      toast.success('Categoría eliminada');
    } catch { toast.error('Error al eliminar categoría'); }
  };

  const handleAddRule = async () => {
    if (!ruleCategoryId || !rulePattern.trim()) return;
    try {
      await conciliacionesApi.createRule({ categoryId: ruleCategoryId, pattern: rulePattern.trim(), isRegex: ruleRegex, caseSensitive: ruleCase });
      setRulePattern(''); setRuleRegex(false); setRuleCase(false);
      loadCategories();
      toast.success('Regla creada');
    } catch { toast.error('Error al crear regla'); }
  };

  const handleDeleteRule = async (id: string) => {
    try {
      await conciliacionesApi.deleteRule(id);
      loadCategories();
      toast.success('Regla eliminada');
    } catch { toast.error('Error al eliminar regla'); }
  };

  if (isLoading) {
    return <div className="flex h-96 items-center justify-center"><p className="text-muted-foreground">Cargando...</p></div>;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Categorías de Gastos</h1>
        <p className="text-muted-foreground">Agrupá conceptos del extracto (ej. IVA PATO, IVA GATO → IVA) para clasificar y excluir más fácil en cada conciliación.</p>
      </div>

      <Card className="border-l-4 border-l-blue-500 border-blue-500/30 bg-blue-500/10">
        <CardHeader>
          <CardTitle className="text-lg text-blue-700 dark:text-blue-200">💡 ¿Para qué sirven las Categorías?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p><strong>Agrupar conceptos:</strong> Definí categorías (ej. "IVA") y reglas que matchean texto del concepto. Así "IVA PATO", "IVA GATO", "IVA PERRO" se clasifican todos como <strong>IVA</strong>.</p>
          <div className="space-y-1">
            <p><strong>En la conciliación:</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-2 text-muted-foreground">
              <li>En <strong>Exclusiones</strong> podés excluir por categoría de una: "Excluir todos esta categoría".</li>
              <li>En el reporte y Excel exportado cada línea lleva su categoría asignada.</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-l-4 border-l-purple-500">
          <CardHeader>
            <CardTitle className="text-purple-700 dark:text-purple-400">Nueva Categoría</CardTitle>
            <CardDescription>Crea una nueva categoría de gastos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre de la categoría</Label>
              <Input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="Ej: Comisiones bancarias" onKeyDown={(e) => { if (e.key === 'Enter') void handleAddCategory(); }} />
            </div>
            <Button onClick={handleAddCategory} disabled={!newCategory.trim() || !canEdit}>
              <Plus className="mr-2 h-4 w-4" />Agregar Categoría
            </Button>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-indigo-500">
          <CardHeader>
            <CardTitle className="text-indigo-700 dark:text-indigo-400">Nueva Regla</CardTitle>
            <CardDescription>Agrega una regla de clasificación automática</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Categoría</Label>
              <Select value={ruleCategoryId} onChange={(e) => setRuleCategoryId(e.target.value)}>
                <option value="">Seleccionar</option>
                {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Patrón de búsqueda</Label>
              <Input value={rulePattern} onChange={(e) => setRulePattern(e.target.value)} placeholder="Ej: comision, transferencia" />
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2"><input type="checkbox" checked={ruleRegex} onChange={(e) => setRuleRegex(e.target.checked)} className="h-4 w-4 rounded border-input" /><span className="text-sm">Regex</span></label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={ruleCase} onChange={(e) => setRuleCase(e.target.checked)} className="h-4 w-4 rounded border-input" /><span className="text-sm">Case sensitive</span></label>
            </div>
            <Button onClick={handleAddRule} disabled={!ruleCategoryId || !rulePattern.trim() || !canEdit}>
              <Plus className="mr-2 h-4 w-4" />Agregar Regla
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {categories.map((category) => (
          <Card key={category.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{category.name}</CardTitle>
                {canAdmin && (
                  <Button variant="ghost" size="icon" onClick={() => void handleDeleteCategory(category.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
              <CardDescription>{(category.rules ?? []).length} {(category.rules ?? []).length === 1 ? 'regla' : 'reglas'}</CardDescription>
            </CardHeader>
            <CardContent>
              {(category.rules ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin reglas</p>
              ) : (
                <div className="space-y-2">
                  {(category.rules ?? []).map((rule) => (
                    <div key={rule.id} className="flex items-center justify-between rounded-md border p-2">
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-medium">{rule.pattern}</span>
                        <div className="flex gap-1">
                          {rule.isRegex && <Badge variant="secondary">regex</Badge>}
                          {rule.caseSensitive && <Badge variant="secondary">case</Badge>}
                        </div>
                      </div>
                      {canAdmin && (
                        <Button variant="ghost" size="icon" onClick={() => void handleDeleteRule(rule.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {categories.length === 0 && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <p className="text-muted-foreground mb-4">No hay categorías aún. Crea una para comenzar a clasificar tus gastos automáticamente.</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
