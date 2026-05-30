/**
 * backup.js — Per-tenant backup / restore + data portability.
 *
 *   exportWorkspace  — a complete, portable JSON snapshot of one workspace
 *                      (profile, clients, invoices+items, app_state, subscription,
 *                      members). Doubles as the DPDP/GDPR "right to access" export.
 *   restoreWorkspace — rebuild a workspace's business data from a snapshot
 *                      (disaster recovery / migration). Re-creates clients and
 *                      invoices through the normal repos, so GST is recomputed by
 *                      the authoritative engine and ids are remapped safely.
 *
 * Scoped to a single workspace_id throughout — a backup can never span tenants.
 */
import * as repo from '../db/repos.js';

export async function exportWorkspace(db, wsId) {
  const workspace = await repo.getWorkspace(db, wsId);
  if (!workspace) throw new Error('Workspace not found');
  const clients = await repo.listClients(db, wsId);
  const invoiceRows = await repo.listInvoices(db, wsId);
  const invoices = [];
  for (const row of invoiceRows) invoices.push(await repo.getInvoice(db, wsId, row.id)); // includes items
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    workspace,
    clients,
    invoices,
    appState: await repo.getAppState(db, wsId),
    subscription: await repo.getSubscription(db, wsId),
    members: await repo.listMembers(db, wsId),
  };
}

/**
 * Restore business data into a workspace from a snapshot. `mode: 'replace'`
 * (default) clears the workspace's existing clients + invoices first. Clients and
 * invoices are re-created via the repos (GST recomputed; client ids remapped).
 */
export async function restoreWorkspace(db, wsId, backup, { mode = 'replace' } = {}) {
  if (!backup || backup.version !== 1) throw new Error('Unsupported or missing backup version');
  if (mode === 'replace') {
    await db.tx(async (tx) => {
      await tx.run('DELETE FROM invoices WHERE workspace_id = ?', [wsId]); // items cascade
      await tx.run('DELETE FROM clients WHERE workspace_id = ?', [wsId]);
    });
  }
  const idMap = new Map();
  for (const c of backup.clients || []) {
    const created = await repo.createClient(db, wsId, {
      name: c.name, email: c.email, phone: c.phone, company: c.company,
      gstin: c.gstin, stateCode: c.state_code, country: c.country, isExport: c.is_export, notes: c.notes,
    });
    idMap.set(c.id, created.id);
  }
  for (const inv of backup.invoices || []) {
    await repo.createInvoice(db, wsId, {
      clientId: inv.client_id ? idMap.get(inv.client_id) || null : null,
      number: inv.number, status: inv.status, issueDate: inv.issue_date, dueDate: inv.due_date,
      isExport: !!inv.is_export, sameState: !!inv.same_state, gstRate: inv.gst_rate, notes: inv.notes,
      items: (inv.items || []).map((it) => ({
        description: it.description, quantity: it.quantity, unitPriceMinor: it.unit_price_minor,
        hsnSac: it.hsn_sac, unit: it.unit,
      })),
    });
  }
  if (backup.appState) await repo.setAppState(db, wsId, backup.appState);
  return { restored: { clients: (backup.clients || []).length, invoices: (backup.invoices || []).length } };
}

export default { exportWorkspace, restoreWorkspace };
