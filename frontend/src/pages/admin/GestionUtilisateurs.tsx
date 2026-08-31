import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { listerUtilisateurs, creerUtilisateur, desactiverUtilisateur, modifierRoles, listerDepartements, type DepartementType } from '../../api/admin';
import type { Utilisateur } from '../../api/auth';
import { useTranslation } from '../../i18n/useTranslation';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '../../components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../../components/ui/collapsible';
import { toast } from 'sonner';
import TableFooter from '../../components/TableFooter';
import { ArrowLeft, UserPlus, Shield, ShieldOff, Ban, CircleAlert, Monitor, ChevronDown } from 'lucide-react';

export default function GestionUtilisateurs() {
  const navigate = useNavigate();
  const { t, langue } = useTranslation();
  const [utilisateurs, setUtilisateurs] = useState<Utilisateur[]>([]);
  const [chargement, setChargement] = useState(true);
  const [dialogOuvert, setDialogOuvert] = useState(false);
  const [nouveauUsername, setNouveauUsername] = useState('');
  const [nouveauEmail, setNouveauEmail] = useState('');
  const [nouveauDepartementId, setNouveauDepartementId] = useState('');
  const [messageSucces, setMessageSucces] = useState('');

  // 🆕 États pour le dialog de rétrogradation
  const [retrogradeOuvert, setRetrogradeOuvert] = useState(false);
  const [userARetrograder, setUserARetrograder] = useState<Utilisateur | null>(null);
  const [deptRetrograde, setDeptRetrograde] = useState('');

  const [erreur, setErreur] = useState('');
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [departements, setDepartements] = useState<DepartementType[]>([]);
  const [pageActifs, setPageActifs] = useState(1); const [rowsActifs, setRowsActifs] = useState(10);
  const [pageInactifs, setPageInactifs] = useState(1); const [rowsInactifs, setRowsInactifs] = useState(10);
  const [pageTous, setPageTous] = useState(1); const [rowsTous, setRowsTous] = useState(10);

  async function charger() {
    try {
      setErreur('');
      const data = await listerUtilisateurs();
      setUtilisateurs(data);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: unknown; status?: number }; message?: string };
      const data = axiosErr?.response?.data as Record<string, unknown> | undefined;
      const msg = typeof data?.detail === 'string' ? data.detail : t.commun.erreur;
      setErreur(msg);
      console.error('Erreur chargement utilisateurs:', msg);
    } finally {
      setChargement(false);
    }
  }

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    charger();
    listerDepartements().then(setDepartements).catch(() => {});
    intervalRef.current = setInterval(() => {
      charger();
    }, 30000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  async function handleCreer(e: React.FormEvent) {
    e.preventDefault();
    if (!nouveauDepartementId) {
      toast.error(t.admin.utilisateurs_dept_obligatoire);
      return;
    }
    try {
      const resultat = await creerUtilisateur({
        username: nouveauUsername,
        email: nouveauEmail,
        departement_id: Number(nouveauDepartementId),
      });
      setMessageSucces(resultat.message || t.admin.compte_cree);
      toast.success(t.admin.compte_cree);
      setNouveauUsername('');
      setNouveauEmail('');
      setNouveauDepartementId('');
      charger();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: unknown; status?: number }; message?: string };
      const data = axiosErr?.response?.data as Record<string, unknown> | undefined;
      const msg = typeof data?.erreur === 'string' ? data.erreur
        : typeof data?.detail === 'string' ? data.detail
        : typeof data === 'string' ? data
        : axiosErr?.message || t.commun.erreur;
      console.error('Erreur création utilisateur:', axiosErr?.response?.status, data);
      toast.error(msg);
    }
  }

  function fermerDialogue() {
    setDialogOuvert(false);
    setMessageSucces('');
  }

  async function handleDesactiver(id: number) {
    try {
      await desactiverUtilisateur(id);
      toast.success(t.admin.statut_maj);
      charger();
    } catch {
      toast.error(t.commun.erreur);
    }
  }

  // 🆕 Nouvelle logique : promotion directe, rétrogradation avec choix de département
  async function handleRole(id: number, estAdmin: boolean) {
    // Si on PROMEUT (estAdmin=true) : pas besoin de département, on envoie directement
    if (estAdmin) {
      try {
        await modifierRoles(id, { est_admin: true });
        toast.success(t.admin.role_maj);
        charger();
      } catch {
        toast.error(t.commun.erreur);
      }
      return;
    }

    // Si on RÉTROGRADE : ouvrir le dialog pour choisir un département
    const user = utilisateurs.find((u) => u.id === id);
    if (user) {
      setUserARetrograder(user);
      setDeptRetrograde('');
      setRetrogradeOuvert(true);
    }
  }

  async function confirmerRetrogradation() {
    if (!userARetrograder) return;
    if (!deptRetrograde) {
      toast.error(t.admin.utilisateurs_dept_obligatoire);
      return;
    }
    try {
      await modifierRoles(userARetrograder.id, {
        est_admin: false,
        departement_id: Number(deptRetrograde),
      });
      toast.success(t.admin.role_maj);
      setRetrogradeOuvert(false);
      setUserARetrograder(null);
      setDeptRetrograde('');
      charger();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { erreur?: string } } };
      toast.error(axiosErr?.response?.data?.erreur || t.commun.erreur);
    }
  }

  if (chargement) return <p className="p-8">{t.commun.charger}</p>;

  const actifs = utilisateurs.filter((u) => u.est_actif !== false);
  const inactifs = utilisateurs.filter((u) => u.est_actif === false);

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}><ArrowLeft className="h-5 w-5" /></Button>
          <h1 className="text-2xl font-bold">{t.admin.gestion_utilisateurs}</h1>
        </div>
        <Dialog open={dialogOuvert} onOpenChange={(o) => { setDialogOuvert(o); if (!o) setMessageSucces(''); }}>
          <DialogTrigger asChild>
            <Button><UserPlus className="h-4 w-4 mr-2" /> {t.admin.creer_compte}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t.admin.creer_compte}</DialogTitle></DialogHeader>
            {!messageSucces ? (
              <form onSubmit={handleCreer} className="space-y-4">
                <div className="space-y-2">
                  <Label>{t.admin.nom_utilisateur}</Label>
                  <Input value={nouveauUsername} onChange={(e) => setNouveauUsername(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>{t.admin.email}</Label>
                  <Input type="email" value={nouveauEmail} onChange={(e) => setNouveauEmail(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>{t.admin.departement_nom} <span className="text-destructive">*</span></Label>
                  <Select value={nouveauDepartementId} onValueChange={setNouveauDepartementId} required>
                    <SelectTrigger><SelectValue placeholder={t.admin.utilisateurs_selectionner_dept} /></SelectTrigger>
                    <SelectContent>
                      {departements.map((d) => (
                        <SelectItem key={d.id} value={String(d.id)}>{langue === 'en' ? (d.nom_en || d.nom) : d.nom}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-muted-foreground">{t.admin.utilisateurs_mdp_genere_info}</p>
                <Button type="submit" className="w-full">{t.admin.creer_compte}</Button>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="rounded-md bg-green-50 dark:bg-green-950 p-4">
                  <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">{t.admin.compte_cree}</p>
                  <p className="text-xs text-muted-foreground">{messageSucces}</p>
                </div>
                <Button className="w-full" onClick={fermerDialogue}>{t.commun.fermer}</Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* 🆕 Dialog de rétrogradation */}
      <Dialog open={retrogradeOuvert} onOpenChange={(o) => { setRetrogradeOuvert(o); if (!o) setUserARetrograder(null); }}>
        <DialogContent>
          <DialogHeader>
  <DialogTitle>
    {langue === 'en' ? 'Demote to staff' : 'Rétrograder en utilisateur'}
  </DialogTitle>
  <DialogDescription>
    {langue === 'en'
      ? `Choose a department for ${userARetrograder?.username}.`
      : `Choisissez un département pour ${userARetrograder?.username}.`}
  </DialogDescription>
</DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>{t.admin.departement_nom} <span className="text-destructive">*</span></Label>
              <Select value={deptRetrograde} onValueChange={setDeptRetrograde}>
                <SelectTrigger><SelectValue placeholder={t.admin.utilisateurs_selectionner_dept} /></SelectTrigger>
                <SelectContent>
                  {departements.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>{langue === 'en' ? (d.nom_en || d.nom) : d.nom}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRetrogradeOuvert(false)}>
  {langue === 'en' ? 'Cancel' : 'Annuler'}
</Button>
<Button onClick={confirmerRetrogradation}>
  {langue === 'en' ? 'Confirm' : 'Confirmer'}
</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {erreur && (
        <div className="rounded-md bg-destructive/10 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-destructive">
            <CircleAlert className="h-4 w-4" />
            <span>{erreur}</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => { setChargement(true); charger(); }}>{t.admin.utilisateurs_reessayer}</Button>
        </div>
      )}

      <Card>
        <CardHeader><CardTitle>{t.admin.utilisateurs_actifs_titre} ({actifs.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.admin.nom_utilisateur}</TableHead>
                <TableHead>{t.admin.email}</TableHead>
                <TableHead>{t.admin.role}</TableHead>
                <TableHead className="hidden md:table-cell">{t.admin.departement_nom}</TableHead>
                <TableHead>{t.admin.utilisateurs_appareils}</TableHead>
                <TableHead className="text-right">{t.admin.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {actifs.slice((pageActifs - 1) * rowsActifs, pageActifs * rowsActifs).map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">
                    <button type="button" onClick={() => navigate(`/admin/utilisateurs/${u.id}`)} className="text-left hover:text-primary hover:underline underline-offset-4" title={t.admin.voir_profil}>
                      {u.username}
                    </button>
                  </TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>
                    {u.est_admin ? <Badge variant="default">{t.admin.admin}</Badge> : <Badge variant="secondary">{t.admin.personnel}</Badge>}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                    {u.departement?.nom ?? '—'}
                  </TableCell>
                  <TableCell>
                    {u.appareils && u.appareils.length > 0 ? (
                      <Collapsible open={!!expanded[u.id]} onOpenChange={(o: boolean) => setExpanded((prev) => ({ ...prev, [u.id]: o }))}>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" className="gap-1 text-xs">
                            <Monitor className="h-3 w-3" />{u.appareils.length} <ChevronDown className={`h-3 w-3 transition-transform ${expanded[u.id] ? 'rotate-180' : ''}`} />
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="space-y-1 mt-1">
                          {u.appareils.map((a, i) => (
                            <div key={i} className="text-xs text-muted-foreground border-l-2 pl-2 ml-1">
                              <p className="truncate max-w-[200px]" title={a.user_agent}>{a.user_agent}</p>
                              <p className="text-[10px]">IP: {a.ip_address} &middot; {new Date(a.date_connexion).toLocaleDateString()}</p>
                            </div>
                          ))}
                        </CollapsibleContent>
                      </Collapsible>
                    ) : (
                      <span className="text-xs text-muted-foreground">{t.admin.utilisateurs_aucune_connexion}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => handleRole(u.id, !u.est_admin)} title={u.est_admin ? t.admin.retrogader : t.admin.promouvoir}>
                        {u.est_admin ? <ShieldOff className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDesactiver(u.id)} title={t.admin.desactiver}>
                        <Ban className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {actifs.length > 0 && (
            <TableFooter
              currentPage={pageActifs}
              totalPages={Math.ceil(actifs.length / rowsActifs)}
              rowsPerPage={rowsActifs}
              totalRows={actifs.length}
              onPageChange={setPageActifs}
              onRowsPerPageChange={(rows) => { setRowsActifs(rows); setPageActifs(1); }}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t.admin.utilisateurs_inactifs_titre} ({inactifs.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          {inactifs.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground text-center">{t.admin.utilisateurs_aucun_inactif}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.admin.nom_utilisateur}</TableHead>
                  <TableHead>{t.admin.email}</TableHead>
                  <TableHead>{t.admin.role}</TableHead>
                  <TableHead className="hidden md:table-cell">{t.admin.departement_nom}</TableHead>
                  <TableHead className="text-right">{t.admin.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inactifs.slice((pageInactifs - 1) * rowsInactifs, pageInactifs * rowsInactifs).map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">
                      <button type="button" onClick={() => navigate(`/admin/utilisateurs/${u.id}`)} className="text-left hover:text-primary hover:underline underline-offset-4" title={t.admin.voir_profil}>
                        {u.username}
                      </button>
                    </TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>
                      {u.est_admin ? <Badge variant="default">{t.admin.admin}</Badge> : <Badge variant="secondary">{t.admin.personnel}</Badge>}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                      {u.departement?.nom ?? '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleDesactiver(u.id)} title={t.admin.utilisateurs_reaactiver}>
                        <Ban className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {inactifs.length > 0 && (
            <TableFooter
              currentPage={pageInactifs}
              totalPages={Math.ceil(inactifs.length / rowsInactifs)}
              rowsPerPage={rowsInactifs}
              totalRows={inactifs.length}
              onPageChange={setPageInactifs}
              onRowsPerPageChange={(rows) => { setRowsInactifs(rows); setPageInactifs(1); }}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t.admin.utilisateurs_tous_titre} ({utilisateurs.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.admin.nom_utilisateur}</TableHead>
                <TableHead>{t.admin.email}</TableHead>
                <TableHead>{t.admin.role}</TableHead>
                <TableHead className="hidden md:table-cell">{t.admin.departement_nom}</TableHead>
                <TableHead>{t.admin.statut}</TableHead>
                <TableHead className="text-right">{t.admin.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {utilisateurs.slice((pageTous - 1) * rowsTous, pageTous * rowsTous).map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">
                    <button type="button" onClick={() => navigate(`/admin/utilisateurs/${u.id}`)} className="text-left hover:text-primary hover:underline underline-offset-4" title={t.admin.voir_profil}>
                      {u.username}
                    </button>
                  </TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>
                    {u.est_admin ? <Badge variant="default">{t.admin.admin}</Badge> : <Badge variant="secondary">{t.admin.personnel}</Badge>}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                    {u.departement?.nom ?? '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => handleRole(u.id, !u.est_admin)} title={u.est_admin ? t.admin.retrogader : t.admin.promouvoir}>
                        {u.est_admin ? <ShieldOff className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDesactiver(u.id)} title={t.admin.desactiver}>
                        <Ban className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {utilisateurs.length > 0 && (
            <TableFooter
              currentPage={pageTous}
              totalPages={Math.ceil(utilisateurs.length / rowsTous)}
              rowsPerPage={rowsTous}
              totalRows={utilisateurs.length}
              onPageChange={setPageTous}
              onRowsPerPageChange={(rows) => { setRowsTous(rows); setPageTous(1); }}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}