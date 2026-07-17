import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

function DashboardAdmin() {
  const { utilisateur, seDeconnecter } = useAuth();
  const navigate = useNavigate();

  function gererDeconnexion() {
    seDeconnecter();
    navigate('/connexion');
  }

  return (
    <div style={{ padding: 32, fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Espace administrateur — {utilisateur?.username} 👋</h1>
        <button onClick={gererDeconnexion}>Se déconnecter</button>
      </div>
      <p>Bienvenue sur le tableau de bord administrateur du SAE.</p>
    </div>
  );
}

export default DashboardAdmin;