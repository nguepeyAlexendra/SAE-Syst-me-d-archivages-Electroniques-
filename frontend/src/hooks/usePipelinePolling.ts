import { useState, useEffect } from 'react';
import { recupererDocument, type Document } from '../api/documents';

interface PipelinePollingResult {
  document: Document | null;
  enCours: boolean;
}

export default function usePipelinePolling(documentId: number | null): PipelinePollingResult {
  const [document, setDocument] = useState<Document | null>(null);
  const [enCours, setEnCours] = useState(true);

  useEffect(() => {
    if (!documentId) return;

    let annule = false;

    async function verifierProgression() {
      try {
        const donnees = await recupererDocument(documentId!);
        if (annule) return;
        setDocument(donnees);
        if (donnees.statut === 'valide' || donnees.statut === 'rejete') {
          setEnCours(false);
        } else {
          setTimeout(verifierProgression, 1500);
        }
      } catch (erreur) {
        console.error('Erreur pendant le suivi du pipeline :', erreur);
        setEnCours(false);
      }
    }

    verifierProgression();

    return () => {
      annule = true;
    };
  }, [documentId]);

  return { document, enCours };
}
