import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type WarningRevealTarget = {
  requestId: number;
  analysisId: string;
  warningCode: string;
  warningLabel: string;
  curveIds: string[];
};

type WarningNavigationValue = {
  target: WarningRevealTarget | null;
  revealWarning: (target: Omit<WarningRevealTarget, "requestId">) => void;
  clearWarningReveal: () => void;
};

const WarningNavigationContext = createContext<WarningNavigationValue | null>(null);

export function WarningNavigationProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<WarningRevealTarget | null>(null);
  const value = useMemo<WarningNavigationValue>(
    () => ({
      target,
      revealWarning: (nextTarget) =>
        setTarget((previous) => ({ ...nextTarget, requestId: (previous?.requestId ?? 0) + 1 })),
      clearWarningReveal: () => setTarget(null)
    }),
    [target]
  );
  return <WarningNavigationContext.Provider value={value}>{children}</WarningNavigationContext.Provider>;
}

export function useWarningNavigation() {
  const value = useContext(WarningNavigationContext);
  if (!value) throw new Error("Warning navigation context is missing.");
  return value;
}
