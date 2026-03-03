import { useState, useRef, useCallback } from 'react';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface ZoomableImageProps {
  src: string;
  alt: string;
  className?: string;
}

export default function ZoomableImage({ src, alt, className = '' }: ZoomableImageProps) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const posStart = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.15 : 0.15;
    setScale(s => Math.min(Math.max(s + delta, 0.5), 5));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (scale <= 1) return;
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    posStart.current = { ...position };
  }, [scale, position]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: posStart.current.x + (e.clientX - dragStart.current.x),
      y: posStart.current.y + (e.clientY - dragStart.current.y),
    });
  }, [isDragging]);

  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  const reset = () => { setScale(1); setPosition({ x: 0, y: 0 }); };

  return (
    <div className={`relative overflow-hidden rounded-lg border bg-muted/20 ${className}`}>
      <div className="absolute top-2 right-2 z-10 flex gap-1">
        <button onClick={() => setScale(s => Math.min(s + 0.3, 5))} className="p-1.5 rounded-md bg-card/90 border shadow-sm hover:bg-accent/10 transition-colors">
          <ZoomIn className="h-3.5 w-3.5 text-foreground" />
        </button>
        <button onClick={() => setScale(s => Math.max(s - 0.3, 0.5))} className="p-1.5 rounded-md bg-card/90 border shadow-sm hover:bg-accent/10 transition-colors">
          <ZoomOut className="h-3.5 w-3.5 text-foreground" />
        </button>
        <button onClick={reset} className="p-1.5 rounded-md bg-card/90 border shadow-sm hover:bg-accent/10 transition-colors">
          <RotateCcw className="h-3.5 w-3.5 text-foreground" />
        </button>
      </div>
      <div className="absolute bottom-2 left-2 z-10">
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-card/90 border text-muted-foreground font-mono">
          {Math.round(scale * 100)}%
        </span>
      </div>
      <div
        ref={containerRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="w-full h-full flex items-center justify-center"
        style={{ cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in', minHeight: 400 }}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="max-w-full max-h-full object-contain select-none"
          style={{
            transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
            transition: isDragging ? 'none' : 'transform 0.15s ease-out',
          }}
        />
      </div>
    </div>
  );
}
