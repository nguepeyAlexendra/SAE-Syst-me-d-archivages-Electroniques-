import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { obtenirDocument, getDocumentUrl, basculerFavori, modifierDocument, desarchiverDocument, archiverDocument, extraireTexteDocument, getApercuUrl } from '../../api/documents';
import apiClient from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../i18n/useTranslation';

import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '../../components/ui/dialog';
import {
  ArrowLeft, Download, MoreVertical, Pin, Archive, ArchiveRestore, FileText, Image, Video, Ruler, Clock, Lock, Unlock,
  Heart, Share2, Edit, Shield, Mail, MessageCircle, Save, Info, ScanText, Copy, Check,
} from 'lucide-react';
import { toast } from 'sonner';

import PartagerModal from '../../components/PartagerModal';
import DetailsDocumentModal from '../../components/DetailsDocumentModal';
import ImageLightbox from '../../components/ImageLightbox'; // ✅ AJOUT

export default function DetailDocument() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { utilisateur } = useAuth();
  const { t, langue } = useTranslation();
  const [doc, setDoc] = useState<Awaited<ReturnType<typeof obtenirDocument>> | null>(null);
  const [chargement, setChargement] = useState(true);
  const [estFavori, setEstFavori] = useState(false);
  const [estPinned, setEstPinned] = useState(false);
  const [confidentiel, setConfidentiel] = useState(false);
  const [editTitre, setEditTitre] = useState('');
  const [showShareModal, setShowShareModal] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [texteOcr, setTexteOcr] = useState('');
  const [extractionEnCours, setExtractionEnCours] = useState(false);
  const [copie, setCopie] = useState(false);
  const [panneauOcrOuvert, setPanneauOcrOuvert] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [imageAgrandie, setImageAgrandie] = useState(false); // ✅ AJOUT

  async function charger() {
    if (!id) return;
    try {
      const data = await obtenirDocument(Number(id));
      setDoc(data);
      setEstFavori(data.favoris?.includes(utilisateur?.id ?? -1) ?? false);
      setEstPinned(data.est_epingle ?? false);
      setConfidentiel(data.est_confidentiel ?? false);
      setEditTitre(data.titre);
    } catch {
      toast.error(t.documents.introuvable);
      navigate('/documents');
    } finally {
      setChargement(false);
    }
  }

  useEffect(() => { charger(); }, [id]);

  useEffect(() => {
    if (panneauOcrOuvert && texteOcr && !extractionEnCours && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [texteOcr, panneauOcrOuvert, extractionEnCours]);

  if (chargement) return <p className="p-8">{t.commun.charger}</p>;
  if (!doc) return <p className="p-8">{t.documents.introuvable}</p>;

  const estAdmin = utilisateur?.est_admin;
  const urlDoc = getDocumentUrl(doc);
  const groupe = doc.groupe || 'document';

  async function handleFavori() {
    if (!id) return;
    try {
      const res = await basculerFavori(Number(id));
      setEstFavori(res.favori);
      toast.success(res.favori ? t.documents.ajoute_favoris : t.documents.retire_favoris);
    } catch { toast.error(t.commun.erreur); }
  }

  async function handlePin() {
    if (!id) return;
    try {
      await modifierDocument(Number(id), { est_epingle: !estPinned });
      setEstPinned(!estPinned);
      toast.success(estPinned ? t.documents.detache_label : t.documents.epingle_label);
    } catch { toast.error(t.commun.erreur); }
  }

  async function handleArchiver() {
    if (!id || !doc) return;
    try {
      if (doc.est_supprime) {
        await desarchiverDocument(Number(id));
        toast.success(t.documents.desarchive_label);
        setTimeout(() => navigate(-1), 800);
      } else {
        await archiverDocument(Number(id));
        toast.success(t.documents.archive_label);
        setTimeout(() => navigate(-1), 800);
      }
    } catch (error) {
      console.error('Erreur archivage:', error);
      toast.error(t.commun.erreur);
    }
  }

  async function handleToggleConfidentiel() {
    if (!id) return;
    try {
      await modifierDocument(Number(id), { est_confidentiel: !confidentiel });
      setConfidentiel(!confidentiel);
      toast.success(confidentiel ? t.documents.confidentialite_retiree : t.documents.rendu_confidentiel);
    } catch { toast.error(t.commun.erreur); }
  }

  async function handleModifier(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    try {
      await modifierDocument(Number(id), { titre: editTitre });
      toast.success(t.documents.modifie_label);
      charger();
    } catch { toast.error(t.commun.erreur); }
  }

  function handlePartager(method: 'whatsapp') {
    if (!doc) return;
    const url = window.location.href;
    const sujet = doc.titre;
    if (method === 'whatsapp') {
      window.open(`https://wa.me/?text=${encodeURIComponent(sujet + ' ' + url)}`, '_blank');
    }
  }

  async function handleExtraireTexte() {
    if (!id) return;
    setPanneauOcrOuvert(true);
    if ((doc?.contenu_texte || '').trim()) {
      setTexteOcr(doc?.contenu_texte || '');
      return;
    }
    setExtractionEnCours(true);
    setCopie(false);
    try {
      const res = await extraireTexteDocument(Number(id));
      setTexteOcr(res.texte ?? res.contenu_texte ?? '');
      if (!(res.texte ?? res.contenu_texte ?? '')) toast.info(t.documents.aucun_texte_extrait);
    } catch (e: any) {
      const msg = e?.response?.data?.erreur;
      if (isOCRIndisponible(msg)) toast.error(msg);
      else toast.error(t.documents.erreur_ocr);
    } finally {
      setExtractionEnCours(false);
    }
  }

  function isOCRIndisponible(msg: string): boolean {
    return /Tesseract|OCR.*indisponible|non installé/i.test(msg || '');
  }

  async function handleCopier() {
    const texte = texteOcr || '';
    try {
      await navigator.clipboard.writeText(texte);
      setCopie(true);
      setTimeout(() => setCopie(false), 2000);
    } catch {
      toast.error(t.commun.erreur);
    }
  }

  const renderPreview = () => {
    if (groupe === 'images') {
      return (
        <img
          src={urlDoc}
          alt={doc.titre}
          className="max-w-full max-h-[500px] rounded object-contain mx-auto cursor-zoom-in"
          onClick={() => setImageAgrandie(true)}
        />
      );
    }
    if (groupe === 'medias') {
      const type = doc.type_mime || '';
      if (type.startsWith('video/')) {
        return <video src={urlDoc} controls className="max-w-full max-h-[500px] rounded mx-auto" />;
      }
      return <audio src={urlDoc} controls className="w-full" />;
    }
    if (doc.type_mime === 'application/pdf') {
      return <iframe src={urlDoc} className="w-full h-[600px] rounded" title={doc.titre} />;
    }
    // 🆕 Fichiers Office (pptx, docx…) : aperçu PDF généré côté serveur
    const apercuUrl = getApercuUrl(doc);
    if (apercuUrl) {
      return <iframe src={apercuUrl} className="w-full h-[600px] rounded" title={doc.titre} />;
    }
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-muted/30 rounded gap-4">
        <FileText className="h-16 w-16 text-muted-foreground" />
        <p className="text-muted-foreground">{t.documents.apercu_non_disponible}</p>
        <Button variant="outline" onClick={() => window.open(urlDoc, '_blank')}>
          <Download className="h-4 w-4 mr-2" />{t.documents.telecharger}
        </Button>
      </div>
    );
  };

  const GroupIcon = groupe === 'images' ? Image : groupe === 'medias' ? Video : FileText;

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4 mr-2" />{t.documents.retour}</Button>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={handleFavori} title={estFavori ? t.documents.retirer_favori : t.documents.favori}>
            <Heart className={`h-4 w-4 ${estFavori ? 'fill-red-500 text-red-500' : ''}`} />
          </Button>
          <Button variant="ghost" size="icon" onClick={handlePin} title={estPinned ? t.documents.detacher : t.documents.epingler}>
            <Pin className={`h-4 w-4 ${estPinned ? 'fill-primary text-primary' : ''}`} />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setShowDetails(true)}>
                <Info className="h-4 w-4 mr-2" />{t.documents.details}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => window.open(urlDoc, '_blank')}>
                <Download className="h-4 w-4 mr-2" />{t.documents.telecharger}
              </DropdownMenuItem>
              {groupe === 'images' && (
                <DropdownMenuItem onClick={handleExtraireTexte} disabled={extractionEnCours}>
                  <ScanText className="h-4 w-4 mr-2" />
                  {extractionEnCours ? t.documents.extraction_en_cours : t.documents.extraire_texte}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => handlePartager('whatsapp')}>
                <MessageCircle className="h-4 w-4 mr-2" />{t.documents.partager_whatsapp}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowShareModal(true)}>
                <Mail className="h-4 w-4 mr-2" />{t.documents.partager_email}
              </DropdownMenuItem>
              {estAdmin && (
                <>
                  <Dialog>
                    <DialogTrigger asChild>
                      <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                        <Edit className="h-4 w-4 mr-2" />{t.documents.modifier}
                      </DropdownMenuItem>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>{t.documents.modifier}</DialogTitle></DialogHeader>
                      <form onSubmit={handleModifier} className="space-y-4">
                        <div className="space-y-2">
                          <Label>{t.documents.titre}</Label>
                          <Input value={editTitre} onChange={(e) => setEditTitre(e.target.value)} required />
                        </div>
                        <Button type="submit"><Save className="h-4 w-4 mr-2" />{t.commun.sauvegarder}</Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                  <DropdownMenuItem onClick={handleToggleConfidentiel}>
                    {confidentiel ? <Unlock className="h-4 w-4 mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
                    {confidentiel ? t.documents.retirer_conf : t.documents.rendre_conf}
                  </DropdownMenuItem>
                  {doc.est_supprime ? (
                    <DropdownMenuItem className="text-destructive" onClick={handleArchiver}>
                      <ArchiveRestore className="h-4 w-4 mr-2" />
                      {t.documents.desarchiver}
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem className="text-destructive" onClick={handleArchiver}>
                      <Archive className="h-4 w-4 mr-2" />
                      {t.documents.archiver}
                    </DropdownMenuItem>
                  )}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="max-w-3xl mx-auto">
        {doc.est_departement_origine === false && utilisateur?.est_admin !== true && (
          <div className="mb-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
            {t.documents.acces_externe} {t.documents.du_departement} {langue === 'en' ? (doc.departement_nom_en || doc.departement_nom) : doc.departement_nom}.
          </div>
        )}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <GroupIcon className="h-6 w-6 text-muted-foreground" />
            <h1 className="text-2xl font-bold break-words flex-1">{doc.titre}</h1>
          </div>
          <div className="flex justify-center">
            {renderPreview()}
          </div>

          {groupe === 'images' && panneauOcrOuvert && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 font-medium text-sm">
                    <ScanText className="h-4 w-4 text-primary" />
                    {t.documents.texte_extrait}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExtraireTexte}
                      disabled={extractionEnCours}
                    >
                      <ScanText className="h-4 w-4 mr-2" />
                      {extractionEnCours ? t.documents.extraction_en_cours : t.documents.extraire_texte}
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleCopier}
                      disabled={!texteOcr || extractionEnCours}
                    >
                      {copie ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                      {copie ? t.documents.copie : t.documents.copier}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setPanneauOcrOuvert(false);
                        setTexteOcr('');
                        setCopie(false);
                        setExtractionEnCours(false);
                      }}
                    >
                      {t.commun.annuler}
                    </Button>
                  </div>
                </div>
                <textarea
                  ref={textareaRef}
                  value={texteOcr}
                  onChange={(e) => setTexteOcr(e.target.value)}
                  readOnly={!texteOcr}
                  placeholder={extractionEnCours ? t.documents.extraction_en_cours : t.documents.aucun_texte_extrait}
                  className="w-full min-h-[160px] rounded-md border border-input bg-background px-3 py-2 text-sm font-mono leading-relaxed resize-y"
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {showDetails && doc && (
        <DetailsDocumentModal document={doc} onClose={() => setShowDetails(false)} />
      )}
      {showShareModal && doc && (
        <PartagerModal 
          document={doc} 
          onClose={() => setShowShareModal(false)} 
        />
      )}

      {/* ✅ AJOUT : Lightbox pour zoomer sur l'image */}
      {groupe === 'images' && (
        <ImageLightbox
          src={urlDoc}
          open={imageAgrandie}
          onClose={() => setImageAgrandie(false)}
        />
      )}
    </div>
  );
}