function PipelineTimeline({ logPipeline, statutFinal }) {
  if (!logPipeline || logPipeline.length === 0) {
    return <p>En attente du démarrage du traitement...</p>;
  }

  function icone(statutEtape) {
    if (statutEtape === 'termine') return '✅';
    if (statutEtape === 'echec') return '❌';
    return '⏳';
  }

  return (
    <div style={{ margin: '16px 0' }}>
      {logPipeline.map((etape, index) => (
        <div
          key={index}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}
        >
          <span style={{ fontSize: 20 }}>{icone(etape.statut)}</span>
          <span>{etape.libelle}</span>
        </div>
      ))}

      {statutFinal === 'valide' && (
        <p style={{ color: 'green', fontWeight: 'bold', marginTop: 12 }}>
          ✔ Document validé et indexé avec succès.
        </p>
      )}
      {statutFinal === 'rejete' && (
        <p style={{ color: 'red', fontWeight: 'bold', marginTop: 12 }}>
          ✘ Document rejeté — voir l'étape en échec ci-dessus.
        </p>
      )}
    </div>
  );
}

export default PipelineTimeline;