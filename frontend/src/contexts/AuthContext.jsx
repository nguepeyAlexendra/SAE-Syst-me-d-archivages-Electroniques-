import { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [utilisateur, setUtilisateur] = useState(() => {
    const stocke = localStorage.getItem('utilisateur');
    return stocke ? JSON.parse(stocke) : null;
  });

  function seConnecter(token, utilisateurConnecte) {
    localStorage.setItem('token', token);
    localStorage.setItem('utilisateur', JSON.stringify(utilisateurConnecte));
    setUtilisateur(utilisateurConnecte);
  }

  function seDeconnecter() {
    localStorage.removeItem('token');
    localStorage.removeItem('utilisateur');
    setUtilisateur(null);
  }

  return (
    <AuthContext.Provider value={{ utilisateur, seConnecter, seDeconnecter }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}