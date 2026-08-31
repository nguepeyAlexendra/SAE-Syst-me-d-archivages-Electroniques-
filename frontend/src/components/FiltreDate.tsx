import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Button } from './ui/button';
import { Calendar } from 'lucide-react';
import { useTranslation } from '../i18n/useTranslation';

export interface FiltreDateValeur {
  mode: 'plage' | 'precise';
  debut: string;
  fin: string;
  precise: string;
}

interface FiltreDateProps {
  valeur: FiltreDateValeur;
  onChange: (valeur: FiltreDateValeur) => void;
  labelAucun?: string;
  taille?: 'sm' | 'default';
  largeurLabel?: string;
}

export const FILTRE_DATE_VIDE: FiltreDateValeur = { mode: 'plage', debut: '', fin: '', precise: '' };

export default function FiltreDate({ valeur, onChange, labelAucun, taille = 'sm', largeurLabel = 'max-w-[140px]' }: FiltreDateProps) {
  const { t, langue } = useTranslation();

  const label =
    valeur.mode === 'precise' && valeur.precise
      ? new Date(valeur.precise).toLocaleDateString(langue === 'en' ? 'en-US' : 'fr-FR')
      : valeur.mode === 'plage' && (valeur.debut || valeur.fin)
        ? `${valeur.debut || '…'} → ${valeur.fin || '…'}`
        : labelAucun || t.documents.date;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size={taille} className="gap-1.5 text-xs h-8">
          <Calendar className="h-3.5 w-3.5" />
          <span className={`${largeurLabel} truncate`}>{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-3" align="start">
        <div className="flex gap-1">
          <Button size="sm" variant={valeur.mode === 'plage' ? 'default' : 'outline'} className="flex-1" onClick={() => onChange({ ...valeur, mode: 'plage' })}>
            {t.documents.periode}
          </Button>
          <Button size="sm" variant={valeur.mode === 'precise' ? 'default' : 'outline'} className="flex-1" onClick={() => onChange({ ...valeur, mode: 'precise' })}>
            {t.documents.date_precise}
          </Button>
        </div>
        {valeur.mode === 'plage' ? (
          <div className="space-y-2">
            <div>
              <label className="text-xs text-muted-foreground">{t.documents.du}</label>
              <input type="date" value={valeur.debut} onChange={(e) => onChange({ ...valeur, debut: e.target.value })}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">{t.documents.au}</label>
              <input type="date" value={valeur.fin} onChange={(e) => onChange({ ...valeur, fin: e.target.value })}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm" />
            </div>
          </div>
        ) : (
          <div>
            <label className="text-xs text-muted-foreground">{t.documents.date}</label>
            <input type="date" value={valeur.precise} onChange={(e) => onChange({ ...valeur, precise: e.target.value })}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm" />
          </div>
        )}
        <Button size="sm" variant="ghost" className="w-full" onClick={() => onChange(FILTRE_DATE_VIDE)}>
          {t.documents.reinitialiser}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
