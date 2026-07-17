import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { verifierEmail, connexion } from '../../api/auth';
import { useAuth } from '../../contexts/AuthContext';

function Connexion() {
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [emailValide, setEmailValide] = useState(false);
  const [verificationEnCours, setVerificationEnCours] = useState(false);
  const [erreur, setErreur] = useState('');

  const { seConnecter } = useAuth();
  const navigate = useNavigate();

  async function gererChangementEmail(e) {
    const valeur = e.target.value;
    setEmail(valeur);
    setErreur('');
    setEmailValide(false);

    // On ne vérifie que si ça ressemble déjà à un email complet
    if (!valeur.includes('@') || !valeur.includes('.')) {
      return;
    }

    setVerificationEnCours(true);
    try {
      const valide = await verifierEmail(valeur);
      setEmailValide(valide);
      if (!valide) {
        setErreur("Cette adresse email n'est pas autorisée à se connecter.");
      }
    } catch {
      setErreur('Impossible de vérifier cet email pour le moment.');
    } finally {
      setVerificationEnCours(false);
    }
  }

  async function gererConnexion(e) {
    e.preventDefault();
    setErreur('');

    try {
      const resultat = await connexion(email, motDePasse);
      seConnecter(resultat.token, resultat.utilisateur);
      navigate(resultat.utilisateur.est_admin ? '/admin' : '/dashboard');
    } catch {
      setErreur('Email ou mot de passe incorrect.');
    }
  }

  return (
    <div style={{ maxWidth: 360, margin: '80px auto', fontFamily: 'sans-serif' }}>
      <h1>Connexion</h1>
      <form onSubmit={gererConnexion}>
        <div style={{ marginBottom: 16 }}>
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={gererChangementEmail}
            style={{ width: '100%', padding: 8 }}
            required
          />
          {verificationEnCours && <p>Vérification...</p>}
        </div>

        {emailValide && (
          <div style={{ marginBottom: 16 }}>
            <label>Mot de passe</label>
            <input
              type="password"
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              style={{ width: '100%', padding: 8 }}
              required
            />
          </div>
        )}

        {erreur && <p style={{ color: 'red' }}>{erreur}</p>}

        {emailValide && (
          <button type="submit" style={{ padding: '8px 16px' }}>
            Se connecter
          </button>
        )}
      </form>
    </div>
  );
}

export default Connexion;