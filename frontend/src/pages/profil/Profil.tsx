import { useAuth } from '../../contexts/AuthContext';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { listerDocuments, type Document } from '../../api/documents';
import { 
  changerMotDePasse, 
  recupererProfil, 
  mettreAJourPhotoProfil, 
  activerTwoFA,
  getConfigurationConnexion,
  type ProfilResponse 
} from '../../api/auth';
import { useTranslation } from '../../i18n/useTranslation';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '../../components/ui/avatar';
import { Separator } from '../../components/ui/separator';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Switch } from '../../components/ui/switch';
import TableFooter from '../../components/TableFooter';
import { toast } from 'sonner';
import { User, Lock, FileText, History, Bell, Eye, EyeOff, Shield, Loader2 } from 'lucide-react';

const STATUT_VARIANT: Record<string, 'success' | 'destructive' | 'warning' | 'default'> = { 
  valide: 'success', rejete: 'destructive', en_attente: 'warning', en_cours: 'default' 
};

export default function Profil() {
  const { utilisateur } = useAuth();
  const { t, langue } = useTranslation();
  const [mesDocuments, setMesDocuments] = useState<Document[]>([]);
  const [profil, setProfil] = useState<ProfilResponse | null>(null);
  const [ancienMdp, setAncienMdp] = useState('');
  const [nouveauMdp, setNouveauMdp] = useState('');
  const [showAncien, setShowAncien] = useState(false);
  const [showNouveau, setShowNouveau] = useState(false);
  const [messageMdp, setMessageMdp] = useState('');
  const [messagePhoto, setMessagePhoto] = useState('');
  const [photoSelectionnee, setPhotoSelectionnee] = useState<File | null>(null);
  const [envoiPhoto, setEnvoiPhoto] = useState(false);
  const [notifEmail, setNotifEmail] = useState(true);
  const [pageHist, setPageHist] = useState(1);
  const [rowsHist, setRowsHist] = useState(5);
  
  // ✅ NOUVEAU : États pour le 2FA utilisateur
  const [twoFaObligatoireGlobal, setTwoFaObligatoireGlobal] = useState(false);
  const [chargementTwoFa, setChargementTwoFa] = useState(false);

  useEffect(() => {
    async function charger() {
      try {
        const [tous, monProfil, config] = await Promise.all([
          listerDocuments(), 
          recupererProfil(),
          getConfigurationConnexion()
        ]);
        if (utilisateur) setMesDocuments(tous.filter((doc) => doc.depose_par === utilisateur.id && doc.statut !== 'en_attente' && doc.statut !== 'en_cours'));
        setProfil(monProfil);
        setTwoFaObligatoireGlobal(config.two_fa_obligatoire);
      } catch { toast.error(t.commun.erreur); }
    }
    charger();
  }, [utilisateur]);

  async function gererChangementMdp(e: React.FormEvent) {
    e.preventDefault();
    setMessageMdp('');
    try {
      await changerMotDePasse(ancienMdp, nouveauMdp);
      setMessageMdp(t.profil.mdp_change);
      setAncienMdp(''); setNouveauMdp('');
      toast.success(t.profil.mdp_changed);
    } catch (erreur: unknown) {
      const err = erreur as { response?: { data?: { erreur?: string; nouveau_mot_de_passe?: string[] } } };
      setMessageMdp(err.response?.data?.erreur || err.response?.data?.nouveau_mot_de_passe?.[0] || t.commun.erreur);
    }
  }

  function gererSelectionPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const fichier = e.target.files?.[0];
    if (fichier) {
      setPhotoSelectionnee(fichier);
      setMessagePhoto('');
    }
  }

  async function gererUploadPhoto() {
    if (!photoSelectionnee) return;
    setEnvoiPhoto(true);
    setMessagePhoto(t.profil.envoi_photo);
    try {
      const resultat = await mettreAJourPhotoProfil(photoSelectionnee);
      setProfil(resultat);
      setPhotoSelectionnee(null);
      setMessagePhoto(t.profil.photo_mise_a_jour);
      toast.success(t.profil.photo_mise_a_jour);
    } catch (err: any) {
      const msg = err?.response?.data?.photo?.[0] || err?.message || t.profil.erreur_photo;
      setMessagePhoto(msg);
      toast.error(msg);
    } finally {
      setEnvoiPhoto(false);
    }
  }

  // ✅ NOUVEAU : Fonction pour toggler le 2FA utilisateur
  async function gererToggleTwoFa(actif: boolean) {
    setChargementTwoFa(true);
    try {
      const resultat = await activerTwoFA(actif);
      setProfil(resultat);
      toast.success(
        actif 
          ? t.profil.deux_fa_toast_oui 
          : t.profil.deux_fa_toast_non
      );
    } catch (error) {
      toast.error(t.commun.erreur);
    } finally {
      setChargementTwoFa(false);
    }
  }

  const initiales = utilisateur?.username?.slice(0, 2).toUpperCase() ?? '?';
  const twoFaActif = profil?.two_fa_active ?? false;
  const [params] = useSearchParams();
  const ongletInitial = params.get('onglet') === 'securite' ? 'securite' : 'infos';
  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">{t.profil.titre}</h1>
      <Tabs defaultValue={ongletInitial}>
        <TabsList>
          <TabsTrigger value="infos"><User className="h-4 w-4 mr-2" />{t.profil.infos}</TabsTrigger>
          <TabsTrigger value="securite"><Lock className="h-4 w-4 mr-2" />{t.profil.securite}</TabsTrigger>
          <TabsTrigger value="historique"><History className="h-4 w-4 mr-2" />{t.profil.historique}</TabsTrigger>
          <TabsTrigger value="notifications"><Bell className="h-4 w-4 mr-2" />{t.profil.notifications}</TabsTrigger>
        </TabsList>

        <TabsContent value="infos" className="space-y-4">
          <Card>
            <CardContent className="pt-6 space-y-6">
                <div className="flex items-center gap-4">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={profil?.photo ?? undefined} alt={t.profil.photo_de_profil} />
                    <AvatarFallback className="text-lg">{initiales}</AvatarFallback>
                  </Avatar>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" size="sm" className="relative" onClick={() => document.getElementById('photo')?.click()}>
                        {t.profil.changer_photo}
                      </Button>
                      <Input id="photo" type="file" accept="image/*" onChange={gererSelectionPhoto} className="hidden" />
                      {photoSelectionnee && (
                        <Button size="sm" onClick={gererUploadPhoto} disabled={envoiPhoto}>
                          {envoiPhoto ? t.profil.envoi_photo : t.profil.upload}
                        </Button>
                      )}
                    </div>
                    {photoSelectionnee && (
                      <p className="text-xs text-muted-foreground">{photoSelectionnee.name} ({(photoSelectionnee.size / 1024).toFixed(1)} Ko)</p>
                    )}
                    {messagePhoto && <p className="text-sm text-muted-foreground">{messagePhoto}</p>}
                  </div>
                </div>
              <Separator />
              <div className="space-y-2">
                <p><span className="font-medium">{t.profil.nom_utilisateur} :</span> {utilisateur?.username}</p>
                <p><span className="font-medium">{t.profil.email} :</span> {utilisateur?.email}</p>
                <p><span className="font-medium">{t.profil.role} :</span> {utilisateur?.est_admin ? t.profil.administrateur : t.profil.employe}</p>
                {!utilisateur?.est_admin && (
  <div className="pt-2">
    <p><span className="font-medium">{t.profil.departement_label}</span> {(() => { const n = profil?.departement?.nom ?? profil?.departement_nom; const n_en = profil?.departement?.nom_en ?? profil?.departement_nom_en; return langue === 'en' ? (n_en || n || '—') : (n || '—'); })()}</p>
  </div>
)}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="securite" className="space-y-4">
          {/* ✅ NOUVEAU : Card Double Authentification */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                {t.profil.deux_fa_titre}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border">
                <div className="flex-1 pr-4">
                  <Label htmlFor="two-fa-user" className="text-base font-semibold cursor-pointer">
                    {t.profil.deux_fa_activer}
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {twoFaObligatoireGlobal 
                      ? t.profil.deux_fa_force_admin
                      : t.profil.deux_fa_code_desc}
                  </p>
                </div>
                {chargementTwoFa ? (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                ) : (
                  <Switch
                    id="two-fa-user"
                    checked={twoFaActif || twoFaObligatoireGlobal}
                    onCheckedChange={gererToggleTwoFa}
                    disabled={twoFaObligatoireGlobal}
                  />
                )}
              </div>
            </CardContent>
          </Card>

          {/* Card existante : Changement de mot de passe */}
          <Card>
            <CardHeader><CardTitle>{t.profil.changer_mdp}</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={gererChangementMdp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="ancienMdp">{t.profil.ancien_mdp}</Label>
                  <div className="relative">
                    <Input id="ancienMdp" type={showAncien ? 'text' : 'password'} value={ancienMdp} onChange={(e) => setAncienMdp(e.target.value)} required className="pr-10" />
                    <button type="button" onClick={() => setShowAncien(!showAncien)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
                      {showAncien ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nouveauMdp">{t.profil.nouveau_mdp}</Label>
                  <div className="relative">
                    <Input id="nouveauMdp" type={showNouveau ? 'text' : 'password'} value={nouveauMdp} onChange={(e) => setNouveauMdp(e.target.value)} required minLength={8} className="pr-10" />
                    <button type="button" onClick={() => setShowNouveau(!showNouveau)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
                      {showNouveau ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                {messageMdp && <p className="text-sm text-muted-foreground">{messageMdp}</p>}
                <Button type="submit">{t.profil.changer_mdp}</Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historique">
          <Card>
            <CardHeader><CardTitle>{t.profil.mes_documents} ({mesDocuments.length})</CardTitle></CardHeader>
            <CardContent>
              {mesDocuments.length === 0 ? (
                <p className="text-muted-foreground">{t.profil.aucun_document}</p>
              ) : (
                <>
                  <div className="space-y-2">
                    {mesDocuments.slice((pageHist - 1) * rowsHist, pageHist * rowsHist).map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg border">
                        <div className="flex items-center gap-3 min-w-0">
                          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="truncate">{doc.titre}</span>
                        </div>
                        <Badge variant={STATUT_VARIANT[doc.statut] || 'default'}>
                          {(t.documents as Record<string, string>)[doc.statut] || doc.statut}
                        </Badge>
                      </div>
                    ))}
                  </div>
                  <TableFooter
                    currentPage={pageHist}
                    totalPages={Math.ceil(mesDocuments.length / rowsHist)}
                    rowsPerPage={rowsHist}
                    totalRows={mesDocuments.length}
                    onPageChange={setPageHist}
                    onRowsPerPageChange={(rows) => { setRowsHist(rows); setPageHist(1); }}
                  />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader><CardTitle>{t.profil.pref_notifications}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{t.profil.notif_email}</p>
                  <p className="text-sm text-muted-foreground">{t.profil.notif_email_desc}</p>
                </div>
                <Button variant={notifEmail ? 'default' : 'outline'} onClick={() => setNotifEmail(!notifEmail)}>
                  {notifEmail ? t.profil.active : t.profil.desactive}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}