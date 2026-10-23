# Abroo Assistant — افزونهٔ مستقل VS Code

یک افزونهٔ سبک مبتنی بر **Webview + Node.js** با الهام از تجربهٔ کاربری Continue؛ هیچ کد یا وابستگی‌ای از Continue کپی نشده است. این افزونه مستقل از Continue اجرا می‌شود.

**قابلیت‌ها:** گفت‌وگوی استریم با LLMهای سازگار با OpenAI Chat Completions API؛ اجرای چند سرور MCP از طریق `stdio`؛ ثبت ابزارهای MCP به‌عنوان function tool؛ فرم‌های واقعی تولیدشده توسط مدل (انتخاب، متن، شماره، radio، checkbox) با بازگشت تصمیم به مدل؛ نمودارهای تعاملی Line/Bar با انتخاب بازه و روشن/خاموش کردن سری‌ها؛ جهت متن RTL/LTR/Auto؛ تأیید انسانی برای **تمام** ابزارهای MCP؛ نگهداری کلیدها در VS Code SecretStorage.

## ۱) نصب سریع VSIX

پیش‌نیاز: **Visual Studio Code نسخهٔ 1.93 یا جدیدتر**. فایل `abroo-assistant-0.1.0.vsix` را دریافت کرده و در PowerShell اجرا کنید:

```powershell
code --install-extension .\abroo-assistant-0.1.0.vsix --force
```

یا در VS Code: `Extensions` → منوی `...` → `Install from VSIX...` → انتخاب فایل. سپس `Developer: Reload Window` را اجرا کنید. آیکن **Abroo** در Activity Bar ظاهر می‌شود.

## ۲) کانفیگ واحد، شبیه Continue

Command Palette (`Ctrl+Shift+P`) → **Abroo: Open Configuration**. این فرمان `.abroo/config.json` را در پوشهٔ Workspace (در صورت وجود) یا `~/.abroo/config.json` ایجاد و باز می‌کند. این فایل، **تنها** کانفیگ اصلی مدل‌ها و MCPهاست.

نمونهٔ واقعی در `examples/config.json` داخل ZIP سورس و VSIX قرار دارد:

```json
{
  "models": [{
    "name": "My LLM",
    "provider": "openai-compatible",
    "model": "my-model-id",
    "apiBase": "https://my-llm.example.com/v1",
    "apiKey": "${secret:llmApiKey}",
    "temperature": 0.2
  }],
  "mcpServers": [{
    "name": "liara",
    "transport": "stdio",
    "command": "node",
    "args": ["${workspaceFolder}/Abroo-main/dist/index.js"],
    "cwd": "${workspaceFolder}/Abroo-main",
    "env": {
      "LIARA_API_TOKEN": "${secret:liaraToken}",
      "LIARA_MCP_CONSOLIDATED": "true"
    },
    "includeTools": ["*"]
  }],
  "ui": {"direction": "auto", "language": "fa"},
  "agent": {"maxToolRounds": 8, "requestTimeoutMs": 120000, "maxOutputChars": 16000}
}
```

`provider` برای OpenAI-compatible، OpenAI، Ollama (`http://127.0.0.1:11434/v1`) و LM Studio (`http://127.0.0.1:1234/v1`) قابل استفاده است، به شرط آنکه endpoint از فرمت OpenAI Chat Completions و function calling پشتیبانی کند. پیاده‌سازی اختصاصی Anthropic/Gemini native در نسخهٔ حاضر وجود ندارد. در حالت‌های محلی معمولاً `apiKey` برابر `""` است.

اگر مسیر فایل MCP شما مثلاً `D:\\Projects\\Abroo-main\\dist\\index.js` است، می‌توانید در JSON آرایهٔ `args` را با همان مسیر مطلق جایگزین کنید. `${workspaceFolder}` مسیر ریشهٔ بازشده در VS Code است. **حتماً پوشهٔ MCP را ابتدا جداگانه build کنید** (بخش ۳). در سرور قدیمی Abroo نام متغیر API برابر `LIARA_API_TOKEN` است و حالت ابزارهای تجمیعی با `LIARA_MCP_CONSOLIDATED=true` فعال می‌شود.

### ذخیرهٔ امن کلیدها

Command Palette → **Abroo: Store API Key / Secret**، نام `llmApiKey` و سپس مقدار کلید را وارد کنید. دوباره فرمان را برای `liaraToken` اجرا کنید. مقادیر در VS Code SecretStorage ذخیره می‌شوند و در `config.json` نوشته نمی‌شوند. برای توکن تیم، در صورت نیاز `LIARA_TEAM_ID` را به `env` اضافه کنید (`"${env:LIARA_TEAM_ID}"` یا مقدار شناسهٔ غیرمحرمانه). این الگوها پشتیبانی می‌شوند:

- `${secret:KEY}`: VS Code SecretStorage
- `${env:ENV_NAME}`: متغیر محیطی فرایند VS Code
- `${workspaceFolder}`: پوشهٔ پروژه
- `${userHome}`: پوشهٔ خانهٔ کاربر

پس از ویرایش config یا ذخیرهٔ secret، فرمان **Abroo: Reload Configuration / Reconnect MCP** یا دکمهٔ ⟳ پنل را اجرا کنید.

**امنیت:** پروژهٔ بازشده باید مورد اعتماد (`Workspace Trust`) باشد تا سرورهای MCP اجرا شوند. درخواست اجرای هر ابزار MCP — حتی خواندنی — یک فرم تأیید/رد جداگانه می‌سازد. تأیید صرفاً برای همان درخواست معتبر است. هر اجرای بعدی مجدداً تأیید می‌خواهد. استفاده از `${secret:...}` به‌جای ثبت API key در JSON توصیه می‌شود. داده‌های ابزارها قبل از ارسال به LLM تا حد ممکن پاک‌سازی می‌شوند، اما پاک‌سازی خودکار نمی‌تواند محرمانه‌بودن تمام ساختارهای دلخواه را تضمین کند؛ ابزارهای حساس را در `includeTools` محدود کنید.

## ۳) آماده‌کردن MCP موجود Abroo

بستهٔ بهبود‌یافتهٔ MCP که قبلاً ارائه شده را از ZIP استخراج کنید تا ساختار پوشه مطابق آدرسِ `cwd` باشد. در PowerShell:

```powershell
cd D:\Projects\Abroo-main
npm ci
npm run build
node dist/index.js
```

در اجرای مستقیم `node dist/index.js` بدون تنظیم `LIARA_API_TOKEN` احتمالاً خطای توکن می‌گیرید؛ طبیعی است. داخل افزونه توکن از SecretStorage به env فرایند منتقل می‌شود. **فرایند را لازم نیست جداگانه اجرا کنید**؛ افزونه خودش آن را از طریق `stdio` راه‌اندازی می‌کند. فقط دستورهای `npm ci` و `npm run build` باید موفق شوند. سرور باید روی stdout فقط JSON-RPC newline-delimited بنویسد و لاگ‌ها را روی stderr بفرستد.

## ۴) نمونهٔ کارکرد فرم، Diagnose و نمودار

- «اپ `my-mcp-test` را diagnose کن، خطاها را توضیح بده و فقط گزینه‌های اصلاح معتبر را در فرم نشان بده.»
- «از بین گزینه‌های اصلاح اجازه بده انتخاب کنم؛ ابتدا پیش‌نمایش و بعد تأیید من را بگیر.»
- «مصرف CPU و RAM در ۲۴ ساعت اخیر را از MCP دریافت کن و نمودار خطی با داده‌های واقعی بکش.»
- «پوشهٔ وب‌سایتم را برای دیپلوی بررسی کن؛ اپ یا تیم را در فرم بپرس و قبل از ساخت Release تأیید بگیر.»

ابزار داخلی `abroo_request_form` یک فرم Webview می‌سازد؛ پس از ثبت، نتیجه به مدل برمی‌گردد. `abroo_show_chart` سری‌های عددی را نمایش می‌دهد. این دو ابزار از راه API مدل فراخوانی می‌شوند و نیازی به MCP Apps یا اصلاح سرور قبلی ندارند. مدل باید از Function Calling پشتیبانی کند.

فرم انتخاب **مجوز اجرای عملیات نیست**؛ بعد از انتخاب، درخواست MCP مجدداً توسط رابط تأیید می‌شود. `liara_prepare_remediation` و `liara_apply_remediation` همچنان دو مرحلهٔ جداگانه‌اند. کلاینت فقط پس از تأیید مستقیم کاربر درخواست `apply` را اجرا می‌کند.

## ۵) بیلد، تست و ساخت VSIX از سورس (بدون اینترنت)

Node.js **20+** توصیه می‌شود. هیچ پکیج خارجی یا npm install الزامی نیست. از PowerShell در ریشهٔ پوشهٔ سورس:

```powershell
node --version
npm run build
npm test
npm run package
code --install-extension .\abroo-assistant-0.1.0.vsix --force
```

`npm run build` syntax check انجام می‌دهد (کد JS نیاز به transpile ندارد)؛ `npm test` تست‌های core + MCP stdio و یک OpenAI-compatible HTTP server محلی را اجرا می‌کند؛ `npm run package` یک VSIX با قالب استاندارد ZIP/manifest می‌سازد. بسته‌بند اختصاصی در `scripts/package.mjs` قرار دارد و از هیچ سرویس خارجی استفاده نمی‌کند. برای انتشار Marketplace می‌توان جداگانه از ابزار رسمی `@vscode/vsce` بهره برد.

## ۶) ساختار فایل‌ها

```text
Abroo-VSCode-Extension/
  extension.js          # VS Code activation, conversation loop, approvals
  lib/config.cjs        # JSON config, secret interpolation, redaction
  lib/mcp.cjs           # MCP stdio JSON-RPC client, discovery
  lib/llm.cjs           # OpenAI-compatible streaming + tool calling
  media/webview.js      # Chat, dynamic forms and interactive SVG charts
  media/webview.css     # Theme-aware RTL/LTR styling
  media/icon.svg/png
  examples/config.json
  scripts/build.mjs     # Offline validation
  scripts/package.mjs   # Offline VSIX builder
  tests/                # Offline protocol/LLM unit and integration tests
```

## ۷) محدودیت‌های مشخص نسخهٔ اول

- **مدل:** OpenAI-compatible Chat Completions؛ providerهای native غیرسازگار با این API نیازمند adapter هستند. همهٔ مدل‌های محلی از Tool Calling پشتیبانی نمی‌کنند.
- **MCP:** تنها transport=`stdio` پیاده‌سازی شده (برای MCP Abroo فعلی کافی است)؛ HTTP Streamable و auth flows خاص در این نسخه وجود ندارند.
- **ادغام ادیتور:** چت در Sidebar است؛ ویرایش مستقیم فایل‌های کد، تکمیل خودکار و خواندن خودکار workspace مانند Continue پیاده‌سازی نشده‌اند.
- **قابلیت‌ها:** فرم شامل نوع‌های رایج و نمودار Line/Bar است؛ dashboard پیشرفته و import خودکار YAML Continue موجود نیست.
- **تست:** تست‌های آفلاین، اتصال واقعی به Liara را شبیه‌سازی نمی‌کنند و مدرک اجرای موفق دیپلوی زنده نیستند.
- **تأیید ابزار:** بعد از انتخاب، مدل ممکن است چند ابزار پیشنهاد دهد؛ هرکدام مستقلاً نیازمند تأیید است. تأییدهای انتظارمانده پس از سه دقیقه منقضی می‌شوند.
- **حریم خصوصی:** پیام کاربر و نتیجهٔ redacted ابزارهای تأییدشده به endpoint مدل ارسال می‌شوند. فقط از سرور LLM مورد اعتماد استفاده کنید.

## طراحی الهام‌گرفته از Continue

الگوی Activity Bar/Webview، فهرست مدل‌ها و پیکربندی مرکزی با الهام از [Continue](https://github.com/continuedev/continue) است؛ کد این افزونه مستقل و از صفر نوشته شده است. نسخهٔ مورد بررسی Continue متن‌باز و تحت مجوز Apache 2.0 است. از کد منبع آن در این بسته استفاده نشده است.
