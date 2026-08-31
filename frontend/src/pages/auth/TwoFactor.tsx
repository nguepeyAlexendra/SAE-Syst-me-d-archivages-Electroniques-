import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from '../../i18n/useTranslation';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../components/ThemeProvider';
import apiClient from '../../api/client';
import { toast } from 'sonner';
import { ShieldCheck, ArrowLeft, Languages, Sun, Moon } from 'lucide-react';

export default function TwoFactor() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, langue, definirLangue } = useTranslation();
  const { seConnecter } = useAuth();
  const { theme, setTheme } = useTheme();
  const state = location.state as { email?: string; temp_token?: string } | null;
  const email = state?.email || '';
  const tempToken = state?.temp_token || '';

  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [souvenir, setSouvenir] = useState(false);
  const [chargement, setChargement] = useState(false);
  const [renvoi, setRenvoi] = useState(false);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!email) navigate('/login', { replace: true });
  }, [email, navigate]);

  const handleChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);
    if (value && index < 5) inputsRef.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) inputsRef.current[index - 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setCode(pasted.split(''));
      inputsRef.current[5]?.focus();
    }
  };

  const codeComplet = code.every(c => c !== '') && code.join('').length === 6;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codeComplet || chargement) return;
    setChargement(true);
    try {
            const res = await apiClient.post('/auth/verify-2fa/', {
        code: code.join(''),
        temp_token: tempToken,
        se_souvenir_appareil: souvenir,
      });
      if (res.data.token && res.data.utilisateur) {
        // ✅ Stocker l'appareil approuvé pour sauter le 2FA au prochain login
        if (res.data.trusted_device_token) {
          localStorage.setItem('sae_trusted_device', res.data.trusted_device_token);
        }
        seConnecter(res.data.token, res.data.utilisateur);
        if (res.data.changement_mdp_obligatoire) {
          toast.info(t.auth.changement_mdp_obligatoire);
          navigate('/profil?onglet=securite', { replace: true });
        } else {
          navigate('/dashboard', { replace: true });
        }
      } else toast.error(t.commun.erreur);
    } catch (err: any) {
      toast.error(err?.response?.data?.erreur || t.auth.code_incorrect_ou_expire);
      setCode(['', '', '', '', '', '']);
      inputsRef.current[0]?.focus();
    } finally {
      setChargement(false);
    }
  };

  const handleRenvoyer = async () => {
    if (renvoi) return;
    setRenvoi(true);
    try {
      await apiClient.post('/auth/resend-2fa/', { temp_token: tempToken });
      toast.success(t.auth.code_envoye);
      setCode(['', '', '', '', '', '']);
    } catch { toast.error(t.commun.erreur); }
    finally { setRenvoi(false); }
  };

  return (
    <>
      <style>{`
        :root{--or:#C9A227;--or-fonce:#b28f1f;--creme:#FBF7EE;--papier:#F0EDE8;--encre:#2E2A22;--muted:#78716c;--texte-doux:#a8a29e;--bord-or:rgba(201,162,39,.5)}
        .dark{--or:#d8b23e;--or-fonce:#e6c15e;--creme:#211f17;--papier:#15140f;--encre:#f2ecdc;--muted:#a89f8c;--texte-doux:#8b8371;--bord-or:rgba(216,178,62,.45)}
        .dark .sae-2fa-body{background:var(--papier)}
        .dark .sae-carte-2fa{background:var(--creme);border-color:var(--bord-or)}
        .dark .sae-logo-2fa{color:var(--encre)}
        .dark .sae-langue{background:#2a2820;border-color:var(--bord-or)}
        .dark .sae-langue button{color:var(--texte-doux)}
        .dark .sae-langue button:hover{color:var(--encre)}
        .dark .sae-langue button.sae-actif{background:var(--or);color:#15140f}
        .dark .sae-icone-2fa{background:#2a2820;border-color:var(--bord-or)}
        .dark .sae-2fa-titre{color:var(--encre)}
        .dark .sae-2fa-sous{color:var(--muted)}
        .dark .sae-2fa-email{color:var(--encre)}
        .dark .sae-code-input{background:#1b1913;border-color:var(--bord-or);color:var(--encre)}
        .dark .sae-code-input:focus{background:#26241b;border-color:var(--or);box-shadow:0 0 0 4px rgba(216,178,62,.15)}
        .dark .sae-souvenir{color:var(--muted)}
        .dark .sae-btn-2fa{background:var(--or);color:#15140f}
        .dark .sae-btn-2fa:hover:not(:disabled){background:var(--or-fonce)}
        .dark .sae-lien-retour{color:var(--muted)}
        .dark .sae-lien-retour:hover{color:var(--encre)}
        .dark .sae-renvoyer{color:var(--or)}
        .dark .sae-renvoyer:hover{color:var(--encre)}
        .dark .sae-copyright{color:var(--texte-doux)}
        .dark .sae-carre{background:rgba(46,42,34,.55)}
        .dark .sae-point{background:rgba(46,42,34,.85)}
        .dark .sae-theme-btn{color:var(--texte-doux)}
        .dark .sae-theme-btn:hover{color:var(--or)}
        .sae-2fa-body{font-family:'Inter',sans-serif;background:var(--papier);min-height:100vh;display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative;padding:24px}
        .sae-forme{position:fixed;z-index:0;animation:sae-flotter 9s ease-in-out infinite}
        .sae-carre{background:rgba(255,253,249,.7);border-radius:24px}
        .sae-losange{background:rgba(201,162,39,.25);border-radius:6px;transform:rotate(45deg)}
        .sae-point{background:rgba(255,253,249,.9);border-radius:50%}
        .sae-f1{width:130px;height:130px;top:-40px;left:36%;rotate:14deg}
        .sae-f2{width:70px;height:70px;top:10%;right:5%;rotate:-12deg;animation-delay:1.2s}
        .sae-f3{width:26px;height:26px;top:24%;left:7%;animation-delay:.6s}
        .sae-f4{width:14px;height:14px;top:58%;right:9%;animation-delay:2s}
        .sae-f5{width:95px;height:95px;bottom:6%;left:3%;rotate:10deg;animation-delay:1.6s}
        .sae-slash{position:fixed;bottom:7%;right:4%;width:7px;height:52px;border-radius:4px;background:rgba(201,162,39,.5);rotate:22deg;z-index:0}
        .sae-slash2{right:6.5%;height:40px;background:rgba(201,162,39,.32)}
        @keyframes sae-flotter{0%,100%{translate:0 0}50%{translate:0 -16px}}
        @keyframes sae-apparaitre{from{opacity:0;transform:translateY(26px) scale(.98)}to{opacity:1;transform:none}}
        .sae-carte-2fa{position:relative;z-index:1;width:min(460px,96vw);background:var(--creme);border-radius:28px;box-shadow:0 30px 70px rgba(46,42,34,.16);border:1.5px solid var(--or);animation:sae-apparaitre .9s cubic-bezier(.2,.7,.3,1) both;padding:48px 44px}
        .sae-carte-2fa>*{animation:sae-apparaitre .7s both}
        .sae-carte-2fa>*:nth-child(1){animation-delay:.15s}
        .sae-carte-2fa>*:nth-child(2){animation-delay:.25s}
        .sae-carte-2fa>*:nth-child(3){animation-delay:.35s}
        .sae-haut-2fa{display:flex;align-items:center;justify-content:space-between;margin-bottom:32px}
        .sae-logo-2fa{display:flex;align-items:center;gap:10px;text-decoration:none;font-family:'Playfair Display',serif;font-size:22px;font-weight:700;color:var(--encre)}
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
        .sae-icone-2fa{width:72px;height:72px;border-radius:50%;background:#f6f0e2;border:1.5px solid var(--or);display:flex;align-items:center;justify-content:center;margin:0 auto 24px}
        .sae-icone-2fa svg{width:34px;height:34px;color:var(--or)}
        .sae-2fa-titre{font-family:'Playfair Display',serif;font-size:26px;color:var(--encre);text-align:center;margin-bottom:12px}
        .sae-2fa-sous{font-size:13px;color:var(--muted);line-height:1.65;text-align:center;margin-bottom:28px}
        .sae-2fa-email{color:var(--encre);font-weight:600}
        .sae-code-group{display:flex;gap:8px;justify-content:center;margin-bottom:20px}
        .sae-code-input{width:48px;height:58px;background:#fdfaf3;border:1px solid var(--bord-or);border-radius:10px;font:600 22px 'Inter',sans-serif;color:var(--encre);text-align:center;outline:none;transition:all .25s ease}
        .sae-code-input:focus{background:#fff;border-color:var(--or);box-shadow:0 0 0 4px rgba(201,162,39,.15)}
        .sae-souvenir{display:flex;align-items:center;gap:8px;margin-bottom:24px;font-size:12px;color:var(--muted);cursor:pointer;user-select:none}
        .sae-souvenir input{accent-color:var(--or);cursor:pointer;width:14px;height:14px}
        .sae-btn-2fa{width:100%;padding:15px;background:var(--or);color:var(--encre);border:none;border-radius:10px;cursor:pointer;font:600 13px 'Inter',sans-serif;letter-spacing:.4px;display:flex;align-items:center;justify-content:center;gap:8px;transition:all .25s ease}
        .sae-btn-2fa:disabled{opacity:.4;cursor:not-allowed}
        .sae-btn-2fa:hover:not(:disabled){background:var(--or-fonce);transform:translateY(-2px);box-shadow:0 14px 28px rgba(201,162,39,.35)}
        .sae-lien-retour{display:flex;align-items:center;justify-content:center;gap:6px;margin-top:20px;font-size:12px;color:var(--muted);text-decoration:none;cursor:pointer;transition:color .2s}
        .sae-lien-retour:hover{color:var(--encre)}
        .sae-lien-retour svg{width:14px;height:14px}
        .sae-renvoyer{display:block;margin:0 auto 20px;background:none;border:none;color:var(--or-fonce);font-size:12px;cursor:pointer;text-decoration:underline}
        .sae-renvoyer:hover{color:var(--encre)}
        .sae-renvoyer:disabled{opacity:.5;cursor:not-allowed}
        .sae-copyright{font-size:10px;color:var(--texte-doux);margin-top:24px;text-align:center}
      `}</style>

      <div className="sae-2fa-body">
        <div className="sae-forme sae-carre sae-f1"></div>
        <div className="sae-forme sae-carre sae-f2"></div>
        <div className="sae-forme sae-losange sae-f3"></div>
        <div className="sae-forme sae-losange sae-f4"></div>
        <div className="sae-forme sae-carre sae-f5"></div>
        <div className="sae-slash"></div>
        <div className="sae-slash sae-slash2"></div>

        <div className="sae-carte-2fa">
          <div className="sae-haut-2fa">
            <a className="sae-logo-2fa" href="/" onClick={(e) => { e.preventDefault(); navigate('/'); }}>
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

          <div className="sae-icone-2fa"><ShieldCheck /></div>

          <h1 className="sae-2fa-titre">{t.auth.verification_securite}</h1>
          <p className="sae-2fa-sous">
            {t.auth.code_envoye} <span className="sae-2fa-email">{email}</span>
          </p>

          <form onSubmit={handleSubmit}>
            <div className="sae-code-group" onPaste={handlePaste}>
              {code.map((c, i) => (
                <input key={i} ref={(el) => { inputsRef.current[i] = el; }}
                  type="text" inputMode="numeric" maxLength={1} value={c}
                  onChange={(e) => handleChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  className="sae-code-input" autoFocus={i === 0} />
              ))}
            </div>

            <button type="button" className="sae-renvoyer" onClick={handleRenvoyer} disabled={renvoi}>
              {renvoi ? t.commun.charger : ((t.auth as any).renvoyer_code || (langue === 'fr' ? 'Renvoyer le code' : 'Resend code'))}
            </button>

            <label className="sae-souvenir">
              <input type="checkbox" checked={souvenir} onChange={(e) => setSouvenir(e.target.checked)} />
              {t.auth.se_souvenir_appareil}
            </label>

            <button className="sae-btn-2fa" type="submit" disabled={!codeComplet || chargement}>
              {chargement ? t.commun.charger : t.auth.valider_code}
            </button>
          </form>

          <a className="sae-lien-retour" onClick={() => navigate('/login', { replace: true })}>
            <ArrowLeft />
            {t.auth.retour}
          </a>

          <p className="sae-copyright">
            © 2026 SAE — {t.auth.credit} NGUEYEP NJOMO EMMANUELLE ALEXANDRA
          </p>
        </div>
      </div>
    </>
  );
}