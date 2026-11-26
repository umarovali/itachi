import { useEffect, useId, useRef, useState } from "react";
import { useI18n } from "../lib/i18n";
import { isPdf, prepareReceipt } from "../lib/image";

interface Props {
  upload: (image: Blob) => Promise<void>;
  alreadyUploaded: boolean;
  disabled?: boolean;
}

export default function ReceiptPicker({ upload, alreadyUploaded, disabled }: Props) {
  const { t } = useI18n();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [pdfName, setPdfName] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "uploading" | "done" | "error">(alreadyUploaded ? "done" : "idle");
  const [error, setError] = useState("");

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const onPick = async (file: File | undefined) => {
    if (!file) return;
    setError("");
    setState("uploading");
    try {
      const image = await prepareReceipt(file);
      const pdf = isPdf(image);
      setPdfName(pdf ? file.name : null);
      setPreview((old) => {
        if (old) URL.revokeObjectURL(old);
        return pdf ? null : URL.createObjectURL(image);
      });
      await upload(image);
      setState("done");
    } catch (e) {
      setState("error");
      setError((e as Error).message);
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="receipt-picker">
      <span className="receipt-picker__label">
        {t("rc.label")} <em>{t("tg.required")}</em>
      </span>
      <label
        htmlFor={inputId}
        className={`receipt-picker__drop receipt-picker__drop--${state} ${disabled ? "receipt-picker__drop--disabled" : ""}`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (!disabled) void onPick(e.dataTransfer.files[0]);
        }}
      >
        {preview ? (
          <img src={preview} alt={t("rc.alt")} className="receipt-picker__preview" />
        ) : (
          <span className="receipt-picker__icon" aria-hidden="true">
            {pdfName ? "📄" : "🧾"}
          </span>
        )}
        <span className="receipt-picker__text">
          {state === "uploading" && t("common.loading")}
          {state === "done" && (pdfName ? t("rc.doneFile", { name: pdfName }) : t("rc.done"))}
          {state === "idle" && t("rc.idle")}
          {state === "error" && t("rc.error")}
        </span>
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/*,application/pdf,.pdf"
        className="receipt-picker__input"
        disabled={disabled || state === "uploading"}
        onChange={(e) => void onPick(e.target.files?.[0])}
      />
      {error && <span className="receipt-picker__error">{error}</span>}
    </div>
  );
}
