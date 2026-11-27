-- Apply confirmed CBS -> CBAIMS mappings for collateral types, collateral categories, and loan product codes.

UPDATE cims_collaterals
SET type = CASE UPPER(TRIM(type))
    WHEN 'V' THEN 'Vehicle'
    WHEN 'P' THEN 'Property'
    WHEN 'M' THEN 'Marketable Share'
    WHEN 'G' THEN 'Guarantee'
    ELSE type
END
WHERE type IS NOT NULL AND UPPER(TRIM(type)) IN ('V', 'P', 'M', 'G');

UPDATE cims_collaterals
SET category = CASE REGEXP_REPLACE(TRIM(category), '^0+(?!$)', '')
    WHEN '2' THEN 'CASA Account'
    WHEN '3' THEN 'Export LC'
    WHEN '4' THEN 'Guarantee'
    WHEN '5' THEN 'Term Deposit'
    WHEN '1001' THEN 'Building'
    WHEN '1002' THEN 'Vehicle'
    WHEN '1003' THEN 'Cash'
    WHEN '1004' THEN 'Share Certificate'
    WHEN '1005' THEN 'Merchandise'
    WHEN '1006' THEN 'Personal Guarantee'
    WHEN '1007' THEN 'Business Mortgage'
    WHEN '1008' THEN 'Clean'
    WHEN '1009' THEN 'Negotiable Bill of Payment'
    WHEN '1010' THEN 'ECG'
    WHEN '1011' THEN 'Foreign Bank Guarantee'
    WHEN '1012' THEN 'Security Issued by Government'
    ELSE category
END
WHERE category IS NOT NULL
  AND REGEXP_REPLACE(TRIM(category), '^0+(?!$)', '') IN ('2','3','4','5','1001','1002','1003','1004','1005','1006','1007','1008','1009','1010','1011','1012');

UPDATE cims_loan_accounts
SET facility_type = CASE UPPER(TRIM(facility_type))
    WHEN 'DMTS' THEN 'Domestic Trade Service term loan'
    WHEN 'ESAL' THEN 'ESA Loan'
    WHEN 'MACF' THEN 'Master Card Foundation MESMER'
    WHEN 'PERS' THEN 'Personal Loan'
    WHEN 'DBAL' THEN 'Dube Ale'
    WHEN 'MCFD' THEN 'Master card foundation'
    WHEN 'EXPT' THEN 'Export term loan'
    WHEN 'STFL' THEN 'Staff Loan'
    WHEN 'TRST' THEN 'Transportation term loan'
    WHEN 'PLSN' THEN 'Personal Loan For NGO Staff'
    WHEN 'DSTL' THEN 'Staff dube ale'
    WHEN 'CMWF' THEN 'Construction Machinery term loan'
    WHEN 'AGSC' THEN 'Agricultural supply chain financing'
    WHEN 'PLSD' THEN 'Personal loan for good depositor'
    WHEN 'IESL' THEN 'IFB ESA'
    WHEN 'DMTSOD' THEN 'Domestic Trade Service OD'
    WHEN 'MNFG' THEN 'Manufacturing term loan'
    WHEN 'IMPT' THEN 'Import term loan'
    WHEN 'GTEE' THEN 'Guarantee facility'
    WHEN 'RLST' THEN 'Realestate term loan'
    WHEN 'AGCR' THEN 'Agricultural term loan'
    WHEN 'MNFGOD' THEN 'Manufacturing OD'
    WHEN 'IMPTOD' THEN 'Import OD'
    WHEN 'HOTR' THEN 'Hotel and tourism term loan'
    WHEN 'EXPTOD' THEN 'Export OD'
    WHEN 'AECT' THEN 'AEC term loan'
    WHEN 'FNLP' THEN 'Fly now pay later'
    WHEN 'SMKF' THEN 'DBE SME- KFW'
    WHEN 'CMWFOD' THEN 'Construction Machinery OD'
    WHEN 'POTL' THEN 'POS Device purchase Finanacing'
    WHEN 'SMFM' THEN 'SME credit finance manufacturing'
    WHEN 'SMFA' THEN 'SME Credit Fianancing Agro proccessing'
    WHEN 'ALBC' THEN 'Advance loans for bills'
    WHEN 'TPMF' THEN 'Third party machinery financing'
    WHEN 'FSDG' THEN 'Guilit Financing (Cosap)'
    WHEN 'AGCROD' THEN 'Agricultural over draft'
    WHEN 'FXEX' THEN 'FX Export term loan'
    WHEN 'SMIP' THEN 'DBE Innovation project loan'
    WHEN 'SMAD' THEN 'DBE SME ADELE'
    WHEN 'SMFC' THEN 'SME Credit Finance Constraction'
    WHEN 'MNGL' THEN 'Mining term loan'
    ELSE facility_type
END
WHERE facility_type IS NOT NULL;

