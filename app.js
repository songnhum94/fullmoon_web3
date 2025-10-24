/* ===========================
 * ส่วน Web3/UI
 * =========================== */
document.addEventListener('DOMContentLoaded', async () => {
  const connectWalletBtn = document.getElementById('connect-wallet-btn');
  const buyButtons = document.querySelectorAll('.buy-btn');
  const donateBtn = document.getElementById('donate-btn');
  let currentWalletAddress = null;
  let ethers;

  const floatCountElement = document.getElementById('float-count');
  let krathongCount = 1234;

  if (floatCountElement) {
    floatCountElement.textContent = krathongCount.toLocaleString();
  }

  // โหลด Ethers
  try {
    const ethersModule = await import('https://unpkg.com/ethers@5.7.2/dist/ethers.esm.js');
    ethers = ethersModule.ethers;
  } catch (e) {
    connectWalletBtn.textContent = '❌ Ethers Error';
    connectWalletBtn.style.backgroundColor = '#d82d2d';
    return;
  }

  if (typeof window.ethereum === 'undefined') {
    connectWalletBtn.textContent = '🦊 Install MetaMask';
    connectWalletBtn.style.backgroundColor = '#f76707';
    return;
  }

  // (ฟังก์ชัน Wallet ... )
  function updateWalletStatus(addr) {
    currentWalletAddress = addr;
    const s = addr.slice(0, 6) + '...' + addr.slice(-4);
    connectWalletBtn.textContent = `🔌 ยกเลิกการเชื่อมต่อ (${s})`;
    connectWalletBtn.style.backgroundColor = '#00c853';
    ensureUserInRanking(addr); // Make sure user exists in ranking
    renderRankingList(); // Update ranking display
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
    } catch (e) { if (e?.code === 4001) alert('ผู้ใช้ปฏิเสธการเชื่อมต่อ'); resetWalletStatus(); }
  }
  async function disconnectWallet() {
    try { await window.ethereum?.request?.({ method: 'wallet_revokePermissions', params: [{ eth_accounts: {} }] }); } catch {}
    resetWalletStatus();
  }
  connectWalletBtn?.addEventListener('click', async () => {
    if (currentWalletAddress) await disconnectWallet(); else await connectWallet();
  });
  resetWalletStatus();
  try {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const accounts = await provider.listAccounts();
    if (accounts.length) updateWalletStatus(accounts[0]);
  } catch {}
  window.ethereum?.on('accountsChanged', (acc) => { acc.length ? updateWalletStatus(acc[0]) : resetWalletStatus(); });
  window.ethereum?.on('chainChanged', () => resetWalletStatus());


  /* ===========================
   * ส่วนกระทง 2D และ Media (Video + Audio)
   * =========================== */

  const riverContainer = document.getElementById('river-simulation');
  const riverVideo     = document.querySelector('.river-video-bg');
  const bgMusic        = document.getElementById('bg-music');

  if (riverVideo) riverVideo.volume = 0.2;
  if (bgMusic)    bgMusic.volume    = 0.1;

  // === ส่วนที่แก้ไข: ปรับปรุงการ Unmute ===
  function unmuteMediaOnFirstClick() {
    let videoHandled = !riverVideo || !riverVideo.muted; // true if no video or already unmuted
    let audioHandled = !bgMusic || !bgMusic.muted; // true if no music or already unmuted

    console.log("First click detected. Attempting to unmute...");

    if (riverVideo && riverVideo.muted) {
      riverVideo.muted = false;
      // พยายามเล่นวิดีโอ (อาจไม่สำเร็จบนมือถือบางรุ่น)
      riverVideo.play().then(() => {
        console.log("Video unmuted and playing.");
        videoHandled = true;
        checkAndRemoveListener();
      }).catch((error) => {
        console.warn("Video play() failed on first click (might be expected on mobile):", error);
        videoHandled = true; // ถือว่าพยายามแล้ว
        checkAndRemoveListener();
      });
    }

    if (bgMusic && bgMusic.muted) {
      bgMusic.muted = false;
      // พยายามเล่นเพลง (อาจไม่สำเร็จบนมือถือบางรุ่น)
      bgMusic.play().then(() => {
        console.log("Audio unmuted and playing.");
        audioHandled = true;
        checkAndRemoveListener();
      }).catch((error) => {
        console.warn("Audio play() failed on first click (might be expected on mobile):", error);
        audioHandled = true; // ถือว่าพยายามแล้ว
        checkAndRemoveListener();
      });
    }

    // ฟังก์ชันนี้จะถูกเรียก 2 ครั้ง (จาก video และ audio)
    // เราจะลบ listener ออกเมื่อทั้งคู่พยายามเล่น (สำเร็จหรือไม่ก็ตาม)
    function checkAndRemoveListener() {
      if (videoHandled && audioHandled) {
        console.log("Removing unmute listener.");
        document.body.removeEventListener('click', unmuteMediaOnFirstClick);
      }
    }
  }
  document.body.addEventListener('click', unmuteMediaOnFirstClick);
  // === จบส่วนที่แก้ไข ===


  // 3. สร้างกระทง
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

    // (Fallback เผื่อ riverH เป็น 0 ตอนเริ่ม)
    if (riverH === 0) {
        console.error("Bug detected: River height is 0. Spawning at 65%.");
        wrap.style.setProperty('--krathong-start-y', `65%`);
    } else {
        const startPct = 0.55, endPct = 0.70; // ลอยสูงขึ้น
        const zone = riverH * (endPct - startPct);
        const startY = riverH * startPct;
        const y = (Math.random() * zone) + startY;
        wrap.style.setProperty('--krathong-start-y', `${y}px`);
    }

    wrap.style.animationDuration = `${25 + Math.random() * 15}s`; // ลอยช้า
    riverContainer.appendChild(wrap);

    // (ลบ event listener ออกแล้ว เพราะใช้ infinite animation)
  }

  /* ===========================
   * === ส่วน Pop-up (Modal) Logic ===
   * =========================== */

  const wishModal     = document.getElementById('wish-modal');
  const wishInput     = document.getElementById('wish-input');
  const submitWishBtn = document.getElementById('submit-wish-btn');
  const cancelWishBtn = document.getElementById('cancel-wish-btn');

  let pendingKrathongTier  = null;
  let pendingKrathongPrice = 0;
  let pendingDonationAmount= 0;

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
    const finalWish = wishText === '' ? 'ขอให้มีความสุข' : finalWish;

    let tierToSpawn = null;
    let amountForRank = 0;

    if (pendingDonationAmount > 0) {
      tierToSpawn = Math.floor(Math.random() * 5) + 1;
      amountForRank = pendingDonationAmount;
      alert(`เดโมธุรกรรม: บริจาค ${pendingDonationAmount} FM`);
    } else if (pendingKrathongTier) {
      tierToSpawn = pendingKrathongTier;
      amountForRank = pendingKrathongPrice;
      // Alert for normal float can be added here if needed
    } else return closeModal();

    spawnKrathong(tierToSpawn, finalWish);
    addToRankingWithLast(currentWalletAddress, amountForRank, tierToSpawn, finalWish);

    krathongCount++;
    if (floatCountEl) floatCountEl.textContent = krathongCount.toLocaleString();
    closeModal();
  });

  /* ===========================
   * Ranking (LocalStorage)
   * =========================== */
  const RANK_KEY = 'fm_ranking_demo_v3';
  let rankings = JSON.parse(localStorage.getItem(RANK_KEY) || '[]');

  function saveRankings() {
    localStorage.setItem(RANK_KEY, JSON.stringify(rankings));
  }

  function ensureUserInRanking(addr) {
    if (!addr) return;
    const addrLower = addr.toLowerCase();
    if (!rankings.some(r => r.address.toLowerCase() === addrLower)) {
      rankings.push({ address: addr, total: 0, last: null });
      saveRankings(); // Save immediately when a new user is added
    }
  }

  function addToRankingWithLast(addr, amountFM, tier, wish) {
    if (!addr || !amountFM) return;
    const addrLower = addr.toLowerCase();
    ensureUserInRanking(addr); // Ensure user exists first
    const rec = rankings.find(r => r.address.toLowerCase() === addrLower);
    if (rec) { // Should always find the record now
        rec.total += Number(amountFM);
        rec.last = { tier: Number(tier), wish: wish || 'ขอให้มีความสุข', ts: Date.now() };
        rankings.sort((a,b)=> b.total - a.total); // Sort after update
        saveRankings(); // Save after update
        renderRankingList(); // Update UI
    }
  }

  function mask(addr){ return addr.slice(0,6)+'...'+addr.slice(-4); }

  let prevRankIndex = {};

  function renderRankingList() {
    const list = document.getElementById('ranking-list');
    if (!list) return;

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
        const addrLower = item.address.toLowerCase();
        p.dataset.address = addrLower;
        p.dataset.level   = item?.last?.tier ?? 1;
        p.dataset.wish    = item?.last?.wish || 'ขอให้มีความสุข';

        newIndexMap[addrLower] = i;

        if (!(addrLower in oldIndexMap)) {
          p.classList.add('rank-enter');
        } else if (oldIndexMap[addrLower] > i) {
          p.classList.add('rank-up');
        }
      } else {
        p.textContent = `${i+1}. –––––––––––––––––`;
        p.style.opacity = 0.4;
        p.dataset.level = "";
        p.dataset.wish  = "";
      }
      list.appendChild(p);
    }

    prevRankIndex = newIndexMap;
    attachRankPreviewHandlers();

    setTimeout(() => {
      list.querySelectorAll('.rank-enter, .rank-up')
          .forEach(el => el.classList.remove('rank-enter','rank-up'));
    }, 1200);
  }

  function attachRankPreviewHandlers() {
    const rankItems = document.querySelectorAll('#ranking-list .rank-item');
    let preview = document.getElementById('rank-preview');
    // (Create preview element if it doesn't exist - code omitted for brevity, assume it exists or use previous code)
    if (!preview) {
        // ... (code to create preview element) ...
        preview = document.createElement('div');
        preview.id = 'rank-preview';
        // ... (styles) ...
        preview.innerHTML = `<div id="rank-preview-wish"></div><img alt="krathong preview">`;
        document.body.appendChild(preview);
    }


    const previewImg  = preview.querySelector('img');
    const previewWish = preview.querySelector('#rank-preview-wish');
    // (Rest of the preview handler code - mouseenter, mousemove, mouseleave, click)
        const PAD = 16, BOX_W = 260, BOX_H = 220; // Adjust BOX sizes if needed

    rankItems.forEach(el => {
      const level = Number(el.dataset.level || 0);
      const wish  = el.dataset.wish || '';
      const imgPath = level ? imgPathByTier(level) : '';

      el.addEventListener('mouseenter', () => {
        if (!level) return;
        previewImg.src = imgPath;
        previewWish.textContent = wish;
        preview.style.display = 'block';
      });

      el.addEventListener('mousemove', e => {
         if (!level) return; // Don't move if not visible
        let x = e.clientX + PAD, y = e.clientY + PAD;
        // Adjust position based on viewport boundaries
        if (x + BOX_W > window.innerWidth)  x = e.clientX - BOX_W - PAD;
        if (y + BOX_H > window.innerHeight) y = e.clientY - BOX_H - PAD;
        preview.style.left = `${x}px`;
        preview.style.top  = `${y}px`;
      });

      el.addEventListener('mouseleave', () => { preview.style.display = 'none'; });

      // Touch handler
      el.addEventListener('click', (e) => {
        if (!level || window.innerWidth > 992) return; // Only for touch/mobile-sized screens
        previewImg.src = imgPath;
        previewWish.textContent = wish;
        preview.style.display = 'block';
        // Position near the touch point or center screen fallback
        const touchX = e.touches ? e.touches[0].clientX : e.clientX;
        const touchY = e.touches ? e.touches[0].clientY : e.clientY;
        preview.style.left = `${(touchX || window.innerWidth / 2) - BOX_W/2}px`; // Center horizontally near touch
        preview.style.top  = `${(touchY || window.innerHeight / 2) - BOX_H - PAD}px`; // Position above touch
        setTimeout(() => (preview.style.display = 'none'), 2500); // Show a bit longer on touch
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
    riverVideo.addEventListener('error', runSampleKrathongs); // Run even if video fails
  } else {
    runSampleKrathongs(); // Run if no video tag
  }
});