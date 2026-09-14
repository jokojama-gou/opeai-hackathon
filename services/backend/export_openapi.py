"""Export the implemented request routes, without contacting a backend or model."""

import json
from pathlib import Path
from app.config import Settings
from app.main import create_app

target = Path(__file__).resolve().parents[2] / "contracts" / "openapi.json"
target.write_text(
    json.dumps(create_app(settings=Settings()).openapi(), ensure_ascii=False, indent=2)
    + "\n",
    encoding="utf-8",
)
print("Exported implemented API routes to contracts/openapi.json")
