-- ─────────────────────────────────────────────────────────────────────────
-- 0003_phase2_einvoice — GST e-invoicing (IRN), e-way bill, and HSN/SAC.
--
-- e-invoice / e-way-bill results returned by the IRP/NIC (or our sandbox) are
-- stored on the invoice. Line items gain HSN/SAC + unit, which the e-invoice
-- and GSTR-1 builders require. Dialect-neutral (TEXT) for SQLite + Postgres.
-- ─────────────────────────────────────────────────────────────────────────

-- e-invoice (IRP) results
ALTER TABLE invoices ADD COLUMN irn TEXT;             -- 64-char Invoice Reference Number
ALTER TABLE invoices ADD COLUMN ack_no TEXT;          -- IRP acknowledgement number
ALTER TABLE invoices ADD COLUMN ack_dt TEXT;          -- IRP acknowledgement timestamp
ALTER TABLE invoices ADD COLUMN signed_qr TEXT;       -- SignedQRCode (base64) for the printed QR
ALTER TABLE invoices ADD COLUMN einvoice_status TEXT; -- null | generated | cancelled | failed

-- e-way bill result
ALTER TABLE invoices ADD COLUMN ewb_no TEXT;          -- 12-digit e-way bill number

-- Line-item tax classification (required for e-invoice ItemList + GSTR-1)
ALTER TABLE invoice_items ADD COLUMN hsn_sac TEXT;    -- HSN (goods) / SAC (services) code
ALTER TABLE invoice_items ADD COLUMN unit TEXT;       -- UQC, e.g. 'NOS', 'OTH'
