import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Document } from '../../api/documents';
import { basculerFavori, modifierDocument } from '../../api/documents';
import apiClient from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../i18n/useTranslation';
import { Card, CardContent } from '../../components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import {
  FileText,
  Image as ImageIcon,
  Video,
  MoreVertical,
  Heart,
  Pin,
  Download,
  Mail,
  MessageCircle,
  Edit,
  Trash2,
  Lock,
  Unlock,
  Play,
  FileSpreadsheet,
  FileAudio,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';
import PartagerModal from '../../components/PartagerModal';
import DetailsDocumentModal from '../../components/DetailsDocumentModal';

interface DocumentGridProps {
  documents: Document[];
  onRefresh: () => void;
}

function DocumentPreview({ doc, fileUrl }: { doc: Document; fileUrl: string }) {
  const { t } = useTranslation();
  const [error, setError] = useState(false);
  
  const mime = (doc.type_mime || '').toLowerCase();
  const typeApercu = mime.startsWith('image/') ? 'image' 
    : mime.startsWith('video/') ? 'video' 
    : mime.startsWith('audio/') ? 'audio' 
    : mime === 'application/pdf' ? 'pdf' 
    : 'autre';

  const Icone = typeApercu === 'image' ? ImageIcon 
    : typeApercu === 'video' ? Video 
    : typeApercu === 'audio' ? FileAudio 
    : typeApercu === 'pdf' ? FileText 
    : (doc.type_mime?.includes('spreadsheet') || doc.type_mime?.includes('excel')) ? FileSpreadsheet 
    : FileText;

  const docAny = doc as any;

  if (docAny.miniature) {
    if (error) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center gap-2">
          <Icone className="h-16 w-16 text-muted-foreground/60" />
          <span className="text-xs font-medium text-red-500 bg-red-50 px-2 py-0.5 rounded">
            {typeApercu === 'pdf' ? 'PDF' : doc.type_mime?.split('/').pop()?.toUpperCase() || 'DOC'}
          </span>
        </div>
      );
    }
    return (
      <img
        src={docAny.miniature} 
        alt={`${t.documents.apercu_de} ${doc.titre}`}
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        loading="lazy"
        onError={() => setError(true)}
      />
    );
  }

  if (typeApercu === 'image') {
    if (error) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center gap-2">
          <Icone className="h-16 w-16 text-muted-foreground/60" />
        </div>
      );
    }
    return (
      <img
        src={fileUrl}
        alt={doc.titre}
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        loading="lazy"
        onError={() => setError(true)}
      />
    );
  }

  if (typeApercu === 'video') {
    return (
      <div className="relative w-full h-full">
        <video
          src={fileUrl}
          className="w-full h-full object-cover"
          muted
          preload="metadata"
          onLoadedData={(e) => {
            const video = e.target as HTMLVideoElement;
            video.currentTime = 1;
          }}
        />
        <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
            <Play className="h-6 w-6 text-primary fill-primary ml-1" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-2">
      <Icone className="h-16 w-16 text-muted-foreground/60" />
      {typeApercu === 'pdf' && (
        <span className="text-xs font-medium text-red-500 bg-red-50 px-2 py-0.5 rounded">PDF</span>
      )}
    </div>
  );
}

export default function DocumentGrid({ documents, onRefresh }: DocumentGridProps) {
  const navigate = useNavigate();
  const { utilisateur } = useAuth();
  const { t, langue } = useTranslation();
  
  const [showShareModal, setShowShareModal] = useState<Document | null>(null);
  const [detailsDoc, setDetailsDoc] = useState<Document | null>(null);
  const [editDoc, setEditDoc] = useState<Document | null>(null);
  const [editTitre, setEditTitre] = useState('');

  const estAdmin = utilisateur?.est_admin === true;

  const getFileUrl = (doc: Document) => {
    return doc.fichier;
  };

  const getStatutBadge = (statut: string) => {
    const variants: Record<string, 'success' | 'destructive' | 'warning' | 'default'> = {
      valide: 'success',
      rejete: 'destructive',
      en_attente: 'warning',
      en_cours: 'default',
    };
    return variants[statut] || 'default';
  };

  async function handleFavori(doc: Document, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      const res = await basculerFavori(doc.id);
      onRefresh();
      toast.success(res.favori ? t.documents.ajoute_favoris : t.documents.retire_favoris);
    } catch {
      toast.error(t.commun.erreur);
    }
  }

  // ✅ Épinglage global via modifierDocument (état stable)
  async function handlePin(doc: Document, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await modifierDocument(doc.id, { est_epingle: !doc.est_epingle });
      onRefresh();
    } catch {
      toast.error(t.commun.erreur);
    }
  }

  async function handleModifier(e: React.FormEvent) {
    e.preventDefault();
    if (!editDoc) return;
    try {
      await modifierDocument(editDoc.id, { titre: editTitre });
      toast.success(t.documents.modifie_label);
      setEditDoc(null);
      setEditTitre('');
      onRefresh();
    } catch {
      toast.error(t.commun.erreur);
    }
  }

  async function handleSupprimer(doc: Document) {
    if (!window.confirm(`${t.commun.confirmer} ?`)) return;
    try {
      await apiClient.delete(`/documents/${doc.id}/`);
      toast.success(t.documents.supprime_label);
      onRefresh();
    } catch {
      toast.error(t.commun.erreur);
    }
  }

  async function handleToggleConfidentiel(doc: Document) {
    try {
      await modifierDocument(doc.id, { est_confidentiel: !doc.est_confidentiel });
      onRefresh();
      toast.success(doc.est_confidentiel ? t.documents.confidentialite_retiree : t.documents.rendu_confidentiel);
    } catch {
      toast.error(t.commun.erreur);
    }      
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {documents.map((doc) => {
          const fileUrl = getFileUrl(doc);
          const estFav = doc.favoris?.includes(utilisateur?.id ?? -1);
          const estProprietaire = String(doc.depose_par) === String(utilisateur?.id);

          return (
            <Card
              key={doc.id}
              className={`group cursor-pointer transition-all duration-200 overflow-hidden ${
                detailsDoc?.id === doc.id
                  ? 'ring-2 ring-primary bg-primary/5 shadow-lg'
                  : 'hover:shadow-lg'
              }`}
              onClick={() => navigate(`/documents/${doc.id}`)}
            >
              <div className="relative aspect-[4/3] bg-muted/20 overflow-hidden">
                <DocumentPreview doc={doc} fileUrl={fileUrl} />

                <div className="absolute top-2 right-2">
                  <Badge
                    variant={getStatutBadge(doc.statut)}
                    className="text-[10px] shadow-sm"
                  >
                    {doc.statut}
                  </Badge>
                </div>

                <button
                  onClick={(e) => handleFavori(doc, e)}
                  className="absolute top-2 left-2 p-1.5 rounded-full bg-white/90 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-white"
                  title={estFav ? t.documents.retirer_favori : t.documents.favori}
                >
                  <Heart
                    className={`h-4 w-4 ${estFav ? 'fill-red-500 text-red-500' : 'text-gray-600'}`}
                  />
                </button>
              </div>

              <CardContent className="p-3">
                <h3 className="font-medium text-sm truncate mb-1" title={doc.titre}>
                  {doc.titre}
                </h3>

                <div className="space-y-0.5 text-xs text-muted-foreground mb-2">
                  <div className="flex justify-between">
                    <span>{doc.depose_par_nom || '—'}</span>
                    <span>{new Date(doc.date_depot).toLocaleDateString(langue === 'en' ? 'en-US' : 'fr-FR')}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => handleFavori(doc, e)}
                      title={t.documents.favori}
                    >
                      <Heart
                        className={`h-3.5 w-3.5 ${estFav ? 'fill-red-500 text-red-500' : ''}`}
                      />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => handlePin(doc, e)}
                      title={doc.est_epingle ? t.documents.detacher : t.documents.epingler}
                    >
                      <Pin
                        className={`h-3.5 w-3.5 ${doc.est_epingle ? 'fill-primary text-primary' : ''}`}
                      />
                    </Button>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuItem onClick={(e) => {
                        e.stopPropagation();
                        setDetailsDoc(doc);
                      }}>
                        <Info className="h-4 w-4 mr-2" />{t.documents.details}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => {
                        e.stopPropagation();
                        window.open(fileUrl, '_blank');
                      }}>
                        <Download className="h-4 w-4 mr-2" />{t.documents.telecharger}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => {
                        e.stopPropagation();
                        setShowShareModal(doc);
                      }}>
                        <Mail className="h-4 w-4 mr-2" />{t.documents.partager_email}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => {
                        e.stopPropagation();
                        const url = window.location.href;
                        window.open(`https://wa.me/?text=${encodeURIComponent(doc.titre + ' ' + url)}`, '_blank');
                      }}>
                        <MessageCircle className="h-4 w-4 mr-2" />{t.documents.partager_whatsapp}
                      </DropdownMenuItem>
                      
                      {/* ✅ MODIFIER : visible pour l'admin OU le propriétaire du document */}
                      {(estAdmin || estProprietaire) && (
                        <>
                          <div className="-mx-1 my-1 h-px bg-border" />
                          <Dialog>
                            <DialogTrigger asChild>
                              <DropdownMenuItem onSelect={(e) => {
                                e.preventDefault();
                                setEditDoc(doc);
                                setEditTitre(doc.titre);
                              }}>
                                <Edit className="h-4 w-4 mr-2" />{t.documents.modifier}
                              </DropdownMenuItem>
                            </DialogTrigger>
                            <DialogContent onClick={(e) => e.stopPropagation()}>
                              <DialogHeader>
                                <DialogTitle>{t.documents.modifier}</DialogTitle>
                              </DialogHeader>
                              <form onSubmit={handleModifier} className="space-y-4">
                                <div className="space-y-2">
                                  <Label>{t.documents.titre}</Label>
                                  <Input
                                    value={editTitre}
                                    onChange={(e) => setEditTitre(e.target.value)}
                                    required
                                  />
                                </div>
                                <Button type="submit">{t.commun.sauvegarder}</Button>
                              </form>
                            </DialogContent>
                          </Dialog>
                        </>
                      )}

                      {/* 🔒 CONFIDENTIEL + SUPPRIMER : réservés à l'admin */}
                      {estAdmin && (
                        <>
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            handleToggleConfidentiel(doc);
                          }}>
                            {doc.est_confidentiel ? (
                              <Unlock className="h-4 w-4 mr-2" />
                            ) : (
                              <Lock className="h-4 w-4 mr-2" />
                            )}
                            {doc.est_confidentiel ? t.documents.retirer_conf : t.documents.rendre_conf}
                          </DropdownMenuItem>

                          <div className="-mx-1 my-1 h-px bg-border" />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSupprimer(doc);
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />{t.documents.supprimer}
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {showShareModal && (
        <PartagerModal
          document={showShareModal}
          onClose={() => setShowShareModal(null)}
        />
      )}
      {detailsDoc && (
        <DetailsDocumentModal document={detailsDoc} onClose={() => setDetailsDoc(null)} />
      )}
    </>
  );
}