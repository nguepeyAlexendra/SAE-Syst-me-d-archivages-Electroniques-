import { useState, useEffect } from 'react';
import { listerDepartements, creerDepartement, modifierDepartement, supprimerDepartement, listerMembresDepartement, type DepartementType, type Utilisateur } from '../api/admin';
import { useTranslation } from '../i18n/useTranslation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { Plus, Pencil, Trash2, ChevronDown, Users, Building2 } from 'lucide-react';
import { toast } from 'sonner';

export default function GestionDepartements() {
  const { t } = useTranslation();
  const [departements, setDepartements] = useState<DepartementType[]>([]);
  const [chargement, setChargement] = useState(true);
  const [dialogOuvert, setDialogOuvert] = useState(false);
  const [editionId, setEditionId] = useState<number | null>(null);
  const [nom, setNom] = useState('');
  const [description, setDescription] = useState('');
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [membres, setMembres] = useState<Record<number, Utilisateur[]>>({});

  useEffect(() => { charger(); }, []);

  async function charger() {
    try {
      const data = await listerDepartements();
      setDepartements(data);
    } catch {
      toast.error(t.commun.erreur);
    } finally {
      setChargement(false);
    }
  }

  async function chargerMembres(id: number) {
    if (membres[id]) return;
    try {
      const data = await listerMembresDepartement(id);
      setMembres((prev) => ({ ...prev, [id]: data }));
    } catch {
      toast.error(t.commun.erreur);
    }
  }

  function ouvrirEdition(d?: DepartementType) {
    if (d) {
      setEditionId(d.id);
      setNom(d.nom);
      setDescription(d.description ?? '');
    } else {
      setEditionId(null);
      setNom('');
      setDescription('');
    }
    setDialogOuvert(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editionId) {
        await modifierDepartement(editionId, { nom, description });
        toast.success(t.admin.departement_modifie);
      } else {
        await creerDepartement({ nom, description });
        toast.success(t.admin.departement_cree);
      }
      setDialogOuvert(false);
      charger();
    } catch {
      toast.error(t.commun.erreur);
    }
  }

  async function handleSupprimer(id: number) {
    if (!confirm(t.admin.departement_supprimer_confirm)) return;
    try {
      await supprimerDepartement(id);
      toast.success(t.admin.departement_supprime);
      charger();
    } catch {
      toast.error(t.commun.erreur);
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2"><Building2 className="h-5 w-5" /> {t.admin.departement_titre}</span>
          <Dialog open={dialogOuvert} onOpenChange={setDialogOuvert}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={() => ouvrirEdition()}><Plus className="h-4 w-4 mr-1" /> {t.admin.departement_ajouter}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editionId ? t.admin.departement_modifier_btn : t.admin.departement_nouveau}</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>{t.admin.departement_nom}</Label>
                  <Input value={nom} onChange={(e) => setNom(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>{t.admin.departement_description}</Label>
                  <Input value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>
                <Button type="submit" className="w-full">{editionId ? t.admin.departement_modifier : t.admin.departement_creer}</Button>
              </form>
            </DialogContent>
          </Dialog>
        </CardTitle>
        <CardDescription>{t.admin.departement_gerer}</CardDescription>
      </CardHeader>
      <CardContent>
        {chargement ? (
          <p className="text-sm text-muted-foreground">{t.commun.charger}</p>
        ) : departements.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.admin.departement_aucun}</p>
        ) : (
          <div className="space-y-2">
            {departements.map((d) => (
              <Collapsible
                key={d.id}
                open={!!expanded[d.id]}
                onOpenChange={(o: boolean) => {
                  setExpanded((prev) => ({ ...prev, [d.id]: o }));
                  if (o) chargerMembres(d.id);
                }}
              >
                <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50">
                  <div className="flex items-center gap-3">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{d.nom}</p>
                      {d.description && <p className="text-xs text-muted-foreground">{d.description}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs gap-1">
                      <Users className="h-3 w-3" />
                      {membres[d.id]?.length ?? '…'}
                    </Badge>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <ChevronDown className={`h-4 w-4 transition-transform ${expanded[d.id] ? 'rotate-180' : ''}`} />
                      </Button>
                    </CollapsibleTrigger>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => ouvrirEdition(d)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleSupprimer(d.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <CollapsibleContent>
                  <div className="ml-6 mt-1 p-2 border-l-2 pl-4 space-y-1">
                    {membres[d.id]?.length ? (
                      membres[d.id].map((u) => (
                        <div key={u.id} className="flex items-center justify-between text-sm">
                          <span>{u.username}</span>
                          <Badge variant={u.est_admin ? 'default' : 'secondary'} className="text-[10px]">
                            {u.est_admin ? t.admin.departement_admin : t.admin.departement_employe}
                          </Badge>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-muted-foreground">{t.admin.departement_aucun_membre}</p>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}