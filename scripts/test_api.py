import urllib.request
import json

# Test 1: Voice Match
print("--- TEST /api/voice-match ---")
payload = {
    "transcript": "Garde pour moi le gel douche et les cookies, le reste c'est coloc",
    "items": [
        {"id": "item-1", "name": "DOVE GEL DOUCHE MEN 250ML"},
        {"id": "item-2", "name": "BARILLA PATES 1KG"},
        {"id": "item-3", "name": "COOKIES CHOCOLAT PERSO"}
    ]
}

req = urllib.request.Request(
    "http://localhost:3000/api/voice-match",
    data=json.dumps(payload).encode("utf-8"),
    headers={"Content-Type": "application/json"}
)

with urllib.request.urlopen(req) as res:
    data = json.loads(res.read().decode("utf-8"))
    print("Voice Match Result:", json.dumps(data, indent=2, ensure_ascii=False))

# Test 2: Scan Receipt (Demo Mode)
print("\n--- TEST /api/scan-receipt (Mode Démo) ---")
payload_scan = {
    "fileBase64": "dummy-base64",
    "mimeType": "image/jpeg"
}

req_scan = urllib.request.Request(
    "http://localhost:3000/api/scan-receipt",
    data=json.dumps(payload_scan).encode("utf-8"),
    headers={"Content-Type": "application/json"}
)

with urllib.request.urlopen(req_scan) as res:
    data_scan = json.loads(res.read().decode("utf-8"))
    print("Store:", data_scan.get("store"))
    print("Total:", data_scan.get("total"), "€")
    print("Nb articles extraits:", len(data_scan.get("items", [])))
    print("Premier article:", data_scan.get("items", [])[0])
