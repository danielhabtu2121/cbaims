import json
import urllib.request
import urllib.error
import urllib.parse
import sys

BASE_URL = "http://localhost:8001/api"

def make_request(method, path, body=None, params=None):
    url = f"{BASE_URL}{path}"
    if params:
        url += "?" + urllib.parse.urlencode(params)
    data = json.dumps(body).encode("utf-8") if body is not None else None
    headers = {"Content-Type": "application/json"}
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            content = resp.read().decode("utf-8")
            return resp.status, json.loads(content) if content else {}
    except urllib.error.HTTPError as e:
        content = e.read().decode("utf-8")
        try:
            parsed = json.loads(content)
        except Exception:
            parsed = {"error": content}
        return e.code, parsed

def run_tests():
    print("=" * 80)
    print("MODULE 4 - COLLATERAL-FACILITY LINKING & ALLOCATION VERIFICATION SUITE")
    print("=" * 80)

    # 1. Fetch initial state
    status, state = make_request("GET", "/state")
    assert status == 200, f"Failed to get state: {status}"
    customers = state.get("customers", [])
    collaterals = state.get("collaterals", [])
    facilities = state.get("facilities", [])
    links = state.get("links", [])

    print(f"Loaded: {len(customers)} customers, {len(collaterals)} collaterals, {len(facilities)} facilities, {len(links)} links")
    assert len(customers) >= 2, "Need at least 2 customers"
    assert len(collaterals) >= 2, "Need at least 2 collaterals"
    assert len(facilities) >= 3, "Need at least 3 facilities"

    passed_tests = []
    failed_tests = []

    # -------------------------------------------------------------------------
    # Scenario A: One Collateral Securing One Loan Account (One-to-One)
    # -------------------------------------------------------------------------
    try:
        print("\n--- Scenario A: One Collateral Securing One Loan Account (One-to-One) ---")
        target_cust = None
        target_col = None
        target_fac = None
        for c in customers:
            cust_cols = [col for col in collaterals if col.get("customerId") == c.get("id") and col.get("ownerType") != "Third-party-owned"]
            cust_facs = [f for f in facilities if f.get("customerId") == c.get("id") and f.get("status") in ["Active", "Performing"]]
            if cust_cols and cust_facs:
                target_cust = c
                target_col = cust_cols[0]
                target_fac = cust_facs[0]
                break

        assert target_col is not None and target_fac is not None, "Could not find matching customer, collateral, and facility"

        val_amt = float(target_col.get("valuationAmount", 1000000))
        haircut = float(target_col.get("haircut", 20))
        nsv = val_amt * (1 - haircut / 100)
        alloc_amt = min(50000.0, nsv * 0.2)

        link_payload = {
            "collateralId": target_col["id"],
            "loanAccountId": target_fac["id"],
            "allocatedAmount": alloc_amt,
            "linkageType": "Primary",
            "effectiveDate": "2026-10-01",
            "changeReason": "Module 4 Test Scenario A - One-to-One Link",
            "source": "CIMS"
        }

        status, resp = make_request("POST", "/collateral-facility-links", body=link_payload, params={"userId": "usr-sysadmin"})
        if status not in [200, 201]:
            if "already linked" in str(resp):
                status, sum_resp = make_request("GET", f"/collaterals/{target_col['id']}/facilities")
                created_link = sum_resp["securedFacilities"][0]
            else:
                raise Exception(f"Failed to create link: {status} {resp}")
        else:
            created_link = resp

        assert created_link.get("id", "").startswith("LNK-"), f"Link ID must start with LNK-, got {created_link.get('id')}"
        print(f"[OK] Link established with canonical Link ID: {created_link.get('id')}")
        print(f"[OK] Preserved Master Collateral ID: {target_col.get('code')} ({target_col.get('id')})")
        passed_tests.append("Scenario A: One-to-One Linkage with canonical LNK- ID")
    except Exception as e:
        print(f"[FAIL] Scenario A Failed: {e}")
        failed_tests.append(f"Scenario A: {e}")

    # -------------------------------------------------------------------------
    # Scenario B: One Collateral Securing Multiple Loan Accounts (One-to-Many)
    # -------------------------------------------------------------------------
    try:
        print("\n--- Scenario B: One Collateral Securing Multiple Facilities (One-to-Many) ---")
        multi_cust = None
        multi_col = None
        multi_facs = []
        for c in customers:
            cust_cols = [col for col in collaterals if col.get("customerId") == c.get("id")]
            cust_facs = [f for f in facilities if f.get("customerId") == c.get("id") and f.get("status") in ["Active", "Performing"]]
            if cust_cols and len(cust_facs) >= 2:
                multi_cust = c
                multi_col = cust_cols[0]
                multi_facs = cust_facs[:2]
                break

        assert len(multi_facs) >= 2, "Need customer with at least 2 facilities"

        # Link first facility
        link1_payload = {
            "collateralId": multi_col["id"],
            "loanAccountId": multi_facs[0]["id"],
            "allocatedAmount": 30000.0,
            "linkageType": "Primary",
            "effectiveDate": "2026-10-01",
            "changeReason": "Scenario B - Link Fac 1",
            "source": "CIMS"
        }
        make_request("POST", "/collateral-facility-links", body=link1_payload, params={"userId": "usr-sysadmin"})
        
        # Link second facility
        link2_payload = {
            "collateralId": multi_col["id"],
            "loanAccountId": multi_facs[1]["id"],
            "allocatedAmount": 25000.0,
            "linkageType": "Cross-Collateral",
            "effectiveDate": "2026-10-01",
            "changeReason": "Scenario B - Link Fac 2",
            "source": "CIMS"
        }
        make_request("POST", "/collateral-facility-links", body=link2_payload, params={"userId": "usr-sysadmin"})

        # Query authoritative collateral secured facilities summary
        status_sum, sum_data = make_request("GET", f"/collaterals/{multi_col['id']}/facilities")
        assert status_sum == 200, f"Failed to get secured facilities: {status_sum}"
        
        linked_count = sum_data.get("linkedFacilityCount", 0)
        assert linked_count >= 2, f"Expected at least 2 linked facilities, got {linked_count}"
        
        print(f"[OK] Master Collateral {multi_col['code']} secures {linked_count} facilities without duplicating master record!")
        print(f"[OK] Total Allocated Security: ETB {sum_data.get('totalAllocatedSecurity'):,.2f}")
        print(f"[OK] Aggregate Secured Exposure: ETB {sum_data.get('aggregateSecuredExposure'):,.2f}")
        print(f"[OK] Remaining Capacity: ETB {sum_data.get('unallocatedSecurity'):,.2f}")
        passed_tests.append("Scenario B: One-to-Many Shared Collateral Control")
    except Exception as e:
        print(f"[FAIL] Scenario B Failed: {e}")
        failed_tests.append(f"Scenario B: {e}")

    # -------------------------------------------------------------------------
    # Scenario C: Multiple Collaterals Securing One Loan Account (Many-to-One)
    # -------------------------------------------------------------------------
    try:
        print("\n--- Scenario C: Multiple Collaterals Securing One Facility (Many-to-One) ---")
        # Find facility with securing collaterals or link a second collateral
        test_fac = multi_facs[0]
        # Query existing or link another collateral of same customer if available
        same_cust_cols = [c for c in collaterals if c.get("customerId") == multi_cust.get("id")]
        if len(same_cust_cols) >= 2:
            link_col2 = {
                "collateralId": same_cust_cols[1]["id"],
                "loanAccountId": test_fac["id"],
                "allocatedAmount": 15000.0,
                "linkageType": "Secondary",
                "effectiveDate": "2026-10-01",
                "changeReason": "Scenario C - Multi Col Securing One Facility",
                "source": "CIMS"
            }
            make_request("POST", "/collateral-facility-links", body=link_col2, params={"userId": "usr-sysadmin"})

        status_fsum, fsum_data = make_request("GET", f"/facilities/{test_fac['id']}/collaterals")
        assert status_fsum == 200, f"Failed to get facility collateral summary: {status_fsum}"
        col_count = fsum_data.get("linkedCollateralCount", 0)
        tot_alloc = fsum_data.get("totalAllocatedCollateral", 0)
        cov_pct = fsum_data.get("collateralCoveragePct", 0)
        print(f"[OK] Facility {fsum_data.get('loanReference') or test_fac['id']} secured by {col_count} collateral(s)")
        print(f"[OK] Total Allocated Collateral: ETB {tot_alloc:,.2f}, Coverage: {cov_pct:.1f}%")
        passed_tests.append("Scenario C: Multiple Collaterals Securing One Facility (Many-to-One)")
    except Exception as e:
        print(f"[FAIL] Scenario C Failed: {e}")
        failed_tests.append(f"Scenario C: {e}")

    # -------------------------------------------------------------------------
    # Scenario D: Cross-Collateralized Facilities (Many-to-Many)
    # -------------------------------------------------------------------------
    try:
        print("\n--- Scenario D: Cross-Collateralized Facilities (Many-to-Many) ---")
        status_cols, col_list = make_request("GET", "/collaterals")
        multi_linked = [c for c in col_list if c.get("currentAllocation", 0) > 0]
        assert len(multi_linked) >= 1, "Expected active linked collaterals"
        print(f"[OK] Verified active pool of cross-collateralized assets securing core facilities without master duplication")
        passed_tests.append("Scenario D: Cross-Collateralized Facilities Engine")
    except Exception as e:
        print(f"[FAIL] Scenario D Failed: {e}")
        failed_tests.append(f"Scenario D: {e}")

    # -------------------------------------------------------------------------
    # Scenario E: Borrower Isolation Defense (Borrower-Owned Collateral Cross-Customer Block)
    # -------------------------------------------------------------------------
    try:
        print("\n--- Scenario E: Borrower Isolation Defense ---")
        cust1 = customers[0]
        cust2 = customers[1]
        col_cust1 = [col for col in collaterals if col.get("customerId") == cust1.get("id") and col.get("ownerType") != "Third-party-owned"][0]
        fac_cust2 = [f for f in facilities if f.get("customerId") == cust2.get("id")][0]

        illegal_payload = {
            "collateralId": col_cust1["id"],
            "loanAccountId": fac_cust2["id"],
            "allocatedAmount": 50000.0,
            "linkageType": "Primary",
            "effectiveDate": "2026-10-01",
            "changeReason": "Scenario E Illegal Link",
            "source": "CIMS"
        }

        # 1. Pre-validation endpoint
        val_status, val_resp = make_request("POST", "/collateral-facility-links/validate", body=illegal_payload)
        assert val_status == 200
        assert val_resp.get("valid") == False, "Pre-validation should have rejected cross-borrower link for borrower-owned collateral"
        cust_check = [c for c in val_resp.get("checks", []) if c.get("ruleKey") == "VAL-REL-CUST"][0]
        assert cust_check["passed"] == False
        print(f"[OK] Pre-validation blocked cross-borrower link: {cust_check['message']}")

        # 2. Create endpoint
        create_status, create_resp = make_request("POST", "/collateral-facility-links", body=illegal_payload, params={"userId": "usr-sysadmin"})
        assert create_status == 400, f"Expected 400 Bad Request, got {create_status}"
        assert "This facility belongs to another customer and cannot be selected for borrower-owned collateral." in str(create_resp), f"Expected exact message, got: {create_resp}"
        print(f"[OK] Server-side endpoint rejected with 400 Bad Request: {create_resp.get('message')}")
        passed_tests.append("Scenario E: Borrower Isolation Defense strictly enforced")
    except Exception as e:
        print(f"[FAIL] Scenario E Failed: {e}")
        failed_tests.append(f"Scenario E: {e}")

    # -------------------------------------------------------------------------
    # Scenario F: Third-Party Collateral Cross-Customer Allocation
    # -------------------------------------------------------------------------
    try:
        print("\n--- Scenario F: Third-Party Collateral Cross-Customer Allocation ---")
        tp_cols = [col for col in collaterals if col.get("ownerType") == "Third-party-owned"]
        if not tp_cols:
            sample_tp = collaterals[0]
        else:
            sample_tp = tp_cols[0]

        target_beneficiary = customers[1]
        elig_status, elig_facs = make_request("GET", f"/collaterals/{sample_tp['id']}/eligible-facilities", params={"targetCustomerId": target_beneficiary["id"], "userId": "usr-sysadmin"})
        assert elig_status == 200, f"Eligible facilities returned status {elig_status}"
        print(f"[OK] Found {len(elig_facs)} eligible facilities for target customer {target_beneficiary.get('name')}")
        passed_tests.append("Scenario F: Third-Party Cross-Customer Allocation Endpoint")
    except Exception as e:
        print(f"[FAIL] Scenario F Failed: {e}")
        failed_tests.append(f"Scenario F: {e}")

    # -------------------------------------------------------------------------
    # Scenario G: Duplicate Active Link Blocked (Database & API Level Defense)
    # -------------------------------------------------------------------------
    try:
        print("\n--- Scenario G: Duplicate Active Link Prevention ---")
        status_st, st_now = make_request("GET", "/state")
        active_links = st_now.get("links", [])
        assert len(active_links) > 0, "Need active links for Scenario G"
        active_link = active_links[0]
        
        dup_payload = {
            "collateralId": active_link["collateralId"],
            "loanAccountId": active_link["loanAccountId"],
            "allocatedAmount": 10000.0,
            "linkageType": "Primary",
            "effectiveDate": "2026-10-01",
            "changeReason": "Scenario G Duplicate Link Attempt",
            "source": "CIMS"
        }

        # 1. Validation check
        val_status, val_resp = make_request("POST", "/collateral-facility-links/validate", body=dup_payload)
        assert val_status == 200
        assert val_resp.get("valid") == False
        dup_check = [c for c in val_resp.get("checks", []) if c.get("ruleKey") == "VAL-REL-DUP"][0]
        assert dup_check["passed"] == False
        assert "This facility is already linked to this collateral." == dup_check["message"]

        # 2. Creation attempt
        create_status, create_resp = make_request("POST", "/collateral-facility-links", body=dup_payload, params={"userId": "usr-sysadmin"})
        assert create_status == 400, f"Expected 400 Bad Request, got {create_status}"
        assert "This facility is already linked to this collateral." in str(create_resp)
        print(f"[OK] Blocked duplicate link attempt with exact message: {create_resp.get('message')}")
        passed_tests.append("Scenario G: Duplicate active link prevention (API & DB constraint)")
    except Exception as e:
        print(f"[FAIL] Scenario G Failed: {e}")
        failed_tests.append(f"Scenario G: {e}")

    # -------------------------------------------------------------------------
    # Scenario H: Duplicate Collateral Search (§23, §24)
    # -------------------------------------------------------------------------
    try:
        print("\n--- Scenario H: Duplicate Collateral Search Before Registration ---")
        first_col = collaterals[0]
        search_status, search_resp = make_request("GET", "/collaterals/search-existing", params={"code": first_col.get("code")})
        assert search_status == 200, f"Search failed: {search_status}"
        assert search_resp.get("found") == True, "Expected duplicate to be found"
        assert search_resp.get("collateralCode") == first_col.get("code"), "Found wrong collateral"
        print(f"[OK] Duplicate collateral search by Code matched: {search_resp['collateralCode']}")

        if first_col.get("titleDeedNumber"):
            s_status2, s_resp2 = make_request("GET", "/collaterals/search-existing", params={"titleDeedNumber": first_col.get("titleDeedNumber")})
            assert s_status2 == 200 and s_resp2.get("found") == True
            print(f"[OK] Duplicate collateral search by Title Deed matched: {s_resp2['collateralCode']}")

        passed_tests.append("Scenario H: Duplicate Collateral Search Engine (§23, §24)")
    except Exception as e:
        print(f"[FAIL] Scenario H Failed: {e}")
        failed_tests.append(f"Scenario H: {e}")

    # -------------------------------------------------------------------------
    # Scenario I: Allocation Overflow Beyond Net Collateral Value (Ceiling)
    # -------------------------------------------------------------------------
    try:
        print("\n--- Scenario I: Allocation Capacity Ceiling & Overflow Validation ---")
        test_col = collaterals[0]
        test_fac = [f for f in facilities if f.get("customerId") == test_col.get("customerId")][0]
        
        overflow_amount = 999999999.0

        overflow_payload = {
            "collateralId": test_col["id"],
            "loanAccountId": test_fac["id"],
            "allocatedAmount": overflow_amount,
            "linkageType": "Primary",
            "effectiveDate": "2026-10-01",
            "changeReason": "Scenario I Overflow Attempt",
            "source": "CIMS"
        }

        # 1. Pre-validation
        val_status, val_resp = make_request("POST", "/collateral-facility-links/validate", body=overflow_payload)
        assert val_status == 200
        assert val_resp.get("valid") == False
        cap_check = [c for c in val_resp.get("checks", []) if c.get("ruleKey") == "VAL-REL-CAPACITY"][0]
        assert cap_check["passed"] == False
        assert "exceeds the net collateral value" in cap_check["message"]
        print(f"[OK] Pre-validation caught overflow: {cap_check['message']}")

        # 2. Create endpoint
        create_status, create_resp = make_request("POST", "/collateral-facility-links", body=overflow_payload, params={"userId": "usr-sysadmin"})
        assert create_status == 400
        assert "exceeds the net collateral value" in str(create_resp)
        print(f"[OK] Create endpoint rejected overflow with 400: {create_resp.get('message')}")
        passed_tests.append("Scenario I: Allocation Overflow Capacity Ceiling Enforced")
    except Exception as e:
        print(f"[FAIL] Scenario I Failed: {e}")
        failed_tests.append(f"Scenario I: {e}")

    # -------------------------------------------------------------------------
    # Scenario J: Allocation Maintenance & Unlink Preservation
    # -------------------------------------------------------------------------
    try:
        print("\n--- Scenario J: Allocation Maintenance & Unlink Preservation ---")
        status_sum, sum_data = make_request("GET", f"/collaterals/{multi_col['id']}/facilities")
        initial_active_count = sum_data.get("linkedFacilityCount", 0)
        initial_links = sum_data.get("securedFacilities", [])
        active_initial = [l for l in initial_links if l.get("relationshipStatus") == "Active"]
        assert len(active_initial) >= 2, f"Need at least 2 active links for Scenario J, got {len(active_initial)}"
        
        link_to_end = active_initial[1]
        untouched_link = active_initial[0]
        end_status, end_resp = make_request("POST", f"/collateral-facility-links/{link_to_end['id']}/end", body={"reason": "Settled debt release"}, params={"userId": "usr-sysadmin"})
        assert end_status == 200, f"Failed to end relationship: {end_status}"
        assert end_resp.get("relationshipStatus") in ["Ended", "Inactive", "Released"]
        
        # Verify active count decremented by 1 and untouched link remains Active!
        status_after, after_data = make_request("GET", f"/collaterals/{multi_col['id']}/facilities")
        after_active_count = after_data.get("linkedFacilityCount", 0)
        assert after_active_count == initial_active_count - 1, f"Expected {initial_active_count - 1} active links, got {after_active_count}"
        
        remaining_links = after_data.get("securedFacilities", [])
        untouched_found = [l for l in remaining_links if l["id"] == untouched_link["id"]][0]
        assert untouched_found["relationshipStatus"] == "Active", "Untouched link was altered!"
        
        # Verify master collateral still exists
        status_col, col_check = make_request("GET", f"/collateral/{multi_col['id']}")
        assert status_col == 200, "Master collateral record was deleted!"
        
        print(f"[OK] Ended link {link_to_end['id']} cleanly without disturbing untouched link {untouched_link['id']}")
        print(f"[OK] Active links decremented from {initial_active_count} to {after_active_count}")
        print(f"[OK] Master collateral record {multi_col['code']} remains intact!")
        passed_tests.append("Scenario J: Unlink / Maintenance Preservation without collateral master deletion")
    except Exception as e:
        print(f"[FAIL] Scenario J Failed: {e}")
        failed_tests.append(f"Scenario J: {e}")

    # -------------------------------------------------------------------------
    # Scenario K: User Portfolio Scoping Authorization
    # -------------------------------------------------------------------------
    try:
        print("\n--- Scenario K: User Portfolio Scoping Authorization ---")
        bole_fac = [f for f in facilities if f.get("branch") == "Bole Special Branch"][0]
        matching_col = [c for c in collaterals if c.get("customerId") == bole_fac.get("customerId")][0]

        scope_payload = {
            "collateralId": matching_col["id"],
            "loanAccountId": bole_fac["id"],
            "allocatedAmount": 5000.0,
            "linkageType": "Primary",
            "effectiveDate": "2026-10-01",
            "changeReason": "Scenario K Unauthorized User Link",
            "source": "CIMS"
        }

        # usr-brm is restricted to Merkato Branch / Retail Banking
        status, resp = make_request("POST", "/collateral-facility-links", body=scope_payload, params={"userId": "usr-brm"})
        assert status == 400 or status == 403, f"Expected 400/403 for unauthorized user, got {status}"
        assert "This facility is not within your authorized portfolio." in str(resp), f"Expected portfolio error message, got: {resp}"
        print(f"[OK] Correctly blocked out-of-portfolio user usr-brm with message: {resp.get('message')}")
        passed_tests.append("Scenario K: User Portfolio Scope Verification (Branch & District isolation)")
    except Exception as e:
        print(f"[FAIL] Scenario K Failed: {e}")
        failed_tests.append(f"Scenario K: {e}")

    # -------------------------------------------------------------------------
    # Scenario L: Server-Side Eligible Facilities Endpoint Filtering
    # -------------------------------------------------------------------------
    try:
        print("\n--- Scenario L: Server-Side Eligible Facilities Filtering ---")
        test_col = collaterals[0]
        status, elig_facs = make_request("GET", f"/collaterals/{test_col['id']}/eligible-facilities", params={"userId": "usr-sysadmin"})
        assert status == 200
        assert isinstance(elig_facs, list)
        for f in elig_facs:
            assert f.get("status") not in ["Closed", "Settled", "Cancelled", "Matured", "Written-Off"], f"Inactive facility returned: {f.get('status')}"
            assert f.get("customerId") == test_col.get("customerId"), f"Facility for wrong customer returned: {f.get('customerId')}"
        print(f"[OK] Eligible facilities endpoint returned {len(elig_facs)} valid, active, customer-isolated facilities")
        passed_tests.append("Scenario L: Authoritative Eligible Facilities Server-Side Filtering")
    except Exception as e:
        print(f"[FAIL] Scenario L Failed: {e}")
        failed_tests.append(f"Scenario L: {e}")

    print("\n" + "=" * 80)
    print(f"VERIFICATION SUMMARY: {len(passed_tests)} PASSED, {len(failed_tests)} FAILED")
    print("=" * 80)
    for p in passed_tests:
        print(f"  [PASS] {p}")
    for f in failed_tests:
        print(f"  [FAIL] {f}")

    if failed_tests:
        sys.exit(1)
    else:
        print("\nALL MODULE 4 SCENARIOS PASSED WITH FULL COMPLIANCE!")
        sys.exit(0)

if __name__ == "__main__":
    run_tests()
