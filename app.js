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
    if (connectWalletBtn) {
        connectWalletBtn.textContent = '❌ Ethers Error';
        connectWalletBtn.style.backgroundColor = '#d82d2d';
    }
    return;
  }

  if (typeof window.ethereum === 'undefined') {
    if (connectWalletBtn) {
        connectWalletBtn.textContent = '🦊 Install MetaMask';
        connectWalletBtn.style.backgroundColor = '#f76707';
    }
    // Don't return here, allow the rest of the UI to load
  }

  // (ฟังก์ชัน Wallet ... )
  function updateWalletStatus(addr) {
    currentWalletAddress = addr;
    const s = addr.slice(0, 6) + '...' + addr.slice(-4);
    if (connectWalletBtn) {
        connectWalletBtn.textContent = `🔌 ยกเลิกการเชื่อมต่อ (${s})`;
        connectWalletBtn.style.backgroundColor = '#00c853';
    }
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
     if (typeof window.ethereum === 'undefined') {
        alert('โปรดติดตั้ง MetaMask!');
        return;
    }
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
  resetWalletStatus(); // Set initial state
  // Try to connect automatically if already permitted
  if (typeof window.ethereum !== 'undefined') {
      try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const accounts = await provider.listAccounts();
        if (accounts.length) updateWalletStatus(accounts[0]);
      } catch (e) { console.warn("Could not retrieve accounts on load:", e); }
  }
  window.ethereum?.on('accountsChanged', (acc) => { acc.length ? updateWalletStatus(acc[0]) : resetWalletStatus(); });
  window.ethereum?.on('chainChanged', () => resetWalletStatus());


  /* ===========================
   * ส่วนกระทง 2D และ Media (Video + Audio)
   * =========================== */

  const riverContainer = document.getElementById('river-simulation');
  const riverVideo     = document.querySelector('.river-video-bg');
  const bgMusic        = document.getElementById('bg-music');
  const ASSETS_BASE    = './assets/'; // Define base path for assets

  if (riverVideo) riverVideo.volume = 0.15;
  if (bgMusic)    bgMusic.volume    = 0.07;

  function unmuteMediaOnFirstClick() {
    let videoPromise = Promise.resolve();
    let audioPromise = Promise.resolve();

    console.log("First click detected. Attempting to unmute...");

    if (riverVideo && riverVideo.muted) {
      riverVideo.muted = false;
      videoPromise = riverVideo.play().then(() => {
        console.log("Video unmuted and playing.");
      }).catch((error) => {
        console.warn("Video play() failed (might be expected):", error);
      });
    }

    if (bgMusic && bgMusic.muted) {
      bgMusic.muted = false;
      audioPromise = bgMusic.play().then(() => {
        console.log("Audio unmuted and playing.");
      }).catch((error) => {
        console.warn("Audio play() failed (might be expected):", error);
        // Sometimes iOS needs a separate interaction for audio vs video
      });
    }

    // Remove listener after attempting both, regardless of success
    Promise.allSettled([videoPromise, audioPromise]).then(() => {
         console.log("Removing unmute listener.");
         document.body.removeEventListener('click', unmuteMediaOnFirstClick);
    });
  }
  document.body.addEventListener('click', unmuteMediaOnFirstClick);

  // === ฟังก์ชันที่หายไป (เพิ่มกลับเข้ามา) ===
  function imgPathByTier(tier) {
    const t = Math.min(Math.max(Number(tier)||1, 1), 5); // Ensure tier is 1-5
    return `${ASSETS_BASE}${t}.png`;
  }
  // === จบส่วนที่เพิ่ม ===

  // 3. สร้างกระทง
  function spawnKrathong(tier, wishText) {
    if (!riverContainer) return;

    const wrap = document.createElement('div');
    wrap.className = 'krathong-2d';

    const img = document.createElement('img');
    img.className = 'krathong-img-inner';
    img.src = imgPathByTier(tier); // <== ตรวจสอบว่าเรียกใช้ถูกต้อง

    const tooltip = document.createElement('span');
    tooltip.className = 'wish-tooltip';
    tooltip.textContent = wishText || 'ขอให้มีความสุข';

    wrap.appendChild(tooltip);
    wrap.appendChild(img);

    const riverH = riverContainer.clientHeight;

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
    if (wishInput) wishInput.value = '';
    if (wishModal) wishModal.classList.add('hidden');
    pendingKrathongTier  = null;
    pendingKrathongPrice = 0;
    pendingDonationAmount= 0;
  }

  buyButtons.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      if (!currentWalletAddress) { alert('โปรดเชื่อมต่อ Wallet ก่อนทำการลอยกระทง'); return; }
      const card  = e.target.closest('.krathong-card');
      if (!card) return;
      const tier  = card.dataset.level;
      const price = Number(card.dataset.price || 0);

      pendingKrathongTier  = tier;
      pendingKrathongPrice = price;
      pendingDonationAmount= 0;

      if (wishModal) wishModal.classList.remove('hidden');
      if (wishInput) wishInput.focus();
    });
  });

  cancelWishBtn?.addEventListener('click', closeModal);

  donateBtn?.addEventListener('click', () => {
    if (!currentWalletAddress) { alert('โปรดเชื่อมต่อ Wallet ก่อนทำการบริจาค'); return; }
    const amountInput = document.getElementById('donation-amount');
    const amount = Number(amountInput?.value || 0);
    if (amount <= 0) { alert('โปรดระบุจำนวน FM ที่ต้องการบริจาค'); return; }

    pendingDonationAmount = amount;
    pendingKrathongTier   = null;
    pendingKrathongPrice  = 0;

    if (wishModal) wishModal.classList.remove('hidden');
    if (wishInput) wishInput.focus();
  });

  submitWishBtn?.addEventListener('click', () => {
    const wishText  = wishInput ? wishInput.value.trim() : '';
    const finalWish = wishText === '' ? 'ขอให้มีความสุข' : finalWish; // <-- แก้ไข: ต้องเป็น wishText

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

    if (tierToSpawn !== null) { // Make sure we have a tier
        spawnKrathong(tierToSpawn, finalWish);
        addToRankingWithLast(currentWalletAddress, amountForRank, tierToSpawn, finalWish);

        krathongCount++;
        if (floatCountElement) floatCountElement.textContent = krathongCount.toLocaleString();
    }
    closeModal();
  });

  /* ===========================
   * Ranking (LocalStorage)
   * =========================== */
  const RANK_KEY = 'fm_ranking_demo_v3';
  let rankings = [];
   try {
       rankings = JSON.parse(localStorage.getItem(RANK_KEY) || '[]');
       if (!Array.isArray(rankings)) rankings = []; // Ensure it's an array
   } catch (e) {
       console.error("Failed to parse rankings from localStorage:", e);
       rankings = []; // Reset if parsing fails
   }

  function saveRankings() {
    try {
        localStorage.setItem(RANK_KEY, JSON.stringify(rankings));
    } catch (e) {
        console.error("Failed to save rankings to localStorage:", e);
    }
  }

  function ensureUserInRanking(addr) {
    if (!addr) return;
    const addrLower = addr.toLowerCase();
    if (!rankings.some(r => r.address.toLowerCase() === addrLower)) {
      rankings.push({ address: addr, total: 0, last: null });
      // Don't save here, save only after updating total/last
    }
  }

  function addToRankingWithLast(addr, amountFM, tier, wish) {
    if (!addr || !amountFM) return;
    const addrLower = addr.toLowerCase();
    ensureUserInRanking(addr);
    const rec = rankings.find(r => r.address.toLowerCase() === addrLower);
    if (rec) {
        rec.total += Number(amountFM);
        rec.last = { tier: Number(tier), wish: wish || 'ขอให้มีความสุข', ts: Date.now() };
        rankings.sort((a,b)=> b.total - a.total);
        saveRankings(); // Save after successful update
        renderRankingList();
    } else {
        console.error("Could not find user record after ensureUserInRanking:", addr);
    }
  }

  function mask(addr){ return addr ? addr.slice(0,6)+'...'+addr.slice(-4) : '???'; }

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

      if (item && item.address) { // Check if item and address exist
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
    attachRankPreviewHandlers(); // Re-attach handlers

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
        // Add necessary styles...
        preview.style.position = 'fixed';
        preview.style.display = 'none';
        preview.style.pointerEvents = 'none';
        preview.style.zIndex = '3000';
        preview.style.transform = 'translate(12px, 12px)';
        preview.style.padding = '8px'; // Adjusted padding
        preview.style.borderRadius = '10px'; // Adjusted radius
        preview.style.background = 'rgba(0,0,0,0.7)'; // Slightly more opaque
        preview.style.border = '1px solid var(--neon-blue)'; // Use variable
        preview.style.boxShadow = '0 4px 12px rgba(0,0,0,.3)'; // Soft shadow
        preview.innerHTML = `
            <div id="rank-preview-wish"
                 style="margin-bottom:6px;
                        max-width:180px; /* Limit width */
                        font-size:.9rem; /* Slightly smaller */
                        line-height:1.3;
                        color:#fff; /* White text */
                        text-align:center;
                        font-weight:normal; /* Normal weight */
                        text-shadow: none;">
            </div>
            <img alt="krathong preview"
                 style="width:90px; /* Smaller image */
                        display:block;
                        margin:auto;
                        border-radius:6px;">
        `;
        document.body.appendChild(preview);
    }


    const previewImg  = preview.querySelector('img');
    const previewWish = preview.querySelector('#rank-preview-wish');
    // Adjust box size estimation if needed
    const PAD = 16, BOX_W = 200, BOX_H = 150;

    rankItems.forEach(el => {
      // Remove previous listeners to prevent duplicates if function is called multiple times
      el.removeEventListener('mouseenter', el._rankMouseEnter);
      el.removeEventListener('mousemove', el._rankMouseMove);
      el.removeEventListener('mouseleave', el._rankMouseLeave);
      el.removeEventListener('click', el._rankMouseClick);


      const level = Number(el.dataset.level || 0);
      const wish  = el.dataset.wish || '';
      const imgPath = level ? imgPathByTier(level) : ''; // Use the function

      el._rankMouseEnter = () => {
        if (!level || !preview || !previewImg || !previewWish) return;
        previewImg.src = imgPath;
        previewWish.textContent = wish;
        preview.style.display = 'block';
      };

      el._rankMouseMove = e => {
         if (!level || !preview) return;
        let x = e.clientX + PAD, y = e.clientY + PAD;
        if (x + BOX_W > window.innerWidth)  x = e.clientX - BOX_W - PAD;
        if (y + BOX_H > window.innerHeight) y = e.clientY - BOX_H - PAD;
        preview.style.left = `${x}px`;
        preview.style.top  = `${y}px`;
      };

      el._rankMouseLeave = () => { if (preview) preview.style.display = 'none'; };

      el._rankMouseClick = (e) => {
        if (!level || window.innerWidth > 992 || !preview || !previewImg || !previewWish) return;
        previewImg.src = imgPath;
        previewWish.textContent = wish;
        preview.style.display = 'block';
        const touchX = e.touches ? e.touches[0].clientX : e.clientX;
        const touchY = e.touches ? e.touches[0].clientY : e.clientY;
        // Position slightly above the touch point
        preview.style.left = `${(touchX || window.innerWidth / 2) - BOX_W / 2}px`;
        preview.style.top  = `${(touchY || window.innerHeight / 2) - BOX_H - PAD * 2}px`; // Move further up
        // Use a flag to prevent immediate hide on the same click/touch
        let hideTimeout = setTimeout(() => {
            if (preview) preview.style.display = 'none';
        }, 2500);
        // Clear timeout if another touch occurs quickly
        preview.ontouchstart = () => clearTimeout(hideTimeout);
      };

      el.addEventListener('mouseenter', el._rankMouseEnter);
      el.addEventListener('mousemove', el._rankMouseMove);
      el.addEventListener('mouseleave', el._rankMouseLeave);
      el.addEventListener('click', el._rankMouseClick); // Handles touch as well
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
      if (floatCountElement) floatCountElement.textContent = krathongCount.toLocaleString();
    }, delay);
  }
  function runSampleKrathongs() {
    // Check if riverContainer has a valid height before spawning
    if (riverContainer && riverContainer.clientHeight > 0) {
        spawnAndCount(1, 'กระทงทดสอบ 1', 1000);
        spawnAndCount(2, 'กระทงทดสอบ 2', 3000);
        spawnAndCount(3, 'กระทงทดสอบ 3', 6000);
    } else {
        // If height is still 0, wait a bit longer and try again once
        console.warn("River container height 0 on initial load, delaying sample spawn.");
        setTimeout(() => {
             if (riverContainer && riverContainer.clientHeight > 0) {
                 runSampleKrathongs(); // Call itself again
             } else {
                 console.error("River container height still 0 after delay. Samples not spawned.");
             }
        }, 500); // Wait 500ms
    }
  }

  // Wait for video metadata OR error before running samples
  if (riverVideo) {
    let samplesRun = false;
    const runSamplesOnce = () => {
        if (!samplesRun) {
            runSampleKrathongs();
            samplesRun = true;
        }
    };
    riverVideo.addEventListener('loadedmetadata', runSamplesOnce);
    riverVideo.addEventListener('error', runSamplesOnce);
    // Fallback: If video takes too long, run samples after a delay anyway
    setTimeout(() => {
        if (!samplesRun) {
            console.warn("Video metadata timeout. Running samples anyway.");
            runSamplesOnce();
        }
    }, 5000); // 5 second timeout

  } else {
    runSampleKrathongs(); // Run immediately if no video
  }
});