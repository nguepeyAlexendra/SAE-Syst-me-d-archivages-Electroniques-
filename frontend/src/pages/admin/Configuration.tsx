import { useState, useEffect, useRef } from 'react';
import { getSystemStats, type SystemStats } from '../../api/admin';
import { getServerStats, type ServerStats } from '../../api/documents';
import { useTranslation } from '../../i18n/useTranslation';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, LabelList,
} from 'recharts';
import { Activity, HardDrive, AlertTriangle } from 'lucide-react';
import StatsMinIO from '../../components/StatsMinIO';
import GestionDomainesEmail from '../../components/GestionDomainesEmail';

function smooth(values: number[], window: number): number {
  if (values.length < window) return values[values.length - 1] ?? 0;
  return values.slice(-window).reduce((a, b) => a + b, 0) / window;
}

function envelopperTexte(texte: string, maxChars: number): string[] {
  const mots = texte.split(' ');
  const lignes: string[] = [];
  let courante = '';
  for (const mot of mots) {
    const candidate = (courante + ' ' + mot).trim();
    if (candidate.length > maxChars && courante) {
      lignes.push(courante.trim());
      courante = mot;
    } else {
      courante = candidate;
    }
  }
  if (courante) lignes.push(courante);
  return lignes.slice(0, 3);
}

function TickCauseRejet(props: any) {
  const { x, y, payload } = props;
  const lignes = envelopperTexte(String(payload?.value ?? ''), 24);
  const hauteurLigne = 12;
  const dyDepart = -((lignes.length - 1) * hauteurLigne) / 2;
  return (
    <text x={x} y={y} dy={dyDepart} textAnchor="end" fontSize={11} fill="hsl(var(--muted-foreground))">
      {lignes.map((l, i) => (
        <tspan key={i} x={x} dy={i === 0 ? 0 : hauteurLigne}>{l}</tspan>
      ))}
    </text>
  );
}

const COULEUR_DISQUE = 'hsl(221, 60%, 55%)';
const COULEUR_MINIO = 'hsl(168, 60%, 45%)';

function formaterEspaceGo(valeur: number): string {
  if (valeur < 1) return `${(valeur * 1024).toFixed(1)} Mo`;
  return `${valeur.toFixed(1)} Go`;
}

function ChartStockageBars({ diskTotal, diskUsed, minioUsed }: { diskTotal: number; diskUsed: number; minioUsed: number }) {
  const { t } = useTranslation();

  const diskPct = diskTotal > 0 ? Math.min(100, (diskUsed / diskTotal) * 100) : 0;
  const minioPct = diskTotal > 0 ? Math.min(100, (minioUsed / diskTotal) * 100) : 0;
  const minioPctAffichage = minioPct > 0 ? Math.max(minioPct, 1.5) : 0;
  const alerte = minioPct >= 80;

  return (
    <div className="flex flex-col gap-6 py-2">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="flex items-center gap-2 font-medium">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COULEUR_DISQUE }} />
            {t.admin.minio_radial_disque}
          </span>
          <span className="text-muted-foreground tabular-nums">
            {formaterEspaceGo(diskUsed)} / {formaterEspaceGo(diskTotal)} <strong className="text-foreground">({diskPct.toFixed(0)}%)</strong>
          </span>
        </div>
        <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{ width: `${diskPct}%`, backgroundColor: COULEUR_DISQUE }}
          />
          <div
            className="absolute inset-y-0 left-0 rounded-l-full"
            style={{ width: `${minioPctAffichage}%`, backgroundColor: COULEUR_MINIO }}
          />
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COULEUR_MINIO }} />
          {t.admin.minio_radial_minio} : {formaterEspaceGo(minioUsed)} ({minioPct.toFixed(0)}% du disque)
        </span>
      </div>
      <p className="text-center text-xs text-muted-foreground">{t.admin.minio_radial_indice}</p>

      {alerte && (
        <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{t.admin.minio_radial_alerte.replace('{pct}', minioPct.toFixed(0))}</span>
        </div>
      )}
    </div>
  );
}

export default function Configuration() {
  const { t, langue } = useTranslation();
  const [statsDoc, setStatsDoc] = useState<SystemStats | null>(null);
  const [statsServ, setStatsServ] = useState<ServerStats | null>(null);
  const [cpuRamHistory, setCpuRamHistory] = useState<{ time: string; cpu: number; ram: number }[]>([]);
  const rawCpuRef = useRef<number[]>([]);
  const rawRamRef = useRef<number[]>([]);
  const topCauses = statsDoc?.top_causes_rejet?.map((c) => ({ ...c, cause: c.cause_en || c.cause }));

  useEffect(() => {
    getSystemStats().then(setStatsDoc).catch(() => {});
    getServerStats().then((s) => {
      setStatsServ(s);
      const snap = s.cpu_percent ?? 0;
      const smem = s.memory_percent ?? 0;
      rawCpuRef.current = [snap];
      rawRamRef.current = [smem];
      const fmt = (d: Date) => d.toLocaleTimeString(langue === 'en' ? 'en-US' : 'fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const t0 = fmt(new Date(Date.now() - 1000));
      const t1 = fmt(new Date());
      setCpuRamHistory([
        { time: t0, cpu: snap, ram: smem },
        { time: t1, cpu: snap, ram: smem },
      ]);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const s = await getServerStats();
        setStatsServ(s);
        rawCpuRef.current.push(s.cpu_percent ?? 0);
        rawRamRef.current.push(s.memory_percent ?? 0);
        const now = new Date();
        const time = now.toLocaleTimeString(langue === 'en' ? 'en-US' : 'fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setCpuRamHistory((prev) => {
          const next = [...prev, { time, cpu: smooth(rawCpuRef.current, 3), ram: smooth(rawRamRef.current, 3) }];
          return next.length > 30 ? next.slice(-30) : next;
        });
      } catch {}
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const deptData = statsDoc?.par_departement?.map((d) => ({
    ...d,
    nom: langue === 'en' ? (d.departement__nom_en || d.departement__nom) : d.departement__nom,
  })) ?? [];

  const storageData = (statsServ?.storage_history ?? []).map((d) => ({
    date: new Date(d.date).toLocaleDateString(langue === 'en' ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'short' }),
    disque: d.disk_used_gb,
    minio: d.minio_used_gb,
    total: d.disk_total_gb,
  }));

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">{t.admin.configuration_titre}</h1>

      <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm text-muted-foreground bg-muted/30 rounded-lg px-4 py-3">
        <span><strong className="text-foreground">{t.admin.configuration_plateforme} :</strong> {statsServ?.platform ? statsServ.platform.split('-').slice(0, 2).join(' ') : '—'}</span>
        <span><strong className="text-foreground">{t.admin.configuration_python} :</strong> {statsServ?.python_version || '—'}</span>
        <span><strong className="text-foreground">{t.admin.configuration_uptime} :</strong> {statsServ?.uptime || '—'}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">{t.admin.par_departement}</CardTitle></CardHeader>
          <CardContent>
            {deptData.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.admin.aucun_donnees}</p>
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={deptData} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                    <CartesianGrid vertical={false} className="stroke-muted" />
                    <XAxis dataKey="nom" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                    <Tooltip cursor={false} contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                    <Legend formatter={(value: string) => {
                      const labels: Record<string, string> = { valide: t.dashboard.valide, rejete: t.dashboard.rejete };
                      return labels[value] || value;
                    }} />
                    <Bar dataKey="valide" stackId="a" fill="hsl(142, 60%, 45%)" radius={[0, 0, 0, 0]} maxBarSize={60} />
                    <Bar dataKey="rejete" stackId="a" fill="hsl(221, 60%, 55%)" radius={[4, 4, 0, 0]} maxBarSize={60} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">{t.admin.top_causes_rejet}</CardTitle></CardHeader>
          <CardContent>
            {!topCauses?.length ? (
              <p className="text-sm text-muted-foreground">{t.admin.aucun_rejet}</p>
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topCauses} layout="vertical" margin={{ left: 20, right: 40 }}>
                    <CartesianGrid horizontal={false} className="stroke-muted" />
                    <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="cause" tickLine={false} axisLine={false} width={150} interval={0} tick={<TickCauseRejet />} />
                    <Tooltip cursor={false} contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                    <Bar dataKey="count" fill="hsl(221, 60%, 55%)" radius={[0, 4, 4, 0]} barSize={32}>
                      <LabelList dataKey="count" position="right" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2"><Activity className="h-4 w-4" />CPU & RAM</CardTitle>          </CardHeader>
          <CardContent>
            {cpuRamHistory.length < 2 ? (
              <p className="text-sm text-muted-foreground">{t.commun.charger}</p>
            ) : (
              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={cpuRamHistory} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                    <CartesianGrid vertical={false} className="stroke-muted" />
                    <XAxis dataKey="time" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
                    <YAxis domain={[0, 'auto']} tickLine={false} axisLine={false} tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${v}%`} />
                    <Tooltip cursor={false} contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                      formatter={(value) => [`${Number(value ?? 0).toFixed(1)}%`]} />
                    <Legend iconType="circle" />
                    <Line type="monotone" dataKey="cpu" stroke="hsl(221, 60%, 55%)" strokeWidth={2} dot={false} name="CPU" />
                    <Line type="monotone" dataKey="ram" stroke="hsl(168, 60%, 45%)" strokeWidth={2} dot={false} name="RAM" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2"><HardDrive className="h-4 w-4" />{t.admin.disque_vs_minio}</CardTitle>
          </CardHeader>
          <CardContent>
            {storageData.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.admin.aucun_donnees}</p>
            ) : (
              <ChartStockageBars
                diskTotal={storageData[storageData.length - 1].total}
                diskUsed={storageData[storageData.length - 1].disque}
                minioUsed={storageData[storageData.length - 1].minio}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <StatsMinIO />
      <GestionDomainesEmail />
    </div>
  );
}
