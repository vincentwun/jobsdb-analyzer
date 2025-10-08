// Summary: Renders a chart, summary text and a small table for one analysis result
import React, { useEffect, useRef } from "react";
import { Chart, ChartConfiguration } from "chart.js";
import { AnalysisResult } from "../utils/analysisTypes";
import { CHART_CONFIG } from "../utils/constants";

interface AnalysisSectionProps {
  id: string;
  title: string;
  result: AnalysisResult | null;
  loading: boolean;
  error?: string | null;
  chartType?: "bar" | "pie";
}

// AnalysisSection: displays chart + summary for a single analysis result
export const AnalysisSection: React.FC<AnalysisSectionProps> = ({
  id,
  title,
  result,
  loading,
  error,
  chartType = "bar",
}) => {
  const chartRef = useRef<Chart | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Render or update the chart whenever result/title/type changes
  useEffect(() => {
    if (!result || !canvasRef.current) return;

    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    const topDataPoints = result.data_points
      .sort((a, b) => b.value - a.value)
      .slice(0, CHART_CONFIG.MAX_TOP_ITEMS);

    if (topDataPoints.length === 0) return;

    const labels = topDataPoints.map((dp) => dp.label);
    const values = topDataPoints.map((dp) => dp.value);

    const categoryColors: { [key: string]: string } = {};
    const colorPalette = [
      "#0ea5a4",
      "#06b6d4",
      "#8b5cf6",
      "#ec4899",
      "#f59e0b",
      "#10b981",
      "#3b82f6",
      "#6366f1",
      "#14b8a6",
      "#f97316",
    ];
    let colorIndex = 0;

    const backgroundColors = topDataPoints.map((dp) => {
      const cat = dp.category || "default";
      if (!categoryColors[cat]) {
        categoryColors[cat] = colorPalette[colorIndex % colorPalette.length];
        colorIndex++;
      }
      return categoryColors[cat];
    });

    const config: ChartConfiguration = {
      type: chartType,
      data: {
        labels,
        datasets: [
          {
            label: title,
            data: values,
            backgroundColor: backgroundColors,
            borderWidth: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: chartType === "pie" },
          title: { display: false },
        },
        ...(chartType === "bar" && {
          scales: {
            y: { beginAtZero: true, ticks: { precision: 0 } },
          },
        }),
      },
    };

    chartRef.current = new Chart(canvasRef.current, config);

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [result, title, chartType]);

  return (
    <section className="card panel-card" id={id} style={{ marginTop: "18px" }}>
      <h4 className="table-title">{title}</h4>

      {loading && <div className="muted-note">Analyzing... please wait</div>}

      {error && (
        <div className="muted-note" style={{ color: "#ef4444" }}>
          Error: {error}
        </div>
      )}

      {result && (
        <>
          <p style={{ marginTop: "8px", fontSize: "14px", color: "#6b7280" }}>
            <strong>Summary:</strong> {result.analysis_summary}
          </p>

          <div style={{ height: "300px", marginTop: "12px" }}>
            <canvas ref={canvasRef} />
          </div>

          <table style={{ width: "100%", marginTop: "16px", fontSize: "14px" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Item</th>
                <th style={{ textAlign: "left" }}>Category</th>
                <th style={{ textAlign: "right" }}>Count</th>
              </tr>
            </thead>
            <tbody>
              {result.data_points.slice(0, 10).map((dp, idx) => (
                <tr key={idx}>
                  <td>{dp.label}</td>
                  <td>{dp.category || "-"}</td>
                  <td style={{ textAlign: "right" }}>{dp.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
};
