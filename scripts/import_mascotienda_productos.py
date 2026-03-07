"""
Script para importar productos de MascoTienda desde Excel (PVWIN) a SQL.

Genera archivo mascotienda_productos.sql con INSERTs en bloques de 100.

Uso:
    python import_mascotienda_productos.py
"""

import openpyxl
import os

# Configuracion
XLSX_PATH = r"C:\Users\PC\Documents\MascoTienda\CATALAGO PRODUCTOS PVWIN.xlsx"
OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "mascotienda_productos.sql")
ORG_ID = "7edf5d32-93fa-4f3e-a494-05977cae335c"
BLOCK_SIZE = 100
DATA_START_ROW = 6  # Fila 6 en Excel (1-indexed)


def escape_sql(value: str) -> str:
    """Escapa comillas simples para SQL."""
    if value is None:
        return ""
    return str(value).replace("'", "''")


def fix_encoding(text: str) -> str:
    """Reemplaza caracteres corruptos (mojibake) comunes del latin-1."""
    return text.replace("\ufffd", "ñ")


def clean_str(value) -> str:
    """Limpia un valor de celda a string."""
    if value is None:
        return ""
    return fix_encoding(str(value).strip())


def parse_float(value) -> float:
    """Convierte valor a float, 0.0 si falla."""
    if value is None:
        return 0.0
    try:
        return float(value)
    except (ValueError, TypeError):
        return 0.0


def main():
    print(f"Leyendo: {XLSX_PATH}")
    wb = openpyxl.load_workbook(XLSX_PATH, read_only=True)
    ws = wb.active

    productos = []
    stats = {
        "total": 0,
        "con_sat": 0,
        "sin_sat": 0,
        "kg": 0,
        "pza": 0,
        "otras_unidades": 0,
        "servicios": 0,
        "skipped": 0,
    }

    for row in ws.iter_rows(min_row=DATA_START_ROW, values_only=True):
        cols = list(row)

        # col[1] = SKU/Clave
        sku_raw = clean_str(cols[1])
        if not sku_raw:
            stats["skipped"] += 1
            continue

        sku = sku_raw
        nombre_raw = clean_str(cols[4])
        nombre = nombre_raw.title() if nombre_raw else sku

        unidad = clean_str(cols[6]).upper()
        if not unidad:
            unidad = "PZA"

        costo = parse_float(cols[12])

        clave_sat = clean_str(cols[3])
        ubicacion = clean_str(cols[8])
        grupo = clean_str(cols[9])
        depto = clean_str(cols[10])
        iva = clean_str(cols[17])

        # es_servicio
        nombre_upper = nombre_raw.upper()
        es_servicio = "SERVICIO" in nombre_upper or "COMISION" in nombre_upper

        # descripcion: combinar info auxiliar
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
        descripcion = " | ".join(desc_parts) if desc_parts else None

        productos.append({
            "sku": sku,
            "nombre": nombre,
            "descripcion": descripcion,
            "unidad_medida": unidad,
            "costo_promedio": costo,
            "es_servicio": es_servicio,
        })

        # Stats
        stats["total"] += 1
        if clave_sat:
            stats["con_sat"] += 1
        else:
            stats["sin_sat"] += 1
        if unidad == "KG":
            stats["kg"] += 1
        elif unidad == "PZA":
            stats["pza"] += 1
        else:
            stats["otras_unidades"] += 1
        if es_servicio:
            stats["servicios"] += 1

    wb.close()

    # Generar SQL
    columns = "sku, nombre, descripcion, unidad_medida, costo_promedio, es_servicio, moneda, is_active, organizacion_id"

    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        f.write(f"-- Importacion de productos MascoTienda\n")
        f.write(f"-- Total: {stats['total']} productos\n")
        f.write(f"-- Generado por import_mascotienda_productos.py\n\n")

        for i in range(0, len(productos), BLOCK_SIZE):
            block = productos[i : i + BLOCK_SIZE]
            f.write(f"-- Bloque {i // BLOCK_SIZE + 1}\n")
            f.write(f"INSERT INTO erp.productos ({columns})\nVALUES\n")

            values = []
            for p in block:
                desc_sql = f"'{escape_sql(p['descripcion'])}'" if p["descripcion"] else "NULL"
                values.append(
                    f"  ('{escape_sql(p['sku'])}', '{escape_sql(p['nombre'])}', "
                    f"{desc_sql}, '{p['unidad_medida']}', {p['costo_promedio']}, "
                    f"{'true' if p['es_servicio'] else 'false'}, 'MXN', true, "
                    f"'{ORG_ID}')"
                )

            f.write(",\n".join(values))
            f.write("\nON CONFLICT (sku) DO NOTHING;\n\n")

    print(f"\nArchivo generado: {OUTPUT_PATH}")
    print(f"\n{'='*40}")
    print(f"  RESUMEN DE IMPORTACION")
    print(f"{'='*40}")
    print(f"  Total procesados:   {stats['total']}")
    print(f"  Filas omitidas:     {stats['skipped']}")
    print(f"  Con clave SAT:      {stats['con_sat']}")
    print(f"  Sin clave SAT:      {stats['sin_sat']}")
    print(f"  En KG (granel):     {stats['kg']}")
    print(f"  En PZA:             {stats['pza']}")
    print(f"  Otras unidades:     {stats['otras_unidades']}")
    print(f"  Marcados servicio:  {stats['servicios']}")
    print(f"{'='*40}")


if __name__ == "__main__":
    main()
