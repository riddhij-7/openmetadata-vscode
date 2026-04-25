# OpenMetadata for VS Code

Bring your data catalog directly into your editor. Hover over any table name in SQL, Python, or YAML files to instantly see metadata from OpenMetadata.

## Features

- 📊 Hover tooltips — description, owner, tier, tags, columns
- 🔗 Lineage — upstream and downstream tables  
- ✅ Data Quality — test results inline
- 🔍 Search — Cmd+Shift+P → OpenMetadata: Search Tables
- ⚡ Smart caching — instant after first load

## Quick Start

1. Install this extension
2. Go to `sandbox.open-metadata.org` and sign up
3. Profile → Settings → Access Token → Copy
4. VS Code Settings → search `openmetadata` → paste your token
5. Open any `.sql` file and hover over a table name

## Example

```sql
SELECT * FROM acme_nexus_raw_data.acme_raw.sales.orders;
--             ↑ hover here
```

## Supported Files
- SQL (`.sql`)
- Python (`.py`)
- dbt YAML (`.yml`, `.yaml`)