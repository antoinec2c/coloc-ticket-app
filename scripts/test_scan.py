import urllib.request
import json

# Petite image JPEG 1x1 pixel valide
pixel_b64 = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA="

req = urllib.request.Request(
    "http://localhost:3001/api/scan-receipt",
    data=json.dumps({
        "fileBase64": pixel_b64,
        "mimeType": "image/jpeg"
    }).encode("utf-8"),
    headers={"Content-Type": "application/json"}
)

try:
    with urllib.request.urlopen(req) as res:
        data = json.loads(res.read().decode("utf-8"))
        print("Réponse Gemini:", json.dumps(data, indent=2, ensure_ascii=False))
except urllib.error.HTTPError as e:
    print("Code retour:", e.code)
    print("Erreur:", e.read().decode("utf-8"))
