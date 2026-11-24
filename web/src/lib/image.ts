const MAX_SIDE = 1600;
const MAX_UPLOAD = 6 * 1024 * 1024;
const PASS_THROUGH = ["image/jpeg", "image/png", "image/webp"];

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("decode"));
    };
    img.src = url;
  });
}

export const isPdf = (file: Blob & { name?: string }) => file.type === "application/pdf" || /\.pdf$/i.test(file.name ?? "");

export async function prepareReceipt(file: File): Promise<Blob> {
  if (isPdf(file)) {
    if (file.size > MAX_UPLOAD) throw new Error("PDF слишком большой (больше 6 МБ). Сделай скриншот чека.");
    return file.type === "application/pdf" ? file : new Blob([file], { type: "application/pdf" });
  }
  if (!file.type.startsWith("image/") && !/\.(heic|heif)$/i.test(file.name)) throw new Error("Нужен скриншот (JPG/PNG) или PDF чека.");
  try {
    const img = await loadImage(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
    if (blob && blob.size <= MAX_UPLOAD) return blob;
  } catch {}
  if (PASS_THROUGH.includes(file.type) && file.size <= MAX_UPLOAD) return file;
  throw new Error("Не удалось открыть картинку. Сделай обычный скриншот (PNG/JPG) и прикрепи его.");
}
