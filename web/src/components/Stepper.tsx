const STEPS = ["Выбор", "Оплата", "Подтверждение"];

export default function Stepper({ current }: { current: number }) {
  return (
    <ol className="stepper" aria-label="Этапы оформления заказа">
      {STEPS.map((label, i) => {
        const stepIndex = i + 1;
        const state = stepIndex < current ? "done" : stepIndex === current ? "current" : "upcoming";
        return (
          <li key={label} className={`stepper__step stepper__step--${state}`} aria-current={state === "current" ? "step" : undefined}>
            <span className="stepper__dot">{state === "done" ? "✓" : stepIndex}</span>
            <span className="stepper__label">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
