import { useRef, useEffect, useState } from 'react';

interface SignatureCanvasProps {
  onSave: (base64: string) => void;
  onClear?: () => void;
  placeholder?: string;
  id?: string;
}

export default function SignatureCanvas({ onSave, onClear, placeholder = 'Firme aquí con el dedo o mouse', id = 'sig-canvas' }: SignatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawing, setHasDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Ajustar resolución del canvas para pantallas de alta densidad
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    
    // Configurar pincel
    ctx.strokeStyle = '#c8a84b'; // Color oro
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const getCoordinates = (e: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    // Detectar si es un evento táctil o de mouse
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDrawing = (e: any) => {
    // Evitar scroll en pantallas táctiles
    if (e.touches) e.preventDefault();
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: any) => {
    if (!isDrawing) return;
    if (e.touches) e.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasDrawing(true);
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      saveSignature();
    }
  };

  const saveSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawing) return;
    const dataUrl = canvas.toDataURL('image/png');
    onSave(dataUrl);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawing(false);
    onSave('');
    if (onClear) onClear();
  };

  return (
    <div className="bg-[#1a1a29] border border-dashed border-[#c8a84b]/40 rounded-xl p-3 flex flex-col gap-2">
      <div className="relative overflow-hidden rounded-lg bg-[#0f0f18]/80">
        <canvas
          id={id}
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="w-full h-32 block cursor-crosshair touch-none"
        />
        {!hasDrawing && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-xs text-[#9090a8] font-medium tracking-wide">
            {placeholder}
          </div>
        )}
      </div>
      <div className="flex justify-between items-center px-1">
        <span className="text-[10px] text-[#9090a8] font-mono select-none">
          {hasDrawing ? '✓ Firma capturada' : 'Esperando firma...'}
        </span>
        <button
          type="button"
          onClick={handleClear}
          className="text-xs text-[#9090a8] hover:text-[#c8a84b] hover:underline font-medium transition-colors"
        >
          Limpiar firma
        </button>
      </div>
    </div>
  );
}
