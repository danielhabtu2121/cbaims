# CBAIMS — Production CBS (Oracle Flexcube) Integration & Deployment Guide

This operational guide provides end-to-end instructions for connecting CBAIMS to the bank's live Core Banking System (Oracle FLEXCUBE) via the production Three-View pattern.

---

## 1. Executive Summary & Architecture

CBAIMS implements a **Zero-Write, Read-Only Source Integration** architecture with the bank's Core Banking System (CBS).

```
┌─────────────────────────────────────────────────────────────┐
│                    Bank CBS (Oracle DMZ)                    │
│   Target Host: 10.41.30.114:1521 | Service: FCUBUAT         │
│   Schema Owner: FCUBSLIVE | DB User: CBAIMSUSER             │
└──────────────┬───────────────────────────────┬──────────────┘
               │                               │
    STVWCBS_CBAIMS_CUSTOMER         STVWCBS_CBAIMS_FACILITY
       (16 Columns)                    (15 Columns)
               │                               │
               └───────────────┬───────────────┘
                               │
                   STVWCBS_CBAIMS_COLLATERAL
              (31 Columns with Embedded Linkages)
                               │
            ┌──────────────────┴──────────────────┐
            │   Authorized Egress: 172.22.10.55   │
            │   (or Bank Core Banking VPN Tunnel) │
            └──────────────────┬──────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                    CBAIMS Application                       │
│  - Dual Adapter Engine: CbsGateway (SIMULATOR vs REAL)      │
│  - Strict Read-Only HikariCP Connection Pool                │
│  - 62-Column Schema Validation                              │
│  - Multi-Entity Ingestion: Cust -> Fac -> Col -> Linkage    │
│  - Immutable Raw Snapshots & Field-Level Provenance Logs    │
│  - Post-Import Mastership: CBAIMS governs Collateral        │
└─────────────────────────────────────────────────────────────┘
```

### Key Architectural Guarantees:
1. **Strict Read-Only Access (`readOnly = true`, `autoCommit = false`)**: Zero writes, zero updates, zero DDL executed on CBS Oracle.
2. **Post-Import Mastership**: Once CBS data is ingested, CBAIMS is the operational master for valuations, documentation, insurance, and covenants.
3. **Existing Collateral Protection**: Records with `originType = 'CBAIMS_REGISTERED'` are never overwritten; collisions are routed to the Duplicate Review Queue.
4. **Data Provenance**: Unaltered source payloads are archived in `cbs_customer_raw_snapshots`, `cbs_facility_raw_snapshots`, and `cbs_collateral_raw_snapshots`.

---

## 2. Addresses, Credentials & Target Views

| Parameter | Environment Variable | Default Value | Notes |
|---|---|---|---|
| **CBS Mode** | `CIMS_CBS_MODE` | `REAL` (or `SIMULATOR`) | Set to `REAL` to query Oracle CBS |
| **JDBC Connection URL** | `CIMS_CBS_JDBC_URL` | `jdbc:oracle:thin:@//10.41.30.114:1521/FCUBUAT` | Target Oracle Host & Service |
| **Database Username** | `CIMS_CBS_USERNAME` | `CBAIMSUSER` | Read-only Oracle account |
| **Database Password** | `CIMS_CBS_PASSWORD` | *(Configured bank secret)* | Never hardcode in git commits |
| **Database Schema** | `CIMS_CBS_SCHEMA` | `FCUBSLIVE` | Schema containing the 3 views |
| **Customer View** | `CIMS_CBS_CUSTOMER_VIEW` | `FCUBSLIVE.STVWCBS_CBAIMS_CUSTOMER` | 16 mandatory columns |
| **Facility View** | `CIMS_CBS_FACILITY_VIEW` | `FCUBSLIVE.STVWCBS_CBAIMS_FACILITY` | 15 mandatory columns |
| **Collateral View** | `CIMS_CBS_COLLATERAL_VIEW` | `FCUBSLIVE.STVWCBS_CBAIMS_COLLATERAL` | 31 mandatory columns |

---

## 3. Network & Firewall Prerequisites

Because the CBS database resides in the bank's internal database DMZ, connection attempts from external workstations or unauthorized developer laptops will return `NETWORK_UNAVAILABLE` (connection timed out).

### Permitted Access Paths:
1. **Authorized Server Deployment (`172.22.10.55`)**:
   The bank's internal firewall is configured to allow egress traffic on port `1521` originating from `172.22.10.55` to `10.41.30.114`.
2. **Bank Core Banking VPN**:
   If developing locally, connect your machine to the internal bank VPN that routes subnet `10.41.30.0/24`.
3. **SSH Port Forwarding (Local Tunnel)**:
   If you have SSH access to `172.22.10.55`, you can create a local tunnel to test from your development workstation:
   ```bash
   ssh -L 1521:10.41.30.114:1521 user@172.22.10.55
   ```
   Then set JDBC URL to: `jdbc:oracle:thin:@//127.0.0.1:1521/FCUBUAT`

### Connectivity Verification:
Run on the deployment host (`172.22.10.55`):
```bash
# Using netcat
nc -zv 10.41.30.114 1521

# Or using curl/telnet
telnet 10.41.30.114 1521
```
*Expected Output:* `Connection to 10.41.30.114 1521 port [tcp/oracle] succeeded!`

---

## 4. Configuration Methods

### Option 1: Live In-UI Configuration & Testing (No Server Restart Required)
1. In CBAIMS web portal, navigate to **CBS Core Simulator** from the sidebar.
2. In the top status card, click **CBS Config** or toggle **Switch to Real CBS**.
3. In the modal:
   - Select **REAL CBS (Oracle Flexcube)**.
   - Confirm or update the **Oracle JDBC URL**, **Username**, and enter the **Oracle Password**.
   - Click **Test Connection**: CBAIMS executes an ad-hoc test against `SELECT 1 FROM DUAL` and displays connection diagnostic output immediately.
   - Click **Validate Schema**: CBAIMS verifies all 3 views and all 62 columns.
   - Click **Save & Apply**: CBAIMS closes any existing pool and connects directly using the new credentials.

### Option 2: Server Environment Variables (Recommended for Production)
On server `172.22.10.55`, configure the environment variables in your `systemd` service file (e.g. `/etc/systemd/system/cbaims-backend.service`):

```ini
[Unit]
Description=CBAIMS Backend Service
After=network.target postgresql.service

[Service]
Type=simple
User=cbaims
WorkingDirectory=/opt/cbaims/backend
Environment="CIMS_CBS_MODE=REAL"
Environment="CIMS_CBS_JDBC_URL=jdbc:oracle:thin:@//10.41.30.114:1521/FCUBUAT"
Environment="CIMS_CBS_USERNAME=CBAIMSUSER"
Environment="CIMS_CBS_PASSWORD=YOUR_ORACLE_PASSWORD_HERE"
Environment="CIMS_CBS_SCHEMA=FCUBSLIVE"
ExecStart=/usr/bin/java -jar /opt/cbaims/backend/target/cims-backend-0.0.1-SNAPSHOT.jar
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Then reload and restart:
```bash
sudo systemctl daemon-reload
sudo systemctl restart cbaims-backend
```

### Option 3: Docker Deployment
In `docker-compose.yml`, pass the variables to `cbaims-backend`:
```yaml
cbaims-backend:
  environment:
    CIMS_CBS_MODE: "REAL"
    CIMS_CBS_JDBC_URL: "jdbc:oracle:thin:@//10.41.30.114:1521/FCUBUAT"
    CIMS_CBS_USERNAME: "CBAIMSUSER"
    CIMS_CBS_PASSWORD: "YOUR_ORACLE_PASSWORD_HERE"
    CIMS_CBS_SCHEMA: "FCUBSLIVE"
```

---

## 5. End-to-End Verification via REST API

Once deployed or connected, verify the live integration using these endpoints:

### 1. Connection Health Check
```bash
curl -s http://localhost:8082/api/cbs/health | jq .
```
*Success Response:*
```json
{
  "mode": "REAL",
  "status": "AVAILABLE",
  "message": "Real CBS Oracle database connected successfully to jdbc:oracle:thin:@//10.41.30.114:1521/FCUBUAT (Schema: FCUBSLIVE)",
  "timestamp": "2026-11-23T14:45:00"
}
```

### 2. Full 62-Column Schema Validation
```bash
curl -s http://localhost:8082/api/cbs/schema/validate | jq .
```
*Success Response:*
```json
{
  "status": "AVAILABLE",
  "message": "All 3 Oracle views and all 62 columns validated successfully against FCUBSLIVE",
  "totalColumnsVerified": 62,
  "views": {
    "FCUBSLIVE.STVWCBS_CBAIMS_CUSTOMER": 16,
    "FCUBSLIVE.STVWCBS_CBAIMS_FACILITY": 15,
    "FCUBSLIVE.STVWCBS_CBAIMS_COLLATERAL": 31
  }
}
```

### 3. Dry-Run Import Preview
```bash
curl -s http://localhost:8082/api/cbs/three-views/preview | jq .
```
Pre-checks row counts, identifies unmapped branches or segments, and previews sample customer, facility, and collateral records without making any database changes.

### 4. Execute Live Three-View Import
```bash
curl -s -X POST "http://localhost:8082/api/cbs/three-views/import?batchRef=CBS-PROD-BATCH-001&chunkSize=50" | jq .
```
Imports and establishes canonical records in CBAIMS with immutable source snapshot preservation.

---

## 6. Troubleshooting Diagnostic Guide

| Diagnostic Status | Root Cause | Resolution |
|---|---|---|
| `NOT_CONFIGURED` | Missing JDBC URL, Username, or Password. | Set `CIMS_CBS_PASSWORD` in `application.yml` / env vars, or configure via UI modal. |
| `NETWORK_UNAVAILABLE` | Port 1521 unreachable or timed out. | Check firewall egress from host. Verify host IP is `172.22.10.55` or connect to Bank VPN. |
| `AUTHENTICATION_FAILED` (ORA-01017) | Invalid Oracle username or password. | Verify credentials with CBS DBA team; update password in config. |
| `VIEW_ACCESS_DENIED` (ORA-00942) | Table/view doesn't exist or user lacks `SELECT` grant. | Ask DBA to grant `SELECT` on `FCUBSLIVE.STVWCBS_CBAIMS_*` to `CBAIMSUSER`. |
| `NETWORK_PROTOCOL_ERROR` (ORA-12592: TNS:bad packet) | Stateful firewall dropped TCP Out-Of-Band (URG) packets or split TNS buffer during multi-row fetch. | Handled automatically via `oracle.net.disableOob=true`, forward-only result sets, and reduced fetch size (100). If it persists, ask network team to disable SQL*Net deep packet inspection on firewall. |
| `CBS_QUERY_TIMEOUT` (HTTP 504) | Query on CBS Oracle view timed out reading response bytes (after configured `CIMS_CBS_READ_TIMEOUT_MS`). View execution plan slow or scans entire table without index. | 1. Configure `CIMS_CBS_READ_TIMEOUT_MS=120000` or higher.<br>2. Ensure DBA verifies execution plan and index coverage as detailed below. |
| `NGINX_GATEWAY_TIMEOUT` (HTTP 504 nginx) | Nginx reverse proxy timed out waiting for backend during batch synchronization. | Ensure `frontend/nginx.conf` has `proxy_read_timeout 300s;` and `proxy_connect_timeout 300s;`. Rebuild frontend container: `docker compose build cbaims-frontend && docker compose up -d cbaims-frontend`. |
| `SCHEMA_MISMATCH` | Missing one or more of the 62 required columns. | Check `/api/cbs/schema/validate` response for `missingColumns` list and notify CBS DBA. |

---

## 7. Oracle DBA Verification Requirements

When querying `FCUBSLIVE.STVWCBS_CBAIMS_CUSTOMER`, `FCUBSLIVE.STVWCBS_CBAIMS_FACILITY`, and `FCUBSLIVE.STVWCBS_CBAIMS_COLLATERAL`:
1. **Execution Plan Verification**:
   - Run `EXPLAIN PLAN FOR SELECT * FROM FCUBSLIVE.STVWCBS_CBAIMS_CUSTOMER;`
   - Check if underlying Flexcube tables (e.g. `STTM_CUSTOMER`, `STTM_CUST_PERSONAL`, `STTM_CUST_CORPORATE`) are performing full table scans.
2. **Index Coverage**:
   - Ensure `CUSTOMER_NO`, `RECORD_STAT`, and `AUTH_STAT` columns are indexed on underlying tables.
   - For facility view: ensure index on `ACCOUNT_NUMBER` and `CUSTOMER_ID`.
   - For collateral view: ensure index on `COLLATERAL_CODE` and `COLLATERAL_OWNER_CIF`.
3. **Network & MTU**:
   - Verify MTU / packet fragmentation between deployment host `172.22.10.55` and Oracle host `10.41.30.114:1521`.
   - Ensure firewall inspection does not delay or drop long-running SQL*Net TCP streams.


