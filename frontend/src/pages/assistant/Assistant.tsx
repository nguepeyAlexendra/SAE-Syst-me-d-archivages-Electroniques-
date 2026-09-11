import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../i18n/useTranslation';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../../components/ui/dropdown-menu';
import {
  Sparkles, Send, Plus, Loader2, FileText, Search, PanelLeftClose, PanelLeftOpen,
  MoreVertical, Star, StarOff, Pencil, Trash2, Copy, Square, Check, MessageSquare,
  FileStack, BarChart3, Settings, Bot, Calendar, Users, XCircle, Image, Presentation,
  Lock, Archive, Info, Lightbulb, AlertCircle, Cpu, Thermometer, MessageCircle,
  Globe, Database, FileSearch, Mic, AudioLines, ArrowUp,
  ThumbsUp, ThumbsDown, RotateCw, MoreHorizontal,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  listerConversations, creerConversation, modifierConversation, supprimerConversation,
  rechercherConversations, listerMessages, poserQuestion, rechercherSemantique,
  type Conversation, type MessageChat,
} from '../../api/assistant';
import { listerDocuments } from '../../api/documents';
import TableFooter from '../../components/TableFooter';
import { AIIcon } from '../../components/ui/AIIcon';

const ATOUTS: Record<string, { icon: any; label: string }[]> = {
  fr: [
    { icon: Lock, label: 'Respect des permissions' },
    { icon: Globe, label: 'Réponses multilingues' },
    { icon: Database, label: 'Métadonnées en temps réel' },
    { icon: FileSearch, label: 'Recherche sémantique' },
    { icon: Mic, label: 'Dictée vocale' },
  ],
  en: [
    { icon: Lock, label: 'Permission-aware' },
    { icon: Globe, label: 'Multilingual answers' },
    { icon: Database, label: 'Real-time metadata' },
    { icon: FileSearch, label: 'Semantic search' },
    { icon: Mic, label: 'Voice input' },
  ],
};

const CARTES_ANALYSE_FR = [
  { icon: Calendar, titre: 'Documents ce mois', question: 'Liste des documents déposés ce mois' },
  { icon: Users, titre: 'Top contributeurs', question: 'Qui a déposé le plus de documents' },
  { icon: XCircle, titre: 'Documents rejetés', question: 'Liste des documents rejetés' },
  { icon: Image, titre: 'Images du département', question: 'Liste des images de mon département' },
  { icon: Presentation, titre: 'PowerPoints disponibles', question: 'Y a-t-il des powerpoint ici' },
  { icon: Lock, titre: 'Documents confidentiels', question: 'Combien de documents confidentiels' },
];
const CARTES_ANALYSE_EN = [
  { icon: Calendar, titre: 'Documents this month', question: 'List of documents uploaded this month' },
  { icon: Users, titre: 'Top contributors', question: 'Who uploaded the most documents' },
  { icon: XCircle, titre: 'Rejected documents', question: 'List of rejected documents' },
  { icon: Image, titre: 'Department images', question: 'List of images in my department' },
  { icon: Presentation, titre: 'Available PowerPoints', question: 'Is there any powerpoint here' },
  { icon: Lock, titre: 'Confidential documents', question: 'How many confidential documents' },
];

function salutation(fr: boolean) {
  const h = new Date().getHours();
  if (fr) return h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir';
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

type Mode = 'chat' | 'resume' | 'recherche' | 'analyse' | 'parametres';
type SectParam = 'modele' | 'creativite' | 'apropos' | 'chats';

export default function Assistant() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { utilisateur } = useAuth();
  const { langue } = useTranslation();
  const fr = langue === 'fr';
  const prenom = (utilisateur as any)?.first_name || (utilisateur as any)?.prenom || utilisateur?.username || '';

  const modeInitial = (() => {
    const m = searchParams.get('mode');
    if (m === 'summary') return 'resume';
    if (m === 'search') return 'recherche';
    if (m === 'analysis') return 'analyse';
    return 'chat';
  })();

  const [mode, setMode] = useState<Mode>(modeInitial);
  const [sectParam, setSectParam] = useState<SectParam>('modele');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [convActive, setConvActive] = useState<number | null>(null);
  const [messages, setMessages] = useState<MessageChat[]>([]);
  const [question, setQuestion] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [histVisible, setHistVisible] = useState(true);
  const [recherche, setRecherche] = useState('');
  const [renommageId, setRenommageId] = useState<number | null>(null);
  const [nouveauTitre, setNouveauTitre] = useState('');
  const [streamingMessageId, setStreamingMessageId] = useState<number | null>(null);
  const basRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const streamingResponseRef = useRef<string>('');

  const [ecoute, setEcoute] = useState(false);
  const recogRef = useRef<any>(null);
  const [feedbacks, setFeedbacks] = useState<Record<number, 'up' | 'down'>>({});

  const [docs, setDocs] = useState<any[]>([]);
  const [selection, setSelection] = useState<number[]>([]);
  const [resumeEnvoi, setResumeEnvoi] = useState(false);
  const [pageResume, setPageResume] = useState(1);
  const [rowsResume, setRowsResume] = useState(10);

  const [qSem, setQSem] = useState('');
  const [resultatsSem, setResultatsSem] = useState<any[]>([]);
  const [semEnvoi, setSemEnvoi] = useState(false);

  const [prefs, setPrefs] = useState<any>(() => {
    try { return JSON.parse(localStorage.getItem('assistant_prefs') || '{}'); } catch { return {}; }
  });

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);

  function majPrefs(p: any) {
    const n = { ...prefs, ...p };
    setPrefs(n);
    localStorage.setItem('assistant_prefs', JSON.stringify(n));
  }

  useEffect(() => { listerConversations().then(setConversations).catch(() => {}); }, []);
  useEffect(() => { basRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, envoi]);
  useEffect(() => {
    const t = setTimeout(() => { rechercherConversations(recherche).then(setConversations).catch(() => {}); }, 300);
    return () => clearTimeout(t);
  }, [recherche]);
  useEffect(() => {
    if (mode === 'resume') listerDocuments().then(setDocs).catch(() => {});
  }, [mode]);

  function basculerEcoute() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      toast.error(fr ? 'Dictée vocale non supportée par ce navigateur (utilisez Chrome ou Edge).' : 'Voice input not supported (use Chrome or Edge).');
      return;
    }
    if (ecoute) {
      recogRef.current?.stop();
      setEcoute(false);
      return;
    }
    const recog = new SR();
    recog.lang = fr ? 'fr-FR' : 'en-US';
    recog.interimResults = true;
    recog.continuous = false;
    recog.onresult = (e: any) => {
      let texte = '';
      for (let i = 0; i < e.results.length; i++) texte += e.results[i][0].transcript;
      setQuestion(texte);
    };
    recog.onend = () => setEcoute(false);
    recog.onerror = () => {
      setEcoute(false);
      toast.error(fr ? 'Erreur du micro (autorisation refusée ?)' : 'Microphone error (permission denied?)');
    };
    recogRef.current = recog;
    recog.start();
    setEcoute(true);
  }

  async function ouvrirConversation(id: number) {
    setMode('chat');
    setConvActive(id);
    setMessages(await listerMessages(id).catch(() => []));
    const c = conversations.find(x => x.id === id);
    if (c && !c.est_lu) {
      const maj = await modifierConversation(id, { est_lu: true });
      setConversations(p => p.map(x => x.id === id ? maj : x));
    }
  }

  async function nouvelleConversation() { setMode('chat'); setConvActive(null); setMessages([]); setQuestion(''); }

  async function actionConv(id: number, type: 'favori' | 'nonlu' | 'suppr') {
    const c = conversations.find(x => x.id === id); if (!c) return;
    if (type === 'suppr') {
      await supprimerConversation(id);
      setConversations(p => p.filter(x => x.id !== id));
      if (convActive === id) nouvelleConversation();
      toast.success(fr ? 'Conversation supprimée' : 'Conversation deleted');
      return;
    }
    const maj = type === 'favori' ? await modifierConversation(id, { est_favori: !c.est_favori }) : await modifierConversation(id, { est_lu: false });
    setConversations(p => p.map(x => x.id === id ? maj : x));
  }

  async function validerRenommage(id: number) {
    if (nouveauTitre.trim()) {
      const maj = await modifierConversation(id, { titre: nouveauTitre.trim() });
      setConversations(p => p.map(x => x.id === id ? maj : x));
    }
    setRenommageId(null);
  }

  async function supprimerTousLesChats() {
    try {
      const n = conversations.length;
      for (const conv of conversations) await supprimerConversation(conv.id);
      setConversations([]);
      nouvelleConversation();
      toast.success(fr ? `${n} conversation(s) supprimée(s)` : `${n} conversation(s) deleted`);
      setShowDeleteConfirm(false);
    } catch {
      toast.error(fr ? 'Erreur lors de la suppression' : 'Error during deletion');
    }
  }

  async function archiverTousLesChats() {
    try {
      const n = conversations.length;
      for (const conv of conversations) await modifierConversation(conv.id, { est_lu: true });
      setConversations(p => p.map(c => ({ ...c, est_lu: true })));
      toast.success(fr ? `${n} conversation(s) archivée(s)` : `${n} conversation(s) archived`);
      setShowArchiveConfirm(false);
    } catch {
      toast.error(fr ? "Erreur lors de l'archivage" : 'Error during archiving');
    }
  }

  async function requete(q: string, docIds?: number[]) {
    setEnvoi(true);
    const ctrl = new AbortController(); abortRef.current = ctrl;
    try {
      let id = convActive;
      if (!id) {
        const c = await creerConversation(); id = c.id; setConvActive(id);
        setConversations(p => [{ ...c, titre: q.slice(0, 50) }, ...p]);
      }
      const r = await poserQuestion(id, {
        question: q,
        model: prefs.model || null,
        temperature: prefs.temperature ?? 0.2,
        document_ids: docIds,
      }, ctrl.signal);
      setMessages(m => [...m, { id: Date.now() + 1, role: 'assistant', contenu: r.reponse, sources: r.sources }]);
      setConversations(p => p.map(c => c.id === id ? { ...c, titre: q.slice(0, 50) } : c));
      toast.success(fr ? 'Réponse prête' : 'Response ready');
    } catch (e: any) {
      if (e?.name !== 'AbortError' && e?.code !== 'ERR_CANCELED') {
        const msg = e?.response?.data?.erreur;
        toast.error(msg || (fr ? "L'assistant est indisponible." : 'Assistant unavailable.'));
      }
    } finally { setEnvoi(false); abortRef.current = null; }
  }

  async function envoyer(texte?: string, docIds?: number[]) {
    const q = (texte ?? question).trim();
    if (!q || envoi) return;
    setMode('chat');
    setQuestion('');
    if (ecoute) { recogRef.current?.stop(); setEcoute(false); }
    setMessages(m => [...m, { id: Date.now(), role: 'user', contenu: q }]);
    await requete(q, docIds);
  }

  async function regenerer(assistantId: number) {
    const idx = messages.findIndex(m => m.id === assistantId);
    if (idx < 1 || envoi) return;
    const userMsg = messages[idx - 1];
    if (userMsg.role !== 'user') return;
    setMessages(messages.slice(0, idx));
    await requete(userMsg.contenu);
  }

  async function lancerResume() {
    if (!selection.length) {
      toast.error(fr ? 'Sélectionne au moins un document' : 'Select at least one document');
      return;
    }
    const titres = docs.filter(d => selection.includes(d.id)).map(d => d.titre);
    const q = `${fr ? 'Résume ces documents' : 'Summarize these documents'} : ${titres.join(', ')}`;
    setResumeEnvoi(true);
    await envoyer(q, selection);
    setResumeEnvoi(false);
    setSelection([]);
  }

  async function lancerRechercheSem() {
    if (!qSem.trim()) return;
    setSemEnvoi(true);
    try {
      setResultatsSem(await rechercherSemantique(qSem));
    } catch {
      toast.error(fr ? 'Recherche indisponible' : 'Search unavailable');
    } finally { setSemEnvoi(false); }
  }

  function arreter() { abortRef.current?.abort(); setEnvoi(false); }
  function modifierMessage(userId: number) {
    const idx = messages.findIndex(m => m.id === userId);
    if (idx < 0) return;
    const userMsg = messages[idx];
    if (userMsg.role !== 'user') return;
    arreter();
    const suivant = messages[idx + 1];
    const nouvelleLimite = suivant && suivant.role === 'assistant' ? idx : idx + 1;
    setMessages(messages.slice(0, idx));
    setQuestion(userMsg.contenu);
    setTimeout(() => inputRef.current?.focus(), 50);
  }
  function copier(t: string) { navigator.clipboard.writeText(t); toast.success(fr ? 'Copié' : 'Copied'); }
  function noter(id: number, type: 'up' | 'down') {
    setFeedbacks(p => ({ ...p, [id]: p[id] === type ? (undefined as any) : type }));
    toast.success(fr ? 'Merci pour votre retour' : 'Thanks for your feedback');
  }
    const totalPagesResume = Math.ceil(docs.length / rowsResume);
    const docsPaginesResume = docs.slice((pageResume - 1) * rowsResume, pageResume * rowsResume);
  function renderContenu(texte: string) {
    const parts = texte.split(/(\[[^\]]+\]\([^)]+\))/g);
    return parts.map((part, i) => {
      const m = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (m) {
        return (
          <button key={i} type="button"
            className="text-primary underline decoration-dotted hover:decoration-solid font-medium cursor-pointer"
            onClick={() => navigate(m[2])}>
            {m[1]}
          </button>
        );
      }
      return <span key={i}>{part}</span>;
    });
  }

  const champSaisieCompact = () => (
    <div className="flex gap-2">
      <Input ref={inputRef as any} value={question} onChange={e => setQuestion(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && envoyer()}
        placeholder={fr ? 'Comment puis-je vous aider ?' : 'How can I help you?'} />
      <Button onClick={() => envoyer()} disabled={envoi || !question.trim()}>
        {envoi ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
      </Button>
    </div>
  );

  const NAV: { id: Mode; icon: any; label: string }[] = [
    { id: 'chat', icon: MessageSquare, label: fr ? 'Nouvelle conversation' : 'New conversation' },
    { id: 'resume', icon: FileStack, label: fr ? 'Résumer documents' : 'Summarize documents' },
    { id: 'recherche', icon: Search, label: fr ? 'Recherche sémantique' : 'Semantic search' },
    { id: 'analyse', icon: BarChart3, label: fr ? 'Analyse département' : 'Department analysis' },
  ];

  const SECTIONS_PARAM: { id: SectParam; icon: any; label: string }[] = [
    { id: 'modele', icon: Cpu, label: fr ? 'Modèle de langage' : 'Language model' },
    { id: 'creativite', icon: Thermometer, label: fr ? 'Créativité' : 'Creativity' },
    { id: 'apropos', icon: Info, label: fr ? 'À propos' : 'About' },
    { id: 'chats', icon: MessageCircle, label: fr ? 'Chats' : 'Chats' },
  ];

  return (
    <div className="flex h-screen">
      {histVisible && (
        <aside className="w-72 border-r flex flex-col bg-card h-full overflow-hidden">
          <div className="p-3 space-y-2">
            <div className="flex gap-1 items-center">
              <div className="relative flex-1">
                <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input value={recherche} onChange={e => setRecherche(e.target.value)} placeholder={fr ? 'Rechercher…' : 'Search…'} className="pl-8 h-8" />
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setHistVisible(false)}><PanelLeftClose className="h-4 w-4" /></Button>
            </div>
          </div>

          <div className="px-3 pb-2 space-y-1 border-b">
            <p className="text-xs text-muted-foreground px-2 py-1 flex items-center gap-2"><Bot className="h-3.5 w-3.5" />{fr ? 'Assistant IA' : 'AI Assistant'}</p>
            {NAV.map(n => (
              <Button key={n.id} variant={mode === n.id ? 'secondary' : 'ghost'} className="w-full justify-start"
                onClick={() => n.id === 'chat' ? nouvelleConversation() : setMode(n.id)}>
                <n.icon className="h-4 w-4 mr-2" />{n.label}
              </Button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
            <p className="text-xs text-muted-foreground px-2 py-1">{fr ? 'Historique' : 'History'}</p>
            {conversations.map(c => (
              <div key={c.id} className={`group flex items-center rounded-md ${convActive === c.id ? 'bg-secondary' : 'hover:bg-muted'}`}>
                {renommageId === c.id ? (
                  <Input autoFocus value={nouveauTitre} onChange={e => setNouveauTitre(e.target.value)}
                    onBlur={() => validerRenommage(c.id)} onKeyDown={e => e.key === 'Enter' && validerRenommage(c.id)}
                    className="h-8 text-sm" />
                ) : (
                  <button onClick={() => ouvrirConversation(c.id)} className="flex-1 text-left px-3 py-2 text-sm truncate flex items-center gap-2">
                    {c.est_favori && <Star className="h-3 w-3 fill-current text-yellow-500 shrink-0" />}
                    {!c.est_lu && <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />}
                    <span className="truncate">{c.titre}</span>
                  </button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 mr-1 opacity-0 group-hover:opacity-100"><MoreVertical className="h-4 w-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => actionConv(c.id, 'favori')}>
                      {c.est_favori ? <StarOff className="h-4 w-4 mr-2" /> : <Star className="h-4 w-4 mr-2" />}
                      {c.est_favori ? (fr ? 'Retirer des favoris' : 'Remove from favorites') : (fr ? 'Ajouter aux favoris' : 'Add to favorites')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => actionConv(c.id, 'nonlu')}><Check className="h-4 w-4 mr-2" />{fr ? 'Marquer comme non lu' : 'Mark as unread'}</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setRenommageId(c.id); setNouveauTitre(c.titre); }}><Pencil className="h-4 w-4 mr-2" />{fr ? 'Renommer' : 'Rename'}</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => actionConv(c.id, 'suppr')} className="text-destructive"><Trash2 className="h-4 w-4 mr-2" />{fr ? 'Supprimer' : 'Delete'}</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>

          <div className="p-2 border-t">
            <Button variant={mode === 'parametres' ? 'secondary' : 'ghost'} className="w-full justify-start" onClick={() => setMode('parametres')}>
              <Settings className="h-4 w-4 mr-2" />{fr ? 'Paramètres' : 'Settings'}
            </Button>
          </div>
        </aside>
      )}

      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {!histVisible && (
          <div className="p-2"><Button variant="ghost" size="icon" onClick={() => setHistVisible(true)}><PanelLeftOpen className="h-4 w-4" /></Button></div>
        )}

        {mode === 'chat' && (
          convActive === null ? (
            <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center p-6">
              <div className="w-full max-w-3xl space-y-6">
                <div className="text-center space-y-3">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
  <AIIcon size={34} />
</div>
                  <h1 className="text-4xl font-bold tracking-tight">{salutation(fr)}, {prenom}</h1>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    {fr
                      ? "Question sur un document, liste, résumé ou analyse : décrivez votre besoin, je m'occupe du reste."
                      : 'Question about a document, list, summary or analysis: describe your need, I handle the rest.'}
                  </p>
                </div>

                <div className="rounded-2xl border bg-card shadow-sm transition focus-within:border-primary/50">
                  <div className="px-5 pt-4 pb-2">
                    <textarea
                      rows={3}
                      value={question}
                      onChange={e => setQuestion(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); envoyer(); } }}
                      placeholder={fr ? 'Comment puis-je vous aider ?' : 'How can I help you?'}
                      className="w-full resize-none bg-transparent text-base outline-none placeholder:text-muted-foreground"
                    />
                  </div>
                  <div className="flex items-center justify-between px-3 pb-3">
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setMode('resume')}
                        title={fr ? 'Joindre des documents à résumer' : 'Attach documents to summarize'}>
                        <Plus className="h-4 w-4" />
                      </Button>
                      <span className="rounded-md border px-2 py-1 text-xs font-medium">Chat</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="hidden sm:flex items-center gap-1.5 rounded-md border bg-muted/40 px-2 py-1 text-xs text-muted-foreground">
                        <Cpu className="h-3 w-3" />{prefs.model || 'qwen3-4b:latest'}
                      </span>
                      <Button variant="ghost" size="icon" className={`h-8 w-8 rounded-full ${ecoute ? 'text-destructive' : ''}`}
                        onClick={basculerEcoute} title={fr ? 'Dictée vocale' : 'Voice input'}>
                        {ecoute ? <AudioLines className="h-4 w-4 animate-pulse" /> : <Mic className="h-4 w-4" />}
                      </Button>
                      <Button size="icon" className="h-9 w-9 rounded-full" disabled={envoi || !question.trim()} onClick={() => envoyer()}>
                        {envoi ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </div>

                {ecoute && (
                  <p className="text-center text-xs text-muted-foreground">
                    {fr ? 'Micro actif — parlez, le texte s\'écrit tout seul. Cliquez sur le micro pour arrêter.' : 'Mic active — speak, text writes itself. Click the mic to stop.'}
                  </p>
                )}

                <div className="flex flex-wrap justify-center gap-2">
                  {(ATOUTS[langue] || ATOUTS.fr).map((a, i) => (
                    <span key={i} className="flex items-center gap-1.5 rounded-full border bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
                      <a.icon className="h-3 w-3" />{a.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {messages.map((m, idx) => {
                  const estDernier = m.id === messages[messages.length - 1]?.id;
                  const estDernierUser = m.role === 'user' && idx === messages.length - 1;
                  return (
                    <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`flex flex-col max-w-[80%] ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                        <div className={`group rounded-lg px-4 py-2 text-sm ${m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                          <p className="whitespace-pre-wrap">{renderContenu(m.contenu)}</p>
                          {m.sources && m.sources.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {m.sources.map((s, i) => (
                                <Badge key={i} variant="outline" className="cursor-pointer" onClick={() => navigate(`/documents/${s.document_id}`)}>
                                  <FileText className="h-3 w-3 mr-1" />{s.titre}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Barre d'actions sous la QUESTION utilisateur */}
                        {m.role === 'user' && (
                          <div className="flex items-center gap-0.5 mt-1">
                            <button className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                              onClick={() => copier(m.contenu)} title={fr ? 'Copier' : 'Copy'}>
                              <Copy className="h-4 w-4" />
                            </button>
                            <button className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                              onClick={() => modifierMessage(m.id)} title={fr ? 'Modifier la question' : 'Edit question'}>
                              <Pencil className="h-4 w-4" />
                            </button>
                            {envoi && estDernierUser && (
                              <button className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                                onClick={arreter} title={fr ? 'Arrêter' : 'Stop'}>
                                <Square className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        )}

                        {/* Barre d'actions sous la RÉPONSE assistant */}
                        {m.role === 'assistant' && (
                          <div className="flex items-center gap-0.5 mt-1">
                            <button className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                              onClick={() => copier(m.contenu)} title={fr ? 'Copier' : 'Copy'}>
                              <Copy className="h-4 w-4" />
                            </button>
                            <button className={`p-1.5 rounded-md transition-colors hover:bg-muted/60 ${feedbacks[m.id] === 'up' ? 'text-green-600' : 'text-muted-foreground hover:text-foreground'}`}
                              onClick={() => noter(m.id, 'up')} title={fr ? 'Bonne réponse' : 'Good answer'}>
                              <ThumbsUp className="h-4 w-4" />
                            </button>
                            <button className={`p-1.5 rounded-md transition-colors hover:bg-muted/60 ${feedbacks[m.id] === 'down' ? 'text-destructive' : 'text-muted-foreground hover:text-foreground'}`}
                              onClick={() => noter(m.id, 'down')} title={fr ? 'Mauvaise réponse' : 'Bad answer'}>
                              <ThumbsDown className="h-4 w-4" />
                            </button>
                            <button className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                              onClick={() => regenerer(m.id)} title={fr ? 'Régénérer la réponse' : 'Regenerate'}>
                              <RotateCw className={`h-4 w-4 ${envoi && estDernier ? 'animate-spin' : ''}`} />
                            </button>
                            {envoi && estDernier && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                                    title={fr ? 'Options' : 'Options'}>
                                    <MoreHorizontal className="h-4 w-4" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start">
                                  <DropdownMenuItem onClick={arreter}>
                                    <Square className="h-4 w-4 mr-2" />{fr ? 'Arrêter la génération' : 'Stop generation'}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {envoi && (
                  <div className="flex justify-start"><div className="bg-muted rounded-lg px-4 py-2 text-sm flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />{fr ? 'Réflexion…' : 'Thinking…'}</div></div>
                )}
                <div ref={basRef} />
              </div>
              <div className="p-4 border-t">
                {champSaisieCompact()}
              </div>
            </>
          )
        )}

                {mode === 'resume' && (
          <>
            {/* Liste scrollable paginée */}
            <div className="flex-1 overflow-y-auto p-6">
              <h2 className="text-xl font-bold mb-1 flex items-center gap-2"><FileStack className="h-5 w-5" />{fr ? 'Résumer des documents' : 'Summarize documents'}</h2>
              <p className="text-sm text-muted-foreground mb-4">{fr ? 'Coche les documents à synthétiser, puis clique sur Résumer.' : 'Tick the documents to synthesize, then click Summarize.'}</p>

              {/* Barre d'actions */}
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4 max-w-2xl">
                <span className="text-sm text-muted-foreground">
                  {fr ? `${selection.length} document(s) sélectionné(s)` : `${selection.length} document(s) selected`}
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setSelection([])} disabled={!selection.length}>
                    {fr ? 'Tout désélectionner' : 'Clear selection'}
                  </Button>
                  <Button size="sm" onClick={lancerResume} disabled={resumeEnvoi || !selection.length}>
                    {resumeEnvoi ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                    {fr ? `Résumer (${selection.length})` : `Summarize (${selection.length})`}
                  </Button>
                </div>
              </div>

              {/* Documents de la page courante */}
              <div className="space-y-2 max-w-2xl">
                {docsPaginesResume.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">{fr ? 'Aucun document accessible.' : 'No accessible documents.'}</p>
                )}
                {docsPaginesResume.map(d => (
                  <label key={d.id} className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted">
                    <input type="checkbox" checked={selection.includes(d.id)}
                      onChange={e => setSelection(p => e.target.checked ? [...p, d.id] : p.filter(x => x !== d.id))} />
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm truncate">{d.titre}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Pied de page identique aux tableaux de documents */}
            <div className="border-t bg-card">
              <TableFooter
                currentPage={pageResume}
                totalPages={totalPagesResume}
                rowsPerPage={rowsResume}
                totalRows={docs.length}
                onPageChange={setPageResume}
                onRowsPerPageChange={(rows) => { setRowsResume(rows); setPageResume(1); }}
              />
            </div>
          </>
        )}

        {mode === 'recherche' && (
          <div className="flex-1 overflow-y-auto p-6">
            <h2 className="text-xl font-bold mb-1 flex items-center gap-2"><Search className="h-5 w-5" />{fr ? 'Recherche sémantique' : 'Semantic search'}</h2>
            <p className="text-sm text-muted-foreground mb-4">{fr ? 'Trouve les passages pertinents sans générer de réponse.' : 'Find relevant passages without generating an answer.'}</p>
            <div className="flex gap-2 max-w-2xl">
              <Input value={qSem} onChange={e => setQSem(e.target.value)} onKeyDown={e => e.key === 'Enter' && lancerRechercheSem()}
                placeholder={fr ? 'Ex : durée de conservation des factures' : 'E.g. invoice retention period'} />
              <Button onClick={lancerRechercheSem} disabled={semEnvoi || !qSem.trim()}>
                {semEnvoi ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
            <div className="mt-4 space-y-3 max-w-2xl">
              {resultatsSem.map((r, i) => (
                <div key={i} className="p-3 rounded-lg border bg-card cursor-pointer hover:bg-muted" onClick={() => navigate(`/documents/${r.document_id}`)}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium flex items-center gap-2"><FileText className="h-4 w-4" />{r.titre}</span>
                    <Badge variant="secondary">{Math.round((r.score || 0) * 100)}%</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-3">{r.extrait}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {mode === 'analyse' && (
          <div className="flex-1 overflow-y-auto p-6">
            <h2 className="text-xl font-bold mb-1 flex items-center gap-2"><BarChart3 className="h-5 w-5" />{fr ? 'Analyse du département' : 'Department analysis'}</h2>
            <p className="text-sm text-muted-foreground mb-4">{fr ? 'Clique sur une carte pour interroger l\'assistant.' : 'Click a card to query the assistant.'}</p>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 max-w-3xl">
              {(fr ? CARTES_ANALYSE_FR : CARTES_ANALYSE_EN).map((c, i) => (
                <button key={i} onClick={() => envoyer(c.question)}
                  className="p-4 rounded-lg border bg-card text-left hover:bg-muted hover:border-primary transition">
                  <c.icon className="h-6 w-6 text-muted-foreground" />
                  <p className="text-sm font-medium mt-2">{c.titre}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {mode === 'parametres' && (
          <div className="flex-1 overflow-y-auto p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Settings className="h-5 w-5" />{fr ? 'Paramètres de l\'assistant' : 'Assistant settings'}</h2>

            <div className="flex flex-wrap gap-2 mb-6">
              {SECTIONS_PARAM.map(s => (
                <Button key={s.id} variant={sectParam === s.id ? 'secondary' : 'outline'} size="sm"
                  onClick={() => setSectParam(s.id)}>
                  <s.icon className="h-4 w-4 mr-2" />{s.label}
                </Button>
              ))}
            </div>

            {sectParam === 'modele' && (
              <div className="max-w-md">
                <label className="text-sm font-medium">{fr ? 'Modèle de langage' : 'Language model'}</label>
                <select value={prefs.model || 'qwen3-4b:latest'} onChange={e => majPrefs({ model: e.target.value })}
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm">
                  <option value="qwen3-4b:latest">Qwen3 4B — {fr ? 'recommandé (français)' : 'recommended (French)'}</option>
                  <option value="llama3.2:3b">Llama 3.2 3B — {fr ? 'rapide' : 'fast'}</option>
                  <option value="mistral:7b-instruct">Mistral 7B — {fr ? 'précis mais lent' : 'accurate but slow'}</option>
                </select>
                <p className="text-xs text-muted-foreground mt-2">
                  {fr ? 'Le modèle sélectionné sera utilisé pour toutes les prochaines réponses.' : 'The selected model will be used for all future responses.'}
                </p>
              </div>
            )}

            {sectParam === 'creativite' && (
              <div className="max-w-md">
                <label className="text-sm font-medium">{fr ? 'Créativité (température)' : 'Creativity (temperature)'} : {prefs.temperature ?? 0.2}</label>
                <input type="range" min={0} max={1} step={0.1} value={prefs.temperature ?? 0.2}
                  onChange={e => majPrefs({ temperature: parseFloat(e.target.value) })} className="w-full mt-2" />
                <p className="text-xs text-muted-foreground mt-1">{fr ? '0 = réponses factuelles · 1 = réponses créatives' : '0 = factual · 1 = creative'}</p>
              </div>
            )}

            {sectParam === 'apropos' && (
              <div className="max-w-2xl space-y-4 text-sm">
                <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Bot className="h-4 w-4" />
                    {fr ? 'Qu\'est-ce que l\'Assistant IA ?' : 'What is the AI Assistant?'}
                  </h4>
                  <p className="text-muted-foreground leading-relaxed">
                    {fr
                      ? "L'Assistant IA est un système intelligent qui vous aide à exploiter vos documents de manière conversationnelle. Il combine deux approches complémentaires :"
                      : "The AI Assistant is an intelligent system that helps you leverage your documents conversationally. It combines two complementary approaches:"}
                  </p>
                  <ul className="space-y-2 ml-4">
                    <li className="flex items-start gap-2">
                      <span className="text-primary font-bold">1.</span>
                      <span>
                        <strong>{fr ? 'Recherche sémantique (RAG)' : 'Semantic search (RAG)'}</strong> — {fr
                          ? 'analyse le contenu de vos documents pour répondre à des questions comme « Que dit le contrat de stage ? »'
                          : 'analyzes your documents content to answer questions like "What does the internship contract say?"'}
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary font-bold">2.</span>
                      <span>
                        <strong>{fr ? 'Analyse de métadonnées' : 'Metadata analysis'}</strong> — {fr
                          ? 'interroge la base de données pour des questions comme « Combien de documents ai-je déposés ce mois ? »'
                          : 'queries the database for questions like "How many documents did I upload this month?"'}
                      </span>
                    </li>
                  </ul>
                </div>

                <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    {fr ? 'Sécurité et permissions' : 'Security and permissions'}
                  </h4>
                  <p className="text-muted-foreground leading-relaxed">
                    {fr
                      ? "L'assistant respecte strictement vos permissions : vous n'accédez qu'aux documents de votre département et aux documents non confidentiels (sauf autorisation explicite). Les documents confidentiels ne sont jamais exposés, même par questionnement indirect."
                      : "The assistant strictly respects your permissions: you only access your department's documents and non-confidential ones (unless explicitly authorized). Confidential documents are never exposed, even through indirect questioning."}
                  </p>
                </div>

                <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    {fr ? 'Fonctionnalités disponibles' : 'Available features'}
                  </h4>
                  <ul className="space-y-1 text-muted-foreground ml-4 list-disc">
                    <li>{fr ? 'Chat conversationnel avec contexte documentaire' : 'Conversational chat with document context'}</li>
                    <li>{fr ? 'Résumé de documents sélectionnés' : 'Summary of selected documents'}</li>
                    <li>{fr ? 'Recherche sémantique avec scores de pertinence' : 'Semantic search with relevance scores'}</li>
                    <li>{fr ? 'Analyse rapide du département via cartes prédéfinies' : 'Quick department analysis via predefined cards'}</li>
                    <li>{fr ? 'Historique des conversations avec favoris' : 'Conversation history with favorites'}</li>
                    <li>{fr ? 'Liens cliquables vers les documents sources' : 'Clickable links to source documents'}</li>
                    <li>{fr ? 'Dictée vocale (micro)' : 'Voice input (microphone)'}</li>
                  </ul>
                </div>

                <Button
                  onClick={() => window.open('mailto:admin@sae.com?subject=' + encodeURIComponent(fr ? 'Suggestion d\'amélioration pour l\'Assistant IA' : 'Improvement suggestion for AI Assistant'), '_blank')}
                  className="w-full" size="lg">
                  <Lightbulb className="h-4 w-4 mr-2" />
                  {fr ? 'Suggérer une amélioration' : 'Suggest an improvement'}
                </Button>
              </div>
            )}

            {sectParam === 'chats' && (
              <div className="max-w-md space-y-4">
                <div className="rounded-lg border bg-muted/30 p-4">
                  <p className="text-sm text-muted-foreground">
                    {fr ? <>Vous avez actuellement <strong>{conversations.length}</strong> conversation(s).</> : <>You currently have <strong>{conversations.length}</strong> conversation(s).</>}
                  </p>
                </div>
                <Button variant="outline" className="w-full justify-start" onClick={() => setShowArchiveConfirm(true)} disabled={!conversations.length}>
                  <Archive className="h-4 w-4 mr-2" />{fr ? 'Archiver tous les chats' : 'Archive all chats'}
                </Button>
                <Button variant="destructive" className="w-full justify-start" onClick={() => setShowDeleteConfirm(true)} disabled={!conversations.length}>
                  <Trash2 className="h-4 w-4 mr-2" />{fr ? 'Supprimer tous les chats' : 'Delete all chats'}
                </Button>
              </div>
            )}
          </div>
        )}
      </main>

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-card rounded-lg p-6 max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="h-6 w-6 text-destructive" />
              <h3 className="text-lg font-bold">{fr ? 'Confirmer la suppression' : 'Confirm deletion'}</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              {fr
                ? <>Êtes-vous sûr de vouloir supprimer <strong>{conversations.length} conversation(s)</strong> ? Cette action est irréversible.</>
                : <>Are you sure you want to delete <strong>{conversations.length} conversation(s)</strong>? This action cannot be undone.</>}
            </p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowDeleteConfirm(false)}>{fr ? 'Annuler' : 'Cancel'}</Button>
              <Button variant="destructive" className="flex-1" onClick={supprimerTousLesChats}>{fr ? 'Supprimer' : 'Delete'}</Button>
            </div>
          </div>
        </div>
      )}

      {showArchiveConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowArchiveConfirm(false)}>
          <div className="bg-card rounded-lg p-6 max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <Archive className="h-6 w-6 text-primary" />
              <h3 className="text-lg font-bold">{fr ? 'Confirmer l\'archivage' : 'Confirm archiving'}</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              {fr
                ? <>Êtes-vous sûr de vouloir archiver <strong>{conversations.length} conversation(s)</strong> ? Elles seront marquées comme lues.</>
                : <>Are you sure you want to archive <strong>{conversations.length} conversation(s)</strong>? They will be marked as read.</>}
            </p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowArchiveConfirm(false)}>{fr ? 'Annuler' : 'Cancel'}</Button>
              <Button className="flex-1" onClick={archiverTousLesChats}>{fr ? 'Archiver' : 'Archive'}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}