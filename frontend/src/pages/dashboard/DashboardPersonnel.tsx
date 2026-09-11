import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../i18n/useTranslation';
import {
  listerDocuments, listerTags, basculerFavori, getLogs,
  type Document, type TagType, type LogAction,
} from '../../api/documents';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardAction } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '../../components/ui/toggle-group';
import { Progress } from '../../components/ui/progress';
import {
  Area, AreaChart, CartesianGrid, XAxis, Tooltip, ResponsiveContainer, YAxis,
  PieChart, Pie, Cell,
} from 'recharts';
import {
  FileText, Image, Video, Upload, Printer, Mail, Archive, Edit,
  Search, RefreshCw, FolderOpen, Users, Heart, Pin, Tags,
  ShieldCheck, LayoutList, LayoutGrid, Calendar, MessageCircle,
} from 'lucide-react';
import DocumentGrid from '../documents/DocumentGrid';
import TableFooter from '../../components/TableFooter';
import TagFilterPopover from '../../components/TagFilterPopover';
import FiltreDate, { type FiltreDateValeur, FILTRE_DATE_VIDE } from '../../components/FiltreDate';
import { toast } from 'sonner';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover';
import { AIDropdownTrigger } from '../../components/ui/AIIcon';

function Pill({ value }: { value: number | null }) {
  if (value === null) return null;
  const up = value >= 0;
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${up ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-red-500/10 text-red-600 dark:text-red-400'}`}>
      {up ? '↗' : '↘'} {up ? '+' : ''}{value}%
    </span>
  );
}

export default function DashboardPersonnel() {
  const navigate = useNavigate();
  const { utilisateur } = useAuth();
  const { t, langue } = useTranslation();
  const fr = langue === 'fr';

  const [documents, setDocuments] = useState<Document[]>([]);
  const [tagsDisponibles, setTagsDisponibles] = useState<TagType[]>([]);
  const [logs, setLogs] = useState<LogAction[]>([]);
  const [chargement, setChargement] = useState(true);

  const [ongletDocs, setOngletDocs] = useState('documents');
  const [vueDocs, setVueDocs] = useState<'grille' | 'liste'>('grille');
  const [pageDocs, setPageDocs] = useState(1);
  const [rowsDocs, setRowsDocs] = useState(8);
  const [rechercheNom, setRechercheNom] = useState('');
  const [filtreDateDocs, setFiltreDateDocs] = useState<FiltreDateValeur>(FILTRE_DATE_VIDE);
  const [tagFiltre, setTagFiltre] = useState('');

  const [periodeGraph, setPeriodeGraph] = useState('30d');
  const [modeDateActivite, setModeDateActivite] = useState<'plage' | 'precise'>('plage');
  const [dateActiviteDebut, setDateActiviteDebut] = useState('');
  const [dateActiviteFin, setDateActiviteFin] = useState('');
  const [dateActivitePrecise, setDateActivitePrecise] = useState('');

  const charger = useCallback(async () => {
    try {
      setChargement(true);
      const [docs, tags, logsData] = await Promise.all([
        listerDocuments(),
        listerTags(),
        getLogs().catch(() => [] as LogAction[]),
      ]);
      setDocuments(docs);
      setTagsDisponibles(tags);
      setLogs(logsData);
    } catch {
      toast.error(t.commun.erreur);
    } finally {
      setChargement(false);
    }
  }, [t.commun.erreur]);

  useEffect(() => { charger(); }, [charger]);

  const monDept = utilisateur?.departement?.nom || '';

  const mesDocs = useMemo(() => documents.filter((d) => d.depose_par === utilisateur?.id), [documents, utilisateur?.id]);
  const mesFavoris = useMemo(() => documents.filter((d) => d.favoris?.includes(utilisateur?.id ?? -1)), [documents, utilisateur?.id]);
  const mesScans = useMemo(() => mesDocs.filter((d) => d.type_source === 'scan'), [mesDocs]);
  const partagesAvecMoi = useMemo(() => documents.filter((d) => d.est_departement_origine === false), [documents]);
  const epingles = useMemo(() => documents.filter((d) => d.est_epingle), [documents]);
  const docsDept = useMemo(() => documents.filter((d) => (d.departement_nom || '') === monDept), [documents, monDept]);
  const membresActifs = useMemo(() => new Set(docsDept.map((d) => d.depose_par)).size, [docsDept]);

  const courbeDept = useMemo(() => {
    const jours: { date: string; depots: number }[] = [];
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      jours.push({ date: d.toISOString().slice(0, 10), depots: 0 });
    }
    docsDept.forEach((doc) => {
      const ds = doc.date_depot?.slice(0, 10);
      const idx = jours.findIndex((j) => j.date === ds);
      if (idx !== -1) jours[idx].depots++;
    });
    return jours;
  }, [docsDept]);

  const courbeDeptFiltre = useMemo(() => {
    let jours: number;
    if (periodeGraph === '7d') jours = 7;
    else if (periodeGraph === '30d') jours = 30;
    else if (periodeGraph === '90d') jours = 90;
    else if (periodeGraph === '180d') jours = 180;
    else jours = 30;

    const now = new Date();
    let dateDebut: Date;
    let dateFin: Date;

    if (modeDateActivite === 'precise' && dateActivitePrecise) {
      dateDebut = new Date(dateActivitePrecise);
      dateFin = new Date(dateActivitePrecise);
    } else {
      dateFin = new Date(now);
      dateDebut = new Date(now);
      dateDebut.setDate(dateDebut.getDate() - jours);
      if (dateActiviteDebut) dateDebut = new Date(dateActiviteDebut);
      if (dateActiviteFin) dateFin = new Date(dateActiviteFin);
    }

    const result: { date: string; depots: number }[] = [];
    const current = new Date(dateDebut);
    while (current <= dateFin) {
      result.push({ date: current.toISOString().slice(0, 10), depots: 0 });
      current.setDate(current.getDate() + 1);
    }

    docsDept.forEach((doc) => {
      const ds = doc.date_depot?.slice(0, 10);
      if (!ds) return;
      const idx = result.findIndex((j) => j.date === ds);
      if (idx !== -1) result[idx].depots++;
    });
    return result;
  }, [docsDept, periodeGraph, modeDateActivite, dateActiviteDebut, dateActiviteFin, dateActivitePrecise]);

  const totalSemaine = courbeDeptFiltre.slice(-7).reduce((s, j) => s + j.depots, 0);
  const totalSemainePrec = courbeDeptFiltre.slice(-14, -7).reduce((s, j) => s + j.depots, 0);
  const evolutionDept = totalSemainePrec === 0 ? (totalSemaine > 0 ? 100 : 0) : Math.round(((totalSemaine - totalSemainePrec) / totalSemainePrec) * 100);
  const jourPic = courbeDeptFiltre.length ? courbeDeptFiltre.reduce((m, j) => (j.depots > m.depots ? j : m), courbeDeptFiltre[0]) : null;

  const courbePerso = useMemo(() => {
    const jours: { date: string; depots: number }[] = [];
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      jours.push({ date: d.toISOString().slice(0, 10), depots: 0 });
    }
    mesDocs.forEach((doc) => {
      const ds = doc.date_depot?.slice(0, 10);
      const idx = jours.findIndex((j) => j.date === ds);
      if (idx !== -1) jours[idx].depots++;
    });
    return jours;
  }, [mesDocs]);
  const persoSemaine = courbePerso.slice(-7).reduce((s, j) => s + j.depots, 0);
  const persoSemainePrec = courbePerso.slice(-14, -7).reduce((s, j) => s + j.depots, 0);
  const evolutionPerso = persoSemainePrec === 0 ? (persoSemaine > 0 ? 100 : 0) : Math.round(((persoSemaine - persoSemainePrec) / persoSemainePrec) * 100);

  const parTag = useMemo(() => {
    const map = new Map<string, { nom: string; couleur: string; count: number }>();
    mesDocs.forEach((d) => (d.tags_detail || []).forEach((tag) => {
      const cur = map.get(tag.nom) || { nom: tag.nom, couleur: tag.couleur || 'hsl(var(--primary))', count: 0 };
      cur.count++;
      map.set(tag.nom, cur);
    }));
    return [...map.values()].sort((a, b) => b.count - a.count).slice(0, 6);
  }, [mesDocs]);

  const membresEquipe = useMemo(() => {
    if (!monDept) return [] as { id: number; nom: string; total: number; pct: number; dernier: string | null }[];
    const counts = new Map<number, number>();
    const noms = new Map<number, string>();
    const derniers = new Map<number, string>();
    docsDept.forEach((d) => {
      counts.set(d.depose_par, (counts.get(d.depose_par) || 0) + 1);
      if (d.depose_par_nom) noms.set(d.depose_par, d.depose_par_nom);
      const cur = derniers.get(d.depose_par);
      if (!cur || d.date_depot > cur) derniers.set(d.depose_par, d.date_depot);
    });
    const tri = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const max = tri[0]?.[1] || 1;
    return tri.map(([id, total]) => ({
      id,
      nom: noms.get(id) || `#${id}`,
      total,
      pct: Math.round((total / max) * 100),
      dernier: derniers.get(id) || null,
    }));
  }, [docsDept, monDept]);

  const feed = useMemo(() => {
    const evts: { date: string; type: string; qui: string; titre: string }[] = [];
    docsDept.forEach((d) => evts.push({ date: d.date_depot, type: d.type_source === 'scan' ? 'scan' : 'depot', qui: d.depose_par_nom || '', titre: d.titre }));
    logs.forEach((l) => {
      if (['partage', 'archivage', 'modification'].includes(l.type_action)) {
        evts.push({ date: l.date_action, type: l.type_action, qui: l.effectue_par_nom || '', titre: l.document_titre || '' });
      }
    });
    return evts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 8);
  }, [docsDept, logs]);

  const docsFiltres = useMemo(() => {
    let result = ongletDocs === 'confidentiels'
      ? documents.filter((d) => d.est_confidentiel)
      : documents.filter((d) => d.groupe === ongletDocs);
    if (tagFiltre) {
      result = result.filter((d) => (d.tags_detail || []).some((tg) => tg.nom === tagFiltre));
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
  }, [documents, ongletDocs, tagFiltre, rechercheNom, filtreDateDocs]);

  const totalPages = Math.ceil(docsFiltres.length / rowsDocs);
  const docsPagines = docsFiltres.slice((pageDocs - 1) * rowsDocs, pageDocs * rowsDocs);

  async function handleFavori(doc: Document, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await basculerFavori(doc.id);
      const docs = await listerDocuments();
      setDocuments(docs);
    } catch { toast.error(t.commun.erreur); }
  }

  function tempsRelatif(dateStr: string) {
    const min = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (min < 1) return fr ? "à l'instant" : 'just now';
    if (min < 60) return fr ? `il y a ${min} min` : `${min} min ago`;
    const h = Math.floor(min / 60);
    if (h < 24) return fr ? `il y a ${h} h` : `${h} h ago`;
    const j = Math.floor(h / 24);
    return j === 1 ? (fr ? 'hier' : 'yesterday') : fr ? `il y a ${j} j` : `${j} d ago`;
  }

  const FEED_ICONE: Record<string, { icon: React.ElementType; class: string }> = {
    depot: { icon: Upload, class: 'bg-violet-500/15 text-violet-600 dark:text-violet-400' },
    scan: { icon: Printer, class: 'bg-purple-500/15 text-purple-600 dark:text-purple-400' },
    partage: { icon: Mail, class: 'bg-blue-500/15 text-blue-600 dark:text-blue-400' },
    archivage: { icon: Archive, class: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
    modification: { icon: Edit, class: 'bg-gray-500/15 text-gray-600 dark:text-gray-400' },
  };

  const GROUPE_ICONE: Record<string, React.ElementType> = { documents: FileText, images: Image, medias: Video };
  const STATUT_VARIANT: Record<string, 'success' | 'destructive' | 'warning' | 'default'> = {
    valide: 'success', rejete: 'destructive', en_attente: 'warning', en_cours: 'default',
  };
  const statutLabel: Record<string, string> = {
    valide: t.documents.valide, rejete: t.documents.rejete, en_attente: t.documents.en_attente, en_cours: t.documents.en_cours,
  };

  if (chargement) return <div className="p-8 text-muted-foreground">{t.commun.charger}</div>;

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6 min-w-0 w-full">

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t.dashboard.bienvenue}, {utilisateur?.username} !</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {partagesAvecMoi.length > 0
              ? (fr ? `Vous avez ${partagesAvecMoi.length} document(s) partagé(s) avec vous.` : `You have ${partagesAvecMoi.length} document(s) shared with you.`)
              : (fr ? `Voici l'activité de ${monDept || 'votre département'}.` : `Here is the activity of your department.`)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AIDropdownTrigger />
          <Button variant="ghost" size="icon" onClick={charger} title={t.dashboard.actualiser}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div
          className="lg:col-span-2 rounded-2xl p-6 text-white shadow-lg flex flex-col"
          style={{ background: 'linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 60%, black))' }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wider opacity-75">{fr ? 'Documents archivés · ' : 'Archived documents · '}{monDept || '—'}</p>
              <p className="text-4xl md:text-5xl font-bold mt-1">{docsDept.length}</p>
              <p className="text-sm opacity-80 mt-2">
                {evolutionDept >= 0 ? '+' : ''}{evolutionDept}% {fr ? 'vs semaine précédente' : 'vs last week'} • {totalSemaine} {fr ? 'dépôts cette semaine' : 'uploads this week'}
              </p>
            </div>
            <span className="rounded-full bg-white/15 px-3 py-1 text-xs">
              {evolutionDept >= 0 ? '📈 ' + (fr ? 'Croissance saine' : 'Healthy growth') : '📉 ' + (fr ? 'Ralentissement' : 'Slowdown')}
            </span>
          </div>

          <div className="flex flex-wrap gap-2 mt-4">
            <Button variant="secondary" size="sm" onClick={() => navigate('/depot')}>
              <Upload className="h-4 w-4 mr-1" /> {t.documents.deposer}
            </Button>
            <Button size="sm" className="bg-white/10 text-white hover:bg-white/20" onClick={() => navigate('/assistant')}>
              <MessageCircle className="h-4 w-4 mr-1" /> {t.nav.assistant_ia}
            </Button>
            <Button size="sm" className="bg-white/10 text-white hover:bg-white/20" onClick={() => toast.info(fr ? '🖨️ Scan bientôt accessible ici' : '🖨️ Scan coming soon here')}>
              <Printer className="h-4 w-4 mr-1" /> {fr ? 'Scanner' : 'Scan'}
            </Button>
            <Button size="sm" className="bg-white/10 text-white hover:bg-white/20" onClick={() => navigate('/recherche')}>
              <Search className="h-4 w-4 mr-1" /> {t.recherche.rechercher}
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-6 md:grid-cols-4">
            <div className="rounded-xl bg-white/10 p-3">
              <p className="text-xs opacity-80">{fr ? 'Mes documents' : 'My documents'}</p>
              <p className="text-xl font-semibold">{mesDocs.length}</p>
              <p className="text-[11px] text-green-300 mt-0.5">{persoSemaine} {fr ? 'cette semaine' : 'this week'}</p>
            </div>
            <div className="rounded-xl bg-white/10 p-3">
              <p className="text-xs opacity-80">{t.favoris.titre}</p>
              <p className="text-xl font-semibold">{mesFavoris.length}</p>
              <p className="text-[11px] opacity-70 mt-0.5">{fr ? 'suivis' : 'followed'}</p>
            </div>
            <div className="rounded-xl bg-white/10 p-3">
              <p className="text-xs opacity-80">{fr ? 'Mes scans' : 'My scans'}</p>
              <p className="text-xl font-semibold">{mesScans.length}</p>
              <p className="text-[11px] opacity-70 mt-0.5">Canon iR-ADV</p>
            </div>
            <div className="rounded-xl bg-white/10 p-3">
              <p className="text-xs opacity-80">{fr ? 'Partagés avec moi' : 'Shared with me'}</p>
              <p className="text-xl font-semibold">{partagesAvecMoi.length}</p>
              <p className="text-[11px] text-amber-300 mt-0.5">{fr ? 'accès externes' : 'external access'}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <Card className="flex-1">
            <CardContent className="p-5 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10"><Upload className="h-5 w-5 text-violet-600 dark:text-violet-400" /></span>
                <Pill value={evolutionDept} />
              </div>
              <div className="mt-4 text-right">
                <p className="text-sm text-muted-foreground">{fr ? 'Dépôts cette semaine' : 'Uploads this week'}</p>
                <p className="text-3xl font-bold">{totalSemaine}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="flex-1">
            <CardContent className="p-5 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10"><Users className="h-5 w-5 text-blue-600 dark:text-blue-400" /></span>
              </div>
              <div className="mt-4 text-right">
                <p className="text-sm text-muted-foreground">{fr ? 'Membres actifs' : 'Active members'}</p>
                <p className="text-3xl font-bold">{membresActifs}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">{fr ? "Analyse de l'activité du département" : 'Department activity analysis'}</CardTitle>
                <CardDescription>
                  <span className="hidden @[540px]/card:block">{monDept} · {fr ? 'dépôts sur la période' : 'uploads over period'}</span>
                  <span className="@[540px]/card:hidden">{monDept}</span>
                </CardDescription>
              </div>
              <Pill value={evolutionDept} />
            </div>
            <CardAction>
              <div className="flex items-center gap-2">
                <ToggleGroup type="single" value={periodeGraph} onValueChange={(v) => v && setPeriodeGraph(v)} variant="outline" className="hidden md:flex">
                  <ToggleGroupItem value="7d">{fr ? '7 j' : '7 d'}</ToggleGroupItem>
                  <ToggleGroupItem value="30d">{fr ? '30 j' : '30 d'}</ToggleGroupItem>
                  <ToggleGroupItem value="90d">{fr ? '3 mois' : '3 mo'}</ToggleGroupItem>
                  <ToggleGroupItem value="180d">{fr ? '6 mois' : '6 mo'}</ToggleGroupItem>
                </ToggleGroup>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
                      <Calendar className="h-3.5 w-3.5" />
                      <span className="max-w-[120px] truncate">
                        {modeDateActivite === 'precise' && dateActivitePrecise
                          ? new Date(dateActivitePrecise).toLocaleDateString(fr ? 'fr-FR' : 'en-US')
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
          <CardContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 mb-4">
              <div className="rounded-xl bg-violet-500/5 border border-violet-500/10 p-3 text-center">
                <p className="text-xs text-muted-foreground">{fr ? 'Cette semaine' : 'This week'}</p>
                <p className="text-xl font-bold text-violet-600 dark:text-violet-400">{totalSemaine}</p>
                <p className="text-[11px] text-green-600 dark:text-green-400">{evolutionDept >= 0 ? '+' : ''}{evolutionDept}%</p>
              </div>
              <div className="rounded-xl bg-muted/50 p-3 text-center">
                <p className="text-xs text-muted-foreground">{fr ? 'Total période' : 'Total period'}</p>
                <p className="text-xl font-bold">{courbeDeptFiltre.reduce((s, j) => s + j.depots, 0)}</p>
                <p className="text-[11px] text-muted-foreground">{fr ? 'dépôts' : 'uploads'}</p>
              </div>
              <div className="rounded-xl bg-muted/50 p-3 text-center">
                <p className="text-xs text-muted-foreground">{fr ? 'Jour le plus actif' : 'Busiest day'}</p>
                <p className="text-xl font-bold">{jourPic && jourPic.depots > 0 ? new Date(jourPic.date).toLocaleDateString(fr ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short' }) : '—'}</p>
                <p className="text-[11px] text-muted-foreground">{jourPic?.depots || 0} {fr ? 'dépôt(s)' : 'upload(s)'}</p>
              </div>
            </div>
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={courbeDeptFiltre}>
                  <defs>
                    <linearGradient id="fillDept" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} className="stroke-muted" />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 10 }}
                    tickFormatter={(v) => new Date(v).toLocaleDateString(fr ? 'fr-FR' : 'en-US', { month: 'short', day: 'numeric' })} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
                  <Tooltip cursor={false} contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
                    labelFormatter={(v: any) => new Date(v).toLocaleDateString(fr ? 'fr-FR' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' })}
                    formatter={(value: any) => [value, fr ? 'Dépôts' : 'Uploads']} />
                  <Area type="monotone" dataKey="depots" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#fillDept)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{fr ? "Activité de l'équipe" : 'Team activity'}</CardTitle>
          <CardDescription>
            {monDept} · {fr ? 'dépôts de chaque membre sur 30 jours' : 'uploads per member over 30 days'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {membresEquipe.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">{t.dashboard.aucune_activite}</p>
          ) : (
            membresEquipe.map((m, i) => (
              <div key={m.id} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 font-medium">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {m.nom.slice(0, 2).toUpperCase()}
                    </span>
                    {i + 1}. {m.nom}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {m.total} {fr ? 'dépôt(s)' : 'upload(s)'}
                    {m.dernier && <span className="hidden sm:inline"> · {fr ? 'dernier' : 'last'} {tempsRelatif(m.dernier)}</span>}
                  </span>
                </div>
                <Progress value={m.pct} className="h-2" />
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{fr ? 'Mes tags' : 'My tags'}</CardTitle>
            <CardDescription>{fr ? 'Cliquez pour filtrer' : 'Click to filter'}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-4">
            {parTag.length === 0 ? (
              <p className="text-sm text-muted-foreground w-full text-center py-8">{t.dashboard.aucun_tag}</p>
            ) : (
              <>
                <div className="relative h-[180px] w-[180px] shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={parTag} dataKey="count" nameKey="nom" innerRadius={55} outerRadius={80} paddingAngle={4} strokeWidth={0}>
                        {parTag.map((tag) => <Cell key={tag.nom} fill={tag.couleur} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <p className="text-2xl font-bold">{parTag.reduce((s, x) => s + x.count, 0)}</p>
                    <p className="text-xs text-muted-foreground">{t.documents.tags}</p>
                  </div>
                </div>
                <div className="space-y-2 text-sm flex-1 min-w-[150px]">
                  {parTag.map((tag) => (
                    <button key={tag.nom} onClick={() => navigate(`/documents?tag=${encodeURIComponent(tag.nom)}`)}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1 hover:bg-muted transition-colors text-left">
                      <span className="h-3 w-3 rounded-full shrink-0" style={{ background: tag.couleur }} />
                      <span className="truncate flex-1">{tag.nom}</span>
                      <span className="text-muted-foreground shrink-0">{tag.count}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-amber-200 dark:border-amber-900/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-amber-800 dark:text-amber-300">🤝 {t.dashboard.documents_partages_avec_moi}</CardTitle>
            <CardDescription>{fr ? "Accès d'autres départements" : 'Access from other departments'}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {partagesAvecMoi.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">{fr ? 'Aucun document partagé.' : 'No shared documents.'}</p>
            ) : (
              partagesAvecMoi.slice(0, 5).map((doc) => (
                <button key={doc.id} onClick={() => navigate(`/documents/${doc.id}`)}
                  className="flex w-full items-center gap-3 rounded-md border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/10 p-2.5 text-left hover:bg-amber-100/50 transition-colors">
                  <FolderOpen className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{doc.titre}</p>
                    <p className="truncate text-xs text-muted-foreground">{fr ? 'de' : 'from'} {langue === 'en' ? (doc.departement_nom_en || doc.departement_nom) : doc.departement_nom}</p>
                  </div>
                  <span className="shrink-0 text-[10px] text-muted-foreground">{new Date(doc.date_depot).toLocaleDateString(fr ? 'fr-FR' : 'en-US')}</span>
                </button>
              ))
            )}
          </CardContent>
        </Card>
      </div>

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
              <div className="relative min-w-[160px] max-w-[240px]">
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
              <div className="overflow-x-auto p-6 pt-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>{t.documents.titre}</TableHead>
                      <TableHead className="hidden md:table-cell">{t.documents.departement}</TableHead>
                      <TableHead>{t.documents.statut}</TableHead>
                      <TableHead className="hidden sm:table-cell">{t.documents.date}</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {docsPagines.map((doc) => {
                      const Icone = (doc.groupe && GROUPE_ICONE[doc.groupe]) || FileText;
                      const estFav = doc.favoris?.includes(utilisateur?.id ?? -1);
                      return (
                        <TableRow key={doc.id} className="cursor-pointer" onClick={() => navigate(`/documents/${doc.id}`)}>
                          <TableCell><Icone className="h-4 w-4 text-muted-foreground" /></TableCell>
                          <TableCell className="font-medium">{doc.titre}</TableCell>
                          <TableCell className="hidden md:table-cell text-muted-foreground">{langue === 'en' ? (doc.departement_nom_en || doc.departement_nom || '—') : (doc.departement_nom || '—')}</TableCell>
                          <TableCell>
                            <Badge variant={STATUT_VARIANT[doc.statut] || 'default'} className="text-[10px]">
                              {statutLabel[doc.statut] || doc.statut}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-muted-foreground text-xs">
                            {new Date(doc.date_depot).toLocaleDateString(fr ? 'fr-FR' : 'en-US')}
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => handleFavori(doc, e)}>
                              <Heart className={`h-3.5 w-3.5 ${estFav ? 'fill-red-500 text-red-500' : ''}`} />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
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
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">📰 {fr ? "Flux d'activité" : 'Activity feed'}</CardTitle>
          <CardDescription>{monDept} · {fr ? 'actions récentes' : 'recent actions'}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {feed.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">{t.dashboard.aucune_activite}</p>
          ) : (
            feed.map((e, i) => {
              const conf = FEED_ICONE[e.type] || FEED_ICONE.depot;
              const Icone = conf.icon;
              const verbe = e.type === 'depot' ? (fr ? 'a déposé' : 'uploaded')
                : e.type === 'scan' ? (fr ? 'a scanné' : 'scanned')
                : e.type === 'partage' ? (fr ? 'a partagé' : 'shared')
                : e.type === 'archivage' ? (fr ? 'a archivé' : 'archived')
                : (fr ? 'a modifié' : 'modified');
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${conf.class}`}><Icone className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm"><span className="font-medium">{e.qui || 'Système'}</span> <span className="text-muted-foreground">{verbe}</span></p>
                    <p className="truncate text-xs text-muted-foreground">« {e.titre} »</p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{tempsRelatif(e.date)}</span>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}