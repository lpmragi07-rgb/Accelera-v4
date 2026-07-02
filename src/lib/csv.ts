import Papa from "papaparse";

export interface ParsedLead {
  company_name: string | null;
  phone: string;
}

// Faz o parse de um CSV de leads. Aceita cabeçalhos flexíveis:
// empresa/company/nome/name e telefone/phone/celular/number.
// Linhas sem telefone válido são descartadas.
export function parseLeadsCsv(content: string): {
  leads: ParsedLead[];
  errors: string[];
} {
  const errors: string[] = [];
  const result = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });

  if (result.errors.length > 0) {
    result.errors.forEach((e) => errors.push(`Linha ${e.row}: ${e.message}`));
  }

  const companyKeys = ["empresa", "company", "company_name", "nome", "name", "razao_social"];
  const phoneKeys = ["telefone", "phone", "celular", "number", "fone", "contato"];

  const leads: ParsedLead[] = [];

  for (const row of result.data) {
    const companyKey = companyKeys.find((k) => k in row);
    const phoneKey = phoneKeys.find((k) => k in row);

    const phoneRaw = phoneKey ? (row[phoneKey] ?? "").trim() : "";
    if (!phoneRaw) continue;

    leads.push({
      company_name: companyKey ? (row[companyKey] ?? "").trim() || null : null,
      phone: phoneRaw,
    });
  }

  return { leads, errors };
}
