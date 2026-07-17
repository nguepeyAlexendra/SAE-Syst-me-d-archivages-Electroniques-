import { useAuth } from '../../contexts/AuthContext';
import { useState, useEffect } from 'react';
import { listerDocuments } from '../../api/documents';
import { changerMotDePasse, recupererProfil, mettreAJourPhotoProfil } from '../../api/auth';

function Profil() {
  const { utilisateur } = useAuth();
  const [mesDocuments, setMesDocuments] = useState([]);
  const [profil, setProfil] = useState(null);

  const [ancienMdp, setAncienMdp] = useState('');
  const [nouveauMdp, setNouveauMdp] = useState('');
  const [messageMdp, setMessageMdp] = useState('');

  const [messagePhoto, setMessagePhoto] = useState('');

  useEffect(() => {
    async function charger() {
      const tous = await listerDocuments();
      setMesDocuments(tous.filter((doc) => doc.depose_par === utilisateur.id));

      const monProfil = await recupererProfil();
      setProfil(monProfil);
    }
    charger();
  }, [utilisateur.id]);

  async function gererChangementMdp(e) {
    e.preventDefault();
    setMessageMdp('');
    try {
      await changerMotDePasse(ancienMdp, nouveauMdp);
      setMessageMdp('Mot de passe changé avec succès.');
      setAncienMdp('');
      setNouveauMdp('');
    } catch (erreur) {
      const detail = erreur.response?.data?.erreur
        || erreur.response?.data?.nouveau_mot_de_passe?.[0]
        || 'Une erreur est survenue.';
      setMessageMdp(detail);
    }
  }

  async function gererChangementPhoto(e) {
    const fichier = e.target.files[0];
    if (!fichier) return;

    setMessagePhoto('Envoi en cours...');
    try {
      const resultat = await mettreAJourPhotoProfil(fichier);
      setProfil(resultat);
      setMessagePhoto('Photo mise à jour.');
    } catch {
      setMessagePhoto("Erreur lors de l'envoi de la photo.");
    }
  }

  return (
    <div style={{ padding: 32, fontFamily: 'sans-serif', maxWidth: 500 }}>
      <h1>Mon profil</h1>

      <div style={{ marginBottom: 24 }}>
        {profil?.photo && (
          <img
            src={profil.photo}
            alt="Photo de profil"
            style={{ width: 100, height: 100, borderRadius: '50%', objectFit: 'cover', marginBottom: 8 }}
          />
        )}
        <div>
          <label>Changer la photo de profil</label>
          <input type="file" accept="image/*" onChange={gererChangementPhoto} />
        </div>
        {messagePhoto && <p>{messagePhoto}</p>}
      </div>

      <div style={{ marginBottom: 24 }}>
        <p><strong>Nom d'utilisateur :</strong> {utilisateur.username}</p>
        <p><strong>Email :</strong> {utilisateur.email}</p>
        <p><strong>Rôle :</strong> {utilisateur.est_admin ? 'Administrateur' : 'Employé'}</p>
      </div>

      <h2>Changer mon mot de passe</h2>
      <form onSubmit={gererChangementMdp} style={{ marginBottom: 24 }}>
        <div style={{ marginBottom: 8 }}>
          <label>Ancien mot de passe</label>
          <input
            type="password"
            value={ancienMdp}
            onChange={(e) => setAncienMdp(e.target.value)}
            style={{ width: '100%', padding: 8 }}
            required
          />
        </div>
        <div style={{ marginBottom: 8 }}>
          <label>Nouveau mot de passe (8 caractères minimum)</label>
          <input
            type="password"
            value={nouveauMdp}
            onChange={(e) => setNouveauMdp(e.target.value)}
            style={{ width: '100%', padding: 8 }}
            required
          />
        </div>
        {messageMdp && <p>{messageMdp}</p>}
        <button type="submit">Changer le mot de passe</button>
      </form>

      <h2>Mes documents déposés ({mesDocuments.length})</h2>
      <ul>
        {mesDocuments.map((doc) => (
          <li key={doc.id}>{doc.titre} — {doc.statut}</li>
        ))}
      </ul>
    </div>
  );
}

export default Profil;