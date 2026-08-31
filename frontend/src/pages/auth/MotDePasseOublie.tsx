import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motDePasseOublie, confirmerMotDePasseOublie } from '../../api/auth';
import { useTranslation } from '../../i18n/useTranslation';
import { useTheme } from '../../components/ThemeProvider';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { ArrowLeft, Mail, Key, Lock, Loader2, Moon, Sun, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function MotDePasseOublie() {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();

  const [etape, setEtape] = useState<'email' | 'code' | 'succes'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [nouveauMdp, setNouveauMdp] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');

  async function handleEnvoyerCode(e: React.FormEvent) {
    e.preventDefault();
    setErreur('');
    setEnCours(true);
    try {
      await motDePasseOublie(email);
      setEtape('code');
      toast.success(t.auth.code_envoye_si_email_existe);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { erreur?: string[] | string } } };
      const data = axiosErr?.response?.data;
      const msg = Array.isArray(data?.erreur) ? data.erreur[0] : data?.erreur || t.commun.erreur;
      setErreur(msg);
    } finally { setEnCours(false); }
  }

  async function handleChangerMdp(e: React.FormEvent) {
    e.preventDefault();
    setErreur('');
    if (nouveauMdp.length < 8) { setErreur(t.auth.mdp_8_caracteres); return; }
    if (nouveauMdp !== confirmation) { setErreur(t.auth.mdp_non_correspondent); return; }
    setEnCours(true);
    try {
      await confirmerMotDePasseOublie(email, code, nouveauMdp);
      setEtape('succes');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { erreur?: string[] | string } } };
      const data = axiosErr?.response?.data;
      const msg = Array.isArray(data?.erreur) ? data.erreur[0] : data?.erreur || t.commun.erreur;
      setErreur(msg);
    } finally { setEnCours(false); }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/30 p-4 relative">
      <Button variant="ghost" size="icon" className="absolute top-4 right-4" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
        {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </Button>
      <Card className="w-full max-w-sm shadow-lg">
        <CardHeader className="space-y-2 text-center pb-2">
          <CardTitle className="text-2xl">{t.auth.mot_de_passe_oublie || 'Mot de passe oublié'}</CardTitle>
          <p className="text-sm text-muted-foreground">{t.auth.sae}</p>
        </CardHeader>
        <CardContent>
          {etape === 'succes' ? (
            <div className="space-y-4 text-center">
              <CheckCircle className="h-12 w-12 mx-auto text-green-600" />
              <p className="text-sm text-muted-foreground">{t.auth.mdp_reinitialise || 'Mot de passe réinitialisé avec succès.'}</p>
              <Button className="w-full" onClick={() => navigate('/connexion')}>{t.auth.se_connecter}</Button>
            </div>
          ) : etape === 'code' ? (
            <form onSubmit={handleChangerMdp} className="space-y-4">
              <div className="space-y-2">
                <Label>{t.auth.code_reinitialisation || 'Code de réinitialisation'}</Label>
                <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" required maxLength={6} className="text-center text-lg tracking-widest" />
              </div>
              <div className="space-y-2">
                <Label>{t.auth.nouveau_mdp}</Label>
                <div className="relative">
                  <Input type="password" value={nouveauMdp} onChange={(e) => setNouveauMdp(e.target.value)} required minLength={8} className="pr-10" />
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t.auth.confirmer_mdp}</Label>
                <Input type="password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} required minLength={8} />
              </div>
              {erreur && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{erreur}</div>}
              <Button type="submit" className="w-full" disabled={enCours}>
                {enCours && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {t.auth.changer_mdp}
              </Button>
              <Button variant="link" size="sm" className="w-full" onClick={() => setEtape('email')}>
                {t.commun.annuler || 'Annuler'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleEnvoyerCode} className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Button variant="ghost" size="icon" onClick={() => navigate('/connexion')}><ArrowLeft className="h-4 w-4" /></Button>
                <p className="text-sm text-muted-foreground">{t.auth.saisir_email_reset || 'Saisissez votre email pour recevoir un code de réinitialisation.'}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">{t.auth.email}</Label>
                <div className="relative">
                  <Input id="email" type="email" value={email} onChange={(e) => { setEmail(e.target.value); setErreur(''); }} placeholder="vous@entreprise.com" required autoFocus className="pr-10" />
                  <Mail className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                </div>
              </div>
              {erreur && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{erreur}</div>}
              <Button type="submit" className="w-full" disabled={enCours || !email}>
                {enCours ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Key className="h-4 w-4 mr-2" />}
                {enCours ? t.commun.charger : (t.auth.envoyer_code || 'Envoyer le code')}
              </Button>
              <Button variant="link" size="sm" className="w-full" onClick={() => navigate('/connexion')}>
                {t.auth.se_connecter}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
