import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../i18n/useTranslation';
import { listerDocuments, listerTags, basculerFavori, modifierDocument, type Document, type TagType } from '../../api/documents';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardAction, CardFooter } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '../../components/ui/toggle-group';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../../components/ui/dropdown-menu';
import { Input } from '../../components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import {
  Area, AreaChart, CartesianGrid, XAxis, Tooltip, ResponsiveContainer, YAxis,
} from 'recharts';
import {
  FileText, Image, Video, Pin, Heart, TrendingUp, TrendingDown,
  RefreshCw, MoreVertical, Download, Mail, LayoutList, LayoutGrid,
  Tag, X, Search, Calendar, Info,
} from 'lucide-react';
import DocumentGrid from '../documents/DocumentGrid';
import PartagerModal from '../../components/PartagerModal';
import DetailsDocumentModal from '../../components/DetailsDocumentModal';
import TableFooter from '../../components/TableFooter';
import SelectionToolbar from '../../components/SelectionToolbar';
import FiltreDate, { type FiltreDateValeur, FILTRE_DATE_VIDE } from '../../components/FiltreDate';
import { useSelection } from '../../hooks/useSelection';
import { toast } from 'sonner';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 o';
  const k = 1024;
  const sizes = ['o', 'Ko', 'Mo', 'Go', 'To'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export default function DashboardPersonnel() {
  const navigate = useNavigate();
  const { utilisateur } = useAuth();
  const { t, langue } = useTranslation();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [chargement, setChargement] = useState(true);
  const [periodeGraph, setPeriodeGraph] = useState('90d');
  const [ongletDocs, setOngletDocs] = useState('documents');
  const [vueDocs, setVueDocs] = useState<'grille' | 'liste'>('grille');
  const [pageDocs, setPageDocs] = useState(1);
  const [rowsDocs, setRowsDocs] = useState(5);
  const [showShareModal, setShowShareModal] = useState<Document | null>(null);
  const [detailsDoc, setDetailsDoc] = useState<Document | null>(null);
  const [tagsDisponibles, setTagsDisponibles] = useState<TagType[]>([]);
  const [tagFiltre, setTagFiltre] = useState('');
  const [rechercheTag, setRechercheTag] = useState('');
  const [tagMenuOuvert, setTagMenuOuvert] = useState(false);
  const [rechercheNom, setRechercheNom] = useState('');
  const [filtreDateDocs, setFiltreDateDocs] = useState<FiltreDateValeur>(FILTRE_DATE_VIDE);
  const [ordreDate, setOrdreDate] = useState('');
  const [ordreNom, setOrdreNom] = useState('');
  const [dateActiviteDebut, setDateActiviteDebut] = useState('');
  const [dateActiviteFin, setDateActiviteFin] = useState('');
  const [modeDateActivite, setModeDateActivite] = useState<'plage' | 'precise'>('plage');
  const [dateActivitePrecise, setDateActivitePrecise] = useState('');
  const selection = useSelection();

  const charger = useCallback(async () => {
    try {
      setChargement(true);
      const docs = await listerDocuments();
      setDocuments(docs);
    } catch {
      toast.error(t.commun.erreur);
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => { charger(); }, [charger]);
  useEffect(() => { listerTags().then(setTagsDisponibles).catch(() => {}); }, []);

  const totalStockage = useMemo(() =>
    documents.reduce((acc, d) => acc + (d.taille_fichier || 0), 0),
  [documents]);

  const epingles = useMemo(() =>
    documents.filter((d) => d.est_epingle),
  [documents]);

  const activiteHebdo = useMemo(() => {
    const jours: { date: string; count: number }[] = [];
    let debut: Date;
    let fin: Date;
    if (modeDateActivite === 'precise' && dateActivitePrecise) {
      debut = new Date(dateActivitePrecise + 'T00:00:00');
      fin = new Date(dateActivitePrecise + 'T00:00:00');
    } else if (dateActiviteDebut && dateActiviteFin) {
      debut = new Date(dateActiviteDebut + 'T00:00:00');
      fin = new Date(dateActiviteFin + 'T00:00:00');
      if (fin < debut) [debut, fin] = [fin, debut];
    } else {
      const now = new Date();
      const nbJours = periodeGraph === '7d' ? 7 : periodeGraph === '30d' ? 30 : periodeGraph === '180d' ? 180 : 90;
      debut = new Date(now);
      debut.setDate(debut.getDate() - nbJours + 1);
      fin = now;
    }
    const diff = Math.round((fin.getTime() - debut.getTime()) / 86400000);
    for (let i = 0; i <= diff; i++) {
      const d = new Date(debut);
      d.setDate(d.getDate() + i);
      jours.push({ date: d.toISOString().slice(0, 10), count: 0 });
    }
    documents.forEach((doc) => {
      const ds = doc.date_depot?.slice(0, 10);
      const idx = jours.findIndex((j) => j.date === ds);
      if (idx !== -1) jours[idx].count++;
    });
    return jours;
  }, [documents, periodeGraph, modeDateActivite, dateActiviteDebut, dateActiviteFin, dateActivitePrecise]);

  const docsFiltres = useMemo(() => {
    let result: Document[];
    switch (ongletDocs) {
      case 'epingles':
        result = epingles;
        break;
      case 'favoris':
        result = documents.filter((d) => d.favoris?.includes(utilisateur?.id ?? -1));
        break;
      default:
        result = documents.filter((d) => d.groupe === ongletDocs);
    }
    if (tagFiltre) {
      result = result.filter((d) => (d.tags_detail || []).some((t) => t.nom === tagFiltre));
    }
    if (rechercheNom) {
      result = result.filter((d) => d.titre.toLowerCase().includes(rechercheNom.toLowerCase()));
    }
    if (filtreDateDocs.mode === 'precise' && filtreDateDocs.precise) {
      result = result.filter((d) => !d.date_depot || d.date_depot.slice(0, 10) === filtreDateDocs.precise);
    } else {
      if (filtreDateDocs.debut) {
        result = result.filter((d) => !d.date_depot || d.date_depot.slice(0, 10) >= filtreDateDocs.debut);
      }
      if (filtreDateDocs.fin) {
        result = result.filter((d) => !d.date_depot || d.date_depot.slice(0, 10) <= filtreDateDocs.fin);
      }
    }
    const resultat = [...result];
    if (ordreNom) {
      resultat.sort((a, b) => a.titre.localeCompare(b.titre, langue === 'en' ? 'en' : 'fr') * (ordreNom === 'desc' ? -1 : 1));
    } else if (ordreDate) {
      resultat.sort((a, b) => (new Date(a.date_depot).getTime() - new Date(b.date_depot).getTime()) * (ordreDate === 'desc' ? -1 : 1));
    } else {
      resultat.sort((a, b) => new Date(b.date_depot).getTime() - new Date(a.date_depot).getTime());
    }
    return resultat;
  }, [documents, ongletDocs, epingles, utilisateur?.id, tagFiltre, rechercheNom, filtreDateDocs, ordreDate, ordreNom, langue]);

  const totalPages = Math.ceil(docsFiltres.length / rowsDocs);
  const docsPagines = docsFiltres.slice((pageDocs - 1) * rowsDocs, pageDocs * rowsDocs);

  const tendance = useMemo(() => {
    if (activiteHebdo.length < 4) return undefined;
    const milieu = Math.floor(activiteHebdo.length / 2);
    const debut = activiteHebdo.slice(0, milieu).reduce((s, j) => s + j.count, 0);
    const fin = activiteHebdo.slice(milieu).reduce((s, j) => s + j.count, 0);
    if (debut === 0 && fin === 0) return undefined;
    if (debut === 0) return { valeur: 100, up: true };
    const diff = ((fin - debut) / debut) * 100;
    if (Math.abs(diff) < 1) return undefined;
    return { valeur: diff, up: diff >= 0 };
  }, [activiteHebdo]);

  const GROUPE_ICONE: Record<string, React.ElementType> = { documents: FileText, images: Image, medias: Video, epingles: Pin, favoris: Heart };
  const STATUT_VARIANT: Record<string, 'success' | 'destructive' | 'warning' | 'default'> = {
    valide: 'success', rejete: 'destructive', en_attente: 'warning', en_cours: 'default',
  };
  const statutLabel: Record<string, string> = {
    valide: t.documents.valide, rejete: t.documents.rejete, en_attente: t.documents.en_attente, en_cours: t.documents.en_cours,
  };

  const docsOrigine = useMemo(() => docsFiltres.filter((d) => d.est_departement_origine !== false), [docsFiltres]);
  const docsExternes = useMemo(() => docsFiltres.filter((d) => d.est_departement_origine === false), [docsFiltres]);
  const docsAffiches = useMemo(() => docsExternes.length === 0 ? docsOrigine : [...docsOrigine, ...docsExternes], [docsOrigine, docsExternes]);
  const docsPaginesAffiches = docsAffiches.slice((pageDocs - 1) * rowsDocs, pageDocs * rowsDocs);

  function handleShareSelected() {
    const first = documents.find((d) => selection.selected.has(d.id));
    if (first) setShowShareModal(first);
  }

  const docsSelectionnes = useMemo(
    () => documents.filter((d) => selection.selected.has(d.id)),
    [documents, selection.selected]
  );
  const tousFavoris = docsSelectionnes.length > 0 && docsSelectionnes.every((d) => d.favoris?.includes(utilisateur?.id ?? -1));
  const tousEpingles = docsSelectionnes.length > 0 && docsSelectionnes.every((d) => d.est_epingle);

  async function handleFavoriSelected() {
    for (const id of [...selection.selected]) {
      const doc = documents.find((d) => d.id === id);
      const estFav = doc?.favoris?.includes(utilisateur?.id ?? -1);
      if ((tousFavoris && estFav) || (!tousFavoris && !estFav)) {
        try { await basculerFavori(id); } catch {}
      }
    }
    const [docs] = await Promise.all([listerDocuments()]);
    setDocuments(docs);
    toast.success(tousFavoris ? t.documents.retire_favoris : t.documents.ajoute_favoris);
  }

  async function handleEpingleSelected() {
    for (const id of [...selection.selected]) {
      try { await modifierDocument(id, { est_epingle: !tousEpingles }); } catch {}
    }
    const [docs] = await Promise.all([listerDocuments()]);
    setDocuments(docs);
    toast.success(tousEpingles ? t.documents.detache_label : t.documents.epingle_label);
  }

  async function handleFavori(doc: Document, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await basculerFavori(doc.id);
      const [docs] = await Promise.all([listerDocuments()]);
      setDocuments(docs);
      const estFav = doc.favoris?.includes(utilisateur?.id ?? -1);
      toast.success(estFav ? t.documents.retire_favoris : t.documents.ajoute_favoris);
    } catch {
      toast.error(t.commun.erreur);
    }
  }

  if (chargement) return <div className="p-8 text-muted-foreground">{t.commun.charger}</div>;

  return (
    <div className="flex flex-1 flex-col gap-4 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t.nav.tableau_de_bord}</h1>
          <p className="text-sm text-muted-foreground">{t.dashboard.admin_bienvenue}, {utilisateur?.username}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={charger}>
            <RefreshCw className="h-4 w-4 mr-1" /> {t.dashboard.actualiser}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t.dashboard.total_documents}</CardDescription>
            <CardTitle className="text-3xl">
              {documents.length}
              {tendance && (tendance.up ? <TrendingUp className="size-4 inline ml-2 text-green-500" /> : <TrendingDown className="size-4 inline ml-2 text-red-500" />)}
            </CardTitle>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1 text-sm">
            <div className="flex gap-1 font-medium">{tendance ? (tendance.up ? t.dashboard.en_hausse : t.dashboard.en_baisse) : t.dashboard.stable}</div>
            <div className="text-muted-foreground">{t.dashboard.documents_uploades}</div>
          </CardFooter>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t.dashboard.stockage}</CardDescription>
            <CardTitle className="text-3xl">{formatBytes(totalStockage)}</CardTitle>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1 text-sm">
            <div className="font-medium">{t.dashboard.espace_utilise}</div>
            <div className="text-muted-foreground">{t.dashboard.stockage_total_detail}</div>
          </CardFooter>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t.dashboard.documents_epingles}</CardDescription>
            <CardTitle className="text-3xl">{epingles.length}</CardTitle>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1 text-sm">
            <div className="font-medium">{epingles.length} {t.dashboard.docs_epingles_count}</div>
            <div className="text-muted-foreground">{t.dashboard.total_documents}</div>
          </CardFooter>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t.dashboard.activite_depots}</CardTitle>
          <CardDescription>{t.dashboard.docs_deposes_periode}</CardDescription>
          <CardAction>
            <div className="flex items-center gap-2">
              <ToggleGroup type="single" value={periodeGraph} onValueChange={(v) => v && setPeriodeGraph(v)} variant="outline" className="hidden md:flex">
                <ToggleGroupItem value="7d">{t.dashboard.periode_7j}</ToggleGroupItem>
                <ToggleGroupItem value="30d">{t.dashboard.periode_30j}</ToggleGroupItem>
                <ToggleGroupItem value="90d">{t.dashboard.periode_3mois}</ToggleGroupItem>
                <ToggleGroupItem value="180d">{t.dashboard.periode_6mois}</ToggleGroupItem>
              </ToggleGroup>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
                    <Calendar className="h-3.5 w-3.5" />
                    <span className="max-w-[120px] truncate">
                      {modeDateActivite === 'precise' && dateActivitePrecise
                        ? new Date(dateActivitePrecise).toLocaleDateString(langue === 'en' ? 'en-US' : 'fr-FR')
                        : (dateActiviteDebut || dateActiviteFin)
                          ? `${dateActiviteDebut || '…'} → ${dateActiviteFin || '…'}`
                          : t.documents.date}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 space-y-3" align="start">
                  <div className="flex gap-1">
                    <Button size="sm" variant={modeDateActivite === 'plage' ? 'default' : 'outline'} className="flex-1" onClick={() => setModeDateActivite('plage')}>
                      {t.documents.periode}
                    </Button>
                    <Button size="sm" variant={modeDateActivite === 'precise' ? 'default' : 'outline'} className="flex-1" onClick={() => setModeDateActivite('precise')}>
                      {t.documents.date_precise}
                    </Button>
                  </div>
                  {modeDateActivite === 'plage' ? (
                    <div className="space-y-2">
                      <div>
                        <label className="text-xs text-muted-foreground">{t.documents.du}</label>
                        <input type="date" value={dateActiviteDebut} onChange={(e) => setDateActiviteDebut(e.target.value)}
                          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm" />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">{t.documents.au}</label>
                        <input type="date" value={dateActiviteFin} onChange={(e) => setDateActiviteFin(e.target.value)}
                          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm" />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="text-xs text-muted-foreground">{t.documents.date}</label>
                      <input type="date" value={dateActivitePrecise} onChange={(e) => setDateActivitePrecise(e.target.value)}
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm" />
                    </div>
                  )}
                  <Button size="sm" variant="ghost" className="w-full" onClick={() => { setDateActiviteDebut(''); setDateActiviteFin(''); setDateActivitePrecise(''); }}>
                    {t.documents.reinitialiser}
                  </Button>
                </PopoverContent>
              </Popover>
            </div>
          </CardAction>
        </CardHeader>
        <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
          <div className="h-[250px] w-full">
            {activiteHebdo.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={activiteHebdo}>
                  <defs>
                    <linearGradient id="fillActivity" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={1.0} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} className="stroke-muted" />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} tick={{ fontSize: 11 }}
                    tickFormatter={(v) => new Date(v).toLocaleDateString(langue === 'en' ? 'en-US' : 'fr-FR', { month: 'short', day: 'numeric' })} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                  <Tooltip cursor={false}
                    contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                    labelFormatter={(v: any) => new Date(v).toLocaleDateString(langue === 'en' ? 'en-US' : 'fr-FR', { month: 'long', day: 'numeric', year: 'numeric' })}
                    formatter={(value: any) => [value, t.dashboard.outil_deposes]} />
                  <Area type="natural" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#fillActivity)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">{t.dashboard.aucune_activite}</div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <CardTitle className="text-base">{t.dashboard.derniers_documents}</CardTitle>
              <ToggleGroup type="single" value={ongletDocs} onValueChange={(v) => { v && setOngletDocs(v); setPageDocs(1); }} variant="outline">
                <ToggleGroupItem value="documents" className="gap-1.5 text-xs"><FileText className="h-3.5 w-3.5" /> {t.documents.groupe_docs}</ToggleGroupItem>
                <ToggleGroupItem value="images" className="gap-1.5 text-xs"><Image className="h-3.5 w-3.5" /> {t.documents.groupe_images}</ToggleGroupItem>
                <ToggleGroupItem value="medias" className="gap-1.5 text-xs"><Video className="h-3.5 w-3.5" /> {t.documents.groupe_medias}</ToggleGroupItem>
                <ToggleGroupItem value="epingles" className="gap-1.5 text-xs"><Pin className="h-3.5 w-3.5" /> {t.dashboard.documents_epingles}</ToggleGroupItem>
                <ToggleGroupItem value="favoris" className="gap-1.5 text-xs"><Heart className="h-3.5 w-3.5" /> {t.favoris.titre}</ToggleGroupItem>
              </ToggleGroup>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <div className="relative flex-1 min-w-[160px] max-w-[220px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder={t.documents.rechercher}
                  className="h-8 pl-8 text-xs"
                  value={rechercheNom}
                  onChange={(e) => { setRechercheNom(e.target.value); setPageDocs(1); }}
                />
              </div>
              <FiltreDate
                valeur={filtreDateDocs}
                onChange={(v) => { setFiltreDateDocs(v); setPageDocs(1); }}
                labelAucun={t.documents.date}
              />
              <div className="relative">
                <Button
                  variant={tagFiltre ? "default" : "outline"}
                  size="sm"
                  className="gap-1.5 text-xs h-8"
                  onClick={() => setTagMenuOuvert(!tagMenuOuvert)}
                >
                  <Tag className="h-3.5 w-3.5" />
                  {tagFiltre || t.documents.tags}
                </Button>
                {tagMenuOuvert && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setTagMenuOuvert(false)} />
                    <div className="absolute left-0 top-full mt-1 z-50 w-72 rounded-md border bg-white dark:bg-gray-900 p-4 shadow-lg">
                      <div className="space-y-4">
                        <div>
                          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">{t.commun.rechercher}</p>
                          <Input
                            type="text"
                            placeholder={t.documents.taper_tag}
                            value={rechercheTag}
                            onChange={(e) => setRechercheTag(e.target.value)}
                            className="h-9 text-sm"
                          />
                        </div>
                        <div className="border-t pt-3">
                          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">{t.commun.choisir}</p>
                          <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                            {tagsDisponibles
                              .filter((t) => t.nom.toLowerCase().includes(rechercheTag.toLowerCase()))
                              .map((t) => (
                                <button
                                  key={t.id}
                                  onClick={() => { setTagFiltre(t.nom === tagFiltre ? '' : t.nom); setPageDocs(1); setTagMenuOuvert(false); }}
                                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition-all text-gray-700 dark:text-gray-200 ${
                                    tagFiltre === t.nom
                                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-bold'
                                      : 'border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800'
                                  }`}
                                >
                                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.couleur }} />
                                  {t.nom}
                                </button>
                              ))}
                            {tagsDisponibles.length === 0 && (
                              <p className="text-xs text-gray-500 dark:text-gray-400">{t.documents.tag_dispo}</p>
                            )}
                          </div>
                        </div>
                        {tagFiltre && (
                          <button
                            onClick={() => { setTagFiltre(''); setRechercheTag(''); setPageDocs(1); setTagMenuOuvert(false); }}
                            className="w-full text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 border-t pt-2 text-center"
                          >
                            <X className="h-3 w-3 inline mr-1" />{t.commun.effacer_filtre}
                          </button>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
              <ToggleGroup type="single" value={vueDocs} onValueChange={(v) => v && setVueDocs(v as 'grille' | 'liste')} className="bg-muted rounded-lg p-1">
              <ToggleGroupItem value="grille" className="h-7 w-7 p-0"><LayoutGrid className="h-3.5 w-3.5" /></ToggleGroupItem>
              <ToggleGroupItem value="liste" className="h-7 w-7 p-0"><LayoutList className="h-3.5 w-3.5" /></ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>
        </CardHeader>
        <CardContent className="p-0">
          {docsFiltres.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">{t.dashboard.aucun_doc_categorie}</div>
          ) : vueDocs === 'grille' ? (
            <>
              <div className="p-6 pt-0">
                <DocumentGrid documents={docsPagines} onRefresh={charger} />
              </div>
              <TableFooter
                currentPage={pageDocs}
                totalPages={totalPages}
                rowsPerPage={rowsDocs}
                totalRows={docsFiltres.length}
                onPageChange={setPageDocs}
                onRowsPerPageChange={(rows) => { setRowsDocs(rows); setPageDocs(1); }}
              />
            </>
          ) : (
            <>
              <div className="p-6 pt-0">
                <SelectionToolbar
                  count={selection.size}
                  onFavori={handleFavoriSelected}
                  onEpingle={handleEpingleSelected}
                  onPartager={handleShareSelected}
                  onClear={selection.clear}
                  etatFavori={tousFavoris ? 'remove' : 'add'}
                  etatEpingle={tousEpingles ? 'remove' : 'add'}
                />
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <input type="checkbox" className="h-4 w-4 rounded border-gray-300"
                          checked={selection.size === docsPaginesAffiches.length && docsPaginesAffiches.length > 0}
                          onChange={() => {
                            if (selection.size === docsPaginesAffiches.length) selection.clear();
                            else docsPaginesAffiches.forEach((d) => { if (!selection.isSelected(d.id)) selection.toggle(d.id); });
                          }}
                        />
                      </TableHead>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>{t.documents.titre}</TableHead>
                      <TableHead className="hidden md:table-cell">{t.documents.departement}</TableHead>
                      <TableHead>{t.documents.statut}</TableHead>
                      <TableHead className="hidden sm:table-cell">{t.documents.date}</TableHead>
                      <TableHead className="w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {docsExternes.length > 0 && docsOrigine.length > 0 && pageDocs === 1 && (
                      <TableRow>
                        <TableCell colSpan={7} className="bg-muted/30 py-2 text-xs text-muted-foreground font-medium">
                          {t.documents.mes_documents}
                        </TableCell>
                      </TableRow>
                    )}
                    {(() => {
                      const rows: JSX.Element[] = [];
                      let externesHeaderShown = false;
                      docsPaginesAffiches.forEach((doc) => {
                        if (!externesHeaderShown && doc.est_departement_origine === false && docsExternes.length > 0) {
                          externesHeaderShown = true;
                          rows.push(
                            <TableRow key="externes-header">
                              <TableCell colSpan={7} className="bg-amber-50 dark:bg-amber-950/20 py-2 text-xs text-amber-700 dark:text-amber-400 font-medium">
                                {t.documents.acces_externe} {doc.departement_nom ? `${t.documents.du_departement} ${langue === 'en' ? (doc.departement_nom_en || doc.departement_nom) : doc.departement_nom}.` : ''}
                              </TableCell>
                            </TableRow>
                          );
                        }
                        const Icone = (doc.groupe && GROUPE_ICONE[doc.groupe]) || FileText;
                        rows.push(
<TableRow key={doc.id} className={`cursor-pointer ${doc.est_departement_origine === false ? 'bg-amber-50/40 dark:bg-amber-950/10' : ''} ${detailsDoc?.id === doc.id ? 'ring-1 ring-inset ring-primary bg-primary/5' : ''}`}
            onClick={() => navigate(`/documents/${doc.id}`)}
          >
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <input type="checkbox" className="h-4 w-4 rounded border-gray-300"
                                checked={selection.isSelected(doc.id)}
                                onChange={() => selection.toggle(doc.id)}
                              />
                            </TableCell>
                            <TableCell><Icone className="h-4 w-4 text-muted-foreground" /></TableCell>
                            <TableCell className="font-medium">{doc.titre}</TableCell>
                            <TableCell className="hidden md:table-cell text-muted-foreground">{langue === 'en' ? (doc.departement_nom_en || doc.departement_nom || '—') : (doc.departement_nom || '—')}</TableCell>
                            <TableCell>
                              <Badge variant={STATUT_VARIANT[doc.statut] || 'default'} className="text-[10px]">
                                {statutLabel[doc.statut] || doc.statut}
                              </Badge>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell text-muted-foreground text-xs">
                              {new Date(doc.date_depot).toLocaleDateString(langue === 'en' ? 'en-US' : 'fr-FR')}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-0.5" onClick={(e) => e.stopPropagation()}>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => handleFavori(doc, e)} title={doc.favoris?.includes(utilisateur?.id ?? -1) ? t.documents.retirer_favori : t.documents.favori}>
                                  <Heart className={`h-3.5 w-3.5 ${doc.favoris?.includes(utilisateur?.id ?? -1) ? 'fill-red-500 text-red-500' : ''}`} />
                                </Button>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                    <Button variant="ghost" size="icon" className="h-7 w-7"><MoreVertical className="h-3.5 w-3.5" /></Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-48">
                                    <DropdownMenuItem onClick={() => setDetailsDoc(doc)}>
                                      <Info className="h-4 w-4 mr-2" />{t.documents.details}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => window.open(doc.fichier, '_blank')}>
                                      <Download className="h-4 w-4 mr-2" />{t.documents.telecharger}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setShowShareModal(doc)}>
                                      <Mail className="h-4 w-4 mr-2" />{t.documents.partager_email}
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      });
                      return rows;
                    })()}
                  </TableBody>
                </Table>
                <TableFooter
                  currentPage={pageDocs}
                  totalPages={Math.ceil(docsAffiches.length / rowsDocs)}
                  rowsPerPage={rowsDocs}
                  totalRows={docsAffiches.length}
                  onPageChange={setPageDocs}
                  onRowsPerPageChange={(rows) => { setRowsDocs(rows); setPageDocs(1); }}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {showShareModal && (
        <PartagerModal document={showShareModal} onClose={() => setShowShareModal(null)} />
      )}
      {detailsDoc && (
        <DetailsDocumentModal document={detailsDoc} onClose={() => setDetailsDoc(null)} />
      )}
    </div>
  );
}
