import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from '../../i18n/useTranslation';
import { Factory, GraduationCap, Bot, Building2, Boxes, LogIn, Languages } from 'lucide-react';

/* ================= TRADUCTIONS FR / EN ================= */
const TRAD = {
  fr: {
    bandeau: 'SAE est maintenant disponible chez InnoTechLab.', bandeau_lien: 'Connectez-vous dès aujourd’hui.',
    logo_sub: 'Système d’Archivage Électronique',
    nav_accueil: 'Accueil', nav_apropos: 'À propos', nav_fonctions: 'Fonctionnalités', nav_pipeline: 'Pipeline ETL', nav_modules: 'Modules', nav_faq: 'FAQ', nav_connexion: 'Se connecter',
    hero_t1: 'L’avenir de l’innovation', hero_t2: 'commence ici',
    hero_sub: 'Chez InnoTechLab, nous croyons que l’innovation ne vaut que si elle est mémorisée, partagée et transmise. C’est le rôle du SAE : la mémoire numérique du centre.',
    pres_badge: 'InnoTechLab — Cameroun',
    pres_t: 'Plus près d’InnoTechLab',
    pres_txt: '<strong>InnoTechLab</strong> est un centre d’innovation technologique à visée industrielle et pédagogique, créé au Cameroun par <strong>Digital Transformation Alliance</strong> avec le soutien de la <strong>Fondation Dassault Systèmes</strong>. Il sert de hub central pour l’information du centre : projets, simulations, prototypes, formations et recherche.',
    vision1_t: 'Industrie 4.0', vision1_d: 'Promouvoir l’industrialisation locale et l’ingénierie numérique au cœur de l’Afrique.',
    vision2_t: 'Pédagogie', vision2_d: 'Former les étudiants et chercheurs par la pratique : simulation 3D et robotique.',
    pres_sig: '<strong>SAE</strong> — conçu et développé par NGUEYEP NJOMO EMMANUELLE ALEXANDRA pour InnoTechLab.',
    flot1_t: 'Formation & recherche', flot1_d: 'Étudiants & chercheurs',
    flot2_t: 'Assistant RAG', flot2_d: 'Réponses sourcées',
    serv_t: 'Nos services',
    services: [
      { t: 'Simulation virtuelle 3D', d: 'Modélisation et simulation de jumeaux numériques pour tester, valider et optimiser avant de produire.' },
      { t: 'Prototypes robotiques', d: 'Conception et création de prototypes robotiques, du cahier des charges au banc d’essai.' },
      { t: 'Formation professionnelle', d: 'Parcours pratiques pour étudiants et chercheurs : ingénierie numérique, industrie 4.0, outils 3D.' },
    ],
    hist_t: 'L’histoire derrière le centre',
    hist_sub: 'D’une ambition — l’industrialisation locale par le numérique — à un centre complet d’innovation et de formation.',
    timeline: [
      { annee: '2020', t: 'Création d’InnoTechLab', d: 'Le centre est créé au Cameroun par Digital Transformation Alliance.' },
      { annee: '2022', t: 'Soutien de la Fondation Dassault Systèmes', d: 'Un partenariat qui dote le centre d’outils d’ingénierie numérique de niveau mondial.' },
      { annee: '2024', t: 'Ateliers simulation 3D & robotique', d: 'Ouverture des programmes de formation pour étudiants et chercheurs.' },
      { annee: '2026', t: 'Déploiement du SAE', d: 'La mémoire numérique du centre : archivage intelligent, recherche full-text et assistant IA (RAG).' },
    ],
    equipe_t: 'L’équipe derrière le système',
    dev_nom: 'NGUEYEP NJOMO EMMANUELLE ALEXANDRA',
    dev_role: 'Développeuse full-stack — conceptrice du SAE',
    dev_citation: '« De l’idée au déploiement : interface React, backend Django, pipeline ETL, stockage MinIO, recherche Elasticsearch et assistant IA (RAG). »',
    cta_t: 'Un projet en tête ? Parlons-en', cta_sub: 'Découvrez le système qui mémorise l’innovation d’InnoTechLab.', cta_btn: 'Accéder à SAE',
    f_tag: 'Le système d’archivage électronique d’InnoTechLab.',
    f_liens: 'Liens utiles', f_support: 'Support', f_infos: 'Informations',
    f_lieu: 'InnoTechLab — Cameroun', f_horaires: 'Lun – Ven : 8h – 17h',
    f_droits: '© 2026 SAE — InnoTechLab. Conçu et développé par NGUEYEP NJOMO EMMANUELLE ALEXANDRA',
  },
  en: {
    bandeau: 'SAE is now available at InnoTechLab.', bandeau_lien: 'Sign in today.',
    logo_sub: 'Electronic Archiving System',
    nav_accueil: 'Home', nav_apropos: 'About', nav_fonctions: 'Features', nav_pipeline: 'ETL Pipeline', nav_modules: 'Modules', nav_faq: 'FAQ', nav_connexion: 'Sign in',
    hero_t1: 'The future of innovation', hero_t2: 'starts here',
    hero_sub: 'At InnoTechLab, we believe innovation only matters when it is remembered, shared and passed on. That is the role of SAE: the digital memory of the centre.',
    pres_badge: 'InnoTechLab — Cameroon',
    pres_t: 'Closer to InnoTechLab',
    pres_txt: '<strong>InnoTechLab</strong> is a technology innovation centre with an industrial and educational mission, created in Cameroon by <strong>Digital Transformation Alliance</strong> with the support of the <strong>Dassault Systèmes Foundation</strong>. It acts as a central hub for the centre’s information: projects, simulations, prototypes, training and research.',
    vision1_t: 'Industry 4.0', vision1_d: 'Promoting local industrialisation and digital engineering at the heart of Africa.',
    vision2_t: 'Education', vision2_d: 'Training students and researchers through practice: 3D simulation and robotics.',
    pres_sig: '<strong>SAE</strong> — designed and developed by NGUEYEP NJOMO EMMANUELLE ALEXANDRA for InnoTechLab.',
    flot1_t: 'Training & research', flot1_d: 'Students & researchers',
    flot2_t: 'RAG Assistant', flot2_d: 'Sourced answers',
    serv_t: 'Our services',
    services: [
      { t: '3D Virtual Simulation', d: 'Modelling and simulation of digital twins to test, validate and optimise before producing.' },
      { t: 'Robotic Prototypes', d: 'Design and creation of robotic prototypes, from specification to test bench.' },
      { t: 'Professional Training', d: 'Hands-on programmes for students and researchers: digital engineering, Industry 4.0, 3D tools.' },
    ],
    hist_t: 'The story behind the centre',
    hist_sub: 'From an ambition — local industrialisation through digital technology — to a complete centre for innovation and training.',
    timeline: [
      { annee: '2020', t: 'Creation of InnoTechLab', d: 'The centre is created in Cameroon by Digital Transformation Alliance.' },
      { annee: '2022', t: 'Support from the Dassault Systèmes Foundation', d: 'A partnership that equips the centre with world-class digital engineering tools.' },
      { annee: '2024', t: '3D simulation & robotics workshops', d: 'Opening of training programmes for students and researchers.' },
      { annee: '2026', t: 'Deployment of SAE', d: 'The digital memory of the centre: intelligent archiving, full-text search and AI assistant (RAG).' },
    ],
    equipe_t: 'The team behind the system',
    dev_nom: 'NGUEYEP NJOMO EMMANUELLE ALEXANDRA',
    dev_role: 'Full-stack developer — SAE designer',
    dev_citation: '“From idea to deployment: React interface, Django backend, ETL pipeline, MinIO storage, Elasticsearch search and AI assistant (RAG).”',
    cta_t: 'Got a project in mind? Let’s talk', cta_sub: 'Discover the system that remembers InnoTechLab’s innovation.', cta_btn: 'Access SAE',
    f_tag: 'InnoTechLab’s electronic archiving system.',
    f_liens: 'Useful links', f_support: 'Support', f_infos: 'Information',
    f_lieu: 'InnoTechLab — Cameroon', f_horaires: 'Mon – Fri: 8am – 5pm',
    f_droits: '© 2026 SAE — InnoTechLab. Designed and developed by NGUEYEP NJOMO EMMANUELLE ALEXANDRA',
  },
};

const SERVICES_ICONES = [Boxes, Bot, GraduationCap];
const STACK = ['React', 'Django REST', 'Elasticsearch', 'Kafka', 'MinIO', 'RAG'];

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

export default function APropos() {
  const navigate = useNavigate();
  const { langue, basculerLangue } = useTranslation();
  const L = TRAD[langue === 'en' ? 'en' : 'fr'];
  const [defile, setDefile] = useState(false);

  useEffect(() => {
    const onScroll = () => setDefile(window.scrollY > 40);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

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
            <Link to="/landing" className="hover:text-[#9a6b2f]">{L.nav_accueil}</Link>
            <span className="font-bold text-[#9a6b2f]">{L.nav_apropos}</span>
            <Link to="/landing" className="hover:text-[#9a6b2f]">{L.nav_fonctions}</Link>
            <Link to="/landing" className="hover:text-[#9a6b2f]">{L.nav_faq}</Link>
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
      <section className="bg-[#1c1917] pb-36 pt-24 text-[#f7f4ec]" style={{ clipPath: 'polygon(0 0,100% 0,100% 90%,0 100%)' }}>
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 md:grid-cols-[1.2fr_.8fr]">
          <Reveal><h1 className="text-4xl leading-tight md:text-[42px]">{L.hero_t1} <span className="text-[#a8a29e]">{L.hero_t2}</span></h1></Reveal>
          <Reveal><p className="text-[15px] leading-8 text-[#d6d3d1]">{L.hero_sub}</p></Reveal>
        </div>
      </section>

      {/* Présentation */}
      <section className="py-24">
        <div className="mx-auto grid max-w-6xl items-center gap-14 px-6 md:grid-cols-[.9fr_1.1fr]">
          <Reveal className="relative">
            <div className="flex h-[360px] items-center justify-center rounded-2xl border border-[#e2dac9] bg-gradient-to-br from-[#f3e9d8] to-[#e2dac9] text-[#9a6b2f]">
              <Factory className="h-[70px] w-[70px]" />
            </div>
            <div className="anime-flotter absolute -left-5 top-6 flex items-center gap-2.5 rounded-xl border border-[#e2dac9] bg-[#fffdf9] p-3 text-xs font-bold text-[#1c1917] shadow-xl">
              <GraduationCap className="h-5 w-5 text-[#9a6b2f]" /><span>{L.flot1_t}<small className="block font-normal text-[#78716c]">{L.flot1_d}</small></span>
            </div>
            <div className="anime-flotter-2 absolute -right-5 bottom-6 flex items-center gap-2.5 rounded-xl border border-[#e2dac9] bg-[#fffdf9] p-3 text-xs font-bold text-[#1c1917] shadow-xl">
              <Bot className="h-5 w-5 text-[#9a6b2f]" /><span>{L.flot2_t}<small className="block font-normal text-[#78716c]">{L.flot2_d}</small></span>
            </div>
          </Reveal>
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full bg-[#f3e9d8] px-4 py-2 text-xs font-bold text-[#9a6b2f]"><Building2 className="h-3.5 w-3.5" /> {L.pres_badge}</span>
            <h2 className="mt-4 text-3xl leading-snug">{L.pres_t}</h2>
            <p className="mt-4 text-[15px] leading-7 text-[#78716c]" dangerouslySetInnerHTML={{ __html: L.pres_txt }} />
            <div className="mt-7 grid grid-cols-2 gap-6">
              <div><h4 className="flex items-center gap-2 font-sans text-sm font-semibold"><Factory className="h-4 w-4 text-[#9a6b2f]" /> {L.vision1_t}</h4><p className="mt-2 text-[13px] leading-6 text-[#78716c]">{L.vision1_d}</p></div>
              <div><h4 className="flex items-center gap-2 font-sans text-sm font-semibold"><GraduationCap className="h-4 w-4 text-[#9a6b2f]" /> {L.vision2_t}</h4><p className="mt-2 text-[13px] leading-6 text-[#78716c]">{L.vision2_d}</p></div>
            </div>
            <p className="mt-7 border-t border-[#e2dac9] pt-4 text-[13px] text-[#78716c]" dangerouslySetInnerHTML={{ __html: L.pres_sig }} />
          </Reveal>
        </div>
      </section>

      {/* Services */}
      <section className="border-y border-[#e2dac9] bg-[#fffdf9] py-20">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal><h2 className="text-center text-3xl">{L.serv_t}</h2></Reveal>
          <div className="mt-11 grid gap-5 md:grid-cols-3">
            {L.services.map((s, i) => {
              const Icone = SERVICES_ICONES[i];
              return (
                <Reveal key={s.t}>
                  <div className="h-full rounded-xl border border-[#e2dac9] bg-[#f7f4ec] p-6 transition hover:-translate-y-1.5 hover:border-[#9a6b2f] hover:shadow-xl">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#f3e9d8] text-[#9a6b2f]"><Icone className="h-5 w-5" /></span>
                    <h3 className="mt-4 text-[17px]">{s.t}</h3>
                    <p className="mt-2 text-[13px] leading-6 text-[#78716c]">{s.d}</p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* Histoire */}
      <section className="py-24">
        <div className="mx-auto grid max-w-6xl gap-14 px-6 md:grid-cols-[.8fr_1.2fr]">
          <Reveal>
            <h2 className="text-3xl leading-snug">{L.hist_t}</h2>
            <p className="mt-4 text-sm leading-7 text-[#78716c]">{L.hist_sub}</p>
          </Reveal>
          <Reveal>
            <div className="ml-2 border-l-2 border-[#e2dac9] pl-7">
              {L.timeline.map((item) => (
                <div key={item.annee} className="relative pb-9">
                  <span className="absolute -left-[37px] top-1 h-3.5 w-3.5 rounded-full border-[3px] border-[#9a6b2f] bg-[#f7f4ec]" />
                  <span className="font-mono text-[13px] font-extrabold text-[#9a6b2f]">{item.annee}</span>
                  <h3 className="mt-1 text-[17px]">{item.t}</h3>
                  <p className="mt-1.5 text-[13px] leading-6 text-[#78716c]">{item.d}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* Équipe */}
      <section className="pb-24">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal><h2 className="text-center text-3xl">{L.equipe_t}</h2></Reveal>
          <Reveal>
            <div className="mx-auto mt-11 max-w-md rounded-2xl border border-[#e2dac9] bg-[#fffdf9] p-9 text-center shadow-xl">
              <span className="font-heading mx-auto flex h-[84px] w-[84px] items-center justify-center rounded-full bg-gradient-to-br from-[#9a6b2f] to-[#1c1917] text-2xl font-extrabold text-[#f7f4ec]">EA</span>
              <h3 className="mt-4 text-[17px] tracking-wide">{L.dev_nom}</h3>
              <p className="mt-1.5 text-[13px] font-bold text-[#9a6b2f]">{L.dev_role}</p>
              <p className="mt-3.5 text-[13px] italic leading-6 text-[#78716c]">{L.dev_citation}</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {STACK.map((s) => <span key={s} className="rounded-full bg-[#f3e9d8] px-3 py-1.5 font-mono text-[11px] font-bold text-[#9a6b2f]">{s}</span>)}
              </div>
            </div>
          </Reveal>
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
            <Link to="/landing" className="mb-2 block text-[13px] hover:text-[#f7f4ec]">{L.nav_accueil}</Link>
            <Link to="/landing" className="mb-2 block text-[13px] hover:text-[#f7f4ec]">{L.nav_fonctions}</Link>
            <Link to="/landing" className="mb-2 block text-[13px] hover:text-[#f7f4ec]">{L.nav_pipeline}</Link>
            <Link to="/landing" className="block text-[13px] hover:text-[#f7f4ec]">{L.nav_modules}</Link>
          </div>
          <div>
            <p className="mb-3.5 text-sm font-semibold text-[#f7f4ec]">{L.f_support}</p>
            <p className="mb-2 text-[13px]">emma@dta-alliance.com</p>
            <p className="text-[13px]">{L.nav_faq}</p>
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