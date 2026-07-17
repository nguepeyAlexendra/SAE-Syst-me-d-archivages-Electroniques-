import { Routes, Route } from 'react-router-dom';
import Connexion from './pages/auth/Connexion';
import DashboardPersonnel from './pages/dashboard/DashboardPersonnel';
import DashboardAdmin from './pages/dashboard/DashboardAdmin';
import Depot from './pages/documents/Depot';
import RouteProtegee from './components/RouteProtegee';
import ListeDocuments from './pages/documents/ListeDocuments';
import Profil from './pages/profil/Profil';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Connexion />} />
      <Route path="/connexion" element={<Connexion />} />
      <Route
        path="/dashboard"
        element={
          <RouteProtegee>
            <DashboardPersonnel />
          </RouteProtegee>
        }
      />
      <Route
        path="/admin"
        element={
          <RouteProtegee>
            <DashboardAdmin />
          </RouteProtegee>
        }
      />
      <Route
        path="/depot"
        element={
          <RouteProtegee>
            <Depot />
          </RouteProtegee>
        }
      />

      <Route
        path="/documents"
        element={
          <RouteProtegee>
            <ListeDocuments />
          </RouteProtegee>
        }
      />
      <Route
        path="/profil"
        element={
          <RouteProtegee>
            <Profil />
          </RouteProtegee>
        }
      />
    </Routes>
  );
}

export default App;