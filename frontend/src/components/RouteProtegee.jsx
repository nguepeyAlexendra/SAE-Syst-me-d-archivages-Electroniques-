import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';

function RouteProtegee({ children }) {
  const { utilisateur } = useAuth();

 
  if (!utilisateur) {
    return <Navigate to="/connexion" replace />;
  }

  return children;
}

export default RouteProtegee;