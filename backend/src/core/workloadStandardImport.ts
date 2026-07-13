import ExcelJS from "exceljs";

export interface ParsedWorkloadStandardRow {
  businessCategory: string;
  workType: string;
  productSystem: string;
  subtask: string;
  unit: string;
  coefficient: number;
  remark: string;
}

const headerAliases: Record<keyof ParsedWorkloadStandardRow, string[]> = {
  businessCategory: ["业务分类", "业务"],
  workType: ["工作类型"],
  productSystem: ["产品系统", "产品"],
  subtask: ["子任务"],
  unit: ["计量单位", "单位"],
  coefficient: ["折算系数", "系数"],
  remark: ["备注", "说明"]
};

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && "text" in value) return String(value.text || "").trim();
  return String(value).trim();
}

export async function parseWorkloadStandardWorkbook(buffer: Buffer): Promise<ParsedWorkloadStandardRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as never);
  const sheet = workbook.getWorksheet("工作当量标准");
  if (!sheet) throw new Error("WORKLOAD_STANDARD_IMPORT_SHEET_NOT_FOUND");

  const columns = new Map<keyof ParsedWorkloadStandardRow, number>();
  sheet.getRow(1).eachCell((cell, column) => {
    const header = cellText(cell.value);
    for (const [field, aliases] of Object.entries(headerAliases) as Array<[keyof ParsedWorkloadStandardRow, string[]]>) {
      if (aliases.includes(header)) columns.set(field, column);
    }
  });
  for (const field of ["businessCategory", "workType", "coefficient"] as Array<keyof ParsedWorkloadStandardRow>) {
    if (!columns.has(field)) throw new Error("WORKLOAD_STANDARD_IMPORT_HEADER_INVALID");
  }

  const rows: ParsedWorkloadStandardRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const read = (field: keyof ParsedWorkloadStandardRow) => {
      const column = columns.get(field);
      return column ? cellText(row.getCell(column).value) : "";
    };
    const values = ["businessCategory", "workType", "productSystem", "subtask", "unit", "coefficient", "remark"]
      .map((field) => read(field as keyof ParsedWorkloadStandardRow));
    if (values.every((value) => !value)) return;
    rows.push({
      businessCategory: read("businessCategory"),
      workType: read("workType"),
      productSystem: read("productSystem"),
      subtask: read("subtask"),
      unit: read("unit"),
      coefficient: Number(read("coefficient")),
      remark: read("remark")
    });
  });
  return rows;
}
