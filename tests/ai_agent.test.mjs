// Agentic AI: workspace-scoped tools + the agent loop (driven by a deterministic
// mock model). Run: node tests/ai_agent.test.mjs
process.env.JWT_SECRET = 'test-secret-please-change';

import crypto from 'node:crypto';
import { createMemoryDb, _setDbForTests } from '../server/db/index.js';
import * as repo from '../server/db/repos.js';
import { hashPassword } from '../server/lib/auth.js';
import { runTool, TOOLS } from '../server/lib/aiTools.js';
import { runAgent } from '../server/lib/agent.js';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) pass++; else { fail++; console.log('  ✗ FAIL:', name, extra); } };

const db = await createMemoryDb();
_setDbForTests(db);

async function makeWs(name) {
  const now = new Date().toISOString();
  const user = { id: crypto.randomUUID(), email: `${name}@x.in`, password_hash: hashPassword('password123'), name, created_at: now, updated_at: now };
  const ws = { id: crypto.randomUUID(), name: `${name} WS`, owner_user_id: user.id };
  await db.tx(async (tx) => {
    await repo.insertUser(tx, user);
    await repo.insertWorkspace(tx, ws);
    await repo.insertMembership(tx, { id: crypto.randomUUID(), workspace_id: ws.id, user_id: user.id, role: 'owner', created_at: now });
  });
  return { user, ws };
}

const A = await makeWs('alpha');
const B = await makeWs('beta');
const cA = await repo.createClient(db, A.ws.id, { name: 'Acme', stateCode: '29' });
const invA = await repo.createInvoice(db, A.ws.id, { clientId: cA.id, items: [{ description: 'Dev', quantity: 1, unitPriceMinor: 10000000 }], issueDate: '2026-01-01', dueDate: '2026-01-15' });
await repo.updateInvoice(db, A.ws.id, invA.id, { status: 'sent' }); // unpaid + past due → overdue
await repo.createClient(db, B.ws.id, { name: 'OtherCorp' });

console.log('— Tools are workspace-scoped —');
const sumA = await runTool(db, A.ws.id, 'get_financial_summary', {});
ok('A sees its 1 invoice + 1 client', sumA.invoices === 1 && sumA.clients === 1);
const sumB = await runTool(db, B.ws.id, 'get_financial_summary', {});
ok('B is isolated (0 invoices, its own 1 client)', sumB.invoices === 0 && sumB.clients === 1);

console.log('— Individual tools —');
const overdue = await runTool(db, A.ws.id, 'list_overdue_invoices', {});
ok('overdue invoice surfaced at ₹1,18,000', overdue.length === 1 && overdue[0].amount === 118000);
const found = await runTool(db, A.ws.id, 'find_client', { name: 'acme' });
ok('find_client matches by partial name', found.length === 1 && found[0].name === 'Acme');
const gp = await runTool(db, A.ws.id, 'gst_preview', { items: [{ description: 'a', quantity: 1, amount: 1000 }], sameState: true });
ok('gst_preview computes 18% intra-state', gp.total === 1180 && gp.cgst === 90 && gp.sgst === 90);
const cf = await runTool(db, A.ws.id, 'compliance_flags', {});
ok('compliance_flags returns gross + 44ADA', typeof cf.grossReceipts === 'number' && 'sec44ADA' in cf && 'gstThresholdCrossed' in cf);
ok('unknown tool returns an error', (await runTool(db, A.ws.id, 'nope', {})).error);

console.log('— Agent loop (mock model) —');
let round = 0;
const mockModel = async ({ messages, tools }) => {
  round++;
  if (round === 1) {
    ok('tools are passed to the model', Array.isArray(tools) && tools.length === TOOLS.length);
    return { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't1', name: 'list_overdue_invoices', input: {} }] };
  }
  const last = messages[messages.length - 1];
  const fedBack = Array.isArray(last.content) && last.content.some((b) => b.type === 'tool_result');
  ok('tool_result is fed back to the model', fedBack);
  return { stop_reason: 'end_turn', content: [{ type: 'text', text: 'You have 1 overdue invoice totalling ₹1,18,000.' }] };
};
const out = await runAgent({ db, wsId: A.ws.id, message: 'what is overdue?', callModel: mockModel });
ok('agent ran the tool then answered', out.toolsUsed.includes('list_overdue_invoices') && out.rounds === 2 && /overdue/i.test(out.text));

console.log('— Agent maxRounds guard —');
const loopModel = async () => ({ stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 'x', name: 'get_financial_summary', input: {} }] });
const out2 = await runAgent({ db, wsId: A.ws.id, message: 'loop forever', callModel: loopModel, maxRounds: 3 });
ok('agent stops at maxRounds', out2.rounds === 3 && typeof out2.text === 'string');

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
