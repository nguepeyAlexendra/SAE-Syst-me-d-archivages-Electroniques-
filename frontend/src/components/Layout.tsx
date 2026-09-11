import { useState, useEffect, type ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { listerNotifications, type Notification } from '../api/admin';
import { useTranslation } from '../i18n/useTranslation';
import { useTheme } from './ThemeProvider';
import { usePreferences } from '../hooks/usePreferences';
import { Button } from './ui/button';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Separator } from './ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { LayoutDashboard, FileText, Image, Video, User, LogOut, Users, Settings, Bell, ScrollText, Heart, Moon, Sun, Languages, Building2, ShieldCheck, Archive, Menu, HelpCircle } from 'lucide-react';
import PreferencesSheet from './PreferencesSheet';
import { AIDropdownTrigger } from './ui/AIIcon';

interface LayoutProps { children: ReactNode; }

function NavBtn({ href, icon: Icon, label, compact }: { href: string; icon: React.ElementType; label: string; compact?: boolean }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [hpath, hquery] = href.split('?');
  const actif = location.pathname === hpath || (hquery && location.search.includes(hquery));
  return (
    <Button
      variant="ghost"
      title={label}
      className={`w-full ${compact ? 'justify-center px-0' : 'justify-start gap-3'} ${
        actif ? 'bg-white/20 text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'
      }`}
      onClick={() => navigate(href)}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!compact && <span className="truncate">{label}</span>}
    </Button>
  );
}

export default function Layout({ children }: LayoutProps) {
  const { utilisateur, seDeconnecter } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const { t, basculerLangue, langue } = useTranslation();
  const { preferences } = usePreferences();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [sidebarLarge, setSidebarLarge] = useState(() => localStorage.getItem('sae_sidebar') !== 'compact');
  const [mobileOuvert, setMobileOuvert] = useState(false);

   useEffect(() => {
    listerNotifications()
      .then((data: any) => {
        // ✅ Sécurité : extrait le tableau 'results' si l'API renvoie un objet paginé, 
        // sinon utilise les données directement si c'est déjà un tableau.
        const liste = Array.isArray(data) ? data : (data.results || []);
        setNotifications(liste);
      })
      .catch(() => {});
  }, []);
  useEffect(() => { window.scrollTo({ top: 0, left: 0 }); setMobileOuvert(false); }, [location.pathname, location.search]);

  function basculerSidebar() {
    if (window.matchMedia('(min-width: 768px)').matches) {
      setSidebarLarge((v) => {
        localStorage.setItem('sae_sidebar', v ? 'compact' : 'large');
        return !v;
      });
    } else {
      setMobileOuvert((v) => !v);
    }
  }

 const nonLu = Array.isArray(notifications) ? notifications.filter((n) => !n.lu).length : 0;
  const initiales = utilisateur?.username?.slice(0, 2).toUpperCase() ?? '?';

  function gererDeconnexion() { seDeconnecter(); navigate('/connexion'); }

  const sidebarBackground =
    preferences.sidebarTheme === 'dark'
      ? 'hsl(240 12% 8%)'
      : 'color-mix(in srgb, var(--primary) 70%, black)';

  return (
    // ✅ CORRECTION 1 : h-screen et overflow-hidden pour empêcher le scroll global de la page
    <div className="flex h-screen overflow-hidden">
      
      {mobileOuvert && (
        <div className="fixed inset-0 z-50 bg-black/50 md:hidden" onClick={() => setMobileOuvert(false)} />
      )}

      {/* ✅ CORRECTION 2 : Sidebar en flex standard, hauteur fixe, sans 'fixed' qui cassait le layout */}
      <aside
        className={`${mobileOuvert ? 'fixed inset-y-0 left-0 z-50 flex w-64' : 'hidden'} md:flex ${sidebarLarge ? 'md:w-64' : 'md:w-16'} shrink-0 border-r border-white/10 flex-col transition-all duration-300 h-screen`}
        style={{ background: sidebarBackground, color: '#ffffff' }}
      >
        <div className={sidebarLarge ? 'p-6' : 'p-3 flex justify-center'}>
          <h1 className="text-xl font-bold">SAE</h1>
          {sidebarLarge && <p className="text-xs text-white/60">{t.auth.sae}</p>}
        </div>
        
        <Separator className="bg-white/20" />
        
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {sidebarLarge && <p className="text-xs font-medium text-white/60 px-3 mb-2">{t.nav.general}</p>}
          <NavBtn compact={!sidebarLarge} href={utilisateur?.est_admin ? '/admin' : '/dashboard'} icon={LayoutDashboard} label={t.nav.tableau_de_bord} />
          <Separator className="my-3 bg-white/20" />
          {sidebarLarge && <p className="text-xs font-medium text-white/60 px-3 mb-2">{t.nav.documents_categorie}</p>}
          <NavBtn compact={!sidebarLarge} href="/documents?groupe=documents" icon={FileText} label={t.nav.documents} />
          <NavBtn compact={!sidebarLarge} href="/documents?groupe=images" icon={Image} label={t.nav.images} />
          <NavBtn compact={!sidebarLarge} href="/documents?groupe=medias" icon={Video} label={t.nav.medias} />
          <Separator className="my-3 bg-white/20" />
          {sidebarLarge && <p className="text-xs font-medium text-white/60 px-3 mb-2">{t.nav.favoris}</p>}
          <NavBtn compact={!sidebarLarge} href="/documents?favoris=true" icon={Heart} label={t.nav.mes_favoris} />
          <Separator className="my-3 bg-white/20" />
          <NavBtn compact={!sidebarLarge} href="/profil" icon={User} label={t.nav.mon_profil} />
          
          {utilisateur?.est_admin && (
            <>
              <Separator className="my-3 bg-white/20" />
              {sidebarLarge && <p className="text-xs font-medium text-white/60 px-3 mb-2">{t.nav.administration}</p>}
              <NavBtn compact={!sidebarLarge} href="/admin/logs" icon={ScrollText} label={t.nav.logs} />
              <NavBtn compact={!sidebarLarge} href="/admin/utilisateurs" icon={Users} label={t.nav.utilisateurs} />
              <NavBtn compact={!sidebarLarge} href="/admin/departements" icon={Building2} label={t.nav.departements} />
              <NavBtn compact={!sidebarLarge} href="/admin/permissions" icon={ShieldCheck} label={t.nav.permissions} />
              <NavBtn compact={!sidebarLarge} href="/admin/configuration" icon={Settings} label={t.nav.configuration} />
              <NavBtn compact={!sidebarLarge} href="/documents?archives=true" icon={Archive} label={t.nav.archives} />
            </>
          )}

<NavBtn compact={!sidebarLarge} href="/notifications" icon={Bell} label="Notifications" />
<Separator className="my-3 bg-white/20" />
<NavBtn compact={!sidebarLarge} href="/aide" icon={HelpCircle} label="Centre d'aide" />
          <Separator className="my-3 bg-white/20" />
          <NavBtn compact={!sidebarLarge} href="/aide" icon={HelpCircle} label="Centre d'aide" />
        </nav>

        <Separator className="bg-white/20" />
        <div className="p-2">
          <PreferencesSheet compact={!sidebarLarge} />
        </div>

        <div className={`border-t border-white/20 ${sidebarLarge ? 'p-3 flex items-center gap-3' : 'p-2 flex justify-center'}`}>
          <Avatar className="h-10 w-10 shrink-0">
            <AvatarImage src={utilisateur?.photo ?? undefined} />
            <AvatarFallback className="text-sm">{initiales}</AvatarFallback>
          </Avatar>
          {sidebarLarge && (
            <>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{utilisateur?.username}</p>
                <p className="text-xs text-white/60 truncate">{utilisateur?.email}</p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-white hover:bg-white/10">
                    <LogOut className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => navigate('/profil')}><User className="h-4 w-4 mr-2" />{t.nav.mon_profil}</DropdownMenuItem>
                  <DropdownMenuItem onClick={gererDeconnexion}><LogOut className="h-4 w-4 mr-2" />{t.nav.deconnexion}</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </aside>

      {/* ✅ CORRECTION 3 : Le conteneur droit prend toute la hauteur, mais seul le <main> scrolle */}
      <div className="flex-1 flex flex-col min-w-0 h-screen">
        <header className="h-14 border-b bg-background flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={basculerSidebar} title={sidebarLarge ? 'Replier' : 'Déplier'}>
              <Menu className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-bold md:hidden">SAE</h1>
          </div>
          <div className="flex items-center gap-1">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="h-5 w-5" />
                  {nonLu > 0 && <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">{nonLu}</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-0">
                <div className="p-3 font-medium border-b">{t.nav.notifications}</div>
                <div className="max-h-64 overflow-y-auto">
                  {notifications.length === 0 ? <p className="p-4 text-sm text-muted-foreground text-center">Aucune notification</p> : notifications.slice(0, 5).map((n) => (
                    <div key={n.id} className={`p-3 border-b last:border-b-0 text-sm ${!n.lu ? 'bg-primary/5' : ''}`}>
                      <p className="font-medium">{n.titre}</p>
                      <p className="text-muted-foreground text-xs">{n.message}</p>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={basculerLangue} title={langue === 'fr' ? 'English' : 'Français'}>
              <Languages className="h-5 w-5" />
            </Button>
          </div>
        </header>
        
        {/* ✅ CORRECTION 4 : overflow-y-auto ici signifie que SEUL ce bloc défilera */}
        <main className="flex-1 bg-background overflow-y-auto overflow-x-hidden p-6">
          {children}
        </main>
      </div>

      <div className="fixed bottom-6 right-6 z-50">
        <AIDropdownTrigger />
      </div>
    </div>
  );
}