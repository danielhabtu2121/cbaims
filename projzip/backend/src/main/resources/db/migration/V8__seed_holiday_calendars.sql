-- Seed Ethiopian Bank Holiday Calendar for 2026
INSERT INTO cims_holiday_calendars (id, holiday_date, description) VALUES
('hol-2026-01-07', '2026-01-07', 'Ethiopian Christmas (Genna)'),
('hol-2026-01-19', '2026-01-19', 'Timkat (Epiphany)'),
('hol-2026-03-02', '2026-03-02', 'Victory at Adwa Day'),
('hol-2026-03-20', '2026-03-20', 'Eid al-Fitr (End of Ramadan)'),
('hol-2026-04-10', '2026-04-10', 'Ethiopian Good Friday (Siklet)'),
('hol-2026-04-12', '2026-04-12', 'Ethiopian Easter Sunday (Fasika)'),
('hol-2026-05-01', '2026-05-01', 'International Workers Day (Labor Day)'),
('hol-2026-05-05', '2026-05-05', 'Patriots Victory Day'),
('hol-2026-05-27', '2026-05-27', 'Eid al-Adha (Arafa)'),
('hol-2026-09-11', '2026-09-11', 'Enkutatash (Ethiopian New Year 2019 E.C.)'),
('hol-2026-09-27', '2026-09-27', 'Finding of the True Cross (Meskel)')
ON CONFLICT (id) DO NOTHING;
