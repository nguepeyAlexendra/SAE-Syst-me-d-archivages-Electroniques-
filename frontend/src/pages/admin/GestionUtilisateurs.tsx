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
import { toast } from 'sonner';
import TableFooter from '../../components/TableFooter';
import { ArrowLeft, UserPlus, Shield, ShieldOff, Ban, CircleAlert } from 'lucide-react';

interface UtilisateurEtendu extends Utilisateur {
  nom_complet?: string;
  est_superuser?: boolean;
}

export default function GestionUtilisateurs() {
  const navigate = useNavigate();
  const { t, langue } = useTranslation();
  const fr = langue === 'fr';

  const [utilisateurs, setUtilisateurs] = useState<UtilisateurEtendu[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');
  const [departements, setDepartements] = useState<DepartementType[]>([]);

  // Formulaire de création
  const [dialogOuvert, setDialogOuvert] = useState(false);
  const [nouveauNom, setNouveauNom] = useState('');
  const [nouveauEmail, setNouveauEmail] = useState('');
  const [nouveauDepartementId, setNouveauDepartementId] = useState('');
  const [messageSucces, setMessageSucces] = useState('');

  // Dialog de rétrogradation
  const [retrogradeOuvert, setRetrogradeOuvert] = useState(false);
  const [userARetrograder, setUserARetrograder] = useState<UtilisateurEtendu | null>(null);
  const [deptRetrograde, setDeptRetrograde] = useState('');

  // Pagination des 3 tableaux
  const [pageActifs, setPageActifs] = useState(1); const [rowsActifs, setRowsActifs] = useState(10);
  const [pageInactifs, setPageInactifs] = useState(1); const [rowsInactifs, setRowsInactifs] = useState(10);
  const [pageTous, setPageTous] = useState(1); const [rowsTous, setRowsTous] = useState(10);

  async function charger() {
    try {
      setErreur('');
      const data = await listerUtilisateurs();
      setUtilisateurs(data);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: unknown } };
      const data = axiosErr?.response?.data as Record<string, unknown> | undefined;
      setErreur(typeof data?.detail === 'string' ? data.detail : t.commun.erreur);
    } finally {
      setChargement(false);
    }
  }

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    charger();
    listerDepartements().then(setDepartements).catch(() => {});
    intervalRef.current = setInterval(() => { charger(); }, 30000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  async function handleCreer(e: React.FormEvent) {
    e.preventDefault();
    if (!nouveauDepartementId) {
      toast.error(t.admin.utilisateurs_dept_obligatoire);
      return;
    }
    try {
      // ✅ CORRECTION CRITIQUE : envoyer "nom" au lieu de "username"
      const resultat = await creerUtilisateur({
        nom: nouveauNom,  // ← CHANGÉ ICI (était username)
        email: nouveauEmail,
        departement_id: Number(nouveauDepartementId),
      });
      setMessageSucces(resultat.message || t.admin.compte_cree);
      toast.success(t.admin.compte_cree);
      setNouveauNom('');
      setNouveauEmail('');
      setNouveauDepartementId('');
      charger();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: unknown } };
      const data = axiosErr?.response?.data as Record<string, unknown> | undefined;
      const msg = typeof data?.erreur === 'string' ? data.erreur
        : typeof data?.detail === 'string' ? data.detail
        : t.commun.erreur;
      toast.error(msg);
    }
  }

  async function handleDesactiver(id: number) {
    try {
      await desactiverUtilisateur(id);
      toast.success(t.admin.statut_maj);
      charger();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: unknown } };
      const data = axiosErr?.response?.data as Record<string, unknown> | undefined;
      toast.error(typeof data?.erreur === 'string' ? data.erreur : t.commun.erreur);
    }
  }

  async function handleRole(id: number, estAdmin: boolean) {
    const user = utilisateurs.find((u) => u.id === id);
    if (!user) return;

    if (estAdmin) {
      try {
        await modifierRoles(id, { est_admin: true });
        toast.success(t.admin.role_maj);
        charger();
      } catch (err: unknown) {
        const axiosErr = err as { response?: { data?: unknown } };
        const data = axiosErr?.response?.data as Record<string, unknown> | undefined;
        toast.error(typeof data?.erreur === 'string' ? data.erreur : t.commun.erreur);
      }
      return;
    }

    setUserARetrograder(user);
    setDeptRetrograde('');
    setRetrogradeOuvert(true);
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
      const axiosErr = err as { response?: { data?: unknown } };
      const data = axiosErr?.response?.data as Record<string, unknown> | undefined;
      toast.error(typeof data?.erreur === 'string' ? data.erreur : t.commun.erreur);
    }
  }

  if (chargement) return <p className="p-8">{t.commun.charger}</p>;

  const actifs = utilisateurs.filter((u) => u.est_actif !== false);
  const inactifs = utilisateurs.filter((u) => u.est_actif === false);

  const roleDesactive = (u: UtilisateurEtendu) => u.est_actif === false;

  const EnTetesColonnes = () => (
    <TableRow>
      <TableHead>{fr ? 'Nom' : 'Name'}</TableHead>
      <TableHead>{t.admin.email}</TableHead>
      <TableHead>{t.admin.role}</TableHead>
      <TableHead className="hidden md:table-cell">{fr ? 'Département' : 'Department'}</TableHead>
      <TableHead>{fr ? 'Statut' : 'Status'}</TableHead>
      <TableHead className="text-right">{t.admin.actions}</TableHead>
    </TableRow>
  );

  const CellulesCommunes = ({ u }: { u: UtilisateurEtendu }) => (
    <>
      <TableCell className="font-medium">
        <button type="button" onClick={() => navigate(`/admin/utilisateurs/${u.id}`)}
          className="text-left hover:text-primary hover:underline underline-offset-4" title={t.admin.voir_profil}>
          {u.nom_complet || u.username}
        </button>
      </TableCell>
      <TableCell>{u.email}</TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          {u.est_admin ? <Badge variant="default">{t.admin.admin}</Badge> : <Badge variant="secondary">{t.admin.personnel}</Badge>}
          {u.est_superuser && <Badge variant="outline" className="text-[10px]">Super</Badge>}
        </div>
      </TableCell>
      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
        {u.departement?.nom ?? '—'}
      </TableCell>
      <TableCell>
        {u.est_actif !== false
          ? <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950/50 dark:text-green-400">{fr ? 'Actif' : 'Active'}</Badge>
          : <Badge variant="destructive" className="text-[10px]">{fr ? 'Inactif' : 'Inactive'}</Badge>}
      </TableCell>
    </>
  );

  const CelluleActions = ({ u }: { u: UtilisateurEtendu }) => (
    <TableCell className="text-right">
      <div className="flex justify-end gap-1">
        {!u.est_admin && (
          <Button variant="ghost" size="sm" onClick={() => handleRole(u.id, true)} disabled={roleDesactive(u)}
            title={roleDesactive(u) ? (fr ? "Réactivez d'abord ce compte" : 'Reactivate this account first') : t.admin.promouvoir}>
            <Shield className="h-4 w-4" />
          </Button>
        )}
        {u.est_admin && !u.est_superuser && (
          <Button variant="ghost" size="sm" onClick={() => handleRole(u.id, false)} disabled={roleDesactive(u)}
            title={roleDesactive(u) ? (fr ? "Réactivez d'abord ce compte" : 'Reactivate this account first') : t.admin.retrogader}>
            <ShieldOff className="h-4 w-4" />
          </Button>
        )}
        {!u.est_superuser && (
          <Button variant="ghost" size="sm" onClick={() => handleDesactiver(u.id)}
            title={u.est_actif !== false ? t.admin.desactiver : t.admin.utilisateurs_reaactiver}>
            <Ban className="h-4 w-4 text-destructive" />
          </Button>
        )}
      </div>
    </TableCell>
  );

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
                  <Label>{fr ? 'Nom' : 'Name'} <span className="text-destructive">*</span></Label>
                  <Input value={nouveauNom} onChange={(e) => setNouveauNom(e.target.value)}
                    placeholder={fr ? 'Ex : Jean Dupont' : 'e.g. John Doe'} required />
                </div>
                <div className="space-y-2">
                  <Label>{t.admin.email} <span className="text-destructive">*</span></Label>
                  <Input type="email" value={nouveauEmail} onChange={(e) => setNouveauEmail(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>{fr ? 'Département' : 'Department'} <span className="text-destructive">*</span></Label>
                  <Select value={nouveauDepartementId} onValueChange={setNouveauDepartementId} required>
                    <SelectTrigger><SelectValue placeholder={fr ? 'Sélectionner un département' : 'Select a department'} /></SelectTrigger>
                    <SelectContent>
                      {departements.map((d) => (
                        <SelectItem key={d.id} value={String(d.id)}>{langue === 'en' ? (d.nom_en || d.nom) : d.nom}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-muted-foreground">
                  {fr
                    ? 'Un mot de passe sera généré automatiquement et envoyé par email.'
                    : 'A password will be generated automatically and sent by email.'}
                </p>
                <Button type="submit" className="w-full">{t.admin.creer_compte}</Button>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="rounded-md bg-green-50 dark:bg-green-950 p-4">
                  <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">{t.admin.compte_cree}</p>
                  <p className="text-xs text-muted-foreground">{messageSucces}</p>
                </div>
                <Button className="w-full" onClick={() => { setDialogOuvert(false); setMessageSucces(''); }}>{t.commun.fermer}</Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={retrogradeOuvert} onOpenChange={(o) => { setRetrogradeOuvert(o); if (!o) setUserARetrograder(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{fr ? 'Rétrograder en utilisateur' : 'Demote to staff'}</DialogTitle>
            <DialogDescription>
              {fr
                ? `Choisissez un département pour ${userARetrograder?.nom_complet || userARetrograder?.username}.`
                : `Choose a department for ${userARetrograder?.nom_complet || userARetrograder?.username}.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>{fr ? 'Département' : 'Department'} <span className="text-destructive">*</span></Label>
              <Select value={deptRetrograde} onValueChange={setDeptRetrograde}>
                <SelectTrigger><SelectValue placeholder={fr ? 'Sélectionner un département' : 'Select a department'} /></SelectTrigger>
                <SelectContent>
                  {departements.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>{langue === 'en' ? (d.nom_en || d.nom) : d.nom}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRetrogradeOuvert(false)}>{fr ? 'Annuler' : 'Cancel'}</Button>
              <Button onClick={confirmerRetrogradation}>{fr ? 'Confirmer' : 'Confirm'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {erreur && (
        <div className="rounded-md bg-destructive/10 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-destructive">
            <CircleAlert className="h-4 w-4" /><span>{erreur}</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => { setChargement(true); charger(); }}>{t.admin.utilisateurs_reessayer}</Button>
        </div>
      )}

      <Card>
        <CardHeader><CardTitle>{t.admin.utilisateurs_actifs_titre} ({actifs.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><EnTetesColonnes /></TableHeader>
            <TableBody>
              {actifs.slice((pageActifs - 1) * rowsActifs, pageActifs * rowsActifs).map((u) => (
                <TableRow key={u.id}>
                  <CellulesCommunes u={u} />
                  <CelluleActions u={u} />
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {actifs.length > 0 && (
            <TableFooter currentPage={pageActifs} totalPages={Math.ceil(actifs.length / rowsActifs)} rowsPerPage={rowsActifs} totalRows={actifs.length}
              onPageChange={setPageActifs} onRowsPerPageChange={(rows) => { setRowsActifs(rows); setPageActifs(1); }} />
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
              <TableHeader><EnTetesColonnes /></TableHeader>
              <TableBody>
                {inactifs.slice((pageInactifs - 1) * rowsInactifs, pageInactifs * rowsInactifs).map((u) => (
                  <TableRow key={u.id} className="opacity-60">
                    <CellulesCommunes u={u} />
                    <CelluleActions u={u} />
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {inactifs.length > 0 && (
            <TableFooter currentPage={pageInactifs} totalPages={Math.ceil(inactifs.length / rowsInactifs)} rowsPerPage={rowsInactifs} totalRows={inactifs.length}
              onPageChange={setPageInactifs} onRowsPerPageChange={(rows) => { setRowsInactifs(rows); setPageInactifs(1); }} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t.admin.utilisateurs_tous_titre} ({utilisateurs.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><EnTetesColonnes /></TableHeader>
            <TableBody>
              {utilisateurs.slice((pageTous - 1) * rowsTous, pageTous * rowsTous).map((u) => (
                <TableRow key={u.id} className={u.est_actif === false ? 'opacity-60' : ''}>
                  <CellulesCommunes u={u} />
                  <CelluleActions u={u} />
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {utilisateurs.length > 0 && (
            <TableFooter currentPage={pageTous} totalPages={Math.ceil(utilisateurs.length / rowsTous)} rowsPerPage={rowsTous} totalRows={utilisateurs.length}
              onPageChange={setPageTous} onRowsPerPageChange={(rows) => { setRowsTous(rows); setPageTous(1); }} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}