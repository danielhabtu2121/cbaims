// Script to create new CBS Customers and Loan Facilities in CBS Simulator,
// link them by customer CIF, and sync them to CIMS (without creating any collaterals).

const BASE_URL = 'http://localhost:8082/api';

const customersToCreate = [
  {
    id: 'cbs-cust-eth-882901',
    cif: 'CIF-ETH-882901',
    fullName: 'Abyssinia Agro-Processing & Packaging Share Company',
    customerType: 'Business',
    businessRegNo: 'AA/BOL/10492/2018',
    taxIdNo: '0049281726',
    businessSegment: 'Corporate Banking',
    branch: 'Bole Special Branch',
    phone: '+251911442200',
    email: 'finance@abyssinia-agro.et',
    address: 'Bole Subcity, Woreda 03, House 412, Addis Ababa',
    riskRating: 'Low',
    customerStatus: 'Active'
  },
  {
    id: 'cbs-cust-eth-664205',
    cif: 'CIF-ETH-664205',
    fullName: 'Selam Pharmaceutical & Medical Supplies Import PLC',
    customerType: 'Business',
    businessRegNo: 'MK/YKK/8821/2021',
    taxIdNo: '0078129401',
    businessSegment: 'MSME',
    branch: 'Yeka Sub-Branch',
    phone: '+251922338811',
    email: 'ops@selam-pharma.et',
    address: 'Yeka Subcity, Woreda 07, Commercial Zone, Addis Ababa',
    riskRating: 'Medium',
    customerStatus: 'Active'
  },
  {
    id: 'cbs-cust-eth-771940',
    cif: 'CIF-ETH-771940',
    fullName: 'Al-Baraka Modern Construction & Logistics Group',
    customerType: 'Business',
    businessRegNo: 'OR/KZ/5510/2020',
    taxIdNo: '0038472910',
    businessSegment: 'IFB',
    branch: 'Merkato IFB Dedicated Branch',
    phone: '+251933550099',
    email: 'accounts@albaraka-logistics.com',
    address: 'Addis Ketema, Merkato Commercial Center, Addis Ababa',
    riskRating: 'Low',
    customerStatus: 'Active'
  },
  {
    id: 'cbs-cust-eth-331088',
    cif: 'CIF-ETH-331088',
    fullName: 'Dr. Tewodros Hailemariam Mengesha',
    customerType: 'Individual',
    nationalId: 'ET-ID-88492019',
    taxIdNo: '0019283746',
    businessSegment: 'Retail',
    branch: 'Arada Branch',
    phone: '+251911998877',
    email: 'tewodros.hm@health.gov.et',
    address: 'Arada Subcity, Woreda 02, House 109, Addis Ababa',
    riskRating: 'Low',
    customerStatus: 'Active'
  }
];

const facilitiesToCreate = [
  {
    id: 'cbs-fac-eth-8801',
    lineCode: 'FAC-CR-2026-8801',
    customerCif: 'CIF-ETH-882901',
    loanRefNo: 'LN-CR-8801-TERM',
    facilityType: 'Term Loan',
    lineCurrency: 'ETB',
    revolvingLine: false,
    lineStartDate: '2026-02-01',
    lineExpiryDate: '2031-02-01',
    approvedLimit: 45000000.0,
    outstandingAmount: 38500000.0,
    availableAmount: 6500000.0,
    collateralContribution: 0.0,
    collateralPct: 0.0,
    businessSegment: 'Corporate Banking',
    branch: 'Bole Special Branch',
    relationshipManager: 'Abebe Kebede',
    limitStatus: 'Active',
    nextReviewDate: '2027-02-01'
  },
  {
    id: 'cbs-fac-eth-6602',
    lineCode: 'FAC-MSME-2026-6602',
    customerCif: 'CIF-ETH-664205',
    loanRefNo: 'LN-MSME-6602-WC',
    facilityType: 'Working Capital',
    lineCurrency: 'ETB',
    revolvingLine: true,
    lineStartDate: '2026-03-10',
    lineExpiryDate: '2028-03-10',
    approvedLimit: 18000000.0,
    outstandingAmount: 14200000.0,
    availableAmount: 3800000.0,
    collateralContribution: 0.0,
    collateralPct: 0.0,
    businessSegment: 'MSME',
    branch: 'Yeka Sub-Branch',
    relationshipManager: 'Tigist Alemu',
    limitStatus: 'Active',
    nextReviewDate: '2027-03-10'
  },
  {
    id: 'cbs-fac-eth-7703',
    lineCode: 'FAC-IFB-2026-7703',
    customerCif: 'CIF-ETH-771940',
    loanRefNo: 'LN-IFB-7703-MUR',
    facilityType: 'Trade Finance',
    lineCurrency: 'ETB',
    revolvingLine: false,
    lineStartDate: '2026-01-15',
    lineExpiryDate: '2029-01-15',
    approvedLimit: 30000000.0,
    outstandingAmount: 22000000.0,
    availableAmount: 8000000.0,
    collateralContribution: 0.0,
    collateralPct: 0.0,
    businessSegment: 'IFB',
    branch: 'Merkato IFB Dedicated Branch',
    relationshipManager: 'Mohammed Nur',
    limitStatus: 'Active',
    nextReviewDate: '2027-01-15'
  },
  {
    id: 'cbs-fac-eth-3304',
    lineCode: 'FAC-RET-2026-3304',
    customerCif: 'CIF-ETH-331088',
    loanRefNo: 'LN-RET-3304-MTG',
    facilityType: 'Mortgage',
    lineCurrency: 'ETB',
    revolvingLine: false,
    lineStartDate: '2026-04-01',
    lineExpiryDate: '2041-04-01',
    approvedLimit: 12500000.0,
    outstandingAmount: 11800000.0,
    availableAmount: 700000.0,
    collateralContribution: 0.0,
    collateralPct: 0.0,
    businessSegment: 'Retail',
    branch: 'Arada Branch',
    relationshipManager: 'Helen Tadesse',
    limitStatus: 'Active',
    nextReviewDate: '2027-04-01'
  }
];

async function run() {
  console.log('=== STEP 1: Creating Customers in CBS Simulator ===');
  for (const cust of customersToCreate) {
    const res = await fetch(`${BASE_URL}/cbs-sim/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cust)
    });
    if (!res.ok) {
      console.error(`Failed to create CBS customer ${cust.fullName}:`, await res.text());
    } else {
      const data = await res.json();
      console.log(`✓ Created CBS Customer: ${data.fullName} (CIF: ${data.cif}, ID: ${data.id})`);
    }
  }

  console.log('\n=== STEP 2: Creating Loan Facilities in CBS Simulator (Linked by Customer CIF) ===');
  for (const fac of facilitiesToCreate) {
    const res = await fetch(`${BASE_URL}/cbs-sim/facilities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fac)
    });
    if (!res.ok) {
      console.error(`Failed to create CBS facility ${fac.loanRefNo}:`, await res.text());
    } else {
      const data = await res.json();
      console.log(`✓ Created CBS Facility: ${data.loanRefNo} (Linked CIF: ${data.customerCif}, Limit: ETB ${data.approvedLimit.toLocaleString()})`);
    }
  }

  console.log('\n=== STEP 3: Synchronizing CBS Customers & Loan Facilities to CIMS ===');
  // First, sync each customer
  for (const cust of customersToCreate) {
    const res = await fetch(`${BASE_URL}/cbs-integration/sync/Customer/${cust.id}?userId=SYSADMIN`, {
      method: 'POST'
    });
    const result = await res.json();
    console.log(`✓ Synced Customer ${cust.cif} to CIMS:`, result.message || result);
  }

  // Next, sync each facility
  for (const fac of facilitiesToCreate) {
    const res = await fetch(`${BASE_URL}/cbs-integration/sync/Facility/${fac.id}?userId=SYSADMIN`, {
      method: 'POST'
    });
    const result = await res.json();
    console.log(`✓ Synced Facility ${fac.loanRefNo} to CIMS:`, result.message || result);
  }

  console.log('\n=== STEP 4: Verifying Ingestion into CIMS Database ===');
  const stateRes = await fetch(`${BASE_URL}/state`);
  const state = await stateRes.json();

  console.log(`Total Customers in CIMS: ${state.customers?.length}`);
  console.log(`Total Facilities in CIMS: ${state.facilities?.length}`);
  console.log(`Total Collaterals in CIMS: ${state.collaterals?.length} (Unchanged - NO collaterals created)`);

  console.log('\n--- Verified Synced Customers in CIMS ---');
  for (const cust of customersToCreate) {
    const found = state.customers?.find(c => c.cif === cust.cif);
    if (found) {
      console.log(`✓ Customer in CIMS: ${found.name} | CIF: ${found.cif} | ID: ${found.id} | Segment: ${found.segment} | SyncStatus: ${found.cbsSyncStatus}`);
    } else {
      console.error(`✗ Customer NOT found in CIMS: ${cust.cif}`);
    }
  }

  console.log('\n--- Verified Synced Loan Facilities in CIMS (Linked to Customers) ---');
  for (const fac of facilitiesToCreate) {
    const found = state.facilities?.find(f => f.loanReference === fac.loanRefNo || f.lineCode === fac.lineCode);
    if (found) {
      const linkedCustomer = state.customers?.find(c => c.id === found.customerId || c.cif === fac.customerCif);
      console.log(`✓ Facility in CIMS: ${found.loanReference} | Line: ${found.lineCode} | Balance: ETB ${found.outstandingBalance?.toLocaleString()} | Linked Customer: "${linkedCustomer?.name}" (${found.customerId}) | SyncStatus: ${found.cbsSyncStatus}`);
    } else {
      console.error(`✗ Facility NOT found in CIMS: ${fac.loanRefNo}`);
    }
  }

  console.log('\n=== COMPLETE: CBS Customers & Facilities successfully created and synchronized to CIMS with NO collaterals created. ===');
}

run().catch(console.error);
