import { Button } from './ui/button';
import { Share2, X, Heart, Pin, Lock, LockOpen, Archive, ArchiveRestore } from 'lucide-react';
import { useTranslation } from '../i18n/useTranslation';

interface SelectionToolbarProps {
  count: number;
  onClear: () => void;
  onPartager: () => void;
  onFavori?: () => void;
  onEpingle?: () => void;
  onConfidentiel?: () => void;
  onArchiver?: () => void;
  etatFavori?: 'add' | 'remove';
  etatEpingle?: 'add' | 'remove';
  etatConfidentiel?: 'add' | 'remove';
  etatArchive?: 'add' | 'remove';
}

export default function SelectionToolbar({
  count, onClear, onPartager, onFavori, onEpingle, onConfidentiel, onArchiver,
  etatFavori = 'add', etatEpingle = 'add', etatConfidentiel = 'add', etatArchive = 'add',
}: SelectionToolbarProps) {
  const { t } = useTranslation();
  if (count === 0) return null;
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-muted/60 rounded-md mb-2 text-sm">
      <span className="font-medium text-muted-foreground">{count} {t.documents.selectionnes}</span>
      <div className="flex-1" />
      {onFavori && (
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={onFavori}>
          <Heart className="h-3 w-3" /> {etatFavori === 'remove' ? t.documents.retirer_favori : t.documents.ajouter_favoris}
        </Button>
      )}
      {onEpingle && (
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={onEpingle}>
          <Pin className="h-3 w-3" /> {etatEpingle === 'remove' ? t.documents.desepingler : t.documents.epingler}
        </Button>
      )}
      {onConfidentiel && (
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={onConfidentiel}>
          {etatConfidentiel === 'remove' ? <LockOpen className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
          {etatConfidentiel === 'remove' ? t.documents.rendre_public : t.documents.rendre_conf}
        </Button>
      )}
      {onArchiver && (
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={onArchiver}>
          {etatArchive === 'remove' ? <ArchiveRestore className="h-3 w-3" /> : <Archive className="h-3 w-3" />}
          {etatArchive === 'remove' ? t.documents.desarchiver : t.documents.archiver}
        </Button>
      )}
      <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={onPartager}>
        <Share2 className="h-3 w-3" /> {t.documents.partager}
      </Button>
      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={onClear}>
        <X className="h-3 w-3" /> {t.commun.annuler}
      </Button>
    </div>
  );
}