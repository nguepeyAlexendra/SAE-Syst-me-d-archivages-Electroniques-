import { useState, useEffect, useCallback } from 'react';
import { getLogs, type LogAction } from '../../api/documents';
import { useTranslation } from '../../i18n/useTranslation';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../../components/ui/dropdown-menu';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import TableFooter from '../../components/TableFooter';
import { ScrollText, Archive, AlertTriangle, Edit, CheckCircle, Search, ArrowUpDown, Download, ChevronDown, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import FiltreDate, { type FiltreDateValeur, FILTRE_DATE_VIDE } from '../../components/FiltreDate';

const TYPE_ICONE: Record<string, React.ElementType> = {
  archivage: Archive, rejet: AlertTriangle, modification: Edit, validation: CheckCircle, partage: Share2,
};
const TYPE_VARIANT: Record<string, 'destructive' | 'warning' | 'default' | 'success' | 'secondary'> = {
  archivage: 'destructive', rejet: 'warning', modification: 'secondary', validation: 'success', partage: 'default',
};
function getTypeLabel(type: string, t: any): string {
  const map: Record<string, string> = { archivage: t.admin.archivages, rejet: t.admin.rejets, modification: t.admin.modifications, validation: t.admin.validation, partage: t.admin.partage_actions };
  return map[type] || type;
}

export default function LogsPage() {
  const { t, langue } = useTranslation();
  const [logs, setLogs] = useState<LogAction[]>([]);
  const [filtre, setFiltre] = useState('all');
  const [chargement, setChargement] = useState(true);
  const [recherche, setRecherche] = useState('');

  const [modeDate, setModeDate] = useState<'plage' | 'precise'>('plage');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [datePrecise, setDatePrecise] = useState('');
  const filtreDate: FiltreDateValeur = { mode: modeDate, debut: dateDebut, fin: dateFin, precise: datePrecise };
  const [ordreDate, setOrdreDate] = useState('');
  const [pageLogs, setPageLogs] = useState(1);
  const [rowsLogs, setRowsLogs] = useState(10);
  const charger = useCallback(async () => {
    try {
      setChargement(true);
      const params: Record<string, string> = {};
      if (filtre !== 'all') params.type = filtre;
      if (recherche) params.search = recherche;
      if (modeDate === 'precise' && datePrecise) {
        params.date_precise = datePrecise;
      } else {
        if (dateDebut) params.date_debut = dateDebut;
        if (dateFin) params.date_fin = dateFin;
      }
      if (ordreDate) params.ordre_date = ordreDate;
      const data = await getLogs(params);
      setLogs(data);
    } catch { toast.error(t.commun.erreur); }
    finally { setChargement(false); }
  }, [filtre, recherche, modeDate, dateDebut, dateFin, datePrecise, ordreDate]);

  useEffect(() => { charger(); }, [charger]);

  function exporterCSV() {
    const headers = [t.admin.action, t.admin.document, t.admin.cause, t.admin.par, t.admin.date];
    const lignes = [headers];
    logs.forEach((log) => {
      lignes.push([
        getTypeLabel(log.type_action, t),
        log.document_titre || '',
        langue === 'en' ? (log.cause_en || log.cause || '') : (log.cause || log.cause_en || ''),
        log.effectue_par_nom || '',
        new Date(log.date_action).toLocaleString(langue === 'en' ? 'en-US' : 'fr-FR'),
      ]);
    });
    const csv = lignes.map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t.admin.logs_csv_telecharge);
  }

  function exporterExcel() {
    const headers = [t.admin.action, t.admin.document, t.admin.cause, t.admin.par, t.admin.date];
    const lignes = [headers];
    logs.forEach((log) => {
      lignes.push([
        getTypeLabel(log.type_action, t),
        log.document_titre || '',
        langue === 'en' ? (log.cause_en || log.cause || '') : (log.cause || log.cause_en || ''),
        log.effectue_par_nom || '',
        new Date(log.date_action).toLocaleString(langue === 'en' ? 'en-US' : 'fr-FR'),
      ]);
    });
    const csv = lignes.map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs_${new Date().toISOString().slice(0, 10)}.xls`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t.admin.logs_xls_telecharge);
  }

  if (chargement) return <p className="p-8">{t.commun.charger}</p>;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t.admin.logs}</h1>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-1" /> {t.admin.logs_exporter} <ChevronDown className="h-3 w-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={exporterCSV}>
              <Download className="h-4 w-4 mr-2" /> {t.admin.logs_exporter_csv}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={exporterExcel}>
              <Download className="h-4 w-4 mr-2" /> {t.admin.logs_exporter_xls}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t.admin.logs_rechercher}
            className="pl-9"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
          />
        </div>

        <Select value={filtre} onValueChange={setFiltre}>
          <SelectTrigger className="w-44"><SelectValue placeholder={t.admin.filtrer_type} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.admin.tous_logs}</SelectItem>
            <SelectItem value="validation">{t.admin.logs_validations}</SelectItem>
            <SelectItem value="archivage">{t.admin.archivages}</SelectItem>
            <SelectItem value="rejet">{t.admin.rejets}</SelectItem>
            <SelectItem value="modification">{t.admin.modifications}</SelectItem>
            <SelectItem value="partage">{t.admin.partage_actions}</SelectItem>
          </SelectContent>
        </Select>

        <FiltreDate
          valeur={filtreDate}
          onChange={(v) => {
            setModeDate(v.mode);
            setDateDebut(v.debut);
            setDateFin(v.fin);
            setDatePrecise(v.precise);
          }}
          labelAucun={t.admin.logs_filtrer_date}
        />

        <Select value={ordreDate} onValueChange={setOrdreDate}>
          <SelectTrigger className="w-40">
            <ArrowUpDown className="h-4 w-4 mr-1" />
            <SelectValue placeholder={t.admin.logs_date} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">{t.admin.logs_tri_date_defaut}</SelectItem>
            <SelectItem value="desc">{t.admin.logs_tri_date_desc}</SelectItem>
            <SelectItem value="asc">{t.admin.logs_tri_date_asc}</SelectItem>
          </SelectContent>
        </Select>

        {/* ✅ Bouton Réinitialiser */}
        <Button variant="ghost" size="sm" onClick={() => {
          setRecherche('');
          setFiltre('all');
          setModeDate('plage');
          setDateDebut(''); setDateFin(''); setDatePrecise('');
          setOrdreDate('');
          setPageLogs(1); setRowsLogs(10);
        }}>
          <ArrowUpDown className="h-4 w-4 mr-1" /> {t.documents.reinitialiser}
        </Button>
      </div>

      {(() => {
        const TYPE_ORDER: Record<string, number> = { archivage: 0, partage: 1, validation: 2, rejet: 3, modification: 4 };
        const logsGroupes = [...logs].sort((a, b) => {
          const orderA = TYPE_ORDER[a.type_action] ?? 99;
          const orderB = TYPE_ORDER[b.type_action] ?? 99;
          if (orderA !== orderB) return orderA - orderB;
          return (a.document ?? 0) - (b.document ?? 0);
        });
        const totalPages = Math.ceil(logsGroupes.length / rowsLogs);
        const logsAffiches = logsGroupes.slice((pageLogs - 1) * rowsLogs, pageLogs * rowsLogs);
        return (
          <Card>
            <CardContent className="p-0">
              {logsGroupes.length === 0 ? (
                <p className="p-8 text-center text-muted-foreground">{t.admin.aucun_log}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>{t.admin.action}</TableHead>
                      <TableHead>{t.admin.document}</TableHead>
                      <TableHead className="hidden md:table-cell">{t.admin.cause}</TableHead>
                      <TableHead>{t.admin.par}</TableHead>
                      <TableHead>{t.admin.date}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logsAffiches.map((log) => {
                      const Icone = TYPE_ICONE[log.type_action] || ScrollText;
                      return (
                        <TableRow key={log.id}>
                          <TableCell><Icone className="h-4 w-4 text-muted-foreground" /></TableCell>
                          <TableCell>
                            <Badge variant={TYPE_VARIANT[log.type_action] || 'default'}>
                              {getTypeLabel(log.type_action, t)}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">{log.document_titre || '—'}</TableCell>
                          <TableCell className="hidden md:table-cell text-muted-foreground max-w-xs truncate">{langue === 'en' ? (log.cause_en || log.cause || '—') : (log.cause || log.cause_en || '—')}</TableCell>
                          <TableCell>{log.effectue_par_nom || '—'}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {new Date(log.date_action).toLocaleDateString(langue === 'en' ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
            {logsGroupes.length > 0 && (
              <TableFooter
                currentPage={pageLogs}
                totalPages={totalPages}
                rowsPerPage={rowsLogs}
                totalRows={logsGroupes.length}
                onPageChange={setPageLogs}
                onRowsPerPageChange={(rows) => { setRowsLogs(rows); setPageLogs(1); }}
              />
            )}
          </Card>
        );
      })()}
    </div>
  );
}