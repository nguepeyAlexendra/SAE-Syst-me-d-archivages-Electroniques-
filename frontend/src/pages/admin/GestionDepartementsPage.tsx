import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { listerDepartements, creerDepartement, modifierDepartement, supprimerDepartement, listerMembresDepartement, type DepartementType, type Utilisateur } from '../../api/admin';
import { useTranslation } from '../../i18n/useTranslation';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../../components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import TableFooter from '../../components/TableFooter';
import { ArrowLeft, Plus, Pencil, Trash2, Users, Building2 } from 'lucide-react';
import { toast } from 'sonner';

export default function GestionDepartementsPage() {
  const navigate = useNavigate();
  const { t, langue } = useTranslation();
  const [departements, setDepartements] = useState<DepartementType[]>([]);
  const [chargement, setChargement] = useState(true);
  const [dialogOuvert, setDialogOuvert] = useState(false);
  const [editionId, setEditionId] = useState<number | null>(null);
  const [nom, setNom] = useState('');
  const [nomEn, setNomEn] = useState('');
  const [description, setDescription] = useState('');
  const [membres, setMembres] = useState<Record<number, Utilisateur[]>>({});
  const [paginationMembres, setPaginationMembres] = useState<Record<number, { page: number; rowsPerPage: number }>>({});
  const [suppressionId, setSuppressionId] = useState<number | null>(null);
  const [departementOuvert, setDepartementOuvert] = useState<number | null>(null);

  useEffect(() => { charger(); }, []);

  async function charger() {
    try {
      const data = await listerDepartements();
      setDepartements(data);
      const resultats = await Promise.allSettled(data.map((d) => listerMembresDepartement(d.id)));
      const mapMembres: Record<number, Utilisateur[]> = {};
      data.forEach((d, i) => {
        if (resultats[i].status === 'fulfilled') mapMembres[d.id] = (resultats[i] as PromiseFulfilledResult<Utilisateur[]>).value;
        else mapMembres[d.id] = [];
      });
      setMembres(mapMembres);
    } catch {
      toast.error(t.commun.erreur);
    } finally {
      setChargement(false);
    }
  }

  function ouvrirEdition(d?: DepartementType) {
    if (d) {
      setEditionId(d.id);
      setNom(d.nom);
      setNomEn(d.nom_en ?? '');
      setDescription(d.description ?? '');
    } else {
      setEditionId(null);
      setNom('');
      setNomEn('');
      setDescription('');
    }
    setDialogOuvert(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editionId) {
        await modifierDepartement(editionId, { nom, nom_en: nomEn, description });
        toast.success(t.admin.departement_modifie);
      } else {
        await creerDepartement({ nom, nom_en: nomEn, description });
        toast.success(t.admin.departement_cree);
      }
      setDialogOuvert(false);
      charger();
    } catch (err: any) {
      const msg = err?.response?.data?.nom?.[0] || err?.response?.data?.erreur || err?.message || t.commun.erreur;
      toast.error(msg);
    }
  }

  async function handleSupprimer() {
    if (!suppressionId) return;
    try {
      await supprimerDepartement(suppressionId);
      toast.success(t.admin.departement_supprime);
      setSuppressionId(null);
      charger();
    } catch {
      toast.error(t.commun.erreur);
    }
  }

  const deptName = (d: DepartementType) => langue === 'en' ? (d.nom_en || d.nom) : d.nom;

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}><ArrowLeft className="h-5 w-5" /></Button>
          <h1 className="text-2xl font-bold">{t.admin.departement_titre}</h1>
        </div>
        <Dialog open={dialogOuvert} onOpenChange={setDialogOuvert}>
          <DialogTrigger asChild>
            <Button onClick={() => ouvrirEdition()}><Plus className="h-4 w-4 mr-1" /> {t.admin.departement_ajouter}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editionId ? t.admin.departement_modifier_btn : t.admin.departement_nouveau}</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>{t.admin.departement_nom} (FR)</Label>
                <Input value={nom} onChange={(e) => setNom(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Nom (EN)</Label>
                <Input value={nomEn} onChange={(e) => setNomEn(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t.admin.departement_description}</Label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <Button type="submit" className="w-full">{editionId ? t.admin.departement_modifier : t.admin.departement_creer}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {chargement ? (
        <p className="text-sm text-muted-foreground">{t.commun.charger}</p>
      ) : departements.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>{t.admin.departement_aucun}</p>
          </CardContent>
        </Card>
      ) : (
        departements.map((d) => {
          const pag = paginationMembres[d.id] || { page: 1, rowsPerPage: 10 };
          const membresDept = membres[d.id] || [];
          const totalPages = Math.ceil(membresDept.length / pag.rowsPerPage);
          const start = (pag.page - 1) * pag.rowsPerPage;
          const membresPagines = membresDept.slice(start, start + pag.rowsPerPage);

          return (
            <Card key={d.id}>
              <CardHeader className="flex flex-row items-center justify-between py-4 cursor-pointer hover:bg-muted/30" onClick={() => setDepartementOuvert(departementOuvert === d.id ? null : d.id)}>
                <div className="flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <CardTitle className="text-lg">{deptName(d)}</CardTitle>
                    {d.description && <p className="text-xs text-muted-foreground">{d.description}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="gap-1">
                    <Users className="h-3 w-3" />
                    {membresDept.length}
                  </Badge>
                  <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); ouvrirEdition(d); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <AlertDialog open={suppressionId === d.id} onOpenChange={(o) => { if (!o) setSuppressionId(null); }}>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={(e) => { e.stopPropagation(); setSuppressionId(d.id); }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t.admin.departement_supprimer_confirm}</AlertDialogTitle>
                        <AlertDialogDescription>
                          {t.admin.departement_supprimer_confirm}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t.commun.non}</AlertDialogCancel>
                        <AlertDialogAction onClick={handleSupprimer} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{t.commun.oui}</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardHeader>
              {departementOuvert === d.id && (
                <CardContent className="p-0">
                  {membresDept.length === 0 ? (
                    <div className="p-4 text-center text-xs text-muted-foreground">{t.admin.departement_aucun_membre}</div>
                  ) : (
                    <>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t.admin.nom_utilisateur}</TableHead>
                            <TableHead>{t.admin.email}</TableHead>
                            <TableHead>{t.admin.role}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {membresPagines.map((u) => (
                            <TableRow key={u.id}>
                              <TableCell className="font-medium">{u.username}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                              <TableCell>
                                <Badge variant={u.est_admin ? 'default' : 'secondary'} className="text-[10px]">
                                  {u.est_admin ? t.admin.departement_admin : t.admin.departement_employe}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      <TableFooter
                        currentPage={pag.page}
                        totalPages={totalPages}
                        rowsPerPage={pag.rowsPerPage}
                        totalRows={membresDept.length}
                        onPageChange={(p) => setPaginationMembres((prev) => ({ ...prev, [d.id]: { ...pag, page: p } }))}
                        onRowsPerPageChange={(r) => setPaginationMembres((prev) => ({ ...prev, [d.id]: { page: 1, rowsPerPage: r } }))}
                      />
                    </>
                  )}
                </CardContent>
              )}
            </Card>
          );
        })
      )}
    </div>
  );
}
