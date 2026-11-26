-- ============================================================================
-- 1. Resolve 4-letter CBS product codes on existing cims_loan_accounts rows
--    to their full facility type names.
-- 2. Populate cims_collaterals.current_allocation from active
--    cims_loan_collateral_links so "Allocated Security" reflects linked amounts.
-- ============================================================================

UPDATE cims_loan_accounts
SET facility_type = CASE UPPER(TRIM(facility_type))
    WHEN 'DMAG' THEN 'Diminishing Musharaka Agriculture'
    WHEN 'DMCN' THEN 'Diminishing Musharaka Construction'
    WHEN 'DMDS' THEN 'Diminishing Musharaka Domestic Service'
    WHEN 'DMDT' THEN 'Diminishing Musharaka Domestic Trade'
    WHEN 'DMEX' THEN 'Diminishing Musharaka Export'
    WHEN 'DMIM' THEN 'Diminishing Musharaka Import'
    WHEN 'DMMF' THEN 'Diminishing Musharaka Manufacturing'
    WHEN 'DMMN' THEN 'Diminishing Musharaka Mining'
    WHEN 'DMRS' THEN 'Diminishing Musharaka Realestate'
    WHEN 'DMTR' THEN 'Diminishing Musharaka Transport'
    WHEN 'IJAG' THEN 'Ijara Agriculture'
    WHEN 'IJCN' THEN 'Ijara Construction'
    WHEN 'IJPC' THEN 'Ijara Personal/Consumer'
    WHEN 'IJRS' THEN 'Ijara Realestate'
    WHEN 'IJTR' THEN 'Ijara Transport'
    WHEN 'ISAG' THEN 'Istisna Agriculture'
    WHEN 'ISCN' THEN 'Istisna Construction'
    WHEN 'ISDS' THEN 'Istisna Domestic Service'
    WHEN 'ISDT' THEN 'Istisna Domestic Trade'
    WHEN 'ISEX' THEN 'Istisna Export'
    WHEN 'ISMF' THEN 'Istisna Manufacturing'
    WHEN 'ISMN' THEN 'Istisna Mining'
    WHEN 'ISRS' THEN 'Istisna Realestate'
    WHEN 'MDAG' THEN 'Mudaraba Agriculture'
    WHEN 'MDCN' THEN 'Mudaraba Construction'
    WHEN 'MDDS' THEN 'Mudaraba Domestic Service'
    WHEN 'MDDT' THEN 'Mudaraba Domestic Trade'
    WHEN 'MDEX' THEN 'Mudaraba Export'
    WHEN 'MDMF' THEN 'Mudaraba Manufacturing'
    WHEN 'MDMN' THEN 'Mudaraba Mining'
    WHEN 'MDRS' THEN 'Mudaraba Realestate'
    WHEN 'MDTR' THEN 'Mudaraba Transport'
    WHEN 'MODF' THEN 'MURABAHA MOBILE DEVICE FINANCING'
    WHEN 'MRAG' THEN 'Murabaha Agriculture'
    WHEN 'MRCN' THEN 'Murabaha Construction'
    WHEN 'MRDS' THEN 'Murabaha Domestic Service'
    WHEN 'MRDT' THEN 'Murabaha Domestic Trade'
    WHEN 'MREX' THEN 'Murabaha Export'
    WHEN 'MRIM' THEN 'Murabaha Import'
    WHEN 'MRMF' THEN 'Murabaha Manufacturing'
    WHEN 'MRMN' THEN 'Murabaha Mining'
    WHEN 'MRPC' THEN 'Murabaha Personal/Consumer'
    WHEN 'MRRS' THEN 'Murabaha Realestate'
    WHEN 'MRTR' THEN 'Murabaha Transport'
    WHEN 'MSAG' THEN 'Musharaka Agriculture'
    WHEN 'MSCN' THEN 'Musharaka Construction'
    WHEN 'MSDS' THEN 'Musharaka Domestic Service'
    WHEN 'MSEX' THEN 'Musharaka Export'
    WHEN 'MSIM' THEN 'Musharaka Import'
    WHEN 'MSMF' THEN 'Musharaka Manufacturing'
    WHEN 'MSMN' THEN 'Musharaka Mining'
    WHEN 'MSRS' THEN 'Musharaka Realestate'
    WHEN 'MSTR' THEN 'Musharaka Transport'
    WHEN 'OVAF' THEN 'Qard Overseas Employment Agency Financing'
    WHEN 'QASM' THEN 'Qard SME'
    WHEN 'SLAG' THEN 'Salam Agriculture'
    WHEN 'SLMN' THEN 'Salam Mining'
    WHEN 'MRSP' THEN 'MURABAHA SHORT TERM SMART POS FINANCING'
    WHEN 'MLCS' THEN 'MURABAHA L/C SETTLEMENT FINANCING'
    WHEN 'MRCO' THEN 'Murabaha Consumer'
    WHEN 'MRTA' THEN 'Murabaha Taxi Finanacing'
    WHEN 'SWHF' THEN 'Sharik Ware House Financing'
    WHEN 'TWHF' THEN 'Tijara Ware House Financing'
    WHEN 'ILCM' THEN 'Import L/C margin-Sharik'
    WHEN 'ILCS' THEN 'Import L/C settlement-Sharik'
    WHEN 'MREA' THEN 'Murabaha Personal/Consumer-Employment Agency Financing'
    WHEN 'MRSC' THEN 'Murabaha Consumer Staff'
    WHEN 'MSMR' THEN 'MURABAHA MESMER FINANCING'
    WHEN 'MUPL' THEN 'Murabah Financing- Plus Financing'
    WHEN 'QAPL' THEN 'Qard Murabah Financing- Plus'
    WHEN 'REVC' THEN 'Revolving Valuchain Financing'
    WHEN 'PAIS' THEN 'Parallal istisna'
    WHEN 'PASL' THEN 'Parallal selam'
    WHEN 'TIAG' THEN 'Tijara Agriculture'
    WHEN 'TIMF' THEN 'Tijara Manufacturing'
    WHEN 'TIDT' THEN 'Tijara Domestic Trade'
    WHEN 'MNGL' THEN 'Mining TermLoan'
    WHEN 'IMPT' THEN 'Import Term Loans'
    WHEN 'EXPT' THEN 'Export Term Loans'
    WHEN 'TRST' THEN 'Transport Term Loans'
    WHEN 'CMWF' THEN 'Construction,Machinery&Working Fund'
    WHEN 'MNFG' THEN 'Manufacturing Term Loans'
    WHEN 'RLST' THEN 'Real Estate Term Loans'
    WHEN 'SMFM' THEN 'SME Credit finance-Manufacturing'
    WHEN 'MCFD' THEN 'Master Card Foundation'
    WHEN 'AECT' THEN 'AEC TERM LOAN'
    WHEN 'RVCF' THEN 'REVOLVING VALUE CHAIN FINANCING'
    WHEN 'IPTL' THEN 'Insurance Premium Financing'
    WHEN 'BIME' THEN 'Bridge loan International Meeting'
    WHEN 'SMFA' THEN 'SME Credit finance-Agro Processing'
    WHEN 'SMFC' THEN 'SME Credit finance-Construction'
    WHEN 'SMFT' THEN 'SME Credit finance-Tourism'
    WHEN 'DSTL' THEN 'STAFF DUBE ALE'
    WHEN 'FNLP' THEN 'FLY NOW PAY LATER LAON Services'
    WHEN 'MACF' THEN 'Master Card Foundation-MESMER'
    WHEN 'FXEX' THEN 'FX Export Term Loans'
    WHEN 'AGSC' THEN 'Agricultural supply chain financing'
    WHEN 'SMKF' THEN 'DBE SME- KFW'
    WHEN 'RCFI' THEN 'Revolving Credit Facility Import'
    WHEN 'HOTR' THEN 'special financing-Hotel and Tourism'
    WHEN 'SMIP' THEN 'DBE-Innovation Project Loan'
    WHEN 'POTL' THEN 'POS Device Purchase Financing'
    WHEN 'TPMF' THEN 'Third Party Machinery Financing'
    WHEN 'AGCR' THEN 'Agricultural Term Loans'
    WHEN 'DMTS' THEN 'Domestic Trade And Services'
    WHEN 'DBAL' THEN 'Dube Ale Loan Services'
    WHEN 'PERS' THEN 'Personal Loans'
    WHEN 'EDFI' THEN 'Student Loan'
    WHEN 'SMAD' THEN 'DBE SME- ADELE'
    ELSE facility_type
END
WHERE UPPER(TRIM(facility_type)) IN (
    'DMAG','DMCN','DMDS','DMDT','DMEX','DMIM','DMMF','DMMN','DMRS','DMTR',
    'IJAG','IJCN','IJPC','IJRS','IJTR',
    'ISAG','ISCN','ISDS','ISDT','ISEX','ISMF','ISMN','ISRS',
    'MDAG','MDCN','MDDS','MDDT','MDEX','MDMF','MDMN','MDRS','MDTR',
    'MODF','MRAG','MRCN','MRDS','MRDT','MREX','MRIM','MRMF','MRMN','MRPC','MRRS','MRTR',
    'MSAG','MSCN','MSDS','MSEX','MSIM','MSMF','MSMN','MSRS','MSTR',
    'OVAF','QASM','SLAG','SLMN','MRSP','MLCS','MRCO','MRTA','SWHF','TWHF',
    'ILCM','ILCS','MREA','MRSC','MSMR','MUPL','QAPL','REVC','PAIS','PASL','TIAG','TIMF','TIDT',
    'MNGL','IMPT','EXPT','TRST','CMWF','MNFG','RLST','SMFM','MCFD','AECT','RVCF','IPTL',
    'BIME','SMFA','SMFC','SMFT','DSTL','FNLP','MACF','FXEX','AGSC','SMKF','RCFI','HOTR',
    'SMIP','POTL','TPMF','AGCR','DMTS','DBAL','PERS','EDFI','SMAD'
);

UPDATE cims_collaterals col
SET current_allocation = COALESCE(agg.total_alloc, 0.0)
FROM (
    SELECT collateral_id, SUM(COALESCE(NULLIF(allocated_amount, 0), linked_amount, 0)) AS total_alloc
    FROM cims_loan_collateral_links
    WHERE status IS NULL OR UPPER(status) <> 'RELEASED'
    GROUP BY collateral_id
) agg
WHERE col.id = agg.collateral_id;

