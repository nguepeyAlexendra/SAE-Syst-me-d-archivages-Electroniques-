import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { listerDocuments, basculerFavori, archiverDocument, desarchiverDocument, modifierDocument, type Document, listerTags, type TagType } from '../../api/documents';
import { listerDepartements, type DepartementType } from '../../api/admin';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../i18n/useTranslation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '../../components/ui/toggle-group';
import { Search, Upload, FileText, Image, Video, Pin, Heart, ArrowUpDown, LayoutList, LayoutGrid, Archive, ArchiveRestore, Lock, Unlock, CheckSquare, Square, Building2, UserRound } from 'lucide-react';
import { toast } from 'sonner';

import TableFooter from '../../components/TableFooter';
import DocumentGrid from './DocumentGrid';
import TagFilterPopover from '../../components/TagFilterPopover';
import FiltreDate, { type FiltreDateValeur, FILTRE_DATE_VIDE } from '../../components/FiltreDate';

function useStatutLabel(t: any): Record<string, string> {
  return { valide: t.documents.valide, rejete: t.documents.rejete, en_attente: t.documents.en_attente, en_cours: t.documents.en_cours };
}
const STATUT_VARIANT: Record<string, 'success' | 'destructive' | 'warning' | 'default'> = {
  valide: 'success', rejete: 'destructive', en_attente: 'warning', en_cours: 'default',
};
const GROUPE_ICONE: Record<string, React.ElementType> = {
  documents: FileText, images: Image, medias: Video,
};

type FiltresDept = {
  recherche: string;
  dateDebut: string;
  dateFin: string;
  datePrecise: string;
  modeDate: 'plage' | 'precise';
  tag: string;
  ordreDate: string;
  ordreNom: string;
};

const FILTRES_VIDES: FiltresDept = {
  recherche: '', dateDebut: '', dateFin: '', datePrecise: '', modeDate: 'plage', tag: '', ordreDate: '', ordreNom: '',
};

export default function ListeDocuments() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { utilisateur } = useAuth();
  const { t, langue } = useTranslation();
  
  const [documents, setDocuments] = useState<Document[]>([]);
  const [chargement, setChargement] = useState(true);
  const statutLabel = useStatutLabel(t);
  const [erreur, setErreur] = useState('');
  
  const [recherche, setRecherche] = useState('');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [datePrecise, setDatePrecise] = useState('');
  const [modeDate, setModeDate] = useState<'plage' | 'precise'>('plage');
  const [tagFiltreActif, setTagFiltreActif] = useState('');
  const [tagsDisponibles, setTagsDisponibles] = useState<TagType[]>([]);
  
  const [ordreDate, setOrdreDate] = useState('');
  const [ordreNom, setOrdreNom] = useState('');

  const [paginationDept, setPaginationDept] = useState<Record<string, { page: number; rowsPerPage: number }>>({});
  const [paginationGlobale, setPaginationGlobale] = useState({ page: 1, rowsPerPage: 10 });
  const [vueActuelle, setVueActuelle] = useState<'liste' | 'grille'>(
  () => (localStorage.getItem('sae_vue_docs') as 'liste' | 'grille') || 'grille'
);

  // ✅ ÉTATS DE SÉLECTION (Tableaux pour une réactivité React fiable)
  const [selectionGlobale, setSelectionGlobale] = useState<number[]>([]);
  const [selectionsDept, setSelectionsDept] = useState<Record<string, number[]>>({});
  const [filtresDept, setFiltresDept] = useState<Record<string, FiltresDept>>({});
  const [departements, setDepartements] = useState<DepartementType[]>([]);
  const [departementFiltre, setDepartementFiltre] = useState('');
  const [deposeParFiltre, setDeposeParFiltre] = useState('');

  const groupeFiltre = searchParams.get('groupe');
  const favorisFiltre = searchParams.get('favoris');
  const archivesFiltre = searchParams.get('archives');

  useEffect(() => {
    listerTags().then(setTagsDisponibles).catch(() => {});
    listerDepartements().then(setDepartements).catch(() => {});
  }, [utilisateur]);

  const charger = useCallback(async () => {
    try {
      setChargement(true);
      const params: Record<string, string> = {};
      if (groupeFiltre) params.groupe = groupeFiltre;
      if (tagFiltreActif) params.tag = tagFiltreActif;
      if (recherche) params.search = recherche;
      if (modeDate === 'precise' && datePrecise) {
        params.date_precise = datePrecise;
      } else {
        if (dateDebut) params.date_debut = dateDebut;
        if (dateFin) params.date_fin = dateFin;
      }
      if (ordreDate) params.ordre_date = ordreDate;
      if (ordreNom) params.ordre_nom = ordreNom;
      if (departementFiltre) params.departement = departementFiltre;
      if (archivesFiltre === 'true') params.est_archive = 'true';
      
      const donnees = await listerDocuments(params);
      setDocuments(donnees);
    } catch {
      setErreur(t.commun.erreur);
    } finally {
      setChargement(false);
    }
  }, [groupeFiltre, tagFiltreActif, recherche, modeDate, dateDebut, dateFin, datePrecise, ordreDate, ordreNom, departementFiltre, archivesFiltre, t]);

  useEffect(() => { charger(); }, [charger]);

  const estAdmin = utilisateur?.est_admin === true;

  const filtres = (favorisFiltre === 'true'
    ? documents.filter((doc) => doc.favoris?.includes(utilisateur?.id ?? -1))
    : documents)
    .filter((doc) => !deposeParFiltre || String(doc.depose_par) === deposeParFiltre)
    .filter((doc) => estAdmin || !departementFiltre || doc.departement === Number(departementFiltre));

  const filtresTries = useMemo(() => [...filtres].sort((a, b) => {
    if (a.est_epingle && !b.est_epingle) return -1;
    if (!a.est_epingle && b.est_epingle) return 1;
    return 0;
  }), [filtres]);

  // ✅ Les documents confidentiels sont EXCLUS des listes classiques
  //    (ils n'apparaissent que dans la section dédiée)
  const filtresVisibles = useMemo(() => filtresTries.filter((d) => !d.est_confidentiel), [filtresTries]);

  const deposeurs = useMemo(() => {
    const map = new Map<number, string>();
    for (const doc of documents) {
      if (doc.depose_par && doc.depose_par_nom && !map.has(doc.depose_par)) {
        map.set(doc.depose_par, doc.depose_par_nom);
      }
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [documents]);

  const groupesParDept = filtresVisibles.reduce<Record<string, typeof filtresTries>>((acc, doc) => {
    if (!doc.departement_nom) return acc;
    const key = doc.departement_nom;
    if (!acc[key]) acc[key] = [];
    acc[key].push(doc);
    return acc;
  }, {});

  const groupesOrdonnes = useMemo(() => {
    return Object.entries(groupesParDept).sort((a, b) => {
      const extA = a[1][0]?.est_departement_origine === false ? 1 : 0;
      const extB = b[1][0]?.est_departement_origine === false ? 1 : 0;
      return extA - extB;
    });
  }, [groupesParDept]);

  // ✅ Les confidentiels visibles (déposés par soi ou autorisés) sont isolés dans la section dédiée
  const confidentielsParGroupe = filtresTries.filter((d) => d.est_confidentiel).reduce<Record<string, typeof filtresTries>>((acc, doc) => {
    const key = doc.groupe || 'documents';
    if (!acc[key]) acc[key] = [];
    acc[key].push(doc);
    return acc;
  }, {});

  const docsOrigine = useMemo(() => filtresVisibles.filter((d) => d.est_departement_origine !== false), [filtresVisibles]);
  const docsExternes = useMemo(() => filtresVisibles.filter((d) => d.est_departement_origine === false), [filtresVisibles]);
  const docsExternesParDept = useMemo(() => {
    const map = new Map<string, typeof docsExternes>();
    for (const doc of docsExternes) {
      const key = doc.departement_nom || '—';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(doc);
    }
    return Array.from(map.entries());
  }, [docsExternes]);

  const titre = groupeFiltre
    ? { documents: t.nav.documents, images: t.nav.images, medias: t.nav.medias }[groupeFiltre] || t.documents.titre_liste
    : favorisFiltre === 'true' ? t.favoris.titre
    : archivesFiltre === 'true' ? t.nav.archives
    : t.documents.titre_liste;

  const texteDeposer = groupeFiltre === 'images' ? t.documents.deposer_image : groupeFiltre === 'medias' ? t.documents.deposer_media : t.documents.deposer;
  const formatsInfo = groupeFiltre === 'images' ? t.documents.formats_images : groupeFiltre === 'medias' ? t.documents.formats_medias : t.documents.formats_docs;

  const getFiltres = (deptNom: string): FiltresDept => filtresDept[deptNom] || FILTRES_VIDES;
  const setFiltres = (deptNom: string, nouveaux: Partial<FiltresDept>) => {
    setFiltresDept(prev => ({ ...prev, [deptNom]: { ...getFiltres(deptNom), ...nouveaux } }));
  };

  const CLE_CONFIDENTIELS = '__confidentiels__';
  const fConf = getFiltres(CLE_CONFIDENTIELS);
  const confidentielsFiltres = useMemo(() => {
    if (!confidentielsParGroupe) return {};
    const result: Record<string, typeof filtresTries> = {};
    for (const [groupe, docs] of Object.entries(confidentielsParGroupe)) {
      let liste = docs.filter((doc) => {
        const matchRecherche = doc.titre.toLowerCase().includes(fConf.recherche.toLowerCase());
        const matchTag = fConf.tag ? (doc.tags_detail || []).some((tg) => tg.nom === fConf.tag) : true;
        const matchDatePrecise = fConf.modeDate === 'precise' && fConf.datePrecise ? doc.date_depot === fConf.datePrecise : true;
        const matchDateDebut = fConf.modeDate !== 'precise' && fConf.dateDebut ? doc.date_depot >= fConf.dateDebut : true;
        const matchDateFin = fConf.modeDate !== 'precise' && fConf.dateFin ? doc.date_depot <= fConf.dateFin : true;
        return matchRecherche && matchTag && matchDateDebut && matchDateFin && matchDatePrecise;
      });
      if (fConf.ordreDate === 'asc') liste = [...liste].sort((a, b) => new Date(a.date_depot).getTime() - new Date(b.date_depot).getTime());
      else if (fConf.ordreDate === 'desc') liste = [...liste].sort((a, b) => new Date(b.date_depot).getTime() - new Date(a.date_depot).getTime());
      else if (fConf.ordreNom === 'asc') liste = [...liste].sort((a, b) => a.titre.localeCompare(b.titre));
      else if (fConf.ordreNom === 'desc') liste = [...liste].sort((a, b) => b.titre.localeCompare(a.titre));
      if (liste.length > 0) result[groupe] = liste;
    }
    return result;
  }, [confidentielsParGroupe, fConf]);

  // ✅ FONCTIONS DE SÉLECTION BLINDÉES
  const getSelection = useCallback((deptNom: string): number[] => selectionsDept[deptNom] || [], [selectionsDept]);
  
  const toggleSelection = useCallback((deptNom: string, id: number) => {
    setSelectionsDept(prev => {
      const current = prev[deptNom] || [];
      const isSelected = current.includes(id);
      const nouvelle = isSelected 
        ? current.filter(i => i !== id) 
        : [...current, id];
      return { ...prev, [deptNom]: nouvelle };
    });
  }, []);

  const toggleTousDept = useCallback((deptNom: string, ids: number[]) => {
    setSelectionsDept(prev => {
      const current = prev[deptNom] || [];
      const tousSelectionnes = ids.length > 0 && ids.every(id => current.includes(id));
      const nouvelle = tousSelectionnes 
        ? current.filter(id => !ids.includes(id)) 
        : [...new Set([...current, ...ids])];
      return { ...prev, [deptNom]: Array.from(nouvelle) };
    });
  }, []);

  const toggleSelectionGlobale = useCallback((id: number) => {
    setSelectionGlobale(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  }, []);

  const toggleTousGlobal = useCallback((ids: number[]) => {
    setSelectionGlobale(prev => {
      const tousSelectionnes = ids.length > 0 && ids.every(id => prev.includes(id));
      const nouvelle = tousSelectionnes 
        ? prev.filter(id => !ids.includes(id)) 
        : [...new Set([...prev, ...ids])];
      return Array.from(nouvelle);
    });
  }, []);

  const RenderTags = ({ doc }: { doc: any }) => {
    const tags = doc.tags_detail || [];
    if (!tags || tags.length === 0) return <span className="text-muted-foreground text-sm">—</span>;
    return (
      <div className="flex flex-col gap-1">
        {tags.slice(0, 3).map((tag: any) => (
          <div key={tag.id} className="flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ backgroundColor: tag.couleur }} />
            <span className="text-[11px] font-medium truncate max-w-[120px]" style={{ color: tag.couleur }} title={tag.nom}>{tag.nom}</span>
          </div>
        ))}
        {tags.length > 3 && (
          <div className="flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-muted-foreground flex-shrink-0" />
            <span className="text-[11px] text-muted-foreground">+{tags.length - 3}</span>
          </div>
        )}
      </div>
    );
  };

  async function actionEnMasse(ids: number[], action: 'archiver' | 'desarchiver' | 'confidentiel' | 'non_confidentiel' | 'epingle' | 'desepingle' | 'favori' | 'non_favori') {
    if (ids.length === 0) return;
    
    try {
      for (const id of ids) {
        if (action === 'archiver') {
          await archiverDocument(id);
        } else if (action === 'desarchiver') {
          await desarchiverDocument(id);
        } else if (action === 'epingle' || action === 'desepingle') {
          await modifierDocument(id, { est_epingle: action === 'epingle' });
        } else if (action === 'confidentiel' || action === 'non_confidentiel') {
          await modifierDocument(id, { est_confidentiel: action === 'confidentiel' });
        } else if (action === 'favori' || action === 'non_favori') {
          const doc = documents.find(d => d.id === id);
          if (doc) {
            const estFav = doc.favoris?.includes(utilisateur?.id ?? -1);
            if ((action === 'favori' && !estFav) || (action === 'non_favori' && estFav)) {
              await basculerFavori(id);
            }
          }
        }
      }
      toast.success(`${ids.length} ${t.documents.mis_a_jour}`);
      setSelectionGlobale([]);
      setSelectionsDept({});
      await charger();
    } catch {
      toast.error(t.commun.erreur);
    }
  }

  const BarreActions = ({ selection, onClear, archives }: { selection: number[]; onClear: () => void; archives?: boolean }) => {
    if (selection.length === 0) return null;

    const docsSel = documents.filter((d) => selection.includes(d.id));
    const tousFavoris = docsSel.length > 0 && docsSel.every((d) => d.favoris?.includes(utilisateur?.id ?? -1));
    const tousEpingles = docsSel.length > 0 && docsSel.every((d) => d.est_epingle);
    const tousConfidentiels = docsSel.length > 0 && docsSel.every((d) => d.est_confidentiel);

    return (
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-background border border-border rounded-lg shadow-lg p-3 flex items-center gap-3 animate-in slide-in-from-bottom-4">
        <div className="flex items-center gap-2 px-2">
          <CheckSquare className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">{selection.length} {t.documents.selectionnes}</span>
        </div>
        <div className="h-6 w-px bg-border" />

        <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5" onClick={() => actionEnMasse(selection, tousFavoris ? 'non_favori' : 'favori')}>
          <Heart className={`h-3.5 w-3.5 ${tousFavoris ? 'fill-primary text-primary' : ''}`} />{tousFavoris ? t.documents.retirer_favori : t.documents.ajouter_favoris}
        </Button>
        <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5" onClick={() => actionEnMasse(selection, tousEpingles ? 'desepingle' : 'epingle')}>
          <Pin className={`h-3.5 w-3.5 ${tousEpingles ? 'fill-primary text-primary' : ''}`} />{tousEpingles ? t.documents.desepingler : t.documents.epingler}
        </Button>

        {estAdmin && (
          <>
            {!archives && (
              <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5" onClick={() => actionEnMasse(selection, tousConfidentiels ? 'non_confidentiel' : 'confidentiel')}>
                {tousConfidentiels ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                {tousConfidentiels ? t.documents.rendre_public : t.documents.rendre_conf}
              </Button>
            )}
            <div className="h-6 w-px bg-border" />
            <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5" onClick={() => actionEnMasse(selection, archives ? 'desarchiver' : 'archiver')}>
              {archives ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
              {archives ? t.documents.desarchiver : t.documents.archiver}
            </Button>
          </>
        )}

        <div className="h-6 w-px bg-border" />
        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={onClear}>{t.commun.annuler}</Button>
      </div>
    );
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{titre}</h1>
        <div className="flex items-center gap-2">
          <ToggleGroup 
  type="single" 
  value={vueActuelle} 
  onValueChange={(v) => {
    if (!v) return;
    const vue = v as 'liste' | 'grille';
    setVueActuelle(vue);
    localStorage.setItem('sae_vue_docs', vue);
  }}
  className="bg-muted rounded-lg p-1"
>
            <ToggleGroupItem value="liste" aria-label={t.documents.vue_liste} className="h-8 w-8"><LayoutList className="h-4 w-4" /></ToggleGroupItem>
            <ToggleGroupItem value="grille" aria-label={t.documents.vue_grille} className="h-8 w-8"><LayoutGrid className="h-4 w-4" /></ToggleGroupItem>
          </ToggleGroup>
          {favorisFiltre !== 'true' && (
            <Button onClick={() => navigate(groupeFiltre === 'images' ? '/depot/images' : groupeFiltre === 'medias' ? '/depot/medias' : '/depot')}>
              <Upload className="h-4 w-4 mr-2" /> {texteDeposer}
            </Button>
          )}
        </div>
      </div>

      {formatsInfo && <p className="text-xs text-muted-foreground">{t.documents.formats_acceptes}{formatsInfo}</p>}

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder={t.documents.rechercher} className="pl-9" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
        </div>
        <Select value={departementFiltre} onValueChange={(v) => setDepartementFiltre(v)}>
          <SelectTrigger className="w-48"><Building2 className="h-4 w-4 mr-1" /><SelectValue placeholder={t.documents.tous_departements} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">{t.documents.tous_departements}</SelectItem>
            {departements.filter((d) => estAdmin || documents.some((doc) => doc.departement === d.id)).map((d) => (
              <SelectItem key={d.id} value={String(d.id)}>{langue === 'en' ? (d.nom_en || d.nom) : d.nom}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={deposeParFiltre} onValueChange={(v) => setDeposeParFiltre(v)}>
          <SelectTrigger className="w-44"><UserRound className="h-4 w-4 mr-1" /><SelectValue placeholder={t.documents.depose_par} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">{t.documents.tous_utilisateurs}</SelectItem>
            {deposeurs.map(([id, nom]) => (
              <SelectItem key={id} value={String(id)}>{id === utilisateur?.id ? t.documents.vous : nom}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <TagFilterPopover tagsDisponibles={tagsDisponibles} tagFiltre={tagFiltreActif} onTagChange={setTagFiltreActif} label={t.documents.filtrer_par_tags} />
        <FiltreDate
          valeur={{ mode: modeDate, debut: dateDebut, fin: dateFin, precise: datePrecise }}
          onChange={(v) => {
            setModeDate(v.mode);
            setDateDebut(v.debut);
            setDateFin(v.fin);
            setDatePrecise(v.precise);
          }}
          labelAucun={t.documents.filtrer_date}
        />
        <Select value={ordreDate} onValueChange={(v) => { setOrdreDate(v); setOrdreNom(''); }}>
          <SelectTrigger className="w-40"><ArrowUpDown className="h-4 w-4 mr-1" /><SelectValue placeholder={t.documents.tri_date} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">{t.documents.tri_date_defaut}</SelectItem>
            <SelectItem value="desc">{t.documents.tri_date_desc}</SelectItem>
            <SelectItem value="asc">{t.documents.tri_date_asc}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={ordreNom} onValueChange={(v) => { setOrdreNom(v); setOrdreDate(''); }}>
          <SelectTrigger className="w-40"><ArrowUpDown className="h-4 w-4 mr-1" /><SelectValue placeholder={t.documents.tri_nom} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">{t.documents.tri_nom_defaut}</SelectItem>
            <SelectItem value="asc">{t.documents.tri_nom_asc}</SelectItem>
            <SelectItem value="desc">{t.documents.tri_nom_desc}</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="ghost" size="sm" onClick={() => { 
          setRecherche(''); setDateDebut(''); setDateFin(''); 
          setOrdreDate(''); setOrdreNom(''); setTagFiltreActif(''); setDepartementFiltre(''); setDeposeParFiltre('');
          setPaginationGlobale({ page: 1, rowsPerPage: 10 }); setPaginationDept({}); 
          setSelectionGlobale([]); setSelectionsDept({});
        }}>
          <ArrowUpDown className="h-4 w-4 mr-1" /> {t.documents.reinitialiser}
        </Button>
      </div>

      {confidentielsParGroupe && Object.keys(confidentielsParGroupe).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">{t.documents.confidentiel_titre}</CardTitle>
            <div className="flex flex-wrap gap-2 mt-4 items-center">
              <div className="relative flex-1 min-w-[150px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder={t.documents.recherche_court} className="pl-8 h-8 text-xs" value={fConf.recherche} onChange={(e) => setFiltres(CLE_CONFIDENTIELS, { recherche: e.target.value })} />
              </div>
              <TagFilterPopover tagsDisponibles={tagsDisponibles} tagFiltre={fConf.tag} onTagChange={(tag) => setFiltres(CLE_CONFIDENTIELS, { tag })} label={t.documents.tags} />
              <FiltreDate
                valeur={{ mode: fConf.modeDate, debut: fConf.dateDebut, fin: fConf.dateFin, precise: fConf.datePrecise }}
                onChange={(v) => setFiltres(CLE_CONFIDENTIELS, { modeDate: v.mode, dateDebut: v.debut, dateFin: v.fin, datePrecise: v.precise })}
                labelAucun={t.documents.date}
              />
              <Select value={fConf.ordreDate} onValueChange={(v) => setFiltres(CLE_CONFIDENTIELS, { ordreDate: v, ordreNom: '' })}>
                <SelectTrigger className="w-[100px] h-8 text-xs"><ArrowUpDown className="h-3.5 w-3.5 mr-1" /><SelectValue placeholder={t.documents.date} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">{t.documents.date}</SelectItem>
                  <SelectItem value="desc">{t.documents.tri_recent}</SelectItem>
                  <SelectItem value="asc">{t.documents.tri_ancien}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={fConf.ordreNom} onValueChange={(v) => setFiltres(CLE_CONFIDENTIELS, { ordreNom: v, ordreDate: '' })}>
                <SelectTrigger className="w-[100px] h-8 text-xs"><ArrowUpDown className="h-3.5 w-3.5 mr-1" /><SelectValue placeholder={t.documents.nom} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">{t.documents.nom}</SelectItem>
                  <SelectItem value="asc">{t.documents.tri_nom_asc}</SelectItem>
                  <SelectItem value="desc">{t.documents.tri_nom_desc}</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setFiltresDept(prev => { const n = { ...prev }; delete n[CLE_CONFIDENTIELS]; return n; })}>
                <ArrowUpDown className="h-3.5 w-3.5 mr-1" /> {t.documents.reinitialiser}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.keys(confidentielsFiltres).length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.documents.aucun}</p>
            ) : (
              Object.entries(confidentielsFiltres).map(([groupe, docs]) => {
                const GROUPE_LABEL: Record<string, string> = { documents: t.documents.groupe_docs, images: t.documents.groupe_images, medias: t.documents.groupe_medias };
                return (
                  <div key={groupe}>
                    <p className="text-sm font-medium text-muted-foreground mb-2">{GROUPE_LABEL[groupe] || groupe} ({docs.length})</p>
                    <div className="flex flex-wrap gap-2">
                      {docs.map((doc) => (
                        <Badge key={doc.id} variant="outline" className="cursor-pointer" onClick={() => navigate(`/documents/${doc.id}`)}>{doc.titre}</Badge>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      )}

      {vueActuelle === 'grille' ? (
        groupesOrdonnes.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              {t.documents.aucun}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {groupesOrdonnes.map(([deptNom, docs]) => {
              const pag = paginationDept[deptNom] || { page: 1, rowsPerPage: 10 };
              const totalPages = Math.ceil(docs.length / pag.rowsPerPage);
              const docsPagines = docs.slice((pag.page - 1) * pag.rowsPerPage, pag.page * pag.rowsPerPage);
              const estExterne = docs[0]?.est_departement_origine === false;

              return (
                <Card
                  key={deptNom}
                  className={estExterne && !estAdmin ? 'border-amber-300 dark:border-amber-800' : ''}
                >
                  {/* ✅ Nom du département en haut (même style que la vue liste) */}
                  <CardHeader className="pb-3">
                    <CardTitle
                      className={estExterne && !estAdmin ? 'text-base text-amber-700 dark:text-amber-400' : 'text-lg'}
                    >
                      {estExterne && !estAdmin
                        ? `${t.documents.acces_externe} ${t.documents.du_departement} ${langue === 'en' ? (docs[0]?.departement_nom_en || deptNom) : deptNom}.`
                        : `${deptNom} (${docs.length})`}
                    </CardTitle>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* ✅ La grille des cartes (inchangée, avec leurs pieds de page) */}
                    <DocumentGrid documents={docsPagines} onRefresh={charger} />

                    {/* ✅ Pied de page / pagination du département (même composant que la liste) */}
                    <TableFooter
                      currentPage={pag.page}
                      totalPages={totalPages}
                      rowsPerPage={pag.rowsPerPage}
                      totalRows={docs.length}
                      onPageChange={(page) => setPaginationDept(prev => ({ ...prev, [deptNom]: { ...pag, page } }))}
                      onRowsPerPageChange={(rows) => setPaginationDept(prev => ({ ...prev, [deptNom]: { page: 1, rowsPerPage: rows } }))}
                    />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )
      ) : groupesParDept ? (
          groupesOrdonnes.map(([deptNom, docs]) => {
            const pag = paginationDept[deptNom] || { page: 1, rowsPerPage: 10 };
            const f = getFiltres(deptNom);
            const selection = getSelection(deptNom);

            let docsFiltres = docs.filter((doc) => {
              const matchRecherche = doc.titre.toLowerCase().includes(f.recherche.toLowerCase());
              const matchTag = f.tag ? (doc.tags_detail || []).some((tg) => tg.nom === f.tag) : true;
              const matchDatePrecise = f.modeDate === 'precise' && f.datePrecise ? doc.date_depot === f.datePrecise : true;
              const matchDateDebut = f.modeDate !== 'precise' && f.dateDebut ? doc.date_depot >= f.dateDebut : true;
              const matchDateFin = f.modeDate !== 'precise' && f.dateFin ? doc.date_depot <= f.dateFin : true;
              return matchRecherche && matchTag && matchDateDebut && matchDateFin && matchDatePrecise;
            });

            if (f.ordreDate === 'asc') docsFiltres = [...docsFiltres].sort((a, b) => new Date(a.date_depot).getTime() - new Date(b.date_depot).getTime());
            else if (f.ordreDate === 'desc') docsFiltres = [...docsFiltres].sort((a, b) => new Date(b.date_depot).getTime() - new Date(a.date_depot).getTime());
            else if (f.ordreNom === 'asc') docsFiltres = [...docsFiltres].sort((a, b) => a.titre.localeCompare(b.titre));
            else if (f.ordreNom === 'desc') docsFiltres = [...docsFiltres].sort((a, b) => b.titre.localeCompare(a.titre));

            const totalPages = Math.ceil(docsFiltres.length / pag.rowsPerPage);
            const docsPagines = docsFiltres.slice((pag.page - 1) * pag.rowsPerPage, pag.page * pag.rowsPerPage);
            
            const tousSelectionnes = docsPagines.length > 0 && docsPagines.every((d) => selection.includes(d.id));
            
            // ✅ FONCTION DE SÉLECTION MULTIPLE SÉCURISÉE
            const handleToggleTous = (e: React.MouseEvent) => {
              e.preventDefault();
              e.stopPropagation();
              toggleTousDept(deptNom, docsPagines.map(d => d.id));
            };

            return (
              <Card key={deptNom} className={docs[0]?.est_departement_origine === false && !estAdmin ? 'border-amber-300 dark:border-amber-800' : ''}>
                <CardHeader>
                  <CardTitle className={docs[0]?.est_departement_origine === false && !estAdmin ? 'text-base text-amber-700 dark:text-amber-400' : 'text-lg'}>
                    {docs[0]?.est_departement_origine === false && !estAdmin
                      ? `${t.documents.acces_externe} ${t.documents.du_departement} ${langue === 'en' ? (docs[0]?.departement_nom_en || deptNom) : deptNom}.`
                      : `${deptNom} (${docsFiltres.length})`}
                  </CardTitle>
                  {docs[0]?.est_departement_origine === false && !estAdmin && (
                    <CardDescription>{docsFiltres.length} {t.documents.documents_count}</CardDescription>
                  )}
                  <div className="flex flex-wrap gap-2 mt-4 items-center">
                    <div className="relative flex-1 min-w-[150px]">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input placeholder={t.documents.recherche_court} className="pl-8 h-8 text-xs" value={f.recherche} onChange={(e) => setFiltres(deptNom, { recherche: e.target.value })} />
                    </div>
                    <TagFilterPopover tagsDisponibles={tagsDisponibles} tagFiltre={f.tag} onTagChange={(tag) => setFiltres(deptNom, { tag })} label={t.documents.tags} />
                    <FiltreDate
                      valeur={{ mode: f.modeDate, debut: f.dateDebut, fin: f.dateFin, precise: f.datePrecise }}
                      onChange={(v) => setFiltres(deptNom, { modeDate: v.mode, dateDebut: v.debut, dateFin: v.fin, datePrecise: v.precise })}
                      labelAucun={t.documents.date}
                    />
                    <Select value={f.ordreDate} onValueChange={(v) => setFiltres(deptNom, { ordreDate: v, ordreNom: '' })}>
                      <SelectTrigger className="w-[100px] h-8 text-xs"><ArrowUpDown className="h-3.5 w-3.5 mr-1" /><SelectValue placeholder={t.documents.date} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">{t.documents.date}</SelectItem>
                        <SelectItem value="desc">{t.documents.tri_recent}</SelectItem>
                        <SelectItem value="asc">{t.documents.tri_ancien}</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={f.ordreNom} onValueChange={(v) => setFiltres(deptNom, { ordreNom: v, ordreDate: '' })}>
                      <SelectTrigger className="w-[100px] h-8 text-xs"><ArrowUpDown className="h-3.5 w-3.5 mr-1" /><SelectValue placeholder={t.documents.nom} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">{t.documents.nom}</SelectItem>
                        <SelectItem value="asc">{t.documents.tri_nom_asc}</SelectItem>
                        <SelectItem value="desc">{t.documents.tri_nom_desc}</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setFiltresDept(prev => { const n = { ...prev }; delete n[deptNom]; return n; })}>
                      <ArrowUpDown className="h-3.5 w-3.5 mr-1" /> {t.documents.reinitialiser}
                    </Button>
                  </div>
                </CardHeader>
                
                <CardContent className="p-0">
                  {docsFiltres.length === 0 ? (
                    <div className="p-8 text-center text-sm text-muted-foreground">{t.documents.aucun}</div>
                  ) : (
                    <>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-8">
                              {/* ✅ BOUTON TOUT SÉLECTIONNER BLINDÉ */}
                              <button type="button" onClick={handleToggleTous} className="flex items-center justify-center w-full h-full">
                                {tousSelectionnes ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4 text-muted-foreground" />}
                              </button>
                            </TableHead>
                            <TableHead>{t.documents.titre}</TableHead>
                            <TableHead className="hidden md:table-cell">{t.documents.tags}</TableHead>
                            <TableHead className="hidden md:table-cell">{t.documents.depose_par}</TableHead>
                            <TableHead>{t.documents.statut}</TableHead>
                            <TableHead className="hidden sm:table-cell">{t.documents.date}</TableHead>
                            <TableHead className="w-20"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {docsPagines.map((doc) => {
                            const Icone = (doc.groupe && GROUPE_ICONE[doc.groupe]) || FileText;
                            const estFav = doc.favoris?.includes(utilisateur?.id ?? -1);
                            const estSelectionne = selection.includes(doc.id);
                            
                            return (
                              <TableRow key={doc.id} className={`cursor-pointer ${estSelectionne ? 'bg-primary/5' : ''}`} onClick={() => navigate(`/documents/${doc.id}`)}>
                                {/* ✅ CASE À COCHER BLINDÉE */}
                                <TableCell>
                                  <button 
                                    type="button"
                                    onClick={(e) => { 
                                      e.preventDefault(); 
                                      e.stopPropagation(); 
                                      toggleSelection(deptNom, doc.id); 
                                    }} 
                                    className="flex items-center justify-center w-full h-full"
                                  >
                                    {estSelectionne ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4 text-muted-foreground" />}
                                  </button>
                                </TableCell>
                                <TableCell className="font-medium"><span className="flex items-center gap-2">{doc.est_epingle && <Pin className="h-3 w-3 text-primary" />}{doc.titre}</span></TableCell>
                                <TableCell className="hidden md:table-cell align-top pt-3"><RenderTags doc={doc} /></TableCell>
                                <TableCell className="hidden md:table-cell">{doc.depose_par_nom}</TableCell>
                                <TableCell><Badge variant={STATUT_VARIANT[doc.statut] || 'default'}>{statutLabel[doc.statut] || doc.statut}</Badge></TableCell>
                                <TableCell className="hidden sm:table-cell text-muted-foreground">{new Date(doc.date_depot).toLocaleDateString(langue === 'en' ? 'en-US' : 'fr-FR')}</TableCell>
                                <TableCell>
                                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={async (e) => {
                                      e.stopPropagation();
                                      try {
                                        const res = await basculerFavori(doc.id);
                                        setDocuments((prev) => prev.map((d) => d.id === doc.id ? { ...d, favoris: res.favori ? [...(d.favoris || []), utilisateur!.id] : (d.favoris || []).filter((uid) => uid !== utilisateur!.id) } : d));
                                      } catch { toast.error(t.commun.erreur); }
                                    }}><Heart className={`h-3 w-3 ${estFav ? 'fill-red-500 text-red-500' : ''}`} /></Button>
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={async (e) => {
                                      e.stopPropagation();
                                      try {
                                        await modifierDocument(doc.id, { est_epingle: !doc.est_epingle });
                                        setDocuments((prev) => prev.map((d) => d.id === doc.id ? { ...d, est_epingle: !d.est_epingle } : d));
                                      } catch { toast.error(t.commun.erreur); }
                                    }}><Pin className={`h-3 w-3 ${doc.est_epingle ? 'fill-primary text-primary' : ''}`} /></Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                      <TableFooter currentPage={pag.page} totalPages={totalPages} rowsPerPage={pag.rowsPerPage} totalRows={docsFiltres.length} onPageChange={(page) => setPaginationDept(prev => ({ ...prev, [deptNom]: { ...pag, page } }))} onRowsPerPageChange={(rows) => setPaginationDept(prev => ({ ...prev, [deptNom]: { page: 1, rowsPerPage: rows } }))} />
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })
        ) : (
          <div className="space-y-4">
            {docsOrigine.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{t.documents.mes_documents} ({docsOrigine.length})</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {(() => {
                    const totalPages = Math.ceil(docsOrigine.length / paginationGlobale.rowsPerPage);
                    const docsPagines = docsOrigine.slice((paginationGlobale.page - 1) * paginationGlobale.rowsPerPage, paginationGlobale.page * paginationGlobale.rowsPerPage);
                    const tousSelectionnes = docsPagines.length > 0 && docsPagines.every((d) => selectionGlobale.includes(d.id));
                    return (
                      <>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-8">
                                <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleTousGlobal(docsPagines.map(d => d.id)); }} className="flex items-center justify-center w-full h-full">
                                  {tousSelectionnes ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4 text-muted-foreground" />}
                                </button>
                              </TableHead>
                              <TableHead>{t.documents.titre}</TableHead>
                              <TableHead className="hidden md:table-cell">{t.documents.departement}</TableHead>
                              <TableHead className="hidden md:table-cell">{t.documents.tags}</TableHead>
                              <TableHead className="hidden md:table-cell">{t.documents.depose_par}</TableHead>
                              <TableHead>{t.documents.statut}</TableHead>
                              <TableHead className="hidden sm:table-cell">{t.documents.date}</TableHead>
                              <TableHead className="w-20"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {docsPagines.map((doc) => {
                              const Icone = (doc.groupe && GROUPE_ICONE[doc.groupe]) || FileText;
                              const estFav = doc.favoris?.includes(utilisateur?.id ?? -1);
                              const estSelectionne = selectionGlobale.includes(doc.id);
                              return (
                                <TableRow key={doc.id} className={`cursor-pointer ${estSelectionne ? 'bg-primary/5' : ''}`} onClick={() => navigate(`/documents/${doc.id}`)}>
                                  <TableCell>
                                    <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleSelectionGlobale(doc.id); }} className="flex items-center justify-center w-full h-full">
                                      {estSelectionne ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4 text-muted-foreground" />}
                                    </button>
                                  </TableCell>
                                  <TableCell className="font-medium"><span className="flex items-center gap-2">{doc.est_epingle && <Pin className="h-3 w-3 text-primary" />}{doc.titre}</span></TableCell>
                                  <TableCell className="hidden md:table-cell">{doc.departement_nom || '—'}</TableCell>
                                  <TableCell className="hidden md:table-cell align-top pt-3"><RenderTags doc={doc} /></TableCell>
                                  <TableCell className="hidden md:table-cell">{doc.depose_par_nom}</TableCell>
                                  <TableCell><Badge variant={STATUT_VARIANT[doc.statut] || 'default'}>{statutLabel[doc.statut] || doc.statut}</Badge></TableCell>
                                  <TableCell className="hidden sm:table-cell text-muted-foreground">{new Date(doc.date_depot).toLocaleDateString(langue === 'en' ? 'en-US' : 'fr-FR')}</TableCell>
                                  <TableCell>
                                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={async (e) => {
                                        e.stopPropagation();
                                        try {
                                          const res = await basculerFavori(doc.id);
                                          setDocuments((prev) => prev.map((d) => d.id === doc.id ? { ...d, favoris: res.favori ? [...(d.favoris || []), utilisateur!.id] : (d.favoris || []).filter((uid) => uid !== utilisateur!.id) } : d));
                                        } catch { toast.error(t.commun.erreur); }
                                      }}><Heart className={`h-3 w-3 ${estFav ? 'fill-red-500 text-red-500' : ''}`} /></Button>
                                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={async (e) => {
                                        e.stopPropagation();
                                        try {
                                          await modifierDocument(doc.id, { est_epingle: !doc.est_epingle });
                                          setDocuments((prev) => prev.map((d) => d.id === doc.id ? { ...d, est_epingle: !d.est_epingle } : d));
                                        } catch { toast.error(t.commun.erreur); }
                                      }}><Pin className={`h-3 w-3 ${doc.est_epingle ? 'fill-primary text-primary' : ''}`} /></Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                        <TableFooter currentPage={paginationGlobale.page} totalPages={totalPages} rowsPerPage={paginationGlobale.rowsPerPage} totalRows={docsOrigine.length} onPageChange={(page) => setPaginationGlobale(prev => ({ ...prev, page }))} onRowsPerPageChange={(rows) => setPaginationGlobale({ page: 1, rowsPerPage: rows })} />
                      </>
                    );
                  })()}
                </CardContent>
              </Card>
            )}
            {docsExternesParDept.map(([deptNom, docs]) => (
              <Card key={deptNom} className={estAdmin ? '' : 'border-amber-300 dark:border-amber-800'}>
                <CardHeader className="pb-3">
                  <CardTitle className={estAdmin ? 'text-base' : 'text-base text-amber-700 dark:text-amber-400'}>
                    {estAdmin
                      ? `${deptNom} (${docs.length})`
                      : `${t.documents.acces_externe} ${t.documents.du_departement} ${langue === 'en' ? (docs[0]?.departement_nom_en || deptNom) : deptNom}.`}
                  </CardTitle>
                  {!estAdmin && <CardDescription>{docs.length} {t.documents.documents_count}</CardDescription>}
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8"></TableHead>
                        <TableHead>{t.documents.titre}</TableHead>
                        <TableHead className="hidden md:table-cell">{t.documents.tags}</TableHead>
                        <TableHead className="hidden md:table-cell">{t.documents.depose_par}</TableHead>
                        <TableHead>{t.documents.statut}</TableHead>
                        <TableHead className="hidden sm:table-cell">{t.documents.date}</TableHead>
                        <TableHead className="w-20"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {docs.map((doc) => {
                        const Icone = (doc.groupe && GROUPE_ICONE[doc.groupe]) || FileText;
                        const estFav = doc.favoris?.includes(utilisateur?.id ?? -1);
                        const estSelectionne = selectionGlobale.includes(doc.id);
                        return (
                          <TableRow key={doc.id} className={`cursor-pointer bg-amber-50/40 dark:bg-amber-950/10 ${estSelectionne ? 'bg-primary/5' : ''}`} onClick={() => navigate(`/documents/${doc.id}`)}>
                            <TableCell>
                              <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleSelectionGlobale(doc.id); }} className="flex items-center justify-center w-full h-full">
                                {estSelectionne ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4 text-muted-foreground" />}
                              </button>
                            </TableCell>
                            <TableCell className="font-medium"><span className="flex items-center gap-2">{doc.est_epingle && <Pin className="h-3 w-3 text-primary" />}{doc.titre}</span></TableCell>
                            <TableCell className="hidden md:table-cell align-top pt-3"><RenderTags doc={doc} /></TableCell>
                            <TableCell className="hidden md:table-cell">{doc.depose_par_nom}</TableCell>
                            <TableCell><Badge variant={STATUT_VARIANT[doc.statut] || 'default'}>{statutLabel[doc.statut] || doc.statut}</Badge></TableCell>
                            <TableCell className="hidden sm:table-cell text-muted-foreground">{new Date(doc.date_depot).toLocaleDateString(langue === 'en' ? 'en-US' : 'fr-FR')}</TableCell>
                            <TableCell>
                              <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={async (e) => {
                                  e.stopPropagation();
                                  try {
                                    const res = await basculerFavori(doc.id);
                                    setDocuments((prev) => prev.map((d) => d.id === doc.id ? { ...d, favoris: res.favori ? [...(d.favoris || []), utilisateur!.id] : (d.favoris || []).filter((uid) => uid !== utilisateur!.id) } : d));
                                  } catch { toast.error(t.commun.erreur); }
                                }}><Heart className={`h-3 w-3 ${estFav ? 'fill-red-500 text-red-500' : ''}`} /></Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={async (e) => {
                                  e.stopPropagation();
                                  try {
                                    await modifierDocument(doc.id, { est_epingle: !doc.est_epingle });
                                    setDocuments((prev) => prev.map((d) => d.id === doc.id ? { ...d, est_epingle: !d.est_epingle } : d));
                                  } catch { toast.error(t.commun.erreur); }
                                }}><Pin className={`h-3 w-3 ${doc.est_epingle ? 'fill-primary text-primary' : ''}`} /></Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))}
            {docsOrigine.length === 0 && docsExternes.length === 0 && (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">{t.documents.aucun}</CardContent>
              </Card>
            )}
          </div>
        )}

      {/* ✅ BARRES D'ACTIONS FLOTTANTES */}
      {groupesOrdonnes.map(([deptNom]) => (
        <BarreActions
          key={deptNom}
          selection={getSelection(deptNom)}
          onClear={() => setSelectionsDept(prev => ({ ...prev, [deptNom]: [] }))}
          archives={archivesFiltre === 'true'}
        />
      ))}
    </div>
  );
}