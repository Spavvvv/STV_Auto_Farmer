// ==UserScript==
// @name         STV Auto Farmer
// @namespace    http://tampermonkey.net/
// @version      v1.1.3
// @description  Big Update.. Đọc readme.md để biết cách sử dụng!
// @author       Gemini v3.0 + Soap
// @match        https://sangtacviet.com/truyen/*
// @icon         https://sangtacviet.com/favicon.ico
// @run-at       document-start
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      api.telegram.org
// ==/UserScript==

(function() {
    'use strict';

    // 1. CẤU HÌNH
    const TELEGRAM_TOKEN = 'ĐIỀN_TOKEN_CỦA_BẠN_VÀO_ĐÂY';
    const TELEGRAM_CHAT_ID = 'ĐIỀN_CHAT_ID_CỦA_BẠN_VÀO_ĐÂY';

    const CONFIG = {
        minWait: 12000,
        maxWait: 15000,
        sleepTimeOnError: 45
    };
    const win = unsafeWindow;

    //  Lấy truyện gốc từ URL(hotfix v1.1.1)
    function getStoryRoot(url) {
        // Tìm đoạn: https://sangtacviet.com/truyen/nguon/loai/id_truyen/
        let match = url.match(/(https:\/\/sangtacviet\.com\/truyen\/[^\/]+\/\d+\/\d+)/);
        if (match) return match[1] + '/';
        return url; // Không khớp thì trả về nguyên bản
    }

    // --- Cập nhật tiến độ (hotfix v.1.1.2) ---
    function updateCurrentChapterToStorage() {
        let list = getStoryList();
        let currentUrl = location.href;
        let currentRoot = getStoryRoot(currentUrl); // Lấy gốc truyện hiện tại

        for (let i = 0; i < list.length; i++) {
            // So sánh gốc: Nếu gốc giống nhau -> Cùng 1 truyện
            if (getStoryRoot(list[i]) === currentRoot) {
                // Cập nhật link trong list thành chương hiện tại
                if (list[i] !== currentUrl) {
                    list[i] = currentUrl;
                    saveStoryList(list);
                    console.log("🔖 Đã cập nhật Bookmark:", currentUrl);
                }
                // Đồng bộ luôn cái index đang đọc
                setCurrentStoryIndex(i);
                return;
            }
        }
    }

    // 2. QUẢN LÝ DỮ LIỆU & TRẠNG THÁI
    function getStoryList() { return JSON.parse(localStorage.getItem('stv_story_list') || '[]'); }
    function saveStoryList(list) { localStorage.setItem('stv_story_list', JSON.stringify(list)); }
    
    function getCurrentStoryIndex() { return parseInt(localStorage.getItem('stv_current_story_index') || '0'); }
    function setCurrentStoryIndex(index) { localStorage.setItem('stv_current_story_index', index); }

    function isAutoRunning() { return localStorage.getItem('stv_auto_farm') === 'true'; }
    function isPendingCollect() { return localStorage.getItem('stv_pending_collect') === 'true'; }
    function setPendingCollect(status) { localStorage.setItem('stv_pending_collect', status); }

    function getErrorStreak() { return parseInt(localStorage.getItem('stv_error_streak') || '0'); }
    function increaseErrorStreak() { localStorage.setItem('stv_error_streak', getErrorStreak() + 1); }
    function resetErrorStreak() { localStorage.setItem('stv_error_streak', '0'); }
    
    function getSleepUntil() { return parseInt(localStorage.getItem('stv_sleep_until') || '0'); }
    function setSleepUntil(timestamp) { localStorage.setItem('stv_sleep_until', timestamp); }

    // 3. HỆ THỐNG TELEGRAM (ANTI-SPAM + SMART COMMANDS)
    function sendTele(msg, type = 'info', callback = null) {
        if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID || TELEGRAM_TOKEN.includes('ĐIỀN_')) {
            if(callback) callback(); return;
        }
        let icon = type === 'success' ? '🎁' : (type === 'error' ? '🚨' : 'ℹ️');
        let time = new Date().toLocaleTimeString('vi-VN', { hour12: false });
        let title = document.title.split('-')[0].trim() || "STV";
        let finalMsg = `${icon} <b>[${time}]</b>\n${msg}\n📖 <i>${title}</i>`;

        GM_xmlhttpRequest({
            method: "POST",
            url: `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
            data: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: finalMsg, parse_mode: "HTML", disable_web_page_preview: true }),
            headers: { "Content-Type": "application/json" },
            onload: function() { if(callback) callback(); },
            onerror: function() { if(callback) callback(); }
        });
    }

    function checkRemoteCommands() {
        if (!TELEGRAM_TOKEN) return;

        // Random Delay (0-2s) để các Tab không check cùng lúc
        setTimeout(() => {
            // Lấy ID tin nhắn cuối cùng ĐÃ ĐƯỢC XỬ LÝ bởi bất kỳ tab nào
            let lastProcessedId = parseInt(localStorage.getItem('stv_last_processed_id') || '0');

            GM_xmlhttpRequest({
                method: "GET",
                url: `https://api.telegram.org/bot${TELEGRAM_TOKEN}/getUpdates?offset=${lastProcessedId + 1}&limit=1`,
                onload: function(response) {
                    try {
                        let res = JSON.parse(response.responseText);
                        if (res.ok && res.result.length > 0) {
                            let update = res.result[0];
                            let updateId = update.update_id;

                            // Check lại lần nữa (Double Check Lock)
                            let currentProcessedId = parseInt(localStorage.getItem('stv_last_processed_id') || '0');
                            if (updateId <= currentProcessedId) return; // Đã có tab khác xử lý rồi -> Bỏ qua

                            // Khóa ngay lập tức
                            localStorage.setItem('stv_last_processed_id', updateId);

                            let message = update.message ? update.message.text : "";
                            if (update.message && update.message.chat.id.toString() === TELEGRAM_CHAT_ID && message) {
                                processCommand(message.trim());
                            }
                        }
                    } catch (e) {}
                }
            });
        }, Math.random() * 2000);
    }

    function processCommand(cmd) {          //hotfix v1.1.0
        console.log("Cmd:", cmd);
        let parts = cmd.split(' ');
        let command = parts[0].toLowerCase();

        // --- LỆNH ADD (SỬA: LƯU LINK FULL, NHƯNG CHECK TRÙNG BẰNG ROOT) (hotfix v.1.1.2) ---
        if (command === '/add') {
            let urlToAdd = parts[1];
            if (!urlToAdd) {
                if (location.href.includes("sangtacviet.com/truyen/")) urlToAdd = location.href;
                else { sendTele("❌ Lỗi link.", 'error'); return; }
            }

            if (urlToAdd && urlToAdd.includes('sangtacviet.com')) {
                let list = getStoryList();
                let rootNew = getStoryRoot(urlToAdd);
                
                // Kiểm tra xem truyện này (gốc này) đã có trong list chưa
                let exists = list.some(savedUrl => getStoryRoot(savedUrl) === rootNew);

                if (!exists) {
                    addStory(urlToAdd); // LƯU LINK FULL (Để nhớ chương)
                    sendTele(`✅ Đã thêm truyện vào list.`, 'info');
                } else {
                    sendTele("⚠️ Truyện này đã có rồi.", 'info');
                }
            } else {
                sendTele("❌ Link sai.", 'error');
            }
        }
        
        // --- LỆNH STATUS (SỬA: SO SÁNH BẰNG ROOT) (hotfix v.1.1.2)---
        else if (command === '/status') {
            let st = isAutoRunning() ? "ON 🟢" : "OFF 🔴";
            let list = getStoryList();
            let currentRoot = getStoryRoot(location.href);
            
            // Tìm vị trí dựa trên Gốc Truyện
            let listIndex = list.findIndex(savedUrl => getStoryRoot(savedUrl) === currentRoot);
            
            let statusStr = "";
            if (list.length === 0) statusStr = "0/0 (Trống)";
            else if (listIndex !== -1) statusStr = `${listIndex + 1}/${list.length}`;
            else statusStr = "Ngoại lai (Chưa lưu)";

            sendTele(`📊 <b>STATUS:</b> ${st}\nTruyện: ${statusStr}\nLỗi liên tiếp: ${getErrorStreak()}`, 'info');
        }

        // --- LỆNH LIST (SỬA: HIỂN THỊ MŨI TÊN ĐÚNG) ---
        else if (command === '/list') {
            let list = getStoryList();
            let currentUrl = location.href;
            let msg = "📋 <b>List Truyện:</b>\n";
            list.forEach((l, i) => {
                // So sánh tương đối
                let isCurrent = currentUrl.includes(l);
                msg += `${isCurrent ? '👉 ' : ''}#${i + 1}: ${l}\n`;
            });
            if(list.length===0) msg += "(Trống)";
            sendTele(msg, 'info');
        }

        // --- CÁC LỆNH KHÁC (GIỮ NGUYÊN) ---
        else if (command === '/help') {
            sendTele("📜 <b>MENU:</b>\n/status, /start, /stop, /f5\n/add [link], /list, /del [số], /swap [số]\n/sleep [phút], /wake", 'info');
        }
        else if (command === '/f5') location.reload();
        else if (command === '/stop') { localStorage.setItem('stv_auto_farm', 'false'); sendTele("🛑 STOP", 'info', ()=>location.reload()); }
        else if (command === '/start') { localStorage.setItem('stv_auto_farm', 'true'); sendTele("✅ START", 'info', ()=>location.reload()); }
        else if (command === '/swap') { swapToSpecificStory(parseInt(parts[1]) - 1); }
        else if (command === '/del') { 
            if(removeStory(parseInt(parts[1]) - 1)) sendTele("🗑️ Đã xóa.", 'info'); 
            else sendTele("❌ Số sai.", 'error');
        }
        else if (command === '/sleep') { activateSleep(parseInt(parts[1])||30, "Lệnh User"); }
        else if (command === '/wake') { setSleepUntil(0); localStorage.setItem('stv_auto_farm', 'true'); sendTele("☀️ Dậy!", 'info', ()=>location.reload()); }
    }

    // --- 4. QUẢN LÝ LIST & LỖI ---
    function addStory(url) {
        let list = getStoryList();
        // Check trùng lặp (đơn giản)
        if (list.some(u => u === url)) return false;
        list.push(url); saveStoryList(list); return true;
    }
    function removeStory(index) {
        let list = getStoryList();
        if (index >= 0 && index < list.length) {
            list.splice(index, 1); saveStoryList(list);
            if (getCurrentStoryIndex() >= list.length) setCurrentStoryIndex(0);
            return true;
        } return false;
    }
    function swapToNextStory(reason) {
        let list = getStoryList();
        if (list.length === 0) { sendTele(`⚠️ ${reason} -> List trống!`, 'error'); return; }
        let nextIndex = getCurrentStoryIndex() + 1;
        if (nextIndex >= list.length) nextIndex = 0;
        setCurrentStoryIndex(nextIndex);
        sendTele(`🔄 <b>${reason}</b>\nQua #${nextIndex + 1}`, 'info', ()=> location.href = list[nextIndex]);
    }
    function swapToSpecificStory(index) {
        let list = getStoryList();
        if (index >= 0 && index < list.length) {
            setCurrentStoryIndex(index); resetErrorStreak();
            sendTele(`🔀 Swap #${index + 1}`, 'info', ()=> location.href = list[index]);
        } else { sendTele("❌ Index sai.", 'error'); }
    }
    function activateSleep(minutes, reason) {
        let wakeTime = Date.now() + (minutes * 60 * 1000);
        setSleepUntil(wakeTime); resetErrorStreak();
        let wakeDate = new Date(wakeTime).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'});
        sendTele(`💤 <b>NGỦ (${minutes}p)</b>\nLý do: ${reason}\nDậy: ${wakeDate}`, 'error', ()=>location.reload());
    }
    function handleStoryError(reason) {
        let list = getStoryList(); increaseErrorStreak(); let streak = getErrorStreak();
        if (list.length > 0 && streak >= list.length) activateSleep(CONFIG.sleepTimeOnError, "Toàn bộ list lỗi.");
        else swapToNextStory(`${reason} (Lỗi ${streak})`);
    }

    // --- 5. LOGIC GIAO DIỆN & LỖI ---
    const handleAlert = (msg) => {
        if (msg && (msg.includes("thất bại") || msg.includes("rescan"))) { location.reload(); return true; }
        if (msg && (msg.includes("tự khắc phục") || msg.includes("không cần báo lỗi"))) { handleStoryError("Lỗi Server"); return true; }
        return false;
    };
    const originalAlert = win.alert;
    win.alert = function(msg) { if (handleAlert(msg)) return; return originalAlert(msg); };
    const originalConfirm = win.confirm;
    win.confirm = function(msg) { if (handleAlert(msg)) return true; return originalConfirm(msg); };

    function checkSleepMode() {
        let sleepUntil = getSleepUntil();
        if (Date.now() < sleepUntil) {
            document.body.innerHTML = ""; document.body.style.background = "#222"; document.body.style.color = "#fff";
            document.body.style.display = "flex"; document.body.style.flexDirection = "column";
            document.body.style.justifyContent = "center"; document.body.style.alignItems = "center"; document.body.style.height = "100vh";
            let h1 = document.createElement("h1"); h1.innerText = "💤 NGỦ ĐÔNG";
            let h2 = document.createElement("h2"); h2.id = "sleep-timer";
            let p = document.createElement("p"); p.innerText = "Chat /wake để gọi dậy.";
            document.body.appendChild(h1); document.body.appendChild(h2); document.body.appendChild(p);
            
            setInterval(() => {
                let left = Math.ceil((sleepUntil - Date.now())/1000);
                if(left <= 0) { setSleepUntil(0); location.reload(); }
                else {
                    let m = Math.floor(left/60); let s = left%60;
                    document.getElementById('sleep-timer').innerText = `${m}p ${s}s`;
                }
                checkRemoteCommands();
            }, 2000);
            return true;
        }
        return false;
    }

    //Click manual if it doesn't load automatically
    function tryClickManualLoad() {
        // Tìm các thẻ có khả năng chứa dòng chữ đó
        let candidates = document.querySelectorAll('div, span, a, p, b, i');
        for (let el of candidates) {
            // Chỉ check những thẻ đang hiển thị
            if (el.offsetParent === null) continue;

            let text = el.innerText.toLowerCase();
            if (text.includes("nhấp vào để tải") || text.includes("bấm để tải") || text.includes("click để tải")) {
                console.log("STV: Phát hiện nút tải thủ công -> Click!");
                showToast("🖱️ Kích hoạt tải chương...", "#2196F3");
                el.click();
                return true;
            }
        }
        return false;
    }

    function startVisualMonitor() {
        if (!isAutoRunning()) return;

        // Check Mục lục -> Hết truyện
        if (location.href.endsWith('/0/') || location.href.includes('/0/')) {
            resetErrorStreak();
            swapToNextStory("Hết chương (Về mục lục)");
            return;
        }

        showToast("👁️ Đang giám sát...", "#999");
        
        let monitor = setInterval(() => {
            let bodyText = document.body.innerText || "";

            // 1. Check lỗi Server (để Swap)
            if (bodyText.includes("tự khắc phục") || bodyText.includes("không cần báo lỗi")) {
                clearInterval(monitor);
                handleStoryError("Lỗi Server (Text)");
                return;
            }

            // 2. Check lỗi Tải thất bại (để F5)
            if (bodyText.includes("Tải chương thất bại")) {
                clearInterval(monitor); 
                location.reload(); 
                return;
            }

            // 3. [MỚI] Check xem có phải bấm tay để tải không?
            if (bodyText.includes("nhấp vào để tải") || bodyText.includes("bấm để tải")) {
                // Gọi hàm click ngay
                tryClickManualLoad();
                // Không return, để vòng lặp tiếp tục check xem tải xong chưa
            }

            // 4. Check đang loading
            if (bodyText.includes("Đang tải nội dung") || bodyText.includes("Loading")) {
                // Vẫn đang xoay -> Đợi tiếp
                return; 
            }

            // 5. Check Tải Xong (Có nội dung hoặc nút Next)
            let hasContent = bodyText.length > 500; 
            let hasNextBtn = document.querySelector('.fa-arrow-right') || Array.from(document.querySelectorAll('a')).some(a => a.innerText.includes("Chương sau"));

            if (hasContent || hasNextBtn) {
                clearInterval(monitor);
                resetErrorStreak(); 
                runFarmingLogic(); // Vào việc
            }
        }, 500);
    }

    // --- 6. LOGIC CÀY ĐỒ (DIRECT CALL) ---
    function readAndClosePopup() {
        let attempts = 0;
        let reader = setInterval(() => {
            attempts++;
            let allPopups = document.querySelectorAll('.bootbox-body, .modal-body');
            let targetPopup = null;
            for (let popup of allPopups) {
                if (popup.offsetParent === null) continue;
                let txt = popup.innerText || "";
                if (txt.includes("Thêm name") || txt.includes("Tiếng Trung") || txt.includes("Hán Việt")) continue;
                targetPopup = popup; break;
            }
            if (targetPopup) {
                clearInterval(reader);
                let itemName = targetPopup.innerText.split('\n')[0].trim();
                sendTele(`<b>${itemName}</b>\n---\n${targetPopup.innerText}`, 'success', ()=>destroyPopup());
                return;
            }
            if (attempts > 40) { clearInterval(reader); destroyPopup(); }
        }, 100);
    }

    function destroyPopup() {
        let buttons = document.querySelectorAll('.bootbox .btn, .modal-footer .btn, button.btn-danger');
        for (let b of buttons) b.click();
        setTimeout(() => {
             document.querySelectorAll('.bootbox, .modal, .modal-backdrop').forEach(e => e.remove());
             document.body.classList.remove('modal-open');
        }, 500);
    }

    function executeDirectCall() {
        showToast("🚀...", "#FF9800");
        if (typeof win.tryCollect === 'function') win.tryCollect(true);
        setTimeout(() => {
            let btn = null;
            let allBtns = document.querySelectorAll('i.btn.btn-info');
            for(let b of allBtns) if(b.innerText.includes("Nhặt")) { btn = b; break; }
            if (btn) {
                let funcName = btn.id; 
                if (funcName && typeof win[funcName] === 'function') {
                    win[funcName](); showToast("✅...", "#4CAF50"); readAndClosePopup();
                }
                setPendingCollect('false');
            } else { setPendingCollect('false'); }
        }, 500);
    }

    function runFarmingLogic() {
        createControlPanel();
        if (isPendingCollect()) { executeDirectCall(); startCountdown(); return; }
        let xhr = new XMLHttpRequest();
        xhr.open('POST', '/index.php?ngmar=iscollectable', true);
        xhr.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
        xhr.onreadystatechange = function() {
            if (xhr.readyState == 4 && xhr.status == 200) {
                try {
                    let res = JSON.parse(xhr.responseText);
                    if (res.code == 1) {
                        showToast("⚡ F5...", "#FF9800");
                        setPendingCollect('true'); location.reload(); return;
                    } else { showToast("🌑", "#555"); }
                } catch(e) {}
                startCountdown();
            }
        };
        xhr.send("ngmar=tcollect&sajax=trycollect");
    }

    function goToNextChapter() {
        let nextUrl = null;
        let links = document.querySelectorAll('a');
        for (let link of links) { if (link.innerText.toLowerCase().includes("chương sau") || link.innerText.toLowerCase().includes("tiếp")) { nextUrl = link.href; break; } }
        if (!nextUrl) { let icon = document.querySelector('.fa-arrow-right'); if (icon && icon.parentNode.tagName === 'A') nextUrl = icon.parentNode.href; }
        if (nextUrl) { showToast("🚀", "#2196F3"); location.href = nextUrl; }
        else { swapToNextStory("Không tìm thấy Next"); }
    }

    function startCountdown() {
        if (!isAutoRunning()) return;
        let time = Math.floor(Math.random() * (CONFIG.maxWait - CONFIG.minWait) + CONFIG.minWait);
        let seconds = Math.floor(time / 1000);
        let btn = document.getElementById('stv-auto-btn');
        let countdown = setInterval(() => {
            if(btn) btn.innerText = `⏳ ${seconds}s`;
            seconds--;
            if (seconds < 0) { clearInterval(countdown); goToNextChapter(); }
        }, 1000);
    }

    function createControlPanel() {
        if(document.getElementById('stv-panel')) return;
        let panel = document.createElement('div'); panel.id = 'stv-panel';
        panel.style.cssText = `position: fixed; bottom: 80px; right: 20px; z-index: 999999; display: flex; gap: 5px;`;
        let testBtn = document.createElement('div'); testBtn.innerText = "TEST";
        testBtn.style.cssText = `padding: 10px; border-radius: 8px; font-family: Arial; font-size: 12px; font-weight: bold; cursor: pointer; background: #2196F3; color: white; box-shadow: 0 4px 8px rgba(0,0,0,0.3);`;
        testBtn.onclick = function() { sendTele("🔔 OK!", 'info'); };
        let autoBtn = document.createElement('div'); autoBtn.id = 'stv-auto-btn';
        autoBtn.style.cssText = `padding: 10px; border-radius: 8px; font-family: Arial; font-size: 14px; font-weight: bold; cursor: pointer; box-shadow: 0 4px 8px rgba(0,0,0,0.5);`;
        if (isAutoRunning()) { autoBtn.innerText = "🤖 ON"; autoBtn.style.background = "#28a745"; autoBtn.style.color = "white"; } 
        else { autoBtn.innerText = "😴 OFF"; autoBtn.style.background = "#333"; autoBtn.style.color = "#bbb"; }
        autoBtn.onclick = function() {
            let s = !isAutoRunning(); localStorage.setItem('stv_auto_farm', s);
            sendTele(s?"🤖 ON":"😴 OFF", 'info', ()=>location.reload());
        };
        panel.appendChild(testBtn); panel.appendChild(autoBtn); document.body.appendChild(panel);
    }

    function showToast(msg, color) {
        if(!document.body) return;
        let c = document.getElementById('stv-toast');
        if (!c) { c = document.createElement('div'); c.id = 'stv-toast'; c.style.cssText = "position:fixed; bottom:20px; right:20px; z-index:99999; display:flex; flex-direction:column-reverse; gap:5px; pointer-events:none;"; document.body.appendChild(c); }
        let t = document.createElement('div'); t.innerText = msg;
        t.style.cssText = `background:rgba(0,0,0,0.85); color:#fff; padding:8px 12px; border-radius:5px; border-left:4px solid ${color}; font-family:Arial; font-size:12px; animation:fadeIn 0.3s;`;
        c.appendChild(t); setTimeout(() => t.remove(), 3000);
    }
    let css = document.createElement('style');
    css.textContent = "@keyframes fadeIn { from { opacity:0; transform:translateX(20px); } to { opacity:1; transform:translateX(0); } }";
    (document.head || document.documentElement).appendChild(css);

    window.addEventListener('load', () => {
        if (checkSleepMode()) return;
        createControlPanel();
        startVisualMonitor();
        
        // Nhớ chương mỗi khi load(hotfix v1.1.2)
        updateCurrentChapterToStorage

        //Default listen time for remote commands: 5s
        setInterval(checkRemoteCommands, 5000);
    });
})();
