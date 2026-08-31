import { useState, useEffect } from 'react';
import { useTranslation } from '../i18n/useTranslation';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { HardDrive, Database, FileText, AlertCircle, Loader2 } from 'lucide-react';

interface MinioStats {
  buckets_count: number;
  buckets: string[];
  total_objects: number;
  total_size_bytes: number;
  total_size_gb: number;
  status: string;
  error?: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 o';
  const k = 1024;
  const sizes = ['o', 'Ko', 'Mo', 'Go', 'To'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function StatsMinIO() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<MinioStats | null>(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    chargerStats();
  }, []);

  async function chargerStats() {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('http://127.0.0.1:8000/api/documents/minio-stats/', {
        headers: { Authorization: `Token ${token}` }
      });
      setStats(response.data);
    } catch (error) {
      setStats({
        status: 'erreur',
        buckets_count: 0,
        total_objects: 0,
        total_size_bytes: 0,
        total_size_gb: 0,
        buckets: [],
        error: t.admin.minio_erreur_contact
      });
    } finally {
      setChargement(false);
    }
  }

  if (chargement) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground flex items-center justify-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin" /> {t.commun.charger}
        </CardContent>
      </Card>
    );
  }

  const isErreur = stats?.status === 'déconnecté' || stats?.status === 'erreur';

  return (
    <Card className={isErreur ? 'border-destructive' : ''}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            {t.admin.minio_titre}
          </span>
          <Badge variant={isErreur ? 'destructive' : 'default'}>
            {isErreur ? t.admin.minio_erreur : t.admin.minio_connecte}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isErreur ? (
          <div className="flex items-start gap-3 text-destructive p-4 bg-destructive/10 rounded-lg">
            <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium">{t.admin.minio_erreur_donnees}</p>
              <p className="text-xs mt-1 opacity-80">{stats?.error}</p>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-muted rounded-lg text-center">
                <Database className="h-6 w-6 mx-auto mb-2 text-primary" />
                <p className="text-2xl font-bold">{stats?.buckets_count}</p>
                <p className="text-xs text-muted-foreground">{t.admin.minio_buckets}</p>
              </div>
              <div className="p-4 bg-muted rounded-lg text-center">
                <FileText className="h-6 w-6 mx-auto mb-2 text-blue-600" />
                <p className="text-2xl font-bold">{stats?.total_objects.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{t.admin.minio_objets}</p>
              </div>
              <div className="p-4 bg-muted rounded-lg text-center">
                <HardDrive className="h-6 w-6 mx-auto mb-2 text-green-600" />
                <p className="text-2xl font-bold">{formatBytes(stats?.total_size_bytes || 0)}</p>
                <p className="text-xs text-muted-foreground">{t.admin.minio_espace}</p>
              </div>
            </div>

            {stats?.buckets && stats.buckets.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">{t.admin.minio_buckets_dispo}</p>
                <div className="flex flex-wrap gap-2">
                  {stats.buckets.map((bucket) => (
                    <Badge key={bucket} variant="outline" className="text-xs">{bucket}</Badge>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
