# گزارش اصلاحات Abroo Assistant v0.2.0

مبنای تغییرات: گزارش چهارصفحه‌ای `Abroo Extension.pdf` و سورس `Abroo-Assistant-Source-v0.1.0(1).zip`.

## اصلاحات انجام‌شده

| مشکل گزارش‌شده | علت و اصلاح | محل تغییر |
|---|---|---|
| MCP بعد از نمایش ready پیام «MCP stopped» و «MCP exited (null)» می‌دهد | خروج غیرمنتظره و stop عمدی در client سابق تفکیک نمی‌شدند؛ اکنون مسیر و `cwd` قبل از اجرا بررسی می‌شوند، خطای spawn/stdin/stderr و exit signal ثبت می‌شود و stop عمدی پیام crash تولید نمی‌کند | `lib/mcp.cjs`, `lib/config.cjs`, `extension.js` |
| MCP باید همانند Continue بدون اجرای دستی بالا بیاید | با باز شدن پنل، ابزار از `mcpServers` در یک JSON خوانده شده و افزونه خودش `node .../dist/index.js` را از طریق `stdio` اجرا می‌کند؛ نمونهٔ کانفیگ Windows اضافه شد | `examples/config.liara.windows.json`, `INSTALL_FA.md` |
| صفحهٔ تنظیمات Tools وجود ندارد | صفحهٔ مدیریت سرورها، جست‌وجوی ابزارها، وضعیت اتصال، روشن/خاموش‌کردن سرور و سیاست ابزار اضافه شد. تنظیمات در همان `config.json` باقی می‌مانند | `extension.js`, `media/webview.js`, `media/webview.css` |
| فرم‌های یکسان تکرار می‌شوند | درخواست فرم با امضای ساختاری فیلدها در یک turn deduplicate می‌شود؛ عنوان یا توضیح بازنویسی‌شده منجر به فرم دوم نمی‌شود. شناسهٔ درخواست نیز در Webview دوباره رندر نمی‌شود | `extension.js`, `media/webview.js` |
| متن فارسی/انگلیسی جهت اشتباه دارد | تشخیص جهت بر مبنای اولین حرف قوی متن و CSS `unicode-bidi`; کد و JSON چپ‌چین می‌مانند | `media/webview.js`, `media/webview.css` |
| اسکرول پس از افزایش ارتفاع فرم کار نمی‌کند | محدودکردن Flex با `min-height:0; height:0; overflow-y:auto` و دکمهٔ «پیام‌های جدید» هنگام خواندن پیام‌های قدیمی | `media/webview.css`, `media/webview.js` |
| تاریخچه پس از Reload Window پاک می‌شود | snapshot رویدادها و متن نوبت‌های کامل در `VS Code workspaceState`؛ بازیابی در رویداد ready؛ محدودیت ۱۰۰ رویداد/۶۰ پیام؛ خام ابزار و مقادیر فرم ذخیره نمی‌شود | `lib/session.cjs`, `extension.js` |

## ایمنی

- هر ابزار تغییر دهندهٔ زیرساخت همچنان قبل از اجرا نیازمند تأیید تازه است؛ `Automatic` فقط برای مجموعهٔ محدود ابزارهای مشاهده‌ای مجاز است و حتی ابزارهای لیست مرتبط با اطلاعات محرمانه مجاز نیستند.
- دادهٔ ذخیره‌شدهٔ محلی redaction محدود دارد، اما متن آزاد کاربر ممکن است اطلاعات حساس داشته باشد؛ برای محیط حساس `history.enabled=false` مناسب است.
- **تست زنده با حساب Liara و نصب روی Windows/VS Code کاربر انجام نشده است.** خطای `MCP exited(null)` با اصلاح چرخهٔ حیات و بررسی مسیر بهتر تشخیص داده می‌شود، اما اگر علت اصلی در سرور/توکن واقعی باشد باید از Output جدید بررسی شود.

## آزمایش‌ها

`npm run build` و `npm run package` موفق، و `npm test` در آخرین اجرا **۱۸ موفق / ۰ شکست**. آزمون‌ها شامل mock MCP stdio، پاسخ HTTP مدل، مجوز ابزار، فرم و نمودار، ذخیره و بازیابی history، تغییر policy و توقف عمدی سرور است. بررسی بصری دستی در VS Code واقعی انجام نشده است.

## نصب

راهنمای دقیق Windows و کانفیگ برابر با مسیر گزارش در `INSTALL_FA.md`. فایل VSIX را با دستور زیر نصب کنید:

```powershell
code --install-extension .\abroo-assistant-0.2.0.vsix --force
```
