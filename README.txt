# GitHub 上傳與 Google Sheets 串接（網址已配置）

此資料夾中的 `index.html` 已內建你提供的 Google Apps Script `/exec` 網址。

1. 開啟 https://github.com/madspider02/sped-assessment 。
2. 上傳 `index.html` 及 `assessment-pdf.js` 至儲存庫根目錄，覆蓋舊檔。**注意檔名是小寫 `index.html`**；若有舊 `Index.html` 建議刪除。
3. 進入儲存庫 Settings → Pages，確認從 main / (root) 發布。
4. 開啟 https://madspider02.github.io/sped-assessment/ ，先以完全虛構個案測試。
5. 在第7步輸入你於 Apps Script 專案設定的 `SUBMISSION_KEY`，按「確認資料並形成PDF」。
6. 若看到成功回覆，核對 Google Sheets 的 `Cases`、`IQ_Results`、`Adaptive_General`、`Adaptive_ID`、`Evidence`、`Professional_Review`、`Audit_Log` 7個分頁及 PDF。

**不要**把通行碼寫入 GitHub。Apps Script 必須部署為 Web App 並能接收來自 GitHub Pages 的表單，且 `setupSheets()` 已成功執行。此網頁內的 Apps Script URL 可以公開；但它不是完整身分驗證。

**資訊安全：** GitHub Pages 是公開網站，Apps Script 的「任何人」存取＋共用通行碼不能構成完整的封閉系統。學生的姓名、生日與心理測驗結果屬高度敏感資料，正式使用前需依機構個資及資安規範審查，不應在未核准前送入真實資料。
