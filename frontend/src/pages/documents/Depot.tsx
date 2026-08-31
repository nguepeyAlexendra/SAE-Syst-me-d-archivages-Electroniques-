import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { deposerDocument } from '../../api/documents';
import { listerDepartements, type DepartementType } from '../../api/admin';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../i18n/useTranslation';
import usePipelinePolling from '../../hooks/usePipelinePolling';
import UploadProgressModal from '../../components/UploadProgressModal';
import ScannerDialog from '../../components/ScannerDialog';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Progress } from '../../components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Upload, FileText, Image, Video, Music, ScanLine } from 'lucide-react';
import { toast } from 'sonner';
import TagSelector from '../../components/ui/TagSelector';

const CONFIG_BASE: Record<string, { validExtensions: string[]; mimesBackend: string[] }> = {
  documents: {
    validExtensions: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv', '.rtf', '.odt', '.ods', '.odp'],
    mimesBackend: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'text/plain', 'text/csv', 'application/rtf', 'text/rtf', 'application/vnd.oasis.opendocument.text', 'application/vnd.oasis.opendocument.spreadsheet', 'application/vnd.oasis.opendocument.presentation'],
  },
  images: {
    validExtensions: ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tiff', '.tif', '.heic', '.heif'],
    mimesBackend: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp', 'image/tiff', 'image/tif', 'image/heic', 'image/heif', 'application/zip'],
  },
  medias: {
    validExtensions: ['.mp4', '.mov', '.mp3', '.wav', '.m4a', '.mkv', '.avi', '.ogg'],
    mimesBackend: ['video/mp4', 'video/quicktime', 'video/x-matroska', 'video/x-msvideo', 'audio/mpeg', 'audio/wav', 'audio/wave', 'audio/x-wav', 'audio/mp4', 'audio/x-m4a', 'audio/ogg'],
  }
};

const GROUPE_ICONE: Record<string, React.ElementType> = { documents: FileText, images: Image, medias: Video };

interface DepotProps { typeCible?: 'documents' | 'images' | 'medias'; }

export default function Depot({ typeCible = 'documents' }: DepotProps) {
  const navigate = useNavigate();
  const { t, langue } = useTranslation();
  const { utilisateur } = useAuth();

  const config = CONFIG_BASE[typeCible] || CONFIG_BASE.documents;
  const Icone = GROUPE_ICONE[typeCible] || FileText;

  const [titre, setTitre] = useState('');
  const [fichier, setFichier] = useState<File | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [departements, setDepartements] = useState<DepartementType[]>([]);
  const [departement, setDepartement] = useState('');
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [documentDepose, setDocumentDepose] = useState<{ id: number; titre: string } | null>(null);
  const [erreur, setErreur] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [notificationAffichee, setNotificationAffichee] = useState(false);
  const [showScannerDialog, setShowScannerDialog] = useState(false);
  const estAdmin = utilisateur?.est_admin === true;

  const titrePage = typeCible === 'images' ? t.depot.deposer_image_title : typeCible === 'medias' ? t.depot.deposer_media_title : t.depot.titre;
  const texteAide = typeCible === 'images' ? t.depot.formats_images_detail : typeCible === 'medias' ? t.depot.formats_medias_detail : t.depot.formats_docs_detail;

  const { document: docPipeline } = usePipelinePolling(documentDepose?.id ?? null);

  useEffect(() => {
    listerDepartements().then(setDepartements).catch(() => {});
  }, []);

  useEffect(() => {
    if (!docPipeline || !documentDepose || notificationAffichee) return;
    const statut = docPipeline.statut?.toLowerCase();
    if (statut === 'valide' || statut === 'termine') {
      toast.success(`"${documentDepose.titre}" ${t.depot.valide_succes}`);
      setNotificationAffichee(true);
    } else if (statut === 'rejete') {
      const cause = docPipeline.cause_rejet ? (docPipeline.cause_rejet_en || docPipeline.cause_rejet) : t.documents.format_non_autorise;
      toast.error(`${t.depot.rejete_cause}${cause}`);
      setNotificationAffichee(true);
    }
  }, [docPipeline, documentDepose, notificationAffichee, t]);

  function estFichierValidePourLeContexte(file: File): boolean {
    const fileName = file.name.toLowerCase();
    const fileType = file.type.toLowerCase();
    const ext = '.' + fileName.split('.').pop();
    if (config.validExtensions.includes(ext)) return true;
    if (config.mimesBackend.includes(fileType)) return true;
    return false;
  }

  function gererFichier(f: File) {
    if (!estFichierValidePourLeContexte(f)) {
      setFichier(null);
      const ext = '.' + f.name.toLowerCase().split('.').pop();
      const fileType = f.type.toLowerCase();
      let formulaireRecommande = t.depot.documents_label;
      if (CONFIG_BASE.images.validExtensions.includes(ext) || CONFIG_BASE.images.mimesBackend.includes(fileType)) {
        formulaireRecommande = t.depot.images_label;
      } else if (CONFIG_BASE.medias.validExtensions.includes(ext) || CONFIG_BASE.medias.mimesBackend.includes(fileType)) {
        formulaireRecommande = t.depot.medias_label;
      }
      const message = `${t.depot.fichier_non_accepte} ${t.depot.deposer} ${formulaireRecommande}.`;
      setErreur(message);
      toast.error(message);
      return;
    }
    setFichier(f);
    if (!titre) setTitre(f.name);
    setErreur('');
  }

  function gererSelectionFichier(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) gererFichier(f);
    e.target.value = '';
  }

  function gererDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) gererFichier(f);
  }

  async function gererEnvoi(e: React.MouseEvent) {
    e.preventDefault();
    if (!fichier) { setErreur(t.depot.veuillez_selectionner_fichier); return; }
    if (estAdmin && !departement) { setErreur(t.depot.veuillez_selectionner_departement); return; }
    if (!estFichierValidePourLeContexte(fichier)) {
      setErreur(t.depot.fichier_non_accepte);
      setFichier(null);
      return;
    }
    setErreur('');
    setEnvoiEnCours(true);
    setDocumentDepose(null);
    setNotificationAffichee(false);
    try {
      const departementId = estAdmin ? Number(departement) : (utilisateur?.departement?.id ?? null);
      if (!departementId) {
        setErreur(t.depot.aucun_departement);
        setEnvoiEnCours(false);
        return;
      }
      const resultat = await deposerDocument(titre || fichier.name, fichier, 'numerique', departementId, typeCible, tags);
      setDocumentDepose(resultat);
      setShowProgressModal(true);
    } catch {
      setErreur(t.depot.erreur_depot);
      toast.error(t.depot.erreur_depot_titre);
    } finally {
      setEnvoiEnCours(false);
    }
  }

  function reinitialiser() {
    setTitre(''); setFichier(null); setTags([]); setDocumentDepose(null); setErreur('');
    setShowProgressModal(false); setNotificationAffichee(false);
  }

  function gererScanDepose(doc: { id: number; titre: string }) {
    setDocumentDepose(doc);
    setShowProgressModal(true);
  }

  const IconeFichier = fichier ? (fichier.type.startsWith('audio/') ? Music : Icone) : Icone;

  const departementSelectionne = estAdmin ? Number(departement) : (utilisateur?.departement?.id ?? null);
  const peutScanner = typeCible !== 'medias' && departementSelectionne && !envoiEnCours;

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icone className="h-5 w-5 text-primary" />
            {titrePage}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {!documentDepose ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="titre">{t.depot.titre_document}</Label>
                <Input id="titre" value={titre} onChange={(e) => setTitre(e.target.value)} placeholder={t.depot.optionnel} />
              </div>
              {estAdmin && (
                <div className="space-y-2">
                  <Label htmlFor="departement">{t.depot.departement} <span className="text-destructive">*</span></Label>
                  <Select value={departement} onValueChange={setDepartement}>
                    <SelectTrigger><SelectValue placeholder={t.depot.selectionner_departement} /></SelectTrigger>
                    <SelectContent>
                      {departements.map((d) => (
                        <SelectItem key={d.id} value={String(d.id)}>{langue === 'en' ? (d.nom_en || d.nom) : d.nom}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="tags">{t.documents.tags_optionnel}</Label>
                <TagSelector 
                  selectedTags={tags} 
                  onTagsChange={setTags} 
                />
              </div>

              <div
                onDrop={gererDrop}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
                  dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                }`}
                onClick={() => document.getElementById('fichier-input')?.click()}
              >
                <input id="fichier-input" type="file" className="hidden" onChange={gererSelectionFichier} />
                {fichier ? (
                  <div className="space-y-2">
                    <IconeFichier className="h-12 w-12 mx-auto text-primary" />
                    <p className="font-medium">{fichier.name}</p>
                    <p className="text-sm text-muted-foreground">{(fichier.size / 1024 / 1024).toFixed(2)} Mo</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
                    <p className="text-muted-foreground">{t.depot.glisser_deposer_texte}</p>
                    <p className="text-xs text-muted-foreground font-medium">
                      {t.documents.formats_acceptes}{texteAide}
                    </p>
                  </div>
                )}
              </div>
              {erreur && <p className="text-sm text-destructive text-center font-medium bg-destructive/10 p-2 rounded">{erreur}</p>}
              {envoiEnCours && <Progress value={66} className="w-full" />}
              
              <div className="flex gap-2">
                <Button onClick={gererEnvoi} disabled={envoiEnCours || !fichier} className="flex-1">
                  {envoiEnCours ? t.depot.envoi_en_cours : t.depot.deposer_fichier}
                </Button>
                {typeCible !== 'medias' && (
                  <Button 
                    variant="outline" 
                    onClick={() => setShowScannerDialog(true)}
                    disabled={!peutScanner}
                    className="flex-1"
                    title={!departementSelectionne ? (estAdmin ? t.depot.veuillez_selectionner_departement : '') : ''}
                  >
                    <ScanLine className="h-4 w-4 mr-2" />
                    {typeCible === 'images' ? 'Scanner (1 page)' : 'Scanner'}
                  </Button>
                )}
              </div>
            </>
          ) : (
            <div className="space-y-4 text-center py-8">
              <IconeFichier className="h-16 w-16 mx-auto text-green-600" />
              <h2 className="text-xl font-semibold">{documentDepose.titre}</h2>
              <p className="text-sm text-muted-foreground">{t.depot.progression}</p>
              <div className="flex gap-4 justify-center pt-4">
                <Button onClick={reinitialiser} variant="outline">{t.depot.deposer_autre_fichier}</Button>
                <Button onClick={() => navigate(`/documents/${documentDepose.id}`)}>{t.depot.voir_detail_btn}</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      {documentDepose && (
        <UploadProgressModal isOpen={showProgressModal} onClose={() => setShowProgressModal(false)} documentId={documentDepose.id} fileName={documentDepose.titre} />
      )}
      
      {typeCible !== 'medias' && (
        <ScannerDialog
          mode={typeCible}
          open={showScannerDialog}
          onClose={() => setShowScannerDialog(false)}
          onScanDepose={gererScanDepose}
          departementId={departementSelectionne!}
          titre={titre}
        />
      )}
    </div>
  );
}