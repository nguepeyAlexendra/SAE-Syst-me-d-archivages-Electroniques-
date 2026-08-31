import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from '../../i18n/useTranslation';
import {
  ArrowRight, Play, Hand, Check, LoaderCircle, Bot, Search, Code, Server,
  Radio, HardDrive, GitBranch, Inbox, Workflow, Lock, Printer, FileCheck, Cpu,
  FileText, Tags, Database, BadgeCheck, ChevronLeft, ChevronRight, ArrowUpRight,
  X, Quote, Star, ChevronDown, LogIn, Languages,
} from 'lucide-react';

/* ================= TRADUCTIONS FR / EN ================= */
const TRAD = {
  fr: {
    bandeau: 'SAE est maintenant disponible chez InnoTechLab.', bandeau_lien: 'Connectez-vous dès aujourd’hui.',
    logo_sub: 'Système d’Archivage Électronique',
    nav_apropos: 'À propos', nav_fonctions: 'Fonctionnalités', nav_pipeline: 'Pipeline ETL', nav_modules: 'Modules', nav_faq: 'FAQ', nav_connexion: 'Se connecter',
    hero_badge: 'Bonjour, bienvenue sur SAE',
    hero_t1: 'Déposez, organisez,', hero_t2: 'retrouvez tout.',
    hero_sub: 'Le Système d’Archivage Électronique d’InnoTechLab : dépôt de documents numériques, pipeline ETL automatique et recherche full-text instantanée.',
    hero_cta: 'Commencer', hero_demo: 'Voir le pipeline',
    stats: [['6', 'étapes ETL automatisées'], ['100%', 'sécurisé & privé'], ['24/7', 'accessible']],
    etapes: [
      { ok: true, t: 'Format vérifié', h: '10:42:01' }, { ok: true, t: 'Métadonnées extraites', h: '10:42:04' },
      { ok: true, t: 'Texte extrait (OCR)', h: '10:42:09' }, { ok: true, t: 'Classé & tagué', h: '10:42:12' },
      { ok: false, t: 'Indexation full-text & vectorielle…', h: '10:42:15' },
    ],
    flot1_t: 'Assistant RAG', flot1_d: 'Réponses sourcées', flot2_t: 'Elasticsearch', flot2_d: '1 245 documents indexés',
    technos_titre: 'Une architecture moderne et robuste',
    feat_titre: 'Découvrez la puissance de votre GED',
    feat_sub: 'Une plateforme interne complète pour gérer le cycle de vie de vos documents, du dépôt à la recherche, en passant par l’archivage sécurisé.',
    fonctions: [
      { t: 'Dépôt multi-formats', d: 'Fichier numérique ou document papier scanné : glisser-déposer, titre pré-rempli et aperçu immédiat.' },
      { t: 'Pipeline ETL automatique', d: 'Format, métadonnées, OCR, tagging, classement et indexation : tout est traité sans intervention humaine.' },
      { t: 'Recherche full-text', d: 'Elasticsearch recherche même à l’intérieur des PDF et scans, avec filtres par catégorie, tag, type, statut et date.' },
      { t: 'Assistant IA (RAG)', d: 'Posez une question en langage naturel : le système retrouve les passages pertinents et génère une réponse fiable, sources citées.' },
      { t: 'Confidentialité gérée', d: 'Documents à accès restreint, liste de personnes autorisées, et page 403 pour les autres. Rien ne fuit.' },
      { t: 'Imprimante & scanner connectés', d: 'Reliez votre imprimante au SAE : scannez un document papier et retrouvez-le aussitôt dans le système, indexé et recherchable.' },
    ],
    feat_cta_t: 'Pas d’inscription libre', feat_cta_d: 'C’est l’administrateur qui crée les comptes, avec une règle de domaine email configurable. Un système 100 % interne.', feat_cta_btn: 'Se connecter',
    pipe_titre: 'Le voyage d’un document, en 6 étapes', pipe_sub: 'Suivi en temps réel dans une timeline visuelle horodatée.',
    pipeline: [
      { t: 'Format vérifié', d: 'Le type de fichier est contrôlé selon les règles définies par l’administrateur.' },
      { t: 'Métadonnées', d: 'Taille, type MIME, dimensions, durée : extraits automatiquement.' },
      { t: 'OCR & texte', d: 'Le contenu des PDF est extrait pour la recherche plein texte.' },
      { t: 'Classement & tags', d: 'Catégorie, tags et département attribués automatiquement.' },
      { t: 'Indexation hybride', d: 'Full-text dans Elasticsearch + indexation vectorielle pour le RAG.' },
      { t: 'Validation', d: 'Document validé, notifié… et interrogeable par l’assistant IA.' },
    ],
    mod_titre: 'Explorez les modules du système', mod_sub: 'Faites défiler, cliquez sur une carte pour découvrir le module en détail.', mod_plus: 'En savoir plus',
    modules: [
      { img: '/img/module-documents.png', t: 'Documents', ext: ['PDF', 'DOCX'], sous: 'Gestion documentaire', desc: 'Chaque dépôt est traité par le pipeline ETL et suivi dans une timeline visuelle horodatée.', d_t: 'Module Documents', d_d: 'Le cœur du SAE : chaque dépôt est traité, suivi et retrouvable.', d_l: ['Dépôt de fichiers numériques (PDF, DOCX…)', 'Pipeline ETL automatique avec timeline horodatée', 'Recherche full-text avec filtres (catégorie, tag, type, date)'] },
      { img: '/img/module-images.png', t: 'Images', ext: ['PNG', 'JPG'], sous: 'Galerie & miniatures', desc: 'Miniatures générées automatiquement, aperçu instantané, classement par mois.', d_t: 'Module Images', d_d: 'Une galerie professionnelle pour tous les visuels de l’organisation.', d_l: ['Miniatures générées automatiquement', 'Aperçu instantané dans les listes et fiches', 'Classement automatique par mois et département', 'Mêmes permissions et partages que les documents'] },
      { img: '/img/module-medias.png', t: 'Médias', ext: ['MP4', 'MP3'], sous: 'Audio & vidéo', desc: 'Fichiers audio et vidéo archivés, métadonnées extraites, dédupliqués automatiquement.', d_t: 'Module Médias', d_d: 'Audio et vidéo archivés avec la même rigueur que les documents.', d_l: ['Métadonnées extraites (durée, dimensions, type MIME)', 'Déduplication : un seul exemplaire par contenu', 'Stockage organisé par type et par mois', 'Lecture et téléchargement réservés aux ayants droit'] },
      { img: '/img/module-confidentiels.png', t: 'Confidentiels', ext: ['PDF', 'XLSX'], sous: 'Sécurité & accès', desc: 'Accès limité à des personnes nommées ; page 403 pour tous les autres.', d_t: 'Documents confidentiels', d_d: 'Le niveau de sécurité maximal du système, contrôlé par l’administrateur.', d_l: ['Seul un administrateur peut activer la confidentialité', 'Liste nominative des utilisateurs autorisés', 'Départements autorisés configurables', 'Page 403 « accès refusé » pour tous les autres'] },
      { img: '/img/module-configuration.png', t: 'Configuration', ext: ['PDF', 'DOCX'], sous: 'Supervision admin', desc: 'Règles de dépôt, paramètres du pipeline et état des services en temps réel.', d_t: 'Configuration système', d_d: 'Le tableau de bord technique de l’administrateur.', d_l: ['Règles de dépôt : taille maximale, formats acceptés', 'Paramètres du pipeline et seuils', 'État des services : Elasticsearch, Kafka, NAS', 'Règle de domaine email pour la création des comptes'] },
    ],
    citation: '« Ce qui n’est pas archivé n’a jamais existé. La mémoire d’une entreprise se construit document par document. »', citation_a: 'Sagesse archivistique',
    temo_titre: 'Ils utilisent SAE au quotidien',
    temoignages: [
      { note: 5, texte: '« Je supervise tout depuis le tableau de bord : statistiques, alertes, comptes et accès. Ma tour de contrôle. »', nom: 'Alexandra', role: 'Administratrice' },
      { note: 5, texte: '« Je dépose, le pipeline fait le reste. Et quand j’ai une question, l’assistant RAG me répond avec la source exacte. »', nom: 'Sihno', role: 'Personnel — Comptabilité' },
      { note: 4, texte: '« Les documents confidentiels ne sont visibles que par les personnes autorisées. Exactement ce qu’il nous fallait. »', nom: 'Darla', role: 'Personnel — RH' },
    ],
    faq_titre: 'Questions fréquentes',
    faq: [
      { q: 'Qui peut créer un compte sur SAE ?', r: 'Personne ne s’inscrit librement : c’est l’administrateur qui crée les comptes. L’email doit respecter la règle de domaine configurée.' },
      { q: 'Comment l’assistant IA (RAG) répond-il ?', r: 'Le système retrouve d’abord les passages pertinents dans vos documents archivés (recherche full-text et sémantique), puis l’IA génère une réponse en langage naturel en citant ses sources. Elle ne répond jamais hors de votre corpus : c’est ce qui la rend fiable.' },
      { q: 'Peut-on chercher à l’intérieur d’un PDF ?', r: 'Oui : l’OCR extrait le texte du contenu, puis Elasticsearch l’indexe. La recherche full-text retrouve un mot même au milieu d’un document.' },
      { q: 'Qui voit un document confidentiel ?', r: 'Uniquement son déposant, les utilisateurs nommément autorisés et les départements autorisés. Tous les autres reçoivent une page 403 « accès refusé ».' },
    ],
    cta_t: 'Prêt à archiver ? Connectez-vous', cta_sub: 'Votre espace vous attend : déposez votre premier document et regardez le pipeline travailler.', cta_btn: 'Accéder à SAE',
    f_tag: 'Le système d’archivage électronique d’InnoTechLab.', f_liens: 'Liens utiles', f_support: 'Support', f_infos: 'Informations', f_lieu: 'InnoTechLab — Cameroun', f_horaires: 'Lun – Ven : 8h – 17h',
    f_droits: '© 2026 SAE — InnoTechLab. Conçu et développé par NGUEYEP NJOMO EMMANUELLE ALEXANDRA',
  },
  en: {
    bandeau: 'SAE is now available at InnoTechLab.', bandeau_lien: 'Sign in today.',
    logo_sub: 'Electronic Archiving System',
    nav_apropos: 'About', nav_fonctions: 'Features', nav_pipeline: 'ETL Pipeline', nav_modules: 'Modules', nav_faq: 'FAQ', nav_connexion: 'Sign in',
    hero_badge: 'Hi, welcome to SAE',
    hero_t1: 'Deposit, organise,', hero_t2: 'retrieve everything.',
    hero_sub: 'InnoTechLab’s Electronic Archiving System: digital document deposit, automatic ETL pipeline and instant full-text search.',
    hero_cta: 'Get started', hero_demo: 'See the pipeline',
    stats: [['6', 'automated ETL steps'], ['100%', 'secure & private'], ['24/7', 'available']],
    etapes: [
      { ok: true, t: 'Format verified', h: '10:42:01' }, { ok: true, t: 'Metadata extracted', h: '10:42:04' },
      { ok: true, t: 'Text extracted (OCR)', h: '10:42:09' }, { ok: true, t: 'Classified & tagged', h: '10:42:12' },
      { ok: false, t: 'Full-text & vector indexing…', h: '10:42:15' },
    ],
    flot1_t: 'RAG Assistant', flot1_d: 'Sourced answers', flot2_t: 'Elasticsearch', flot2_d: '1,245 indexed documents',
    technos_titre: 'A modern, robust architecture',
    feat_titre: 'Discover the power of your DMS',
    feat_sub: 'A complete internal platform to manage your documents’ lifecycle, from deposit to search and secure archiving.',
    fonctions: [
      { t: 'Multi-format deposit', d: 'Digital file or scanned paper document: drag & drop, pre-filled title and instant preview.' },
      { t: 'Automatic ETL pipeline', d: 'Format, metadata, OCR, tagging, classification and indexing: everything is processed without human intervention.' },
      { t: 'Full-text search', d: 'Elasticsearch even searches inside PDFs and scans, with filters by category, tag, type, status and date.' },
      { t: 'AI Assistant (RAG)', d: 'Ask a question in natural language: the system finds the relevant passages and generates a reliable answer, sources cited.' },
      { t: 'Managed confidentiality', d: 'Restricted-access documents, list of authorised people, and 403 page for everyone else. Nothing leaks.' },
      { t: 'Connected printer & scanner', d: 'Link your printer to SAE: scan a paper document and instantly find it in the system, indexed and searchable.' },
    ],
    feat_cta_t: 'No free registration', feat_cta_d: 'The administrator creates the accounts, with a configurable email domain rule. A 100% internal system.', feat_cta_btn: 'Sign in',
    pipe_titre: 'A document’s journey, in 6 steps', pipe_sub: 'Tracked in real time in a timestamped visual timeline.',
    pipeline: [
      { t: 'Format verified', d: 'The file type is checked against the rules defined by the administrator.' },
      { t: 'Metadata', d: 'Size, MIME type, dimensions, duration: extracted automatically.' },
      { t: 'OCR & text', d: 'PDF content is extracted for full-text search.' },
      { t: 'Classification & tags', d: 'Category, tags and department assigned automatically.' },
      { t: 'Hybrid indexing', d: 'Full-text in Elasticsearch + vector indexing for the RAG.' },
      { t: 'Validation', d: 'Document validated, notified… and queryable by the AI assistant.' },
    ],
    mod_titre: 'Explore the system’s modules', mod_sub: 'Scroll, click a card to discover the module in detail.', mod_plus: 'Learn more',
    modules: [
      { img: '/img/module-documents.png', t: 'Documents', ext: ['PDF', 'DOCX'], sous: 'Document management', desc: 'Every deposit is processed by the ETL pipeline and tracked in a timestamped visual timeline.', d_t: 'Documents module', d_d: 'The heart of SAE: every deposit is processed, tracked and retrievable.', d_l: ['Digital file deposit (PDF, DOCX…)', 'Automatic ETL pipeline with timestamped timeline', 'Full-text search with filters (category, tag, type, date)'] },
      { img: '/img/module-images.png', t: 'Images', ext: ['PNG', 'JPG'], sous: 'Gallery & thumbnails', desc: 'Automatic thumbnails, instant preview, month-based organisation.', d_t: 'Images module', d_d: 'A professional gallery for all the organisation’s visuals.', d_l: ['Automatic thumbnails', 'Instant preview in lists and detail pages', 'Automatic organisation by month and department', 'Same permissions and sharing as documents'] },
      { img: '/img/module-medias.png', t: 'Media', ext: ['MP4', 'MP3'], sous: 'Audio & video', desc: 'Audio and video archived, metadata extracted, automatically deduplicated.', d_t: 'Media module', d_d: 'Audio and video archived with the same rigour as documents.', d_l: ['Metadata extracted (duration, dimensions, MIME type)', 'Deduplication: one copy per content', 'Storage organised by type and month', 'Playback and download restricted to authorised users'] },
      { img: '/img/module-confidentiels.png', t: 'Confidential', ext: ['PDF', 'XLSX'], sous: 'Security & access', desc: 'Access limited to named people; 403 page for everyone else.', d_t: 'Confidential documents', d_d: 'The system’s highest security level, controlled by the administrator.', d_l: ['Only an administrator can enable confidentiality', 'Nominative list of authorised users', 'Configurable authorised departments', '403 “access denied” page for everyone else'] },
      { img: '/img/module-configuration.png', t: 'Configuration', ext: ['PDF', 'DOCX'], sous: 'Admin supervision', desc: 'Deposit rules, pipeline parameters and live service status.', d_t: 'System configuration', d_d: 'The administrator’s technical dashboard.', d_l: ['Deposit rules: max size, accepted formats', 'Pipeline parameters and thresholds', 'Service status: Elasticsearch, Kafka, NAS', 'Email domain rule for account creation'] },
    ],
    citation: '“What is not archived never existed. A company’s memory is built document by document.”', citation_a: 'Archival wisdom',
    temo_titre: 'They use SAE every day',
    temoignages: [
      { note: 5, texte: '“I supervise everything from the dashboard: statistics, alerts, accounts and access. My control tower.”', nom: 'Alexandra', role: 'Administrator' },
      { note: 5, texte: '“I deposit, the pipeline does the rest. And when I have a question, the RAG assistant answers with the exact source.”', nom: 'Sihno', role: 'Staff — Accounting' },
      { note: 4, texte: '“Confidential documents are only visible to authorised people. Exactly what we needed.”', nom: 'Darla', role: 'Staff — HR' },
    ],
    faq_titre: 'Frequently asked questions',
    faq: [
      { q: 'Who can create an SAE account?', r: 'Nobody registers freely: the administrator creates the accounts. The email must respect the configured domain rule.' },
      { q: 'How does the AI assistant (RAG) answer?', r: 'The system first retrieves the relevant passages from your archived documents (full-text and semantic search), then the AI generates a natural-language answer citing its sources. It never answers outside your corpus: that is what makes it reliable.' },
      { q: 'Can you search inside a PDF?', r: 'Yes: OCR extracts the content’s text, then Elasticsearch indexes it. Full-text search finds a word even in the middle of a document.' },
      { q: 'Who sees a confidential document?', r: 'Only its depositor, the nominatively authorised users and the authorised departments. Everyone else receives a 403 “access denied” page.' },
    ],
    cta_t: 'Ready to archive? Sign in', cta_sub: 'Your space is waiting: deposit your first document and watch the pipeline work.', cta_btn: 'Access SAE',
    f_tag: 'InnoTechLab’s electronic archiving system.', f_liens: 'Useful links', f_support: 'Support', f_infos: 'Information', f_lieu: 'InnoTechLab — Cameroon', f_horaires: 'Mon – Fri: 8am – 5pm',
    f_droits: '© 2026 SAE — InnoTechLab. Designed and developed by NGUEYEP NJOMO EMMANUELLE ALEXANDRA',
  },
};

const ICONES_F = [Inbox, Workflow, Search, Bot, Lock, Printer];
const ICONES_P = [FileCheck, Cpu, FileText, Tags, Database, BadgeCheck];
const TECHNO = [
  { ic: Code, n: 'React' }, { ic: Server, n: 'Django REST' }, { ic: Search, n: 'Elasticsearch' },
  { ic: Radio, n: 'Kafka' }, { ic: HardDrive, n: 'MinIO / NAS' }, { ic: GitBranch, n: 'GitHub' },
];

function Reveal({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVisible(true); obs.disconnect(); }
    }, { threshold: 0.15 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} className={`${className} transition-all duration-700 ${visible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
      {children}
    </div>
  );
}

export default function Landing() {
  const navigate = useNavigate();
  const { langue, basculerLangue } = useTranslation();
  const L = TRAD[langue === 'en' ? 'en' : 'fr'];
  const [defile, setDefile] = useState(false);
  const [faqOuverte, setFaqOuverte] = useState<number | null>(0);
  const [moduleOuvert, setModuleOuvert] = useState<number | null>(null);
  const carrousel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setDefile(window.scrollY > 40);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (window.location.hash) {
      document.querySelector(window.location.hash)?.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  const mod = moduleOuvert !== null ? L.modules[moduleOuvert] : null;

  return (
    <div className="vitrine min-h-screen bg-[#f7f4ec] text-[#1c1917]">
      {/* Bandeau */}
      <div className="bg-[#1c1917] py-2 text-center text-xs text-[#f7f4ec]">
        {L.bandeau}{' '}
        <button onClick={() => navigate('/login')} className="font-bold underline">{L.bandeau_lien}</button>
      </div>

      {/* Navbar */}
      <header className={`sticky top-0 z-40 border-b border-[#e2dac9] bg-[#f7f4ec] transition-shadow ${defile ? 'shadow-lg' : ''}`}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link to="/landing" className="font-heading flex items-center gap-2.5 text-2xl font-bold">
            <img src="/img/logo-sae.png" alt="Logo SAE" className="h-10 w-10 rounded-[10px] object-contain" />
            <span>SAE<span className="block font-sans text-[10px] font-medium tracking-widest text-[#78716c]">{L.logo_sub}</span></span>
          </Link>
          <nav className="hidden items-center gap-8 text-sm md:flex">
            <Link to="/a-propos" className="hover:text-[#9a6b2f]">{L.nav_apropos}</Link>
            <a href="#fonctionnalites" className="hover:text-[#9a6b2f]">{L.nav_fonctions}</a>
            <a href="#pipeline" className="hover:text-[#9a6b2f]">{L.nav_pipeline}</a>
            <a href="#modules" className="hover:text-[#9a6b2f]">{L.nav_modules}</a>
            <a href="#faq" className="hover:text-[#9a6b2f]">{L.nav_faq}</a>
          </nav>
          <div className="flex items-center gap-3">
            <button onClick={basculerLangue} className="flex items-center gap-1.5 rounded-full border border-[#e2dac9] px-3 py-1.5 text-xs font-bold text-[#78716c] transition hover:border-[#9a6b2f] hover:text-[#9a6b2f]" aria-label="Changer de langue">
              <Languages className="h-3.5 w-3.5" /> {langue === 'fr' ? 'EN' : 'FR'}
            </button>
            <button onClick={() => navigate('/login')} className="rounded-full bg-[#1c1917] px-6 py-2.5 text-sm font-semibold text-[#f7f4ec] transition hover:-translate-y-0.5 hover:bg-[#292524]">{L.nav_connexion}</button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-[#1c1917] pb-32 pt-16 text-[#f7f4ec]" style={{ clipPath: 'polygon(0 0,100% 0,100% 92%,0 100%)' }}>
        <div className="mx-auto grid max-w-6xl items-center gap-14 px-6 md:grid-cols-2">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-[#f7f4ec]/15 bg-[#f7f4ec]/10 px-4 py-1.5 text-sm"><Hand className="h-4 w-4" /> {L.hero_badge}</span>
            <h1 className="mt-6 text-4xl leading-tight md:text-5xl">{L.hero_t1} <span className="text-[#a8a29e]">{L.hero_t2}</span></h1>
            <p className="mt-5 max-w-md text-[15px] leading-7 text-[#d6d3d1]">{L.hero_sub}</p>
            <div className="mt-8 flex items-center gap-6">
              <button onClick={() => navigate('/login')} className="inline-flex items-center gap-2 rounded-full bg-[#f7f4ec] px-7 py-3 text-sm font-semibold text-[#1c1917] transition hover:-translate-y-0.5">{L.hero_cta} <ArrowRight className="h-4 w-4" /></button>
              <a href="#pipeline" className="inline-flex items-center gap-2 text-sm font-semibold hover:text-[#f3e9d8]"><Play className="h-4 w-4" /> {L.hero_demo}</a>
            </div>
            <div className="mt-12 flex gap-10 border-t border-[#f7f4ec]/15 pt-6">
              {L.stats.map(([v, l]) => (
                <div key={l}><p className="font-heading text-3xl font-bold">{v}</p><p className="mt-1 text-xs text-[#a8a29e]">{l}</p></div>
              ))}
            </div>
          </Reveal>

          <Reveal className="relative mx-auto w-full max-w-md">
            <div className="overflow-hidden rounded-2xl bg-[#fffdf9] text-[#1c1917] shadow-2xl">
              <div className="flex items-center gap-1.5 border-b border-[#e2dac9] px-4 py-3 text-xs text-[#78716c]">
                <span className="h-2.5 w-2.5 rounded-full bg-red-400" /><span className="h-2.5 w-2.5 rounded-full bg-amber-400" /><span className="h-2.5 w-2.5 rounded-full bg-green-400" />
                <span className="ml-2 font-mono">SAE — DEPOT_EN_COURS.pdf</span>
              </div>
              <div className="flex flex-col gap-3 p-4">
                {L.etapes.map((e) => (
                  <div key={e.t} className="flex items-center justify-between rounded-lg border border-[#e2dac9] px-3.5 py-2.5 text-[13px] font-semibold">
                    <span className={`flex items-center gap-2 ${e.ok ? '' : 'text-[#9a6b2f]'}`}>
                      {e.ok ? <Check className="h-4 w-4 text-[#15803d]" /> : <LoaderCircle className="h-4 w-4 animate-spin" />} {e.t}
                    </span>
                    <small className="font-mono font-normal text-[#78716c]">{e.h}</small>
                  </div>
                ))}
              </div>
            </div>
            <div className="anime-flotter absolute -left-10 top-8 flex items-center gap-2.5 rounded-xl border border-[#e2dac9] bg-[#fffdf9] p-3 text-xs font-bold text-[#1c1917] shadow-xl">
              <Bot className="h-5 w-5 text-[#9a6b2f]" /><span>{L.flot1_t}<small className="block font-normal text-[#78716c]">{L.flot1_d}</small></span>
            </div>
            <div className="anime-flotter-2 absolute -right-6 bottom-8 flex items-center gap-2.5 rounded-xl border border-[#e2dac9] bg-[#fffdf9] p-3 text-xs font-bold text-[#1c1917] shadow-xl">
              <Search className="h-5 w-5 text-[#9a6b2f]" /><span>{L.flot2_t}<small className="block font-normal text-[#78716c]">{L.flot2_d}</small></span>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Technos */}
      <section className="py-16 text-center">
        <Reveal className="mx-auto max-w-6xl px-6">
          <h2 className="text-xl font-semibold text-[#292524]">{L.technos_titre}</h2>
          <div className="mt-9 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-[#e2dac9] bg-[#e2dac9] sm:grid-cols-3 md:grid-cols-6">
            {TECHNO.map((t) => (
              <div key={t.n} className="flex flex-col items-center gap-2.5 bg-[#fffdf9] px-2 py-6 font-mono text-[13px] font-semibold text-[#78716c] hover:text-[#1c1917]">
                <t.ic className="h-5 w-5 text-[#9a6b2f]" /> {t.n}
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* Fonctionnalités */}
      <section id="fonctionnalites" className="py-14">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal className="mb-11 grid items-end gap-10 md:grid-cols-2">
            <h2 className="text-3xl leading-snug">{L.feat_titre}</h2>
            <p className="text-[15px] leading-7 text-[#78716c]">{L.feat_sub}</p>
          </Reveal>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {L.fonctions.map((f, i) => {
              const Icone = ICONES_F[i];
              return (
                <Reveal key={f.t}>
                  <div className="h-full rounded-xl border border-[#e2dac9] bg-[#fffdf9] p-6 transition hover:-translate-y-1.5 hover:border-[#9a6b2f] hover:shadow-xl">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#f3e9d8] text-[#9a6b2f]"><Icone className="h-5 w-5" /></span>
                    <h3 className="mt-4 text-[17px]">{f.t}</h3>
                    <p className="mt-2 text-[13px] leading-6 text-[#78716c]">{f.d}</p>
                  </div>
                </Reveal>
              );
            })}
            <Reveal>
              <div className="flex h-full flex-col justify-between rounded-xl bg-gradient-to-br from-[#292524] to-[#1c1917] p-6 text-[#f7f4ec]">
                <div><h3 className="text-[17px]">{L.feat_cta_t}</h3><p className="mt-2 text-[13px] leading-6 text-[#a8a29e]">{L.feat_cta_d}</p></div>
                <button onClick={() => navigate('/login')} className="mt-6 w-fit rounded-full bg-[#f7f4ec] px-6 py-2.5 text-sm font-semibold text-[#1c1917] transition hover:-translate-y-0.5">{L.feat_cta_btn}</button>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Pipeline */}
      <section id="pipeline" className="bg-[#1c1917] py-24 text-[#f7f4ec]" style={{ clipPath: 'polygon(0 4%,100% 0,100% 96%,0 100%)' }}>
        <div className="mx-auto max-w-6xl px-6">
          <Reveal><h2 className="text-center text-3xl">{L.pipe_titre}</h2>
          <p className="mt-3 text-center text-sm text-[#a8a29e]">{L.pipe_sub}</p></Reveal>
          <div className="mt-14 grid gap-9 sm:grid-cols-2 lg:grid-cols-3">
            {L.pipeline.map((p, i) => {
              const Icone = ICONES_P[i];
              return (
                <Reveal key={p.t} className="text-center">
                  <span className="mx-auto flex h-[54px] w-[54px] items-center justify-center rounded-full border border-[#9a6b2f]/60 bg-[#9a6b2f]/15 text-[#f3e9d8]"><Icone className="h-5 w-5" /></span>
                  <h3 className="mt-4 text-base">{p.t}</h3>
                  <p className="mt-2 text-[13px] leading-6 text-[#a8a29e]">{p.d}</p>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* Modules */}
      <section id="modules" className="py-20">
        <Reveal className="mb-11 text-center">
          <h2 className="text-3xl">{L.mod_titre}</h2>
          <p className="mt-2.5 text-sm text-[#78716c]">{L.mod_sub}</p>
        </Reveal>
        <div className="relative mx-auto max-w-7xl px-16">
          <button onClick={() => carrousel.current?.scrollBy({ left: -320, behavior: 'smooth' })} className="absolute left-4 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-[#e2dac9] bg-[#fffdf9] transition hover:bg-[#1c1917] hover:text-[#f7f4ec]" aria-label="Précédent"><ChevronLeft className="h-5 w-5" /></button>
          <div ref={carrousel} className="flex gap-5 overflow-x-auto p-2.5 [scroll-snap-type:x_mandatory] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {L.modules.map((m, i) => (
              <button key={m.t} onClick={() => setModuleOuvert(i)} className="w-[280px] shrink-0 overflow-hidden rounded-xl border border-[#1c1917]/10 bg-[#1c1917] text-left text-[#f7f4ec] transition [scroll-snap-align:start] hover:-translate-y-2 hover:border-[#9a6b2f] hover:shadow-2xl">
                <div className="h-40 overflow-hidden bg-[#fffdf9]">
                  <img src={m.img} alt={`${m.t}`} className="h-full w-full object-cover object-top transition duration-500 hover:scale-105" />
                </div>
                <div className="p-5">
                  <h3 className="text-[17px]">{m.t}</h3>
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-[#9a6b2f]">
                    ★★★★★
                    {m.ext.map((e) => <span key={e} className="rounded-md border border-[#f7f4ec]/15 bg-[#f7f4ec]/10 px-2 py-0.5 font-mono text-[10px] font-bold tracking-wider text-[#a8a29e]">{e}</span>)}
                  </div>
                  <p className="mt-1 text-[13px] text-[#f3e9d8]">{m.sous}</p>
                  <p className="mt-2 min-h-[62px] text-[13px] leading-6 text-[#a8a29e]">{m.desc}</p>
                  <span className="mt-1 inline-flex items-center gap-1.5 text-[13px] font-bold text-[#d6a75c]">{L.mod_plus} <ArrowUpRight className="h-3.5 w-3.5" /></span>
                </div>
              </button>
            ))}
          </div>
          <button onClick={() => carrousel.current?.scrollBy({ left: 320, behavior: 'smooth' })} className="absolute right-4 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-[#e2dac9] bg-[#fffdf9] transition hover:bg-[#1c1917] hover:text-[#f7f4ec]" aria-label="Suivant"><ChevronRight className="h-5 w-5" /></button>
        </div>
      </section>

      {/* Fenêtre de détail module */}
      {mod && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1c1917]/60 backdrop-blur-sm" onClick={() => setModuleOuvert(null)}>
          <div className="relative w-[calc(100%-48px)] max-w-lg animate-[pop_.3s_ease] rounded-2xl bg-[#fffdf9] p-8" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setModuleOuvert(null)} className="absolute right-4 top-4 text-[#78716c] hover:text-[#1c1917]" aria-label="Fermer"><X className="h-5 w-5" /></button>
            <h3 className="text-2xl">{mod.d_t}</h3>
            <p className="mt-2.5 text-sm leading-7 text-[#78716c]">{mod.d_d}</p>
            <ul className="mt-4 flex flex-col gap-2.5">
              {mod.d_l.map((li) => (
                <li key={li} className="flex items-start gap-2.5 text-sm font-semibold"><Check className="mt-0.5 h-4 w-4 shrink-0 text-[#15803d]" /> {li}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Citation */}
      <section className="bg-[#1c1917] px-6 py-28 text-center text-[#f7f4ec]" style={{ clipPath: 'polygon(0 6%,100% 0,100% 100%,0 94%)' }}>
        <Reveal>
          <Quote className="mx-auto mb-5 h-7 w-7 text-[#9a6b2f]" />
          <p className="font-heading mx-auto max-w-3xl text-2xl font-semibold leading-relaxed">{L.citation}</p>
          <div className="mx-auto my-6 h-px w-10 bg-[#f7f4ec]/40" />
          <small className="text-[13px] text-[#a8a29e]">{L.citation_a}</small>
        </Reveal>
      </section>

      {/* Témoignages */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal><h2 className="text-center text-3xl">{L.temo_titre}</h2></Reveal>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {L.temoignages.map((tm) => (
              <Reveal key={tm.nom}>
                <div className="rounded-xl border border-[#e2dac9] bg-[#fffdf9] p-6 shadow-sm">
                  <div className="flex gap-0.5 text-[#9a6b2f]">
                    {[...Array(5)].map((_, i) => <Star key={i} className={`h-4 w-4 ${i < tm.note ? 'fill-current' : 'text-[#e2dac9]'}`} />)}
                  </div>
                  <p className="mt-3.5 text-[13px] leading-6 text-[#292524]">{tm.texte}</p>
                  <div className="mt-5 flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f3e9d8] text-sm font-extrabold text-[#9a6b2f]">{tm.nom[0]}</span>
                    <div><p className="text-sm font-semibold">{tm.nom}</p><p className="text-xs text-[#78716c]">{tm.role}</p></div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="pb-20">
        <div className="mx-auto max-w-3xl px-6">
          <Reveal><h2 className="mb-10 text-center text-3xl">{L.faq_titre}</h2></Reveal>
          <div className="flex flex-col gap-3">
            {L.faq.map((item, i) => (
              <Reveal key={i}>
                <div className="overflow-hidden rounded-xl border border-[#e2dac9] bg-[#fffdf9]">
                  <button className="font-heading flex w-full items-center justify-between px-6 py-4 text-left text-[17px] font-semibold" onClick={() => setFaqOuverte(faqOuverte === i ? null : i)}>
                    {item.q}
                    <ChevronDown className={`h-4 w-4 shrink-0 text-[#78716c] transition-transform ${faqOuverte === i ? 'rotate-180' : ''}`} />
                  </button>
                  {faqOuverte === i && <p className="px-6 pb-5 text-sm leading-7 text-[#78716c]">{item.r}</p>}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="bg-[#1c1917] px-6 pb-24 pt-32 text-center text-[#f7f4ec]" style={{ clipPath: 'polygon(0 10%,100% 0,100% 100%,0 100%)' }}>
        <Reveal>
          <h2 className="text-3xl">{L.cta_t}</h2>
          <p className="mt-4 text-[15px] text-[#d6d3d1]">{L.cta_sub}</p>
          <button onClick={() => navigate('/login')} className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#f7f4ec] px-8 py-3 text-sm font-semibold text-[#1c1917] transition hover:-translate-y-0.5">{L.cta_btn} <LogIn className="h-4 w-4" /></button>
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#f7f4ec]/10 bg-[#1c1917] pb-8 pt-10 text-[#a8a29e]">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 md:grid-cols-4">
          <div>
            <p className="font-heading flex items-center gap-2.5 text-xl font-bold text-[#f7f4ec]"><img src="/img/logo-sae.png" alt="" className="h-8 w-8 rounded-lg object-contain" /> SAE</p>
            <p className="mt-3 text-[13px]">{L.f_tag}</p>
          </div>
          <div>
            <p className="mb-3.5 text-sm font-semibold text-[#f7f4ec]">{L.f_liens}</p>
            <Link to="/a-propos" className="mb-2 block text-[13px] hover:text-[#f7f4ec]">{L.nav_apropos}</Link>
            <a href="#fonctionnalites" className="mb-2 block text-[13px] hover:text-[#f7f4ec]">{L.nav_fonctions}</a>
            <a href="#pipeline" className="mb-2 block text-[13px] hover:text-[#f7f4ec]">{L.nav_pipeline}</a>
            <a href="#modules" className="block text-[13px] hover:text-[#f7f4ec]">{L.nav_modules}</a>
          </div>
          <div>
            <p className="mb-3.5 text-sm font-semibold text-[#f7f4ec]">{L.f_support}</p>
            <p className="mb-2 text-[13px]">emma@dta-alliance.com</p>
            <a href="#faq" className="block text-[13px] hover:text-[#f7f4ec]">{L.nav_faq}</a>
          </div>
          <div>
            <p className="mb-3.5 text-sm font-semibold text-[#f7f4ec]">{L.f_infos}</p>
            <p className="mb-2 text-[13px]">{L.f_lieu}</p>
            <p className="text-[13px]">{L.f_horaires}</p>
          </div>
        </div>
        <p className="mt-9 text-center text-xs text-[#78716c]">{L.f_droits}</p>
      </footer>
    </div>
  );
}