# 特殊教育鑑定資料整合系統 v6.0

**系統研發者：國家教育研究院黃彥融副研究員**

原 GitHub 網址：<https://madspider02.github.io/sped-assessment/>

維持舊架構：**GitHub Pages → Google Apps Script → 私人 Google Sheets**；不需要 Firebase。

## 本次兩項修改

1. 移除送出前的 JavaScript 確認視窗。按下「確認資料並形成PDF」後，系統直接進行既有欄位驗證，接著送交 Sheets；資料成功儲存後，仍會在填寫者瀏覽器產生與下載 PDF。
2. 在第 07 步新增「**填寫者 Email（選填）**」。有填寫時，Apps Script 儲存成功後，另以 **MailApp.sendEmail() 寄出 PDF 附件**。沒填寫則不寄信，仍正常儲存及下載。畫面分別回報 Sheet 儲存與 Email 寄送是否成功。寄送失敗可按「重試寄送 Email」，使用同一個個案編號，不重複建檔。

**維持原七個 Sheets 分頁與現有欄位；無需重建試算表。** 寄信狀態記錄在既有的 `Audit_Log` 分頁，包含 `EMAIL_PENDING`、`EMAIL_SENT` 與 `EMAIL_FAILED`。寄送前會檢查是否已寄給同一個案及同一收件信箱，避免重複寄送。

### 後台產生的 Email PDF

Email 附件由 Apps Script 使用 Google Docs 暫存檔製成 PDF，內容包含基本資料、魏氏、適應行為兩組分數與可用折線圖、五類鑑定證據及教師初步研判。暫存文件在轉 PDF 後移至 Google Drive 垃圾桶。**Email PDF 與瀏覽器下載的 PDF 資料內容一致，但版面樣式可能不同**；瀏覽器下載版維持原版樣式。

## 安裝只需要兩個步驟

### A. 更新 Apps Script（先做）

1. 在**之前成功接收資料的同一個 Apps Script 專案**，先備份舊程式碼，再以本版 `Code.gs` 全文取代。
2. 本版已填入前次你提供（去掉最後斜線 `/`）的 Sheet ID：`19cXXJfry4Xr9YHs0jcWgYcpQQX9OKOzR6sxnDFGhYkc`。請確認它仍是現在的試算表。如已更換，修改 `SPREADSHEET_ID`。
3. 由於 Email PDF 可能涉及學生姓名與心理測驗結果，必須指定後台**核准的收件人**，避免公開網頁變成任意寄送附件的工具。設定 `Code.gs` 最上方兩個項目的任一個或兩個：

   ```javascript
   const EMAIL_ALLOWED_ADDRESSES_ = ['teacher@example.edu.tw'];
   const EMAIL_ALLOWED_DOMAINS_ = []; // 若要允許某校域名，可填 ['school.edu.tw']
   ```

   - `EMAIL_ALLOWED_ADDRESSES_`：核准的完整信箱，可用逗號加入數個信箱。
   - `EMAIL_ALLOWED_DOMAINS_`：核准的完整信箱網域，不包括 `@`；建議只在已核准的機構範圍使用。
   - 若兩個清單都空白，**Sheets 仍可儲存、瀏覽器仍可產生 PDF，但不會寄信**，畫面會提示收件人未核准。
   - 此核准名單只是避免任意寄送 Email，不是對填寫者的身分驗證；不能將公開寫入端點當成完整封閉系統。

4. 在 Apps Script 編輯器上方函式選單選 `authorizeEmailReport` → **執行**，依 Google 畫面授權寄送郵件、Google 文件和 Drive 的必要權限（不會寄出測試郵件）。
5. 儲存後，點「**部署 → 管理部署作業 → 鉛筆編輯 → 版本：新增版本 → 部署**」，更新舊部署，不要另外新建（可保留原 `/exec` 網址）。
6. **不需重新執行 `setupSheets()`**；你已有的七個分頁和資料可繼續使用。

### B. 更新 GitHub

1. 開啟 <https://github.com/madspider02/sped-assessment>。
2. 將「GitHub 上傳版 ZIP」的兩個檔案 `index.html`（小寫 i）和 `assessment-pdf.js` 上傳儲存庫根目錄，同名檔直接取代。
3. Commit changes，等待 GitHub Pages 更新；若仍顯示舊畫面，可在無痕視窗開啟原網址。

`index.html` 已保留你之前設定好的 Google Apps Script `/exec` 網址，不必再貼。

## 使用虛構個案驗收

1. 第 07 步 Email 填入一個已核准的**測試信箱**，不必再經過跳出確認視窗，直接點「確認資料並形成PDF」。
2. Sheets 的七個分頁應新增同一 `case_id` 的資料；瀏覽器應下載 PDF，畫面再提示 Email 是否寄出。
3. `Audit_Log` 分頁可看到對應的 `EMAIL_SENT` 紀錄。郵箱應收到 PDF 附件（也可檢查垃圾郵件）。
4. 再用同一個案重試寄信，不應寄出第二封；若 Google 的寄件授權或配額失敗，應看到失敗訊息，而不影響已儲存的 Sheet 資料。
5. Email 留空時，不應寄信，其他功能保持正常。

## 隱私與安全提醒

- GitHub Pages 仍可公開瀏覽；若 Apps Script 部署為「任何人」且以擁有者身分執行，後台**仍缺乏真正的填寫者身分驗證及寫入存取控制**。收件名單只能限制 Email 收件對象，無法阻止任何人提交資料。
- 請勿直接將機密的真實學生／幼兒資料用於公開端點驗收。正式蒐集須先確定機構授權、身分驗證及個資保護程序；發送 Email 附件前還要確認收件者確實有權接收資料。
- Google Apps Script 寄信及文件轉 PDF 有每日配額，寄件者會是部署 Apps Script 的 Google 帳號。附檔郵件可能被轉寄，無法由此系統撤回。
- 信件狀態與 Sheet 寫入狀態**分開顯示**。不會把「寄信失敗」誤當作「Sheet 儲存失敗」。

## 檔案用途

| 檔案 | 上傳位置 |
| --- | --- |
| `index.html` | GitHub Pages 儲存庫根目錄 |
| `assessment-pdf.js` | GitHub Pages 儲存庫根目錄 |
| `Code.gs` | 原 Google Apps Script 專案（**不要放到 GitHub**） |
| `README.md` | 部署說明，供系統管理員參考 |
