"""Generate a PL/pgSQL DO block that inserts all products."""
import openpyxl

XLSX_PATH = r"C:\Users\PC\Documents\MascoTienda\CATALAGO PRODUCTOS PVWIN.xlsx"
ORG_ID = "7edf5d32-93fa-4f3e-a494-05977cae335c"
BLOCK_SIZE = 200


def fix_enc(text):
    return text.replace("\ufffd", "\u00f1") if text else text


def clean(value):
    if value is None:
        return ""
    return fix_enc(str(value).strip())


def pfloat(value):
    try:
        return float(value) if value else 0.0
    except (ValueError, TypeError):
        return 0.0


def esc(s):
    return s.replace("'", "''") if s else ""


wb = openpyxl.load_workbook(XLSX_PATH, read_only=True)
ws = wb.active

products = []
seen = set()
for row in ws.iter_rows(min_row=6, values_only=True):
    cols = list(row)
    sku = clean(cols[1])
    if not sku or sku in seen:
        continue
    seen.add(sku)

    nombre_raw = clean(cols[4])
    nombre = nombre_raw.title() if nombre_raw else sku
    unidad = clean(cols[6]).upper() or "PZA"
    costo = pfloat(cols[12])
    clave_sat = clean(cols[3])
    ubicacion = clean(cols[8])
    grupo = clean(cols[9])
    depto = clean(cols[10])
    iva = clean(cols[17])
    es_servicio = "SERVICIO" in nombre_raw.upper() or "COMISION" in nombre_raw.upper()

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
    descripcion = " | ".join(desc_parts)

    products.append((sku, nombre, descripcion, unidad, costo, es_servicio))

wb.close()

# Generate separate SQL files for each block (small enough for MCP execute_sql)
for i in range(0, len(products), BLOCK_SIZE):
    block = products[i:i + BLOCK_SIZE]
    block_num = i // BLOCK_SIZE + 1

    values = []
    for sku, nombre, descripcion, unidad, costo, es_servicio in block:
        desc_sql = f"'{esc(descripcion)}'" if descripcion else "NULL"
        values.append(
            f"('{esc(sku)}','{esc(nombre)}',{desc_sql},'{unidad}',{costo},"
            f"{'true' if es_servicio else 'false'},'MXN',true,'{ORG_ID}')"
        )

    sql = (
        f"INSERT INTO erp.productos(sku,nombre,descripcion,unidad_medida,costo_promedio,"
        f"es_servicio,moneda,is_active,organizacion_id)VALUES\n"
        + ",\n".join(values)
        + "\nON CONFLICT(sku)DO NOTHING;"
    )

    with open(f"C:/ERP-GAS/scripts/mini_{block_num:02d}.sql", "w", encoding="utf-8") as f:
        f.write(sql)

    print(f"Block {block_num}: {len(block)} rows, {len(sql)} chars")

print(f"\nTotal: {len(products)} unique products in {(len(products) + BLOCK_SIZE - 1) // BLOCK_SIZE} blocks")
