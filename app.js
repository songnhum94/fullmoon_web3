/* ===========================
 * Full Moon — app.js (ES Module)
 * =========================== */

document.addEventListener('DOMContentLoaded', async () => {
  /* ---------- CONFIG ---------- */
  const ASSETS_BASE = './assets/'; // ถ้ารูปอยู่โฟลเดอร์เดียวกับ index.html ให้เปลี่ยนเป็น './'

  /* ---------- DOM REFS ---------- */
  const connectWalletBtn = document.getElementById('connect-wallet-btn');
  const buyButtons       = document.querySelectorAll('.buy-btn');
  const donateBtn        = document.getElementById('donate-btn');
  const floatCountEl     = document.getElementById('float-count');

  const wishModal     = document.getElementById('wish-modal');
  const wishInput     = document.getElementById('wish-input');
  const submitWishBtn = document.getElementById('submit-wish-btn');
  const cancelWishBtn = document.getElementById('cancel-wish-btn');

  const riverContainer = document.getElementById('river-simulation');
  const riverVideo     = document.querySelector('.river-video-bg');
  const bgMusic        = document.getElementById('bg-music');

  /* ---------- STATE ---------- */
  let currentWalletAddress = null;
  let ethers;
  let krathongCount = 1234;
  if (floatCountEl) floatCountEl.textContent = krathongCount.toLocaleString();

  // สถานะการสั่งลอย/บริจาคผ่านโมดัล
  let pendingKrathongTier  = null;
  let pendingKrathongPrice = 0;
  let pendingDonationAmount= 0;

  /* ===========================
   * Load Ethers + MetaMask
   * =========================== */
  try {
    const ethersModule = await import('https://unpkg.com/ethers@5.7.2/dist/ethers.esm.js');
    ethers = ethersModule.ethers;
  } catch (e) {
    if (connectWalletBtn) {
      connectWalletBtn.textContent = '❌ Ethers Error';
      connectWalletBtn.style.background = '#d82d2d';
    }
    return;
  }

  if (typeof window.ethereum === 'undefined') {
    if (connectWalletBtn) {
      connectWalletBtn.textContent = '🦊 Install MetaMask';
      connectWalletBtn.style.background = '#f76707';
    }
  }

  /* ===========================
   * Wallet Functions
   * =========================== */
  function updateWalletStatus(addr) {
    currentWalletAddress = addr;
    const s = addr.slice(0, 6) + '...' + addr.slice(-4);
    connectWalletBtn.textContent = `🔌 ยกเลิกการเชื่อมต่อ (${s})`;
    connectWalletBtn.style.backgroundColor = '#00c853';

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
        params: [{ eth_accounts: {} }],
      });
    } catch {}
    resetWalletStatus();
  }

  connectWalletBtn?.addEventListener('click', async () => {
    if (currentWalletAddress) await disconnectWallet();
    else await connectWallet();
  });

  // init
  resetWalletStatus();
  try {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const accounts = await provider.listAccounts();
    if (accounts.length) updateWalletStatus(accounts[0]);
  } catch {}

  window.ethereum?.on('accountsChanged', (acc) => {
    acc.length ? updateWalletStatus(acc[0]) : resetWalletStatus();
  });
  window.ethereum?.on('chainChanged', () => resetWalletStatus());

  /* ===========================
   * Media (Video + Audio)
   * =========================== */
  if (riverVideo) riverVideo.volume = 0.2;
  if (bgMusic)    bgMusic.volume    = 0.1;

  function unmuteMediaOnFirstClick() {
    if (riverVideo && riverVideo.muted) { riverVideo.muted = false; riverVideo.play().catch(()=>{}); }
    if (bgMusic && bgMusic.muted)       { bgMusic.muted    = false; bgMusic.play().catch(()=>{}); }
    document.body.removeEventListener('click', unmuteMediaOnFirstClick);
  }
  document.body.addEventListener('click', unmuteMediaOnFirstClick);

  /* ===========================
   * Krathong 2D
   * =========================== */
  function imgPathByTier(tier) {
    const t = Math.min(Math.max(Number(tier)||1, 1), 5);
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

    // ให้ tooltip อยู่ก่อนภาพ (ไม่เกี่ยวกับ preview box)
    wrap.appendChild(tooltip);
    wrap.appendChild(img);

    const riverH = riverContainer.clientHeight;
    const startPct = 0.55, endPct = 0.70;
    const zone = riverH * (endPct - startPct);
    const startY = riverH * startPct;
    const y = (Math.random() * zone) + startY;
    wrap.style.setProperty('--krathong-start-y', `${y}px`);

    wrap.style.animationDuration = `${25 + Math.random() * 15}s`;
    riverContainer.appendChild(wrap);
  }

  /* ===========================
   * Modal & Buttons
   * =========================== */
  function closeModal() {
    wishInput.value = '';
    wishModal.classList.add('hidden');
    pendingKrathongTier  = null;
    pendingKrathongPrice = 0;
    pendingDonationAmount= 0;
  }

  buyButtons.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      if (!currentWalletAddress) { alert('โปรดเชื่อมต่อ Wallet ก่อนทำการลอยกระทง'); return; }
      const card  = e.target.closest('.krathong-card');
      const tier  = card.dataset.level;
      const price = Number(card.dataset.price || 0);

      pendingKrathongTier  = tier;
      pendingKrathongPrice = price;
      pendingDonationAmount= 0;

      wishModal.classList.remove('hidden');
      wishInput.focus();
    });
  });

  cancelWishBtn?.addEventListener('click', closeModal);

  donateBtn?.addEventListener('click', () => {
    if (!currentWalletAddress) { alert('โปรดเชื่อมต่อ Wallet ก่อนทำการบริจาค'); return; }
    const amount = Number(document.getElementById('donation-amount')?.value || 0);
    if (amount <= 0) { alert('โปรดระบุจำนวน FM ที่ต้องการบริจาค'); return; }

    pendingDonationAmount = amount;
    pendingKrathongTier   = null;
    pendingKrathongPrice  = 0;

    wishModal.classList.remove('hidden');
    wishInput.focus();
  });

  submitWishBtn?.addEventListener('click', () => {
    const wishText  = wishInput.value.trim();
    const finalWish = wishText === '' ? 'ขอให้มีความสุข' : wishText;

    if (pendingDonationAmount > 0) {
      const randomTier = Math.floor(Math.random() * 5) + 1;
      spawnKrathong(randomTier, finalWish);
      alert(`เดโมธุรกรรม: บริจาค ${pendingDonationAmount} FM`);
      addToRankingWithLast(currentWalletAddress, pendingDonationAmount, randomTier, finalWish);
    } else if (pendingKrathongTier) {
      spawnKrathong(pendingKrathongTier, finalWish);
      addToRankingWithLast(currentWalletAddress, pendingKrathongPrice, pendingKrathongTier, finalWish);
    } else return closeModal();

    krathongCount++;
    if (floatCountEl) floatCountEl.textContent = krathongCount.toLocaleString();
    closeModal();
  });

  /* ===========================
   * Ranking (LocalStorage)
   * =========================== */
  const RANK_KEY = 'fm_ranking_demo_v3'; // อัปเดตเวอร์ชันเมื่อเปลี่ยนสคีมา
  let rankings = JSON.parse(localStorage.getItem(RANK_KEY) || '[]');

  function saveRankings() {
    localStorage.setItem(RANK_KEY, JSON.stringify(rankings));
  }

  function ensureUserInRanking(addr) {
    if (!addr) return;
    if (!rankings.some(r => r.address.toLowerCase() === addr.toLowerCase())) {
      rankings.push({ address: addr, total: 0, last: null });
      saveRankings();
    }
  }

  function addToRankingWithLast(addr, amountFM, tier, wish) {
    if (!addr || !amountFM) return;
    ensureUserInRanking(addr);
    const rec = rankings.find(r => r.address.toLowerCase() === addr.toLowerCase());
    rec.total += Number(amountFM);
    rec.last = { tier: Number(tier), wish: wish || 'ขอให้มีความสุข', ts: Date.now() };
    rankings.sort((a,b)=> b.total - a.total);
    saveRankings();
    renderRankingList();
  }

  function mask(addr){ return addr.slice(0,6)+'...'+addr.slice(-4); }

  // === เก็บ mapping อันดับเดิม เพื่อตัดสินใจเล่นแอนิเมชัน (เข้ามาใหม่/อันดับดีขึ้น) ===
  let prevRankIndex = {}; // {addressLower: index(0..4)}

  function renderRankingList() {
    const list = document.getElementById('ranking-list');
    if (!list) return;

    // เก็บ index เดิม
    const oldIndexMap = { ...prevRankIndex };

    list.innerHTML = '';
    const top5 = rankings.slice(0,5);
    const newIndexMap = {};

    for (let i=0; i<5; i++) {
      const item = top5[i];
      const p = document.createElement('p');
      p.className = 'rank-item';

      if (item) {
        const medal = i===0?'✨':i===1?'💫':i===2?'🌟':'🕯️';
        p.textContent = `${i+1}. ${medal} ${mask(item.address)} (${item.total} FM)`;
        p.dataset.address = item.address.toLowerCase();
        p.dataset.level   = item?.last?.tier ?? 1;
        p.dataset.wish    = item?.last?.wish || 'ขอให้มีความสุข';

        // บันทึก index ใหม่
        newIndexMap[p.dataset.address] = i;

        // ใส่คลาสแอนิเมชัน
        if (!(p.dataset.address in oldIndexMap)) {
          // เพิ่งเข้าสู่ Top5
          p.classList.add('rank-enter');
        } else if (oldIndexMap[p.dataset.address] > i) {
          // อันดับดีขึ้น (เลข index ลดลง)
          p.classList.add('rank-up');
        }
      } else {
        // ช่องว่าง placeholder
        p.textContent = `${i+1}. –––––––––––––––––`;
        p.style.opacity = 0.4;
        p.dataset.level = ""; // ไม่มี preview
        p.dataset.wish  = "";
      }

      list.appendChild(p);
    }

    // อัปเดตแผนที่อันดับเดิม
    prevRankIndex = newIndexMap;

    // ผูก hover preview ใหม่
    attachRankPreviewHandlers();

    // เคลียร์คลาสหลังแอนิเมชันจบ เพื่อให้เล่นได้รอบถัดไป
    setTimeout(() => {
      list.querySelectorAll('.rank-enter, .rank-up')
          .forEach(el => el.classList.remove('rank-enter','rank-up'));
    }, 1200);
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
      preview.style.borderRadius = '12px';
      preview.style.background = 'rgba(0,0,0,0.65)';
      preview.style.border = '1px solid rgba(0,188,212,.9)';
      preview.style.boxShadow = '0 6px 18px rgba(0,0,0,.35)';
      preview.innerHTML = `
        <div id="rank-preview-wish"
             style="margin-bottom:6px;
                    max-width:240px;
                    font-size:.92rem;
                    line-height:1.25;
                    color:#e2e8f0;
                    text-align:center;
                    font-weight:500;
                    text-shadow:0 0 8px rgba(255,255,255,0.25);">
        </div>
        <img alt="krathong preview"
             style="width:120px;
                    display:block;
                    margin:auto;
                    border-radius:8px;">
      `;
      document.body.appendChild(preview);
    }

    const previewImg  = preview.querySelector('img');
    const previewWish = preview.querySelector('#rank-preview-wish');
    const PAD = 16, BOX_W = 260, BOX_H = 220;

    rankItems.forEach(el => {
      const level = Number(el.dataset.level || 0);
      const wish  = el.dataset.wish || '';
      const imgPath = level ? imgPathByTier(level) : '';

      el.addEventListener('mouseenter', () => {
        if (!level) return; // placeholder ไม่โชว์ preview
        previewImg.src = imgPath;
        previewWish.textContent = wish;
        preview.style.display = 'block';
      });

      el.addEventListener('mousemove', e => {
        let x = e.clientX + PAD, y = e.clientY + PAD;
        if (x + BOX_W > window.innerWidth)  x = e.clientX - BOX_W - PAD;
        if (y + BOX_H > window.innerHeight) y = e.clientY - BOX_H - PAD;
        preview.style.left = `${x}px`;
        preview.style.top  = `${y}px`;
      });

      el.addEventListener('mouseleave', () => { preview.style.display = 'none'; });

      // ทัช/มือถือ: แตะเพื่อโชว์ชั่วคราว 2 วิ
      el.addEventListener('click', (e) => {
        if (!level) return;
        previewImg.src = imgPath;
        previewWish.textContent = wish;
        preview.style.display = 'block';
        preview.style.left = `${e.clientX || window.innerWidth/2}px`;
        preview.style.top  = `${e.clientY || window.innerHeight/2}px`;
        setTimeout(() => (preview.style.display = 'none'), 2000);
      });
    });
  }

  // Render ครั้งแรก
  renderRankingList();

  /* ===========================
   * (ออปชัน) Demo auto-spawn
   * =========================== */
  function spawnAndCount(tier, text, delay) {
    setTimeout(() => {
      spawnKrathong(tier, text);
      krathongCount++;
      if (floatCountEl) floatCountEl.textContent = krathongCount.toLocaleString();
    }, delay);
  }
  function runSampleKrathongs() {
    spawnAndCount(1, 'กระทงทดสอบ 1', 1000);
    spawnAndCount(2, 'กระทงทดสอบ 2', 3000);
    spawnAndCount(3, 'กระทงทดสอบ 3', 6000);
  }
  if (riverVideo) {
    riverVideo.addEventListener('loadedmetadata', runSampleKrathongs);
    riverVideo.addEventListener('error', runSampleKrathongs);
  } else {
    runSampleKrathongs();
  }
});