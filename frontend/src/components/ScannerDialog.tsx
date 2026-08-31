import { useState, useEffect, useCallback } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from './ui/dialog';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { ScrollArea, ScrollBar } from './ui/scroll-area';
import { Alert, AlertDescription } from './ui/alert';
import { Skeleton } from './ui/skeleton';
import { Separator } from './ui/separator';
import {
  ScanLine, Upload, RotateCcw, X, Loader2, FileText,
  ChevronLeft, ChevronRight, AlertCircle, File as FileIcon,
  Image as ImageIcon, ZoomIn, ZoomOut, Maximize2,
} from 'lucide-react';
import { deposerDocument } from '../api/documents';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import apiClient from '../api/client';

interface ScannerDialogProps {
  open: boolean;
  onClose: () => void;
  onScanDepose: (doc: { id: number; titre: string }) => void;
  departementId: number;
  mode: 'images' | 'documents';
  titre: string;
}

interface ScanResultat {
  pages: string[];
  original: string;
  mimeOriginal: string;
  format: 'pdf' | 'tiff' | 'image';
  nbPages: number;
}

export default function ScannerDialog({
  open, onClose, onScanDepose, departementId, mode, titre,
}: ScannerDialogProps) {
  const { utilisateur } = useAuth();
  const [scan, setScan] = useState<ScanResultat | null>(null);
  const [pageActive, setPageActive] = useState<number>(0);
  const [zoom, setZoom] = useState<number>(1);
  const [chargement, setChargement] = useState(false);
  const [televersement, setTeleversement] = useState(false);
  const [erreur, setErreur] = useState('');

  const naviguerPage = useCallback(
    (direction: 'prev' | 'next') => {
      if (!scan) return;
      setPageActive((p) => direction === 'prev'
        ? Math.max(0, p - 1)
        : Math.min(scan.nbPages - 1, p + 1));
    }, [scan]
  );

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!open || !scan || scan.nbPages <= 1) return;
      if (e.key === 'ArrowLeft') naviguerPage('prev');
      if (e.key === 'ArrowRight') naviguerPage('next');
      if (e.key === '+' || e.key === '=') setZoom((z) => Math.min(3, z + 0.25));
      if (e.key === '-') setZoom((z) => Math.max(0.5, z - 0.25));
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, scan, naviguerPage]);

  useEffect(() => {
    if (open) lancerScan();
    else reinitialiser();
  }, [open]);

  async function lancerScan() {
    setChargement(true); setErreur(''); setScan(null); setPageActive(0); setZoom(1);
    try {
      let resAgent: Response;
      try {
        resAgent = await fetch('http://127.0.0.1:7777/scan', { method: 'POST' });
      } catch {
        const resDemo = await apiClient.post('/scans/demo/');
        setScan({
          pages: [resDemo.data.image], original: resDemo.data.image,
          mimeOriginal: resDemo.data.mime || 'image/jpeg', format: 'image', nbPages: 1,
        });
        return;
      }
      if (resAgent.ok) {
        const data = await resAgent.json();
        if (data.pages && Array.isArray(data.pages)) {
          setScan({
            pages: data.pages, original: data.original,
            mimeOriginal: data.mime_original, format: data.format, nbPages: data.nb_pages,
          });
        } else {
          setScan({
            pages: [data.image], original: data.image,
            mimeOriginal: data.mime || 'image/jpeg', format: 'image', nbPages: 1,
          });
        }
      } else {
        setErreur("Aucun scan reçu. Cliquez sur Réessayer, puis appuyez sur le bouton SAE de la Canon PENDANT l'attente.");
      }
    } catch {
      setErreur('Erreur inattendue lors du scan.');
    } finally {
      setChargement(false);
    }
  }

  async function convertirPageEnJpeg(base64: string, nomFichier: string): Promise<File> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas indisponible'));
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((blob) => {
          if (!blob) return reject(new Error('Conversion échouée'));
          resolve(new File([blob], nomFichier, { type: 'image/jpeg' }));
        }, 'image/jpeg', 0.92);
      };
      img.onerror = () => reject(new Error('Image invalide'));
      img.src = `data:image/jpeg;base64,${base64}`;
    });
  }

  async function televerser() {
    if (!scan) return;

    if (mode === 'images' && scan.nbPages > 1) {
      setErreur(
        `⚠️ Plusieurs pages détectées (${scan.nbPages}). ` +
        `Pour scanner un document multi-pages, utilisez le bouton « Scanner » de la section Documents.`
      );
      return;
    }

    setTeleversement(true);
    try {
      let fichier: File;
      let categorie: string;

      if (mode === 'images') {
        const nomFichier = `scan_${Date.now()}.jpg`;
        fichier = await convertirPageEnJpeg(scan.pages[0], nomFichier);
        categorie = 'images';
      } else {
        const byteString = atob(scan.original);
        const bytes = new Uint8Array(byteString.length);
        for (let i = 0; i < byteString.length; i++) bytes[i] = byteString.charCodeAt(i);
        const blob = new Blob([bytes], { type: 'application/pdf' });
        fichier = new File([blob], `scan_${Date.now()}.pdf`, { type: 'application/pdf' });
        categorie = 'documents';
      }

      const titreFinal = titre.trim() || `Scan du ${new Date().toLocaleString()}`;
      const doc = await deposerDocument(titreFinal, fichier, 'scan', departementId, categorie, []);
      toast.success(
        `${mode === 'images' ? 'Image' : `Document (${scan.nbPages} page${scan.nbPages > 1 ? 's' : ''})`} téléversé(e) avec succès`
      );
      onScanDepose(doc);
      onClose();
    } catch {
      setErreur('Erreur lors du téléversement');
      toast.error('Erreur lors du téléversement');
    } finally {
      setTeleversement(false);
    }
  }

  function reinitialiser() {
    setScan(null); setPageActive(0); setErreur(''); setZoom(1);
    setChargement(false); setTeleversement(false);
  }

  const FormatIcon = scan?.format === 'pdf' ? FileText : scan?.format === 'tiff' ? FileIcon : ImageIcon;
  const badgeVariant = scan?.format === 'pdf' ? 'default' : scan?.format === 'tiff' ? 'secondary' : 'outline';

  const titreDialog = mode === 'images' ? 'Scanner une image' : 'Scanner un document';
  const descriptionDialog = mode === 'images'
    ? 'Numérisez une page unique depuis la Canon iR-ADV'
    : 'Numérisez un document (une ou plusieurs pages) depuis la Canon iR-ADV';

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                {mode === 'images' ? <ImageIcon className="h-5 w-5 text-primary" /> : <ScanLine className="h-5 w-5 text-primary" />}
              </div>
              <div>
                <DialogTitle className="text-xl">{titreDialog}</DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  {descriptionDialog}
                </DialogDescription>
              </div>
            </div>
            {scan && (
              <div className="flex items-center gap-2">
                <Badge variant={badgeVariant} className="gap-1.5 px-2.5 py-1">
                  <FormatIcon className="h-3.5 w-3.5" />
                  {scan.format.toUpperCase()}
                </Badge>
                <Badge variant="outline" className="px-2.5 py-1">
                  {scan.nbPages} page{scan.nbPages > 1 ? 's' : ''}
                </Badge>
              </div>
            )}
          </div>
        </DialogHeader>

        <Separator className="my-2" />

        <div className="space-y-5">
          {titre.trim() && (
            <div className="px-3 py-2 rounded-lg bg-muted/50 flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Titre :</span>
              <span className="font-medium truncate">{titre}</span>
            </div>
          )}

          {chargement && (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
                <div className="relative">
                  <div className="h-16 w-16 rounded-full border-4 border-muted"></div>
                  <Loader2 className="absolute inset-0 h-16 w-16 animate-spin text-primary p-1" />
                </div>
                <div className="text-center space-y-1">
                  <p className="font-medium">Scan en cours…</p>
                  <p className="text-sm text-muted-foreground">
                    Posez votre document sur la Canon et lancez la numérisation
                  </p>
                </div>
                <div className="w-48 space-y-2">
                  <Skeleton className="h-2 w-full" />
                  <Skeleton className="h-2 w-3/4 mx-auto" />
                </div>
              </CardContent>
            </Card>
          )}

          {erreur && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{erreur}</AlertDescription>
            </Alert>
          )}

          {!chargement && scan && (
            <Card className="overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-base font-medium">Aperçu du document</CardTitle>

                {/* 🔍 Contrôles zoom + navigation */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {scan.nbPages > 1 && (
                    <>
                      <Button variant="outline" size="icon" className="h-8 w-8"
                        onClick={() => naviguerPage('prev')} disabled={pageActive === 0}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="font-mono text-xs min-w-[70px] text-center">
                        {pageActive + 1} / {scan.nbPages}
                      </span>
                      <Button variant="outline" size="icon" className="h-8 w-8"
                        onClick={() => naviguerPage('next')} disabled={pageActive === scan.nbPages - 1}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Separator orientation="vertical" className="h-6" />
                    </>
                  )}
                  <Button variant="outline" size="icon" className="h-8 w-8"
                    onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))} disabled={zoom <= 0.5}>
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <span className="font-mono text-xs min-w-[45px] text-center">
                    {Math.round(zoom * 100)}%
                  </span>
                  <Button variant="outline" size="icon" className="h-8 w-8"
                    onClick={() => setZoom((z) => Math.min(3, z + 0.25))} disabled={zoom >= 3}>
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-8 w-8"
                    onClick={() => setZoom(1)} disabled={zoom === 1} title="Réinitialiser le zoom">
                    <Maximize2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* 🖼️ Zone d'aperçu avec zoom + scroll */}
                <div className="overflow-auto rounded-lg bg-muted/30 p-4" style={{ maxHeight: '520px' }}>
                  <img
                    src={`data:image/jpeg;base64,${scan.pages[pageActive]}`}
                    alt={`Page ${pageActive + 1}`}
                    className="rounded-md shadow-md border bg-white mx-auto transition-all duration-200"
                    style={{
                      width: zoom === 1 ? 'auto' : `${zoom * 100}%`,
                      maxWidth: zoom === 1 ? '100%' : 'none',
                      maxHeight: zoom === 1 ? '450px' : 'none',
                    }}
                  />
                </div>

                {scan.nbPages > 1 && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <div className="text-xs text-muted-foreground uppercase tracking-wide">
                        Pages du document
                      </div>
                      <ScrollArea className="w-full whitespace-nowrap">
                        <div className="flex gap-2 pb-2">
                          {scan.pages.map((page, i) => (
                            <button key={i} onClick={() => setPageActive(i)}
                              className={`group relative flex-shrink-0 rounded-md overflow-hidden border-2 transition-all ${
                                pageActive === i
                                  ? 'border-primary ring-2 ring-primary/20 shadow-sm'
                                  : 'border-border hover:border-primary/50'
                              }`}>
                              <img src={`data:image/jpeg;base64,${page}`} alt={`Page ${i + 1}`}
                                className="h-24 w-[70px] object-cover" />
                              <div className={`absolute bottom-0 inset-x-0 text-[10px] text-center py-0.5 font-medium transition-colors ${
                                pageActive === i
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-muted/80 text-muted-foreground'
                              }`}>{i + 1}</div>
                            </button>
                          ))}
                        </div>
                        <ScrollBar orientation="horizontal" />
                      </ScrollArea>
                      <p className="text-xs text-muted-foreground text-center">
                        💡 Flèches ← → pour changer de page · Touches + / − pour zoomer
                      </p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2 justify-between pt-2 border-t">
          <Button variant="ghost" onClick={onClose} disabled={televersement}>
            <X className="h-4 w-4 mr-2" /> Annuler
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={lancerScan} disabled={chargement || televersement}>
              <RotateCcw className="h-4 w-4 mr-2" /> Réessayer
            </Button>
            <Button onClick={televerser} disabled={!scan || televersement}>
              {televersement ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Téléversement…</>
              ) : (
                <><Upload className="h-4 w-4 mr-2" /> Téléverser dans le SAE</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}