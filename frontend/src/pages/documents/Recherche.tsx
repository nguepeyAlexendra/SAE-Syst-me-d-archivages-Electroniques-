import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { rechercherDocuments, type RechercheParams, type RechercheResultat } from '../../api/recherche';
import { listerCategories, type Categorie } from '../../api/admin';
import { useTranslation } from '../../i18n/useTranslation';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Search, Filter, FileText, FileImage, Loader2, Calendar } from 'lucide-react';

const STATUT_VARIANT: Record<string, 'success' | 'destructive' | 'warning' | 'default'> = {
  valide: 'success',
  rejete: 'destructive',
  en_attente: 'warning',
  en_cours: 'default',
};

export default function Recherche() {
  const navigate = useNavigate();
  const { t, langue } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [resultats, setResultats] = useState<RechercheResultat | null>(null);
  const [categories, setCategories] = useState<Categorie[]>([]);
  const [chargement, setChargement] = useState(false);
  const [recherche, setRecherche] = useState(searchParams.get('q') || '');
  const [filtreCategorie, setFiltreCategorie] = useState(searchParams.get('categorie') || '');
  const [filtreStatut, setFiltreStatut] = useState(searchParams.get('statut') || '');
  const [filtreType, setFiltreType] = useState(searchParams.get('type_source') || '');
  const [tri, setTri] = useState(searchParams.get('tri') || '-date_depot');

  useEffect(() => {
    listerCategories().then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    effectuerRecherche();
  }, []);

  async function effectuerRecherche() {
    setChargement(true);
    try {
      const params: RechercheParams = {
        q: recherche || undefined,
        categorie: filtreCategorie ? Number(filtreCategorie) : undefined,
        statut: filtreStatut || undefined,
        type_source: filtreType || undefined,
        tri: tri || undefined,
      };
      const data = await rechercherDocuments(params);
      setResultats(data);

      const newParams = new URLSearchParams();
      if (recherche) newParams.set('q', recherche);
      if (filtreCategorie) newParams.set('categorie', filtreCategorie);
      if (filtreStatut) newParams.set('statut', filtreStatut);
      if (filtreType) newParams.set('type_source', filtreType);
      if (tri) newParams.set('tri', tri);
      setSearchParams(newParams, { replace: true });
    } catch {
      setResultats(null);
    } finally {
      setChargement(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    effectuerRecherche();
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">{t.recherche.titre}</h1>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t.recherche.placeholder}
            className="pl-9"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={chargement}>
          {chargement ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
          {t.recherche.rechercher}
        </Button>
      </form>

      <div className="flex gap-2 flex-wrap">
        <Select value={filtreCategorie} onValueChange={setFiltreCategorie}>
          <SelectTrigger className="w-44">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder={t.recherche.type_document} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.recherche.toutes_categories}</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={String(cat.id)}>{cat.nom}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filtreStatut} onValueChange={setFiltreStatut}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder={t.recherche.statistique} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.recherche.tous_statuts}</SelectItem>
            {(['valide', 'rejete', 'en_attente', 'en_cours'] as const).map((key) => (
              <SelectItem key={key} value={key}>{t.documents[key]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filtreType} onValueChange={setFiltreType}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder={t.recherche.type_document} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.recherche.tous_types}</SelectItem>
            <SelectItem value="numerique">{t.recherche.numerique}</SelectItem>
            <SelectItem value="scan">{t.recherche.scan}</SelectItem>
          </SelectContent>
        </Select>

        <Select value={tri} onValueChange={setTri}>
          <SelectTrigger className="w-40">
            <Calendar className="h-4 w-4 mr-2" />
            <SelectValue placeholder={t.recherche.trier_par} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="-date_depot">{t.recherche.date_recent}</SelectItem>
            <SelectItem value="date_depot">{t.recherche.date_ancien}</SelectItem>
            <SelectItem value="titre">{t.recherche.nom_az}</SelectItem>
            <SelectItem value="-titre">{t.recherche.nom_za}</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="ghost" onClick={() => {
          setRecherche('');
          setFiltreCategorie('');
          setFiltreStatut('');
          setFiltreType('');
          setTri('-date_depot');
        }}>
          {t.recherche.reinitialiser}
        </Button>
      </div>

      {resultats && (
        <p className="text-sm text-muted-foreground">
          {resultats.count} {t.recherche.resultats}
        </p>
      )}

      <div className="space-y-3">
        {resultats?.results.map((doc) => (
          <Card
            key={doc.id}
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate(`/documents/${doc.id}`)}
          >
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                {doc.type_source === 'scan' ? (
                  <FileImage className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <FileText className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{doc.titre}</p>
                <p className="text-sm text-muted-foreground">
                  {doc.depose_par_nom} · {new Date(doc.date_depot).toLocaleDateString(langue === 'en' ? 'en-US' : 'fr-FR')}
                  {doc.categorie_nom && ` · ${doc.categorie_nom}`}
                </p>
              </div>
              <Badge variant={STATUT_VARIANT[doc.statut] || 'default'}>
                {t.documents[doc.statut as keyof typeof t.documents] || doc.statut}
              </Badge>
            </CardContent>
          </Card>
        ))}

        {resultats && resultats.results.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>{t.recherche.aucun_resultat}</p>
          </div>
        )}
      </div>
    </div>
  );
}
