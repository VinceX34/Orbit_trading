import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';

process.loadEnvFile(new URL('../.env.local', import.meta.url));

const source = readFileSync(new URL('./orbit.js', import.meta.url), 'utf8');
const body = source.slice(source.indexOf('\n', source.indexOf('import ')), source.indexOf('\nconst hourly = trigger('));
const parts = new Function(`${body}
return { deskValues, instructions, roundSchema, scratchCode, fanCode, stashCode, keysPresentCode, signBalanceCode, signOpenOrdersCode, signTradesCode,
  dossierCode, journalCode, gateCode, fanOrdersCode, signOrderCode, recordCode, assembleCode, offlineCode, keysNoteText, gateNoteText, publishNoteText };`)();

const base = (process.env.N8N_BASE_URL || 'https://vincex34.app.n8n.cloud').replace(/\/$/, '');
const id = process.env.N8N_WORKFLOW_ID;
const headers = { 'X-N8N-API-KEY': process.env.N8N_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' };

const response = await fetch(`${base}/api/v1/workflows/${id}`, { headers });
if (!response.ok) throw new Error(`GET workflow ${response.status}: ${await response.text()}`);
const wf = await response.json();

function named(name) {
  const found = wf.nodes.find((item) => item.name === name);
  if (!found) throw new Error(`Node not found: ${name}`);
  return found;
}

const code = {
  'Open Scratch': parts.scratchCode,
  'Fan Lanes': parts.fanCode,
  'Stash candle': parts.stashCode,
  'Keys Present': parts.keysPresentCode,
  'Sign Balance': parts.signBalanceCode,
  'Sign Open Orders': parts.signOpenOrdersCode,
  'Sign Trades': parts.signTradesCode,
  Dossier: parts.dossierCode,
  'Read Journal': parts.journalCode,
  'Risk Gate': parts.gateCode,
  'Fan Orders': parts.fanOrdersCode,
  'Sign Order': parts.signOrderCode,
  'Record Fill': parts.recordCode,
  Assemble: parts.assembleCode,
  'Model Offline': parts.offlineCode,
};
for (const [name, jsCode] of Object.entries(code)) {
  try {
    new Function(jsCode);
  } catch (error) {
    throw new Error(`${name} does not parse: ${error.message}`);
  }
  named(name).parameters.jsCode = jsCode;
}

named('Desk Config').parameters.assignments = {
  assignments: Object.entries(parts.deskValues).map(([name, value]) => ({
    id: name,
    name,
    value,
    type: typeof value === 'number' ? 'number' : 'string',
  })),
};
named('Ticker').parameters.url = `={{ "https://api.kraken.com/0/public/Ticker?pair=" + $('Desk Config').first().json.pairQuery }}`;
named('Send Order').parameters.url = '={{ "https://api.kraken.com" + $json.path }}';

const orbit = named('Orbit').parameters;
orbit.responses = {
  values: [
    { type: 'text', role: 'system', content: parts.instructions },
    { type: 'text', role: 'user', content: '={{ $json.brief }}' },
  ],
};
orbit.options = {
  ...orbit.options,
  maxTokens: 20000,
  store: false,
  reasoning: { reasoningOptions: { effort: 'high', summary: 'concise' } },
  textFormat: {
    textOptions: {
      type: 'json_schema',
      name: 'orbit_round',
      description: 'The journal of this round and the decision for each coin.',
      strict: true,
      schema: parts.roundSchema,
    },
  },
};

const runToken = process.env.ORBIT_RUN_TOKEN || '';
if (!runToken) throw new Error('ORBIT_RUN_TOKEN is missing in .env.local');
let runNow = wf.nodes.find((item) => item.name === 'Run Now');
if (!runNow) {
  const hourly = named('Hourly Watch');
  runNow = {
    id: crypto.randomUUID(),
    webhookId: crypto.randomUUID(),
    name: 'Run Now',
    type: 'n8n-nodes-base.webhook',
    typeVersion: 2.2,
    position: [hourly.position[0], hourly.position[1] + 360],
    parameters: {},
  };
  wf.nodes.push(runNow);
}
runNow.parameters = {
  httpMethod: 'POST',
  path: 'orbit-run-now',
  authentication: 'none',
  responseMode: 'onReceived',
  options: {
    noResponseBody: true,
    onlyRunIf: `={{ $json.headers['x-orbit-token'] === '${runToken}' }}`,
  },
};
wf.connections['Run Now'] = { main: [[{ node: 'Desk Config', type: 'main', index: 0 }]] };
named('Risk Gate');
wf.connections['Model Offline'] = { main: [[{ node: 'Risk Gate', type: 'main', index: 0 }]] };

for (const item of wf.nodes.filter((entry) => entry.type === 'n8n-nodes-base.stickyNote')) {
  const content = String(item.parameters.content || '');
  if (content.includes('Risk Gate')) item.parameters.content = parts.gateNoteText;
  else if (/kraken/i.test(content)) item.parameters.content = parts.keysNoteText;
  else item.parameters.content = parts.publishNoteText;
}

const payload = {
  name: wf.name,
  nodes: wf.nodes,
  connections: wf.connections,
  settings: { executionOrder: wf.settings?.executionOrder || 'v1', availableInMCP: true },
};

if (process.argv.includes('--dry')) {
  console.log(JSON.stringify({ nodes: payload.nodes.length, model: orbit.modelId?.value }, null, 2));
  process.exit(0);
}

const put = await fetch(`${base}/api/v1/workflows/${id}`, { method: 'PUT', headers, body: JSON.stringify(payload) });
const text = await put.text();
if (!put.ok) throw new Error(`PUT workflow ${put.status}: ${text}`);
const saved = JSON.parse(text);
console.log(JSON.stringify({ ok: true, versionId: saved.versionId, active: saved.active, nodes: saved.nodes?.length }));
