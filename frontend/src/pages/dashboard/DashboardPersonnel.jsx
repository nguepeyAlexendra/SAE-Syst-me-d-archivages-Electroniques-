import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

function DashboardPersonnel() {
  const { utilisateur, seDeconnecter } = useAuth();
  const navigate = useNavigate();

  function gererDeconnexion() {
    seDeconnecter();
    navigate('/connexion');
  }

  return (
    <div style={{ padding: 32, fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Bonjour, {utilisateur?.username} 👋</h1>
        <button onClick={gererDeconnexion}>Se déconnecter</button>
      </div>
      <p>Bienvenue sur votre espace personnel SAE.</p>
        <a href="/depot">
          <button>Déposer un document</button>
        </a>
        <a href="/documents" style={{ marginLeft: 8 }}>
          <button>Voir tous les documents</button>
        </a>
        <a href="/profil" style={{ marginLeft: 8 }}>
          <button>Mon profil</button>
        </a>
    </div>
  );
}

export default DashboardPersonnel;