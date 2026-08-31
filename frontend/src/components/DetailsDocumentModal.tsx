import { useTranslation } from '../i18n/useTranslation';
import { Document } from '../api/documents';
import { Badge } from '../components/ui/badge';
import {
  Ruler, Clock, Lock, Unlock, Pin, X, Archive,
} from 'lucide-react';

interface DetailsDocumentModalProps {
  document: Document;
  onClose: () => void;
}

export default function DetailsDocumentModal({ document: doc, onClose }: DetailsDocumentModalProps) {
  const { t, langue } = useTranslation();
  const confidentiel = doc.est_confidentiel === true;
  const estPinned = doc.est_epingle === true;
  const estArchive = doc.est_supprime === true;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/20" onClick={onClose} />
      <div className="fixed right-0 top-0 z-50 h-full w-[380px] max-w-[92vw] bg-background border-l shadow-2xl overflow-y-auto animate-in slide-in-from-right-2 duration-300">
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b bg-background">
          <h3 className="text-sm font-semibold flex items-center gap-2">{t.documents.details}</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4 space-y-3 text-sm">
          <div>
            <h2 className="text-lg font-bold break-words">{doc.titre}</h2>
          </div>
          <div className="border-t pt-3 space-y-3">
            <div className="flex justify-between"><span className="text-muted-foreground">{t.documents.statut}</span><Badge>{doc.statut}</Badge></div>
            {doc.type_mime && <div className="flex justify-between"><span className="text-muted-foreground">{t.documents.type_mime}</span><span className="text-right break-words">{doc.type_mime}</span></div>}
            {doc.type_source && <div className="flex justify-between"><span className="text-muted-foreground">{t.documents.source}</span><span>{doc.type_source}</span></div>}
            {doc.taille_fichier && <div className="flex justify-between"><span className="text-muted-foreground">{t.documents.taille}</span><span>{(doc.taille_fichier / 1024 / 1024).toFixed(2)} Mo</span></div>}
            {doc.depose_par_nom && <div className="flex justify-between"><span className="text-muted-foreground">{t.documents.depose_par}</span><span>{doc.depose_par_nom}</span></div>}
            {doc.date_depot && <div className="flex justify-between"><span className="text-muted-foreground">{t.documents.date_depot}</span><span>{new Date(doc.date_depot).toLocaleDateString(langue === 'en' ? 'en-US' : 'fr-FR')}</span></div>}
            {doc.departement_nom && <div className="flex justify-between"><span className="text-muted-foreground">{t.documents.departement}</span><span>{langue === 'en' ? (doc.departement_nom_en || doc.departement_nom) : doc.departement_nom}</span></div>}
            {doc.categorie_nom && <div className="flex justify-between"><span className="text-muted-foreground">{t.documents.categorie}</span><span>{doc.categorie_nom}</span></div>}
            {doc.auteur_document && <div className="flex justify-between"><span className="text-muted-foreground">{t.documents.auteur}</span><span>{doc.auteur_document}</span></div>}
            {doc.largeur_px && doc.hauteur_px && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground flex items-center gap-1"><Ruler className="h-3 w-3" />{t.documents.dimensions}</span>
                <span>{doc.largeur_px} × {doc.hauteur_px} px</span>
              </div>
            )}
            {doc.duree && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />{t.documents.duree}</span>
                <span>{doc.duree}</span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground flex items-center gap-1">{confidentiel ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}{t.documents.confidentiel}</span>
              <Badge variant={confidentiel ? 'destructive' : 'secondary'}>{confidentiel ? t.documents.oui : t.documents.non}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground flex items-center gap-1"><Pin className="h-3 w-3" />{t.documents.epingle}</span>
              <span>{estPinned ? t.documents.oui : t.documents.non}</span>
            </div>
            {/* ✅ NOUVEAU : État d'archivage */}
            <div className="flex       justify-between items-center">
              <span className="text-muted-foreground flex items-center gap-1"><Archive className="h-3 w-3" />{t.documents.archive_court}</span>
              <Badge variant={estArchive ? 'default' : 'secondary'}>{estArchive ? t.documents.oui : t.documents.non}</Badge>
            </div>
          </div>
          {doc.tags && doc.tags.length > 0 && (
            <div className="border-t pt-3">
              <p className="text-muted-foreground mb-2">{t.documents.tags}</p>
              <div className="flex gap-2 flex-wrap">
                {doc.tags.map((tag: any) => (
                  <Badge key={typeof tag === 'object' ? tag.id : tag} variant="secondary"
                    style={typeof tag === 'object' && tag.couleur ? { backgroundColor: tag.couleur + '20', color: tag.couleur } : undefined}
                  >{typeof tag === 'object' ? tag.nom : tag}</Badge>
                ))}
              </div>
            </div>
          )}
          {doc.cause_rejet && (
            <div className="border-t pt-3">
              <p className="text-sm text-destructive mb-1">{t.documents.cause_rejet}</p>
              <p className="text-sm">{doc.cause_rejet_en || doc.cause_rejet}</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}