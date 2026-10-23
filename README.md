# Abroo Assistant — Lightweight VS Code Extension

Standalone VS Code sidebar assistant with OpenAI-compatible LLMs and stdio MCP servers. **MCP processes start automatically** from the unified `.abroo/config.json` configuration; running the server manually is not necessary. The UI is inspired by Continue but does not bundle or fork its code.

### Features

- Persian/English auto-RTL paragraphs with LTR code spans, VS Code theme-aware chat
- Scrollable chat with a jump-to-latest button, fixed flex layout
- MCP management panel: server status/on-off, searchable tools and per-tool `Automatic` / `Ask First` / `Disabled` settings
- Default per-call tool approval; automatic only for a narrowly allowlisted set of observational calls, never mutation or credential tools
- Model-generated interactive forms with one-turn de-duplication and submitted answers returned to LLM
- SVG line/bar charts from supplied observations, no synthetic data
- Conversation and visible timeline persisted in VS Code workspaceState across Reload Window (bounded, redacted); raw tool arguments/outputs and form input values are not stored
- Better MCP lifecycle diagnostics: missing script/cwd checks, child stderr and exit signal, intentional stops are not treated as crashes
- Config uses one JSON file; VS Code SecretStorage supports `${secret:...}` and interpolated environment variables

### Installation

```powershell
code --install-extension .\abroo-assistant-0.2.1.vsix --force
```

Reload VS Code. Run `Abroo: Open Configuration` from command palette and use `examples/config.liara.windows.json` for the user's Windows Liara MCP path. Read **[INSTALL_FA.md](INSTALL_FA.md)** for complete Persian instructions, the configuration example and troubleshooting steps.

### Build and tests

```powershell
npm run build
npm test
npm run package
```

No `npm install` is needed for the extension itself, but your MCP server must have its own dependencies installed and `dist/index.js` built. Node 20+ recommended. The extension makes no claim of having successfully contacted a live Liara account.

### Core layout

- `extension.js` VS Code host, tool approval, reconnect lifecycle, session persistence, tools management
- `lib/mcp.cjs` standalone JSON-RPC stdio transport
- `lib/llm.cjs` OpenAI-compatible streaming and function calling
- `lib/config.cjs` interpolation and safety checks
- `lib/policies.cjs` conservative tool policy rules
- `lib/session.cjs` bounded persistent transcript and LLM context
- `media/webview.js` form, chat, chart, tools UI
- `media/webview.css` scrolling, direction and layout
- `tests/*.test.cjs` offline tests including mock MCP/HTTP

### Security and limitations

Untrusted workspaces cannot start MCP servers. Remote mutations are always gated by a fresh human approval, regardless of tool-policy configuration. Tool output is scrubbed with heuristics but redaction is not guaranteed to catch secrets in arbitrary formats. Persisted local transcript may still contain user-supplied sensitive prose; turn off history when needed. This version is not an autonomous, unsandboxed code editor, an HTTP MCP client, or a replacement for Continue's full editor capabilities.
