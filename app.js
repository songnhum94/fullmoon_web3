/* ===========================
 * Full Moon Loy Krathong - App.js
 * ปรับปรุง: Audio hardening (MetaMask/iOS), ผูก gesture จริง, โครง Wallet/Ranking/UI
 * =========================== */
document.addEventListener('DOMContentLoaded', async () => {
  /* ---------------------------
   * อ้างอิง DOM หลัก
   * --------------------------- */
  const connectWalletBtn = document.getElementById('connect-wallet-btn');     // :contentReference[oaicite:0]{index=0}
  const buyButtons       = document.querySelectorAll('.buy-btn');             // :contentReference[oaicite:1]{index=1}
  const donateBtn        = document.getElementById('donate-btn');             // :contentReference[oaicite:2]{index=2}
  const floatCountEl     = document.getElementById('float-count');            // :contentReference[oaicite:3]{index=3}
  const riverContainer   = document.getElementById('river-simulation');       // :contentReference[oaicite:4]{index=4}
  const riverVideo       = document.querySelector('.river-video-bg');         // :contentReference[oaicite:5]{index=5}
  const bgMusic          = document.getElementById('bg-music');               // :contentReference[oaicite:6]{index=6}

  // Modal ใส่คำอธิษฐาน
  const wishModal        = document.getElementById('wish-modal');             // :contentReference[oaicite:7]{index=7}
  const wishInput        = document.getElementById('wish-input');             // :contentReference[oaicite:8]{index=8}
  const cancelWishBtn    = document.getElementById('cancel-wish-btn');        // :contentReference[oaicite:9]{index=9}
  const submitWishBtn    = document.getElementById('submit-wish-btn');        // :contentReference[oaicite:10]{index=10}

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

  function updateWalletStatus(addr) {
    currentWalletAddress = addr;
    if (connectWalletBtn) {
      connectWalletBtn.textContent = `🔌 ยกเลิกการเชื่อมต่อ (${mask(addr)})`;
      connectWalletBtn.style.backgroundColor = '#00c853';
    }
    ensureUserInRanking(addr);
    renderRankingList();
  }

  function resetWalletStatus() {
    currentWalletAddress = null;
    if (connectWalletBtn) {
      connectWalletBtn.textContent = '🔗 เชื่อมต่อ Wallet';
      connectWalletBtn.style.backgroundColor = '#2962ff';
    }
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

  // ปุ่มเชื่อมต่อ = ใช้เป็น "gesture จริง" เพื่อเรียก enableSound()
  connectWalletBtn?.addEventListener('click', async () => {
    enableSound(); // สำคัญ: ผูกเสียงกับปุ่มจริง
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
   * 4) Ranking (เก็บ localStorage เดโม่)
   * =========================== */
  const R_KEY = 'fm_ranking_v1';

  function getRanking() {
    try {
      return JSON.parse(localStorage.getItem(R_KEY) || '[]');
    } catch { return []; }
  }

  function setRanking(data) {
    localStorage.setItem(R_KEY, JSON.stringify(data));
  }

  function ensureUserInRanking(addr) {
    if (!addr) return;
    const arr = getRanking();
    const i = arr.findIndex(x => x.address.toLowerCase() === addr.toLowerCase());
    if (i === -1) {
      arr.push({ address: addr, total: 0, last: null });
      setRanking(arr);
    }
  }

  function addContribution(addr, amount, tier, wish) {
    const arr = getRanking();
    const i = arr.findIndex(x => x.address.toLowerCase() === addr.toLowerCase());
    if (i !== -1) {
      arr[i].total += Number(amount) || 0;
      arr[i].last = { tier, wish, at: Date.now() };
    } else {
      arr.push({ address: addr, total: Number(amount) || 0, last: { tier, wish, at: Date.now() } });
    }
    // จัดอันดับมาก→น้อย
    arr.sort((a, b) => (b.total || 0) - (a.total || 0));
    setRanking(arr);
    renderRankingList();
  }

  function renderRankingList() {
    const list = document.getElementById('ranking-list'); // :contentReference[oaicite:11]{index=11}
    if (!list) return;

    const arr = getRanking();
    const top = Array.from({ length: 5 }).map((_, i) => arr[i] || null);

    list.innerHTML = '';
    top.forEach((item, i) => {
      const p = document.createElement('p');
      p.className = 'rank-item';
      if (item) {
        const medal = i === 0 ? '✨' : i === 1 ? '💫' : i === 2 ? '🌟' : '🕯️';
        p.textContent = `${i + 1}. ${medal} ${mask(item.address)} (${item.total} FM)`;
        p.dataset.address = item.address.toLowerCase();
        p.dataset.level   = item?.last?.tier ?? 1;
        p.dataset.wish    = item?.last?.wish || 'ขอให้มีความสุข';
      } else {
        p.textContent = `${i + 1}. –––––––––––––––––`;
        p.style.opacity = 0.4;
      }
      list.appendChild(p);
    });

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

    // TODO: เชื่อมสัญญาจริงที่นี่ (write tx) แล้วค่อย success
    spawnKrathong(tier, wish);
    krathongCount += 1;
    if (floatCountEl) floatCountEl.textContent = krathongCount.toLocaleString();

    if (currentWalletAddress) addContribution(currentWalletAddress, price, tier, wish);
    closeWishModal();
  });

  donateBtn?.addEventListener('click', () => {
    const amountEl = document.getElementById('donation-amount');
    const amount = Number(amountEl?.value || 0);
    if (!amount || amount <= 0) return;

    // TODO: เชื่อมสัญญาจริง (donate)
    krathongCount += 1;
    if (floatCountEl) floatCountEl.textContent = krathongCount.toLocaleString();

    if (currentWalletAddress) addContribution(currentWalletAddress, amount, 1, 'ร่วมบุญ');
    amountEl.value = '';
  });

  // แรนก์เริ่มต้น
  renderRankingList();

  /* ===========================
   * 6) หมายเหตุ: ตัด body click-unmute เดิมทิ้ง
   *    (เราใช้ enableSound() ผูกกับปุ่มจริงแทน)
   *    โค้ดนี้จงใจ "ไม่" ใส่ document.body.addEventListener('click', ...)
   * =========================== */
});
