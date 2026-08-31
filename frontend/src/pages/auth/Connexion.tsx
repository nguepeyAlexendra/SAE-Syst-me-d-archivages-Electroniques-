import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from '../../i18n/useTranslation';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../components/ThemeProvider';
import apiClient from '../../api/client';
import { toast } from 'sonner';
import { Languages, Sun, Moon, Eye, EyeOff, ArrowRight, CheckCircle, Info, Archive, Lock, FileCheck, Search, Workflow } from 'lucide-react';

export default function Connexion() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, langue, definirLangue } = useTranslation();
  const { seConnecter, utilisateur } = useAuth();
  const { theme, setTheme } = useTheme();

  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [afficherMdp, setAfficherMdp] = useState(false);
  const [chargement, setChargement] = useState(false);
  const [domaineOk, setDomaineOk] = useState(false);
  const [verifEnCours, setVerifEnCours] = useState(false);
  const mdpRef = useRef<HTMLInputElement>(null);

  // Repli local si l'endpoint backend est injoignable
  const DOMAINES_LOCAUX = ['@dta-alliance.com', '@gmail.com'];

  // ✅ Textes bilingues AVEC repli : plus jamais de crash si une clé manque dans fr.ts/en.ts
  const auth: any = t.auth;
  const texte = (cle: string, fr: string, en: string) => auth[cle] || (langue === 'fr' ? fr : en);

  // Rediriger si déjà connecté
  useEffect(() => {
    if (utilisateur) navigate('/dashboard', { replace: true });
  }, [utilisateur, navigate]);

    // ✅ Vérification du domaine via le VRAI endpoint backend
     // ✅ Vérification intelligente : LOCAL d'abord, backend seulement si besoin
  const [verificationFaite, setVerificationFaite] = useState(false);

  useEffect(() => {
    const v = email.trim().toLowerCase();

    // 1. Email vide ou incomplet → reset
    if (!v.includes('@')) {
      setDomaineOk(false);
      setVerificationFaite(false);
      return;
    }

    // 2. Extraction du domaine
    const domaine = '@' + v.split('@').slice(1).join('@');

    // 3. ✅ D'ABORD vérifier localement (instantané, zéro appel API)
    if (DOMAINES_LOCAUX.some(d => d.toLowerCase() === domaine.toLowerCase())) {
      setDomaineOk(true);
      setVerificationFaite(true);
      setVerifEnCours(false);
      return;
    }

    // 4. Format email pas encore valide (ex: "emma@dta-alliance.c") → attendre
    const emailValide = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
    if (!emailValide) {
      setDomaineOk(false);
      setVerificationFaite(false);
      return;
    }

    // 5. Email complet mais domaine inconnu → appeler le backend
    const timer = setTimeout(async () => {
      setVerifEnCours(true);
      try {
        const res = await apiClient.post('/auth/verifier-email/', { email: v });
        const d = res.data || {};
        const val = d.autorise ?? d.autorisee ?? d.valide ?? d.ok ?? d.success ?? d.email_autorise ?? d.est_autorise;
        setDomaineOk(val === true);
        setVerificationFaite(true);
      } catch {
        setDomaineOk(false);
        setVerificationFaite(true);
      } finally {
        setVerifEnCours(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [email]);
  const montrerBlocMdp = domaineOk;
  const montrerIndice = email.includes('@') && !verifEnCours;
  // Focus auto sur le mot de passe quand le domaine devient valide
  useEffect(() => {
    if (montrerBlocMdp && mdpRef.current) {
      const timer = setTimeout(() => mdpRef.current?.focus(), 400);
      return () => clearTimeout(timer);
    }
  }, [montrerBlocMdp]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!domaineOk) {
      toast.error(t.auth.email_non_autorise);
      return;
    }
    if (!motDePasse) {
      toast.error(texte('mdp_requis', 'Veuillez saisir votre mot de passe', 'Please enter your password'));
      return;
    }

    setChargement(true);
    try {
      const trusted = localStorage.getItem('sae_trusted_device') || undefined;
      const res = await apiClient.post('/auth/connexion/', {
        email,
        password: motDePasse,
        ...(trusted ? { trusted_device_token: trusted } : {}),
      });
                  const data = res.data;

      // ✅ Admin avec 2FA requise
      if (data.status === '2fa_required') {
        toast.info(`${t.auth.code_envoye} ${email}`);
        navigate('/2fa', { 
          state: { email, temp_token: data.temp_token }, 
          replace: true 
        });
        return;   // ← IMPORTANT : ne pas continuer vers le bloc suivant
      }

      // Connexion réussie (utilisateur normal)
      if (data.token && data.utilisateur) {
        seConnecter(data.token, data.utilisateur);
        if (data.changement_mdp_obligatoire) {
          toast.info(t.auth.changement_mdp_obligatoire);
          navigate('/profil?onglet=securite', { replace: true });
        } else {
          const from = (location.state as any)?.from || '/dashboard';
          navigate(from, { replace: true });
        }
        return;
      }

      toast.error(t.commun.erreur);
    } catch (err: any) {
      toast.error(err?.response?.data?.erreur || err?.response?.data?.detail || t.auth.identifiants_incorrects);
    } finally {
      setChargement(false);
    }
  };

  return (
    <>
      <style>{`
        :root {
          --or:#C9A227; --or-fonce:#b28f1f;
          --creme:#FBF7EE; --papier:#F0EDE8;
          --encre:#2E2A22; --encre2:#3a352c;
          --muted:#78716c; --texte-doux:#a8a29e;
          --bord-or:rgba(201,162,39,.5);
          --vert:#3f8f5f; --rouge:#b3402a;
        }
        /* ---- Mode sombre ---- */
        .dark {
          --or:#d8b23e; --or-fonce:#e6c15e;
          --creme:#211f17; --papier:#15140f;
          --encre:#f2ecdc; --encre2:#e5ddc8;
          --muted:#a89f8c; --texte-doux:#8b8371;
          --bord-or:rgba(216,178,62,.45);
          --vert:#5bb87a; --rouge:#e07a6a;
        }
        .dark .sae-login-body { background: var(--papier); }
        .dark .sae-carte { background: var(--creme); border-color: var(--bord-or); }
        .dark .sae-logo { color: var(--encre); }
        .dark .sae-langue { background:#2a2820; border-color: var(--bord-or); }
        .dark .sae-langue button { color: var(--texte-doux); }
        .dark .sae-langue button:hover { color: var(--encre); }
        .dark .sae-langue button.sae-actif { background: var(--or); color:#15140f; }
        .dark .sae-milieu h1 { color: var(--encre); }
        .dark .sae-sous-titre { color: var(--muted); }
        .dark .sae-champ input { background:#1b1913; border-color: var(--bord-or); color: var(--encre); }
        .dark .sae-champ input::placeholder { color: var(--texte-doux); }
        .dark .sae-champ input:focus { background:#26241b; border-color: var(--or); box-shadow:0 0 0 4px rgba(216,178,62,.15); }
        .dark .sae-indice { color: var(--rouge); }
        .dark .sae-indice.sae-ok { color: var(--vert); }
        .dark .sae-oeil { color: var(--texte-doux); }
        .dark .sae-oeil:hover { color: var(--encre); }
        .dark .sae-btn { background: var(--or); color:#15140f; }
        .dark .sae-btn:hover:not(:disabled) { background: var(--or-fonce); }
        .dark .sae-copyright { color: var(--texte-doux); }
        .dark .sae-verre { background:rgba(21,20,15,.55); border-color:rgba(242,236,220,.18); }
        .dark .sae-verre p { color:rgba(242,236,220,.72); }
        .dark .sae-carre { background:rgba(46,42,34,.55); }
        .dark .sae-point { background:rgba(46,42,34,.85); }
        .dark .sae-theme-btn { color: var(--texte-doux); }
        .dark .sae-theme-btn:hover { color: var(--or); }
        .sae-login-body { font-family:'Inter',sans-serif; background:var(--papier); min-height:100vh; display:flex; align-items:center; justify-content:center; overflow:hidden; position:relative; padding:24px; }
        .sae-forme { position:fixed; z-index:0; animation:sae-flotter 9s ease-in-out infinite; }
        .sae-carre { background:rgba(255,253,249,.7); border-radius:24px; }
        .sae-losange { background:rgba(201,162,39,.25); border-radius:6px; transform:rotate(45deg); }
        .sae-point { background:rgba(255,253,249,.9); border-radius:50%; }
        .sae-f1{width:130px;height:130px;top:-40px;left:36%;rotate:14deg}
        .sae-f2{width:70px;height:70px;top:10%;right:5%;rotate:-12deg;animation-delay:1.2s}
        .sae-f3{width:26px;height:26px;top:24%;left:7%;animation-delay:.6s}
        .sae-f4{width:14px;height:14px;top:58%;right:9%;animation-delay:2s}
        .sae-f5{width:95px;height:95px;bottom:6%;left:3%;rotate:10deg;animation-delay:1.6s}
        .sae-f6{width:10px;height:10px;top:14%;left:16%;animation-delay:2.4s}
        .sae-f7{width:22px;height:22px;bottom:24%;right:16%;animation-delay:.9s}
        .sae-slash{position:fixed;bottom:7%;right:4%;width:7px;height:52px;border-radius:4px;background:rgba(201,162,39,.5);rotate:22deg;z-index:0}
        .sae-slash2{right:6.5%;height:40px;background:rgba(201,162,39,.32)}
        @keyframes sae-flotter{0%,100%{translate:0 0}50%{translate:0 -16px}}
        @keyframes sae-apparaitre{from{opacity:0;transform:translateY(26px) scale(.98)}to{opacity:1;transform:none}}
        @keyframes sae-spin{to{transform:rotate(360deg)}}
        @keyframes sae-verreFlotte{0%,100%{transform:translateY(-50%)}50%{transform:translateY(calc(-50% - 10px))}}

        .sae-carte{position:relative;z-index:1;width:min(1060px,96vw);min-height:640px;background:var(--creme);border-radius:28px;overflow:hidden;display:grid;grid-template-columns:480px 1fr;box-shadow:0 30px 70px rgba(46,42,34,.16);border:1.5px solid var(--or);animation:sae-apparaitre .9s cubic-bezier(.2,.7,.3,1) both}
        .sae-gauche{padding:44px 60px;display:flex;flex-direction:column;text-align:center}
        .sae-gauche>*{animation:sae-apparaitre .7s both}
        .sae-gauche>*:nth-child(1){animation-delay:.15s}
        .sae-gauche>*:nth-child(2){animation-delay:.25s}
        .sae-gauche>*:nth-child(3){animation-delay:.35s}
        .sae-haut{display:flex;align-items:center;justify-content:space-between}
        .sae-logo{display:flex;align-items:center;gap:10px;text-decoration:none;font-family:'Playfair Display',serif;font-size:22px;font-weight:700;color:var(--encre)}
        .sae-logo-img{width:40px;height:40px;object-fit:contain;border-radius:10px}
        .sae-langue{display:flex;align-items:center;gap:6px;background:#f6f0e2;border:1px solid var(--bord-or);border-radius:999px;padding:5px 10px}
        .sae-langue>svg{width:14px;height:14px;color:var(--or-fonce)}
        .sae-langue button{border:none;background:none;cursor:pointer;font:600 11px 'Inter',sans-serif;color:var(--texte-doux);padding:3px 8px;border-radius:999px;transition:all .25s ease}
        .sae-langue button:hover{color:var(--encre)}
        .sae-langue button.sae-actif{background:var(--or);color:var(--encre);box-shadow:0 2px 8px rgba(201,162,39,.35)}
        .sae-actions{display:flex;align-items:center;gap:8px}
        .sae-theme-btn{display:flex;align-items:center;justify-content:center;background:#f6f0e2;border:1px solid var(--bord-or);border-radius:999px;padding:6px;cursor:pointer;color:var(--or-fonce);transition:all .25s ease}
        .sae-theme-btn:hover{color:var(--encre)}
        .sae-theme-btn svg{width:14px;height:14px}
        .sae-milieu{flex:1;display:flex;flex-direction:column;justify-content:center;padding:24px 0}
        .sae-milieu h1{font-family:'Playfair Display',serif;font-size:34px;color:var(--encre);margin-bottom:14px}
        .sae-sous-titre{font-size:13px;color:var(--muted);line-height:1.65;max-width:320px;margin:0 auto 34px}
        .sae-form{display:flex;flex-direction:column;text-align:left}
        .sae-champ{margin-bottom:14px}
        .sae-champ input{width:100%;padding:15px 18px;background:#fdfaf3;border:1px solid var(--bord-or);border-radius:10px;font:400 13px 'Inter',sans-serif;color:var(--encre);transition:all .25s ease;outline:none}
        .sae-champ input::placeholder{color:var(--texte-doux)}
        .sae-champ input:focus{background:#fff;border-color:var(--or);box-shadow:0 0 0 4px rgba(201,162,39,.15)}
        .sae-indice{display:none;font-size:11px;color:var(--rouge);margin-top:6px;align-items:center;gap:6px}
        .sae-indice.sae-visible{display:flex;animation:sae-apparaitre .4s both}
        .sae-indice svg{width:12px;height:12px;flex:none}
        .sae-indice .sae-ic-ok{display:none}
        .sae-indice.sae-ok{color:var(--vert)}
        .sae-indice.sae-ok .sae-ic-ok{display:block}
        .sae-indice.sae-ok .sae-ic-ko{display:none}
        .sae-bloc-mdp{max-height:0;opacity:0;margin-bottom:0;overflow:hidden;transition:all .5s ease}
        .sae-bloc-mdp.sae-visible{max-height:200px;opacity:1;margin-bottom:14px}
        .sae-champ-relatif{position:relative}
        .sae-champ-relatif input{padding-right:42px}
        .sae-oeil{position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;padding:6px;color:var(--texte-doux);border-radius:6px;transition:color .2s}
        .sae-oeil:hover{color:var(--encre)}
        .sae-oeil svg{width:15px;height:15px}
        .sae-oeil .sae-cacher{display:none}
        .sae-oeil.sae-actif .sae-voir{display:none}
        .sae-oeil.sae-actif .sae-cacher{display:block}
        .sae-btn{margin-top:14px;width:100%;padding:15px;background:var(--or);color:var(--encre);border:none;border-radius:10px;cursor:pointer;font:600 13px 'Inter',sans-serif;letter-spacing:.4px;display:flex;align-items:center;justify-content:center;gap:8px;transition:all .25s ease}
        .sae-btn:disabled{opacity:.6;cursor:not-allowed}
        .sae-btn svg{width:16px;height:16px;transition:transform .25s ease}
        .sae-btn:hover:not(:disabled){background:var(--or-fonce);transform:translateY(-2px);box-shadow:0 14px 28px rgba(201,162,39,.35)}
        .sae-btn:hover:not(:disabled) svg{transform:translateX(4px)}
        .sae-btn:active:not(:disabled){transform:translateY(0)}
        .sae-copyright{font-size:10px;color:var(--texte-doux);margin-top:26px}
        .sae-droite{position:relative;overflow:hidden;background:linear-gradient(155deg,#26221b 0%,#2E2A22 48%,#8a6d1d 100%)}
        .sae-photo{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
        .sae-voile{position:absolute;inset:0;background:linear-gradient(165deg,rgba(46,42,34,.78),rgba(46,42,34,.45) 55%,rgba(138,109,29,.55))}
        .sae-fic{position:absolute;color:rgba(251,247,238,.18);animation:sae-flotter 7s ease-in-out infinite}
        .sae-fic svg{width:100%;height:100%}
        .sae-fi1{width:56px;height:56px;top:12%;left:14%}
        .sae-fi2{width:38px;height:38px;top:20%;right:18%;animation-delay:1.4s}
        .sae-fi3{width:46px;height:46px;bottom:16%;left:20%;animation-delay:.8s}
        .sae-fi4{width:30px;height:30px;bottom:26%;right:12%;animation-delay:2.2s}
        .sae-fi5{width:64px;height:64px;top:44%;left:6%;animation-delay:1.8s}
        .sae-verre{position:absolute;top:50%;right:9%;transform:translateY(-50%);width:min(400px,82%);background:rgba(251,247,238,.10);border:1px solid rgba(251,247,238,.22);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border-radius:18px;padding:32px;color:var(--creme);box-shadow:0 24px 60px rgba(0,0,0,.35);animation:sae-apparaitre 1s .4s both,sae-verreFlotte 9s 1.4s ease-in-out infinite}
        .sae-spinner{width:34px;height:34px;border-radius:50%;border:3px solid rgba(201,162,39,.3);border-top-color:var(--or);animation:sae-spin 1s linear infinite;margin-bottom:20px}
        .sae-verre h2{font-size:19px;font-weight:600;line-height:1.4;margin-bottom:14px}
        .sae-verre p{font-size:12px;line-height:1.7;color:rgba(251,247,238,.65)}
        @media(max-width:920px){.sae-carte{grid-template-columns:1fr;min-height:auto}.sae-droite{display:none}.sae-gauche{padding:40px 32px}}
      `}</style>

      <div className="sae-login-body">
        <div className="sae-forme sae-carre sae-f1"></div>
        <div className="sae-forme sae-carre sae-f2"></div>
        <div className="sae-forme sae-losange sae-f3"></div>
        <div className="sae-forme sae-losange sae-f4"></div>
        <div className="sae-forme sae-carre sae-f5"></div>
        <div className="sae-forme sae-point sae-f6"></div>
        <div className="sae-forme sae-point sae-f7"></div>
        <div className="sae-slash"></div>
        <div className="sae-slash sae-slash2"></div>

        <div className="sae-carte">
          {/* ===== GAUCHE ===== */}
          <div className="sae-gauche">
            <div className="sae-haut">
              <a className="sae-logo" href="/" onClick={(e) => { e.preventDefault(); navigate('/'); }}>
                <img src="/img/logo-sae.png" alt="SAE" className="sae-logo-img" />
                SAE
              </a>
              <div className="sae-actions">
                <button type="button" className="sae-theme-btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} title={langue === 'fr' ? (theme === 'dark' ? 'Mode clair' : 'Mode sombre') : (theme === 'dark' ? 'Light mode' : 'Dark mode')}>
                  {theme === 'dark' ? <Sun /> : <Moon />}
                </button>
                <div className="sae-langue">
                  <Languages />
                  <button type="button" className={langue === 'fr' ? 'sae-actif' : ''} onClick={() => definirLangue('fr')}>FR</button>
                  <button type="button" className={langue === 'en' ? 'sae-actif' : ''} onClick={() => definirLangue('en')}>EN</button>
                </div>
              </div>
            </div>

            <div className="sae-milieu">
              <h1>{texte('login_titre', 'Bonjour !', 'Hello!')}</h1>
              <p className="sae-sous-titre">
                {texte('login_sous_titre',
                  'Pour accéder à votre espace, renseignez votre adresse email ainsi que votre mot de passe.',
                  'To access your space, enter your email address and your password.')}
              </p>

              <form className="sae-form" onSubmit={handleSubmit}>
                <div className="sae-champ">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t.auth.email}
                    autoComplete="email"
                    required
                  />
                  <p className={`sae-indice ${montrerIndice ? 'sae-visible' : ''} ${domaineOk ? 'sae-ok' : ''}`}>
                    <CheckCircle className="sae-ic-ok" />
                    <Info className="sae-ic-ko" />
                    <span>
                                            {domaineOk
                        ? t.auth.domaine_autorise
                        : texte('domaine_refuse_detail',
                            `Ce domaine n'est pas autorisé. Domaines acceptés : ${DOMAINES_LOCAUX.join(', ')}.`,
                            `This domain is not allowed. Accepted domains: ${DOMAINES_LOCAUX.join(', ')}.`)}
                    </span>
                  </p>
                </div>

                <div className={`sae-champ sae-bloc-mdp ${montrerBlocMdp ? 'sae-visible' : ''}`}>
                  <div className="sae-champ-relatif">
                    <input
                      ref={mdpRef}
                      type={afficherMdp ? 'text' : 'password'}
                      value={motDePasse}
                      onChange={(e) => setMotDePasse(e.target.value)}
                      placeholder={t.auth.mot_de_passe}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      className={`sae-oeil ${afficherMdp ? 'sae-actif' : ''}`}
                      onClick={() => setAfficherMdp(!afficherMdp)}
                      title={texte('oeil_titre', 'Afficher / masquer le mot de passe', 'Show / hide password')}
                    >
                      <Eye className="sae-voir" />
                      <EyeOff className="sae-cacher" />
                    </button>
                  </div>
                  <button className="sae-btn" type="submit" disabled={chargement || !domaineOk}>
                    <span>{chargement ? t.auth.connexion_en_cours : t.auth.se_connecter}</span>
                    <ArrowRight />
                  </button>
                </div>
              </form>
            </div>

            <p className="sae-copyright">
              © 2026 SAE — {texte('credit', 'Conçu et développé par', 'Designed & developed by')} NGUEYEP NJOMO EMMANUELLE ALEXANDRA
            </p>
          </div>

          {/* ===== DROITE ===== */}
          <div className="sae-droite">
            <img className="sae-photo" src="/img/connexion-photo.png" alt="" onError={(e) => (e.currentTarget.style.display = 'none')} />
            <div className="sae-voile"></div>
            <span className="sae-fic sae-fi1"><Archive /></span>
            <span className="sae-fic sae-fi2"><Lock /></span>
            <span className="sae-fic sae-fi3"><FileCheck /></span>
            <span className="sae-fic sae-fi4"><Search /></span>
            <span className="sae-fic sae-fi5"><Workflow /></span>

            <div className="sae-verre">
              <div className="sae-spinner"></div>
              <h2>
                {texte('verre_titre',
                  "L'archivage intelligent est le nouveau standard de la mémoire d'entreprise.",
                  'Intelligent archiving is the new standard of corporate memory.')}
              </h2>
              <p>
                {texte('verre_texte',
                  'Chaque document déposé sur le SAE est vérifié, classé, taggué et indexé automatiquement par le pipeline ETL.',
                  'Every document uploaded to the SAE is automatically verified, classified, tagged and indexed by the ETL pipeline.')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}