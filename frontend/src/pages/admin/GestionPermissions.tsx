import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { listerUtilisateurs, listerDepartements, getDepartementsAutorises, mettreJourDepartementsAutorises, accorderAccesDepartement, revoquerAccesDepartement, listerPermissionsDocument, mettreJourPermissionsDocument, type DepartementType, type DocumentPermission } from '../../api/admin';
import type { Utilisateur } from '../../api/auth';
import { useTranslation } from '../../i18n/useTranslation';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import TableFooter from '../../components/TableFooter';
import { toast } from 'sonner';
import { ArrowLeft, ShieldCheck, ShieldX, Users, Building2, FileText, User } from 'lucide-react';

export default function GestionPermissions() {
  const navigate = useNavigate();
  const { t, langue } = useTranslation();
  const [utilisateurs, setUtilisateurs] = useState<Utilisateur[]>([]);
  const [departements, setDepartements] = useState<DepartementType[]>([]);
  const [extraDepts, setExtraDepts] = useState<Record<number, number[]>>({});
  const [chargement, setChargement] = useState(true);

  const [sourceDept, setSourceDept] = useState('');
  const [targetDepts, setTargetDepts] = useState<string[]>([]);
  const [showConfirmGrant, setShowConfirmGrant] = useState(false);

  const [sourceDeptRevoke, setSourceDeptRevoke] = useState('');
  const [targetDeptsRevoke, setTargetDeptsRevoke] = useState<string[]>([]);
  const [showConfirmRevoke, setShowConfirmRevoke] = useState(false);

  const [onglet, setOnglet] = useState('par-departement');

  const [documents, setDocuments] = useState<DocumentPermission[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<number[]>([]);
  const [docSearch, setDocSearch] = useState('');

  const [pageMembres, setPageMembres] = useState(1);
  const [rowsMembres, setRowsMembres] = useState(10);
  const [pageDocs, setPageDocs] = useState(1);
  const [rowsDocs, setRowsDocs] = useState(10);

  async function chargerTout() {
    try {
      const [users, depts] = await Promise.all([listerUtilisateurs(), listerDepartements()]);
      setUtilisateurs(users);
      setDepartements(depts);
      const extra: Record<number, number[]> = {};
      await Promise.all(users.map(async (u) => {
        try {
          const data = await getDepartementsAutorises(u.id);
          extra[u.id] = data.departements_autorises;
        } catch { extra[u.id] = []; }
      }));
      setExtraDepts(extra);
    } catch { toast.error(t.commun.erreur); }
  }

  useEffect(() => {
    async function charger() {
      setChargement(true);
      await chargerTout();
      setChargement(false);
    }
    charger();
  }, []);

  async function handleChange(userId: number, deptId: string) {
    const current = extraDepts[userId] || [];
    const id = Number(deptId);
    const nouveau = current.includes(id) ? current.filter((d) => d !== id) : [...current, id];
    try {
      await mettreJourDepartementsAutorises(userId, nouveau);
      setExtraDepts((prev) => ({ ...prev, [userId]: nouveau }));
      toast.success(t.admin.permissions_mises_a_jour);
    } catch { toast.error(t.commun.erreur); }
  }

  async function handleAccorderAcces() {
    if (!sourceDept || targetDepts.length === 0) return;
    try {
      const result = await accorderAccesDepartement(Number(sourceDept), targetDepts.map(Number));
      toast.success(result.message);
      setShowConfirmGrant(false);
      setSourceDept('');
      setTargetDepts([]);
      await chargerTout();
    } catch { toast.error(t.commun.erreur); }
  }

  async function handleRevokeAcces() {
    if (!sourceDeptRevoke || targetDeptsRevoke.length === 0) return;
    try {
      const result = await revoquerAccesDepartement(Number(sourceDeptRevoke), targetDeptsRevoke.map(Number));
      toast.success(result.message);
      setShowConfirmRevoke(false);
      setSourceDeptRevoke('');
      setTargetDeptsRevoke([]);
      await chargerTout();
    } catch { toast.error(t.commun.erreur); }
  }

  async function handleAjouterDocuments() {
    if (selectedDocIds.length === 0) {
      toast.error(t.admin.permissions_selectionner_doc);
      return;
    }
    try {
      const ajouterUtilisateurs: number[] = [];
      const ajouterDepartements: number[] = [];
      if (docUserIds.length > 0) ajouterUtilisateurs.push(...docUserIds);
      if (docDeptIds.length > 0) ajouterDepartements.push(...docDeptIds);
      if (ajouterUtilisateurs.length === 0 && ajouterDepartements.length === 0) {
        toast.error(t.admin.permissions_selectionner_utilisateur_ou_dept);
        return;
      }
      const result = await mettreJourPermissionsDocument(selectedDocIds, {
        ajouter_utilisateurs: ajouterUtilisateurs,
        ajouter_departements: ajouterDepartements,
      });
      toast.success(result.message);
      setDocUserIds([]);
      setDocDeptIds([]);
      setSelectedDocIds([]);
      await chargerDocuments();
    } catch { toast.error(t.commun.erreur); }
  }

  async function handleRetirerDocument(docId: number, type: 'user' | 'dept', id: number) {
    try {
      await mettreJourPermissionsDocument([docId], {
        ...(type === 'user' ? { retirer_utilisateurs: [id] } : { retirer_departements: [id] }),
      });
      toast.success(t.admin.permissions_acces_retire);
      await chargerDocuments();
    } catch { toast.error(t.commun.erreur); }
  }

  const [docUserIds, setDocUserIds] = useState<number[]>([]);
  const [docDeptIds, setDocDeptIds] = useState<number[]>([]);

  async function chargerDocuments() {
    try {
      const docs = await listerPermissionsDocument();
      setDocuments(docs);
    } catch { toast.error(t.commun.erreur); }
  }

  useEffect(() => {
    if (onglet === 'par-document') chargerDocuments();
  }, [onglet]);

  const docsFiltres = documents.filter((d) =>
    !docSearch || d.titre.toLowerCase().includes(docSearch.toLowerCase())
  );
  const membresPagines = utilisateurs.slice((pageMembres - 1) * rowsMembres, pageMembres * rowsMembres);
  const docsPagines = docsFiltres.slice((pageDocs - 1) * rowsDocs, pageDocs * rowsDocs);

  useEffect(() => { setPageDocs(1); }, [docSearch]);

  function toggleDocSelection(docId: number) {
    setSelectedDocIds((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    );
  }

  // 🆕 Libellé propre pour le groupe (au lieu de "documents/images/medias")
  function libelleGroupe(g?: string | null) {
    if (g === 'images') return 'Image';
    if (g === 'medias') return langue === 'en' ? 'Media' : 'Média';
    if (g === 'documents') return 'Document';
    return '—';
  }

  if (chargement) return <p className="p-8">{t.commun.charger}</p>;

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="text-2xl font-bold">{t.admin.permissions_titre}</h1>
      </div>

      <Tabs value={onglet} onValueChange={setOnglet}>
        <TabsList>
          <TabsTrigger value="par-departement"><Building2 className="h-4 w-4 mr-2" />{t.admin.permissions_par_departement}</TabsTrigger>
          <TabsTrigger value="par-membre"><Users className="h-4 w-4 mr-2" />{t.admin.permissions_par_membre}</TabsTrigger>
          <TabsTrigger value="par-document"><FileText className="h-4 w-4 mr-2" />{t.admin.permissions_par_document}</TabsTrigger>
        </TabsList>

        <TabsContent value="par-departement" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>{t.admin.permissions_accorder_dept}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground" dangerouslySetInnerHTML={{ __html: t.admin.permissions_accorder_desc }} />
              <div className="space-y-2">
                <label className="text-sm font-medium">{t.admin.permissions_dept_source}</label>
                <Select value={sourceDept} onValueChange={setSourceDept}>
                  <SelectTrigger><SelectValue placeholder={t.admin.departement_nom} /></SelectTrigger>
                  <SelectContent>
                    {departements.map((d) => (
                      <SelectItem key={d.id} value={String(d.id)}>{langue === 'en' ? (d.nom_en || d.nom) : d.nom}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t.admin.permissions_dept_cible}</label>
                <div className="flex gap-1 flex-wrap">
                  {departements
                    .filter((d) => !sourceDept || String(d.id) !== sourceDept)
                    .map((d) => {
                      const selected = targetDepts.includes(String(d.id));
                      return (
                        <Badge key={d.id} variant={selected ? 'default' : 'outline'} className="cursor-pointer transition-all"
                          onClick={() => setTargetDepts((prev) => selected ? prev.filter((id) => id !== String(d.id)) : [...prev, String(d.id)])}
                        >{selected ? '✓ ' : '+ '}{langue === 'en' ? (d.nom_en || d.nom) : d.nom}</Badge>
                      );
                    })}
                </div>
              </div>
              <Button disabled={!sourceDept || targetDepts.length === 0} onClick={() => setShowConfirmGrant(true)}>
                <ShieldCheck className="h-4 w-4 mr-2" /> {t.admin.permissions_donner_acces}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>{t.admin.permissions_retirer_acces_dept}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">{t.admin.permissions_retirer_desc}</p>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t.admin.permissions_dept_source_retrait}</label>
                <Select value={sourceDeptRevoke} onValueChange={setSourceDeptRevoke}>
                  <SelectTrigger><SelectValue placeholder={t.admin.departement_nom} /></SelectTrigger>
                  <SelectContent>
                    {departements.map((d) => (
                      <SelectItem key={d.id} value={String(d.id)}>{langue === 'en' ? (d.nom_en || d.nom) : d.nom}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t.admin.permissions_dept_cible_retrait}</label>
                <div className="flex gap-1 flex-wrap">
                  {departements
                    .filter((d) => !sourceDeptRevoke || String(d.id) !== sourceDeptRevoke)
                    .map((d) => {
                      const selected = targetDeptsRevoke.includes(String(d.id));
                      return (
                        <Badge key={d.id} variant={selected ? 'destructive' : 'outline'} className="cursor-pointer transition-all"
                          onClick={() => setTargetDeptsRevoke((prev) => selected ? prev.filter((id) => id !== String(d.id)) : [...prev, String(d.id)])}
                        >{selected ? '✕ ' : '- '}{langue === 'en' ? (d.nom_en || d.nom) : d.nom}</Badge>
                      );
                    })}
                </div>
              </div>
              <Button variant="destructive" disabled={!sourceDeptRevoke || targetDeptsRevoke.length === 0} onClick={() => setShowConfirmRevoke(true)}>
                <ShieldX className="h-4 w-4 mr-2" /> {t.admin.permissions_retirer_acces}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="par-membre">
          <Card>
            <CardHeader><CardTitle>{t.admin.permissions_utilisateurs}</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.admin.permissions_utilisateur}</TableHead>
                    <TableHead>{t.admin.permissions_dept_principal}</TableHead>
                    <TableHead>{t.admin.permissions_depts_autorises}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {membresPagines.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.username}</TableCell>
                      <TableCell>{u.departement?.nom ?? '—'}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {departements
                            .filter((d) => d.id !== u.departement?.id)
                            .map((d) => {
                              const estAutorise = (extraDepts[u.id] || []).includes(d.id);
                              return (
                                <Badge key={d.id} variant={estAutorise ? 'default' : 'outline'} className="cursor-pointer transition-all"
                                  onClick={() => handleChange(u.id, String(d.id))}
                                >{estAutorise ? '✓ ' : '+ '}{langue === 'en' ? (d.nom_en || d.nom) : d.nom}</Badge>
                              );
                            })}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <TableFooter
                currentPage={pageMembres}
                totalPages={Math.max(1, Math.ceil(utilisateurs.length / rowsMembres))}
                rowsPerPage={rowsMembres}
                totalRows={utilisateurs.length}
                onPageChange={setPageMembres}
                onRowsPerPageChange={(n) => { setRowsMembres(n); setPageMembres(1); }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="par-document" className="space-y-4">
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder={t.admin.permissions_rechercher_doc}
              value={docSearch}
              onChange={(e) => setDocSearch(e.target.value)}
              className="flex h-10 w-full max-w-sm rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <Button variant="outline" onClick={chargerDocuments}>{t.admin.permissions_actualiser}</Button>
          </div>

          <div className="flex items-center gap-2">
            <Select value="" onValueChange={(val) => {
              const id = Number(val);
              if (!selectedDocIds.includes(id)) setSelectedDocIds((prev) => [...prev, id]);
            }}>
              <SelectTrigger className="w-64"><SelectValue placeholder={t.admin.permissions_ajouter_doc} /></SelectTrigger>
              <SelectContent>
                {docsFiltres.filter((d) => !selectedDocIds.includes(d.id)).map((d) => (
                  <SelectItem key={d.id} value={String(d.id)}>{d.titre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedDocIds.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {selectedDocIds.length} {t.admin.permissions_docs_selectionnes}
                  <Button variant="ghost" size="sm" className="ml-2 text-xs" onClick={() => setSelectedDocIds([])}>
                    {t.admin.permissions_tout_deselectionner}
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-1">
                  {selectedDocIds.map((id) => {
                    const doc = documents.find((d) => d.id === id);
                    return (
                      <Badge key={id} variant="secondary" className="gap-1">
                        {doc?.titre ?? `#${id}`}
                        <button className="ml-1 text-xs" onClick={() => setSelectedDocIds((prev) => prev.filter((x) => x !== id))}>✕</button>
                      </Badge>
                    );
                  })}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">{t.admin.permissions_utilisateurs_ajouter}</label>
                  <Select value="" onValueChange={(val) => {
                    const id = Number(val);
                    if (!docUserIds.includes(id)) setDocUserIds((prev) => [...prev, id]);
                  }}>
                    <SelectTrigger><SelectValue placeholder={t.admin.permissions_selectionner_utilisateurs} /></SelectTrigger>
                    <SelectContent>
                      {utilisateurs.filter((u) => !docUserIds.includes(u.id)).map((u) => (
                        <SelectItem key={u.id} value={String(u.id)}>{u.username}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex gap-1 flex-wrap">
                    {docUserIds.map((id) => {
                      const user = utilisateurs.find((u) => u.id === id);
                      return (
                        <Badge key={id} variant="secondary" className="gap-1">
                          {user?.username ?? `#${id}`}
                          <button onClick={() => setDocUserIds((prev) => prev.filter((x) => x !== id))}>✕</button>
                        </Badge>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">{t.admin.permissions_departements_ajouter}</label>
                  <Select value="" onValueChange={(val) => {
                    const id = Number(val);
                    if (!docDeptIds.includes(id)) setDocDeptIds((prev) => [...prev, id]);
                  }}>
                    <SelectTrigger><SelectValue placeholder={t.admin.permissions_selectionner_departements} /></SelectTrigger>
                    <SelectContent>
                      {departements.filter((d) => !docDeptIds.includes(d.id)).map((d) => (
                        <SelectItem key={d.id} value={String(d.id)}>{langue === 'en' ? (d.nom_en || d.nom) : d.nom}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex gap-1 flex-wrap">
                    {docDeptIds.map((id) => {
                      const dept = departements.find((d) => d.id === id);
                      return (
                        <Badge key={id} variant="secondary" className="gap-1">
                          {dept?.nom ?? `#${id}`}
                          <button onClick={() => setDocDeptIds((prev) => prev.filter((x) => x !== id))}>✕</button>
                        </Badge>
                      );
                    })}
                  </div>
                </div>

                <Button onClick={handleAjouterDocuments} disabled={docUserIds.length === 0 && docDeptIds.length === 0}>
                  <ShieldCheck className="h-4 w-4 mr-2" /> {t.admin.permissions_ajouter_acces}
                </Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t.admin.permissions_tous_docs}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>{t.admin.permissions_titre_colonne}</TableHead>
                    <TableHead>{t.documents.departement}</TableHead>
                    <TableHead>{t.admin.permissions_groupe}</TableHead>
                    {/* 🆕 Colonne unique fusionnée */}
                    <TableHead>{langue === 'en' ? 'Sharing' : 'Partage'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {docsPagines.map((doc) => (
                    <TableRow key={doc.id} className={selectedDocIds.includes(doc.id) ? 'bg-muted/50' : ''}>
                      <TableCell>
                        <input type="checkbox" checked={selectedDocIds.includes(doc.id)} onChange={() => toggleDocSelection(doc.id)} />
                      </TableCell>
                      <TableCell className="font-medium max-w-[200px] truncate">{doc.titre}</TableCell>
                      <TableCell>{doc.departement_nom ?? '—'}</TableCell>
                      <TableCell>{libelleGroupe(doc.groupe)}</TableCell>
                      {/* 🆕 Cellule Partage fusionnée : départements d'abord, puis individus */}
                      <TableCell>
                        <div className="flex gap-1 flex-wrap max-w-[320px]">
                          {doc.departements_autorises.length === 0 && doc.utilisateurs_autorises.length === 0 && (
                            <span className="text-xs text-muted-foreground">{langue === 'en' ? 'Not shared' : 'Non partagé'}</span>
                          )}
                          {doc.departements_autorises.map((d) => (
                            <Badge key={`dept-${d.id}`} variant="outline" className="gap-1 text-xs">
                              <Building2 className="h-3 w-3 text-muted-foreground" />
                              {langue === 'en' ? (d.nom_en || d.nom) : d.nom}
                              {d.explicite && (
                                <button className="text-destructive hover:text-destructive/80" onClick={() => handleRetirerDocument(doc.id, 'dept', d.id)}>✕</button>
                              )}
                            </Badge>
                          ))}
                          {doc.utilisateurs_autorises.map((u) => (
                            <Badge key={`user-${u.id}`} variant="secondary" className="gap-1 text-xs">
                              <User className="h-3 w-3 text-muted-foreground" />
                              {u.username}
                              {u.explicite && (
                                <button className="text-destructive hover:text-destructive/80" onClick={() => handleRetirerDocument(doc.id, 'user', u.id)}>✕</button>
                              )}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <TableFooter
                currentPage={pageDocs}
                totalPages={Math.max(1, Math.ceil(docsFiltres.length / rowsDocs))}
                rowsPerPage={rowsDocs}
                totalRows={docsFiltres.length}
                onPageChange={setPageDocs}
                onRowsPerPageChange={(n) => { setRowsDocs(n); setPageDocs(1); }}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Confirm grant dialog */}
      {showConfirmGrant && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader><CardTitle>{t.admin.permissions_confirmer_acces}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm">
                {t.admin.permissions_confirmer_acces_msg} <strong>{t.admin.permissions_tous_membres}</strong>
                {targetDepts.length > 0 && (
                  <> {targetDepts.map((id) => departements.find((d) => String(d.id) === id)?.nom).filter(Boolean).join(', ')}</>
                )}
                {' '}{t.admin.permissions_aux_docs_de}{' '}
                <strong>{departements.find((d) => String(d.id) === sourceDept)?.nom}</strong> ?
              </p>
              <p className="text-xs text-muted-foreground">
                {t.admin.permissions_confirmer_acces_desc}
              </p>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => { setShowConfirmGrant(false); setOnglet('par-membre'); }}>
                  {t.admin.permissions_aller_par_personne}
                </Button>
                <Button onClick={handleAccorderAcces}>{t.admin.permissions_oui_confirmer}</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Confirm revoke dialog */}
      {showConfirmRevoke && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader><CardTitle>{t.admin.permissions_confirmer_retrait}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm">
                {t.admin.permissions_confirmer_retrait_msg} <strong>{t.admin.permissions_tous_membres}</strong>
                {targetDeptsRevoke.length > 0 && (
                  <> {targetDeptsRevoke.map((id) => departements.find((d) => String(d.id) === id)?.nom).filter(Boolean).join(', ')}</>
                )}
                {' '}{t.admin.permissions_aux_docs_de}{' '}
                <strong>{departements.find((d) => String(d.id) === sourceDeptRevoke)?.nom}</strong> ?
              </p>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowConfirmRevoke(false)}>{t.admin.permissions_annuler}</Button>
                <Button variant="destructive" onClick={handleRevokeAcces}>{t.admin.permissions_oui_retirer}</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}