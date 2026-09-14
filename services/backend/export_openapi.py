"""Export the implemented request routes, without contacting a backend or model."""

import json
from pathlib import Path
from app.config import Settings
from app.main import create_app
from app.derived_contracts import DerivedContracts

target = Path(__file__).resolve().parents[2] / "contracts" / "openapi.json"
target.write_text(
    json.dumps(create_app(settings=Settings()).openapi(), ensure_ascii=False, indent=2)
    + "\n",
    encoding="utf-8",
)
print("Exported implemented API routes to contracts/openapi.json")
schema = DerivedContracts.model_json_schema(ref_template="#/definitions/{model}")
schema["definitions"] = schema.pop("$defs")
schema["$id"] = "https://hackathon.invalid/derived-v1.schema.json"
schema["$schema"] = "http://json-schema.org/draft-07/schema#"
target.with_name("derived-v1.schema.json").write_text(
    json.dumps(schema, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
)
print("Exported personal derived response contracts")
