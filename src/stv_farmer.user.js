// ==UserScript==
// @name         STV Auto Farmer
// @namespace    http://tampermonkey.net/
// @version      v1.0.0
// @description  Auto cày + nhặt vật phẩm + gửi thông tin qua tele.
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

    // --- 1. ĐIỀN THÔNG TIN ---
    const TELEGRAM_TOKEN = 'your_token_here';
    const TELEGRAM_CHAT_ID = 'your_chat_id_here';

    // --- 2. CẤU HÌNH ---
    const CONFIG = { minWait: 12000, maxWait: 15000 };

    const win = unsafeWindow;

    // --- HÀM GỬI TELEGRAM ---
    function sendTele(msg, type = 'info', callback = null) {
        if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID || TELEGRAM_TOKEN.includes('ĐIỀN_')) {
            if(callback) callback(); return;
        }
        let icon = type === 'success' ? '🎁' : (type === 'error' ? '🚨' : 'ℹ️');
        let time = new Date().toLocaleTimeString('vi-VN', { hour12: false });
        let chapterInfo = document.title.replace(' - Sáng Tác Việt', '').trim();
        let finalMsg = `${icon} <b>[${time}]</b>\n${msg}\n📖 <i>${chapterInfo}</i>`;

        GM_xmlhttpRequest({
            method: "POST",
            url: `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
            data: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: finalMsg, parse_mode: "HTML", disable_web_page_preview: true }),
            headers: { "Content-Type": "application/json" },
            onload: function() { if(callback) callback(); },
            onerror: function() { if(callback) callback(); }
        });
    }

    // --- CHẶN ALERT LỖI ---
    const originalAlert = win.alert;
    win.alert = function(msg) {
        if (msg && (msg.includes("thất bại") || msg.includes("rescan"))) {
            location.reload(); return true;
        }
        return originalAlert(msg);
    };

    // --- QUẢN LÝ TRẠNG THÁI ---
    function isAutoRunning() { return localStorage.getItem('stv_auto_farm') === 'true'; }
    function toggleAuto() {
        let newState = !isAutoRunning();
        localStorage.setItem('stv_auto_farm', newState);
        let statusMsg = newState ? "🤖 Auto: ĐÃ BẬT" : "😴 Auto: ĐÃ TẮT";
        let btn = document.getElementById('stv-auto-btn');
        if(btn) btn.innerText = "⏳...";

        sendTele(statusMsg, 'info', function() { location.reload(); });
        setTimeout(() => location.reload(), 3000);
    }
    function isPendingCollect() { return localStorage.getItem('stv_pending_collect') === 'true'; }
    function setPendingCollect(status) { localStorage.setItem('stv_pending_collect', status); }

    // --- UI ---
    function createControlPanel() {
        if(document.getElementById('stv-panel')) return;
        let panel = document.createElement('div'); panel.id = 'stv-panel';
        panel.style.cssText = `position: fixed; bottom: 80px; right: 20px; z-index: 999999; display: flex; gap: 5px;`;

        let testBtn = document.createElement('div');
        testBtn.innerText = "TEST TELE";
        testBtn.style.cssText = `padding: 10px; border-radius: 8px; font-family: Arial; font-size: 12px; font-weight: bold; cursor: pointer; background: #2196F3; color: white; box-shadow: 0 4px 8px rgba(0,0,0,0.3);`;
        testBtn.onclick = function() { sendTele("🔔 Test Connection OK!", 'info'); };

        let autoBtn = document.createElement('div'); autoBtn.id = 'stv-auto-btn';
        autoBtn.style.cssText = `padding: 10px; border-radius: 8px; font-family: Arial; font-size: 14px; font-weight: bold; cursor: pointer; box-shadow: 0 4px 8px rgba(0,0,0,0.5);`;
        if (isAutoRunning()) { autoBtn.innerText = "🤖 ON"; autoBtn.style.background = "#28a745"; autoBtn.style.color = "white"; }
        else { autoBtn.innerText = "😴 OFF"; autoBtn.style.background = "#333"; autoBtn.style.color = "#bbb"; }
        autoBtn.onclick = toggleAuto;

        panel.appendChild(testBtn); panel.appendChild(autoBtn);
        document.body.appendChild(panel);
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

    // --- MONITOR ---
    function startVisualMonitor() {
        if (!isAutoRunning()) return;
        showToast("👁️...", "#999");
        let monitor = setInterval(() => {
            let bodyText = document.body.innerText || "";
            if (bodyText.includes("Tải chương thất bại") || bodyText.includes("thử rescan")) {
                clearInterval(monitor); location.reload(); return;
            }
            if (bodyText.includes("Đang tải nội dung") || bodyText.includes("Loading")) return;
            let hasContent = bodyText.length > 500;
            let hasNextBtn = document.querySelector('.fa-arrow-right') || Array.from(document.querySelectorAll('a')).some(a => a.innerText.includes("Chương sau"));
            if (hasContent || hasNextBtn) { clearInterval(monitor); runFarmingLogic(); }
        }, 500);
    }

    // --- [FIXED] ĐỌC POPUP CHUẨN ---
    function readAndClosePopup() {
        let attempts = 0;
        let reader = setInterval(() => {
            attempts++;

            // Lấy TẤT CẢ các popup
            let allPopups = document.querySelectorAll('.bootbox-body, .modal-body');
            let targetPopup = null;

            for (let popup of allPopups) {
                // 1. Bỏ qua popup ẩn (không hiển thị)
                if (popup.offsetParent === null) continue;

                // 2. Bỏ qua popup chứa từ khóa "rác" (Chỉnh name, dịch thuật)
                let txt = popup.innerText || "";
                if (txt.includes("Thêm name") || txt.includes("Tiếng Trung") || txt.includes("Hán Việt")) {
                    continue;
                }

                // Đây là popup vật phẩm!
                targetPopup = popup;
                break;
            }

            if (targetPopup) {
                clearInterval(reader);

                // Tìm tiêu đề trong popup đó (nếu có)
                let parent = targetPopup.closest('.modal-content') || targetPopup.parentElement;
                let titleEl = parent.querySelector('.modal-title, h4, b');

                let itemName = titleEl ? titleEl.innerText.trim() : "";
                let fullText = targetPopup.innerText.trim();

                // Nếu không có title, lấy dòng đầu làm tên
                if (!itemName) itemName = fullText.split('\n')[0].trim();

                // Gửi Tele
                sendTele(`<b>${itemName}</b>\n----------------\n${fullText}`, 'success', function() {
                    destroyPopup();
                });
                return;
            }

            if (attempts > 40) {
                clearInterval(reader);
                // Không đọc được thì thôi, vẫn phải đóng để chạy tiếp
                destroyPopup();
            }
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

    // --- GỌI HÀM TRỰC TIẾP ---
    function executeDirectCall() {
        showToast("🚀 Húp...", "#FF9800");
        if (typeof win.tryCollect === 'function') win.tryCollect(true);

        setTimeout(() => {
            let btn = null;
            let allBtns = document.querySelectorAll('i.btn.btn-info');
            for(let b of allBtns) if(b.innerText.includes("Nhặt")) { btn = b; break; }
            if (btn) {
                let funcName = btn.id;
                if (funcName && typeof win[funcName] === 'function') {
                    win[funcName]();
                    showToast("✅ Đã gọi! Đọc...", "#4CAF50");
                    readAndClosePopup();
                }
                setPendingCollect('false');
            } else { setPendingCollect('false'); }
        }, 500);
    }

    // --- MAIN ---
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
                    } else { showToast("🥲", "#555"); }
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
        else { setTimeout(() => location.reload(), 3000); }
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

    window.addEventListener('load', () => {
        createControlPanel();
        startVisualMonitor();
    });
})();