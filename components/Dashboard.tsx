"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Title,
} from "chart.js";
import { Bar, Doughnut, Pie } from "react-chartjs-2";
import { median, countBy, round, formatChartLabel } from "@/lib/stats";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Title
);

// ---- Tipos ----
type Registro = Record<string, string>;

type ApiResponse = {
  ok: boolean;
  count?: number;
  updatedAt?: string;
  data: Registro[];
  error?: string;
};

const TODOS = "Todos";

// Paleta corporativa moderna (Verde azulado CREOTEC + Acentos vibrantes)
const PALETTE = [
  "#14B8A6", // teal-500
  "#0EA5E9", // sky-500
  "#2DD4BF", // teal-400
  "#6366F1", // indigo-500
  "#38BDF8", // sky-400
  "#A855F7", // purple-500
  "#F59E0B", // amber-500
  "#EC4899", // pink-500
  "#10B981", // emerald-500
  "#8B5CF6", // violet-500
];

export default function Dashboard() {
  const [rows, setRows] = useState<Registro[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  // Filtros dinámicos
  const [anio, setAnio] = useState(TODOS);
  const [mes, setMes] = useState(TODOS);
  const [ciudad, setCiudad] = useState(TODOS);
  const [franja, setFranja] = useState(TODOS);

  // Tabla y Búsqueda
  const [busqueda, setBusqueda] = useState("");
  const [pagina, setPagina] = useState(1);
  const ELEMS_POR_PAGINA = 10;

  // Integración n8n
  const [triggeringN8n, setTriggeringN8n] = useState(false);
  const [n8nNotification, setN8nNotification] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  async function triggerN8nWorkflow() {
    setTriggeringN8n(true);
    setN8nNotification(null);
    try {
      const res = await fetch("/api/n8n", { method: "POST" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Error al disparar n8n");
      
      setN8nNotification({
        type: "success",
        text: "¡Flujo de n8n activado con éxito! Sincronizando datos en 15 segundos...",
      });
      
      // Auto-refrescar datos después de ejecutar flujo
      setTimeout(() => {
        fetchData();
      }, 15000);
    } catch (e) {
      setN8nNotification({
        type: "error",
        text: e instanceof Error ? e.message : "Error desconocido al llamar a n8n",
      });
    } finally {
      setTriggeringN8n(false);
    }
  }

  useEffect(() => {
    if (n8nNotification) {
      const timer = setTimeout(() => {
        setN8nNotification(null);
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [n8nNotification]);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/sheets", { cache: "no-store" });
      const json: ApiResponse = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Error al obtener datos");
      setRows(json.data ?? []);
      setUpdatedAt(json.updatedAt ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  // === REGLA DE NEGOCIO: filtro base OCULTO por País = BO / Bolivia ===
  const baseBolivia = useMemo(
    () =>
      rows.filter((r) => {
        const p = (r.pais ?? "").trim().toLowerCase();
        return p === "bo" || p === "bolivia";
      }),
    [rows]
  );

  // Opciones de filtros (derivadas SOLO de la data boliviana)
  const opciones = useMemo(() => {
    const uniq = (key: string) =>
      [TODOS, ...new Set(baseBolivia.map((r) => (r[key] ?? "").trim()).filter(Boolean))];
    return {
      anios: uniq("anio"),
      meses: uniq("mes"),
      ciudades: uniq("ciudad"),
      franjas: uniq("franjaHoraria"),
    };
  }, [baseBolivia]);

  // Aplica los filtros dinámicos seleccionados
  const filtered = useMemo(() => {
    return baseBolivia.filter((r) => {
      if (anio !== TODOS && (r.anio ?? "").trim() !== anio) return false;
      if (mes !== TODOS && (r.mes ?? "").trim() !== mes) return false;
      if (ciudad !== TODOS && (r.ciudad ?? "").trim() !== ciudad) return false;
      if (franja !== TODOS && (r.franjaHoraria ?? "").trim() !== franja)
        return false;
      return true;
    });
  }, [baseBolivia, anio, mes, ciudad, franja]);

  // Resetear página cuando cambian los filtros
  useEffect(() => {
    setPagina(1);
  }, [anio, mes, ciudad, franja, busqueda]);

  // === KPIs ===
  const kpis = useMemo(() => {
    const total = filtered.length;
    const calificados = filtered.filter(
      (r) => (r.tipoLead ?? "").trim().toLowerCase() === "calificado"
    ).length;
    const conversion = total > 0 ? (calificados / total) * 100 : 0;

    const medianaRespuesta = median(
      filtered.map((r) => r.tiempoPrimeraRespuesta)
    );
    const medianaResolucion = median(filtered.map((r) => r.tiempoResolucion));

    return {
      total,
      conversion: round(conversion, 1),
      medianaRespuesta: round(medianaRespuesta, 0),
      medianaResolucion: round(medianaResolucion, 2),
    };
  }, [filtered]);

  // === Datasets de los gráficos ===
  const secciones = useMemo(
    () => countBy(filtered.map((r) => r.seccion), { limit: 8 }),
    [filtered]
  );
  const leads = useMemo(
    () => countBy(filtered.map((r) => r.tipoLead)),
    [filtered]
  );
  const sentimientos = useMemo(
    () => countBy(filtered.map((r) => r.sentimiento)),
    [filtered]
  );
  const ciudades = useMemo(
    () => countBy(filtered.map((r) => r.ciudad)),
    [filtered]
  );

  // === Paginación y búsqueda de la tabla ===
  const registrosTabla = useMemo(() => {
    if (!busqueda.trim()) return filtered;
    const term = busqueda.toLowerCase();
    return filtered.filter((r) =>
      Object.values(r).some((val) => String(val ?? "").toLowerCase().includes(term))
    );
  }, [filtered, busqueda]);

  const totalPaginas = Math.max(1, Math.ceil(registrosTabla.length / ELEMS_POR_PAGINA));
  const registrosPagina = useMemo(() => {
    const inicio = (pagina - 1) * ELEMS_POR_PAGINA;
    return registrosTabla.slice(inicio, inicio + ELEMS_POR_PAGINA);
  }, [registrosTabla, pagina]);

  const resetFiltros = () => {
    setAnio(TODOS);
    setMes(TODOS);
    setCiudad(TODOS);
    setFranja(TODOS);
    setBusqueda("");
  };

  const hasActiveFilters =
    anio !== TODOS || mes !== TODOS || ciudad !== TODOS || franja !== TODOS || busqueda !== "";

  return (
    <div className="min-h-screen pb-12 font-sans">
      {/* ===== Barra superior corporativa ===== */}
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-900/90 backdrop-blur-xl shadow-2xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-teal-600 to-emerald-400 font-display text-2xl font-black text-white shadow-lg shadow-teal-500/30">
              C
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-xl font-bold tracking-tight text-white sm:text-2xl">
                  CREOTEC <span className="text-teal-400">·</span> Dashboard Operativo
                </h1>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  En vivo
                </span>
              </div>
              <p className="text-xs text-slate-400 sm:text-sm">
                Gestión de Prótesis y Plantillas · Bolivia
                {updatedAt && (
                  <span className="ml-2 inline-block rounded bg-slate-800 px-2 py-0.5 text-[11px] font-mono text-teal-300">
                    ↻ {new Date(updatedAt).toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </span>
                )}
              </p>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={triggerN8nWorkflow}
              disabled={triggeringN8n}
              className="group inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-5 py-2.5 text-sm font-semibold text-slate-200 shadow-md transition hover:bg-slate-700 hover:text-white active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {triggeringN8n ? (
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-500 border-t-teal-400"></span>
              ) : (
                <span className="text-teal-400 text-base">⚡</span>
              )}
              {triggeringN8n ? "Ejecutando..." : "Ejecutar n8n"}
            </button>

            <button
              onClick={fetchData}
              disabled={loading}
              className="group inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-teal-500/25 transition-all duration-200 hover:from-teal-500 hover:to-emerald-400 hover:shadow-teal-500/40 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <svg
                className={`h-4 w-4 transition-transform duration-500 ${loading ? "animate-spin" : "group-hover:rotate-180"}`}
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {loading ? "Sincronizando…" : "Sincronizar Sheets"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        {n8nNotification && (
          <div
            className={`mb-6 flex items-center justify-between gap-3 rounded-2xl border p-4 text-sm backdrop-blur-md shadow-lg transition-all animate-fadeIn ${
              n8nNotification.type === "success"
                ? "border-teal-500/40 bg-teal-500/10 text-teal-300"
                : "border-red-500/40 bg-red-500/10 text-red-300"
            }`}
          >
            <div className="flex items-center gap-2">
              <span>{n8nNotification.type === "success" ? "⚡" : "⚠️"}</span>
              <div>
                <strong className="font-semibold">{n8nNotification.type === "success" ? "Éxito:" : "Error:"}</strong>
                <p className="mt-0.5 text-xs opacity-90">{n8nNotification.text}</p>
              </div>
            </div>
            <button
              onClick={() => setN8nNotification(null)}
              className="text-xs font-bold hover:text-white bg-white/10 hover:bg-white/20 rounded px-1.5 py-0.5"
            >
              ✕
            </button>
          </div>
        )}

        {error && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300 backdrop-blur-md shadow-lg animate-fadeIn">
            <span className="text-xl">⚠️</span>
            <div>
              <strong className="font-semibold text-red-200">Error de conexión con Google Sheets:</strong>
              <p className="mt-0.5 text-xs opacity-90">{error}</p>
            </div>
          </div>
        )}

        {/* ===== Filtros dinámicos ===== */}
        <section className="mb-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl backdrop-blur-xl transition-all hover:border-slate-700/80">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-500/20 text-teal-400 text-sm">🎛️</span>
              <h2 className="font-display text-base font-bold text-slate-200">Segmentación de Datos</h2>
            </div>
            {hasActiveFilters && (
              <button
                onClick={resetFiltros}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-medium text-red-300 transition hover:bg-red-500/20"
              >
                ✕ Restablecer filtros
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Select
              label="Año"
              value={anio}
              onChange={setAnio}
              options={opciones.anios}
              icon="📅"
            />
            <Select
              label="Mes"
              value={mes}
              onChange={setMes}
              options={opciones.meses}
              icon="🗓️"
            />
            <Select
              label="Ciudad"
              value={ciudad}
              onChange={setCiudad}
              options={opciones.ciudades}
              icon="📍"
            />
            <Select
              label="Franja Horaria"
              value={franja}
              onChange={setFranja}
              options={opciones.franjas}
              icon="⏰"
            />
          </div>

          <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-xl bg-slate-950/50 px-4 py-2.5 text-xs text-slate-400 border border-slate-800/80">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-teal-400"></span>
              <span>
                Mostrando <strong className="text-teal-300 font-mono text-sm">{filtered.length}</strong> de{" "}
                <span className="text-slate-300">{baseBolivia.length}</span> registros en Bolivia
              </span>
            </div>
            <span className="text-slate-500 text-[11px] italic">Filtro automático país = BO activo</span>
          </div>
        </section>

        {/* ===== KPIs ===== */}
        <section className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            title="Total Interacciones"
            value={kpis.total.toLocaleString("es-BO")}
            hint="Total de registros en selección"
            icon="💬"
            gradient="from-teal-500/20 to-emerald-500/5"
            border="border-t-teal-500"
          />
          <KpiCard
            title="Tasa de Conversión"
            value={`${kpis.conversion}%`}
            hint="Leads clasificados como 'Calificado'"
            icon="🎯"
            gradient="from-sky-500/20 to-blue-500/5"
            border="border-t-sky-500"
          />
          <KpiCard
            title="Mediana 1ra Respuesta"
            value={`${kpis.medianaRespuesta} min`}
            hint="Tiempo típico de atención inicial"
            icon="⚡"
            gradient="from-amber-500/20 to-yellow-500/5"
            border="border-t-amber-500"
          />
          <KpiCard
            title="Mediana Resolución"
            value={`${kpis.medianaResolucion} días`}
            hint="Tiempo típico de cierre de caso"
            icon="✅"
            gradient="from-purple-500/20 to-indigo-500/5"
            border="border-t-purple-500"
          />
        </section>

        {/* ===== Gráficos ===== */}
        {loading && rows.length === 0 ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-96 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/50"
              />
            ))}
          </div>
        ) : (
          <section className="mb-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Barras horizontales: Secciones más solicitadas */}
            <ChartCard title="Secciones Más Solicitadas" subtitle="Top categorías solicitadas por los pacientes">
              <Bar
                data={{
                  labels: secciones.map(([l]) => formatChartLabel(l, 25)),
                  datasets: [
                    {
                      label: "Interacciones",
                      data: secciones.map(([, v]) => v),
                      backgroundColor: "#14B8A6", // teal-500
                      hoverBackgroundColor: "#2DD4BF",
                      borderRadius: 8,
                      barThickness: "flex" as const,
                      maxBarThickness: 32,
                    },
                  ],
                }}
                options={{
                  indexAxis: "y" as const,
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      backgroundColor: "#0F172A",
                      borderColor: "#334155",
                      borderWidth: 1,
                      padding: 12,
                      titleFont: { size: 13, weight: "bold", family: "var(--font-inter)" },
                      bodyFont: { size: 12, family: "var(--font-inter)" },
                      cornerRadius: 10,
                      callbacks: {
                        title: (tooltipItems: any[]) => {
                          const idx = tooltipItems[0]?.dataIndex;
                          return secciones[idx] ? secciones[idx][0] : String(tooltipItems[0]?.label || "");
                        },
                        label: (context: any) => {
                          const val = context.parsed.x || 0;
                          const total = secciones.reduce((acc, [, v]) => acc + v, 0);
                          const pct = total > 0 ? ((val / total) * 100).toFixed(1) : "0";
                          return ` Solicitudes: ${val} (${pct}%)`;
                        },
                      },
                    },
                  },
                  scales: {
                    x: {
                      beginAtZero: true,
                      ticks: { precision: 0, font: { family: "var(--font-inter)", size: 11 }, color: "#94A3B8" },
                      grid: { color: "rgba(51, 65, 85, 0.3)" },
                    },
                    y: {
                      ticks: {
                        font: { size: 12, weight: 500, family: "var(--font-inter)" },
                        color: "#E2E8F0",
                        autoSkip: false,
                        padding: 10,
                      },
                      grid: { display: false },
                    },
                  },
                  layout: { padding: { left: 10, right: 20, top: 5, bottom: 5 } },
                }}
              />
            </ChartCard>

            {/* Doughnut: Calidad del Lead */}
            <ChartCard title="Calidad del Lead" subtitle="Clasificación comercial de los contactos recibidos">
              <Doughnut
                data={{
                  labels: leads.map(([l]) => l),
                  datasets: [
                    {
                      data: leads.map(([, v]) => v),
                      backgroundColor: PALETTE,
                      borderWidth: 2,
                      borderColor: "#0F172A",
                      hoverOffset: 6,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: "bottom" as const,
                      labels: {
                        color: "#E2E8F0",
                        font: { size: 12, family: "var(--font-inter)" },
                        padding: 16,
                        usePointStyle: true,
                      },
                    },
                    tooltip: {
                      backgroundColor: "#0F172A",
                      borderColor: "#334155",
                      borderWidth: 1,
                      padding: 12,
                      cornerRadius: 10,
                      callbacks: {
                        label: (context: any) => {
                          const val = context.parsed || 0;
                          const total = leads.reduce((acc, [, v]) => acc + v, 0);
                          const pct = total > 0 ? ((val / total) * 100).toFixed(1) : "0";
                          return ` ${context.label}: ${val} leads (${pct}%)`;
                        },
                      },
                    },
                  },
                }}
              />
            </ChartCard>

            {/* Pie: Sentimiento del Cliente */}
            <ChartCard title="Sentimiento del Cliente" subtitle="Percepción general expresada por los usuarios en consulta">
              <Pie
                data={{
                  labels: sentimientos.map(([l]) => l),
                  datasets: [
                    {
                      data: sentimientos.map(([, v]) => v),
                      backgroundColor: PALETTE.slice(2),
                      borderWidth: 2,
                      borderColor: "#0F172A",
                      hoverOffset: 6,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: "bottom" as const,
                      labels: {
                        color: "#E2E8F0",
                        font: { size: 12, family: "var(--font-inter)" },
                        padding: 16,
                        usePointStyle: true,
                      },
                    },
                    tooltip: {
                      backgroundColor: "#0F172A",
                      borderColor: "#334155",
                      borderWidth: 1,
                      padding: 12,
                      cornerRadius: 10,
                      callbacks: {
                        label: (context: any) => {
                          const val = context.parsed || 0;
                          const total = sentimientos.reduce((acc, [, v]) => acc + v, 0);
                          const pct = total > 0 ? ((val / total) * 100).toFixed(1) : "0";
                          return ` ${context.label}: ${val} casos (${pct}%)`;
                        },
                      },
                    },
                  },
                }}
              />
            </ChartCard>

            {/* Barras: Distribución geográfica (Ciudades) */}
            <ChartCard title="Distribución Geográfica (Ciudades)" subtitle="Volumen de solicitudes por ciudad de origen">
              <Bar
                data={{
                  labels: ciudades.map(([l]) => formatChartLabel(l, 18)),
                  datasets: [
                    {
                      label: "Interacciones",
                      data: ciudades.map(([, v]) => v),
                      backgroundColor: "#0EA5E9", // sky-500
                      hoverBackgroundColor: "#38BDF8",
                      borderRadius: 8,
                      maxBarThickness: 40,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      backgroundColor: "#0F172A",
                      borderColor: "#334155",
                      borderWidth: 1,
                      padding: 12,
                      cornerRadius: 10,
                      callbacks: {
                        title: (tooltipItems: any[]) => {
                          const idx = tooltipItems[0]?.dataIndex;
                          return ciudades[idx] ? ciudades[idx][0] : String(tooltipItems[0]?.label || "");
                        },
                        label: (context: any) => {
                          const val = context.parsed.y || 0;
                          const total = ciudades.reduce((acc, [, v]) => acc + v, 0);
                          const pct = total > 0 ? ((val / total) * 100).toFixed(1) : "0";
                          return ` Interacciones: ${val} (${pct}%)`;
                        },
                      },
                    },
                  },
                  scales: {
                    x: {
                      ticks: { font: { family: "var(--font-inter)", size: 11 }, color: "#E2E8F0" },
                      grid: { display: false },
                    },
                    y: {
                      beginAtZero: true,
                      ticks: { precision: 0, font: { family: "var(--font-inter)", size: 11 }, color: "#94A3B8" },
                      grid: { color: "rgba(51, 65, 85, 0.3)" },
                    },
                  },
                  layout: { padding: { top: 10, bottom: 5, left: 5, right: 10 } },
                }}
              />
            </ChartCard>
          </section>
        )}

        {/* ===== Tabla de Registros e Interacciones ===== */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-2xl backdrop-blur-xl">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 pb-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400 text-sm">📋</span>
                <h3 className="font-display text-lg font-bold text-slate-100">Registros e Interacciones en Tiempo Real</h3>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Inspección detallada de pacientes, tiempos de atención y motivo de consulta ({registrosTabla.length} resultados)
              </p>
            </div>

            <div className="relative w-full sm:w-72">
              <input
                type="text"
                placeholder="🔍 Buscar paciente, sección, ciudad..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full rounded-xl border border-slate-700/80 bg-slate-950/80 py-2 pl-3 pr-9 text-sm text-slate-200 placeholder-slate-500 outline-none transition focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
              />
              {busqueda && (
                <button
                  onClick={() => setBusqueda("")}
                  className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {registrosPagina.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">
              No se encontraron registros que coincidan con los criterios seleccionados.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-xl border border-slate-800/80">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="border-b border-slate-800 bg-slate-950/90 font-display uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="px-4 py-3.5">Fecha / Hora</th>
                      <th className="px-4 py-3.5">Paciente</th>
                      <th className="px-4 py-3.5">Sección Solicitada</th>
                      <th className="px-4 py-3.5">Ciudad</th>
                      <th className="px-4 py-3.5">Calificación</th>
                      <th className="px-4 py-3.5">1ra Resp.</th>
                      <th className="px-4 py-3.5">Resolución</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50 bg-slate-900/40">
                    {registrosPagina.map((row, idx) => {
                      const calificado = (row.tipoLead ?? "").trim().toLowerCase() === "calificado";
                      return (
                        <tr key={idx} className="transition-colors hover:bg-slate-800/50">
                          <td className="whitespace-nowrap px-4 py-3 font-mono text-[11px] text-slate-400">
                            {row.fechaRegistro || "—"} <span className="opacity-70">({row.horaInicio || "—"})</span>
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-200">
                            {row.nombrePaciente || "Anónimo / Sin nombre"}
                          </td>
                          <td className="max-w-xs truncate px-4 py-3 text-teal-300" title={row.seccion}>
                            {row.seccion || "—"}
                          </td>
                          <td className="px-4 py-3 text-slate-300">{row.ciudad || "—"}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                                calificado
                                  ? "border border-teal-500/30 bg-teal-500/20 text-teal-300 shadow-sm shadow-teal-500/10"
                                  : "border border-slate-700 bg-slate-800 text-slate-400"
                              }`}
                            >
                              {row.tipoLead || "Sin clasificar"}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 font-mono text-slate-300">
                            {row.tiempoPrimeraRespuesta && row.tiempoPrimeraRespuesta !== "9999"
                              ? `${row.tiempoPrimeraRespuesta} min`
                              : "—"}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 font-mono text-slate-300">
                            {row.tiempoResolucion && row.tiempoResolucion !== "9999"
                              ? `${row.tiempoResolucion} días`
                              : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Paginación */}
              <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row text-xs text-slate-400">
                <span>
                  Mostrando <strong className="text-slate-200">{(pagina - 1) * ELEMS_POR_PAGINA + 1}</strong> -{" "}
                  <strong className="text-slate-200">
                    {Math.min(pagina * ELEMS_POR_PAGINA, registrosTabla.length)}
                  </strong>{" "}
                  de <strong className="text-slate-200">{registrosTabla.length}</strong> registros
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setPagina((p) => Math.max(1, p - 1))}
                    disabled={pagina === 1}
                    className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-slate-300 transition hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800"
                  >
                    ← Anterior
                  </button>
                  <span className="px-2 font-mono text-slate-300">
                    {pagina} / {totalPaginas}
                  </span>
                  <button
                    onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                    disabled={pagina === totalPaginas}
                    className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-slate-300 transition hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800"
                  >
                    Siguiente →
                  </button>
                </div>
              </div>
            </>
          )}
        </section>

        <footer className="mt-12 border-t border-slate-800/80 pt-6 text-center text-xs text-slate-500">
          <p>
            CREOTEC © {new Date().getFullYear()} · Sistema Operativo e Inteligencia de Negocios · Conectado en tiempo real a Google Sheets API
          </p>
        </footer>
      </main>
    </div>
  );
}

// ---------- Subcomponentes Modernos ----------

function Select({
  label,
  value,
  onChange,
  options,
  icon,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  icon: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
        <span>{icon}</span>
        <span>{label}</span>
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-xl border border-slate-700/80 bg-slate-950/80 px-3 py-2.5 text-sm text-slate-200 outline-none transition focus:border-teal-500 focus:ring-1 focus:ring-teal-500 hover:border-slate-600 cursor-pointer"
      >
        {options.map((o) => (
          <option key={o} value={o} className="bg-slate-900 text-slate-200 py-1">
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function KpiCard({
  title,
  value,
  hint,
  icon,
  gradient,
  border,
}: {
  title: string;
  value: string;
  hint: string;
  icon: string;
  gradient: string;
  border: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-slate-800 border-t-4 ${border} bg-gradient-to-b ${gradient} bg-slate-900/70 p-5 shadow-xl backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:border-slate-700`}
    >
      <div className="flex items-start justify-between">
        <p className="font-display text-xs font-bold uppercase tracking-wider text-slate-400">
          {title}
        </p>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800/80 text-lg shadow-inner">
          {icon}
        </span>
      </div>
      <p className="mt-3 font-display text-3xl font-extrabold text-white tracking-tight sm:text-4xl">
        {value}
      </p>
      <p className="mt-1 text-xs text-slate-400 font-medium">{hint}</p>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl backdrop-blur-xl transition-all hover:border-slate-700/80">
      <div className="mb-4">
        <h3 className="font-display text-base font-bold text-slate-100">{title}</h3>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      <div className="relative w-full" style={{ height: "420px" }}>
        {children}
      </div>
    </div>
  );
}
