import { useState } from 'react';
import { deposerDocument } from '../../api/documents';
import usePipelinePolling from '../../hooks/usePipelinePolling';
import PipelineTimeline from '../../components/PipelineTimeline';

function Depot() {
  const [titre, setTitre] = useState('');
  const [fichier, setFichier] = useState(null);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [documentDepose, setDocumentDepose] = useState(null);
  const [erreur, setErreur] = useState('');

  const { document, enCours } = usePipelinePolling(documentDepose?.id);

  function gererSelectionFichier(e) {
    const fichierChoisi = e.target.files[0];
    setFichier(fichierChoisi);
    if (fichierChoisi && !titre) {
      setTitre(fichierChoisi.name);
    }
  }

  async function gererEnvoi(e, typeSource) {
    e.preventDefault();
    if (!fichier) {
      setErreur('Choisis un fichier avant de continuer.');
      return;
    }

    setErreur('');
    setEnvoiEnCours(true);
    setDocumentDepose(null);

    try {
      const resultat = await deposerDocument(titre || fichier.name, fichier, typeSource);
      setDocumentDepose(resultat);
    } catch {
      setErreur("Une erreur est survenue pendant l'envoi du document.");
    } finally {
      setEnvoiEnCours(false);
    }
  }

  function reinitialiser() {
    setTitre('');
    setFichier(null);
    setDocumentDepose(null);
    setErreur('');
  }

  return (
    <div style={{ padding: 32, fontFamily: 'sans-serif', maxWidth: 500 }}>
      <h1>Déposer un document</h1>

      {!documentDepose && (
        <form>
          <div style={{ marginBottom: 16 }}>
            <label>Titre du document</label>
            <input
              type="text"
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              style={{ width: '100%', padding: 8 }}
              placeholder="Optionnel, pré-rempli avec le nom du fichier"
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label>Fichier sélectionné : {fichier ? fichier.name : 'aucun'}</label>
          </div>

          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 4 }}>📄 Fichier numérique</label>
              <input type="file" onChange={gererSelectionFichier} />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 4 }}>📷 Scanner un document</label>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={gererSelectionFichier}
              />
            </div>
          </div>

          {erreur && <p style={{ color: 'red' }}>{erreur}</p>}

          <button
            onClick={(e) => gererEnvoi(e, fichier?.type.startsWith('image/') ? 'scan' : 'numerique')}
            disabled={envoiEnCours}
          >
            {envoiEnCours ? 'Envoi en cours...' : 'Déposer le document'}
          </button>
        </form>
      )}

      {documentDepose && (
        <div>
          <h2>{documentDepose.titre}</h2>
          <PipelineTimeline
            logPipeline={document?.log_pipeline}
            statutFinal={document?.statut}
          />
          {!enCours && (
            <button onClick={reinitialiser}>Déposer un autre document</button>
          )}
        </div>
      )}
    </div>
  );
}

export default Depot;