import { useState, useEffect } from 'react';
import { recupererDocument } from '../api/documents';

/**
 * Interroge régulièrement un document pour suivre la progression de son pipeline ETL,
 * jusqu'à ce qu'il soit "valide" ou "rejete".
 */
function usePipelinePolling(documentId) {
  const [document, setDocument] = useState(null);
  const [enCours, setEnCours] = useState(true);

  useEffect(() => {
    if (!documentId) return;

    let annule = false;

    async function verifierProgression() {
      try {
        const donnees = await recupererDocument(documentId);
        if (annule) return;

        setDocument(donnees);

        // On arrête d'interroger une fois que le pipeline est terminé (succès ou échec)
        if (donnees.statut === 'valide' || donnees.statut === 'rejete') {
          setEnCours(false);
        } else {
          // Sinon, on reprogramme une nouvelle vérification dans 1.5 seconde
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

export default usePipelinePolling;