import { useState, useEffect, useMemo, useCallback, type JSX } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../i18n/useTranslation';
import { getSystemStats, listerUtilisateurs, type SystemStats, type Utilisateur } from '../../api/admin';
import { listerDocuments, basculerFavori, listerTags, archiverDocument, desarchiverDocument, modifierDocument, type Document, type TagType, getLogs, type LogAction } from '../../api/documents';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardAction, CardFooter } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '../../components/ui/toggle-group';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../../components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover';
import { Area, AreaChart, CartesianGrid, XAxis, Tooltip, ResponsiveContainer, YAxis, PieChart, Pie, Cell } from 'recharts';
import { Progress } from '../../components/ui/progress';

import {
  FileText, Image, Video, ShieldCheck, TrendingUp, TrendingDown,
  RefreshCw, MoreVertical, Heart, Download, Mail, Edit, Archive, Trash2, Lock as LockIcon, Unlock, Pin, Info,
  LayoutList, LayoutGrid, Search, Calendar, MessageCircle,
} from 'lucide-react';
import DocumentGrid from '../documents/DocumentGrid';
import PartagerModal from '../../components/PartagerModal';
import DetailsDocumentModal from '../../components/DetailsDocumentModal';
import TableFooter from '../../components/TableFooter';
import SelectionToolbar from '../../components/SelectionToolbar';
import TagFilterPopover from '../../components/TagFilterPopover';
import FiltreDate, { type FiltreDateValeur, FILTRE_DATE_VIDE } from '../../components/FiltreDate';
import { useSelection } from '../../hooks/useSelection';
import { toast } from 'sonner';
import { AIDropdownTrigger } from '../../components/ui/AIIcon';

export default function DashboardAdmin() {
  const { utilisateur } = useAuth();
  const { t, langue } = useTranslation();
  const navigate = useNavigate();
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [utilisateurs, setUtilisateurs] = useState<Utilisateur[]>([]);
  const [tousDocs, setTousDocs] = useState<Document[]>([]);
  const [chargement, setChargement] = useState(true);
  const [periodeGraph, setPeriodeGraph] = useState('90d');
  const [ongletDocs, setOngletDocs] = useState('documents');
  const [vueDocs, setVueDocs] = useState<'grille' | 'liste'>('grille');
  const [pageDocs, setPageDocs] = useState(1);
  const [rowsDocs, setRowsDocs] = useState(5);
  const [showShareModal, setShowShareModal] = useState<Document | null>(null);
  const [detailsDoc, setDetailsDoc] = useState<Document | null>(null);
  const [editDoc, setEditDoc] = useState<Document | null>(null);
  const [editTitre, setEditTitre] = useState('');
  const [tagsDisponibles, setTagsDisponibles] = useState<TagType[]>([]);
  const [tagFiltre, setTagFiltre] = useState('');
  const [rechercheNom, setRechercheNom] = useState('');
  const [filtreDateDocs, setFiltreDateDocs] = useState<FiltreDateValeur>(FILTRE_DATE_VIDE);
  const [dateActiviteDebut, setDateActiviteDebut] = useState('');
  const [dateActiviteFin, setDateActiviteFin] = useState('');
  const [modeDateActivite, setModeDateActivite] = useState<'plage' | 'precise'>('plage');
  const [dateActivitePrecise, setDateActivitePrecise] = useState('');
  const selection = useSelection();

  function getStatsParams() {
    const jours = periodeGraph === '7d' ? '7' : periodeGraph === '30d' ? '30' : periodeGraph === '180d' ? '180' : '90';
    const params: Record<string, string> = { days: jours };
    if (modeDateActivite === 'precise' && dateActivitePrecise) {
      params.date_debut_activite = dateActivitePrecise;
      params.date_fin_activite = dateActivitePrecise;
    } else {
      if (dateActiviteDebut) params.date_debut_activite = dateActiviteDebut;
      if (dateActiviteFin) params.date_fin_activite = dateActiviteFin;
    }
    return params;
  }

  const chargerStats = useCallback(() => {
    getSystemStats(getStatsParams()).then(setStats).catch(() => {});
  }, [periodeGraph, modeDateActivite, dateActiviteDebut, dateActiviteFin, dateActivitePrecise]);

  const rafraichir = useCallback(async () => {
    try {
      setChargement(true);
      const [data, utilisateursData, docs] = await Promise.all([
        getSystemStats(getStatsParams()),
        listerUtilisateurs(),
        listerDocuments(),
      ]);
      setStats(data);
      setUtilisateurs(utilisateursData);
      setTousDocs(docs);
    } catch {
      toast.error(t.commun.erreur);
    } finally {
      setChargement(false);
    }
  }, [periodeGraph, modeDateActivite, dateActiviteDebut, dateActiviteFin, dateActivitePrecise]);

  useEffect(() => { rafraichir(); }, []);
  useEffect(() => { if (stats) chargerStats(); }, [chargerStats]);
  useEffect(() => { listerTags().then(setTagsDisponibles).catch(() => {}); }, []);

  const txValidation = stats && stats.total > 0 ? ((stats.valide / stats.total) * 100) : 0;

  const tendance = useMemo(() => {
    if (!stats?.activite_hebdo || stats.activite_hebdo.length < 4) return undefined;
    const milieu = Math.floor(stats.activite_hebdo.length / 2);
    const debut = stats.activite_hebdo.slice(0, milieu).reduce((s, j) => s + j.count, 0);
    const fin = stats.activite_hebdo.slice(milieu).reduce((s, j) => s + j.count, 0);
    if (debut === 0 && fin === 0) return undefined;
    if (debut === 0) return { valeur: 100, up: true };
    const diff = ((fin - debut) / debut) * 100;
    if (Math.abs(diff) < 1) return undefined;
    return { valeur: diff, up: diff >= 0 };
  }, [stats?.activite_hebdo]);

  const topDepartement = useMemo(() => {
    if (!stats?.par_departement?.length) return undefined;
    return [...stats.par_departement].sort((a, b) => b.total - a.total)[0];
  }, [stats?.par_departement]);

  const docsFiltres = useMemo(() => {
    let result = ongletDocs === 'confidentiels'
      ? tousDocs.filter((d) => d.est_confidentiel)
      : tousDocs.filter((d) => d.groupe === ongletDocs);
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
    return [...result].sort((a, b) => new Date(b.date_depot).getTime() - new Date(a.date_depot).getTime());
  }, [tousDocs, ongletDocs, tagFiltre, rechercheNom, filtreDateDocs]);

  const totalPages = Math.ceil(docsFiltres.length / rowsDocs);
  const docsPagines = docsFiltres.slice((pageDocs - 1) * rowsDocs, pageDocs * rowsDocs);

  const estAdmin = utilisateur?.est_admin === true;

  async function handleFavori(doc: Document, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await basculerFavori(doc.id);
      const [docs] = await Promise.all([listerDocuments()]);
      setTousDocs(docs);
    } catch { toast.error(t.commun.erreur); }
  }

  async function handleToggleConfidentiel(doc: Document) {
    try {
      await modifierDocument(doc.id, { est_confidentiel: !doc.est_confidentiel });
      const [docs] = await Promise.all([listerDocuments()]);
      setTousDocs(docs);
      toast.success(doc.est_confidentiel ? t.documents.confidentialite_retiree : t.documents.rendu_confidentiel);
    } catch { toast.error(t.commun.erreur); }
  }

  async function handleArchiver(doc: Document) {
    try {
      await archiverDocument(doc.id);
      const [docs] = await Promise.all([listerDocuments()]);
      setTousDocs(docs);
      toast.success(t.documents.archive_label);
    } catch { toast.error(t.commun.erreur); }
  }

  async function handleModifier(e: React.FormEvent) {
    e.preventDefault();
    if (!editDoc) return;
    try {
      await modifierDocument(editDoc.id, { titre: editTitre });
      toast.success(t.documents.modifie_label);
      setEditDoc(null);
      setEditTitre('');
      const [docs] = await Promise.all([listerDocuments()]);
      setTousDocs(docs);
    } catch { toast.error(t.commun.erreur); }
  }

  const GROUPE_ICONE: Record<string, React.ElementType> = { documents: FileText, images: Image, medias: Video };
  const STATUT_VARIANT: Record<string, 'success' | 'destructive' | 'warning' | 'default'> = {
    valide: 'success', rejete: 'destructive', en_attente: 'warning', en_cours: 'default',
  };
  const statutLabel: Record<string, string> = {
    valide: t.documents.valide, rejete: t.documents.rejete, en_attente: t.documents.en_attente, en_cours: t.documents.en_cours,
  };

  const docsOrigine = useMemo(() => docsFiltres.filter((d) => d.est_departement_origine !== false), [docsFiltres]);
  const docsExternes = useMemo(() => docsFiltres.filter((d) => d.est_departement_origine === false), [docsFiltres]);

  const docsAffiches = useMemo(() => {
    if (docsExternes.length === 0) return docsOrigine;
    return [...docsOrigine, ...docsExternes];
  }, [docsOrigine, docsExternes]);

  const totalPagesAffiches = Math.ceil(docsAffiches.length / rowsDocs);
  const docsPaginesAffiches = docsAffiches.slice((pageDocs - 1) * rowsDocs, pageDocs * rowsDocs);

  function handleShareSelected() {
    const first = tousDocs.find((d) => selection.selected.has(d.id));
    if (first) setShowShareModal(first);
  }

  const docsSelectionnes = useMemo(
    () => tousDocs.filter((d) => selection.selected.has(d.id)),
    [tousDocs, selection.selected]
  );
  const tousFavoris = docsSelectionnes.length > 0 && docsSelectionnes.every((d) => d.favoris?.includes(utilisateur?.id ?? -1));
  const tousEpingles = docsSelectionnes.length > 0 && docsSelectionnes.every((d) => d.est_epingle);
  const tousConfidentiels = docsSelectionnes.length > 0 && docsSelectionnes.every((d) => d.est_confidentiel);
  const tousArchives = docsSelectionnes.length > 0 && docsSelectionnes.every((d) => d.est_supprime);

  async function rechargerTousDocs() {
    const [docs] = await Promise.all([listerDocuments()]);
    setTousDocs(docs);
  }

  async function handleFavoriSelected() {
    for (const id of [...selection.selected]) {
      const doc = tousDocs.find((d) => d.id === id);
      const estFav = doc?.favoris?.includes(utilisateur?.id ?? -1);
      if ((tousFavoris && estFav) || (!tousFavoris && !estFav)) {
        try { await basculerFavori(id); } catch {}
      }
    }
    await rechargerTousDocs();
    toast.success(tousFavoris ? t.documents.retire_favoris : t.documents.ajoute_favoris);
  }

  async function handleEpingleSelected() {
    for (const id of [...selection.selected]) {
      try { await modifierDocument(id, { est_epingle: !tousEpingles }); } catch {}
    }
    await rechargerTousDocs();
    toast.success(tousEpingles ? t.documents.detache_label : t.documents.epingle_label);
  }

  async function handleConfidentielSelected() {
    for (const id of [...selection.selected]) {
      try {
        await modifierDocument(id, { est_confidentiel: !tousConfidentiels });
      } catch {}
    }
    await rechargerTousDocs();
    toast.success(tousConfidentiels ? t.documents.confidentialite_retiree : t.documents.rendu_confidentiel);
  }

  async function handleArchiverSelected() {
    for (const id of [...selection.selected]) {
      try {
        if (tousArchives) await desarchiverDocument(id);
        else await archiverDocument(id);
      } catch {}
    }
    await rechargerTousDocs();
    selection.clear();
    toast.success(tousArchives ? t.documents.desarchive_label : t.documents.archive_label);
  }

  if (chargement) return <div className="p-8 text-muted-foreground">{t.commun.charger}</div>;

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-8 min-w-0 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t.dashboard.admin_titre}</h1>
          <p className="text-sm text-muted-foreground">{t.dashboard.admin_bienvenue}, {utilisateur?.username}</p>
        </div>
        <div className="flex items-center gap-2">
          <AIDropdownTrigger />
          <Button variant="outline" size="sm" onClick={rafraichir}>
            <RefreshCw className="h-4 w-4 mr-1" /> {t.dashboard.actualiser}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t.dashboard.total_documents}</CardDescription>
            <CardTitle className="text-3xl">
              {stats?.total ?? 0}
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
            <CardDescription>{t.documents.confidentiel_titre}</CardDescription>
            <CardTitle className="text-3xl">
              {tousDocs.filter((d) => d.est_confidentiel).length}
            </CardTitle>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1 text-sm">
            <div className="font-medium">{tousDocs.filter((d) => d.est_confidentiel).length} {t.documents.confidentiel_titre}</div>
            <div className="text-muted-foreground">{t.dashboard.total_documents}</div>
          </CardFooter>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t.dashboard.taux_validation}</CardDescription>
            <CardTitle className="text-3xl">
              {txValidation.toFixed(1)}%
            </CardTitle>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1 text-sm">
            <div className="flex gap-1 font-medium">{stats?.valide ?? 0} / {stats?.total ?? 1} {t.dashboard.valide_sur_succes}</div>
            <div className="text-muted-foreground">{t.dashboard.taux_succes}</div>
          </CardFooter>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t.dashboard.departement_plus_actif}</CardDescription>
            <CardTitle className="text-3xl truncate">
              {topDepartement ? (langue === 'en' ? (topDepartement.departement__nom_en || topDepartement.departement__nom) : topDepartement.departement__nom) : '—'}
            </CardTitle>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1 text-sm">
            <div className="font-medium">{topDepartement?.total ?? 0} {t.dashboard.top_departement_label}</div>
            <div className="text-muted-foreground">{t.dashboard.documents_uploades}</div>
          </CardFooter>
        </Card>
      </div>

      <Card className="@container/card">
        <CardHeader>
          <CardTitle>{t.dashboard.activite_depots}</CardTitle>
          <CardDescription>
            <span className="hidden @[540px]/card:block">{t.dashboard.docs_deposes_periode}</span>
            <span className="@[540px]/card:hidden">{t.dashboard.depots_court}</span>
          </CardDescription>
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
            {stats?.activite_hebdo && stats.activite_hebdo.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.activite_hebdo}>
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
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">{t.admin.aucun_donnees}</div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <CardTitle className="text-base">{t.dashboard.derniers_documents}</CardTitle>
              <ToggleGroup type="single" value={ongletDocs} onValueChange={(v) => { v && setOngletDocs(v); setPageDocs(1); }} variant="outline">
                <ToggleGroupItem value="documents" className="gap-1.5 text-xs"><FileText className="h-3.5 w-3.5" /> {t.documents.groupe_docs}</ToggleGroupItem>
                <ToggleGroupItem value="images" className="gap-1.5 text-xs"><Image className="h-3.5 w-3.5" /> {t.documents.groupe_images}</ToggleGroupItem>
                <ToggleGroupItem value="medias" className="gap-1.5 text-xs"><Video className="h-3.5 w-3.5" /> {t.documents.groupe_medias}</ToggleGroupItem>
                <ToggleGroupItem value="confidentiels" className="gap-1.5 text-xs"><ShieldCheck className="h-3.5 w-3.5" /> {t.documents.confidentiel_titre}</ToggleGroupItem>
              </ToggleGroup>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[160px] max-w-[220px]">
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

              <TagFilterPopover
                tagsDisponibles={tagsDisponibles}
                tagFiltre={tagFiltre}
                onTagChange={(tag) => { setTagFiltre(tag); setPageDocs(1); }}
                label={t.documents.tags}
              />

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
                <DocumentGrid documents={docsPagines} onRefresh={rafraichir} />
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
                  onConfidentiel={handleConfidentielSelected}
                  onArchiver={handleArchiverSelected}
                  onPartager={handleShareSelected}
                  onClear={selection.clear}
                  etatFavori={tousFavoris ? 'remove' : 'add'}
                  etatEpingle={tousEpingles ? 'remove' : 'add'}
                  etatConfidentiel={tousConfidentiels ? 'remove' : 'add'}
                  etatArchive={tousArchives ? 'remove' : 'add'}
                />
                <div className="overflow-x-auto">
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
                    {(() => {
                      const rows: JSX.Element[] = [];
                      docsPaginesAffiches.forEach((doc) => {
                        const Icone = (doc.groupe && GROUPE_ICONE[doc.groupe]) || FileText;
                        const estFav = doc.favoris?.includes(utilisateur?.id ?? -1);
                        rows.push(
<TableRow key={doc.id} className={`cursor-pointer ${detailsDoc?.id === doc.id ? 'ring-1 ring-inset ring-primary bg-primary/5' : ''}`}
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
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => handleFavori(doc, e)}>
                                  <Heart className={`h-3.5 w-3.5 ${estFav ? 'fill-red-500 text-red-500' : ''}`} />
                                </Button>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
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
                                    {estAdmin && (
                                      <>
                                        <div className="-mx-1 my-1 h-px bg-border" />
                                        <Dialog>
                                          <DialogTrigger asChild>
                                            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setEditDoc(doc); setEditTitre(doc.titre); }}>
                                              <Edit className="h-4 w-4 mr-2" />{t.documents.modifier}
                                            </DropdownMenuItem>
                                          </DialogTrigger>
                                          <DialogContent onClick={(e) => e.stopPropagation()}>
                                            <DialogHeader><DialogTitle>{t.documents.modifier}</DialogTitle></DialogHeader>
                                            <form onSubmit={handleModifier} className="space-y-4">
                                              <div className="space-y-2"><Label>{t.documents.titre}</Label><Input value={editTitre} onChange={(e) => setEditTitre(e.target.value)} required /></div>
                                              <Button type="submit">{t.commun.sauvegarder}</Button>
                                            </form>
                                          </DialogContent>
                                        </Dialog>
                                        <DropdownMenuItem onClick={() => handleToggleConfidentiel(doc)}>
                                          {doc.est_confidentiel ? <Unlock className="h-4 w-4 mr-2" /> : <LockIcon className="h-4 w-4 mr-2" />}
                                          {doc.est_confidentiel ? t.documents.retirer_conf : t.documents.rendre_conf}
                                        </DropdownMenuItem>
                                        <div className="-mx-1 my-1 h-px bg-border" />
                                        <DropdownMenuItem className="text-destructive" onClick={() => handleArchiver(doc)}>
                                          <Archive className="h-4 w-4 mr-2" />{t.documents.archiver}
                                        </DropdownMenuItem>
                                      </>
                                    )}
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
                </div>
                <TableFooter
                  currentPage={pageDocs}
                  totalPages={totalPagesAffiches}
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