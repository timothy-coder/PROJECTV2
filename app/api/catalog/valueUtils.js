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
    return { valor: raw, valorTipo: inferSpecValueType(raw), valorUrl: isUrl(raw) ? raw : "", valorPath: "", valorRaw: raw };
  }
}

export function inferSpecValueType(value) {
  const text = String(value || "").trim();
  if (isUrl(text)) {
    if (/\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i.test(text)) return "IMAGEN";
    if (/\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(text)) return "VIDEO";
    return "LINK";
  }
  return "TEXTO";
}

export function isUrl(value) {
  return /^https?:\/\//i.test(String(value || "").trim());
}
