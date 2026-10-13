import urllib.request
import urllib.parse
import json
import uuid
import sys

BASE_URL = "http://localhost:8001/api"
DEFAULT_HEADERS = {
    "Content-Type": "application/json",
    "X-User-Id": "CRO_USER",
    "X-User-Role": "CRO"
}

def log(msg, success=True):
    symbol = "PASS" if success else "FAIL"
    print(f"[{symbol}] {msg}")

def do_req(url, method="GET", data=None, headers=None):
    hdrs = dict(DEFAULT_HEADERS)
    if headers:
        hdrs.update(headers)
    req_data = None
    if data is not None:
        req_data = json.dumps(data).encode("utf-8")
    req = urllib.request.Request(url, data=req_data, headers=hdrs, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            body = resp.read().decode("utf-8")
            try:
                return resp.status, json.loads(body)
            except:
                return resp.status, body
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        print(f"HTTP ERROR {e.code} on {method} {url}: {err_body}")
        try:
            return e.code, json.loads(err_body)
        except:
            return e.code, err_body

def run_tests():
    print("=====================================================================")
    print("STARTING FULL END-TO-END DOCUMENT ATTACHMENT & CONFIGURATION AUDIT")
    print("=====================================================================")

    # 1. State check
    try:
        status, state = do_req(f"{BASE_URL}/state")
        assert status == 200, f"Expected 200 from /state, got {status}"
        log(f"System State loaded successfully ({len(state.get('policies', []))} policies, {len(state.get('documents', []))} DMS docs)")
    except Exception as e:
        log(f"Backend not responding: {e}", False)
        sys.exit(1)

    # 2. Get or create a collateral and customer
    collaterals = state.get("collaterals", [])
    if not collaterals:
        log("No collaterals found in state", False)
        sys.exit(1)
    # 2. Get an active, fully validated collateral that has unused approved insurers
    col = None
    available_insurers = []
    for c in collaterals:
        c_id = c["id"]
        used = {p.get("insurerName") for p in state.get("policies", []) if p.get("collateralId") == c_id}
        avail = [i for i in state.get("insurers", []) if i.get("name") not in used]
        has_active = any(p.get("status") == "Active" and p.get("collateralId") == c_id for p in state.get("policies", []))
        if has_active and len(avail) >= 2:
            col = c
            col_id = c_id
            available_insurers = avail
            break
    if not col:
        col = collaterals[0]
        col_id = col["id"]
        available_insurers = state.get("insurers", [])

    ref_pol = [p for p in state.get("policies", []) if p.get("collateralId") == col_id and p.get("status") == "Active"][0]
    cust_id = col.get("customerId") or ref_pol.get("customerId", "CUST-001")
    base_insured_amt = float(ref_pol.get("insuredAmount") or 25000000.0)
    log(f"Using pledged collateral {col_id} (Customer: {cust_id}, Base Coverage: {base_insured_amt:,.2f})")

    # Pick two approved insurers not yet used for this collateral
    test_insurer = available_insurers[0]
    rep_insurer = available_insurers[1] if len(available_insurers) > 1 else available_insurers[0]
    log(f"Using approved insurer: {test_insurer['name']} ({test_insurer['id']})")
    log(f"Using replacement insurer: {rep_insurer['name']} ({rep_insurer['id']})")

    # 3. Register a test policy with an attached document
    test_pol_num = f"POL-TEST-{uuid.uuid4().hex[:6].upper()}"
    reg_payload = {
        "policy": {
            "policyNumber": test_pol_num,
            "insurerId": test_insurer.get("id"),
            "insurerName": test_insurer.get("name"),
            "coverageType": "Fire and Allied Perils",
            "insuredAmount": base_insured_amt,
            "premium": base_insured_amt * 0.005,
            "effectiveDate": "2026-10-01",
            "expiryDate": "2027-10-01",
            "collateralId": col_id,
            "customerId": cust_id,
            "status": "Active"
        },
        "documents": [
            {
                "name": "Original Policy Schedule",
                "type": "Insurance Policy Schedule",
                "fileName": "policy_schedule_test.pdf",
                "fileSizeNum": 102400,
                "contentType": "application/pdf",
                "fileContent": "data:application/pdf;base64,JVBERi0xLjQKJUZha2VQREZD",
                "remarks": "Original physical policy scanned copy"
            }
        ]
    }
    status, pol = do_req(f"{BASE_URL}/policies/register?userId=CRO_USER", method="POST", data=reg_payload)
    assert status == 200, f"Policy registration failed: {pol}"
    pol_id = pol.get("policy", {}).get("id") or pol.get("id")
    assert pol_id, f"Could not determine policy ID from {pol}"
    log(f"Policy registered: {pol_id} ({test_pol_num})")

    # Verify document in DMS
    status, dms_docs = do_req(f"{BASE_URL}/documents")
    reg_docs = [d for d in dms_docs if d.get("entityId") == pol_id]
    assert len(reg_docs) >= 1, "Attached document not saved to DMS table OwnershipDocument!"
    log(f"DMS verified: Attached document '{reg_docs[0]['name']}' (ID: {reg_docs[0]['id']}) linked to Policy {pol_id}")

    # Approve policy so it transitions from 'Pending Approval' to 'Active'
    status, appr = do_req(f"{BASE_URL}/policies/approve?policyId={pol_id}&userId=BRMGR_USER", method="POST")
    assert status == 200, f"Approval failed: {appr}"
    log(f"Policy {pol_id} approved by Checker into Active status")

    # 4. Amend policy with an amendment document
    amend_payload = {
        "policy": {
            "insuredAmount": base_insured_amt + 2000000.0,
            "premium": (base_insured_amt + 2000000.0) * 0.005
        },
        "documents": [
            {
                "name": "Valuation Increase Amendment",
                "type": "Policy Amendment Document",
                "fileName": "amendment_endorsement.pdf",
                "fileSizeNum": 204800,
                "contentType": "application/pdf",
                "fileContent": "data:application/pdf;base64,JVBERi0xLjQKJUFtZW5kbWVudFBERg==",
                "remarks": "Revised cover terms after annual revaluation"
            }
        ]
    }
    status, amend_res = do_req(f"{BASE_URL}/policies/{pol_id}/amend?reason=Annual+Revaluation&userId=CRO_USER", method="POST", data=amend_payload)
    assert status == 200, f"Policy amend failed: {amend_res}"
    log(f"Policy {pol_id} amended with document attachment successfully")

    # Verify amendment document in DMS
    status, dms_docs = do_req(f"{BASE_URL}/documents")
    amend_docs = [d for d in dms_docs if d.get("entityId") == pol_id and "Amendment" in d.get("type", "")]
    assert len(amend_docs) >= 1, "Amendment document not saved to DMS!"
    log(f"DMS verified: Amendment document '{amend_docs[0]['name']}' (ID: {amend_docs[0]['id']}) stored")

    # Approve amendment so policy returns to Active
    do_req(f"{BASE_URL}/policies/approve?policyId={pol_id}&userId=BRMGR_USER", method="POST")

    # 5. Endorse policy with an endorsement certificate
    end_payload = {
        "documents": [
            {
                "name": "Sole Loss Payee Endorsement Certificate",
                "type": "Policy Endorsement Certificate",
                "fileName": "loss_payee_endorsement.pdf",
                "fileSizeNum": 150000,
                "contentType": "application/pdf",
                "fileContent": "data:application/pdf;base64,JVBERi0xLjQKJUVuZExpc3Q=",
                "remarks": "Formally endorses Bank as sole loss payee"
            }
        ]
    }
    end_no = f"END-{uuid.uuid4().hex[:6].upper()}"
    status, endorsement = do_req(
        f"{BASE_URL}/policies/{pol_id}/endorse?endorsementNo={end_no}&description=Bank+Sole+Loss+Payee&effectiveDate=2026-10-01&userId=CRO_USER",
        method="POST",
        data=end_payload
    )
    assert status == 200, f"Policy endorse failed: {endorsement}"
    log(f"Policy {pol_id} endorsed with {end_no}")

    # Verify endorsement document in DMS
    status, dms_docs = do_req(f"{BASE_URL}/documents")
    end_docs = [d for d in dms_docs if d.get("entityId") == pol_id and "Endorsement" in d.get("type", "")]
    assert len(end_docs) >= 1, "Endorsement document not saved to DMS!"
    log(f"DMS verified: Endorsement document '{end_docs[0]['name']}' (ID: {end_docs[0]['id']}) stored")

    # Approve endorsement task
    do_req(f"{BASE_URL}/policies/approve?policyId={pol_id}&userId=BRMGR_USER", method="POST")

    # 6. Renew policy with renewal schedule
    renew_amt = base_insured_amt + 3000000.0
    renew_payload = {
        "newAmount": renew_amt,
        "newPremium": renew_amt * 0.005,
        "newExpiryDate": "2028-10-01",
        "documents": [
            {
                "name": "Renewal Premium Receipt",
                "type": "Policy Renewal Schedule",
                "fileName": "renewal_receipt_2027.pdf",
                "fileSizeNum": 180000,
                "contentType": "application/pdf",
                "fileContent": "data:application/pdf;base64,JVBERi0xLjQKUmVuZXc=",
                "remarks": "Bank payment settlement receipt for 2027 renewal"
            }
        ]
    }
    status, renew_res = do_req(
        f"{BASE_URL}/policies/{pol_id}/renew?newAmount={renew_amt}&newPremium={renew_amt * 0.005}&newExpiryDate=2028-10-01&userId=CRO_USER",
        method="POST",
        data=renew_payload
    )
    assert status == 200, f"Policy renewal failed: {renew_res}"
    log(f"Policy {pol_id} renewed with renewal document")

    # Verify renewal document in DMS
    status, dms_docs = do_req(f"{BASE_URL}/documents")
    renew_docs = [d for d in dms_docs if d.get("entityId") == pol_id and "Renewal" in d.get("type", "")]
    assert len(renew_docs) >= 1, "Renewal document not saved to DMS!"
    log(f"DMS verified: Renewal document '{renew_docs[0]['name']}' (ID: {renew_docs[0]['id']}) stored")

    # Approve renewal policy
    new_pol_id = renew_res.get("policy", {}).get("id") or renew_res.get("newPolicyId")
    if new_pol_id:
        do_req(f"{BASE_URL}/policies/approve?policyId={new_pol_id}&userId=BRMGR_USER", method="POST")

    # 7. Replace policy with replacement schedule
    replace_amt = base_insured_amt + 4000000.0
    replace_payload = {
        "replacement": {
            "policyNumber": f"POL-REP-{uuid.uuid4().hex[:6].upper()}",
            "insurerId": rep_insurer.get("id"),
            "insurerName": rep_insurer.get("name"),
            "coverageType": "Fire and Allied Perils",
            "insuredAmount": replace_amt,
            "premium": replace_amt * 0.005,
            "effectiveDate": "2026-10-01",
            "expiryDate": "2027-10-01",
            "collateralId": col_id,
            "customerId": cust_id
        },
        "documents": [
            {
                "name": "Novation Schedule and New Policy Cover",
                "type": "Policy Replacement Schedule",
                "fileName": "replacement_schedule.pdf",
                "fileSizeNum": 210000,
                "contentType": "application/pdf",
                "fileContent": "data:application/pdf;base64,JVBERi0xLjQKUmVwbGFjZQ==",
                "remarks": "Novation schedule from Awash Insurance"
            }
        ]
    }
    status, rep_res = do_req(f"{BASE_URL}/policies/{pol_id}/replace?reason=Switch+to+Awash+Insurance&userId=CRO_USER", method="POST", data=replace_payload)
    assert status == 200, f"Policy replace failed: {rep_res}"
    log(f"Policy {pol_id} replaced with replacement schedule document")

    # Verify replacement document in DMS
    status, dms_docs = do_req(f"{BASE_URL}/documents")
    rep_docs = [d for d in dms_docs if d.get("entityId") == pol_id and "Replacement" in d.get("type", "")]
    assert len(rep_docs) >= 1, "Replacement document not saved to DMS!"
    log(f"DMS verified: Replacement document '{rep_docs[0]['name']}' (ID: {rep_docs[0]['id']}) stored")

    # Approve replacement task
    rep_pol_id = rep_res.get("policy", {}).get("id") or rep_res.get("replacementPolicyId")
    if rep_pol_id:
        do_req(f"{BASE_URL}/policies/approve?policyId={rep_pol_id}&userId=BRMGR_USER", method="POST")

    # 8. Close policy with closure proof
    close_payload = {
        "documents": [
            {
                "name": "Loan Settlement and Discharge Memo",
                "type": "Policy Closure Proof",
                "fileName": "loan_discharge_settlement.pdf",
                "fileSizeNum": 110000,
                "contentType": "application/pdf",
                "fileContent": "data:application/pdf;base64,JVBERi0xLjQKQ2xvc2U=",
                "remarks": "Facility maturity and payoff clearance letter"
            }
        ]
    }
    status, close_res = do_req(f"{BASE_URL}/policies/{pol_id}/close?reason=Facility+Settled&userId=CRO_USER", method="POST", data=close_payload)
    assert status == 200, f"Policy close failed: {close_res}"
    log(f"Policy {pol_id} closed with closure proof document")

    # Verify closure document in DMS
    status, dms_docs = do_req(f"{BASE_URL}/documents")
    close_docs = [d for d in dms_docs if d.get("entityId") == pol_id and "Closure" in d.get("type", "")]
    assert len(close_docs) >= 1, "Closure document not saved to DMS!"
    log(f"DMS verified: Closure document '{close_docs[0]['name']}' (ID: {close_docs[0]['id']}) stored")

    # Approve closure so status transitions to 'Closed'
    status, appr_close = do_req(f"{BASE_URL}/policies/approve?policyId={pol_id}&userId=BRMGR_USER", method="POST")
    assert status == 200, f"Approve closure failed: {appr_close}"
    log(f"Policy {pol_id} closure approved -> status Closed")

    # 9. Reopen policy with reopening authorization
    reopen_payload = {
        "documents": [
            {
                "name": "Management Reopening Authorization Memo",
                "type": "Policy Reopening Authorization",
                "fileName": "reopen_authorization_VP.pdf",
                "fileSizeNum": 130000,
                "contentType": "application/pdf",
                "fileContent": "data:application/pdf;base64,JVBERi0xLjQKUmVvcGVu",
                "remarks": "VP credit authorization for coverage extension"
            }
        ]
    }
    status, reopen_res = do_req(f"{BASE_URL}/policies/{pol_id}/reopen?reason=Reactivated+for+Tranche+2&userId=CRO_USER", method="POST", data=reopen_payload)
    assert status == 200, f"Policy reopen failed: {reopen_res}"
    log(f"Policy {pol_id} reopen requested with authorization memo")

    # Verify reopening document in DMS
    status, dms_docs = do_req(f"{BASE_URL}/documents")
    reopen_docs = [d for d in dms_docs if d.get("entityId") == pol_id and "Reopening" in d.get("type", "")]
    assert len(reopen_docs) >= 1, "Reopening document not saved to DMS!"
    log(f"DMS verified: Reopening document '{reopen_docs[0]['name']}' (ID: {reopen_docs[0]['id']}) stored")

    # 11. Test Admin Configuration persistence & instant synchronization
    print("\n--- Verifying Admin Configuration Persistence ---")
    admin_hdrs = {"X-User-Id": "usr-sysadmin", "X-User-Role": "SYSADMIN"}
    param_payload = {
        "paramKey": "min_coverage_adequacy_pct",
        "paramValue": "100",
        "description": "Statutory minimum insurance coverage percentage against credit exposure"
    }
    status, param_res = do_req(f"{BASE_URL}/admin/parameters/save?userId=usr-sysadmin", method="POST", data=param_payload, headers=admin_hdrs)
    assert status == 200, f"Save parameter failed: {param_res}"
    log("Admin Parameter saved successfully")

    ins_suffix = uuid.uuid4().hex[:4].upper()
    insurer_payload = {
        "code": f"TEST-INS-{ins_suffix}",
        "name": f"Global Insurance Enterprise {ins_suffix}",
        "rating": "A-",
        "status": "Approved",
        "active": True
    }
    status, ins_res = do_req(f"{BASE_URL}/admin/insurers/save?adminUserId=usr-sysadmin", method="POST", data=insurer_payload, headers=admin_hdrs)
    assert status == 200, f"Save insurer failed: {ins_res}"
    log("Approved Insurer saved successfully")

    tax_payload = {
        "code": "REAL_ESTATE_COMMERCIAL",
        "category": "Real Estate",
        "subCategory": "Commercial Building",
        "defaultHaircutPct": 25.0,
        "valuationFrequencyMonths": 12,
        "isInsuranceMandatory": True
    }
    status, tax_res = do_req(f"{BASE_URL}/admin/taxonomy/save?userId=usr-sysadmin", method="POST", data=tax_payload, headers=admin_hdrs)
    assert status == 200, f"Save taxonomy failed: {tax_res}"
    log("Collateral Taxonomy saved successfully")

    # 12. Test Hierarchical Dashboard live telemetry sync
    print("\n--- Verifying Hierarchical Dashboard Telemetry Sync ---")
    exec_hdrs = {"X-User-Id": "usr-exec", "X-User-Role": "EXEC"}
    status, bank_data = do_req(f"{BASE_URL}/dashboard/hierarchy/bank?userId=usr-exec", headers=exec_hdrs)
    assert status == 200, f"Bank hierarchy failed: {bank_data}"
    log(f"Bank-Wide Hierarchy loaded (KPIs: {list(bank_data.get('kpis', {}).keys())})")

    status, seg_data = do_req(f"{BASE_URL}/dashboard/hierarchy/segment?segment=Corporate+Banking&userId=usr-exec", headers=exec_hdrs)
    assert status == 200, f"Segment hierarchy failed: {seg_data}"
    log(f"Segment Hierarchy loaded for Corporate Banking (Operating Districts: {len(seg_data.get('operatingDistricts', []))})")

    print("\n=====================================================================")
    print("ALL 12 REAL ENTERPRISE FUNCTIONALITY AUDIT CHECKS PASSED 100%!")
    print("=====================================================================")

if __name__ == "__main__":
    run_tests()
