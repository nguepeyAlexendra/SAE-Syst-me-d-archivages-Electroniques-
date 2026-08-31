import React, { useState, useEffect } from 'react';
import { useTranslation } from '../i18n/useTranslation';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Progress } from '../components/ui/progress';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { 
  CheckCircle2, 
  Loader2, 
  FileCheck, 
  ShieldCheck, 
  FileText, 
  Tag, 
  Database, 
  HardDrive,
  Clock,
  AlertCircle,
  FileUp
} from 'lucide-react';
import axios from 'axios';

interface PipelineStep {
  id: string;
  label: string;
  icon: React.ReactNode;
  status: 'pending' | 'running' | 'completed' | 'error';
  timestamp?: string;
  progress: number;
}

interface UploadProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: number;
  fileName: string;
}

const STEP_ICONS: Record<string, React.ReactNode> = {
  format: <FileCheck className="h-4 w-4" />,
  antivirus: <ShieldCheck className="h-4 w-4" />,
  metadonnees: <FileText className="h-4 w-4" />, // ✅ Corrigé pour matcher le backend
  classement: <Database className="h-4 w-4" />,
  tagging: <Tag className="h-4 w-4" />,
  indexation: <Database className="h-4 w-4" />,
  chargement: <HardDrive className="h-4 w-4" /> // ✅ Corrigé pour matcher le backend
};

export default function UploadProgressModal({ isOpen, onClose, documentId, fileName }: UploadProgressModalProps) {
  const { t, langue } = useTranslation();
  const [steps, setSteps] = useState<PipelineStep[]>([
    { id: 'format', label: t.pipeline.etape_format, icon: <FileCheck className="h-4 w-4" />, status: 'pending', progress: 0 },
    { id: 'antivirus', label: t.pipeline.etape_antivirus, icon: <ShieldCheck className="h-4 w-4" />, status: 'pending', progress: 0 },
    { id: 'metadonnees', label: t.pipeline.etape_metadata, icon: <FileText className="h-4 w-4" />, status: 'pending', progress: 0 },
    { id: 'classement', label: t.pipeline.classement_auto, icon: <Database className="h-4 w-4" />, status: 'pending', progress: 0 },
    { id: 'tagging', label: t.pipeline.tagging_auto, icon: <Tag className="h-4 w-4" />, status: 'pending', progress: 0 },
    { id: 'indexation', label: t.pipeline.indexation_contenu, icon: <Database className="h-4 w-4" />, status: 'pending', progress: 0 },
    { id: 'chargement', label: t.pipeline.chargement_minio, icon: <HardDrive className="h-4 w-4" />, status: 'pending', progress: 0 }
  ]);

  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !documentId) return;

    const checkPipelineStatus = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`http://127.0.0.1:8000/api/documents/${documentId}/`, {
          headers: { Authorization: `Token ${token}` }
        });

        const doc = response.data;
        
        if (doc.log_pipeline && Array.isArray(doc.log_pipeline)) {
          const updatedSteps = steps.map((step) => {
            // ✅ Correspondance exacte avec les clés de votre backend (services.py)
            const log = doc.log_pipeline.find((l: any) => (l.etape || '').toLowerCase() === step.id);

            if (log) {
              const dateFormatee = log.horodatage ? new Date(log.horodatage).toLocaleTimeString(langue === 'en' ? 'en-US' : 'fr-FR', { 
                hour: '2-digit', minute: '2-digit', second: '2-digit' 
              }) : undefined;

              const statut = String(log.statut || '').toLowerCase();
              const estComplete = statut === 'termine' || statut === 'succes';
              const estErreur = statut === 'echec' || statut === 'erreur';

              return {
                ...step,
                status: estComplete ? 'completed' as const : (estErreur ? 'error' as const : 'running' as const),
                timestamp: dateFormatee,
                progress: (estComplete || estErreur) ? 100 : step.progress
              };
            }
            return step;
          });

          setSteps(updatedSteps);
        }

        // ✅ Gestion de la fin du traitement
        const statutLower = (doc.statut || '').toLowerCase();
        
        if (statutLower === 'valide' || statutLower === 'termine') {
          setIsComplete(true);
          setError(null);
          // Force toutes les étapes restantes à "completed" pour garantir les 100%
          setSteps(prev => prev.map(s => s.status === 'pending' || s.status === 'running' ? { ...s, status: 'completed', progress: 100 } : s));
          
        } else if (statutLower === 'rejete') {
          setIsComplete(true);
          setError(doc.cause_rejet ? (doc.cause_rejet_en || doc.cause_rejet) : t.documents.rejete_traitement);
          setSteps(prev => prev.map(s => s.status === 'pending' || s.status === 'running' ? { ...s, status: 'error', progress: 100 } : s));
        }

      } catch (err) {
        console.error('Erreur polling:', err);
      }
    };

    checkPipelineStatus();
    const interval = setInterval(checkPipelineStatus, 1500); // 1.5s pour plus de réactivité

    return () => clearInterval(interval);
  }, [isOpen, documentId]);

  const overallProgress = Math.round(
    steps.reduce((acc, step) => acc + (step.status === 'completed' || step.status === 'error' ? 100 : step.progress), 0) / steps.length
  );

  const isRejected = !!error;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={`sm:max-w-md ${isRejected ? 'border-destructive' : ''}`}>
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <FileUp className="h-5 w-5" />
              {t.pipeline.titre}
            </span>
            {isComplete && !isRejected && (
              <Badge variant="default" className="bg-green-600">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                {t.pipeline.termine}
              </Badge>
            )}
            {isComplete && isRejected && (
              <Badge variant="destructive">
                <AlertCircle className="h-3 w-3 mr-1" />
                {t.documents.rejete}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm font-medium truncate">{fileName}</p>
          </div>

          {!isComplete && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t.pipeline.progression_globale}</span>
                <span className="font-medium">{overallProgress}%</span>
              </div>
              <Progress value={overallProgress} className="h-2" />
            </div>
          )}

          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {steps.map((step) => (
              <div
                key={step.id}
                className={`p-3 rounded-lg border transition-all duration-300 ${
                  step.status === 'completed' ? 'bg-green-50/50 border-green-200' :
                  step.status === 'error' ? 'bg-red-50/50 border-red-200' :
                  step.status === 'running' ? 'bg-blue-50/50 border-blue-200' :
                  'bg-muted/30 border-muted'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0">
                    {step.status === 'running' ? (
                      <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
                    ) : step.status === 'completed' ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : step.status === 'error' ? (
                      <AlertCircle className="h-4 w-4 text-red-600" />
                    ) : (
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`font-medium text-sm flex items-center gap-2 ${step.status === 'error' ? 'text-red-700' : ''}`}>
                        {step.icon}
                        {step.label}
                      </span>
                      {step.timestamp && (
                        <span className="text-xs text-muted-foreground font-mono">{step.timestamp}</span>
                      )}
                    </div>
                    
                    {step.status === 'running' && (
                      <Progress value={step.progress} className="h-1.5 mt-1" />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {isComplete && !isRejected && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-center animate-in fade-in zoom-in-95">
              <CheckCircle2 className="h-6 w-6 text-green-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-green-800">
                {t.pipeline.succes}
              </p>
            </div>
          )}

          {isComplete && isRejected && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-center animate-in fade-in zoom-in-95">
              <AlertCircle className="h-6 w-6 text-red-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-red-800">{t.pipeline.echec}</p>
              <p className="text-xs text-red-600 mt-1 font-mono bg-red-100 p-2 rounded">
                {error}
              </p>
            </div>
          )}

          {isComplete ? (
            <Button onClick={onClose} className={`w-full ${isRejected ? 'bg-destructive hover:bg-destructive/90' : ''}`}>
              {t.commun.fermer}
            </Button>
          ) : (
            <p className="text-xs text-center text-muted-foreground animate-pulse">
              {t.pipeline.patientez}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}