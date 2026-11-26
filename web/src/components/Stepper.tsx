import { useI18n } from "../lib/i18n";

const STEPS = ["step.1", "step.2", "step.3"];

export default function Stepper({ current }: { current: number }) {
  const { t } = useI18n();
  return (
    <ol className="stepper" aria-label={t("stepper.aria")}>
      {STEPS.map((key, i) => {
        const stepIndex = i + 1;
        const state = stepIndex < current ? "done" : stepIndex === current ? "current" : "upcoming";
        return (
          <li key={key} className={`stepper__step stepper__step--${state}`} aria-current={state === "current" ? "step" : undefined}>
            <span className="stepper__dot">{state === "done" ? "✓" : stepIndex}</span>
            <span className="stepper__label">{t(key)}</span>
          </li>
        );
      })}
    </ol>
  );
}
