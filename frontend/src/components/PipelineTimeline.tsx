import { useTranslation } from '../i18n/useTranslation';
import type { EtapePipeline } from '../api/documents';

const ETAPES = ['format', 'antivirus', 'metadata', 'classement', 'tagging', 'indexation', 'chargement'] as const;
const CLE_TRADUCTION: Record<string, string> = {
  format: 'etape_format', antivirus: 'etape_antivirus',
  metadata: 'etape_metadata', classement: 'etape_classement',
  tagging: 'etape_tagging', indexation: 'etape_indexation', chargement: 'etape_chargement',
};

export default function PipelineTimeline({ logPipeline, statutFinal }: { logPipeline?: EtapePipeline[]; statutFinal?: string }) {
  const { t } = useTranslation();
  if (!logPipeline || logPipeline.length === 0) {
    return <p className="text-muted-foreground">{t.pipeline.en_attente}</p>;
  }
  const pipelineMap = new Map(logPipeline.map((e) => [e.etape, e]));
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{t.pipeline.titre}</p>
      {ETAPES.map((etape) => {
        const info = pipelineMap.get(etape);
        const statut = info?.statut || 'en_attente';
        return (
          <div key={etape} className="flex items-center gap-3 text-sm">
            <div className={`h-2 w-2 rounded-full shrink-0 ${statut === 'succes' ? 'bg-green-500' : statut === 'echec' ? 'bg-red-500' : 'bg-yellow-400'}`} />
            <span className="flex-1">{t.pipeline[CLE_TRADUCTION[etape] as keyof typeof t.pipeline] || etape}</span>
            {info?.horodatage && <span className="text-xs text-muted-foreground">{new Date(info.horodatage).toLocaleTimeString()}</span>}
          </div>
        );
      })}
      {statutFinal === 'valide' && <p className="text-green-600 font-bold mt-3">{t.pipeline.valide_indexe}</p>}
      {statutFinal === 'rejete' && <p className="text-red-600 font-bold mt-3">{t.pipeline.rejete_etape}</p>}
    </div>
  );
}
