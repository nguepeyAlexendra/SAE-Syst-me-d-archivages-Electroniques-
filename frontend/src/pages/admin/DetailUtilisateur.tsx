import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { listerUtilisateurs, reinitialiserMotDePasse, type Utilisateur } from '../../api/admin';
import { useTranslation } from '../../i18n/useTranslation';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../../components/ui/avatar';
import { Separator } from '../../components/ui/separator';
import { toast } from 'sonner';
import { ArrowLeft, KeyRound, Loader2, Copy, Check, Monitor, Shield, ShieldOff, Ban } from 'lucide-react';

export default function DetailUtilisateur() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, langue } = useTranslation();
  const [utilisateur, setUtilisateur] = useState<Utilisateur | null>(null);
  const [chargement, setChargement] = useState(true);
  const [reinitialisant, setReinitialisant] = useState(false);
  const [mdpTemporaire, setMdpTemporaire] = useState('');
  const [nouveauMdp, setNouveauMdp] = useState('');
  const [copie, setCopie] = useState(false);

  useEffect(() => {
    async function charger() {
      try {
        const tous = await listerUtilisateurs();
        const trouve = tous.find((u) => String(u.id) === id) || null;
        setUtilisateur(trouve);
      } catch {
        toast.error(t.commun.erreur);
      } finally {
        setChargement(false);
      }
    }
    charger();
  }, [id, t]);

  async function handleReinitialiser(e: React.FormEvent) {
    e.preventDefault();
    if (!utilisateur) return;
    setReinitialisant(true);
    setMdpTemporaire('');
    try {
      const resultat = await reinitialiserMotDePasse(utilisateur.id, nouveauMdp || undefined);
      setMdpTemporaire(resultat.mot_de_passe);
      setNouveauMdp('');
      toast.success(resultat.message || t.admin.mdp_reinitialise);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { erreur?: string } } };
      toast.error(axiosErr?.response?.data?.erreur || t.commun.erreur);
    } finally {
      setReinitialisant(false);
    }
  }

  async function copierMdp() {
    try {
      await navigator.clipboard.writeText(mdpTemporaire);
      setCopie(true);
      toast.success(t.admin.mdp_copie);
      setTimeout(() => setCopie(false), 2000);
    } catch {
      toast.error(t.admin.copie_impossible);
    }
  }

  if (chargement) return <p className="p-8">{t.commun.charger}</p>;

  if (!utilisateur) {
    return (
      <div className="p-8 max-w-2xl mx-auto space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/utilisateurs')}>
          <ArrowLeft className="h-4 w-4 mr-2" />{t.commun.retour}
        </Button>
        <div className="rounded-md bg-muted p-8 text-center text-muted-foreground">{t.admin.utilisateur_introuvable}</div>
      </div>
    );
  }

  const initiales = utilisateur.username.slice(0, 2).toUpperCase();
  const deptNom = utilisateur.departement?.nom ?? '—';

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/admin/utilisateurs')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">{t.admin.profil_utilisateur}</h1>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={utilisateur.photo ?? undefined} />
              <AvatarFallback className="text-lg">{initiales}</AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-lg font-semibold">{utilisateur.username}</p>
                {utilisateur.est_admin ? <Badge variant="default">{t.admin.admin}</Badge> : <Badge variant="secondary">{t.admin.personnel}</Badge>}
              </div>
              <p className="text-sm text-muted-foreground">{utilisateur.est_actif === false ? t.admin.inactif : t.admin.actif}</p>
            </div>
          </div>
          <Separator />
          <div className="space-y-2">
            <p><span className="font-medium">{t.admin.email} :</span> {utilisateur.email}</p>
            <p><span className="font-medium">{t.admin.departement_nom} :</span> {langue === 'en' ? (utilisateur.departement?.nom || deptNom) : deptNom}</p>
            <p><span className="font-medium">{t.admin.role} :</span> {utilisateur.est_admin ? t.admin.admin : t.admin.personnel}</p>
          </div>
          {utilisateur.appareils && utilisateur.appareils.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="font-medium mb-2 flex items-center gap-2"><Monitor className="h-4 w-4 text-muted-foreground" />{t.admin.utilisateurs_appareils}</p>
                <div className="space-y-1">
                  {utilisateur.appareils.map((a, i) => (
                    <div key={i} className="text-xs text-muted-foreground border-l-2 pl-2 ml-1">
                      <p className="truncate" title={a.user_agent}>{a.user_agent}</p>
                      <p className="text-[10px]">IP: {a.ip_address} &middot; {new Date(a.date_connexion).toLocaleDateString()}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            {t.admin.reinitialiser_mdp}
          </CardTitle>
          <CardDescription>{t.admin.mdp_genere_email}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleReinitialiser} className="space-y-4">
            <div className="space-y-2">
              <Label>{t.admin.mdp_personnalise_optional}</Label>
              <Input
                type="password"
                value={nouveauMdp}
                onChange={(e) => setNouveauMdp(e.target.value)}
                placeholder={t.admin.mdp_laisser_vide}
                minLength={8}
              />
            </div>
            <Button type="submit" disabled={reinitialisant}>
              {reinitialisant ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <KeyRound className="h-4 w-4 mr-2" />}
              {t.admin.reinitialiser_mdp}
            </Button>
          </form>

          {mdpTemporaire && (
            <div className="mt-4 rounded-md bg-green-50 dark:bg-green-950 p-4 space-y-3">
              <p className="text-sm font-medium text-green-800 dark:text-green-200">{t.admin.mdp_reinitialise}</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded border bg-background px-3 py-2 font-mono text-sm tracking-wider break-all">{mdpTemporaire}</code>
                <Button variant="outline" size="icon" onClick={copierMdp} title={t.admin.mdp_copie}>
                  {copie ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">{t.admin.mdp_envoye_email}</p>
            </div>
          )}

          <div className="mt-6 pt-4 border-t flex items-center justify-between">
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              {utilisateur.est_admin ? <Shield className="h-4 w-4" /> : <ShieldOff className="h-4 w-4" />}
              {utilisateur.est_admin ? t.admin.admin : t.admin.personnel}
            </div>
            {utilisateur.est_actif === false && (
              <Badge variant="destructive"><Ban className="h-3 w-3 mr-1" />{t.admin.inactif}</Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}