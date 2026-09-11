import { usePreferences } from '../hooks/usePreferences';
import { useTheme } from './ThemeProvider';
import { useTranslation } from '../i18n/useTranslation';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from './ui/sheet';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Settings, RotateCcw } from 'lucide-react';

const COULEURS = [
  { value: 'entreprise', nom: 'Entreprise', hex: '#1F4E79' },
  { value: 'violet', nom: 'Violet', hex: '#6657C3' },
  { value: 'steel', nom: 'Steel Blue', hex: '#467B98' },
  { value: 'crimson', nom: 'Dusty Crimson', hex: '#c35766' },
  { value: 'brown', nom: 'Warm Brown', hex: '#80585D' },
  { value: 'vert', nom: 'Vert', hex: '#2EA874' },
  { value: 'or', nom: 'Or', hex: '#C9A227' },
];

export default function PreferencesSheet({ compact = false }: { compact?: boolean }) {
  const { preferences, updatePreference, resetPreferences } = usePreferences();
  const { theme, setTheme } = useTheme();
  const { basculerLangue, langue } = useTranslation();
  const fr = langue === 'fr';

  return (
    <Sheet>
      <SheetTrigger asChild>
                <Button variant="ghost" title={fr ? 'Préférences' : 'Preferences'} className={`w-full text-white/75 hover:bg-white/10 hover:text-white ${compact ? 'justify-center px-0' : 'justify-start gap-3'}`}>
          <Settings className="h-4 w-4" />
          {!compact && <span>{fr ? 'Préférences' : 'Preferences'}</span>}
        </Button>
      </SheetTrigger>

      <SheetContent className="w-[420px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{fr ? 'Préférences' : 'Preferences'}</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 p-4">
          {/* Apparence */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">{fr ? 'Apparence' : 'Appearance'}</h3>

            {/* ✅ Cartes de couleurs (ronds supprimés) */}
            <div className="space-y-2">
              <Label>{fr ? 'Couleurs primaires' : 'Primary colors'}</Label>
              <div className="grid grid-cols-2 gap-3">
                {COULEURS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => updatePreference('themeColor', c.value as any)}
                    className={`relative rounded-xl border p-3 space-y-1.5 text-center ${
                      preferences.themeColor === c.value
                        ? 'border-primary ring-2 ring-primary/40'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    {preferences.themeColor === c.value && (
                      <span className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center">✓</span>
                    )}
                    <div className="h-12 rounded-lg" style={{ background: c.hex }} />
                    <p className="text-xs font-medium">{c.nom}</p>
                    <p className="text-[10px] text-muted-foreground">{c.hex}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Thème de la sidebar */}
            <div className="space-y-2">
              <Label>{fr ? 'Thème de la barre latérale' : 'Sidebar theme'}</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => updatePreference('sidebarTheme', 'colored')}
                  className={`rounded-xl border p-3 space-y-1.5 text-center ${
                    preferences.sidebarTheme === 'colored' ? 'border-primary ring-2 ring-primary/40' : 'border-border'
                  }`}
                >
                  <div className="h-10 rounded-lg" style={{ background: 'var(--primary)' }} />
                  <p className="text-xs font-medium">{fr ? 'Couleur primaire' : 'Primary color'}</p>
                </button>
                <button
                  onClick={() => updatePreference('sidebarTheme', 'dark')}
                  className={`rounded-xl border p-3 space-y-1.5 text-center ${
                    preferences.sidebarTheme === 'dark' ? 'border-primary ring-2 ring-primary/40' : 'border-border'
                  }`}
                >
                  <div className="h-10 rounded-lg bg-[hsl(240_12%_10%)]" />
                  <p className="text-xs font-medium">{fr ? 'Thème sombre' : 'Dark theme'}</p>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="mode-sombre">{fr ? 'Mode sombre' : 'Dark mode'}</Label>
              <Switch
                id="mode-sombre"
                checked={theme === 'dark'}
                onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>{fr ? 'Langue' : 'Language'}</Label>
              <Button variant="outline" size="sm" onClick={basculerLangue}>
                {langue === 'fr' ? 'English' : 'Français'}
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <Label>{fr ? 'Densité' : 'Density'}</Label>
              <Select value={preferences.density} onValueChange={(v) => updatePreference('density', v as any)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="comfortable">{fr ? 'Confortable' : 'Comfortable'}</SelectItem>
                  <SelectItem value="compact">{fr ? 'Compact' : 'Compact'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Confort */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">{fr ? 'Confort' : 'Comfort'}</h3>

            <div className="flex items-center justify-between">
              <Label>{fr ? "Page d'accueil" : 'Start page'}</Label>
              <Select value={preferences.startPage} onValueChange={(v) => updatePreference('startPage', v as any)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dashboard">{fr ? 'Tableau de bord' : 'Dashboard'}</SelectItem>
                  <SelectItem value="documents">{fr ? 'Documents' : 'Documents'}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <Label>{fr ? 'Lignes par page' : 'Lines per page'}</Label>
              <Select value={String(preferences.linesPerPage)} onValueChange={(v) => updatePreference('linesPerPage', parseInt(v))}>
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[10, 20, 50, 100].map((n) => (
                    <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="email-hebdo">{fr ? 'Résumé email hebdo' : 'Weekly email summary'}</Label>
              <Switch
                id="email-hebdo"
                checked={preferences.weeklyEmail}
                onCheckedChange={(checked) => updatePreference('weeklyEmail', checked)}
              />
            </div>
          </div>

          <Button variant="outline" className="w-full" onClick={resetPreferences}>
            <RotateCcw className="h-4 w-4 mr-2" />
            {fr ? 'Réinitialiser' : 'Reset'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}