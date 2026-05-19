import { LayoutDashboard, Briefcase, MessageSquare, Shield, FilterX, BookOpen } from 'lucide-react';

export type RunDetailSection = 'resumen' | 'libro-banco' | 'workspace' | 'exclusiones' | 'issues' | 'permisos';

interface RunDetailSidebarProps {
  active: RunDetailSection;
  onSelect: (section: RunDetailSection) => void;
  issuesCount?: number;
  showPermisos?: boolean;
}

const BASE_SECTIONS: { id: RunDetailSection; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'resumen', label: 'Resumen', icon: LayoutDashboard },
  { id: 'libro-banco', label: 'Libro Banco', icon: BookOpen },
  { id: 'workspace', label: 'Hoja de trabajo', icon: Briefcase },
  { id: 'exclusiones', label: 'Exclusiones', icon: FilterX },
  { id: 'issues', label: 'Issues', icon: MessageSquare },
];

const PERMISOS_SECTION = { id: 'permisos' as RunDetailSection, label: 'Permisos', icon: Shield };

export function RunDetailSidebar({ active, onSelect, issuesCount = 0, showPermisos = false }: RunDetailSidebarProps) {
  const sections = showPermisos ? [...BASE_SECTIONS, PERMISOS_SECTION] : BASE_SECTIONS;
  return (
    <nav className="flex flex-col gap-0.5 w-52 shrink-0 border-r bg-muted/30 p-2 rounded-l-lg">
      {sections.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onSelect(id)}
          className={[
            'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
            active === id
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          ].join(' ')}
        >
          <Icon className="h-4 w-4 shrink-0" />
          <span className="truncate">{label}</span>
          {id === 'issues' && issuesCount > 0 && (
            <span className="ml-auto rounded-full bg-muted px-1.5 py-0.5 text-xs tabular-nums">
              {issuesCount}
            </span>
          )}
        </button>
      ))}
    </nav>
  );
}
