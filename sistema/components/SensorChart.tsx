import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
  TSpan,
} from "react-native-svg";
import { HistoryItem, useHistory } from "../context/historyContext";

type Props = {
  title: string;
  nutrient?: "N" | "P" | "K";
  labels: string[];
  realData?: number[];
  idealData?: number[];
  showMetrics?: boolean;
  metric?: string;
};

function evaluateSoilMetric(metricName: string, value: number) {
  if (metricName === "Humedad") {
    if (value < 30) return { label: "⚠️ CRÍTICO (MUY BAJO)", color: "#dc2626", bg: "#fef2f2" };
    if (value < 50) return { label: "⚠️ ATENCIÓN (BAJO)", color: "#d97706", bg: "#fff7ed" };
    if (value <= 70) return { label: "✓ EXCELENTE (ÓPTIMO)", color: "#16a34a", bg: "#f0fdf4" };
    return { label: "⚠️ ATENCIÓN (ALTO)", color: "#d97706", bg: "#fff7ed" };
  }
  if (metricName === "Nitrogeno") {
    if (value < 10) return { label: "⚠️ CRÍTICO (MUY BAJO)", color: "#dc2626", bg: "#fef2f2" };
    if (value < 20) return { label: "⚠️ ATENCIÓN (BAJO)", color: "#d97706", bg: "#fff7ed" };
    if (value <= 40) return { label: "✓ EXCELENTE (ÓPTIMO)", color: "#16a34a", bg: "#f0fdf4" };
    return { label: "⚠️ ATENCIÓN (EXCESO)", color: "#d97706", bg: "#fff7ed" };
  }
  if (metricName === "Fosforo") {
    if (value < 5) return { label: "⚠️ CRÍTICO (MUY BAJO)", color: "#dc2626", bg: "#fef2f2" };
    if (value < 15) return { label: "⚠️ ATENCIÓN (BAJO)", color: "#d97706", bg: "#fff7ed" };
    if (value <= 30) return { label: "✓ EXCELENTE (ÓPTIMO)", color: "#16a34a", bg: "#f0fdf4" };
    return { label: "⚠️ ATENCIÓN (ALTO)", color: "#d97706", bg: "#fff7ed" };
  }
  if (metricName === "Potasio") {
    if (value < 50) return { label: "⚠️ CRÍTICO (MUY BAJO)", color: "#dc2626", bg: "#fef2f2" };
    if (value < 100) return { label: "⚠️ ATENCIÓN (BAJO)", color: "#d97706", bg: "#fff7ed" };
    if (value <= 200) return { label: "✓ EXCELENTE (ÓPTIMO)", color: "#16a34a", bg: "#f0fdf4" };
    return { label: "⚠️ ATENCIÓN (EXCESO)", color: "#d97706", bg: "#fff7ed" };
  }
  return { label: "✓ ACTIVO", color: "#16a34a", bg: "#f0fdf4" };
}

function getMetricTheme(metricName: string) {
  // Color primario verde agrícola unificado para todos los gráficos reales
  return {
    color: "#16a34a",
    stroke: "#15803d",
  };
}

const MONTHS_FULL = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
];

const MONTHS_SHORT: Record<string, string> = {
  "01": "ene",
  "02": "feb",
  "03": "mar",
  "04": "abr",
  "05": "may",
  "06": "jun",
  "07": "jul",
  "08": "ago",
  "09": "sep",
  "10": "oct",
  "11": "nov",
  "12": "dic",
};

function formatFriendlyDate(dateStr: string) {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const monthIndex = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  return `${day} de ${MONTHS_FULL[monthIndex] || ""}`;
}

function formatAxisDate(dateStr: string) {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const day = parts[2];
  const shortMonth = MONTHS_SHORT[parts[1]] || "";
  return `${day} ${shortMonth}`;
}

const metricDisplayNames: Record<string, string> = {
  Humedad: "Humedad",
  Nitrogeno: "Nitrógeno",
  Fosforo: "Fósforo",
  Potasio: "Potasio",
  Temperatura: "Temperatura",
  Presion: "Presión",
  Lluvia: "Lluvia",
};

export default function SensorChart({
  title,
  nutrient,
  labels,
  realData = [],
  idealData = [],
  showMetrics = true,
  metric,
}: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const [cantidad, setCantidad] = useState("");
  const { historyItems, addHistory } = useHistory();
  const [zoom, setZoom] = useState(1);
  const scrollRef = useRef<ScrollView>(null);
  const scrollX = useRef(0);
  const prevZoom = useRef(zoom);
  const [activePointIndex, setActivePointIndex] = useState<number | null>(null);

  // Reset active point when dataset changes
  useEffect(() => {
    setActivePointIndex(null);
  }, [realData]);

  const isIdealInterface = idealData && idealData.length > 0;
  const theme = getMetricTheme(metric || nutrient || "");
  const labelName = metricDisplayNames[metric || ""] || metric || "Valor";

  // Determine correct unit dynamically
  const isNutrient =
    metric === "Nitrogeno" ||
    metric === "Fosforo" ||
    metric === "Potasio" ||
    !!nutrient;
  const unit = isNutrient ? "mg/kg" : "%";

  const chartTitleText = isIdealInterface
    ? `Curva Ideal (${metric || "Nutriente"})`
    : `Tendencia de ${metric || "Humedad"}`;

  /* ========================= ZOOM LOGIC ========================= */
  useEffect(() => {
    if (!scrollRef.current) return;
    const ratio = zoom / prevZoom.current;
    const containerWidth = screenWidth - 56;
    const maxScroll = Math.max(0, (containerWidth * zoom) - containerWidth);
    const targetX = Math.min(maxScroll, scrollX.current * ratio);

    scrollRef.current.scrollTo({ x: targetX, animated: false });
    prevZoom.current = zoom;
  }, [zoom]);

  const zoomIn = () => setZoom((z) => Math.min(z + 0.5, 3));
  const zoomOut = () => setZoom((z) => Math.max(z - 0.5, 1));

  /* ========================= CALCULATIONS ========================= */

  if (!realData.length && !isIdealInterface) return null;

  const chartWidth = (screenWidth - 56) * zoom;
  const chartHeight = 240;
  const padding = { top: 35, bottom: 35, left: 40, right: 15 };

  // Solo procesamos valores que sean números finitos y no nulos
  const validDataPoints = realData
    .map((v, i) => ({ val: v, label: labels[i], index: i }))
    .filter(item => item.val !== null && Number.isFinite(item.val));

  const cleanReal = validDataPoints.map(d => d.val as number);
  const cleanIdeal = isIdealInterface
    ? idealData.map((v) => (Number.isFinite(v) ? v : 0))
    : [];

  const maxValue = Math.max(...cleanReal, ...cleanIdeal, 1);
  const minValue = Math.min(...cleanReal);
  const avgValue =
    cleanReal.reduce((s, v) => s + v, 0) / (cleanReal.length || 1);

  // Calcular un yMax con números redondos e intervalos uniformes
  let yMaxCalc = Math.ceil(maxValue * 1.15);
  if (yMaxCalc < 4) {
    yMaxCalc = 4;
  } else if (yMaxCalc < 10) {
    yMaxCalc = Math.ceil(yMaxCalc / 4) * 4;
  } else if (yMaxCalc < 50) {
    yMaxCalc = Math.ceil(yMaxCalc / 8) * 8;
  } else if (yMaxCalc < 200) {
    yMaxCalc = Math.ceil(yMaxCalc / 20) * 20;
  } else {
    yMaxCalc = Math.ceil(yMaxCalc / 40) * 40;
  }
  const yMax = yMaxCalc;

  const lastValue = cleanReal[cleanReal.length - 1] || 0;
  const statusInfo = evaluateSoilMetric(metric || "Humedad", lastValue);

  const getPoints = (data: number[]) =>
    data.map((v, i) => ({
      x:
        padding.left +
        (i / Math.max(data.length - 1, 1)) *
        (chartWidth - padding.left - padding.right),
      y:
        padding.top +
        (chartHeight - padding.top - padding.bottom) -
        (v / yMax) * (chartHeight - padding.top - padding.bottom),
    }));

  const realPoints = validDataPoints.map((d) => ({
    x:
      padding.left +
      (d.index / Math.max(labels.length - 1, 1)) *
      (chartWidth - padding.left - padding.right),
    y:
      padding.top +
      (chartHeight - padding.top - padding.bottom) -
      (d.val / yMax) * (chartHeight - padding.top - padding.bottom),
  }));

  const idealPoints = getPoints(cleanIdeal);

  const getCurvedPath = (pts: { x: number; y: number }[]) => {
    if (pts.length < 2) return "";
    return pts.reduce((acc, p, i, arr) => {
      if (i === 0) return `M ${p.x} ${p.y}`;
      const prev = arr[i - 1];
      const cp1x = prev.x + (p.x - prev.x) / 2;
      return `${acc} C ${cp1x} ${prev.y}, ${cp1x} ${p.y}, ${p.x} ${p.y}`;
    }, "");
  };

  const linePath = getCurvedPath(realPoints);
  const areaPath =
    realPoints.length > 0
      ? `${linePath} L ${realPoints[realPoints.length - 1].x} ${chartHeight - padding.bottom} L ${realPoints[0].x} ${chartHeight - padding.bottom} Z`
      : "";

  const handleSvgTouch = (event: any) => {
    if (!realPoints.length) return;
    const { locationX } = event.nativeEvent;

    // Encontrar el punto más cercano horizontalmente
    let closestIdx = 0;
    let minDistance = Math.abs(realPoints[0].x - locationX);

    for (let i = 1; i < realPoints.length; i++) {
      const dist = Math.abs(realPoints[i].x - locationX);
      if (dist < minDistance) {
        minDistance = dist;
        closestIdx = i;
      }
    }

    setActivePointIndex((prev) => (prev === closestIdx ? null : closestIdx));
  };

  const registrarElemento = () => {
    if (!cantidad || !nutrient) return;
    addHistory({
      sensor: title,
      elemento: nutrient,
      cantidad: Number(cantidad),
      fecha: new Date().toISOString(),
    });
    setCantidad("");
    router.push("../(tabs)/applicationHistory");
  };

  return (
    <View style={{ gap: 20 }}>
      {/* 1. TARJETA DE MÉTRICAS INDEPENDIENTE */}
      {showMetrics && (
        <View style={styles.metricsCard}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.sensorTitle}>{labelName.toUpperCase()}</Text>
              <Text style={styles.sensorSubtitle}>Último reporte de sensor</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: statusInfo.bg }]}>
              <Text style={[styles.badgeText, { color: statusInfo.color }]}>
                {statusInfo.label}
              </Text>
            </View>
          </View>
          <Text style={styles.label}>VALOR ACTUAL</Text>
          <Text style={styles.mainValue}>
            {lastValue.toFixed(1)}{" "}
            <Text style={{ color: "#64748b", fontSize: 22, fontWeight: "600" }}>{unit}</Text>
          </Text>

          <View style={styles.metricsList}>
            <View style={styles.metricRow}>
              <Text style={styles.mLabel}>Máximo Registrado</Text>
              <Text style={styles.mValue}>{maxValue.toFixed(1)} {unit}</Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.mLabel}>Mínimo Registrado</Text>
              <Text style={styles.mValue}>{minValue.toFixed(1)} {unit}</Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.mLabel}>Media Promedio</Text>
              <Text style={styles.mValue}>{avgValue.toFixed(1)} {unit}</Text>
            </View>
          </View>
        </View>
      )}

      {/* 2. TARJETA DE GRÁFICA INDEPENDIENTE */}
      <View style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <View>
            <Text style={styles.chartTitle}>{chartTitleText}</Text>
            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.dot, { backgroundColor: theme.color }]} />
                <Text style={styles.legendText}>MEDIDA</Text>
              </View>
              {isIdealInterface && (
                <View style={styles.legendItem}>
                  <View style={[styles.dot, styles.dotIdeal]} />
                  <Text style={styles.legendText}>IDEAL</Text>
                </View>
              )}
            </View>
          </View>
          <View style={styles.zoomControls}>
            <Pressable style={styles.zoomBtn} onPress={zoomIn}>
              <Text style={styles.zoomText}>+</Text>
            </Pressable>
            <Pressable style={styles.zoomBtn} onPress={zoomOut}>
              <Text style={styles.zoomText}>−</Text>
            </Pressable>
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          onScroll={(e) => {
            scrollX.current = e.nativeEvent.contentOffset.x;
          }}
          scrollEventThrottle={16}
        >
          <Svg
            width={chartWidth}
            height={chartHeight}
            onTouchEnd={handleSvgTouch}
          >
            <Defs>
              <LinearGradient id={`grad-${title.replace(/\s+/g, '-')}`} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={theme.color} stopOpacity="0.20" />
                <Stop offset="1" stopColor={theme.color} stopOpacity="0" />
              </LinearGradient>
            </Defs>

            {/* 1. Dotted Grid Subdivision Lines (5-tier system) */}
            {[0, 0.25, 0.5, 0.75, 1].map((p, i) => (
              <Line
                key={i}
                x1={padding.left}
                y1={
                  padding.top + (chartHeight - padding.top - padding.bottom) * p
                }
                x2={chartWidth - padding.right}
                y2={
                  padding.top + (chartHeight - padding.top - padding.bottom) * p
                }
                stroke="#e2e8f0"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
            ))}

            {/* Vertical Grid Ticks for Date Alignment */}
            {(() => {
              const ticksToDraw: number[] = [];
              let lastDrawnX = 9999;
              const minPixelDistance = 50;
              const step = Math.ceil(realPoints.length / (5 * zoom));

              if (realPoints.length > 0) {
                ticksToDraw.push(realPoints.length - 1);
                lastDrawnX = realPoints[realPoints.length - 1].x;
              }

              for (let i = realPoints.length - 2; i >= 0; i--) {
                const p = realPoints[i];
                const isFirst = i === 0;
                const isRegularTick = i % step === 0;

                if (isRegularTick || isFirst) {
                  if (lastDrawnX - p.x >= minPixelDistance) {
                    if (isFirst) {
                      ticksToDraw.push(i);
                      lastDrawnX = p.x;
                    } else {
                      const closeToStart = (p.x - realPoints[0].x < minPixelDistance);
                      if (!closeToStart) {
                        ticksToDraw.push(i);
                        lastDrawnX = p.x;
                      }
                    }
                  }
                }
              }

              const firstIdx = 0;
              const hasFirst = ticksToDraw.includes(firstIdx);
              if (!hasFirst && realPoints.length > 0) {
                const leftMostX = Math.min(...ticksToDraw.map(idx => realPoints[idx].x));
                if (leftMostX - realPoints[firstIdx].x >= minPixelDistance) {
                  ticksToDraw.push(firstIdx);
                }
              }

              ticksToDraw.sort((a, b) => a - b);

              return ticksToDraw.map((idx) => {
                const p = realPoints[idx];
                return (
                  <Line
                    key={`v-grid-${idx}`}
                    x1={p.x}
                    y1={padding.top}
                    x2={p.x}
                    y2={chartHeight - padding.bottom}
                    stroke="#e2e8f0"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                    strokeOpacity="0.7"
                  />
                );
              });
            })()}

            {/* 2. Solid Axis Boundaries */}
            <Line
              x1={padding.left}
              y1={chartHeight - padding.bottom}
              x2={chartWidth - padding.right}
              y2={chartHeight - padding.bottom}
              stroke="#cbd5e1"
              strokeWidth="1.5"
            />
            <Line
              x1={padding.left}
              y1={padding.top}
              x2={padding.left}
              y2={chartHeight - padding.bottom}
              stroke="#cbd5e1"
              strokeWidth="1.5"
            />

            {/* 3. Linear Gradient Fill Area */}
            <Path d={areaPath} fill={`url(#grad-${title.replace(/\s+/g, '-')})`} />

            {/* 4. Glow Drop Shadow & Main Path Curve */}
            <Path
              d={linePath}
              fill="none"
              stroke={theme.color}
              strokeWidth="6"
              strokeOpacity="0.12"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Path
              d={linePath}
              fill="none"
              stroke={theme.color}
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* 5. Ideal Curve Dashed Line (if on Ideal screen) */}
            {isIdealInterface && (
              <Path
                d={getCurvedPath(idealPoints)}
                fill="none"
                stroke="#64748b"
                strokeWidth="2.5"
                strokeDasharray="6 4"
                strokeOpacity="0.75"
              />
            )}

            {/* Markers for Registered History Applications (Fertilizations) */}
            {isIdealInterface && (() => {
              const relevantHistory = historyItems.filter(
                (item: HistoryItem) =>
                  item.sensor === title &&
                  item.elemento ===
                  (nutrient ||
                    (metric === "Nitrogeno"
                      ? "N"
                      : metric === "Fosforo"
                        ? "P"
                        : metric === "Potasio"
                          ? "K"
                          : null))
              );

              const findClosestDateIndex = (historyDateStr: string) => {
                if (!labels || labels.length === 0) return -1;
                const historyTime = new Date(historyDateStr).getTime();

                let closestIdx = 0;
                let minDiff = Math.abs(new Date(labels[0]).getTime() - historyTime);

                for (let i = 1; i < labels.length; i++) {
                  const diff = Math.abs(new Date(labels[i]).getTime() - historyTime);
                  if (diff < minDiff) {
                    minDiff = diff;
                    closestIdx = i;
                  }
                }
                return closestIdx;
              };

              return relevantHistory.map((item: HistoryItem, hIdx: number) => {
                const idx = findClosestDateIndex(item.fecha);
                if (idx === -1 || idx >= realPoints.length) return null;
                const point = realPoints[idx];
                if (!point) return null;

                const markerX = point.x;
                const markerY = point.y;

                return (
                  <G key={`hist-marker-${hIdx}`}>
                    {/* Vertical line from bottom axis to the point */}
                    <Line
                      x1={markerX}
                      y1={markerY}
                      x2={markerX}
                      y2={chartHeight - padding.bottom}
                      stroke="#f59e0b"
                      strokeWidth="1.5"
                      strokeDasharray="3 3"
                    />
                    {/* Special marker circle on the curve */}
                    <Circle
                      cx={markerX}
                      cy={markerY}
                      r="6"
                      fill="#ffffff"
                      stroke="#f59e0b"
                      strokeWidth="2.5"
                    />
                    {/* Outer ring for marker */}
                    <Circle
                      cx={markerX}
                      cy={markerY}
                      r="10"
                      fill="#f59e0b"
                      fillOpacity="0.15"
                    />
                    {/* Small triangle/connector pointing to the circle */}
                    <Path
                      d={`M ${markerX - 4} ${markerY - 9} L ${markerX + 4} ${markerY - 9} L ${markerX} ${markerY - 5} Z`}
                      fill="#f59e0b"
                    />
                    {/* Small text badge showing quantity right above the marker on the curve */}
                    <Rect
                      x={markerX - 17}
                      y={markerY - 23}
                      width="34"
                      height="14"
                      rx="4"
                      fill="#f59e0b"
                    />
                    <SvgText
                      x={markerX}
                      y={markerY - 13}
                      fontSize="8"
                      fontWeight="800"
                      fill="#ffffff"
                      textAnchor="middle"
                    >
                      {`+${item.cantidad}`}
                    </SvgText>
                  </G>
                );
              });
            })()}

            {/* Guide Lines (Crosshairs) for the Active/Selected Point */}
            {activePointIndex !== null && realPoints.length > 0 && (() => {
              const activePoint = realPoints[activePointIndex];
              if (!activePoint) return null;

              return (
                <G>
                  {/* Vertical Guide */}
                  <Line
                    x1={activePoint.x}
                    y1={padding.top}
                    x2={activePoint.x}
                    y2={chartHeight - padding.bottom}
                    stroke="#cbd5e1"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                  />
                  {/* Horizontal Guide */}
                  <Line
                    x1={padding.left}
                    y1={activePoint.y}
                    x2={activePoint.x}
                    y2={activePoint.y}
                    stroke="#cbd5e1"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                  />
                </G>
              );
            })()}

            {/* Y-Axis Unit Label at the top */}
            <SvgText
              x={padding.left - 5}
              y={padding.top - 14}
              fontSize="9"
              fontWeight="800"
              fill="#64748b"
              textAnchor="end"
            >
              {unit}
            </SvgText>

            {/* 6. Dynamic Y-Axis Metric Labels */}
            {[0, 0.25, 0.5, 0.75, 1].map((p, i) => (
              <SvgText
                key={i}
                x={padding.left - 5}
                y={
                  padding.top +
                  (chartHeight - padding.top - padding.bottom) -
                  p * (chartHeight - padding.top - padding.bottom) +
                  4
                }
                fontSize="10"
                fontWeight="700"
                fill="#94a3b8"
                textAnchor="end"
              >
                {Math.round(yMax * p)}
              </SvgText>
            ))}

            {/* 7. Date X-Axis Ticks */}
            {(() => {
              const ticksToDraw: number[] = [];
              let lastDrawnX = 9999;
              const minPixelDistance = 50;
              const step = Math.ceil(realPoints.length / (5 * zoom));

              if (realPoints.length > 0) {
                ticksToDraw.push(realPoints.length - 1);
                lastDrawnX = realPoints[realPoints.length - 1].x;
              }

              for (let i = realPoints.length - 2; i >= 0; i--) {
                const p = realPoints[i];
                const isFirst = i === 0;
                const isRegularTick = i % step === 0;

                if (isRegularTick || isFirst) {
                  if (lastDrawnX - p.x >= minPixelDistance) {
                    if (isFirst) {
                      ticksToDraw.push(i);
                      lastDrawnX = p.x;
                    } else {
                      const closeToStart = (p.x - realPoints[0].x < minPixelDistance);
                      if (!closeToStart) {
                        ticksToDraw.push(i);
                        lastDrawnX = p.x;
                      }
                    }
                  }
                }
              }

              const firstIdx = 0;
              const hasFirst = ticksToDraw.includes(firstIdx);
              if (!hasFirst && realPoints.length > 0) {
                const leftMostX = Math.min(...ticksToDraw.map(idx => realPoints[idx].x));
                if (leftMostX - realPoints[firstIdx].x >= minPixelDistance) {
                  ticksToDraw.push(firstIdx);
                }
              }

              ticksToDraw.sort((a, b) => a - b);

              return ticksToDraw.map((idx) => {
                const p = realPoints[idx];
                const isFirst = idx === 0;
                const isLast = idx === realPoints.length - 1;
                let anchor: "start" | "middle" | "end" = "middle";
                if (isFirst) anchor = "start";
                else if (isLast) anchor = "end";

                return (
                  <SvgText
                    key={idx}
                    x={p.x}
                    y={chartHeight - 12}
                    fontSize="10"
                    fontWeight="800"
                    fill="#64748b"
                    textAnchor={anchor}
                  >
                    {formatAxisDate(labels[idx])}
                  </SvgText>
                );
              });
            })()}

            {/* 8. Crisp Rounded Data Markers */}
            {realPoints.map((p, idx) => {
              const isActive = activePointIndex === idx;
              return (
                <G key={idx}>
                  {isActive && (
                    <Circle
                      cx={p.x}
                      cy={p.y}
                      r="8"
                      fill={theme.color}
                      fillOpacity="0.25"
                    />
                  )}
                  <Circle
                    cx={p.x}
                    cy={p.y}
                    r={isActive ? "5.5" : "4"}
                    fill="#ffffff"
                    stroke={isActive ? theme.stroke : theme.color}
                    strokeWidth={isActive ? "3" : "2.5"}
                  />
                </G>
              );
            })}

            {/* 9. Glowing Tooltip Bubble for the Active Point */}
            {activePointIndex !== null && realPoints.length > 0 && (() => {
              const activePoint = realPoints[activePointIndex];
              if (!activePoint) return null;

              const activeValue = cleanReal[activePointIndex];
              const activeLabel = validDataPoints[activePointIndex]?.label || "";

              const boxW = 110;
              const boxH = 48;
              let tooltipX = activePoint.x - boxW / 2;
              let tooltipY = activePoint.y - boxH - 12;

              // Edge collision protection
              if (tooltipX < padding.left) tooltipX = padding.left;
              if (tooltipX + boxW > chartWidth - padding.right) tooltipX = chartWidth - padding.right - boxW;
              if (tooltipY < padding.top) tooltipY = activePoint.y + 12;

              return (
                <G pointerEvents="none">
                  <Rect
                    x={tooltipX}
                    y={tooltipY}
                    width={boxW}
                    height={boxH}
                    rx="8"
                    fill="#0f172a"
                  />
                  <SvgText
                    x={tooltipX + boxW / 2}
                    y={tooltipY + 13}
                    fontSize="9.5"
                    fontWeight="800"
                    fill="#94a3b8"
                    textAnchor="middle"
                  >
                    {labelName.toUpperCase()}
                  </SvgText>
                  <SvgText
                    x={tooltipX + boxW / 2}
                    y={tooltipY + 28}
                    fontSize="12"
                    fontWeight="900"
                    fill="#ffffff"
                    textAnchor="middle"
                  >
                    {activeValue.toFixed(1)}
                    <TSpan fontSize="9" fontWeight="700" fill="#94a3b8"> {unit}</TSpan>
                  </SvgText>
                  <SvgText
                    x={tooltipX + boxW / 2}
                    y={tooltipY + 41}
                    fontSize="8.5"
                    fontWeight="700"
                    fill="#94a3b8"
                    textAnchor="middle"
                  >
                    {formatFriendlyDate(activeLabel)}
                  </SvgText>
                </G>
              );
            })()}

            {/* 10. Transparent Touch Target Zones for Interactive Selection */}
            {realPoints.map((p, idx) => (
              <Circle
                key={`touch-${idx}`}
                cx={p.x}
                cy={p.y}
                r="22"
                fill="transparent"
                onPress={() => setActivePointIndex((prev) => (prev === idx ? null : idx))}
              />
            ))}
          </Svg>
        </ScrollView>

        {/* 3. SECCIÓN DE REGISTRO INTEGRADA */}
        {isIdealInterface && (
          <View style={styles.integratedUpdateSection}>
            <View style={styles.updateHeader}>
              <View style={[styles.iconCircle, { backgroundColor: theme.color + "15" }]}>
                <Text style={{ fontSize: 16 }}>📝</Text>
              </View>
              <View>
                <Text style={styles.updateTitle}>Registrar Aplicación</Text>
                <Text style={styles.updateSubtitle}>Dosificación de Nutrientes</Text>
              </View>
            </View>
            <Text style={styles.inputLabel}>CANTIDAD APLICADA DE {nutrient}</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="0.00"
                keyboardType="numeric"
                value={cantidad}
                onChangeText={setCantidad}
                placeholderTextColor="#94a3b8"
              />
              <Text style={styles.unitText}>mg/kg</Text>
            </View>
            <Pressable style={[styles.saveBtn, { backgroundColor: theme.color }]} onPress={registrarElemento}>
              <Text style={styles.saveBtnText}>Guardar Registro ✓</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

/* =========================
   ESTILOS REDISEÑADOS ESPACIOSOS
========================= */
const styles = StyleSheet.create({
  metricRow: { flexDirection: "row", justifyContent: "space-between" },
  mLabel: { color: "#64748b", fontSize: 13, fontWeight: "600" },
  mValue: { fontWeight: "700", color: "#1e293b", fontSize: 13 },

  metricsCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 24,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#0f172a",
    shadowOpacity: 0.03,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sensorTitle: { fontSize: 18, fontWeight: "800", color: "#0f172a", letterSpacing: -0.5 },
  sensorSubtitle: { fontSize: 11, color: "#94a3b8", fontWeight: "700", marginTop: 2 },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  badgeText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  label: { fontSize: 9, fontWeight: "800", color: "#94a3b8", letterSpacing: 0.5, marginTop: 16 },
  mainValue: { fontSize: 38, fontWeight: "800", color: "#020617", marginTop: 4 },
  unit: { color: "#166534" },
  metricsList: {
    marginTop: 20,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingTop: 15,
  },

  chartCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    paddingVertical: 20,
    paddingHorizontal: 12,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#0f172a",
    shadowOpacity: 0.03,
    shadowRadius: 16,
  },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  chartTitle: { fontSize: 15, fontWeight: "800", color: "#1e293b" },
  legendRow: { flexDirection: "row", gap: 12, marginTop: 6 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotIdeal: {
    borderWidth: 1,
    borderColor: "#94a3b8",
    borderStyle: "dashed",
    backgroundColor: "transparent",
  },
  legendText: { fontSize: 9, fontWeight: "800", color: "#94a3b8", letterSpacing: 0.5 },
  zoomControls: { flexDirection: "row", gap: 8 },
  zoomBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  zoomText: { fontSize: 16, fontWeight: "600", color: "#1e293b" },

  integratedUpdateSection: {
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingTop: 20,
    marginTop: 15,
    paddingHorizontal: 8,
  },
  updateHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  updateTitle: { fontSize: 15, fontWeight: "800", color: "#1e293b" },
  updateSubtitle: { fontSize: 10, color: "#94a3b8", fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2 },
  inputLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: "#94a3b8",
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  input: {
    flex: 1,
    height: 48,
    fontSize: 16,
    fontWeight: "700",
    color: "#1e293b",
  },
  unitText: { color: "#64748b", fontWeight: "700", fontSize: 12 },
  saveBtn: {
    height: 48,
    borderRadius: 24,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  saveBtnText: { color: "#fff", fontSize: 14, fontWeight: "800" },
});
