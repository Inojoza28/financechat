import { Calculator, Delete, GripHorizontal, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Operator = "+" | "-" | "*" | "/";

type Position = {
  x: number;
  y: number;
};

const PANEL_WIDTH = 320;
const PANEL_HEIGHT = 532;
const EDGE_GAP = 16;

function initialPosition(): Position {
  if (typeof window === "undefined") return { x: 24, y: 96 };
  return {
    x: Math.max(EDGE_GAP, window.innerWidth - PANEL_WIDTH - 24),
    y: Math.max(EDGE_GAP, window.innerHeight - PANEL_HEIGHT - 76),
  };
}

function clampPosition(position: Position): Position {
  if (typeof window === "undefined") return position;
  const maxX = Math.max(EDGE_GAP, window.innerWidth - Math.min(PANEL_WIDTH, window.innerWidth - EDGE_GAP * 2) - EDGE_GAP);
  const maxY = Math.max(EDGE_GAP, window.innerHeight - Math.min(PANEL_HEIGHT, window.innerHeight - EDGE_GAP * 2) - EDGE_GAP);

  return {
    x: Math.min(Math.max(EDGE_GAP, position.x), maxX),
    y: Math.min(Math.max(EDGE_GAP, position.y), maxY),
  };
}

function formatDisplay(value: number) {
  if (!Number.isFinite(value)) return "Erro";
  const rounded = Math.abs(value) < 1e-10 ? 0 : Number(value.toPrecision(12));

  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 8,
  }).format(rounded);
}

function displayToNumber(display: string) {
  return Number(display.replace(/\./g, "").replace(",", "."));
}

function calculate(left: number, right: number, operator: Operator) {
  if (operator === "+") return left + right;
  if (operator === "-") return left - right;
  if (operator === "*") return left * right;
  if (operator === "/") return right === 0 ? Number.NaN : left / right;
  return right;
}

function operatorLabel(operator: Operator | null) {
  if (operator === "*") return "×";
  if (operator === "/") return "÷";
  return operator ?? "";
}

const keys: Array<
  | { label: string; kind: "utility"; action: "backspace" | "clear" | "percent" }
  | { label: string; kind: "operator"; operator: Operator }
  | { label: string; kind: "number"; value: string; wide?: boolean }
  | { label: string; kind: "equals" }
> = [
  { label: "Apagar", kind: "utility", action: "backspace" },
  { label: "AC", kind: "utility", action: "clear" },
  { label: "%", kind: "utility", action: "percent" },
  { label: "÷", kind: "operator", operator: "/" },
  { label: "7", kind: "number", value: "7" },
  { label: "8", kind: "number", value: "8" },
  { label: "9", kind: "number", value: "9" },
  { label: "×", kind: "operator", operator: "*" },
  { label: "4", kind: "number", value: "4" },
  { label: "5", kind: "number", value: "5" },
  { label: "6", kind: "number", value: "6" },
  { label: "-", kind: "operator", operator: "-" },
  { label: "1", kind: "number", value: "1" },
  { label: "2", kind: "number", value: "2" },
  { label: "3", kind: "number", value: "3" },
  { label: "+", kind: "operator", operator: "+" },
  { label: "0", kind: "number", value: "0", wide: true },
  { label: ",", kind: "number", value: "," },
  { label: "=", kind: "equals" },
];

export function FloatingCalculator() {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<Position>(() => initialPosition());
  const [display, setDisplay] = useState("0");
  const [storedValue, setStoredValue] = useState<number | null>(null);
  const [operator, setOperator] = useState<Operator | null>(null);
  const [waitingForValue, setWaitingForValue] = useState(false);
  const [history, setHistory] = useState("");
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origin: Position;
  } | null>(null);

  const currentValue = useMemo(() => displayToNumber(display), [display]);

  useEffect(() => {
    const handleResize = () => setPosition((current) => clampPosition(current));
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!open) return;
    setPosition((current) => clampPosition(current));

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const reset = () => {
    setDisplay("0");
    setStoredValue(null);
    setOperator(null);
    setWaitingForValue(false);
    setHistory("");
  };

  const inputNumber = (value: string) => {
    setDisplay((current) => {
      if (waitingForValue) {
        setWaitingForValue(false);
        return value === "," ? "0," : value;
      }

      if (value === "," && current.includes(",")) return current;
      if (value === ",") return `${current},`;
      if (current === "0") return value;
      if (current.replace(/[^0-9]/g, "").length >= 12) return current;
      return `${current}${value}`;
    });
  };

  const applyUtility = (action: "backspace" | "clear" | "percent") => {
    if (action === "backspace") {
      setDisplay((current) => {
        if (waitingForValue || current === "Erro" || current.length <= 1 || (current.startsWith("-") && current.length <= 2)) {
          setWaitingForValue(false);
          return "0";
        }

        const next = current.slice(0, -1);
        return next === "-" ? "0" : next;
      });
      return;
    }

    if (action === "clear") {
      reset();
      return;
    }

    const value = currentValue / 100;
    setDisplay(formatDisplay(value));
  };

  const applyOperator = (nextOperator: Operator) => {
    if (storedValue == null) {
      setStoredValue(currentValue);
      setHistory(`${formatDisplay(currentValue)} ${operatorLabel(nextOperator)}`);
    } else if (!waitingForValue && operator) {
      const result = calculate(storedValue, currentValue, operator);
      setStoredValue(result);
      setDisplay(formatDisplay(result));
      setHistory(`${formatDisplay(result)} ${operatorLabel(nextOperator)}`);
    } else {
      setHistory(`${formatDisplay(storedValue)} ${operatorLabel(nextOperator)}`);
    }

    setOperator(nextOperator);
    setWaitingForValue(true);
  };

  const applyEquals = () => {
    if (!operator || storedValue == null) return;
    const result = calculate(storedValue, currentValue, operator);
    setDisplay(formatDisplay(result));
    setHistory(`${formatDisplay(storedValue)} ${operatorLabel(operator)} ${formatDisplay(currentValue)} =`);
    setStoredValue(null);
    setOperator(null);
    setWaitingForValue(true);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: position,
    };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setPosition(
      clampPosition({
        x: drag.origin.x + event.clientX - drag.startX,
        y: drag.origin.y + event.clientY - drag.startY,
      }),
    );
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <>
      <Button
        type="button"
        size="icon"
        variant="secondary"
        onClick={() => setOpen(true)}
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+1rem)] right-4 z-40 size-11 rounded-full border border-border/70 bg-surface/90 text-foreground shadow-float backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:bg-surface sm:bottom-5 sm:right-6"
        aria-label="Abrir calculadora"
      >
        <Calculator className="size-5" />
      </Button>

      {open && (
        <section
          role="dialog"
          aria-modal="false"
          aria-label="Calculadora"
          className="fixed z-[90] w-[min(calc(100vw-2rem),20rem)] animate-rise overflow-hidden rounded-[26px] border border-white/20 bg-neutral-950 p-2.5 text-white shadow-[0_28px_80px_-24px_oklch(0.14_0.02_260_/_55%)]"
          style={{ left: position.x, top: position.y }}
        >
          <div
            className="flex touch-none cursor-grab items-center justify-between gap-3 px-2 py-1 active:cursor-grabbing"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <div className="flex items-center gap-2 text-[12px] font-medium text-white/55">
              <GripHorizontal className="size-4" />
              Calculadora
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              onPointerDown={(event) => event.stopPropagation()}
              className="flex size-8 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white/70 transition-colors hover:bg-white/15 hover:text-white"
              aria-label="Fechar calculadora"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="px-2 pb-2.5 pt-4 text-right">
            <p className="h-5 truncate text-[13px] text-white/40">{history}</p>
            <output className="block min-h-14 truncate text-[42px] font-light leading-tight tracking-normal text-white">
              {display}
            </output>
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            {keys.map((key) => {
              const isOperator = key.kind === "operator" || key.kind === "equals";
              const isActiveOperator = key.kind === "operator" && operator === key.operator && waitingForValue;

              return (
                <button
                  key={key.label}
                  type="button"
                  onClick={() => {
                    if (key.kind === "number") inputNumber(key.value);
                    if (key.kind === "utility") applyUtility(key.action);
                    if (key.kind === "operator") applyOperator(key.operator);
                    if (key.kind === "equals") applyEquals();
                  }}
                  className={cn(
                    "flex h-16 cursor-pointer items-center justify-center rounded-full text-[21px] font-medium tracking-normal transition-all duration-150 active:scale-95",
                    key.kind === "utility" && "bg-zinc-300 text-neutral-950 hover:bg-zinc-200",
                    key.kind === "number" && "bg-zinc-700 text-white hover:bg-zinc-600",
                    isOperator && "bg-[oklch(0.72_0.155_58)] text-[27px] text-white hover:bg-[oklch(0.76_0.14_58)]",
                    isActiveOperator && "bg-white text-[oklch(0.68_0.15_58)]",
                    key.kind === "number" && key.wide && "col-span-2 justify-start px-6",
                  )}
                  aria-label={key.label}
                >
                  {key.kind === "utility" && key.action === "backspace" ? <Delete className="size-6" /> : key.label}
                </button>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}
