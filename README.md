# Database Anonymiser (CLI)

A safe, configurable PostgreSQL database anonymisation CLI tool for creating production-like datasets without exposing real user data.

---

## Why this exists

Production databases contain sensitive data:
- emails
- names
- phone numbers
- free-text notes
- tokens and identifiers

Copying production data into non-production environments is risky and often non-compliant.

This tool provides:
- repeatable anonymisation
- strong safety guarantees
- preview before applying changes
- audit-friendly outputs

---

## Core Concepts

### 1. Strategy-based anonymisation

Each column is anonymised using a strategy.

Common strategies:
- `KEEP` – leave data unchanged
- `EMAIL_FAKE` – replace with realistic fake emails
- `HASH_SHA256` – one-way deterministic hash (useful for IDs)
- `REDACT` – remove content (e.g. free text)
- `SET_NULL` – set value to NULL
- `TRUNCATE` – shorten long strings

Strategies are explicitly configured per table/column and you can also globally set a strategy for a column.

---

### 2. Type safety

Before executing any update:
- incompatible strategies are automatically downgraded to `KEEP`.
- warnings are logged (no silent corruption)

Example:

  [type-safety] public.users.created_at is DATE.
  Strategy "REDACT" not compatible. Downgrading to "KEEP".

This ensures schema integrity is never broken.

---

### 3. Dry run first (always)

Dry run:
- executes all UPDATE statements
- counts affected rows
- rolls back at the end
- produces a JSON report

Nothing is written unless you explicitly run `--apply`.

---

## How the tool works (workflow)
 Run the below commands from the root. 
 
### Step 1: Generate config from schema
```bash
npm run anonymize -- --configGen
```
This:
- scans the database schema
- generates:
  - anonymizer.config.yaml
  - anonymizer.samples.yaml
- does not modify data

### Step 2: Review and edit config

- Edit ```anonymizer.config.yaml```:
- choose strategies per column
- add denylisted tables


### Step 3: Dry run
```bash
npm run anonymize -- --dryrun
```
This:
- builds an execution plan
- runs anonymisation inside a transaction
- rolls back
- prints row counts per table
- fails safely if constraints are violated


### Step 4: Apply (real execution)
In anonymizer.config.yaml mark the config as reviewed once review is done.
  
  ```reviewed: true```
  
Apply cannot run without this flag.

```bash
npm run anonymize -- --apply
```
This:
- executes the same plan without rollback
- permanently anonymises data
- logs exactly what changed
