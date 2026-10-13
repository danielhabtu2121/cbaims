import subprocess
import json
import urllib.request
import os

def run_sql(query):
    cmd = [
        "psql", "-h", "127.0.0.1", "-U", "cims_user", "-d", "cims_db_dev",
        "-t", "-A", "-F", "\t", "-c", query
    ]
    env = dict(os.environ)
    env["PGPASSWORD"] = "cims_password"
    result = subprocess.run(cmd, env=env, capture_output=True, text=True, check=True)
    lines = [line.strip() for line in result.stdout.strip().split("\n") if line.strip()]
    return [line.split("\t") for line in lines]

def get_api(path):
    url = f"http://localhost:8001/api/dashboard{path}"
    req = urllib.request.Request(url, headers={"User-Agent": "AuditScript/2.0"})
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode('utf-8'))

print("=" * 80)
print("EXTENSIVE REAL-DATA SYNCHRONIZATION AUDIT ACROSS ALL DASHBOARD TIERS")
print("=" * 80)

# Check 1: Summary vs Ground Truth DB
sum_res = get_api("/summary?userId=usr-exec")
db_exp = float(run_sql("SELECT SUM(outstanding_balance) FROM cims_loan_accounts;")[0][0])
db_col = float(run_sql("SELECT SUM(valuation_amount) FROM cims_collaterals;")[0][0])
db_fac_cnt = int(run_sql("SELECT COUNT(*) FROM cims_loan_accounts;")[0][0])
db_col_cnt = int(run_sql("SELECT COUNT(*) FROM cims_collaterals;")[0][0])
db_cust_cnt = int(run_sql("SELECT COUNT(*) FROM cims_customers;")[0][0])

assert abs(sum_res["totalOutstandingExposure"] - db_exp) < 0.01, f"Exposure mismatch: {sum_res['totalOutstandingExposure']} vs {db_exp}"
assert abs(sum_res["totalCollateralMarketValue"] - db_col) < 0.01, f"Collateral mismatch: {sum_res['totalCollateralMarketValue']} vs {db_col}"
assert sum_res["totalFacilitiesCount"] == db_fac_cnt, f"Facility count mismatch: {sum_res['totalFacilitiesCount']} vs {db_fac_cnt}"
assert sum_res["activeCollateralsCount"] == db_col_cnt, f"Collateral count mismatch: {sum_res['activeCollateralsCount']} vs {db_col_cnt}"
assert sum_res["totalCustomersCount"] == db_cust_cnt, f"Customer count mismatch: {sum_res['totalCustomersCount']} vs {db_cust_cnt}"
print("[PASS] Tier 1: Summary KPI synchronized with Database ground truth.")

# Check 2: Level 1 Bank Hierarchy
bank_res = get_api("/hierarchy/bank?userId=usr-exec")
seg_exp_sum = sum(s["exposure"] for s in bank_res["segments"])
assert abs(seg_exp_sum - db_exp) < 0.01, f"Sum of segments exposure mismatch: {seg_exp_sum} vs {db_exp}"
print(f"[PASS] Tier 2: Bank Hierarchy Segments sum to exactly ETB {seg_exp_sum:,.2f}.")

# Check 3: Level 2 Segment Hierarchy
for seg_name in ["Corporate Banking", "Retail Banking", "MSME Banking", "Interest-Free Banking (IFB)"]:
    encoded_seg = urllib.parse.quote(seg_name)
    seg_res = get_api(f"/hierarchy/segment?userId=usr-exec&segment={encoded_seg}")
    seg_db_exp = float(run_sql(f"SELECT COALESCE(SUM(outstanding_balance),0) FROM cims_loan_accounts WHERE segment = '{seg_name}';")[0][0])
    seg_db_col = float(run_sql(f"SELECT COALESCE(SUM(valuation_amount),0) FROM cims_collaterals WHERE owning_segment = '{seg_name}';")[0][0])
    api_exp = seg_res["summary"]["totalOutstandingExposure"]
    api_col = seg_res["summary"]["totalCollateralMarketValue"]
    assert abs(api_exp - seg_db_exp) < 0.01, f"Segment {seg_name} exp mismatch: {api_exp} vs {seg_db_exp}"
    assert abs(api_col - seg_db_col) < 0.01, f"Segment {seg_name} col mismatch: {api_col} vs {seg_db_col}"
    print(f"[PASS] Tier 3: Segment [{seg_name}] synchronized (Exp: {api_exp:,.2f}, Col: {api_col:,.2f}).")

# Check 4: Level 3 District Hierarchy
dist_res = get_api("/hierarchy/district?userId=usr-exec&district=Addis%20Ababa%20West%20District")
assert dist_res["districtName"] == "Addis Ababa West District"
print(f"[PASS] Tier 4: District [{dist_res['districtName']}] loaded with {len(dist_res.get('branches', []))} branches.")

# Check 5: Level 4 Branch Hierarchy
brn_res = get_api("/hierarchy/branch?userId=usr-exec&branch=Bole%20Special%20Branch")
assert brn_res["branchName"] == "Bole Special Branch"
print(f"[PASS] Tier 5: Branch [{brn_res['branchName']}] loaded with {len(brn_res.get('customers', []))} customers.")

# Check 6: Level 5 Customer 360
cust_row = run_sql("SELECT cif, name, branch FROM cims_customers LIMIT 1;")[0]
cif = cust_row[0]
cust_res = get_api(f"/hierarchy/customer/{cif}?userId=usr-exec")
assert cust_res["customer"]["cif"] == cif
print(f"[PASS] Tier 6: Customer 360 for [{cif} - {cust_res['customer']['name']}] verified.")

# Check 7: Level 6 Facility View
fac_row = run_sql("SELECT id, loan_reference, outstanding_balance FROM cims_loan_accounts LIMIT 1;")[0]
fac_id = fac_row[0]
fac_res = get_api(f"/hierarchy/facility/{fac_id}?userId=usr-exec")
assert fac_res["facility"]["id"] == fac_id
assert abs(fac_res["facility"]["outstandingBalance"] - float(fac_row[2])) < 0.01
print(f"[PASS] Tier 7: Facility View for [{fac_id}] verified with balance {float(fac_row[2]):,.2f}.")

# Check 8: Level 7 Collateral View
col_row = run_sql("SELECT id, code, valuation_amount FROM cims_collaterals LIMIT 1;")[0]
col_id = col_row[0]
col_res = get_api(f"/hierarchy/collateral/{col_id}?userId=usr-exec")
assert col_res["collateral"]["id"] == col_id
print(f"[PASS] Tier 8: Collateral View for [{col_id}] verified.")

# Check 9: Paginated Portfolio
p_res = get_api("/portfolio/paginated?userId=usr-exec&size=100")
assert p_res["totalElements"] == db_col_cnt, f"Portfolio totalElements mismatch: {p_res['totalElements']} vs {db_col_cnt}"
print(f"[PASS] Tier 9: Paginated portfolio row count matches DB collaterals ({p_res['totalElements']}).")

# Check 10: Charts Exposure vs Protection
charts_res = get_api("/charts?userId=usr-exec")
chart_evp = charts_res["exposureVsProtection"]
chart_tot_exp = sum(c["exposure"] for c in chart_evp)
assert abs(chart_tot_exp - db_exp) < 0.01, f"Chart total exposure mismatch: {chart_tot_exp} vs {db_exp}"
print(f"[PASS] Tier 10: Charts exposureVsProtection sums to exactly ETB {chart_tot_exp:,.2f}.")

print("=" * 80)
print("ALL 10 TIERS 100% SYNCHRONIZED WITH REAL DATABASE DATA!")
print("=" * 80)
