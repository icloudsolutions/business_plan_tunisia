"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Inputs } from "@/components/liasse-form-utils";
import { useDebounce } from "@/hooks/useDebounce";
import { diffInputsSnapshot } from "@/lib/plan-inputs-diff";
import { flushPlanInputs, patchPlanInputs, type PlanPatchResult } from "@/lib/api";
import type { LiasseFormValues } from "@/lib/liasse-wizard/schema";
import { formValuesToInputs } from "@/lib/liasse-wizard/defaults";

export type AutoSaveStatus = "idle" | "saving" | "saved" | "error";

type Options = {
  planId: string;
  readOnly: boolean;
  inputs: Inputs;
  watchedValues: LiasseFormValues;
  debounceMs?: number;
  onChange: (inputs: Inputs) => void;
  onSaved: (result: PlanPatchResult) => void;
};

export function useDebouncedPlanSave({
  planId,
  readOnly,
  inputs,
  watchedValues,
  debounceMs = 1500,
  onChange,
  onSaved,
}: Options) {
  const [status, setStatus] = useState<AutoSaveStatus>("idle");
  const savedSnapshotRef = useRef<Inputs>(inputs);
  const baseRef = useRef<Inputs>(inputs);
  const savingRef = useRef(false);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestValuesRef = useRef(watchedValues);
  latestValuesRef.current = watchedValues;

  const debouncedValues = useDebounce(watchedValues, debounceMs);

  useEffect(() => {
    baseRef.current = inputs;
    savedSnapshotRef.current = inputs;
  }, [inputs]);

  const buildPayload = useCallback(
    (values: LiasseFormValues) => formValuesToInputs(values, baseRef.current),
    []
  );

  const getPatch = useCallback(() => {
    const full = buildPayload(latestValuesRef.current);
    const patch = diffInputsSnapshot(
      savedSnapshotRef.current as Record<string, unknown>,
      full as Record<string, unknown>
    );
    return patch ? { patch, full } : null;
  }, [buildPayload]);

  const clearTimers = useCallback(() => {
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
  }, []);

  const scheduleIdle = useCallback(() => {
    clearTimers();
    fadeTimerRef.current = setTimeout(() => setStatus("idle"), 400);
  }, [clearTimers]);

  const scheduleSavedFade = useCallback(() => {
    clearTimers();
    setStatus("saved");
    savedTimerRef.current = setTimeout(() => scheduleIdle(), 1200);
  }, [clearTimers, scheduleIdle]);

  const applySaved = useCallback(
    (full: Inputs, res?: PlanPatchResult) => {
      savedSnapshotRef.current = full;
      baseRef.current = full;
      onChange(full);
      if (res) onSaved(res);
    },
    [onChange, onSaved]
  );

  const flushSave = useCallback(
    async (
      opts?: { beacon?: boolean; showStatus?: boolean }
    ): Promise<"unchanged" | "saved" | "failed"> => {
      if (readOnly) return "unchanged";
      const delta = getPatch();
      if (!delta) return "unchanged";

      const { patch, full } = delta;

      if (opts?.showStatus !== false) {
        clearTimers();
        setStatus("saving");
      }

      if (opts?.beacon) {
        flushPlanInputs(planId, patch);
        applySaved(full);
        return "saved";
      }

      if (savingRef.current) return "unchanged";
      savingRef.current = true;
      try {
        const res = await patchPlanInputs(planId, patch);
        applySaved(full, res);
        if (opts?.showStatus !== false) scheduleSavedFade();
        return "saved";
      } catch {
        if (opts?.showStatus !== false) setStatus("error");
        return "failed";
      } finally {
        savingRef.current = false;
      }
    },
    [
      readOnly,
      getPatch,
      planId,
      applySaved,
      clearTimers,
      scheduleSavedFade,
    ]
  );

  const flushSaveRef = useRef(flushSave);
  flushSaveRef.current = flushSave;

  useEffect(() => {
    if (readOnly) return;
    latestValuesRef.current = debouncedValues;
    void flushSaveRef.current({ showStatus: true }).catch(() => undefined);
  }, [debouncedValues, readOnly]);

  useEffect(() => {
    if (readOnly) return;
    const onBeforeUnload = () => {
      void flushSaveRef.current({ beacon: true, showStatus: false });
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      void flushSaveRef.current({ beacon: true, showStatus: false });
      clearTimers();
    };
  }, [readOnly, clearTimers]);

  const persist = useCallback(
    async (showStatus = true): Promise<"unchanged" | "saved" | "failed"> =>
      flushSave({ showStatus }),
    [flushSave]
  );

  return { status, persist, saving: status === "saving" };
}
