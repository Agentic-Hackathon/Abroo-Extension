# راهنمای نصب و رفع اشکال Abroo Assistant v0.2.0

این نسخه برای مشکلات مستندشده در `Abroo Extension.pdf` تهیه شده است: اتصال خودکار MCP، رابط مدیریت Tools، فرم‌های تکراری، راست‌چین/چپ‌چین، اسکرول و ذخیرهٔ تاریخچه پس از `Reload Window`.

## ۱. نصب افزونه بدون Continue

فایل `abroo-assistant-0.2.0.vsix` را دریافت و در PowerShell اجرا کنید:

```powershell
code --install-extension .\abroo-assistant-0.2.0.vsix --force
```

یا در VS Code از Extensions → `...` → `Install from VSIX...` استفاده کنید. سپس `Ctrl+Shift+P` → `Developer: Reload Window` را اجرا کنید. از آیکن Abroo در Activity Bar وارد پنل شوید.

برای بیلد از سورس (Node.js 20+ لازم است؛ وابستگی اضافی برای خود افزونه ندارد):

```powershell
cd .\Abroo-VSCode-Extension
npm run build
npm test
npm run package
code --install-extension .\abroo-assistant-0.2.0.vsix --force
```

## ۲. اتصال MCP درست مثل Continue: افزونه فرایند را خودش اجرا می‌کند

فقط **یک‌بار** سورس Liara MCP را نصب و Build کنید:

```powershell
cd "C:\Users\home\Documents\Hackathon\liara-mcp"
npm ci
npm run build
Test-Path .\dist\index.js
node --version
```

خروجی `Test-Path` باید `True` باشد. **نیازی نیست `node dist/index.js` را دستی و دائمی اجرا کنید.** Abroo با بازکردن پنل، آن را در پس‌زمینه به‌عنوان یک child process از طریق MCP `stdio` اجرا می‌کند. اجرای مستقلِ Node و بازکردن آن در ترمینال لازم نیست.

`Ctrl+Shift+P` → `Abroo: Open Configuration` را اجرا کنید. اگر در VS Code یک Workspace باز باشد مسیر پیش‌فرض `.abroo/config.json` در همان Workspace است؛ در غیر این صورت مسیر `~/.abroo/config.json`. نمونهٔ دقیق مشابه تنظیمات پیوست شما، در `examples/config.liara.windows.json` قرار دارد. محتوای زیر را با مدل و توکن خود تنظیم کنید:

```json
{
  "models": [{
    "name": "My API Model",
    "provider": "openai-compatible",
    "model": "YOUR_MODEL_ID",
    "apiBase": "https://YOUR_LLM_HOST/v1",
    "apiKey": "${secret:llmApiKey}",
    "stream": true
  }],
  "mcpServers": [{
    "name": "Liara",
    "command": "node",
    "transport": "stdio",
    "args": ["C:/Users/home/Documents/Hackathon/liara-mcp/dist/index.js"],
    "cwd": "C:/Users/home/Documents/Hackathon/liara-mcp",
    "env": {
      "LIARA_API_TOKEN": "${secret:liaraToken}",
      "LIARA_TEAM_ID": "YOUR_TEAM_ID",
      "DOTENV_CONFIG_QUIET": "true",
      "LIARA_MCP_CONSOLIDATED": "false"
    },
    "enabled": true,
    "includeTools": ["*"],
    "toolPolicies": {
      "liara_list_apps": "automatic",
      "liara_restart_app": "ask",
      "liara_create_app": "ask"
    }
  }],
  "ui": {"direction":"auto", "language":"fa"},
  "history": {"enabled":true},
  "agent": {"maxToolRounds":8}
}
```

**نکته:** برای نمایش ابزارهای تک‌تک به‌جای حالت تجمیعی MCP، متغیر `LIARA_MCP_CONSOLIDATED` را `false` قرار دهید. تعداد ابزارها به نسخهٔ سرور MCP شما وابسته است. شناسهٔ تیم را با مقدار واقعی حساب خود جایگزین کنید. اگر سرور API مدل شما با استاندارد OpenAI Chat Completions سازگار نیست، به adapter نیاز خواهد داشت.

برای ذخیرهٔ امن توکن و کلید مدل: `Ctrl+Shift+P` → `Abroo: Store API Key / Secret`؛ ابتدا نام `liaraToken` و مقدار آن، سپس مجدداً نام `llmApiKey` و مقدار آن. این مقادیر در VS Code SecretStorage نگهداری می‌شوند؛ لازم نیست رمز را در JSON بنویسید. پس از آن از دکمهٔ ⟳ پنل، `Reconnect MCP` را بزنید.

## ۳. صفحهٔ مدیریت Tools

روی آیکن ⚙ در بالای پنل Abroo کلیک کنید:

- وضعیت هر سرور MCP و تعداد ابزارهای آن را می‌بینید. روشن/خاموش‌کردن سرور از همین صفحه ممکن است.
- ابزارها جست‌وجوپذیرند. برای هر ابزار یکی از وضعیت‌های `Automatic`، `Ask First` یا `Disabled` را انتخاب کنید.
- به دلایل امنیتی **Automatic فقط برای ابزارهای خواندنی تأییدشده** فعال است؛ ابزارهای تغییر دهنده (Restart/Deploy/Delete/Env) باید `Ask First` باشند.
- تنظیمات بلافاصله در همان فایل `config.json` ذخیره می‌شوند. برای افزودن سرور جدید روی «ویرایش config.json» کلیک کنید و یک ورودی در `mcpServers` بنویسید. دکمهٔ «اتصال مجدد» سرورها را دوباره راه‌اندازی می‌کند.

## ۴. اصلاحات رابط

- پاراگراف فارسی بر اساس اولین حرف تشخیص داده می‌شود و قطعه‌های کد انگلیسی LTR باقی می‌مانند.
- ظرف پیام‌ها در پنل Flex دارای `min-height:0` است و مستقل از نوار ورودی اسکرول می‌شود. وقتی شما به بالا اسکرول کرده باشید، دکمهٔ «پیام‌های جدید» نمایش داده می‌شود.
- یک فرم یکسان در هر نوبت گفت‌وگو فقط یک‌بار نمایش داده می‌شود؛ عنوان یا توضیح بازنویسی‌شدهٔ مدل باعث تکرارش نمی‌شود.
- تاریخچهٔ جاری در فضای محلی `workspaceState` افزونه ذخیره می‌شود و پس از `Developer: Reload Window` قابل بازیابی است. محدودهٔ ذخیره ۱۰۰ رویداد و ۶۰ پیام است؛ برای حفظ امنیت، آرگومان‌های خام ابزارها و مقادیر فرم‌ها ذخیره نمی‌شوند. با دکمهٔ ＋ چت جدید بسازید و تاریخچه را پاک کنید. برای غیرفعال‌کردن ذخیره، `"history":{"enabled":false}` را در کانفیگ بگذارید و اتصال را مجدداً برقرار کنید.

## ۵. عیب‌یابی اتصال

۱. از View → Output گزینهٔ **Abroo MCP** را انتخاب کنید. اکنون خطاهای مسیر فایل، پوشهٔ کاری نامعتبر، دستور Node و `stderr` سرور به‌صورت مشخص ثبت می‌شوند.

۲. در PowerShell وضعیت فایل را بررسی کنید:

```powershell
Test-Path "C:\Users\home\Documents\Hackathon\liara-mcp\dist\index.js"
where.exe node
```

۳. اگر Node روی PATH نیست، در فیلد `command` مسیر کامل `node.exe` را بنویسید. اگر فایل در مسیر دیگری Build شده، `args` و `cwd` را مطابق آن اصلاح کنید.

۴. مطمئن شوید Workspace در VS Code مورد اعتماد (`Trust`) است و Secretها ثبت شده‌اند؛ بدون Workspace Trust افزونه اجازهٔ اجرای child process را نمی‌دهد.

۵. اگر سرور از MCP `stdio` پشتیبانی نکند یا متن غیـر JSON را به **stdout** بنویسد، اتصال ممکن است شکست بخورد. لاگ‌ها باید روی **stderr** چاپ شوند.

۶. در صورت بروز خطای زندهٔ Liara، فقط نتیجهٔ تست اتصال mock کافی نیست؛ جزئیات Output را بررسی کنید. اجرای واقعی روی توکن/حساب شما در محیط تولید این بسته انجام نشده است.

## ۶. محدوده و تست

این افزونه OpenAI-compatible Chat Completions و MCP stdio را پشتیبانی می‌کند. ابزارهای فرم و نمودار داخلی‌اند و از LLM tool calling استفاده می‌کنند. پوشش HTTP MCP، مدل‌های native غیرسازگار، و اجرای عملیاتی دیپلوی روی حساب واقعی در این نسخه وجود ندارد.

بیلد و ۱۸ آزمون آفلاین اجرا شده‌اند؛ نصب افزونه در VS Code ویندوزی شما و تست واقعی حساب Liara هنوز باید روی سیستم شما انجام شود. فایل‌های تست و سورس کامل داخل ZIP قرار دارند.
