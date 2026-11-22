import { useEffect, useRef } from 'react';
import {
  Chart,
  ChartConfiguration,
  ChartType,
  registerables,
} from 'chart.js';

Chart.register(...registerables);

interface ChartCanvasProps {
  type: ChartType;
  data: ChartConfiguration['data'];
  options?: ChartConfiguration['options'];
  height?: number;
  darkMode?: boolean;
}

export function ChartCanvas({
  type,
  data,
  options,
  height = 260,
  darkMode = false,
}: ChartCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    const textColor = darkMode ? '#94A3B8' : '#475569';
    const gridColor = darkMode ? 'rgba(148, 163, 184, 0.12)' : 'rgba(15, 23, 42, 0.06)';

    const baseOptions: ChartConfiguration['options'] = {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 350 },
      plugins: {
        legend: {
          labels: {
            color: textColor,
            font: { family: 'Public Sans, sans-serif', size: 12 },
            boxWidth: 10,
            usePointStyle: true,
          },
        },
        tooltip: {
          backgroundColor: darkMode ? '#0F1B30' : '#0B1933',
          titleColor: '#F8FAFC',
          bodyColor: '#E2E8F0',
          borderColor: darkMode ? '#1E2E4A' : '#1E3A8A',
          borderWidth: 1,
          padding: 10,
          cornerRadius: 6,
        },
      },
      scales:
        type === 'doughnut' || type === 'pie'
          ? undefined
          : {
              x: {
                ticks: {
                  color: textColor,
                  font: { family: 'Public Sans, sans-serif', size: 11 },
                },
                grid: { display: false },
                border: { color: gridColor },
              },
              y: {
                beginAtZero: true,
                ticks: {
                  color: textColor,
                  font: { family: 'JetBrains Mono, monospace', size: 11 },
                },
                grid: { color: gridColor },
                border: { display: false },
              },
            },
    };

    const mergedOptions: ChartConfiguration['options'] = {
      ...baseOptions,
      ...options,
      plugins: {
        ...baseOptions.plugins,
        ...options?.plugins,
      },
      scales:
        type === 'doughnut' || type === 'pie'
          ? undefined
          : {
              ...baseOptions.scales,
              ...options?.scales,
            },
    };

    chartRef.current = new Chart(canvas, {
      type,
      data,
      options: mergedOptions,
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [type, data, options, darkMode]);

  return (
    <div style={{ height }} className="relative w-full">
      <canvas ref={canvasRef} />
    </div>
  );
}
