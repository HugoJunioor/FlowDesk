import { useState, useCallback } from "react";

const STORAGE_KEY = "flowdesk:onboarding:dismissed";

export function useOnboardingStatus(demandsCount: number) {
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  const [currentStep, setCurrentStep] = useState(0);

  const dismiss = useCallback(() => {
    setDismissed(true);
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch {
      /* ignore */
    }
  }, []);

  const shouldShow = demandsCount === 0 && !dismissed;

  return { shouldShow, currentStep, setCurrentStep, dismiss };
}
