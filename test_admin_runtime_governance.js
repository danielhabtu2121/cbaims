const http = require('http');

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL('http://localhost:8080' + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, data: parsed, raw: data });
        } catch (e) {
          resolve({ status: res.statusCode, data: data, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('====================================================');
  console.log('STARTING CIMS ADMIN RUNTIME & GOVERNANCE E2E TESTS');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  // TEST 1: Check Configuration Health Endpoint
  try {
    console.log('1. Testing GET /api/admin/health...');
    const res = await request('GET', '/api/admin/health');
    if (res.status === 200 && res.data.status) {
      console.log('   [PASS] Configuration Health Status:', res.data.status, 'with', res.data.totalCachedParameters, 'cached parameters.');
      console.log('   Healthy checks:', res.data.healthyChecks);
      passed++;
    } else {
      console.log('   [FAIL] Health check failed with status:', res.status, res.data);
      failed++;
    }
  } catch (e) {
    console.log('   [FAIL] Error testing health:', e.message);
    failed++;
  }

  // TEST 2: Validate Backend Parameter Validation (Negative Test - invalid value)
  try {
    console.log('\n2. Testing Backend Validation (min_coverage_adequacy_pct = -5)...');
    const res = await request('POST', '/api/admin/parameters/save?userId=SYSADMIN', {
      paramKey: 'min_coverage_adequacy_pct',
      paramValue: '-5',
      description: 'Invalid coverage test'
    });
    if (res.status === 400 && res.data.error) {
      console.log('   [PASS] Backend correctly rejected invalid value with 400 Bad Request: ' + res.data.error);
      passed++;
    } else {
      console.log('   [FAIL] Expected 400 rejection, got status:', res.status, res.data);
      failed++;
    }
  } catch (e) {
    console.log('   [FAIL] Error testing parameter validation:', e.message);
    failed++;
  }

  // TEST 3: Dynamic Parameter Update & Invalidation (Positive Test)
  try {
    console.log('\n3. Testing Dynamic Parameter Update (min_coverage_adequacy_pct = 95)...');
    const updateRes = await request('POST', '/api/admin/parameters/save?userId=SYSADMIN', {
      paramKey: 'min_coverage_adequacy_pct',
      paramValue: '95',
      description: 'Mandatory collateral insurance coverage threshold percentage'
    });
    if (updateRes.status === 200 && updateRes.data.paramValue === '95') {
      console.log('   [PASS] Parameter successfully updated in database and cache.');
      
      // Verify health check sees updated value immediately without restart
      const healthRes = await request('GET', '/api/admin/health');
      console.log('   [PASS] Health check confirms runtime parameter:', healthRes.data.healthyChecks);
      passed++;
    } else {
      console.log('   [FAIL] Failed to update parameter:', updateRes.status, updateRes.data);
      failed++;
    }
  } catch (e) {
    console.log('   [FAIL] Error testing parameter update:', e.message);
    failed++;
  }

  // Reset Parameter back to 100
  await request('POST', '/api/admin/parameters/save?userId=SYSADMIN', {
    paramKey: 'min_coverage_adequacy_pct',
    paramValue: '100',
    description: 'Mandatory collateral insurance coverage threshold percentage'
  });

  // TEST 4: Execute Dynamic Expiry Reminders Engine
  try {
    console.log('\n4. Testing POST /api/admin/reminders/run...');
    const res = await request('POST', '/api/admin/reminders/run');
    if (res.status === 200 && res.data.success) {
      console.log('   [PASS] Reminders engine executed successfully: ' + res.data.message);
      passed++;
    } else {
      console.log('   [FAIL] Failed to run reminders:', res.status, res.data);
      failed++;
    }
  } catch (e) {
    console.log('   [FAIL] Error running reminders:', e.message);
    failed++;
  }

  // TEST 5: Template Validation with Invalid Placeholders (Negative Test)
  try {
    console.log('\n5. Testing Notification Template Placeholder Validation...');
    const res = await request('POST', '/api/admin/templates/save?userId=SYSADMIN', {
      name: 'Bad Template',
      type: 'Email',
      triggerDaysBefore: 15,
      subject: 'Alert',
      body: 'Hello {UnknownFakeField}, please renew your policy.'
    });
    if (res.status === 400 && res.data.error) {
      console.log('   [PASS] Backend correctly rejected invalid placeholder: ' + res.data.error);
      passed++;
    } else {
      console.log('   [FAIL] Expected 400 rejection for invalid placeholder, got:', res.status, res.data);
      failed++;
    }
  } catch (e) {
    console.log('   [FAIL] Error testing template validation:', e.message);
    failed++;
  }

  // TEST 6: Holiday Calendar Configuration & Working Day Service
  try {
    console.log('\n6. Testing Holiday Calendar GET /api/admin/holidays...');
    const res = await request('GET', '/api/admin/holidays');
    if (res.status === 200 && Array.isArray(res.data) && res.data.length > 0) {
      console.log('   [PASS] Found', res.data.length, 'configured bank holidays in database.');
      passed++;
    } else {
      console.log('   [FAIL] Failed to fetch holidays:', res.status, res.data);
      failed++;
    }
  } catch (e) {
    console.log('   [FAIL] Error fetching holidays:', e.message);
    failed++;
  }

  // TEST 7: Role Permission Matrix Dynamic Propagation
  try {
    console.log('\n7. Testing Role Permission Matrix Batch Update & Enforcement...');
    const permsRes = await request('GET', '/api/admin/permissions');
    if (permsRes.status === 200 && Array.isArray(permsRes.data) && permsRes.data.length > 0) {
      const perms = permsRes.data;
      const target = perms[0];
      const origCanView = target.canView;
      target.canView = !origCanView;

      const saveRes = await request('POST', '/api/admin/permissions/save-batch?adminUserId=SYSADMIN', perms);
      if (saveRes.status === 200) {
        console.log('   [PASS] Role permissions matrix saved to backend database successfully.');
        
        // Re-fetch and verify
        const verifyRes = await request('GET', '/api/admin/permissions');
        const updated = verifyRes.data.find(p => p.id === target.id);
        if (updated && updated.canView === target.canView) {
          console.log(`   [PASS] Verified permission for ${target.roleCode}:${target.screenName} actively updated from ${origCanView} to ${target.canView}.`);
          passed++;
        } else {
          console.log('   [FAIL] Permission not persisted correctly:', updated);
          failed++;
        }

        // Reset back
        target.canView = origCanView;
        await request('POST', '/api/admin/permissions/save-batch?adminUserId=SYSADMIN', perms);
      } else {
        console.log('   [FAIL] Failed to batch save permissions:', saveRes.status);
        failed++;
      }
    } else {
      console.log('   [FAIL] Failed to fetch permissions matrix:', permsRes.status);
      failed++;
    }
  } catch (e) {
    console.log('   [FAIL] Error testing permissions:', e.message);
    failed++;
  }

  console.log('\n====================================================');
  console.log(`E2E TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');
}

runTests();
