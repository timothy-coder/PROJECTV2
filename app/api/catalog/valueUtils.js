export function encodeSpecValue({ valorTipo = "TEXTO", valor = "", valorUrl = "", valorPath = "" }) {
  const tipo = ["TEXTO", "LINK", "IMAGEN", "VIDEO"].includes(valorTipo) ? valorTipo : "TEXTO";
  if (tipo === "TEXTO") return String(valor || "").trim();
  return JSON.stringify({
    tipo,
    texto: String(valor || "").trim(),
    url: String(valorUrl || "").trim(),
    path: String(valorPath || "").trim(),
  });
}

export function decodeSpecValue(value) {
  const raw = String(value || "");
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !parsed.tipo) throw new Error("Invalid spec value");
    return {
      valor: parsed.texto || "",
      valorTipo: parsed.tipo,
      valorUrl: parsed.url || "",
      valorPath: parsed.path || "",
      valorRaw: raw,
    };
  } catch {
    const inferredType = inferSpecValueType(raw);
    return {
      valor: raw,
      valorTipo: inferredType,
      valorUrl: isUrl(raw) ? raw : "",
      valorPath: isLocalPath(raw) ? raw : "",
      valorRaw: raw,
    };
  }
}

export function inferSpecValueType(value) {
  const text = String(value || "").trim();
  if (isUrl(text) || isLocalPath(text)) {
    if (isImagePath(text)) return "IMAGEN";
    if (isVideoPath(text)) return "VIDEO";
    return "LINK";
  }
  return "TEXTO";
}

export function isUrl(value) {
  return /^https?:\/\//i.test(String(value || "").trim());
}

export function isLocalPath(value) {
  return /^\//.test(String(value || "").trim());
}

function isImagePath(value) {
  return /\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i.test(String(value || "").trim());
}

function isVideoPath(value) {
  return /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(String(value || "").trim());
}
