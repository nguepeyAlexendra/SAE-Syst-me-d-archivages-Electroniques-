import React from 'react';
import { useTranslation } from '../i18n/useTranslation';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Progress } from '../components/ui/progress';
import { Badge } from '../components/ui/badge';
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
  Sparkles
} from 'lucide-react';

interface PipelineStep {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  timestamp?: string;
  progress: number;
}

interface PipelineProgressifProps {
  documentId?: number;
  isComplete?: boolean;
  steps?: PipelineStep[];
}

// Map des icônes pour chaque étape
const STEP_ICONS: Record<string, React.ReactNode> = {
  format: <FileCheck className="h-4 w-4" />,
  antivirus: <ShieldCheck className="h-4 w-4" />,
  metadata: <FileText className="h-4 w-4" />,
  classement: <Database className="h-4 w-4" />,
  tagging: <Tag className="h-4 w-4" />,
  indexation: <Database className="h-4 w-4" />,
  nas: <HardDrive className="h-4 w-4" />
};

export default function PipelineProgressif({ documentId, isComplete = false, steps: externalSteps }: PipelineProgressifProps) {
  const { t } = useTranslation();
  const steps = externalSteps || [
    { id: 'format', label: t.pipeline.etape_format, status: 'pending', progress: 0 },
    { id: 'antivirus', label: t.pipeline.etape_antivirus, status: 'pending', progress: 0 },
    { id: 'metadata', label: t.pipeline.etape_metadata, status: 'pending', progress: 0 },
    { id: 'classement', label: t.pipeline.etape_classement, status: 'pending', progress: 0 },
    { id: 'tagging', label: t.pipeline.etape_tagging, status: 'pending', progress: 0 },
    { id: 'indexation', label: t.pipeline.etape_indexation, status: 'pending', progress: 0 },
    { id: 'nas', label: t.pipeline.etape_chargement, status: 'pending', progress: 0 }
  ];

  const overallProgress = Math.round(
    steps.reduce((acc, step) => acc + (step.status === 'completed' ? 100 : step.progress), 0) / steps.length
  );

  const isRunning = steps.some(step => step.status === 'running');
  const isCompleted = steps.every(step => step.status === 'completed') || isComplete;

  return (
    <Card className={isCompleted ? 'border-green-200' : ''}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            {t.pipeline.titre}
          </span>
          {isRunning && (
            <Badge variant="secondary" className="animate-pulse">
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              {t.pipeline.en_cours}
            </Badge>
          )}
          {isCompleted && (
            <Badge variant="default" className="bg-green-600">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              {t.pipeline.termine}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Barre de progression globale (visible seulement si pas encore 100%) */}
        {!isCompleted && (
          <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t.pipeline.progression_globale}</span>
              <span className="font-medium">{overallProgress}%</span>
            </div>
            <Progress value={overallProgress} className="h-2" />
          </div>
        )}

        {/* Liste des étapes */}
        <div className="space-y-2">
          {steps.map((step) => {
            const Icon = STEP_ICONS[step.id] || <Clock className="h-4 w-4" />;
            
            return (
              <div
                key={step.id}
                className={`p-3 rounded-lg border transition-all duration-300 ${
                  step.status === 'completed' ? 'bg-green-50/50 border-green-200' :
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
                    ) : (
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm flex items-center gap-2">
                        {Icon}
                        {step.label}
                      </span>
                      {step.timestamp && (
                        <span className="text-xs text-muted-foreground font-mono">{step.timestamp}</span>
                      )}
                    </div>
                    
                    {/* Barre de progression individuelle (seulement si en cours) */}
                    {step.status === 'running' && (
                      <Progress value={step.progress} className="h-1.5 mt-1" />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Message de succès final */}
        {isCompleted && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-center animate-in fade-in zoom-in-95">
            <CheckCircle2 className="h-6 w-6 text-green-600 mx-auto mb-2" />
            <p className="text-sm font-medium text-green-800">
              {t.pipeline.succes}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}