import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useHydrated } from "@tanstack/react-router";
import {
  ArrowLeftRight,
  Braces,
  CandlestickChart,
  ChartLine,
  ChartSpline,
  Expand,
  Focus,
  Grid3X3,
  Layers,
  Maximize,
  Minus,
  MousePointer2,
  Plus,
  Shrink,
  Trash2,
  TrendingUp,
} from "lucide-react";
import type { Candle, Quote, Timeframe } from "@/lib/market-types";
import { formatPrice } from "@/lib/instruments";
import {
  sma,
  ema,
  rsi,
  macd,
  bollinger,
  vwap,
  stochastic,
  atr,
  heikinAshi,
} from "@/lib/indicators";
import { cn } from "@/lib/utils";

export type ChartOverlay = {
  price: number;
  label: string;
  tone: "bull" | "bear";
  style: "dotted" | "dashed";
};

export type ChartType = "candlestick" | "hollow" | "heikin" | "line" | "area" | "bars";

export type IndicatorKey =
  | "sma20"
  | "sma50"
  | "ema7"
  | "ema25"
  | "ema99"
  | "ema12"
  | "ema26"
  | "rsi"
  | "macd"
  | "bollinger"
  | "vwap"
  | "stochastic"
  | "atr"
  | "volume";

type IndicatorDef = {
  key: IndicatorKey;
  label: string;
  pane?: "main" | "lower";
  color?: string;
};

const INDICATORS: IndicatorDef[] = [
  { key: "sma20", label: "SMA 20", pane: "main", color: "#F59E0B" },
  { key: "sma50", label: "SMA 50", pane: "main", color: "#8B5CF6" },
  { key: "ema7", label: "EMA 7", pane: "main", color: "#F0B90B" },
  { key: "ema25", label: "EMA 25", pane: "main", color: "#E377C2" },
  { key: "ema99", label: "EMA 99", pane: "main", color: "#8C6CF7" },
  { key: "ema12", label: "EMA 12", pane: "main", color: "#06B6D4" },
  { key: "ema26", label: "EMA 26", pane: "main", color: "#EC4899" },
  { key: "bollinger", label: "Bollinger", pane: "main" },
  { key: "vwap", label: "VWAP", pane: "main", color: "#F97316" },
  { key: "atr", label: "ATR", pane: "main", color: "#64748B" },
  { key: "volume", label: "Volume", pane: "lower" },
  { key: "rsi", label: "RSI", pane: "lower" },
  { key: "macd", label: "MACD", pane: "lower" },
  { key: "stochastic", label: "Stochastic", pane: "lower" },
];

const CHART_TYPES: { key: ChartType; label: string; icon: React.ElementType }[] = [
  { key: "candlestick", label: "Candles", icon: CandlestickChart },
  { key: "hollow", label: "Hollow", icon: CandlestickChart },
  { key: "heikin", label: "Heikin Ashi", icon: Grid3X3 },
  { key: "bars", label: "Bars", icon: Braces },
  { key: "line", label: "Line", icon: ChartLine },
  { key: "area", label: "Area", icon: ChartSpline },
];

const VISIBLE_TIMEFRAMES: Timeframe[] = ["1s", "1m", "5m", "15m", "1h", "4h", "1d", "1w"];

const TIMEFRAME_LABELS: Record<Timeframe, string> = {
  "1s": "1s",
  "1m": "1m",
  "3m": "3m",
  "5m": "5m",
  "15m": "15m",
  "30m": "30m",
  "1h": "1H",
  "2h": "2H",
  "4h": "4H",
  "6h": "6H",
  "12h": "12H",
  "1d": "1D",
  "1w": "1W",
  "1M": "1M",
};

type Point = { time: number; price: number };

type Drawing =
  | { id: string; type: "trend"; a: Point; b: Point }
  | { id: string; type: "horizontal"; a: Point }
  | { id: string; type: "fib"; a: Point; b: Point }
  | { id: string; type: "rect"; a: Point; b: Point };

type DrawingInput =
  | { type: "trend"; a: Point; b: Point }
  | { type: "horizontal"; a: Point }
  | { type: "fib"; a: Point; b: Point }
  | { type: "rect"; a: Point; b: Point };

type DrawingMode = Drawing["type"] | null;

type themeColors = {
  background: string;
  foreground: string;
  grid: string;
  border: string;
  bull: string;
  bear: string;
  primary: string;
};

function gammaCorrect(c: number): number {
  if (c <= 0.0031308) return c * 12.92;
  return 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

function parseOklchNumber(value: string): number {
  const num = Number(value.replace("%", ""));
  return value.includes("%") ? num / 100 : num;
}

function oklchToRgb(color: string): string | null {
  const m = color.match(/oklch\(\s*([\d.]+%?)\s+([\d.]+%?)\s+([\d.]+(?:deg)?)\s*\)/i);
  if (!m) return null;
  const L = parseOklchNumber(m[1]);
  const C = parseOklchNumber(m[2]);
  const H = (Number(m[3].replace("deg", "")) * Math.PI) / 180;
  const a = C * Math.cos(H);
  const b = C * Math.sin(H);

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613455 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ * l_ * l_;
  const mn = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  const X = 1.227013851 * l - 0.557799288 * mn + 0.281256149 * s;
  const Y = -0.040580178 * l + 1.112256869 * mn - 0.071711678 * s;
  const Z = -0.076381285 * l - 0.421481978 * mn + 1.58616322 * s;

  const rLin = 3.2404542 * X - 1.5371385 * Y - 0.4985314 * Z;
  const gLin = -0.969266 * X + 1.8760108 * Y + 0.041556 * Z;
  const bLin = 0.0556434 * X - 0.2040259 * Y + 1.0572252 * Z;

  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  const r = Math.round(gammaCorrect(clamp(rLin)) * 255);
  const g = Math.round(gammaCorrect(clamp(gLin)) * 255);
  const bl = Math.round(gammaCorrect(clamp(bLin)) * 255);
  return `rgb(${r}, ${g}, ${bl})`;
}

function toRgb(color: string): string {
  if (!color) return color;
  if (color.startsWith("oklch")) {
    return oklchToRgb(color) || color;
  }
  return color;
}

function withAlpha(color: string, alpha: number): string {
  const rgb = color.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
  if (rgb) return `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, ${alpha})`;
  return color;
}

function useThemeColors(ref: React.RefObject<HTMLElement | null>) {
  const [colors, setColors] = useState<themeColors>({
    background: "#0A0D12",
    foreground: "#E7E9EC",
    grid: "#1E232B",
    border: "#2A3039",
    bull: "#16A34A",
    bear: "#DC2626",
    primary: "#FCD535",
  });

  useEffect(() => {
    const read = () => {
    const el = ref.current;
    if (!el) return;
    const style = getComputedStyle(el);
    setColors({
      background: toRgb(style.getPropertyValue("--background").trim()) || colors.background,
      foreground: toRgb(style.getPropertyValue("--foreground").trim()) || colors.foreground,
      grid: toRgb(style.getPropertyValue("--grid").trim()) || colors.grid,
      border: toRgb(style.getPropertyValue("--border").trim()) || colors.border,
      bull: toRgb(style.getPropertyValue("--bull").trim()) || colors.bull,
      bear: toRgb(style.getPropertyValue("--bear").trim()) || colors.bear,
      primary: toRgb(style.getPropertyValue("--primary").trim()) || colors.primary,
    });
    };
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] });
    return () => obs.disconnect();
  }, [ref]);

  return colors;
}

export function TradingViewChart({
  symbol,
  candles,
  quote,
  timeframe,
  onTimeframeChange,
  height = 420,
  isLoading,
  overlays = [],
}: {
  symbol: string;
  candles: Candle[];
  quote?: Quote;
  timeframe: Timeframe;
  onTimeframeChange: (tf: Timeframe) => void;
  height?: number;
  isLoading?: boolean;
  overlays?: ChartOverlay[];
}) {
  const hydrated = useHydrated();
  if (!hydrated) {
    return (
      <div
        className="grid place-items-center rounded-lg border border-border bg-card text-sm text-muted-foreground"
        style={{ height }}
      >
        Loading chart...
      </div>
    );
  }
  return (
    <TradingViewChartInner
      symbol={symbol}
      candles={candles}
      quote={quote}
      timeframe={timeframe}
      onTimeframeChange={onTimeframeChange}
      height={height}
      isLoading={isLoading}
      overlays={overlays}
    />
  );
}

function TradingViewChartInner({
  symbol,
  candles,
  quote,
  timeframe,
  onTimeframeChange,
  height = 420,
  isLoading,
  overlays = [],
}: {
  symbol: string;
  candles: Candle[];
  quote?: Quote;
  timeframe: Timeframe;
  onTimeframeChange: (tf: Timeframe) => void;
  height?: number;
  isLoading?: boolean;
  overlays?: ChartOverlay[];
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const mainSeriesRef = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);
  const volumePaneRef = useRef<any>(null);
  const indicatorRefs = useRef<{ key: IndicatorKey; series: any[]; pane?: any; lines?: any[] }[]>([]);
  const libRef = useRef<any>(null);
  const fittedRef = useRef(false);

  const [chartType, setChartType] = useState<ChartType>("candlestick");
  const [activeIndicators, setActiveIndicators] = useState<IndicatorKey[]>(["volume"]);
  const [drawingMode, setDrawingMode] = useState<DrawingMode>(null);
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [pendingPoints, setPendingPoints] = useState<{ time: number; price: number }[]>([]);
  const [redrawTick, setRedrawTick] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showIndicators, setShowIndicators] = useState(false);
  const [chartReady, setChartReady] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);

  const colors = useThemeColors(wrapRef);


  const timeframeMs = useMemo(() => {
    const map: Record<Timeframe, number> = {
      "1s": 1_000,
      "1m": 60_000,
      "3m": 180_000,
      "5m": 300_000,
      "15m": 900_000,
      "30m": 1_800_000,
      "1h": 3_600_000,
      "2h": 7_200_000,
      "4h": 14_400_000,
      "6h": 21_600_000,
      "12h": 43_200_000,
      "1d": 86_400_000,
      "1w": 604_800_000,
      "1M": 2_592_000_000,
    };
    return map[timeframe];
  }, [timeframe]);

  // Initialize chart library once.
  useEffect(() => {
    let mounted = true;
    let disposed = false;
    let createdChart: any = null;
    let resizeObserver: ResizeObserver | null = null;
    (async () => {
      const lib = await import("lightweight-charts");
      if (!mounted) return;
      libRef.current = lib;
      const container = wrapRef.current;
      if (!container) return;
      const chart = lib.createChart(container, {
        layout: {
          background: { type: lib.ColorType.Solid, color: colors.background },
          textColor: colors.foreground,
          fontFamily: "var(--font-sans)",
          fontSize: 12,
        },
        grid: {
          vertLines: { color: colors.grid },
          horzLines: { color: colors.grid },
        },
        crosshair: { mode: lib.CrosshairMode.Normal },
        rightPriceScale: { borderColor: colors.border, autoScale: true },
        leftPriceScale: { visible: false },
        timeScale: {
          borderColor: colors.border,
          timeVisible: true,
          secondsVisible: true,
          rightOffset: 12,
        },
        localization: { locale: "en-US" },
        handleScroll: true,
        handleScale: true,
        width: container.clientWidth,
        height: container.clientHeight,
      });
      createdChart = chart;
      chartRef.current = chart;
      setChartReady(true);

      // Volume pane (hidden until volume indicator active).
      const volumePane = chart.addPane();
      volumePaneRef.current = volumePane;
      const volumeSeries = volumePane.addSeries(lib.HistogramSeries, {
        priceFormat: { type: "volume" },
        priceLineVisible: false,
        lastValueVisible: false,
      });
      volumeSeriesRef.current = volumeSeries;
      volumePane.setHeight(Math.round(container.clientHeight * 0.18));

      chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
        if (disposed) return;
        setRedrawTick((n) => n + 1);
      });

      resizeObserver = new ResizeObserver(([entry]) => {
        if (disposed || !createdChart) return;
        const { width, height: nextHeight } = entry.contentRect;
        if (width > 0 && nextHeight > 0) createdChart.resize(width, nextHeight);
      });
      resizeObserver.observe(container);

    })();

    return () => {
      mounted = false;
      disposed = true;
      resizeObserver?.disconnect();
      resizeObserver = null;
      setChartReady(false);
      if (createdChart) {
        createdChart.remove();
        createdChart = null;
      }
      if (chartRef.current) {
        chartRef.current = null;
      }
      mainSeriesRef.current = null;
      volumeSeriesRef.current = null;
      volumePaneRef.current = null;
      indicatorRefs.current = [];
    };
  }, []);

  // Apply theme color changes.
  useEffect(() => {
    const chart = chartRef.current;
    const lib = libRef.current;
    if (!chart || !lib) return;
    chart.applyOptions({
      layout: { background: { type: lib.ColorType.Solid, color: colors.background }, textColor: colors.foreground },
      grid: { vertLines: { color: colors.grid }, horzLines: { color: colors.grid } },
      rightPriceScale: { borderColor: colors.border },
      timeScale: { borderColor: colors.border },
    });
  }, [colors, chartReady]);

  // Reset fit state when the symbol or timeframe changes.
  useEffect(() => {
    fittedRef.current = false;
  }, [symbol, timeframe]);

  // Create / swap main series when chart type changes.
  useEffect(() => {
    const chart = chartRef.current;
    const lib = libRef.current;
    if (!chart || !lib) return;

    const previousSeries = mainSeriesRef.current;
    mainSeriesRef.current = null;
    if (previousSeries) {
      try {
        chart.removeSeries(previousSeries);
      } catch {
        return;
      }
    }

    let series: any;
    if (chartType === "line") {
      series = chart.addSeries(lib.LineSeries, {
        color: colors.primary,
        lineWidth: 2,
        crosshairMarkerVisible: true,
      });
    } else if (chartType === "area") {
      series = chart.addSeries(lib.AreaSeries, {
        lineColor: colors.primary,
        topColor: withAlpha(colors.primary, 0.2),
        bottomColor: withAlpha(colors.primary, 0.02),
        lineWidth: 2,
      });
    } else if (chartType === "bars") {
      series = chart.addSeries(lib.BarSeries, {
        upColor: colors.bull,
        downColor: colors.bear,
      });
    } else {
      // candlestick, hollow, heikin
      const isHollow = chartType === "hollow";
      series = chart.addSeries(lib.CandlestickSeries, {
        upColor: isHollow ? "transparent" : colors.bull,
        downColor: colors.bear,
        borderUpColor: colors.bull,
        borderDownColor: colors.bear,
        wickUpColor: colors.bull,
        wickDownColor: colors.bear,
      });
    }
    mainSeriesRef.current = series;
    // Re-apply data and fit the visible range once.
    applyMainData(series, candles, chartType, quote, timeframeMs);
    if (candles.length) {
      chart.timeScale().fitContent();
      fittedRef.current = true;
    }
  }, [chartType, chartReady]);

  // Restyle the active series without replacing it when the theme changes.
  useEffect(() => {
    const series = mainSeriesRef.current;
    if (!series) return;
    if (chartType === "line") {
      series.applyOptions({ color: colors.primary });
    } else if (chartType === "area") {
      series.applyOptions({
        lineColor: colors.primary,
        topColor: withAlpha(colors.primary, 0.2),
        bottomColor: withAlpha(colors.primary, 0.02),
      });
    } else if (chartType === "bars") {
      series.applyOptions({ upColor: colors.bull, downColor: colors.bear });
    } else {
      series.applyOptions({
        upColor: chartType === "hollow" ? "transparent" : colors.bull,
        downColor: colors.bear,
        borderUpColor: colors.bull,
        borderDownColor: colors.bear,
        wickUpColor: colors.bull,
        wickDownColor: colors.bear,
      });
    }
  }, [chartType, colors, chartReady]);

  // Update main data when candles/quote change.
  useEffect(() => {
    const chart = chartRef.current;
    const series = mainSeriesRef.current;
    if (!series) return;
    applyMainData(series, candles, chartType, quote, timeframeMs);
    if (chart && candles.length && !fittedRef.current) {
      chart.timeScale().fitContent();
      fittedRef.current = true;
    }
  }, [candles, quote, timeframeMs]);

  // Manage indicators.
  useEffect(() => {
    const chart = chartRef.current;
    const lib = libRef.current;
    const mainSeries = mainSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    if (!chart || !lib || !mainSeries) return;

    // Clean up removed indicators.
    const keep = new Set(activeIndicators);
    for (const item of indicatorRefs.current) {
      if (keep.has(item.key)) continue;
      for (const s of item.series) {
        try {
          if (s === volumeSeries) continue; // volume series is permanent
          chart.removeSeries(s);
        } catch {}
      }
      for (const l of item.lines ?? []) {
        try {
          if (l?.parent) l.parent.remove();
        } catch {}
      }
      // The chart drops a pane automatically once its last series is removed;
      // removing it again by index would dispose a different (live) pane.
    }
    indicatorRefs.current = indicatorRefs.current.filter((i) => keep.has(i.key));

    const ensureIndicator = (key: IndicatorKey) => {
      if (indicatorRefs.current.find((i) => i.key === key)) return;
      const def = INDICATORS.find((d) => d.key === key)!;
      if (key === "volume") {
        indicatorRefs.current.push({ key, series: [volumeSeries], pane: volumePaneRef.current });
        volumePaneRef.current.setHeight(Math.round((wrapRef.current?.clientHeight ?? 420) * 0.2));
        return;
      }

      if (def.pane === "lower") {
        const pane = chart.addPane();
        pane.setHeight(100);
        if (key === "rsi") {
          const s = pane.addSeries(lib.LineSeries, { color: def.color || colors.primary, lineWidth: 2 });
          const overbought = pane.addSeries(lib.LineSeries, { color: colors.bear, lineWidth: 1, lastValueVisible: false });
          const oversold = pane.addSeries(lib.LineSeries, { color: colors.bull, lineWidth: 1, lastValueVisible: false });
          indicatorRefs.current.push({ key, series: [s, overbought, oversold], pane });
        } else if (key === "macd") {
          const macdLine = pane.addSeries(lib.LineSeries, { color: colors.primary, lineWidth: 2 });
          const signalLine = pane.addSeries(lib.LineSeries, { color: "#F59E0B", lineWidth: 2 });
          const hist = pane.addSeries(lib.HistogramSeries, {
            color: colors.primary,
            priceLineVisible: false,
            lastValueVisible: false,
          });
          indicatorRefs.current.push({ key, series: [macdLine, signalLine, hist], pane });
        } else if (key === "stochastic") {
          const kLine = pane.addSeries(lib.LineSeries, { color: colors.primary, lineWidth: 2 });
          const dLine = pane.addSeries(lib.LineSeries, { color: "#F59E0B", lineWidth: 2 });
          const upper = pane.addSeries(lib.LineSeries, { color: colors.bear, lineWidth: 1, lastValueVisible: false });
          const lower = pane.addSeries(lib.LineSeries, { color: colors.bull, lineWidth: 1, lastValueVisible: false });
          indicatorRefs.current.push({ key, series: [kLine, dLine, upper, lower], pane });
        }
        return;
      }

      if (key === "bollinger") {
        const upper = chart.addSeries(lib.LineSeries, { color: "#8B5CF6", lineWidth: 1, lastValueVisible: false });
        const middle = chart.addSeries(lib.LineSeries, { color: "#F59E0B", lineWidth: 1, lastValueVisible: false });
        const lower = chart.addSeries(lib.LineSeries, { color: "#8B5CF6", lineWidth: 1, lastValueVisible: false });
        indicatorRefs.current.push({ key, series: [upper, middle, lower] });
      } else {
        const s = chart.addSeries(lib.LineSeries, {
          color: def.color || colors.primary,
          lineWidth: 2,
          lastValueVisible: false,
        });
        indicatorRefs.current.push({ key, series: [s] });
      }
    };

    for (const key of activeIndicators) ensureIndicator(key);

    // Feed data.
    for (const item of indicatorRefs.current) {
      feedIndicator(item, candles, lib, colors);
    }

    // Hide volume pane when not active.
    const volumeActive = activeIndicators.includes("volume");
    try {
      volumePaneRef.current.setHeight(volumeActive ? Math.round((wrapRef.current?.clientHeight ?? 420) * 0.2) : 0);
    } catch {}
  }, [activeIndicators, candles, colors, chartReady]);

  // Crosshair OHLC inspector.
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const handler = (param: any) => {
      if (!param?.time || !param.point) {
        setHoverTime(null);
        return;
      }
      setHoverTime(Number(param.time));
    };
    chart.subscribeCrosshairMove(handler);
    return () => chart.unsubscribeCrosshairMove(handler);
  }, [chartReady]);

  // Active order / strike price lines.
  useEffect(() => {
    const series = mainSeriesRef.current;
    const lib = libRef.current;
    if (!series || !lib) return;
    const lines = overlays
      .filter((o) => Number.isFinite(o.price) && o.price > 0)
      .map((o) =>
        series.createPriceLine({
          price: o.price,
          color: o.tone === "bull" ? colors.bull : colors.bear,
          lineWidth: 1,
          lineStyle: o.style === "dotted" ? lib.LineStyle.Dotted : lib.LineStyle.Dashed,
          axisLabelVisible: true,
          title: `${o.label} ${formatPrice(o.price, symbol)}`,
        }),
      );
    return () => {
      for (const l of lines) {
        try {
          series.removePriceLine(l);
        } catch {}
      }
    };
  }, [overlays, colors, chartType, chartReady, symbol]);

  // Drawing click handler.
  useEffect(() => {
    const chart = chartRef.current;
    const mainSeries = mainSeriesRef.current;
    if (!chart || !mainSeries || !drawingMode) return;

    const handler = (param: any) => {
      if (!param.point) return;
      const time = chart.timeScale().coordinateToTime(param.point.x);
      const price = mainSeries.coordinateToPrice(param.point.y);
      if (time == null || price == null) return;
      const pt = { time: Number(time), price };
      setPendingPoints((prev) => {
        const next = [...prev, pt];
        if (drawingMode === "horizontal" && next.length >= 1) {
          addDrawing({ type: "horizontal", a: next[0] });
          return [];
        }
        if ((drawingMode === "trend" || drawingMode === "fib" || drawingMode === "rect") && next.length >= 2) {
          addDrawing({ type: drawingMode, a: next[0], b: next[1] });
          return [];
        }
        return next;
      });
    };

    chart.subscribeClick(handler);
    return () => chart.unsubscribeClick(handler);
  }, [drawingMode]);

  const addDrawing = useCallback((partial: DrawingInput) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setDrawings((prev) => [...prev, { ...partial, id } as Drawing]);
    setDrawingMode(null);
    setPendingPoints([]);
  }, []);

  const clearDrawings = useCallback(() => {
    setDrawings([]);
    setPendingPoints([]);
  }, []);

  const toggleIndicator = useCallback((key: IndicatorKey) => {
    setActiveIndicators((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }, []);

  const handleFullscreen = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }, []);

  const handleAutoscale = useCallback(() => {
    chartRef.current?.timeScale().fitContent();
  }, []);

  const inspected = useMemo(() => {
    if (!candles.length) return null;
    const idx = hoverTime == null ? candles.length - 1 : candles.findIndex((c) => Math.floor(c.t / 1000) === hoverTime);
    const c = candles[idx < 0 ? candles.length - 1 : idx];
    if (!c) return null;
    const close = idx === candles.length - 1 || idx < 0 ? (quote?.price ?? c.c) : c.c;
    const chg = close - c.o;
    return { ...c, c: close, chg, pct: c.o ? (chg / c.o) * 100 : 0 };
  }, [candles, hoverTime, quote?.price]);

  const emaOn = activeIndicators.includes("ema7");
  const toggleEmaSet = () =>
    setActiveIndicators((prev) =>
      emaOn
        ? prev.filter((k) => k !== "ema7" && k !== "ema25" && k !== "ema99")
        : [...prev.filter((k) => k !== "ema7" && k !== "ema25" && k !== "ema99"), "ema7", "ema25", "ema99"],
    );

  // Pending datafeed state.
  const hasData = candles.length > 1;
  const isPending = !isLoading && !hasData && (!quote || quote.stale);

  return (
    <div
      ref={wrapRef}
      className={cn(
        "relative w-full overflow-hidden rounded-lg border border-border bg-card",
        isFullscreen && "fixed inset-0 z-50 rounded-none",
      )}
      style={{ height: isFullscreen ? "100vh" : height }}
    >
      {/* Toolbar */}
      <div className="absolute left-0 right-0 top-0 z-10 flex flex-col gap-1 border-b border-border bg-card/95 px-2 py-1.5 backdrop-blur sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
        <div className="hidden items-center gap-1 overflow-x-auto sm:flex">
          {CHART_TYPES.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              title={label}
              onClick={() => setChartType(key)}
              className={cn(
                "flex touch-manipulation items-center gap-1 rounded-md px-2 py-1 text-[11px] transition-colors",
                chartType === key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              <Icon className="size-3.5" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        <div className="hidden h-4 w-px bg-border sm:block" />

        <div className="flex w-full items-center gap-1 overflow-x-auto whitespace-nowrap sm:w-auto">
          {VISIBLE_TIMEFRAMES.map((tf) => [tf, TIMEFRAME_LABELS[tf]] as const).map(([tf, label]) => (
            <button
              key={tf}
              onClick={() => onTimeframeChange(tf as Timeframe)}
              className={cn(
                "touch-manipulation rounded-md px-2 py-1 text-[11px] transition-colors",
                timeframe === tf
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="hidden h-4 w-px bg-border sm:block" />
        <div className="flex w-full items-center gap-1 overflow-x-auto whitespace-nowrap sm:w-auto sm:overflow-visible">
          {inspected && (
            <span className="shrink-0 pr-1 font-mono text-[10px] tabular-nums sm:hidden">
              <span className="text-muted-foreground">O </span>
              <span className={inspected.chg >= 0 ? "text-bull" : "text-bear"}>{formatPrice(inspected.o, symbol)}</span>
              <span className="text-muted-foreground"> H </span>
              <span className={inspected.chg >= 0 ? "text-bull" : "text-bear"}>{formatPrice(inspected.h, symbol)}</span>
              <span className="text-muted-foreground"> L </span>
              <span className={inspected.chg >= 0 ? "text-bull" : "text-bear"}>{formatPrice(inspected.l, symbol)}</span>
              <span className="text-muted-foreground"> C </span>
              <span className={inspected.chg >= 0 ? "text-bull" : "text-bear"}>{formatPrice(inspected.c, symbol)}</span>
            </span>
          )}
          {([
            ["EMA", emaOn, toggleEmaSet],
            ["BOLL", activeIndicators.includes("bollinger"), () => toggleIndicator("bollinger")],
            ["RSI", activeIndicators.includes("rsi"), () => toggleIndicator("rsi")],
            ["VOL", activeIndicators.includes("volume"), () => toggleIndicator("volume")],
          ] as const).map(([label, on, fn]) => (
            <button
              key={label}
              type="button"
              onClick={fn}
              className={cn(
                "touch-manipulation rounded-md px-2 py-1 text-[11px] font-semibold transition-colors",
                on ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
          <button
            onClick={handleFullscreen}
            title="Fullscreen"
            className="ml-auto shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary sm:hidden"
          >
            {isFullscreen ? <Shrink className="size-3.5" /> : <Maximize className="size-3.5" />}
          </button>
        </div>

        <div className="ml-auto hidden items-center gap-1 sm:flex">
          <div className="relative">
            <button
              onClick={() => setShowIndicators((s) => !s)}
              className={cn(
                "flex touch-manipulation items-center gap-1 rounded-md px-2 py-1 text-[11px] transition-colors",
                showIndicators || activeIndicators.length > 0
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              <Layers className="size-3.5" />
              <span className="hidden sm:inline">Indicators</span>
              {activeIndicators.length > 0 && (
                <span className="ml-0.5 rounded-full bg-primary px-1 text-[9px] text-primary-foreground">
                  {activeIndicators.length}
                </span>
              )}
            </button>
            {showIndicators && (
              <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-lg border border-border bg-popover p-2 shadow-lg">
                {INDICATORS.map((ind) => (
                  <label
                    key={ind.key}
                    className="flex cursor-pointer items-center justify-between rounded px-1.5 py-1 text-xs hover:bg-secondary"
                  >
                    <span className="text-foreground">{ind.label}</span>
                    <input
                      type="checkbox"
                      checked={activeIndicators.includes(ind.key)}
                      onChange={() => toggleIndicator(ind.key)}
                      className="size-3.5 accent-primary"
                    />
                  </label>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => setDrawingMode((m) => (m === "trend" ? null : "trend"))}
            title="Trend line"
            className={cn(
              "rounded-md p-1.5 transition-colors",
              drawingMode === "trend" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary",
            )}
          >
            <TrendingUp className="size-3.5" />
          </button>
          <button
            onClick={() => setDrawingMode((m) => (m === "horizontal" ? null : "horizontal"))}
            title="Horizontal line"
            className={cn(
              "rounded-md p-1.5 transition-colors",
              drawingMode === "horizontal" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary",
            )}
          >
            <Minus className="size-3.5" />
          </button>
          <button
            onClick={() => setDrawingMode((m) => (m === "fib" ? null : "fib"))}
            title="Fibonacci retracement"
            className={cn(
              "rounded-md p-1.5 transition-colors",
              drawingMode === "fib" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary",
            )}
          >
            <MousePointer2 className="size-3.5" />
          </button>
          <button
            onClick={() => setDrawingMode((m) => (m === "rect" ? null : "rect"))}
            title="Rectangle"
            className={cn(
              "rounded-md p-1.5 transition-colors",
              drawingMode === "rect" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary",
            )}
          >
            <ArrowLeftRight className="size-3.5" />
          </button>
          <button
            onClick={clearDrawings}
            title="Clear drawings"
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-destructive"
          >
            <Trash2 className="size-3.5" />
          </button>

          <button
            onClick={handleAutoscale}
            title="Fit content"
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary"
          >
            <Focus className="size-3.5" />
          </button>
          <button
            onClick={handleFullscreen}
            title="Fullscreen"
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary"
          >
            {isFullscreen ? <Shrink className="size-3.5" /> : <Maximize className="size-3.5" />}
          </button>
        </div>
      </div>

      {/* OHLC inspector */}
      {inspected && (
        <div className="pointer-events-none absolute left-2 top-12 z-10 hidden flex-wrap gap-x-2.5 gap-y-0.5 rounded bg-card/80 px-2 py-1 font-mono text-[10px] tabular-nums sm:flex sm:text-[11px]">
          {(["o", "h", "l", "c"] as const).map((k) => (
            <span key={k}>
              <span className="text-muted-foreground">{k.toUpperCase()} </span>
              <span className={inspected.chg >= 0 ? "text-bull" : "text-bear"}>{formatPrice(inspected[k], symbol)}</span>
            </span>
          ))}
          <span className={inspected.chg >= 0 ? "text-bull" : "text-bear"}>
            {inspected.chg >= 0 ? "+" : "-"}
            {formatPrice(Math.abs(inspected.chg), symbol)} ({inspected.pct >= 0 ? "+" : "-"}
            {Math.abs(inspected.pct).toFixed(2)}%)
          </span>
          <span>
            <span className="text-muted-foreground">Vol </span>
            {(inspected.v ?? 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}
          </span>
          {emaOn && (
            <span className="w-full text-[10px]">
              <span style={{ color: "#F0B90B" }}>EMA7</span> <span style={{ color: "#E377C2" }}>EMA25</span>{" "}
              <span style={{ color: "#8C6CF7" }}>EMA99</span>
            </span>
          )}
        </div>
      )}

      {/* Drawing overlay */}
      <DrawingOverlay
        chart={chartRef.current}
        mainSeries={mainSeriesRef.current}
        drawings={drawings}
        pending={pendingPoints}
        redrawTick={redrawTick}
        colors={colors}
      />

      {/* Pending state */}
      {(isLoading || isPending) && (
        <div className="absolute inset-0 z-0 grid place-items-center bg-card/80 text-sm text-muted-foreground">
          {isLoading ? "Loading chart data..." : "Pending datafeed configuration"}
        </div>
      )}
    </div>
  );
}

function applyMainData(
  series: any,
  candles: Candle[],
  chartType: ChartType,
  quote: Quote | undefined,
  timeframeMs: number,
) {
  if (!candles.length) return;
  // Every series receives a fresh, ordered dataset. Never reuse transformed
  // values between chart modes, or switching back to OHLC modes can inherit
  // line-series values and collapse the price scale.
  const cleanCandles = candles
    .filter((c) =>
      [c.t, c.o, c.h, c.l, c.c].every(Number.isFinite) && c.h >= c.l,
    )
    .sort((a, b) => a.t - b.t)
    .filter((c, index, all) => index === all.length - 1 || c.t !== all[index + 1].t);
  if (!cleanCandles.length) return;
  const prepared = cleanCandles.map((c) => ({ ...c }));
  const rawLast = prepared[prepared.length - 1];
  const historicalClose = rawLast?.c;
  const quoteMatchesHistory =
    quote?.price != null &&
    Number.isFinite(quote.price) &&
    historicalClose != null &&
    Math.abs(quote.price - historicalClose) / Math.max(Math.abs(historicalClose), 1e-9) < 0.25;

  if (quoteMatchesHistory && quote && rawLast) {
    const bucket = Math.floor(Date.now() / timeframeMs) * timeframeMs;
    if (Math.floor(rawLast.t / 1000) === Math.floor(bucket / 1000)) {
      rawLast.c = quote.price;
      rawLast.h = Math.max(rawLast.h, quote.price);
      rawLast.l = Math.min(rawLast.l, quote.price);
    }
  }

  const source = chartType === "heikin" ? heikinAshi(prepared) : prepared;
  const data = source.map((c) => ({
    time: Math.floor(c.t / 1000) as any,
    open: c.o,
    high: c.h,
    low: c.l,
    close: c.c,
  }));

  if (chartType === "line" || chartType === "area") {
    series.setData(data.map((d) => ({ time: d.time, value: d.close })));
  } else {
    series.setData(data);
  }
}

function feedIndicator(
  item: { key: IndicatorKey; series: any[]; pane?: any },
  candles: Candle[],
  lib: any,
  colors: themeColors,
) {
  if (!candles.length) return;
  const { key, series } = item;

  if (key === "volume") {
    const data = candles.map((c) => ({
      time: Math.floor(c.t / 1000) as any,
      value: c.v ?? 0,
      color: c.c >= c.o ? colors.bull : colors.bear,
    }));
    series[0].setData(data);
    return;
  }

  if (key === "sma20") {
    const data = sma(candles, 20).map((p) => ({ time: Math.floor(p.t / 1000) as any, value: p.value }));
    series[0].setData(data);
  } else if (key === "sma50") {
    const data = sma(candles, 50).map((p) => ({ time: Math.floor(p.t / 1000) as any, value: p.value }));
    series[0].setData(data);
  } else if (key === "ema7" || key === "ema25" || key === "ema99") {
    const n = key === "ema7" ? 7 : key === "ema25" ? 25 : 99;
    const data = ema(candles, n).map((p) => ({ time: Math.floor(p.t / 1000) as any, value: p.value }));
    series[0].setData(data);
  } else if (key === "ema12") {
    const data = ema(candles, 12).map((p) => ({ time: Math.floor(p.t / 1000) as any, value: p.value }));
    series[0].setData(data);
  } else if (key === "ema26") {
    const data = ema(candles, 26).map((p) => ({ time: Math.floor(p.t / 1000) as any, value: p.value }));
    series[0].setData(data);
  } else if (key === "vwap") {
    const data = vwap(candles).map((p) => ({ time: Math.floor(p.t / 1000) as any, value: p.value }));
    series[0].setData(data);
  } else if (key === "atr") {
    const data = atr(candles, 14).map((p) => ({ time: Math.floor(p.t / 1000) as any, value: p.value }));
    series[0].setData(data);
  } else if (key === "bollinger") {
    const pts = bollinger(candles, 20, 2);
    series[0].setData(pts.map((p) => ({ time: Math.floor(p.t / 1000) as any, value: p.upper })));
    series[1].setData(pts.map((p) => ({ time: Math.floor(p.t / 1000) as any, value: p.middle })));
    series[2].setData(pts.map((p) => ({ time: Math.floor(p.t / 1000) as any, value: p.lower })));
  } else if (key === "rsi") {
    const pts = rsi(candles, 14);
    series[0].setData(pts.map((p) => ({ time: Math.floor(p.t / 1000) as any, value: p.value })));
    const times = pts.map((p) => Math.floor(p.t / 1000) as any);
    series[1].setData(times.map((t) => ({ time: t, value: 70 })));
    series[2].setData(times.map((t) => ({ time: t, value: 30 })));
  } else if (key === "macd") {
    const pts = macd(candles, 12, 26, 9);
    series[0].setData(pts.map((p) => ({ time: Math.floor(p.t / 1000) as any, value: p.macd })));
    series[1].setData(pts.map((p) => ({ time: Math.floor(p.t / 1000) as any, value: p.signal })));
    series[2].setData(
      pts.map((p) => ({
        time: Math.floor(p.t / 1000) as any,
        value: p.histogram,
        color: p.histogram >= 0 ? colors.bull : colors.bear,
      })),
    );
  } else if (key === "stochastic") {
    const pts = stochastic(candles, 14, 3);
    series[0].setData(pts.map((p) => ({ time: Math.floor(p.t / 1000) as any, value: p.k })));
    series[1].setData(pts.map((p) => ({ time: Math.floor(p.t / 1000) as any, value: p.d })));
    const times = pts.map((p) => Math.floor(p.t / 1000) as any);
    series[2].setData(times.map((t) => ({ time: t, value: 80 })));
    series[3].setData(times.map((t) => ({ time: t, value: 20 })));
  }
}

function DrawingOverlay({
  chart,
  mainSeries,
  drawings,
  pending,
  redrawTick,
  colors,
}: {
  chart: any;
  mainSeries: any;
  drawings: Drawing[];
  pending: { time: number; price: number }[];
  redrawTick: number;
  colors: themeColors;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = svgRef.current?.parentElement;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setSize({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const toCoord = (time: number, price: number) => {
    if (!chart || !mainSeries) return null;
    const x = chart.timeScale().timeToCoordinate(time as any);
    const y = mainSeries.priceToCoordinate(price);
    if (x == null || y == null) return null;
    return { x, y };
  };

  const renderShape = (d: Drawing) => {
    const a = toCoord(d.a.time, d.a.price);
    if (!a) return null;
    if (d.type === "horizontal") {
      return (
        <g key={d.id}>
          <line x1={0} y1={a.y} x2={size.w} y2={a.y} stroke={colors.primary} strokeWidth={1} strokeDasharray="4 3" />
          <text x={size.w - 4} y={a.y - 4} fill={colors.primary} fontSize={10} fontFamily="var(--font-mono)" textAnchor="end">
            {formatPrice(d.a.price, "")}
          </text>
        </g>
      );
    }
    const b = toCoord(d.b.time, d.b.price);
    if (!b) return null;
    if (d.type === "trend") {
      return (
        <line
          key={d.id}
          x1={a.x}
          y1={a.y}
          x2={b.x}
          y2={b.y}
          stroke={colors.primary}
          strokeWidth={1.5}
        />
      );
    }
    if (d.type === "rect") {
      const x = Math.min(a.x, b.x);
      const y = Math.min(a.y, b.y);
      const w = Math.abs(b.x - a.x);
      const h = Math.abs(b.y - a.y);
      return (
        <rect
          key={d.id}
          x={x}
          y={y}
          width={w}
          height={h}
          fill={`${colors.primary}22`}
          stroke={colors.primary}
          strokeWidth={1}
        />
      );
    }
    if (d.type === "fib") {
      const minP = Math.min(d.a.price, d.b.price);
      const maxP = Math.max(d.a.price, d.b.price);
      const range = maxP - minP;
      const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
      const x1 = Math.min(a.x, b.x);
      const x2 = Math.max(a.x, b.x);
      return (
        <g key={d.id}>
          {levels.map((lvl) => {
            const price = d.a.price > d.b.price ? maxP - range * lvl : minP + range * lvl;
            const coord = toCoord(d.a.time, price);
            if (!coord) return null;
            return (
              <g key={lvl}>
                <line
                  x1={x1}
                  x2={x2}
                  y1={coord.y}
                  y2={coord.y}
                  stroke={colors.foreground}
                  strokeWidth={0.75}
                  strokeDasharray="3 3"
                  opacity={0.7}
                />
                <text x={x2 + 4} y={coord.y + 3} fill={colors.foreground} fontSize={9} fontFamily="var(--font-mono)">
                  {(lvl * 100).toFixed(1)}%
                </text>
              </g>
            );
          })}
        </g>
      );
    }
    return null;
  };

  const pendingShape = () => {
    if (!pending.length) return null;
    const pts = pending.map((p) => toCoord(p.time, p.price)).filter(Boolean) as { x: number; y: number }[];
    return pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={3} fill={colors.primary} />);
  };

  return (
    <svg
      ref={svgRef}
      className="pointer-events-none absolute inset-0 z-0"
      width={size.w}
      height={size.h}
    >
      {drawings.map(renderShape)}
      {pendingShape()}
    </svg>
  );
}
