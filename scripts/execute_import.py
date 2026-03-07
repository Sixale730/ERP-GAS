"""Execute mascotienda product import via Supabase REST API."""
import csv
import json
import urllib.request
import ssl

SUPABASE_URL = "https://xuvxtwdlbqomjyeyeugy.supabase.co"
CSV_PATH = r"C:\ERP-GAS\scripts\mascotienda_productos.csv"
BATCH_SIZE = 200

# Read anon key from .env.local
with open(r"C:\ERP-GAS\.env.local", "r") as f:
    for line in f:
        if line.startswith("NEXT_PUBLIC_SUPABASE_ANON_KEY="):
            ANON_KEY = line.strip().split("=", 1)[1]
            break

# Read CSV
with open(CSV_PATH, "r", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    rows = list(reader)

print(f"Total rows to insert: {len(rows)}")

# Convert types
for row in rows:
    row["costo_promedio"] = float(row["costo_promedio"])
    row["es_servicio"] = row["es_servicio"] == "true"
    row["is_active"] = row["is_active"] == "true"

# Insert in batches via PostgREST
ctx = ssl.create_default_context()
headers = {
    "apikey": ANON_KEY,
    "Authorization": f"Bearer {ANON_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=ignore-duplicates,return=minimal",
    "Accept-Profile": "erp",
    "Content-Profile": "erp",
}

url = f"{SUPABASE_URL}/rest/v1/productos"
total_inserted = 0
errors = 0

for i in range(0, len(rows), BATCH_SIZE):
    batch = rows[i:i + BATCH_SIZE]
    data = json.dumps(batch).encode("utf-8")

    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, context=ctx) as resp:
            total_inserted += len(batch)
            print(f"Batch {i // BATCH_SIZE + 1}: {len(batch)} rows OK (total: {total_inserted})")
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        errors += 1
        print(f"Batch {i // BATCH_SIZE + 1}: ERROR {e.code} - {body[:200]}")

print(f"\nDone! Inserted: {total_inserted}, Errors: {errors}")
