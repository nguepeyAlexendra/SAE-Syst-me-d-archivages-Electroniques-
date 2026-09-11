import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Toaster } from './components/ui/sonner';
import Connexion from './pages/auth/Connexion';
import TwoFactor from './pages/auth/TwoFactor';
import Landing from './pages/public/Landing';
import APropos from './pages/public/APropos';
import DashboardPersonnel from './pages/dashboard/DashboardPersonnel';
import DashboardAdmin from './pages/dashboard/DashboardAdmin';
import Depot from './pages/documents/Depot';
import RouteProtegee from './components/RouteProtegee';
import Layout from './components/Layout';
import ListeDocuments from './pages/documents/ListeDocuments';
import DetailDocument from './pages/documents/DetailDocument';
import Profil from './pages/profil/Profil';
import GestionUtilisateurs from './pages/admin/GestionUtilisateurs';
import DetailUtilisateur from './pages/admin/DetailUtilisateur';
import Configuration from './pages/admin/Configuration';
import LogsPage from './pages/admin/Logs';
import GestionDepartementsPage from './pages/admin/GestionDepartementsPage';
import GestionPermissions from './pages/admin/GestionPermissions';
import NotFound from './pages/errors/NotFound';
import AccessDenied from './pages/errors/AccessDenied';
import { useAuth } from './contexts/AuthContext';
import Assistant from './pages/assistant/Assistant';
import HelpCenter from './pages/aide/HelpCenter'; 
import NotificationsPage from './pages/notifications/NotificationsPage'// ✅ NOUVEL IMPORT

function PageProtegee({ children }: { children: React.ReactNode }) {
  return (
    <RouteProtegee>
      <Layout>{children}</Layout>
    </RouteProtegee>
  );
}

function PageProtegeeOutlet() {
  return (
    <RouteProtegee>
      <Layout>
        <Outlet />
      </Layout>
    </RouteProtegee>
  );
}

function AccueilPublic() {
  const { utilisateur } = useAuth();
  if (utilisateur) {
    return <Navigate to="/dashboard" replace />;
  }
  return <Landing />;
}

export default function App() {
  return (
    <>
      <Routes>
        {/* ✅ Pages publiques avant connexion */}
        <Route path="/" element={<AccueilPublic />} />
        <Route path="/landing" element={<AccueilPublic />} />
        <Route path="/a-propos" element={<APropos />} />
        <Route path="/login" element={<Connexion />} />
        <Route path="/connexion" element={<Connexion />} />
        <Route path="/2fa" element={<TwoFactor />} />
        <Route path="/403" element={<AccessDenied />} />

        <Route path="/dashboard" element={<PageProtegee><DashboardPersonnel /></PageProtegee>} />

        {/* ✅ ROUTES DE DÉPÔT AVEC PROPS TYPECIBLE */}
        <Route path="/depot" element={<PageProtegee><Depot typeCible="documents" /></PageProtegee>} />
        <Route path="/depot/images" element={<PageProtegee><Depot typeCible="images" /></PageProtegee>} />
        <Route path="/depot/medias" element={<PageProtegee><Depot typeCible="medias" /></PageProtegee>} />

        <Route path="/documents" element={<PageProtegee><ListeDocuments /></PageProtegee>} />
        <Route path="/documents/:id" element={<PageProtegee><DetailDocument /></PageProtegee>} />
        <Route path="/profil" element={<PageProtegee><Profil /></PageProtegee>} />
        <Route path="/assistant" element={<PageProtegee><Assistant /></PageProtegee>} />
        
        {/* ✅ NOUVELLE ROUTE CENTRE D'AIDE */}
        <Route path="/aide" element={<PageProtegee><HelpCenter /></PageProtegee>} />
        <Route path="/notifications" element={<PageProtegee><NotificationsPage /></PageProtegee>} /> {/* ✅ AJOUT */}

        <Route path="/admin" element={<PageProtegeeOutlet />}>
          <Route index element={<DashboardAdmin />} />
          <Route path="logs" element={<LogsPage />} />
          <Route path="utilisateurs" element={<GestionUtilisateurs />} />
          <Route path="utilisateurs/:id" element={<DetailUtilisateur />} />
          <Route path="departements" element={<GestionDepartementsPage />} />
          <Route path="permissions" element={<GestionPermissions />} />
          <Route path="configuration" element={<Configuration />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Toaster />
    </>
  );
}