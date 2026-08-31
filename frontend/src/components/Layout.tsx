import { useState, useEffect, type ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { listerNotifications, type Notification } from '../api/admin';
import { useTranslation } from '../i18n/useTranslation';
import { useTheme } from './ThemeProvider';
import { Button } from './ui/button';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Separator } from './ui/separator';
import { Badge } from './ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { LayoutDashboard, FileText, Image, Video, User, LogOut, Users, Settings, Bell, ScrollText, Heart, Moon, Sun, Languages, Building2, ShieldCheck, Archive } from 'lucide-react';
interface LayoutProps { children: ReactNode; }

function NavBtn({ href, icon: Icon, label }: { href: string; icon: React.ElementType; label: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [hpath, hquery] = href.split('?');
  const actif = location.pathname === hpath || (hquery && location.search.includes(hquery));
  return (
    <Button variant={actif ? 'secondary' : 'ghost'} className="w-full justify-start gap-3" onClick={() => navigate(href)}>
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{label}</span>
    </Button>
  );
}

export default function Layout({ children }: LayoutProps) {
  const { utilisateur, seDeconnecter } = useAuth();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { t, basculerLangue, langue } = useTranslation();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => { listerNotifications().then(setNotifications).catch(() => {}); }, []);

  const nonLu = notifications.filter((n) => !n.lu).length;
  const initiales = utilisateur?.username?.slice(0, 2).toUpperCase() ?? '?';

  function gererDeconnexion() { seDeconnecter(); navigate('/connexion'); }

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 border-r bg-card hidden md:flex flex-col">
        <div className="p-6">
          <h1 className="text-xl font-bold">SAE</h1>
          <p className="text-xs text-muted-foreground">{t.auth.sae}</p>
        </div>
        <Separator />
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <p className="text-xs font-medium text-muted-foreground px-3 mb-2">{t.nav.general}</p>
          <NavBtn href={utilisateur?.est_admin ? '/admin' : '/dashboard'} icon={LayoutDashboard} label={t.nav.tableau_de_bord} />
          <Separator className="my-3" />
          <p className="text-xs font-medium text-muted-foreground px-3 mb-2">{t.nav.documents_categorie}</p>
          <NavBtn href="/documents?groupe=documents" icon={FileText} label={t.nav.documents} />
          <NavBtn href="/documents?groupe=images" icon={Image} label={t.nav.images} />
          <NavBtn href="/documents?groupe=medias" icon={Video} label={t.nav.medias} />
          <Separator className="my-3" />
          <p className="text-xs font-medium text-muted-foreground px-3 mb-2">{t.nav.favoris}</p>
          <NavBtn href="/documents?favoris=true" icon={Heart} label={t.nav.mes_favoris} />
          <Separator className="my-3" />
          <NavBtn href="/profil" icon={User} label={t.nav.mon_profil} />
          {utilisateur?.est_admin && (
            <>
              <Separator className="my-3" />
              <p className="text-xs font-medium text-muted-foreground px-3 mb-2">{t.nav.administration}</p>
              <NavBtn href="/admin/logs" icon={ScrollText} label={t.nav.logs} />
              <NavBtn href="/admin/utilisateurs" icon={Users} label={t.nav.utilisateurs} />
<NavBtn href="/admin/departements" icon={Building2} label={t.nav.departements} />
<NavBtn href="/admin/permissions" icon={ShieldCheck} label={t.nav.permissions} />
              <NavBtn href="/admin/configuration" icon={Settings} label={t.nav.configuration} />
              <NavBtn href="/documents?archives=true" icon={Archive} label={t.nav.archives} />
            </>
          )}
        </nav>
        <div className="p-3 flex items-center gap-3">
          <Avatar className="h-10 w-10 shrink-0">
            <AvatarImage src={utilisateur?.photo ?? undefined} />
            <AvatarFallback className="text-sm">{initiales}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{utilisateur?.username}</p>
            <p className="text-xs text-muted-foreground truncate">{utilisateur?.email}</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                <LogOut className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => navigate('/profil')}><User className="h-4 w-4 mr-2" />{t.nav.mon_profil}</DropdownMenuItem>
              <DropdownMenuItem onClick={gererDeconnexion}><LogOut className="h-4 w-4 mr-2" />{t.nav.deconnexion}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>
      <div className="flex-1 flex flex-col">
        <header className="h-14 border-b bg-background flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
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
                  {notifications.length === 0 ? <p className="p-4 text-sm text-muted-foreground text-center">{t.nav.notifications}</p> : notifications.slice(0, 5).map((n) => (
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
        <main className="flex-1 bg-background">{children}</main>
      </div>
    </div>
  );
}
