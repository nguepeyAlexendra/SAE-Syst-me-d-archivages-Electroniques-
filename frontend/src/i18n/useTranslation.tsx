import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import fr from './fr';
import en from './en';
import type { Traductions } from './fr';

type Langue = 'fr' | 'en';

interface TranslationContextType {
  langue: Langue;
  t: Traductions;
  basculerLangue: () => void;
  definirLangue: (l: Langue) => void;
}

const TRADUCTIONS: Record<Langue, Traductions> = { fr, en };

const TranslationContext = createContext<TranslationContextType>({
  langue: 'fr',
  t: fr,
  basculerLangue: () => {},
  definirLangue: () => {},
});

const STORAGE_KEY = 'sae_langue';

function langueInitiale(): Langue {
  try {
    const stocke = localStorage.getItem(STORAGE_KEY);
    if (stocke === 'en' || stocke === 'fr') return stocke;
    if (typeof navigator !== 'undefined' && navigator.language?.startsWith('fr')) return 'fr';
  } catch {}
  return 'fr';
}

export function TranslationProvider({ children }: { children: ReactNode }) {
  const [langue, setLangue] = useState<Langue>(langueInitiale);

  const definirLangue = useCallback((l: Langue) => {
    setLangue(l);
    try { localStorage.setItem(STORAGE_KEY, l); } catch {}
  }, []);

  const basculerLangue = useCallback(() => {
    definirLangue(langue === 'fr' ? 'en' : 'fr');
  }, [langue, definirLangue]);

  return (
    <TranslationContext.Provider value={{ langue, t: TRADUCTIONS[langue], basculerLangue, definirLangue }}>
      {children}
    </TranslationContext.Provider>
  );
}

export function useTranslation(): TranslationContextType {
  return useContext(TranslationContext);
}
