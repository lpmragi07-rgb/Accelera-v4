// Normaliza um telefone para o formato E.164 (+55...).
// Se vier número brasileiro sem código de país, assume +55.
export function toE164(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  // Brasil: 10 (fixo) ou 11 (celular) dígitos com DDD
  if (digits.length === 10 || digits.length === 11) return `+55${digits}`;
  return `+${digits}`;
}
