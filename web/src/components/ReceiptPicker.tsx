import { useEffect, useId, useRef, useState } from "react";
import { prepareReceipt } from "../lib/image";

interface Props {
  /** Загружает подготовленную картинку на сервер. */
  upload: (image: Blob) => Promise<void>;
  /** Чек уже был загружен раньше (например, после перезагрузки страницы). */
  alreadyUploaded: boolean;
  disabled?: boolean;
}

/** Поле «Скриншот оплаты»: выбор файла, превью, загрузка. */
export default function ReceiptPicker({ upload, alreadyUploaded, disabled }: Props) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
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
      setPreview((old) => {
        if (old) URL.revokeObjectURL(old);
        return URL.createObjectURL(image);
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
        Скриншот оплаты (чек) <em>обязательно</em>
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
        {preview ? <img src={preview} alt="Прикреплённый чек" className="receipt-picker__preview" /> : <span className="receipt-picker__icon" aria-hidden="true">🧾</span>}
        <span className="receipt-picker__text">
          {state === "uploading" && "Загружаю…"}
          {state === "done" && "✓ Чек прикреплён — нажми, чтобы заменить"}
          {state === "idle" && "Нажми, чтобы прикрепить скриншот перевода"}
          {state === "error" && "Попробуй другой файл"}
        </span>
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/*"
        className="receipt-picker__input"
        disabled={disabled || state === "uploading"}
        onChange={(e) => void onPick(e.target.files?.[0])}
      />
      {error && <span className="receipt-picker__error">{error}</span>}
    </div>
  );
}
