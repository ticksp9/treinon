import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Canvas as FabricCanvas, Circle, Line, Rect, FabricText, Group, FabricObject, PencilBrush } from "fabric";
import {
  Trash2,
  Download,
  Move,
  Pencil,
  RotateCcw,
  ArrowRight,
  Users,
  Hand,
} from "lucide-react";
import { toast } from "sonner";

type SportType = "football_11" | "football_7" | "football_5" | "futsal";
type DrawMode = "select" | "draw" | "arrow" | "freehand";
type PreferredSport = "football" | "futsal" | "both";

interface ExtendedFabricObject extends FabricObject {
  customData?: { type: string; team?: string; number?: number };
}

const SPORT_CONFIG = {
  football_11: { label: "Futebol 11", players: 11, sport: "football" as PreferredSport },
  football_7: { label: "Futebol 7", players: 7, sport: "football" as PreferredSport },
  football_5: { label: "Futebol 5", players: 5, sport: "football" as PreferredSport },
  futsal: { label: "Futsal", players: 5, sport: "futsal" as PreferredSport },
};

const PLAYER_COLORS = {
  team1: "#22c55e", // green
  team2: "#ef4444", // red
};

export default function TacticalBoard() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  const [sportType, setSportType] = useState<SportType | null>(null);
  const [preferredSport, setPreferredSport] = useState<PreferredSport | null>(null);
  const [drawMode, setDrawMode] = useState<DrawMode>("select");
  const [lineColor, setLineColor] = useState("#ffffff");
  const [lineType, setLineType] = useState<"solid" | "dashed">("solid");
  const [showArrows, setShowArrows] = useState(true);
  const playersRef = useRef<(Group & ExtendedFabricObject)[]>([]);
  const isDrawingRef = useRef(false);
  const startPointRef = useRef<{ x: number; y: number } | null>(null);
  const currentLineRef = useRef<Line | null>(null);
  

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  // Fetch user's preferred sport
  useEffect(() => {
    const fetchPreferredSport = async () => {
      if (!user) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("preferred_sport")
        .eq("id", user.id)
        .single();

      if (data && !error) {
        const sport = data.preferred_sport as PreferredSport;
        setPreferredSport(sport);
        // Set default sport type based on preference
        if (sport === "futsal") {
          setSportType("futsal");
        } else {
          setSportType("football_11");
        }
      } else {
        // Default to football if no preference
        setPreferredSport("football");
        setSportType("football_11");
      }
    };

    fetchPreferredSport();
  }, [user]);

  // Get filtered sport options based on preferred sport
  const getFilteredSportOptions = () => {
    if (!preferredSport) return [];
    
    return Object.entries(SPORT_CONFIG)
      .filter(([_, config]) => preferredSport === "both" || config.sport === preferredSport)
      .map(([key, config]) => ({ key: key as SportType, ...config }));
  };

  // Function to draw field - defined before useEffects
  const drawFieldOnCanvas = (canvas: FabricCanvas, sport: SportType, width: number, height: number) => {
    const isFutsal = sport === "futsal";
    const padding = 30;
    const fieldWidth = width - padding * 2;
    const fieldHeight = height - padding * 2;

    // Different background color for futsal
    canvas.backgroundColor = isFutsal ? "#2d5a3d" : "#1a472a";

    // Field outline
    const fieldRect = new Rect({
      left: padding,
      top: padding,
      width: fieldWidth,
      height: fieldHeight,
      fill: "transparent",
      stroke: "#ffffff",
      strokeWidth: 2,
      selectable: false,
      evented: false,
    });
    canvas.add(fieldRect);

    // Center line
    const centerLine = new Line(
      [width / 2, padding, width / 2, height - padding],
      {
        stroke: "#ffffff",
        strokeWidth: 2,
        selectable: false,
        evented: false,
      }
    );
    canvas.add(centerLine);

    // Center circle - smaller for futsal
    const centerRadius = isFutsal ? 35 : 60;
    const centerCircle = new Circle({
      left: width / 2 - centerRadius,
      top: height / 2 - centerRadius,
      radius: centerRadius,
      fill: "transparent",
      stroke: "#ffffff",
      strokeWidth: 2,
      selectable: false,
      evented: false,
    });
    canvas.add(centerCircle);

    // Center dot
    const centerDot = new Circle({
      left: width / 2 - 4,
      top: height / 2 - 4,
      radius: 4,
      fill: "#ffffff",
      selectable: false,
      evented: false,
    });
    canvas.add(centerDot);

    if (isFutsal) {
      // Futsal has semi-circular penalty areas
      const penaltyRadius = fieldHeight * 0.28;
      
      // Left penalty area (semi-circle)
      const leftPenalty = new Circle({
        left: padding - penaltyRadius,
        top: height / 2 - penaltyRadius,
        radius: penaltyRadius,
        fill: "transparent",
        stroke: "#ffffff",
        strokeWidth: 2,
        selectable: false,
        evented: false,
      });
      canvas.add(leftPenalty);

      // Right penalty area (semi-circle)
      const rightPenalty = new Circle({
        left: width - padding - penaltyRadius,
        top: height / 2 - penaltyRadius,
        radius: penaltyRadius,
        fill: "transparent",
        stroke: "#ffffff",
        strokeWidth: 2,
        selectable: false,
        evented: false,
      });
      canvas.add(rightPenalty);

      // Penalty spots for futsal (6m)
      const penaltySpotDist = fieldWidth * 0.07;
      
      const leftSpot = new Circle({
        left: padding + penaltySpotDist - 3,
        top: height / 2 - 3,
        radius: 3,
        fill: "#ffffff",
        selectable: false,
        evented: false,
      });
      canvas.add(leftSpot);

      const rightSpot = new Circle({
        left: width - padding - penaltySpotDist - 3,
        top: height / 2 - 3,
        radius: 3,
        fill: "#ffffff",
        selectable: false,
        evented: false,
      });
      canvas.add(rightSpot);

      // Second penalty spots (10m)
      const secondSpotDist = fieldWidth * 0.12;
      
      const leftSecondSpot = new Circle({
        left: padding + secondSpotDist - 3,
        top: height / 2 - 3,
        radius: 3,
        fill: "#ffffff",
        selectable: false,
        evented: false,
      });
      canvas.add(leftSecondSpot);

      const rightSecondSpot = new Circle({
        left: width - padding - secondSpotDist - 3,
        top: height / 2 - 3,
        radius: 3,
        fill: "#ffffff",
        selectable: false,
        evented: false,
      });
      canvas.add(rightSecondSpot);

      // Substitution zones
      const subZoneWidth = 5;
      const subZoneLength = fieldHeight * 0.15;
      
      // Top substitution zone
      const topSubZone = new Line(
        [width / 2 - subZoneLength, padding - 10, width / 2 + subZoneLength, padding - 10],
        {
          stroke: "#ff0000",
          strokeWidth: 3,
          selectable: false,
          evented: false,
        }
      );
      canvas.add(topSubZone);

    } else {
      // Football penalty areas (rectangular)
      const penaltyWidth = fieldWidth * 0.16;
      const penaltyHeight = fieldHeight * 0.5;

      // Left penalty area
      const leftPenalty = new Rect({
        left: padding,
        top: height / 2 - penaltyHeight / 2,
        width: penaltyWidth,
        height: penaltyHeight,
        fill: "transparent",
        stroke: "#ffffff",
        strokeWidth: 2,
        selectable: false,
        evented: false,
      });
      canvas.add(leftPenalty);

      // Right penalty area
      const rightPenalty = new Rect({
        left: width - padding - penaltyWidth,
        top: height / 2 - penaltyHeight / 2,
        width: penaltyWidth,
        height: penaltyHeight,
        fill: "transparent",
        stroke: "#ffffff",
        strokeWidth: 2,
        selectable: false,
        evented: false,
      });
      canvas.add(rightPenalty);

      // Goal areas (smaller boxes)
      const goalWidth = penaltyWidth * 0.4;
      const goalHeight = penaltyHeight * 0.5;

      const leftGoal = new Rect({
        left: padding,
        top: height / 2 - goalHeight / 2,
        width: goalWidth,
        height: goalHeight,
        fill: "transparent",
        stroke: "#ffffff",
        strokeWidth: 2,
        selectable: false,
        evented: false,
      });
      canvas.add(leftGoal);

      const rightGoal = new Rect({
        left: width - padding - goalWidth,
        top: height / 2 - goalHeight / 2,
        width: goalWidth,
        height: goalHeight,
        fill: "transparent",
        stroke: "#ffffff",
        strokeWidth: 2,
        selectable: false,
        evented: false,
      });
      canvas.add(rightGoal);

      // Penalty spots
      const penaltySpotDist = penaltyWidth * 0.7;
      
      const leftSpot = new Circle({
        left: padding + penaltySpotDist - 3,
        top: height / 2 - 3,
        radius: 3,
        fill: "#ffffff",
        selectable: false,
        evented: false,
      });
      canvas.add(leftSpot);

      const rightSpot = new Circle({
        left: width - padding - penaltySpotDist - 3,
        top: height / 2 - 3,
        radius: 3,
        fill: "#ffffff",
        selectable: false,
        evented: false,
      });
      canvas.add(rightSpot);

      // Corner arcs
      const cornerRadius = 15;
      
      const tlCorner = new Circle({
        left: padding - cornerRadius,
        top: padding - cornerRadius,
        radius: cornerRadius,
        fill: "transparent",
        stroke: "#ffffff",
        strokeWidth: 2,
        selectable: false,
        evented: false,
      });
      canvas.add(tlCorner);

      const trCorner = new Circle({
        left: width - padding - cornerRadius,
        top: padding - cornerRadius,
        radius: cornerRadius,
        fill: "transparent",
        stroke: "#ffffff",
        strokeWidth: 2,
        selectable: false,
        evented: false,
      });
      canvas.add(trCorner);

      const blCorner = new Circle({
        left: padding - cornerRadius,
        top: height - padding - cornerRadius,
        radius: cornerRadius,
        fill: "transparent",
        stroke: "#ffffff",
        strokeWidth: 2,
        selectable: false,
        evented: false,
      });
      canvas.add(blCorner);

      const brCorner = new Circle({
        left: width - padding - cornerRadius,
        top: height - padding - cornerRadius,
        radius: cornerRadius,
        fill: "transparent",
        stroke: "#ffffff",
        strokeWidth: 2,
        selectable: false,
        evented: false,
      });
      canvas.add(brCorner);
    }

    canvas.renderAll();
  };

  // Initialize and update canvas when sportType changes
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current || !sportType) return;
    
    // Dispose previous canvas if exists
    if (fabricCanvas) {
      fabricCanvas.dispose();
    }

    const container = containerRef.current;
    const width = Math.min(container.clientWidth - 32, 900);
    const height = width * 0.65;

    const canvas = new FabricCanvas(canvasRef.current, {
      width,
      height,
      backgroundColor: "#1a472a",
      selection: true,
      allowTouchScrolling: false,
    });

    // Enable touch support for mobile/tablet
    if (canvas.upperCanvasEl) {
      canvas.upperCanvasEl.style.touchAction = 'none';
    }
    if (canvas.lowerCanvasEl) {
      canvas.lowerCanvasEl.style.touchAction = 'none';
    }

    // Initialize freeDrawingBrush
    canvas.freeDrawingBrush = new PencilBrush(canvas);
    canvas.freeDrawingBrush.color = "#ffffff";
    canvas.freeDrawingBrush.width = 4;

    drawFieldOnCanvas(canvas, sportType, width, height);
    setFabricCanvas(canvas);
    playersRef.current = [];

    return () => {
      canvas.dispose();
    };
  }, [sportType]); // Only depend on sportType, not fabricCanvas

  // Handle draw mode
  useEffect(() => {
    if (!fabricCanvas) return;

    // Enable freehand drawing mode
    if (drawMode === "freehand") {
      fabricCanvas.isDrawingMode = true;
      // Check if freeDrawingBrush exists before setting properties
      if (fabricCanvas.freeDrawingBrush) {
        fabricCanvas.freeDrawingBrush.color = lineColor;
        fabricCanvas.freeDrawingBrush.width = 4;
        if (lineType === "dashed") {
          fabricCanvas.freeDrawingBrush.strokeDashArray = [10, 5];
        } else {
          fabricCanvas.freeDrawingBrush.strokeDashArray = [];
        }
      }
      fabricCanvas.selection = false;
    } else {
      fabricCanvas.isDrawingMode = false;
      fabricCanvas.selection = drawMode === "select";
    }

    // Set all objects selectable based on mode
    fabricCanvas.getObjects().forEach((obj) => {
      const extObj = obj as ExtendedFabricObject;
      if (extObj.customData?.type === "player") {
        obj.selectable = drawMode === "select";
        obj.evented = drawMode === "select";
      } else if (extObj.customData?.type === "drawnLine" || extObj.customData?.type === "arrow" || extObj.customData?.type === "freehand") {
        obj.selectable = drawMode === "select";
        obj.evented = drawMode === "select";
      } else {
        obj.selectable = false;
        obj.evented = false;
      }
    });

    fabricCanvas.renderAll();
  }, [drawMode, lineColor, lineType, fabricCanvas]);

  // Mark freehand paths with customData
  useEffect(() => {
    if (!fabricCanvas) return;

    const handlePathCreated = (e: any) => {
      if (e.path) {
        (e.path as ExtendedFabricObject).customData = { type: "freehand" };
      }
    };

    fabricCanvas.on("path:created", handlePathCreated);

    return () => {
      fabricCanvas.off("path:created", handlePathCreated);
    };
  }, [fabricCanvas]);

  // Mouse events for drawing lines/arrows
  useEffect(() => {
    if (!fabricCanvas) return;

    const handleMouseDown = (opt: any) => {
      if (drawMode !== "draw" && drawMode !== "arrow") return;

      const pointer = fabricCanvas.getViewportPoint(opt.e);
      isDrawingRef.current = true;
      startPointRef.current = { x: pointer.x, y: pointer.y };

      const line = new Line(
        [pointer.x, pointer.y, pointer.x, pointer.y],
        {
          stroke: lineColor,
          strokeWidth: 3,
          selectable: false,
          evented: false,
          strokeDashArray: lineType === "dashed" ? [10, 5] : undefined,
        }
      ) as Line & ExtendedFabricObject;
      line.customData = { type: drawMode === "arrow" ? "arrow" : "drawnLine" };
      currentLineRef.current = line;
      fabricCanvas.add(line);
    };

    const handleMouseMove = (opt: any) => {
      if (!isDrawingRef.current || !startPointRef.current || !currentLineRef.current) return;

      const pointer = fabricCanvas.getViewportPoint(opt.e);
      currentLineRef.current.set({
        x2: pointer.x,
        y2: pointer.y,
      });
      fabricCanvas.renderAll();
    };

    const handleMouseUp = (opt: any) => {
      if (!isDrawingRef.current || !startPointRef.current || !currentLineRef.current) return;

      const pointer = fabricCanvas.getViewportPoint(opt.e);
      
      // Add arrowhead if arrow mode
      if (drawMode === "arrow" && showArrows) {
        const startX = startPointRef.current.x;
        const startY = startPointRef.current.y;
        const endX = pointer.x;
        const endY = pointer.y;
        
        const angle = Math.atan2(endY - startY, endX - startX);
        const headLength = 15;
        
        const arrowHead1 = new Line(
          [
            endX,
            endY,
            endX - headLength * Math.cos(angle - Math.PI / 6),
            endY - headLength * Math.sin(angle - Math.PI / 6),
          ],
          {
            stroke: lineColor,
            strokeWidth: 3,
            selectable: false,
            evented: false,
          }
        ) as Line & ExtendedFabricObject;
        arrowHead1.customData = { type: "arrow" };

        const arrowHead2 = new Line(
          [
            endX,
            endY,
            endX - headLength * Math.cos(angle + Math.PI / 6),
            endY - headLength * Math.sin(angle + Math.PI / 6),
          ],
          {
            stroke: lineColor,
            strokeWidth: 3,
            selectable: false,
            evented: false,
          }
        ) as Line & ExtendedFabricObject;
        arrowHead2.customData = { type: "arrow" };

        fabricCanvas.add(arrowHead1);
        fabricCanvas.add(arrowHead2);
      }

      currentLineRef.current.selectable = true;
      currentLineRef.current.evented = true;
      
      isDrawingRef.current = false;
      startPointRef.current = null;
      currentLineRef.current = null;
      fabricCanvas.renderAll();
    };

    fabricCanvas.on("mouse:down", handleMouseDown);
    fabricCanvas.on("mouse:move", handleMouseMove);
    fabricCanvas.on("mouse:up", handleMouseUp);

    return () => {
      fabricCanvas.off("mouse:down", handleMouseDown);
      fabricCanvas.off("mouse:move", handleMouseMove);
      fabricCanvas.off("mouse:up", handleMouseUp);
    };
  }, [fabricCanvas, drawMode, lineColor, lineType, showArrows]);

  const addPlayer = (team: "team1" | "team2", number: number) => {
    if (!fabricCanvas || !sportType) return;

    const color = PLAYER_COLORS[team];
    const canvasWidth = fabricCanvas.getWidth();
    const canvasHeight = fabricCanvas.getHeight();

    // Position based on team
    const x = team === "team1" ? canvasWidth * 0.25 : canvasWidth * 0.75;
    const y = canvasHeight / 2 + (number - Math.ceil(SPORT_CONFIG[sportType].players / 2)) * 40;

    const circle = new Circle({
      radius: 18,
      fill: color,
      stroke: "#ffffff",
      strokeWidth: 2,
      originX: "center",
      originY: "center",
    });

    const text = new FabricText(String(number), {
      fontSize: 14,
      fontWeight: "bold",
      fill: "#ffffff",
      originX: "center",
      originY: "center",
    });

    const group = new Group([circle, text], {
      left: x,
      top: y,
      selectable: true,
      hasControls: false,
      hasBorders: true,
      lockRotation: true,
      lockScalingX: true,
      lockScalingY: true,
    }) as Group & ExtendedFabricObject;

    group.customData = { type: "player", team, number };
    playersRef.current.push(group);
    fabricCanvas.add(group);
    fabricCanvas.renderAll();
  };

  const addAllPlayers = (team: "team1" | "team2") => {
    if (!sportType) return;
    const playerCount = SPORT_CONFIG[sportType].players;
    for (let i = 1; i <= playerCount; i++) {
      addPlayer(team, i);
    }
    toast.success(`${playerCount} jogadores adicionados`);
  };

  const clearDrawings = () => {
    if (!fabricCanvas) return;

    const objectsToRemove = fabricCanvas.getObjects().filter((obj) => {
      const extObj = obj as ExtendedFabricObject;
      return extObj.customData?.type === "drawnLine" || extObj.customData?.type === "arrow" || extObj.customData?.type === "freehand";
    });
    objectsToRemove.forEach((obj) => fabricCanvas.remove(obj));
    fabricCanvas.renderAll();
    toast.success("Desenhos limpos");
  };

  const clearAll = () => {
    if (!fabricCanvas || !containerRef.current || !sportType) return;

    const container = containerRef.current;
    const width = Math.min(container.clientWidth - 32, 900);
    const height = width * 0.65;

    fabricCanvas.clear();
    drawFieldOnCanvas(fabricCanvas, sportType, width, height);
    playersRef.current = [];
    fabricCanvas.renderAll();
    toast.success("Quadro limpo");
  };

  const downloadImage = () => {
    if (!fabricCanvas) return;

    const dataURL = fabricCanvas.toDataURL({
      format: "png",
      quality: 1,
      multiplier: 2,
    });

    const link = document.createElement("a");
    link.download = `quadro-tatico-${sportType}.png`;
    link.href = dataURL;
    link.click();
    toast.success("Imagem descarregada");
  };

  if (authLoading || !preferredSport || !sportType) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-primary">A carregar...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const currentSportConfig = SPORT_CONFIG[sportType];

  return (
    <AppLayout title="Quadro Tático">
      <div className="space-y-4">
        {/* Controls */}
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-4 items-center justify-between">
              {/* Sport Type */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Tipo:</span>
                <Select value={sportType || ""} onValueChange={(v) => setSportType(v as SportType)}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Selecionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {getFilteredSportOptions().map((option) => (
                      <SelectItem key={option.key} value={option.key}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Tools */}
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant={drawMode === "select" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDrawMode("select")}
                >
                  <Move className="w-4 h-4 mr-1" />
                  Mover
                </Button>
                <Button
                  variant={drawMode === "freehand" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDrawMode("freehand")}
                >
                  <Hand className="w-4 h-4 mr-1" />
                  Desenho Livre
                </Button>
                <Button
                  variant={drawMode === "draw" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDrawMode("draw")}
                >
                  <Pencil className="w-4 h-4 mr-1" />
                  Linha
                </Button>
                <Button
                  variant={drawMode === "arrow" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDrawMode("arrow")}
                >
                  <ArrowRight className="w-4 h-4 mr-1" />
                  Seta
                </Button>
              </div>

              {/* Line options */}
              {(drawMode === "draw" || drawMode === "arrow" || drawMode === "freehand") && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">Cor:</span>
                  <div className="flex gap-1">
                    {["#ffffff", "#ffff00", "#ff0000", "#00ff00", "#00ffff"].map((color) => (
                      <button
                        key={color}
                        className={`w-6 h-6 rounded-full border-2 ${
                          lineColor === color ? "border-primary" : "border-transparent"
                        }`}
                        style={{ backgroundColor: color }}
                        onClick={() => setLineColor(color)}
                      />
                    ))}
                  </div>
                  <Button
                    variant={lineType === "solid" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setLineType("solid")}
                  >
                    ───
                  </Button>
                  <Button
                    variant={lineType === "dashed" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setLineType("dashed")}
                  >
                    - - -
                  </Button>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={clearDrawings}>
                  <RotateCcw className="w-4 h-4 mr-1" />
                  Limpar linhas
                </Button>
                <Button variant="outline" size="sm" onClick={clearAll}>
                  <Trash2 className="w-4 h-4 mr-1" />
                  Limpar tudo
                </Button>
                <Button variant="outline" size="sm" onClick={downloadImage}>
                  <Download className="w-4 h-4 mr-1" />
                  Exportar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Players Panel */}
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <span className="text-sm font-medium shrink-0">Jogadores:</span>
              
              {/* Team 1 - Green */}
              <div className="flex items-center gap-2 p-2 rounded-lg bg-green-500/10 border border-green-500/30">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addAllPlayers("team1")}
                  className="shrink-0 h-8"
                >
                  <Users className="w-4 h-4 mr-1" />
                  Todos
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: currentSportConfig.players }, (_, i) => i + 1).map((num) => (
                    <button
                      key={num}
                      className="w-7 h-7 rounded-full text-xs font-bold text-white flex items-center justify-center hover:scale-110 transition-transform shadow-md"
                      style={{ backgroundColor: PLAYER_COLORS.team1 }}
                      onClick={() => addPlayer("team1", num)}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              {/* Team 2 - Red */}
              <div className="flex items-center gap-2 p-2 rounded-lg bg-red-500/10 border border-red-500/30">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addAllPlayers("team2")}
                  className="shrink-0 h-8"
                >
                  <Users className="w-4 h-4 mr-1" />
                  Todos
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: currentSportConfig.players }, (_, i) => i + 1).map((num) => (
                    <button
                      key={num}
                      className="w-7 h-7 rounded-full text-xs font-bold text-white flex items-center justify-center hover:scale-110 transition-transform shadow-md"
                      style={{ backgroundColor: PLAYER_COLORS.team2 }}
                      onClick={() => addPlayer("team2", num)}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Canvas */}
        <Card className="border-border/50 overflow-hidden touch-none">
          <CardContent className="p-4" ref={containerRef}>
            <canvas 
              ref={canvasRef} 
              className="rounded-lg shadow-lg mx-auto block touch-none" 
              style={{ touchAction: 'none' }}
            />
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card className="border-border/50 bg-muted/30">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">
              <strong>Instruções:</strong> Selecione o tipo de campo, adicione jogadores das equipas verde ou vermelha, 
              use "Desenho Livre" para desenhar com o dedo em tablets/telemóveis, ou use "Linha/Seta" para movimentos retos. 
              Arraste os jogadores para os posicionar. Clique em "Exportar" para guardar a imagem.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
