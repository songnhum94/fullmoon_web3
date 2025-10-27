/* ===========================
 * Full Moon Loy Krathong - App.js
 * V2.6: แก้ไข: FINAL URL UPDATE
 * =========================== */
document.addEventListener('DOMContentLoaded', async () => {
  /* ---------------------------
   * อ้างอิง DOM หลัก
   * --------------------------- */
  const connectWalletBtn = document.getElementById('connect-wallet-btn');
  const buyButtons       = document.querySelectorAll('.buy-btn');
  const donateBtn        = document.getElementById('donate-btn');
  const floatCountEl     = document.getElementById('float-count');
  const riverContainer   = document.getElementById('river-simulation');
  const riverVideo       = document.querySelector('.river-video-bg');
  const bgMusic          = document.getElementById('bg-music');

  // Modal ใส่คำอธิษฐาน
  const wishModal        = document.getElementById('wish-modal');
  const wishInput        = document.getElementById('wish-input');
  const cancelWishBtn    = document.getElementById('cancel-wish-btn');
  const submitWishBtn    = document.getElementById('submit-wish-btn');

  /* ---------------------------
   * ค่าพื้นฐาน/สถานะ
   * --------------------------- */
  const ASSETS_BASE = './assets/';
  let   ethers;
  let   currentWalletAddress = null;

  // ตัวนับกระทง (เดโม่ ฝั่งหน้าเว็บ)
  let krathongCount = 1234;
  if (floatCountEl) floatCountEl.textContent = krathongCount.toLocaleString();

  // ปรับเสียงสื่อเริ่มต้น
  if (riverVideo) riverVideo.volume = 0.15;
  if (bgMusic)   bgMusic.volume    = 0.07;

  /* ===========================
   * 1) Audio Hardening (แก้เพลงดับบน MetaMask/iOS)
   * =========================== */
  const userAudio = { enabled: false };
  let audioCtx, mediaNode;

  function enableSound() {
    try {
      if (!bgMusic) return;
      userAudio.enabled = true;

      // สร้าง/ปลุก WebAudio
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();

      // ผูก <audio> เข้า WebAudio สักครั้ง
      if (!mediaNode) {
        mediaNode = audioCtx.createMediaElementSource(bgMusic);
        mediaNode.connect(audioCtx.destination);
      }

      // ปลด mute + เล่นซ้ำ
      bgMusic.muted = false;
      bgMusic.loop  = true;
      bgMusic.play().catch(() => { /* เงียบไว้ */ });

      // ปลดเสียงวิดีโอด้วย (ถ้ามี)
      if (riverVideo && riverVideo.muted) {
        riverVideo.muted = false;
        riverVideo.play().catch(() => {});
      }
    } catch (e) {
      console.warn('Audio init fail', e);
    }
  }

  // Auto-resume เมื่อสลับหน้าจอ/กลับมาโฟกัส
  ['visibilitychange', 'pageshow'].forEach(ev => {
    document.addEventListener(ev, () => {
      if (!userAudio.enabled) return;
      if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
      if (bgMusic && bgMusic.paused && document.visibilityState === 'visible') {
        bgMusic.play().catch(() => {});
      }
    });
  });

  // ถ้าโดน pause เอง ทั้งที่ยังแอคทีฟ ให้เด้งกลับ (ไม่รบกวนถ้าผู้ใช้กดหยุดเอง)
  bgMusic?.addEventListener('pause', () => {
    if (userAudio.enabled && document.visibilityState === 'visible' && bgMusic.paused) {
      bgMusic.play().catch(() => {});
    }
  });

  /* ===========================
   * 2) Wallet (Ethers + MetaMask)
   * =========================== */
  try {
    const ethersModule = await import('https://unpkg.com/ethers@5.7.2/dist/ethers.esm.js');
    ethers = ethersModule.ethers;
  } catch (e) {
    connectWalletBtn && (connectWalletBtn.textContent = '❌ Ethers Error');
    connectWalletBtn && (connectWalletBtn.style.backgroundColor = '#d82d2d');
  }

  function mask(addr) {
    if (!addr) return '';
    return addr.slice(0, 6) + '...' + addr.slice(-4);
  }

  async function connectWallet() {
    if (typeof window.ethereum === 'undefined') {
      alert('โปรดติดตั้ง MetaMask!');
      return;
    }
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const accounts = await provider.send('eth_requestAccounts', []);
      updateWalletStatus(accounts[0]);
    } catch (e) {
      if (e?.code === 4001) alert('ผู้ใช้ปฏิเสธการเชื่อมต่อ');
      resetWalletStatus();
    }
  }

  async function disconnectWallet() {
    try {
      await window.ethereum?.request?.({
        method: 'wallet_revokePermissions',
        params: [{ eth_accounts: {} }]
      });
    } catch {}
    resetWalletStatus();
  }

  function updateWalletStatus(addr) {
    currentWalletAddress = addr;
    if (connectWalletBtn) {
      connectWalletBtn.textContent = `🔌 ยกเลิกการเชื่อมต่อ (${mask(addr)})`;
      connectWalletBtn.style.backgroundColor = '#00c853';
    }
    renderRankingList();
  }

  function resetWalletStatus() {
    currentWalletAddress = null;
    if (connectWalletBtn) {
      connectWalletBtn.textContent = '🔗 เชื่อมต่อ Wallet';
      connectWalletBtn.style.backgroundColor = '#2962ff';
    }
    renderRankingList();
  }

  // ปุ่มเชื่อมต่อ = ใช้เป็น "gesture จริง" เพื่อเรียก enableSound()
  connectWalletBtn?.addEventListener('click', async () => {
    enableSound();
    if (currentWalletAddress) await disconnectWallet();
    else await connectWallet();
  });

  // เริ่มต้น
  resetWalletStatus();
  if (typeof window.ethereum !== 'undefined' && ethers) {
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const accounts = await provider.listAccounts();
      if (accounts.length) updateWalletStatus(accounts[0]);
    } catch (e) {
      console.warn('Could not retrieve accounts on load:', e);
    }
  }
  window.ethereum?.on('accountsChanged', (acc) => {
    acc.length ? updateWalletStatus(acc[0]) : resetWalletStatus();
  });
  window.ethereum?.on('chainChanged', () => resetWalletStatus());

  /* ===========================
   * 3) กระทง 2D + สปอน/ทูลทิป
   * =========================== */
  function imgPathByTier(tier) {
    const t = Math.min(Math.max(Number(tier) || 1, 1), 5);
    return `${ASSETS_BASE}${t}.png`;
  }

  function spawnKrathong(tier, wishText) {
    if (!riverContainer) return;

    const wrap = document.createElement('div');
    wrap.className = 'krathong-2d';

    const img = document.createElement('img');
    img.className = 'krathong-img-inner';
    img.src = imgPathByTier(tier);

    const tooltip = document.createElement('span');
    tooltip.className = 'wish-tooltip';
    tooltip.textContent = wishText || 'ขอให้มีความสุข';

    wrap.appendChild(tooltip);
    wrap.appendChild(img);

    const riverH = riverContainer.clientHeight;
    if (riverH === 0) {
      // กันเคส container ยังไม่คำนวณ layout
      wrap.style.setProperty('--krathong-start-y', `65%`);
    } else {
      const startPct = 0.55, endPct = 0.70; // โซนลอย
      const zone = riverH * (endPct - startPct);
      const startY = riverH * startPct;
      const y = (Math.random() * zone) + startY;
      wrap.style.setProperty('--krathong-start-y', `${y}px`);
    }

    // ความเร็วลอยสุ่มเล็กน้อย
    wrap.style.animationDuration = `${25 + Math.random() * 15}s`;
    riverContainer.appendChild(wrap);
  }


  /* ===========================
   * 5) Modal Flow (ซื้อ/ลอย/บริจาค)
   * =========================== */
  let pendingTier = null;
  let pendingPrice = null;

  function openWishModal(tier, price) {
    pendingTier = tier;
    pendingPrice = price;
    if (wishInput) wishInput.value = '';
    wishModal?.classList.remove('hidden');
  }

  // NOTE: closeWishModal() ถูกเรียกหลังจาก addContribution สำเร็จ
  function closeWishModal() {
    wishModal?.classList.add('hidden');
    pendingTier = null; pendingPrice = null;
  }

  buyButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.krathong-card');
      const tier  = Number(card?.dataset.level || 1);
      const price = Number(card?.dataset.price || 0);
      openWishModal(tier, price);
    });
  });

  cancelWishBtn?.addEventListener('click', closeWishModal);

  submitWishBtn?.addEventListener('click', async () => {
    const wish = (wishInput?.value || 'ขอให้มีความสุข').trim();
    const tier = pendingTier || 1;
    const price = pendingPrice || 0;

    if (!currentWalletAddress) {
        alert('❌ โปรดเชื่อมต่อ Wallet ก่อนลอยกระทง');
        return;
    }
    
    // แสดงผลลัพธ์ทันที (Local Display)
    spawnKrathong(tier, wish);
    krathongCount += 1;
    if (floatCountEl) floatCountEl.textContent = krathongCount.toLocaleString();

    // พยายามบันทึกลง Sheet
    const success = await addContribution(currentWalletAddress, price, tier, wish);
    
    // ปิด Modal หลังการบันทึกข้อมูล
    closeWishModal(); 

    if (success) {
        alert('✅ ลอยกระทงสำเร็จและบันทึกข้อมูลแล้ว!');
    } else {
        alert('❌ ข้อผิดพลาดในการบันทึกข้อมูล: Failed to fetch (โปรดตรวจสอบ Console และ Apps Script URL)');
    }
  });

  donateBtn?.addEventListener('click', async () => {
    const amountEl = document.getElementById('donation-amount');
    const amount = Number(amountEl?.value || 0);
    
    if (!currentWalletAddress) {
        alert('❌ โปรดเชื่อมต่อ Wallet ก่อนบริจาค');
        return;
    }
    if (!amount || amount <= 0) return;

    // แสดงผลลัพธ์ทันที (Local Display)
    krathongCount += 1;
    if (floatCountEl) floatCountEl.textContent = krathongCount.toLocaleString();

    // พยายามบันทึกลง Sheet
    const success = await addContribution(currentWalletAddress, amount, 1, 'ร่วมบุญ');
    amountEl.value = '';

    if (success) {
        alert('✅ บริจาคสำเร็จและบันทึกข้อมูลแล้ว!');
    } else {
        alert('❌ ข้อผิดพลาดในการบันทึกข้อมูล: Failed to fetch (โปรดตรวจสอบ Console และ Apps Script URL)');
    }
  });

  /* ===========================
   * 4) Ranking (เชื่อม Google Sheet API และ Your Rank)
   * NOTE: บล็อกโค้ดถูกย้ายมาอยู่ส่วนท้ายเพื่อแก้ ReferenceError
   * =========================== */
  const R_KEY = 'fm_ranking_v1';
  // *** URL ของ Google Apps Script ที่ Deploy ไว้ (อัปเดตแล้ว) ***
  const RANKING_API_URL = 'https://script.google.com/macros/s/AKfycbzynPwkoLkWI2_dcGeFvingXqtuWCTW50iY4lfDnGab-Plty8SE92FF9lWfDDKkIQJ4tg/exec'; 


  async function getRanking() {
    const cacheBuster = Date.now();
    const fetchUrl = `${RANKING_API_URL}?cachebust=${cacheBuster}`;

    if (RANKING_API_URL === 'https://script.google.com/macros/s/AKfycbzfXy1YY022DPpaDBLRrjCAG50P-t5GzG4Vhp6PX-8wHpNyji-uHor028nNmieFP3rRNw/exec') {
      console.warn("'https://script.google.com/macros/s/AKfycbzfXy1YY022DPpaDBLRrjCAG50P-t5GzG4Vhp6PX-8wHpNyji-uHor028nNmieFP3rRNw/exec'");
      try {
        return JSON.parse(localStorage.getItem(R_KEY) || '[]');
      } catch { return []; }
    }

    try {
      const response = await fetch(fetchUrl);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const data = await response.json();
      
      // Fallback check: If API returns empty and local storage has data, prefer API data structure.
      if (data.length === 0 && localStorage.getItem(R_KEY)) {
           console.warn("API returned empty data. Returning API data structure (empty) to avoid mixing with old local data.");
           return data;
      }
      return data; // ข้อมูลที่เรียงแล้วมาจาก Apps Script

    } catch (e) {
      console.error('Failed to fetch ranking from API:', e);
      // กรณีดึง API ล้มเหลว ให้กลับไปใช้ข้อมูล localStorage เดิม (Fallback)
      try {
        const localData = JSON.parse(localStorage.getItem(R_KEY) || '[]');
        console.warn('Fallback to local storage data for rendering.');
        return localData;
      } catch { 
        return []; 
      }
    }
  }

  async function addContribution(addr, amount, tier, wish) {
    const payload = {
        address: addr,
        amount: amount,
        tier: tier,
        wish: wish
    };
    
    // NOTE: ไม่จำเป็นต้องเช็ค INSERT_YOUR_NEWLY_DEPLOYED_WEB_APP_URL_HERE/exec อีกแล้ว
    // เพราะค่าถูกแทนที่แล้ว และจะเข้าสู่ try/catch block ทันที
    
    try {
        const response = await fetch(RANKING_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });
        
        const result = await response.json();

        if (!response.ok || result.status === 'error') {
            console.error('API POST Error:', result.message || 'Unknown error');
            // Fallback: หาก API ล้มเหลว ให้บันทึกใน localStorage ชั่วคราว (เพื่อรักษา Your Rank)
            const arr = await getRanking();
            const currentList = Array.isArray(arr) ? arr : [];
            const existingIndex = currentList.findIndex(x => x.address.toLowerCase() === addr.toLowerCase());

            if (existingIndex !== -1) {
                currentList[existingIndex].total += Number(amount) || 0;
                currentList[existingIndex].last = { tier, wish, timestamp: Date.now() };
            } else {
                currentList.push({ address: addr, total: Number(amount) || 0, last: { tier, wish, timestamp: Date.now() } });
            }
            currentList.sort((a, b) => (b.total || 0) - (b.total || 0));
            localStorage.setItem(R_KEY, JSON.stringify(currentList));
            renderRankingList();
            
            return false;
        }

        // หากสำเร็จ ให้อัปเดต Ranking List ใหม่
        renderRankingList();
        return true;
        
    } catch (e) {
        console.error('Failed to send contribution to Google Sheet:', e);
        // Fallback: หาก API ล้มเหลว ให้บันทึกใน localStorage ชั่วคราว (เพื่อรักษา Your Rank)
        const arr = await getRanking();
        const currentList = Array.isArray(arr) ? arr : [];
        const existingIndex = currentList.findIndex(x => x.address.toLowerCase() === addr.toLowerCase());

        if (existingIndex !== -1) {
            currentList[existingIndex].total += Number(amount) || 0;
            currentList[existingIndex].last = { tier, wish, timestamp: Date.now() };
        } else {
            currentList.push({ address: addr, total: Number(amount) || 0, last: { tier, wish, timestamp: Date.now() } });
        }
        currentList.sort((a, b) => (b.total || 0) - (b.total || 0));
        localStorage.setItem(R_KEY, JSON.stringify(currentList));
        renderRankingList();
        
        return false; // แจ้งว่าการบันทึกจริงล้มเหลว
    }
  }


  // ฟังก์ชันช่วยสร้าง Element
  function createRankElement(item, rank, isUser) {
    const p = document.createElement('p');
    p.className = 'rank-item';
    if (item) {
        const medal = rank === 1 ? '✨' : rank === 2 ? '💫' : rank === 3 ? '🌟' : '🕯️';
        p.textContent = `${rank}. ${medal} ${mask(item.address)} (${item.total} FM)`;
        p.dataset.address = item.address.toLowerCase();
        p.dataset.level   = item?.last?.tier ?? 1;
        p.dataset.wish    = item?.last?.wish || 'ขอให้มีความสุข';

        if (isUser) {
            p.classList.add('is-user-rank');
            // แก้ข้อความให้ชัดเจนเมื่อเป็น Your Rank
            p.textContent = `${rank}. 👤 ${mask(item.address)} (Your Rank! | ${item.total} FM)`; 
        }
    } else {
        p.textContent = `${rank}. –––––––––––––––––`;
        p.style.opacity = 0.4;
    }
    return p;
  }

  async function renderRankingList() {
    const list = document.getElementById('ranking-list');
    if (!list) return;

    // ดึงข้อมูล Ranking
    const allRanks = await getRanking(); 
    
    // 1. กรอง Top 5
    const top = allRanks.slice(0, 5); 
    list.innerHTML = '';
    
    // 2. แสดง Top 5 ทั้งหมด
    top.forEach((item, i) => {
        const rank = i + 1;
        // ตรวจสอบว่าผู้ใช้ที่เชื่อมต่ออยู่ใน Top 5 หรือไม่
        const isCurrentUser = item && currentWalletAddress && item.address.toLowerCase() === currentWalletAddress.toLowerCase();
        
        const p = createRankElement(item, rank, isCurrentUser);
        list.appendChild(p);
    });

    // 3. แสดง 'Your Rank' หากไม่อยู่ใน Top 5 และมีการเชื่อมต่อ Wallet
    if (currentWalletAddress) {
        const userIndex = allRanks.findIndex(x => x.address.toLowerCase() === currentWalletAddress.toLowerCase());
        
        // ถ้าอยู่ใน Ranking และอยู่นอก Top 5
        if (userIndex !== -1 && userIndex >= 5) {
            const userRankData = allRanks[userIndex];
            const userRank = userIndex + 1;
            
            // ตัวแบ่ง (ใช้สไตล์จาก style.css)
            const divider = document.createElement('p');
            divider.className = 'ranking-divider';
            divider.textContent = `--- ⬇️ Your Rank (อันดับที่ ${userRank}) ⬇️ ---`;
            list.appendChild(divider);

            // รายการอันดับของผู้ใช้
            const userRankItem = createRankElement(userRankData, userRank, true);
            list.appendChild(userRankItem);
        }
    }

    attachRankPreviewHandlers();
  }


  function attachRankPreviewHandlers() {
    const rankItems = document.querySelectorAll('#ranking-list .rank-item');
    let preview = document.getElementById('rank-preview');
    if (!preview) {
      preview = document.createElement('div');
      preview.id = 'rank-preview';
      preview.style.position = 'fixed';
      preview.style.display = 'none';
      preview.style.pointerEvents = 'none';
      preview.style.zIndex = '3000';
      preview.style.transform = 'translate(12px, 12px)';
      preview.style.padding = '8px';
      preview.style.borderRadius = '10px';
      preview.style.background = 'rgba(0,0,0,0.7)';
      preview.style.border = '1px solid var(--neon-blue)';
      preview.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
      preview.innerHTML = `
        <div id="rank-preview-wish" style="margin-bottom:6px;max-width:180px;font-size:.9rem;line-height:1.3;color:#fff;text-align:center;"></div>
        <img alt="krathong preview" style="width:90px;display:block;margin:auto;border-radius:6px;">
      `;
      document.body.appendChild(preview);
    }

    const previewImg  = preview.querySelector('img');
    const previewWish = preview.querySelector('#rank-preview-wish');
    const PAD = 16, BOX_W = 200, BOX_H = 150;

    rankItems.forEach(el => {
      el.onmouseenter = (e) => {
        const level = Number(el.dataset.level || 1);
        const wish  = el.dataset.wish || '';
        previewImg.src = imgPathByTier(level);
        previewWish.textContent = wish;
        preview.style.display = 'block';
      };
      el.onmousemove = (e) => {
        let x = e.clientX + PAD, y = e.clientY + PAD;
        const vw = window.innerWidth, vh = window.innerHeight;
        if (x + BOX_W > vw) x = e.clientX - BOX_W - PAD;
        if (y + BOX_H > vh) y = e.clientY - BOX_H - PAD;
        preview.style.left = `${x}px`;
        preview.style.top  = `${y}px`;
      };
      el.onmouseleave = () => { preview.style.display = 'none'; };
      el.onclick = () => { preview.style.display = 'none'; };
    });
  }
  
  // NOTE: การเรียกใช้เริ่มต้นถูกย้ายมาไว้ที่นี่
  renderRankingList();
});