"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import ExportJobMonitor from "@/components/export/ExportJobMonitor";
import { ToastProvider, ToastViewport } from "@/components/ui/toast";
import { exportPlan, type ExportFormat } from "@/lib/api";

export type ActiveExportJob = {
  key: string;
  planId: string;
  jobId: string;
  format: ExportFormat;
  planTitle?: string;
  onComplete?: (formats: string[]) => void;
};

type ExportJobsContextValue = {
  startExport: (
    planId: string,
    format: ExportFormat,
    options?: {
      planTitle?: string;
      jobId?: string;
      formats?: ExportFormat[];
      onComplete?: (formats: string[]) => void;
    }
  ) => Promise<string>;
  dismissJob: (key: string) => void;
};

const ExportJobsContext = createContext<ExportJobsContextValue | null>(null);

function jobKey(planId: string, jobId: string, format: string) {
  return `${planId}:${jobId}:${format}`;
}

export function ExportJobsProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<ActiveExportJob[]>([]);

  const dismissJob = useCallback((key: string) => {
    setJobs((prev) => prev.filter((j) => j.key !== key));
  }, []);

  const startExport = useCallback(
    async (
      planId: string,
      format: ExportFormat,
      options?: {
        planTitle?: string;
        jobId?: string;
        formats?: ExportFormat[];
        onComplete?: (formats: string[]) => void;
      }
    ) => {
      const jobId =
        options?.jobId ??
        (await exportPlan(planId, options?.formats ?? [format])).id;
      const key = jobKey(planId, jobId, format);
      setJobs((prev) => {
        if (prev.some((j) => j.key === key)) return prev;
        return [
          ...prev,
          {
            key,
            planId,
            jobId,
            format,
            planTitle: options?.planTitle,
            onComplete: options?.onComplete,
          },
        ];
      });
      return jobId;
    },
    []
  );

  const value = useMemo(
    () => ({ startExport, dismissJob }),
    [startExport, dismissJob]
  );

  return (
    <ExportJobsContext.Provider value={value}>
      <ToastProvider swipeDirection="right" duration={Infinity}>
        {children}
        {jobs.map((job) => (
          <ExportJobMonitor
            key={job.key}
            planId={job.planId}
            jobId={job.jobId}
            format={job.format}
            planTitle={job.planTitle}
            onComplete={job.onComplete}
            onDismiss={() => dismissJob(job.key)}
          />
        ))}
        <ToastViewport />
      </ToastProvider>
    </ExportJobsContext.Provider>
  );
}

export function useExportJobs() {
  const ctx = useContext(ExportJobsContext);
  if (!ctx) {
    throw new Error("useExportJobs requires ExportJobsProvider");
  }
  return ctx;
}

/** Safe when provider may be absent (returns no-op stubs). */
export function useExportJobsOptional() {
  return useContext(ExportJobsContext);
}
