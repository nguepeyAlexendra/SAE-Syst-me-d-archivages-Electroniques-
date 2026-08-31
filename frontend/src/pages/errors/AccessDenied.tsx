import { useTranslation } from '../../i18n/useTranslation';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function AccessDenied() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/30 p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader><CardTitle>{t.erreurs.acces_refuse_titre}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">{t.erreurs.acces_refuse_msg}</p>
          <Button onClick={() => navigate('/')}><ArrowLeft className="h-4 w-4 mr-2" /> {t.commun.accueil}</Button>
        </CardContent>
      </Card>
    </div>
  );
}
