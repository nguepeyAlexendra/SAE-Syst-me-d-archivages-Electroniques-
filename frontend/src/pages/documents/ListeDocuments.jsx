import { useState, useEffect } from 'react';
import { listerDocuments } from '../../api/documents';

function ListeDocuments() {
  const [documents, setDocuments] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    async function charger() {
      try {
        const donnees = await listerDocuments();
        setDocuments(donnees);
      } catch {
        setErreur('Impossible de charger les documents.');
      } finally {
        setChargement(false);
      }
    }
    charger();
  }, []);

  if (chargement) return <p style={{ padding: 32 }}>Chargement...</p>;
  if (erreur) return <p style={{ padding: 32, color: 'red' }}>{erreur}</p>;

  return (
    <div style={{ padding: 32, fontFamily: 'sans-serif' }}>
      <h1>Documents</h1>
      {documents.length === 0 && <p>Aucun document pour l'instant.</p>}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #ccc' }}>
            <th style={{ padding: 8 }}>Titre</th>
            <th style={{ padding: 8 }}>Catégorie</th>
            <th style={{ padding: 8 }}>Déposé par</th>
            <th style={{ padding: 8 }}>Statut</th>
            <th style={{ padding: 8 }}>Date</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((doc) => (
            <tr key={doc.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: 8 }}>{doc.titre}</td>
              <td style={{ padding: 8 }}>{doc.categorie_nom || '—'}</td>
              <td style={{ padding: 8 }}>{doc.depose_par_nom}</td>
              <td style={{ padding: 8 }}>{doc.statut}</td>
              <td style={{ padding: 8 }}>
                {new Date(doc.date_depot).toLocaleDateString('fr-FR')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ListeDocuments;