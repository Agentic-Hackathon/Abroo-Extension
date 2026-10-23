# راهنمای نصب و راه‌اندازی Abroo Assistant در VS Code

## روش اول: نصب افزونهٔ آماده (پیشنهادی)

1. فایل `abroo-assistant-0.1.0.vsix` را در یک پوشه قرار دهید.
2. با VS Code نسخهٔ 1.93+ آن را نصب کنید:

```powershell
code --install-extension .\abroo-assistant-0.1.0.vsix --force
```

3. در VS Code، `Ctrl+Shift+P` → `Developer: Reload Window` را بزنید. آیکن Abroo در Activity Bar ظاهر می‌شود.
4. از Command Palette فرمان `Abroo: Open Configuration` را اجرا کنید؛ فایل `.abroo/config.json` ایجاد می‌شود.
5. کانفیگ مدل و مسیر MCP را تنظیم کنید (نمونهٔ کامل در `examples/config.json`).
6. فرمان `Abroo: Store API Key / Secret` را دوبار اجرا کنید: یک‌بار با نام `llmApiKey` و یک‌بار با `liaraToken`.
7. فرمان `Abroo: Reload Configuration / Reconnect MCP` را اجرا کنید.

## روش دوم: بیلد و نصب از سورس — بدون اینترنت

از پوشهٔ سورس افزونه در PowerShell:

```powershell
node --version
npm run build
npm test
npm run package
code --install-extension .\abroo-assistant-0.1.0.vsix --force
```

`npm install` برای خود افزونه لازم نیست. حداقل Node.js 20 توصیه می‌شود. `npm run package` VSIX را به‌صورت آفلاین می‌سازد.

## اتصال به MCP لیارا

در پوشهٔ سورس MCP فعلی:

```powershell
cd D:\Projects\Abroo-main
npm ci
npm run build
```

مسیر `dist/index.js` تولیدشده را در فیلدهای `args` و `cwd` کانفیگ افزونه قرار دهید:

```json
{
  "models": [
    {"name":"My LLM","provider":"openai-compatible","model":"MODEL_ID","apiBase":"https://LLM_SERVER/v1","apiKey":"${secret:llmApiKey}"}
  ],
  "mcpServers": [
    {"name":"liara","transport":"stdio","command":"node", "args":["D:/Projects/Abroo-main/dist/index.js"], "cwd":"D:/Projects/Abroo-main", "env":{"LIARA_API_TOKEN":"${secret:liaraToken}","LIARA_MCP_CONSOLIDATED":"true"},"includeTools":["*"]}
  ],
  "ui":{"direction":"auto","language":"fa"},
  "agent":{"maxToolRounds":8}
}
```

در Windows توصیه می‌شود در JSON از `/` برای آدرس‌ها استفاده کنید یا `\\` بنویسید. مسیرهای نمونه را با مسیر واقعی پروژه و LLM خود عوض کنید. اگر داخل VS Code پوشهٔ پروژه‌ای دارید که زیر آن پوشهٔ `Abroo-main` وجود دارد، می‌توانید به‌جای مسیر مطلق از `${workspaceFolder}/Abroo-main/...` استفاده کنید.

## بررسی عملکرد

از آیکن Abroo وارد شوید، مدل را از نوار بالا انتخاب کنید و درخواست زیر را بفرستید:

> اپ my-mcp-test را بررسی کن؛ قبل از فراخوانی ابزار از من اجازه بگیر و اگر لازم بود گزینه‌های اصلاح را در یک فرم نشان بده.

برای نمودار:

> دادهٔ واقعی مصرف CPU را با MCP بگیر و در نمودار خطی نمایش بده؛ اگر داده‌ای موجود نیست چیزی جعل نکن.

اگر اتصال برقرار نشد: پیام وضعیت زیر انتخاب مدل، Output panel → `Abroo MCP`، صحیح‌بودن مسیر `dist/index.js` و کلیدهای SecretStorage را بررسی کنید. **بدون تأیید در فرم هیچ ابزار MCP اجرا نمی‌شود.**

## ملاحظات

برای عملیات حساس ابتدا از `liara_prepare_remediation` و پس از انتخاب و تأیید مستقل از `liara_apply_remediation` استفاده کنید. افزونه از OpenAI-compatible Chat Completions و MCP `stdio` پشتیبانی می‌کند و هنوز جایگزین قابلیت‌های کامل ویرایشگر Continue نیست. فایل VSIX در محیط ساخت با ZIP و تست‌های آفلاین بررسی شده است؛ نصب واقعی در VS Code کاربر و تماس واقعی با Liara در این محیط انجام نشده است.
