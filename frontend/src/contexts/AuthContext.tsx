import { createContext, useContext, useState, type ReactNode } from 'react';
import type { Utilisateur } from '../api/auth';
import apiClient from '../api/client';

export interface Session {
  id: number;
  appareil: string;
  ip: string | null;
  cree_le: string;
  derniere_activite: string;
  est_cet_appareil: boolean;
}

interface AuthContextType {
  utilisateur: Utilisateur | null;
  seConnecter: (token: string, utilisateurConnecte: Utilisateur) => void;
  seDeconnecter: () => Promise<void>;
  listerSessions: () => Promise<Session[]>;
  deconnecterSession: (id: number) => Promise<void>;
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

/** Nettoie le localStorage (utilisé en local ET après appel backend) */
function _nettoyerLocal() {
  try {
    localStorage.removeItem('token');
    localStorage.removeItem('utilisateur');
    localStorage.removeItem('trusted_device_token');
  } catch {}
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

  async function seDeconnecter() {
    // 1. Informer le backend (invalide la session + supprime le token)
    const token = localStorage.getItem('token');
    if (token) {
      try {
        await apiClient.post('/accounts/deconnexion/');
      } catch {
        // Silencieux : même si le token est déjà invalide, on nettoie côté client
      }
    }

    // 2. Nettoyage local
    _nettoyerLocal();
    setUtilisateur(null);
  }

  /** Liste tous les appareils connectés de l'utilisateur courant */
  async function listerSessions(): Promise<Session[]> {
    const r = await apiClient.get<Session[]>('/accounts/mes-sessions/');
    return r.data;
  }

  /** Déconnecte un appareil spécifique à distance */
  async function deconnecterSession(id: number): Promise<void> {
    await apiClient.delete(`/accounts/mes-sessions/${id}/`);
  }

  return (
    <AuthContext.Provider
      value={{ utilisateur, seConnecter, seDeconnecter, listerSessions, deconnecterSession }}
    >
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