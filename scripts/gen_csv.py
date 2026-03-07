"""Generate CSV from xlsx for Supabase import."""
import openpyxl
import csv

XLSX_PATH = r"C:\Users\PC\Documents\MascoTienda\CATALAGO PRODUCTOS PVWIN.xlsx"
CSV_PATH = r"C:\ERP-GAS\scripts\mascotienda_productos.csv"
ORG_ID = "7edf5d32-93fa-4f3e-a494-05977cae335c"


def fix_encoding(text):
    return text.replace("\ufffd", "\u00f1") if text else text


def clean_str(value):
    if value is None:
        return ""
    return fix_encoding(str(value).strip())


def parse_float(value):
    if value is None:
        return 0.0
    try:
        return float(value)
    except (ValueError, TypeError):
        return 0.0


wb = openpyxl.load_workbook(XLSX_PATH, read_only=True)
ws = wb.active

rows = []
for row in ws.iter_rows(min_row=6, values_only=True):
    cols = list(row)
    sku = clean_str(cols[1])
    if not sku:
        continue

    nombre_raw = clean_str(cols[4])
    nombre = nombre_raw.title() if nombre_raw else sku
    unidad = clean_str(cols[6]).upper() or "PZA"
    costo = parse_float(cols[12])
    clave_sat = clean_str(cols[3])
    ubicacion = clean_str(cols[8])
    grupo = clean_str(cols[9])
    depto = clean_str(cols[10])
    iva = clean_str(cols[17])
    nombre_upper = nombre_raw.upper()
    es_servicio = "SERVICIO" in nombre_upper or "COMISION" in nombre_upper

    desc_parts = []
    if ubicacion:
        desc_parts.append(f"Ubic: {ubicacion}")
    if clave_sat:
        desc_parts.append(f"SAT: {clave_sat}")
    if iva:
        desc_parts.append(f"IVA: {iva}%")
    if grupo and grupo != "_GND":
        desc_parts.append(f"Gpo: {grupo}")
    if depto and depto != "_DND":
        desc_parts.append(f"Dpto: {depto}")
    descripcion = " | ".join(desc_parts) if desc_parts else ""

    rows.append((sku, nombre, descripcion, unidad, costo, es_servicio))

wb.close()

with open(CSV_PATH, "w", newline="", encoding="utf-8") as f:
    writer = csv.writer(f)
    writer.writerow(["sku", "nombre", "descripcion", "unidad_medida", "costo_promedio",
                      "es_servicio", "moneda", "is_active", "organizacion_id"])
    seen_skus = set()
    unique_count = 0
    for sku, nombre, descripcion, unidad, costo, es_servicio in rows:
        if sku in seen_skus:
            continue
        seen_skus.add(sku)
        unique_count += 1
        writer.writerow([sku, nombre, descripcion, unidad, costo,
                         str(es_servicio).lower(), "MXN", "true", ORG_ID])

print(f"CSV generated: {unique_count} unique products (from {len(rows)} total rows)")
print(f"Duplicates skipped: {len(rows) - unique_count}")
