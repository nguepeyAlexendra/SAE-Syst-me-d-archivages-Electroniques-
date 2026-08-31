import { useEffect, useRef, useState } from 'react';
import { X, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';
import { Button } from './ui/button';

interface Props {
  src: string;
  open: boolean;
  onClose: () => void;
}

export default function ImageLightbox({ src, open, onClose }: Props) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [glisse, setGlisse] = useState(false);
  const depart = useRef({ x: 0, y: 0, px: 0, py: 0 });
  const zoneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setZoom(1);
      setRotation(0);
      setPos({ x: 0, y: 0 });
    }
  }, [open, src]);

  useEffect(() => {
    if (!open) return;
    const clavier = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', clavier);
    return () => window.removeEventListener('keydown', clavier);
  }, [open, onClose]);

  useEffect(() => {
    const el = zoneRef.current;
    if (!open || !el) return;
    const molette = (e: WheelEvent) => {
      e.preventDefault();
      setZoom((z) => Math.min(Math.max(z + (e.deltaY > 0 ? -0.25 : 0.25), 0.5), 6));
    };
    el.addEventListener('wheel', molette, { passive: false });
    return () => el.removeEventListener('wheel', molette);
  }, [open]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open || !src) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col select-none">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/10"
            onClick={() => setZoom((z) => Math.max(z - 0.25, 0.5))}
          >
            <ZoomOut className="h-5 w-5" />
          </Button>
          <span className="text-white text-sm font-medium w-14 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/10"
            onClick={() => setZoom((z) => Math.min(z + 0.25, 6))}
          >
            <ZoomIn className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/10"
            onClick={() => {
              setZoom(1);
              setPos({ x: 0, y: 0 });
            }}
          >
            <RotateCw className="h-5 w-5" />
          </Button>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/10"
          onClick={onClose}
        >
          <X className="h-6 w-6" />
        </Button>
      </div>

      <div
        ref={zoneRef}
        className={`flex-1 overflow-hidden flex items-center justify-center ${
          zoom > 1 ? (glisse ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-zoom-in'
        }`}
        onMouseDown={(e) => {
          setGlisse(true);
          depart.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y };
        }}
        onMouseMove={(e) => {
          if (!glisse) return;
          setPos({
            x: depart.current.px + e.clientX - depart.current.x,
            y: depart.current.py + e.clientY - depart.current.y,
          });
        }}
        onMouseUp={() => setGlisse(false)}
        onMouseLeave={() => setGlisse(false)}
        onDoubleClick={() => {
          if (zoom > 1) {
            setZoom(1);
            setPos({ x: 0, y: 0 });
          } else setZoom(2);
        }}
      >
        <img
          src={src}
          alt="Image agrandie"
          draggable={false}
          className="max-w-full max-h-full object-contain"
          style={{
            transform: `translate(${pos.x}px, ${pos.y}px) scale(${zoom}) rotate(${rotation}deg)`,
          }}
        />
      </div>

      <p className="text-center text-white/50 text-xs pb-3">
        Molette pour zoomer • Glisser pour déplacer • Double-clic pour zoomer • Échap pour fermer
      </p>
    </div>
  );
}