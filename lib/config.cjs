'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function configFile(workspaceFolder, customPath) {
  if (customPath) return path.resolve(workspaceFolder || os.homedir(), customPath.replace(/^~(?=[\\/])/, os.homedir()));
  const local = workspaceFolder && path.join(workspaceFolder, '.abroo', 'config.json');
  if (local && fs.existsSync(local)) return local;
  return path.join(os.homedir(), '.abroo', 'config.json');
}
function validateConfig(c) {
  if (!c || !Array.isArray(c.models) || c.models.length === 0) throw new Error('config.json: models must be a nonempty array');
  for (const m of c.models) {
    if (!m.name || !m.model || !m.apiBase || !/^https?:\/\//i.test(m.apiBase)) throw new Error('Each model requires name, model, and http(s) apiBase');
    if (m.provider && !['openai', 'openai-compatible', 'ollama', 'lmstudio'].includes(m.provider)) throw new Error('Supported providers: openai-compatible/openai/ollama/lmstudio');
  }
  if (c.mcpServers !== undefined && !Array.isArray(c.mcpServers)) throw new Error('mcpServers must be an array');
  for (const s of c.mcpServers || []) {
    if (!s.name || !s.command || (s.transport && s.transport !== 'stdio')) throw new Error('MCP servers need name, command and transport=stdio');
    if (s.args && !Array.isArray(s.args)) throw new Error('MCP args must be an array');
    if (s.toolPolicies && (typeof s.toolPolicies !== 'object' || Array.isArray(s.toolPolicies))) throw new Error('MCP toolPolicies must be an object');
  }
  return c;
}
function readConfig(file) { return validateConfig(JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''))); }
async function interpolate(value, ctx) {
  if (typeof value !== 'string') return value;
  const vars = /\$\{(secret|env):([^}]+)\}|\$\{workspaceFolder\}|\$\{userHome\}/g;
  let out = '', last = 0, match;
  while ((match = vars.exec(value))) {
    out += value.slice(last, match.index);
    let replacement = '';
    if (match[0] === '${workspaceFolder}') {
      if (!ctx.workspaceFolder) throw new Error('Open a workspace folder before using ${workspaceFolder}');
      replacement = ctx.workspaceFolder;
    } else if (match[0] === '${userHome}') replacement = os.homedir();
    else if (match[1] === 'env') replacement = process.env[match[2]] || '';
    else replacement = await ctx.secrets.get(match[2]) || '';
    out += replacement; last = match.index + match[0].length;
  }
  return out + value.slice(last);
}
function inferWorkingDirectory(s, ctx) {
  const firstScript=(s.args||[]).find(x=>/\.(?:c?js|mjs)$/i.test(String(x)));
  if(firstScript && path.isAbsolute(firstScript) && fs.existsSync(firstScript))return path.dirname(firstScript);
  return ctx.workspaceFolder || os.homedir();
}
async function resolveServer(s, ctx) {
  const env = {};
  for (const [k,v] of Object.entries(s.env || {})) env[k] = await interpolate(String(v),ctx);
  const args=await Promise.all((s.args||[]).map(v=>interpolate(String(v),ctx)));
  const resolved={...s,command:await interpolate(s.command,ctx),args,cwd:s.cwd?await interpolate(s.cwd,ctx):inferWorkingDirectory({...s,args},ctx),env};
  if(!fs.existsSync(resolved.cwd))throw new Error(`MCP working directory does not exist: ${resolved.cwd}`);
  // Catch the common 'MCP exited (null)' cause before spawning node.
  if(/(?:^|[\\/])node(?:\.exe)?$/i.test(resolved.command) && args[0] && /\.(?:c?js|mjs)$/i.test(args[0]) && !fs.existsSync(path.resolve(resolved.cwd,args[0])))throw new Error(`MCP entry script not found: ${args[0]}. Check the path in Abroo configuration.`);
  return resolved;
}
function stripSecrets(value) {
  if (typeof value === 'string') return value
    .replace(/(Bearer\s+)[^\s"']+/gi,'$1[REDACTED]')
    .replace(/([\"'][^\"']*(?:password|passwd|secret|token|api[_-]?key|authorization)[^\"']*[\"']\s*:\s*[\"'])([^\"']+)([\"'])/gi,'$1[REDACTED]$3')
    .replace(/((?:password|passwd|token|secret|api[_-]?key|authorization)\s*[:=]\s*)[^\s,;]+/gi,'$1[REDACTED]')
    .replace(/(\b(?:mysql|postgres(?:ql)?|redis|mongodb(?:\+srv)?):\/\/[^:\s/@]+:)[^@\s]+@/gi,'$1[REDACTED]@');
  if (Array.isArray(value)) return value.map(stripSecrets);
  if (value && typeof value === 'object') {
    if (typeof value.key === 'string' && /password|passwd|secret|token|api.?key|credential|database_url|connectionstring/i.test(value.key) && 'value' in value) return {...value,value:'[REDACTED]'};
    return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,/password|passwd|secret|token|api.?key|authorization|private.?key|credential|database_url|connectionstring/i.test(k)?'[REDACTED]':stripSecrets(v)]));
  }
  return value;
}
module.exports = {configFile,validateConfig,readConfig,interpolate,resolveServer,stripSecrets};
