import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Canvas as FabricCanvas,
  Circle,
  Group,
  Line,
  Rect,
  Text,
  Triangle,
  type FabricObject,
} from "fabric";
import { ArrowRight, Circle as CircleIcon, Download, Redo2, RotateCcw, Square, Target, Trash2, Type, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface TrainingFieldEditorProps {
  sportType?: "football" | "futsal";
  onSave?: (dataUrl: string) => void;
  initialData?: string;
}

type ToolType =
  | "player"
  | "cone"
  | "ball"
  | "ladder"
  | "hurdle"
  | "pole"
  | "goal-small"
  | "arrow"
  | "zone"
  | "text";

type PlayerColor = "blue" | "red" | "yellow" | "green";
type ConeColor = "orange" | "yellow" | "blue" | "red";

const PLAYER_COLORS: Record<PlayerColor, string> = {
  blue: "#2563EB",
  red: "#DC2626",
  yellow: "#EAB308",
  green: "#16A34A",
};

const CONE_COLORS: Record<ConeColor, string> = {
  orange: "#FF6B00",
  yellow: "#FFD700",
  blue: "#2563EB",
  red: "#DC2626",
};

const toolLabels: Record<ToolType, string> = {
  player: "Jogador",
  cone: "Cone",
  ball: "Bola",
  ladder: "Escada",
  hurdle: "Barreira",
  pole: "Poste",
  "goal-small": "Baliza",
  arrow: "Seta",
  zone: "Zona",
  text: "Texto",
};

export function TrainingFieldEditor({ sportType = "football", onSave }: TrainingFieldEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);

  const [activeTool, setActiveTool] = useState<ToolType | null>(null);
  const [playerColor, setPlayerColor] = useState<PlayerColor>("blue");
  const [coneColor, setConeColor] = useState<ConeColor>("orange");
  const [textInput, setTextInput] = useState("");

  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Keep latest values for event handlers (avoid stale closures)
  const activeToolRef = useRef(activeTool);
  const playerColorRef = useRef(playerColor);
  const coneColorRef = useRef(coneColor);
  const textInputRef = useRef(textInput);

  activeToolRef.current = activeTool;
  playerColorRef.current = playerColor;
  coneColorRef.current = coneColor;
  textInputRef.current = textInput;

  const fieldConfig = useMemo(
    () => (sportType === "football" ? { width: 800, height: 520, color: "#2D5016" } : { width: 700, height: 400, color: "#1E3A5F" }),
    [sportType]
  );

  const drawField = useCallback(
    (canvas: FabricCanvas) => {
      const { width, height } = fieldConfig;
      const lineColor = "rgba(255, 255, 255, 0.8)";
      const lineWidth = 2;

      const addNonInteractive = (obj: FabricObject) => {
        obj.selectable = false;
        obj.evented = false;
        canvas.add(obj);
      };

      if (sportType === "football") {
        addNonInteractive(
          new Rect({
            left: 20,
            top: 20,
            width: width - 40,
            height: height - 40,
            fill: "transparent",
            stroke: lineColor,
            strokeWidth: lineWidth,
          })
        );

        addNonInteractive(
          new Line([width / 2, 20, width / 2, height - 20], {
            stroke: lineColor,
            strokeWidth: lineWidth,
          })
        );

        addNonInteractive(
          new Circle({
            left: width / 2 - 50,
            top: height / 2 - 50,
            radius: 50,
            fill: "transparent",
            stroke: lineColor,
            strokeWidth: lineWidth,
          })
        );

        addNonInteractive(
          new Circle({
            left: width / 2 - 4,
            top: height / 2 - 4,
            radius: 4,
            fill: lineColor,
          })
        );

        addNonInteractive(
          new Rect({
            left: 20,
            top: height / 2 - 90,
            width: 100,
            height: 180,
            fill: "transparent",
            stroke: lineColor,
            strokeWidth: lineWidth,
          })
        );

        addNonInteractive(
          new Rect({
            left: 20,
            top: height / 2 - 45,
            width: 40,
            height: 90,
            fill: "transparent",
            stroke: lineColor,
            strokeWidth: lineWidth,
          })
        );

        addNonInteractive(
          new Rect({
            left: width - 120,
            top: height / 2 - 90,
            width: 100,
            height: 180,
            fill: "transparent",
            stroke: lineColor,
            strokeWidth: lineWidth,
          })
        );

        addNonInteractive(
          new Rect({
            left: width - 60,
            top: height / 2 - 45,
            width: 40,
            height: 90,
            fill: "transparent",
            stroke: lineColor,
            strokeWidth: lineWidth,
          })
        );

        addNonInteractive(
          new Rect({
            left: 10,
            top: height / 2 - 30,
            width: 10,
            height: 60,
            fill: "rgba(255, 255, 255, 0.3)",
            stroke: lineColor,
            strokeWidth: 3,
          })
        );

        addNonInteractive(
          new Rect({
            left: width - 20,
            top: height / 2 - 30,
            width: 10,
            height: 60,
            fill: "rgba(255, 255, 255, 0.3)",
            stroke: lineColor,
            strokeWidth: 3,
          })
        );
      } else {
        // Futsal
        addNonInteractive(
          new Rect({
            left: 20,
            top: 20,
            width: width - 40,
            height: height - 40,
            fill: "transparent",
            stroke: lineColor,
            strokeWidth: lineWidth,
          })
        );

        addNonInteractive(
          new Line([width / 2, 20, width / 2, height - 20], {
            stroke: lineColor,
            strokeWidth: lineWidth,
          })
        );

        addNonInteractive(
          new Circle({
            left: width / 2 - 40,
            top: height / 2 - 40,
            radius: 40,
            fill: "transparent",
            stroke: lineColor,
            strokeWidth: lineWidth,
          })
        );

        addNonInteractive(
          new Rect({
            left: 10,
            top: height / 2 - 25,
            width: 10,
            height: 50,
            fill: "rgba(255, 255, 255, 0.3)",
            stroke: lineColor,
            strokeWidth: 3,
          })
        );

        addNonInteractive(
          new Rect({
            left: width - 20,
            top: height / 2 - 25,
            width: 10,
            height: 50,
            fill: "rgba(255, 255, 255, 0.3)",
            stroke: lineColor,
            strokeWidth: 3,
          })
        );
      }

      canvas.renderAll();
    },
    [fieldConfig, sportType]
  );

  const saveState = useCallback(
    (canvas: FabricCanvas) => {
      const json = JSON.stringify(canvas.toJSON());
      setHistory((prev) => {
        const newHistory = prev.slice(0, historyIndex + 1);
        return [...newHistory, json];
      });
      setHistoryIndex((prev) => prev + 1);
    },
    [historyIndex]
  );

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new FabricCanvas(canvasRef.current, {
      width: fieldConfig.width,
      height: fieldConfig.height,
      backgroundColor: fieldConfig.color,
      selection: true,
      preserveObjectStacking: true,
    });

    drawField(canvas);
    setFabricCanvas(canvas);

    const json = JSON.stringify(canvas.toJSON());
    setHistory([json]);
    setHistoryIndex(0);

    return () => {
      canvas.dispose();
    };
  }, [drawField, fieldConfig.height, fieldConfig.width, fieldConfig.color]);

  const addEquipment = useCallback(
    (tool: ToolType, x: number, y: number, opts: { playerColor: PlayerColor; coneColor: ConeColor; text: string }) => {
      if (!fabricCanvas) return;

      let object: FabricObject | null = null;

      if (tool === "player") {
        const circle = new Circle({
          left: -15,
          top: -15,
          radius: 15,
          fill: PLAYER_COLORS[opts.playerColor],
          stroke: "#FFFFFF",
          strokeWidth: 2,
        });

        const label = new Text("J", {
          left: -6,
          top: -10,
          fontSize: 16,
          fill: "#FFFFFF",
          fontFamily: "Arial",
          fontWeight: "bold",
          selectable: false,
          evented: false,
        });

        object = new Group([circle, label], {
          left: x,
          top: y,
        });
      }

      if (tool === "cone") {
        object = new Triangle({
          left: x - 10,
          top: y - 10,
          width: 20,
          height: 20,
          fill: CONE_COLORS[opts.coneColor],
          stroke: "#000000",
          strokeWidth: 1,
          angle: 0,
        });
      }

      if (tool === "ball") {
        object = new Circle({
          left: x - 8,
          top: y - 8,
          radius: 8,
          fill: "#FFFFFF",
          stroke: "#000000",
          strokeWidth: 1,
        });
      }

      if (tool === "ladder") {
        const parts: FabricObject[] = [];
        for (let i = 0; i < 5; i++) {
          parts.push(
            new Rect({
              left: i * 15,
              top: 0,
              width: 12,
              height: 30,
              fill: "transparent",
              stroke: "#FFD700",
              strokeWidth: 2,
            })
          );
        }
        object = new Group(parts, { left: x - 37, top: y - 15 });
      }

      if (tool === "hurdle") {
        object = new Rect({
          left: x - 20,
          top: y - 5,
          width: 40,
          height: 10,
          fill: "#8B4513",
          stroke: "#5D3A0A",
          strokeWidth: 2,
          rx: 3,
          ry: 3,
        });
      }

      if (tool === "pole") {
        object = new Circle({
          left: x - 5,
          top: y - 5,
          radius: 5,
          fill: "#6B7280",
          stroke: "#4B5563",
          strokeWidth: 2,
        });
      }

      if (tool === "goal-small") {
        object = new Rect({
          left: x - 25,
          top: y - 15,
          width: 50,
          height: 30,
          fill: "transparent",
          stroke: "#FFFFFF",
          strokeWidth: 3,
        });
      }

      if (tool === "arrow") {
        const body = new Line([0, 0, 60, 0], { stroke: "#10B981", strokeWidth: 3 });
        const head = new Triangle({
          left: 58,
          top: -6,
          width: 12,
          height: 12,
          fill: "#10B981",
          angle: 90,
        });
        object = new Group([body, head], { left: x - 30, top: y });
      }

      if (tool === "zone") {
        object = new Rect({
          left: x - 40,
          top: y - 30,
          width: 80,
          height: 60,
          fill: "rgba(59, 130, 246, 0.3)",
          stroke: "#3B82F6",
          strokeWidth: 2,
          rx: 6,
          ry: 6,
        });
      }

      if (tool === "text") {
        const value = (opts.text || "").trim() || "Texto";
        object = new Text(value, {
          left: x,
          top: y,
          fontSize: 18,
          fill: "#FFFFFF",
          fontFamily: "Arial",
          fontWeight: "bold",
          stroke: "#000000",
          strokeWidth: 0.5,
        });
      }

      if (!object) return;

      object.selectable = true;
      object.evented = true;

      fabricCanvas.add(object);
      fabricCanvas.setActiveObject(object);
      fabricCanvas.renderAll();
      saveState(fabricCanvas);
    },
    [fabricCanvas, saveState]
  );

  useEffect(() => {
    if (!fabricCanvas) return;

    const handleMouseDown = (e: any) => {
      const tool = activeToolRef.current;
      if (!tool) return;

      // Allow placing on empty field or on non-interactive markings
      if (e?.target && e.target.selectable) return;

      const pointer = fabricCanvas.getPointer(e.e);
      addEquipment(tool, pointer.x, pointer.y, {
        playerColor: playerColorRef.current,
        coneColor: coneColorRef.current,
        text: textInputRef.current,
      });
    };

    fabricCanvas.on("mouse:down", handleMouseDown);
    return () => {
      fabricCanvas.off("mouse:down", handleMouseDown);
    };
  }, [addEquipment, fabricCanvas]);

  const deleteSelected = useCallback(() => {
    if (!fabricCanvas) return;
    const active = fabricCanvas.getActiveObject();
    if (active && active.selectable) {
      fabricCanvas.remove(active);
      fabricCanvas.renderAll();
      saveState(fabricCanvas);
    }
  }, [fabricCanvas, saveState]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        if ((document.activeElement as HTMLElement | null)?.tagName !== "INPUT") {
          deleteSelected();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [deleteSelected]);

  const clearEquipment = () => {
    if (!fabricCanvas) return;
    const objects = fabricCanvas.getObjects();
    objects.forEach((obj) => {
      if (obj.selectable) fabricCanvas.remove(obj);
    });
    fabricCanvas.renderAll();
    saveState(fabricCanvas);
    toast.success("Campo limpo");
  };

  const exportImage = () => {
    if (!fabricCanvas) return;
    const dataUrl = fabricCanvas.toDataURL({ format: "png", quality: 1, multiplier: 2 });

    if (onSave) {
      onSave(dataUrl);
      toast.success("Diagrama guardado");
      return;
    }

    const link = document.createElement("a");
    link.download = `treino-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
    toast.success("Imagem exportada");
  };

  const undo = () => {
    if (historyIndex <= 0 || !fabricCanvas) return;
    const newIndex = historyIndex - 1;
    fabricCanvas.loadFromJSON(JSON.parse(history[newIndex])).then(() => {
      fabricCanvas.renderAll();
      setHistoryIndex(newIndex);
    });
  };

  const redo = () => {
    if (historyIndex >= history.length - 1 || !fabricCanvas) return;
    const newIndex = historyIndex + 1;
    fabricCanvas.loadFromJSON(JSON.parse(history[newIndex])).then(() => {
      fabricCanvas.renderAll();
      setHistoryIndex(newIndex);
    });
  };

  const selectedLabel = useMemo(() => {
    if (!activeTool) return null;
    if (activeTool === "player") return `${toolLabels.player} (${playerColor})`;
    if (activeTool === "cone") return `${toolLabels.cone} (${coneColor})`;
    return toolLabels[activeTool];
  }, [activeTool, coneColor, playerColor]);

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <CardTitle className="text-lg">Editor Visual de Treino</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={undo} disabled={historyIndex <= 0}>
              <Undo2 className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={redo} disabled={historyIndex >= history.length - 1}>
              <Redo2 className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={deleteSelected}>
              <Trash2 className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={clearEquipment}>
              <RotateCcw className="w-4 h-4" />
            </Button>
            <Button size="sm" onClick={exportImage}>
              <Download className="w-4 h-4 mr-1" />
              Guardar
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-3 p-3 bg-muted rounded-lg">
          {/* Players */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-medium w-20">Jogador:</span>
            <div className="flex gap-2">
              {(Object.keys(PLAYER_COLORS) as PlayerColor[]).map((key) => {
                const isSelected = activeTool === "player" && playerColor === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setPlayerColor(key);
                      setActiveTool("player");
                    }}
                    className={`w-9 h-9 rounded-full border-2 transition-all flex items-center justify-center ${
                      isSelected ? "ring-2 ring-offset-2 ring-primary scale-110" : "hover:scale-105"
                    }`}
                    style={{ backgroundColor: PLAYER_COLORS[key] }}
                    title={`Jogador ${key}`}
                  >
                    <span className="text-white text-xs font-bold">J</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cones */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-medium w-20">Cone:</span>
            <div className="flex gap-2">
              {(Object.keys(CONE_COLORS) as ConeColor[]).map((key) => {
                const isSelected = activeTool === "cone" && coneColor === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setConeColor(key);
                      setActiveTool("cone");
                    }}
                    className={`w-9 h-9 rounded-full border-2 transition-all flex items-center justify-center ${
                      isSelected ? "ring-2 ring-offset-2 ring-primary scale-110" : "hover:scale-105"
                    }`}
                    style={{ backgroundColor: CONE_COLORS[key] }}
                    title={`Cone ${key}`}
                  >
                    <Square className="w-3.5 h-3.5 text-white" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Other tools */}
          <div className="flex flex-wrap gap-2 pt-2 border-t">
            <Button
              variant={activeTool === "ball" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTool((prev) => (prev === "ball" ? null : "ball"))}
              className="flex flex-col gap-1 h-auto py-2 px-3"
            >
              <CircleIcon className="w-4 h-4" />
              <span className="text-xs">Bola</span>
            </Button>

            <Button
              variant={activeTool === "ladder" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTool((prev) => (prev === "ladder" ? null : "ladder"))}
              className="flex flex-col gap-1 h-auto py-2 px-3"
            >
              <Square className="w-4 h-4" />
              <span className="text-xs">Escada</span>
            </Button>

            <Button
              variant={activeTool === "hurdle" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTool((prev) => (prev === "hurdle" ? null : "hurdle"))}
              className="flex flex-col gap-1 h-auto py-2 px-3"
            >
              <Square className="w-4 h-4" />
              <span className="text-xs">Barreira</span>
            </Button>

            <Button
              variant={activeTool === "pole" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTool((prev) => (prev === "pole" ? null : "pole"))}
              className="flex flex-col gap-1 h-auto py-2 px-3"
            >
              <CircleIcon className="w-4 h-4" />
              <span className="text-xs">Poste</span>
            </Button>

            <Button
              variant={activeTool === "goal-small" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTool((prev) => (prev === "goal-small" ? null : "goal-small"))}
              className="flex flex-col gap-1 h-auto py-2 px-3"
            >
              <Target className="w-4 h-4" />
              <span className="text-xs">Baliza</span>
            </Button>

            <Button
              variant={activeTool === "arrow" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTool((prev) => (prev === "arrow" ? null : "arrow"))}
              className="flex flex-col gap-1 h-auto py-2 px-3"
            >
              <ArrowRight className="w-4 h-4" />
              <span className="text-xs">Seta</span>
            </Button>

            <Button
              variant={activeTool === "zone" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTool((prev) => (prev === "zone" ? null : "zone"))}
              className="flex flex-col gap-1 h-auto py-2 px-3"
            >
              <Square className="w-4 h-4" />
              <span className="text-xs">Zona</span>
            </Button>

            <Button
              variant={activeTool === "text" ? "default" : "outline"}
              size="sm"
              onClick={() =>
                setActiveTool((prev) => {
                  const next = prev === "text" ? null : "text";
                  activeToolRef.current = next;
                  return next;
                })
              }
              className="flex flex-col gap-1 h-auto py-2 px-3"
            >
              <Type className="w-4 h-4" />
              <span className="text-xs">Texto</span>
            </Button>
          </div>

          {activeTool === "text" && (
            <div className="flex items-center gap-2 pt-2 border-t">
              <span className="text-sm font-medium">Texto:</span>
              <Input
                value={textInput}
                onChange={(e) => {
                  const v = e.target.value;
                  textInputRef.current = v;
                  setTextInput(v);
                }}
                placeholder="Digite o texto..."
                className="max-w-xs"
              />
            </div>
          )}
        </div>

        {selectedLabel && (
          <p className="text-sm text-muted-foreground text-center">
            Clique no campo para adicionar: <strong>{selectedLabel}</strong>
          </p>
        )}

        <div className="flex justify-center overflow-auto border rounded-lg bg-background p-2">
          <canvas ref={canvasRef} className="rounded shadow-lg cursor-crosshair" />
        </div>

        <p className="text-xs text-muted-foreground text-center">Arraste os elementos para os posicionar. Selecione um elemento e pressione Delete para remover.</p>
      </CardContent>
    </Card>
  );
}
