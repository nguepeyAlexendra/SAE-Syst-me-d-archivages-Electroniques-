import { createContext, useContext, useState, type ReactNode } from 'react';
import type { Utilisateur } from '../api/auth';

interface AuthContextType {
  utilisateur: Utilisateur | null;
  seConnecter: (token: string, utilisateurConnecte: Utilisateur) => void;
  seDeconnecter: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

function normaliserDepartement(d: unknown): { id: number; nom: string } | null {
  if (!d) return null;
  if (typeof d === 'number') return { id: d, nom: '' };
  if (typeof d === 'object' && d !== null && 'id' in d) return d as { id: number; nom: string };
  return null;
}

function lireUtilisateur(): Utilisateur | null {
  try {
    const stocke = localStorage.getItem('utilisateur');
    if (!stocke) return null;
    const parsed = JSON.parse(stocke);
    if (parsed && typeof parsed === 'object' && parsed.id && parsed.username) {
      parsed.departement = normaliserDepartement(parsed.departement);
      return parsed;
    }
    localStorage.removeItem('utilisateur');
    localStorage.removeItem('token');
    return null;
  } catch {
    localStorage.removeItem('utilisateur');
    localStorage.removeItem('token');
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [utilisateur, setUtilisateur] = useState<Utilisateur | null>(lireUtilisateur);

  function seConnecter(token: string, utilisateurConnecte: Utilisateur) {
    try {
      localStorage.setItem('token', token);
      localStorage.setItem('utilisateur', JSON.stringify(utilisateurConnecte));
    } catch {}
    setUtilisateur(utilisateurConnecte);
  }

  function seDeconnecter() {
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('utilisateur');
    } catch {}
    setUtilisateur(null);
  }

  return (
    <AuthContext.Provider value={{ utilisateur, seConnecter, seDeconnecter }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth doit être utilisé dans un AuthProvider');
  }
  return context;
}
