#!/usr/bin/env node

import { Composio } from '@composio/core';

const VERSION = '0.1.0';
const DEFAULT_BASE_URL = 'https://backend.composio.dev';
const WRITE_WORDS = [
  'ADD',
  'ARCHIVE',
  'CANCEL',
  'CREATE',
  'DELETE',
  'DISABLE',
  'ENABLE',
  'INVITE',
  'PATCH',
  'POST',
  'PUT',
  'REFRESH',
  'REMOVE',
  'REVOKE',
  'SEND',
  'SUBMIT',
  'UPDATE',
  'UPLOAD',
  'WRITE',
];

function parseArgs(argv) {
  const globals = { json: false };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--json') globals.json = true;
    else if (arg === '--version' || arg === '-v') globals.version = true;
    else if (arg === '--help' || arg === '-h') globals.help = true;
    else rest.push(arg);
  }
  return { globals, rest };
}

function parseFlags(args) {
  const flags = {};
  const positionals = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith('--')) {
      positionals.push(arg);
      continue;
    }
    const key = arg.slice(2);
    if (key === 'all' || key === 'allow-unsafe-read-name') {
      flags[key] = true;
    } else {
      flags[key] = args[++i];
    }
  }
  return { flags, positionals };
}

function authInfo() {
  const apiKey = process.env.COMPOSIO_API_KEY || '';
  return {
    apiKey,
    available: Boolean(apiKey),
    source: apiKey ? 'env:COMPOSIO_API_KEY' : 'missing',
  };
}

function getClient() {
  const { apiKey } = authInfo();
  if (!apiKey) {
    throw userError('COMPOSIO_API_KEY is not set', 'AUTH_MISSING');
  }
  return new Composio({ apiKey });
}

function userError(message, code = 'USER_ERROR', extra = {}) {
  const error = new Error(message);
  error.code = code;
  error.extra = extra;
  return error;
}

function output(value, asJson) {
  if (asJson) {
    process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
    return;
  }
  if (value.ok === false) {
    process.stdout.write(`error: ${value.error.message}\n`);
    return;
  }
  process.stdout.write(`${JSON.stringify(value.data ?? value, null, 2)}\n`);
}

function printHelp() {
  process.stdout.write(`composio-lite ${VERSION}

Usage:
  composio-lite [--json] doctor
  composio-lite [--json] accounts list [--limit n] [--user-id id] [--toolkit slug]
  composio-lite [--json] toolkits list [--limit n]
  composio-lite [--json] actions list --user-id id --toolkit slug [--limit n]
  composio-lite [--json] actions execute --user-id id --tool TOOL_NAME --args-json JSON
  composio-lite [--json] request get /api/v3.1/path

Auth:
  Reads COMPOSIO_API_KEY from the environment.

Safety:
  actions execute blocks write-looking tool names by default.
`);
}

function limitItems(value, limit) {
  const n = Number(limit ?? 20);
  if (!Number.isFinite(n) || n <= 0) throw userError('--limit must be a positive number', 'INVALID_LIMIT');
  if (Array.isArray(value)) return value.slice(0, n);
  if (Array.isArray(value?.items)) return { ...value, items: value.items.slice(0, n) };
  if (Array.isArray(value?.data)) return { ...value, data: value.data.slice(0, n) };
  return value;
}

function listFromResponse(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.connectedAccounts)) return value.connectedAccounts;
  if (Array.isArray(value?.toolkits)) return value.toolkits;
  if (Array.isArray(value?.tools)) return value.tools;
  return [];
}

function summarizeAccount(account) {
  return {
    id: account.nanoid || account.id || account.connectedAccountId || null,
    status: account.status || null,
    toolkit: account.toolkit?.slug || account.toolkitSlug || account.toolkit || null,
    userId: account.userId || account.user_id || null,
    disabled: account.isDisabled ?? account.disabled ?? null,
  };
}

function summarizeToolkit(toolkit) {
  return {
    slug: toolkit.slug || toolkit.name || toolkit.id || null,
    name: toolkit.name || toolkit.displayName || toolkit.slug || null,
    authConfig: toolkit.authConfig || toolkit.auth_config || null,
  };
}

function summarizeAction(tool) {
  return {
    slug: tool.slug || tool.name || tool.function?.name || null,
    name: tool.name || tool.slug || tool.function?.name || null,
    toolkit: tool.toolkit?.slug || tool.toolkitSlug || tool.toolkit || null,
    description: tool.description || tool.function?.description || null,
    parameters: tool.parameters || tool.inputSchema || tool.function?.parameters || null,
  };
}

function looksWriteOrUnsafe(toolName) {
  const upper = String(toolName || '').toUpperCase();
  return WRITE_WORDS.some((word) => upper.includes(`_${word}_`) || upper.endsWith(`_${word}`) || upper.startsWith(`${word}_`));
}

async function runDoctor(asJson) {
  const auth = authInfo();
  const data = {
    version: VERSION,
    node: process.version,
    auth: {
      available: auth.available,
      source: auth.source,
    },
    sdk: '@composio/core',
    checks: [],
  };

  if (!auth.available) {
    data.checks.push({ name: 'auth', ok: false, message: 'Set COMPOSIO_API_KEY' });
    output({ ok: true, data }, asJson);
    return;
  }

  try {
    const client = getClient();
    const accounts = await client.connectedAccounts.list();
    data.checks.push({ name: 'connectedAccounts.list', ok: true, count: listFromResponse(accounts).length });
  } catch (error) {
    data.checks.push({ name: 'connectedAccounts.list', ok: false, message: error.message });
  }
  output({ ok: true, data }, asJson);
}

async function runAccounts(args, asJson) {
  const [sub, ...flagArgs] = args;
  if (sub !== 'list') throw userError('Usage: accounts list [--limit n] [--user-id id] [--toolkit slug]', 'USAGE');
  const { flags } = parseFlags(flagArgs);
  const query = {};
  if (flags['user-id']) query.userIds = [flags['user-id']];
  if (flags.toolkit) query.toolkitSlugs = [flags.toolkit];
  const result = await getClient().connectedAccounts.list(Object.keys(query).length ? query : undefined);
  const accounts = listFromResponse(limitItems(result, flags.limit)).map(summarizeAccount);
  output({ ok: true, data: { accounts, raw: flags.all ? result : undefined } }, asJson);
}

async function runToolkits(args, asJson) {
  const [sub, ...flagArgs] = args;
  if (sub !== 'list') throw userError('Usage: toolkits list [--limit n]', 'USAGE');
  const { flags } = parseFlags(flagArgs);
  const client = getClient();
  if (!client.toolkits?.list) throw userError('@composio/core does not expose toolkits.list in this version', 'SDK_UNSUPPORTED');
  const result = await client.toolkits.list();
  const toolkits = listFromResponse(limitItems(result, flags.limit)).map(summarizeToolkit);
  output({ ok: true, data: { toolkits, raw: flags.all ? result : undefined } }, asJson);
}

async function runActions(args, asJson) {
  const [sub, ...flagArgs] = args;
  const { flags } = parseFlags(flagArgs);
  const client = getClient();
  if (sub === 'list') {
    if (!flags['user-id']) throw userError('actions list requires --user-id', 'USAGE');
    if (!flags.toolkit) throw userError('actions list requires --toolkit', 'USAGE');
    const result = await client.tools.get(flags['user-id'], {
      toolkits: [flags.toolkit],
      limit: Number(flags.limit ?? 20),
    });
    const actions = listFromResponse(result).map(summarizeAction);
    output({ ok: true, data: { actions, raw: flags.all ? result : undefined } }, asJson);
    return;
  }

  if (sub === 'execute') {
    if (!flags['user-id']) throw userError('actions execute requires --user-id', 'USAGE');
    if (!flags.tool) throw userError('actions execute requires --tool', 'USAGE');
    if (looksWriteOrUnsafe(flags.tool) && !flags['allow-unsafe-read-name']) {
      throw userError(`Refusing to execute write-looking tool name: ${flags.tool}`, 'UNSAFE_TOOL_NAME', {
        hint: 'This CLI is intended for read-only actions. Rename/use a clearly read-only tool or pass --allow-unsafe-read-name only after explicit approval.',
      });
    }
    let toolArgs = {};
    if (flags['args-json']) {
      try {
        toolArgs = JSON.parse(flags['args-json']);
      } catch {
        throw userError('--args-json must be valid JSON', 'INVALID_JSON');
      }
    }
    const result = await client.tools.execute(flags.tool, {
      userId: flags['user-id'],
      arguments: toolArgs,
    });
    output({ ok: true, data: { result } }, asJson);
    return;
  }

  throw userError('Usage: actions list|execute ...', 'USAGE');
}

async function runRequest(args, asJson) {
  const [method, path] = args;
  if (method !== 'get' || !path) throw userError('Usage: request get /api/v3.1/path', 'USAGE');
  if (!path.startsWith('/')) throw userError('request path must start with /', 'USAGE');
  const { apiKey } = authInfo();
  if (!apiKey) throw userError('COMPOSIO_API_KEY is not set', 'AUTH_MISSING');
  const url = new URL(path, process.env.COMPOSIO_BASE_URL || DEFAULT_BASE_URL);
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'x-api-key': apiKey,
      authorization: `Bearer ${apiKey}`,
      accept: 'application/json',
    },
  });
  const text = await response.text();
  let body = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { text };
  }
  output({ ok: response.ok, data: { status: response.status, body } }, asJson);
  if (!response.ok) process.exitCode = 1;
}

async function main() {
  const { globals, rest } = parseArgs(process.argv.slice(2));
  if (globals.version) {
    process.stdout.write(`${VERSION}\n`);
    return;
  }
  if (globals.help || rest.length === 0) {
    printHelp();
    return;
  }

  const [command, ...args] = rest;
  if (command === 'doctor') await runDoctor(globals.json);
  else if (command === 'accounts') await runAccounts(args, globals.json);
  else if (command === 'toolkits') await runToolkits(args, globals.json);
  else if (command === 'actions') await runActions(args, globals.json);
  else if (command === 'request') await runRequest(args, globals.json);
  else throw userError(`Unknown command: ${command}`, 'USAGE');
}

main().catch((error) => {
  output({
    ok: false,
    error: {
      message: error.message || String(error),
      code: error.code || 'ERROR',
      ...error.extra,
    },
  }, process.argv.includes('--json'));
  process.exit(1);
});
