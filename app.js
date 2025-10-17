// ต้องมีบรรทัดนี้เท่านั้น
import { Water } from './Water.js';

function initThreeJS() {
  const container = document.getElementById('river-simulation');
  if (typeof window.THREE === 'undefined') {
    if (container) container.innerHTML = "<p style='color:red;'>⚠️ โหลด THREE.js ไม่สำเร็จ</p>";
    return;
  }

  const scene = new window.THREE.Scene();
  const camera = new window.THREE.PerspectiveCamera(60, 1, 0.1, 2000);
  const renderer = new window.THREE.WebGLRenderer({ antialias: true, alpha: true });

  renderer.setClearColor(0x000000, 0);       // พื้นหลังโปร่ง
  container.innerHTML = '';
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  // แสง/บรรยากาศ
  scene.fog = new window.THREE.Fog(0x0a0f16, 60, 600);
  const amb = new window.THREE.AmbientLight(0xb0cde0, 0.35);
  scene.add(amb);
  const dir = new window.THREE.DirectionalLight(0xffffff, 0.9);
  dir.position.set(80, 120, 40);
  scene.add(dir);

  // พื้นท้องน้ำ (ให้เห็น “ใส”)
  const bedGeo = new window.THREE.PlaneGeometry(4000, 4000);
  const bedMat = new window.THREE.MeshStandardMaterial({ color: 0x0b2a2a, roughness: 0.9, metalness: 0.0 });
  const riverbed = new window.THREE.Mesh(bedGeo, bedMat);
  riverbed.rotation.x = -Math.PI / 2;
  riverbed.position.y = -0.35;              // ต่ำกว่าผิวน้ำเล็กน้อย
  scene.add(riverbed);

  // น้ำ
  const sizeVec = new window.THREE.Vector2();
  renderer.getDrawingBufferSize(sizeVec);
  const water = new Water(renderer, camera, scene, {
    width: sizeVec.x, height: sizeVec.y, alpha: 0.62,
    waterColor: 0x0a6261, sunColor: 0xffffff, distortionScale: 24, size: 2.0, y: 0.0,
    flowDir: new window.THREE.Vector2(1.0, 0.12), flowSpeed: 0.06
  });
  scene.add(water.mesh);

  // โมเดล “กระทง” แบบ Low-poly แต่ดูเรืองแสง
  function makeKrathong({ color = 0xffcc00, glow = 0xffe380 }) {
    const g = new window.THREE.Group();

    // ฐานทรงกลมแบน + วงแหวนไฟ
    const base = new window.THREE.CylinderGeometry(1.0, 1.2, 0.35, 32);
    const baseMat = new window.THREE.MeshStandardMaterial({ color, roughness: 0.65, metalness: 0.1 });
    const baseMesh = new window.THREE.Mesh(base, baseMat);
    baseMesh.position.y = 0.18;
    g.add(baseMesh);

    const ring = new window.THREE.TorusGeometry(1.15, 0.06, 12, 64);
    const ringMat = new window.THREE.MeshStandardMaterial({ color: glow, emissive: glow, emissiveIntensity: 0.9, roughness: 0.2, metalness: 0.0 });
    const ringMesh = new window.THREE.Mesh(ring, ringMat);
    ringMesh.rotation.x = Math.PI / 2;
    ringMesh.position.y = 0.02;
    g.add(ringMesh);

    // กลีบ (กรวยเล็กๆ) เป็นวง
    const petalGeo = new window.THREE.ConeGeometry(0.25, 0.4, 12);
    const petalMat = new window.THREE.MeshStandardMaterial({ color: 0x2ed8c3, roughness: 0.5, metalness: 0.1 });
    const petals = new window.THREE.Group();
    for (let i = 0; i < 12; i++) {
      const m = new window.THREE.Mesh(petalGeo, petalMat);
      const ang = (i / 12) * Math.PI * 2;
      m.position.set(Math.cos(ang) * 0.8, 0.45, Math.sin(ang) * 0.8);
      m.rotation.z = Math.PI;  // ปลายชี้ขึ้น
      m.lookAt(0, 0.4, 0);
      petals.add(m);
    }
    g.add(petals);

    // เทียน
    const candleGeo = new window.THREE.CylinderGeometry(0.05, 0.05, 0.8, 12);
    const candleMat = new window.THREE.MeshStandardMaterial({ color: 0xf4f5f5, roughness: 0.9 });
    const candle = new window.THREE.Mesh(candleGeo, candleMat);
    candle.position.y = 0.9;
    g.add(candle);

    const flameGeo = new window.THREE.SphereGeometry(0.1, 12, 12);
    const flameMat = new window.THREE.MeshStandardMaterial({ color: 0xffcc55, emissive: 0xffaa22, emissiveIntensity: 1.5 });
    const flame = new window.THREE.Mesh(flameGeo, flameMat);
    flame.position.y = 1.35;
    g.add(flame);

    return g;
  }

  // สร้างกระทงหลายใบ ลอยตามน้ำ
  const krathongs = [];
  const colors = [0xffcc00, 0xff66aa, 0xff8844, 0x66e0ff, 0xccccff];
  for (let i = 0; i < 8; i++) {
    const k = makeKrathong({ color: colors[i % colors.length], glow: 0xffe8a0 });
    k.position.set(-30 + i * 8, 0.0, -6 + (i % 3) * 6);
    k.userData = {
      speed: 0.03 + Math.random() * 0.025,     // ความเร็วการลอยไปข้างหน้า
      bobAmp: 0.12 + Math.random() * 0.07,     // โคลงเครง
      bobFreq: 0.8 + Math.random() * 0.6,
      rotSpeed: (Math.random() - 0.5) * 0.01
    };
    scene.add(k);
    krathongs.push(k);
  }

  // กล้อง
  camera.position.set(0, 5.5, 9.5);
  camera.lookAt(0, 0, 0);

  function animate() {
    requestAnimationFrame(animate);

    const t = performance.now() * 0.001;

    // อัปเดตน้ำ
    water.update(t);
    water.render();

    // อัปเดตกระทง: ลอยตามน้ำ + เด้งขึ้นลงเบาๆ + หมุน
    for (const k of krathongs) {
      k.position.x += k.userData.speed;                     // ลอยทวน/ตามน้ำ
      k.position.y = 0.08 + Math.sin(t * k.userData.bobFreq + k.position.x) * k.userData.bobAmp;
      k.rotation.y += k.userData.rotSpeed;

      // loop วนกลับเมื่อหลุดเฟรม
      if (k.position.x > 40) k.position.x = -40;
    }

    renderer.render(scene, camera);
  }

  function onResize() {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.getDrawingBufferSize(sizeVec);
    water.setSize(sizeVec.x, sizeVec.y);
  }
  window.addEventListener('resize', onResize);
  onResize();
  animate();
}

/* ===========================
 * ส่วน Web3/UI (เหมือนเดิมของคุณ)
 * =========================== */
document.addEventListener('DOMContentLoaded', async () => {
  initThreeJS();                                         // เริ่มฉาก 3D

  const connectWalletBtn = document.getElementById('connect-wallet-btn');
  const buyButtons = document.querySelectorAll('.buy-btn');
  const donateBtn = document.getElementById('donate-btn');
  let currentWalletAddress = null;
  let ethers;

  // โหลด Ethers แบบ dynamic (ตามโครงเดิม):contentReference[oaicite:3]{index=3}
  try {
    const ethersModule = await import('https://unpkg.com/ethers@5.7.2/dist/ethers.esm.js');
    ethers = ethersModule.ethers;
  } catch (e) {
    connectWalletBtn.textContent = '❌ Ethers Error';
    connectWalletBtn.style.backgroundColor = '#d82d2d';
    connectWalletBtn.style.cursor = 'default';
    alert('⚠️ โหลด Ethers.js ไม่สำเร็จ');
    return;
  }

  if (typeof window.ethereum === 'undefined') {
    connectWalletBtn.textContent = '🦊 Install MetaMask';
    connectWalletBtn.style.backgroundColor = '#f76707';
    connectWalletBtn.style.cursor = 'default';
    return;
  }

  function updateWalletStatus(addr) {
    currentWalletAddress = addr;
    const s = addr.slice(0,6) + '...' + addr.slice(-4);
    connectWalletBtn.textContent = `🔌 ยกเลิกการเชื่อมต่อ (${s})`;
    connectWalletBtn.style.backgroundColor = '#00c853';
    connectWalletBtn.style.cursor = 'pointer';
  }
  function resetWalletStatus() {
    currentWalletAddress = null;
    connectWalletBtn.textContent = '🔗 เชื่อมต่อ Wallet';
    connectWalletBtn.style.backgroundColor = '#2962ff';
    connectWalletBtn.style.cursor = 'pointer';
  }

  async function connectWallet() {
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const accounts = await provider.send('eth_requestAccounts', []);
      updateWalletStatus(accounts[0]);
    } catch (e) {
      if (e.code === 4001) alert('ผู้ใช้ปฏิเสธการเชื่อมต่อ');
      resetWalletStatus();
    }
  }
  async function disconnectWallet() {
    try {
      await window.ethereum.request?.({ method: 'wallet_revokePermissions', params: [{ eth_accounts: {} }] });
    } catch {}
    resetWalletStatus();
  }
  connectWalletBtn.addEventListener('click', async () => {
    if (currentWalletAddress) await disconnectWallet(); else await connectWallet();
  });
  resetWalletStatus();

  // ตรวจสอบตอนโหลด (โครงเดิม):contentReference[oaicite:4]{index=4}
  try {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const accounts = await provider.listAccounts();
    if (accounts.length) updateWalletStatus(accounts[0]);
  } catch {}

  // ปุ่ม “ลอย X FM” — โหมดเดโม่
  buyButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      if (!currentWalletAddress) { alert('โปรดเชื่อมต่อ Wallet ก่อนทำการลอยกระทง'); return; }
      const price = e.target.closest('.krathong-card').dataset.price;
      alert(`เดโม่ธุรกรรม: ลอยกระทง ${price} FM`);
    });
  });

  if (donateBtn) {
    donateBtn.addEventListener('click', () => {
      if (!currentWalletAddress) { alert('โปรดเชื่อมต่อ Wallet ก่อนทำการบริจาค'); return; }
      const amount = Number(document.getElementById('donation-amount')?.value || 0);
      if (!amount) { alert('โปรดระบุจำนวน FM ที่ต้องการบริจาค'); return; }
      alert(`เดโม่ธุรกรรม: บริจาค ${amount} FM`);
    });
  }

  // MetaMask events
  window.ethereum?.on('accountsChanged', (acc) => acc.length ? updateWalletStatus(acc[0]) : resetWalletStatus());
  window.ethereum?.on('chainChanged', () => { resetWalletStatus(); });
});
