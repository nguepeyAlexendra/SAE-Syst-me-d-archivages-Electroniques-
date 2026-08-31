import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../i18n/useTranslation';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../../components/ui/dropdown-menu';
import { Sparkles, Send, Plus, Loader2, FileText, Bot, Search, PanelLeftClose, PanelLeftOpen, MoreVertical, Star, StarOff, Pencil, Trash2, Copy, Square, Check } from 'lucide-react';
import { toast } from 'sonner';
import { listerConversations, creerConversation, modifierConversation, supprimerConversation, rechercherConversations, listerMessages, poserQuestion, type Conversation, type MessageChat } from '../../api/assistant';

const SUGGESTIONS_FR = ['Quels documents ont été rejetés ?', 'Résume le dernier contrat', 'Quelle est la durée de conservation des factures ?', 'Parle-moi du stage'];
const SUGGESTIONS_EN = ['Which documents were rejected?', 'Summarize the latest contract', 'What is the retention period for invoices?', 'Tell me about the internship'];

function salutation(fr: boolean) {
  const h = new Date().getHours();
  if (fr) return h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir';
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export default function Assistant() {
  const navigate = useNavigate();
  const { utilisateur } = useAuth();
  const { langue } = useTranslation();
  const fr = langue === 'fr';
  const prenom = (utilisateur as any)?.first_name || (utilisateur as any)?.prenom || utilisateur?.username || '';

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [convActive, setConvActive] = useState<number | null>(null);
  const [messages, setMessages] = useState<MessageChat[]>([]);
  const [question, setQuestion] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [histVisible, setHistVisible] = useState(true);
  const [recherche, setRecherche] = useState('');
  const [renommageId, setRenommageId] = useState<number | null>(null);
  const [nouveauTitre, setNouveauTitre] = useState('');
  const basRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => { listerConversations().then(setConversations).catch(() => {}); }, []);
  useEffect(() => { basRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, envoi]);
  useEffect(() => {
    const t = setTimeout(() => { rechercherConversations(recherche).then(setConversations).catch(() => {}); }, 300);
    return () => clearTimeout(t);
  }, [recherche]);

  async function ouvrirConversation(id: number) {
    setConvActive(id);
    setMessages(await listerMessages(id).catch(() => []));
    const c = conversations.find(x => x.id === id);
    if (c && !c.est_lu) {
      const maj = await modifierConversation(id, { est_lu: true });
      setConversations(p => p.map(x => x.id === id ? maj : x));
    }
  }

  async function nouvelleConversation() { setConvActive(null); setMessages([]); setQuestion(''); }

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

  async function envoyer(texte?: string) {
    const q = (texte ?? question).trim();
    if (!q || envoi) return;
    setEnvoi(true); setQuestion('');
    const ctrl = new AbortController(); abortRef.current = ctrl;
    try {
      let id = convActive;
      if (!id) {
        const c = await creerConversation(); id = c.id; setConvActive(id);
        setConversations(p => [{ ...c, titre: q.slice(0, 50) }, ...p]);
      }
      setMessages(m => [...m, { id: Date.now(), role: 'user', contenu: q }]);
      const r = await poserQuestion(id, q, ctrl.signal);
      setMessages(m => [...m, { id: Date.now() + 1, role: 'assistant', contenu: r.reponse, sources: r.sources }]);
      setConversations(p => p.map(c => c.id === id ? { ...c, titre: q.slice(0, 50) } : c));
      toast.success(fr ? '✅ Réponse prête' : '✅ Response ready');
    } catch (e: any) {
      if (e?.name !== 'AbortError' && e?.code !== 'ERR_CANCELED')
        toast.error(fr ? "L'assistant est indisponible." : 'Assistant unavailable.');
    } finally { setEnvoi(false); abortRef.current = null; }
  }

  function arreter() { abortRef.current?.abort(); setEnvoi(false); }
  function modifierQuestion() {
    const derniere = [...messages].reverse().find(m => m.role === 'user');
    arreter();
    setMessages(m => m.filter(x => x.id !== derniere?.id));
    setQuestion(derniere?.contenu ?? question);
    setTimeout(() => inputRef.current?.focus(), 50);
  }
  function copier(t: string) { navigator.clipboard.writeText(t); toast.success(fr ? 'Copié !' : 'Copied!'); }

  const champSaisie = (grand: boolean) => (
    <div className={`flex gap-2 ${grand ? 'flex-col' : ''}`}>
      <Input ref={inputRef as any} value={question} onChange={e => setQuestion(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && envoyer()}
        placeholder={fr ? 'Comment puis-je vous aider ?' : 'How can I help you?'}
        className={grand ? 'h-14 text-base rounded-2xl px-5' : ''} />
      <Button onClick={() => envoyer()} disabled={envoi || !question.trim()} className={grand ? 'self-end rounded-2xl' : ''}>
        {envoi ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
      </Button>
    </div>
  );

  return (
    <div className="flex h-full">
      {histVisible && (
        <aside className="w-72 border-r flex flex-col bg-card">
          <div className="p-3 space-y-2">
            <div className="flex gap-1 items-center">
              <div className="relative flex-1">
                <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input value={recherche} onChange={e => setRecherche(e.target.value)} placeholder={fr ? 'Rechercher…' : 'Search…'} className="pl-8 h-8" />
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setHistVisible(false)}><PanelLeftClose className="h-4 w-4" /></Button>
            </div>
            <Button className="w-full justify-start" variant="secondary" onClick={nouvelleConversation}><Plus className="h-4 w-4 mr-2" />{fr ? 'Nouvelle conversation' : 'New conversation'}</Button>
          </div>
          <div className="flex-1 overflow-y-auto px-2 space-y-1">
            <p className="text-xs text-muted-foreground px-2 py-1">{fr ? 'Récents' : 'Recent'}</p>
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
        </aside>
      )}

      <main className="flex-1 flex flex-col min-w-0">
        {!histVisible && (
          <div className="p-2"><Button variant="ghost" size="icon" onClick={() => setHistVisible(true)}><PanelLeftOpen className="h-4 w-4" /></Button></div>
        )}

        {convActive === null ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 p-6">
            <h1 className="text-3xl font-bold flex items-center gap-3"><Sparkles className="h-7 w-7" />{salutation(fr)}, {prenom}</h1>
            <div className="w-full max-w-xl">{champSaisie(true)}</div>
            <div className="flex flex-wrap justify-center gap-2">
              {(fr ? SUGGESTIONS_FR : SUGGESTIONS_EN).map(s => (
                <Badge key={s} variant="secondary" className="cursor-pointer" onClick={() => envoyer(s)}>{s}</Badge>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map(m => (
                <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`group max-w-[80%] rounded-lg px-4 py-2 text-sm ${m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                    <p className="whitespace-pre-wrap">{m.contenu}</p>
                    {m.sources && m.sources.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {m.sources.map((s, i) => (
                          <Badge key={i} variant="outline" className="cursor-pointer" onClick={() => navigate(`/documents/${s.document_id}`)}>
                            <FileText className="h-3 w-3 mr-1" />{s.titre}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {m.role === 'assistant' && (
                      <button className="opacity-0 group-hover:opacity-100 mt-1" onClick={() => copier(m.contenu)}><Copy className="h-3 w-3" /></button>
                    )}
                  </div>
                </div>
              ))}
              {envoi && (
                <div className="flex justify-start"><div className="bg-muted rounded-lg px-4 py-2 text-sm flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />{fr ? 'Réflexion…' : 'Thinking…'}</div></div>
              )}
              <div ref={basRef} />
            </div>
            <div className="p-4 border-t space-y-2">
              {envoi && (
                <div className="flex gap-2 justify-center">
                  <Button variant="outline" size="sm" onClick={modifierQuestion}><Pencil className="h-3 w-3 mr-1" />{fr ? 'Modifier' : 'Edit'}</Button>
                  <Button variant="outline" size="sm" onClick={arreter}><Square className="h-3 w-3 mr-1" />{fr ? 'Arrêter' : 'Stop'}</Button>
                  <Button variant="outline" size="sm" onClick={() => copier([...messages].reverse().find(m => m.role === 'user')?.contenu ?? '')}><Copy className="h-3 w-3 mr-1" />{fr ? 'Copier' : 'Copy'}</Button>
                </div>
              )}
              {champSaisie(false)}
            </div>
          </>
        )}
      </main>
    </div>
  );
}