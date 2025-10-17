// app.js

document.addEventListener('DOMContentLoaded', async () => {
    const connectWalletBtn = document.getElementById('connect-wallet-btn');
    const buyButtons = document.querySelectorAll('.buy-btn');
    const donateBtn = document.getElementById('donate-btn');
    let currentWalletAddress = null; 

    let ethers; // ตัวแปรสำหรับเก็บไลบรารี Ethers.js

    // --- Dynamic Import Ethers.js ---
    try {
        // โหลด Ethers.js แบบ Module จาก CDN
        const ethersModule = await import('https://unpkg.com/ethers@5.7.2/dist/ethers.esm.js'); 
        ethers = ethersModule.ethers; 
        console.log("Ethers.js loaded successfully via dynamic import.");
    } catch (error) {
        // หากโหลด Ethers.js ไม่สำเร็จ
        if (connectWalletBtn) { 
            connectWalletBtn.textContent = '❌ Ethers Error'; 
            connectWalletBtn.style.backgroundColor = '#d82d2d';
            connectWalletBtn.style.cursor = 'default';
        }
        console.error("Failed to load Ethers.js via dynamic import:", error);
        alert("⚠️ Ethers.js library ไม่ถูกโหลด โปรดตรวจสอบอินเทอร์เน็ตและลอง Hard Refresh (Ctrl+Shift+R)");
        return; // หยุดการทำงานถ้า Ethers.js โหลดไม่ได้
    }

    // --- ตรวจสอบ MetaMask ---
    if (typeof window.ethereum === 'undefined') {
        if (connectWalletBtn) { 
            connectWalletBtn.textContent = '🦊 Install MetaMask';
            connectWalletBtn.style.backgroundColor = '#f76707'; 
            connectWalletBtn.style.cursor = 'default';
        }
        console.warn("MetaMask not detected. Please install it.");
        return; // หยุดการทำงานถ้า MetaMask ไม่ถูกติดตั้ง
    }

    // --- ฟังก์ชันสำหรับอัพเดทสถานะ Wallet ---
    function updateWalletStatus(address) {
        currentWalletAddress = address;
        if (connectWalletBtn) {
            const shortAddress = address.substring(0, 6) + "..." + address.substring(address.length - 4);
            connectWalletBtn.textContent = `✅ Connected (${shortAddress})`;
            connectWalletBtn.style.backgroundColor = '#00c853'; 
            connectWalletBtn.style.cursor = 'default'; 
        }
    }

    // --- ฟังก์ชันสำหรับรีเซ็ตสถานะ Wallet ---
    function resetWalletStatus() {
        currentWalletAddress = null;
        if (connectWalletBtn) {
            connectWalletBtn.textContent = '🔗 เชื่อมต่อ Wallet';
            connectWalletBtn.style.backgroundColor = '#2962ff'; 
            connectWalletBtn.style.cursor = 'pointer'; 
        }
    }

    // --- ฟังก์ชันเชื่อมต่อ Wallet จริงๆ กับ MetaMask ---
    async function connectWallet() {
        if (currentWalletAddress) {
            console.log("Wallet already connected.");
            return;
        }

        try {
            const provider = new ethers.providers.Web3Provider(window.ethereum);
            const accounts = await provider.send("eth_requestAccounts", []); // ขอให้ผู้ใช้เชื่อมต่อ
            const signer = provider.getSigner();
            const address = await signer.getAddress();
            updateWalletStatus(address);
        } catch (error) {
            console.error("Wallet connection failed:", error);
            if (error.code === 4001) { // User rejected connection
                alert("การเชื่อมต่อถูกปฏิเสธโดยผู้ใช้ใน MetaMask"); 
            } else {
                alert("เกิดข้อผิดพลาดในการเชื่อมต่อ Wallet: " + error.message);
            }
            resetWalletStatus(); // รีเซ็ตสถานะปุ่มหากเชื่อมต่อไม่สำเร็จ
        }
    }

    // --- ผูก Event Listener กับปุ่ม "เชื่อมต่อ Wallet" ---
    if (connectWalletBtn) { 
        connectWalletBtn.addEventListener('click', connectWallet);
    }
    resetWalletStatus(); // กำหนดสถานะเริ่มต้นของปุ่มเป็น "เชื่อมต่อ Wallet" (สีฟ้า)

    // --- ตรวจสอบการเชื่อมต่อเริ่มต้นเมื่อโหลดหน้าเว็บ ---
    async function checkInitialConnection() {
        if (typeof window.ethereum === 'undefined') { 
            return;
        }

        try {
            const provider = new ethers.providers.Web3Provider(window.ethereum);
            const accounts = await provider.listAccounts(); // ตรวจสอบ Account ที่เชื่อมต่ออยู่แล้ว
            if (accounts.length > 0) {
                updateWalletStatus(accounts[0]);
            } else {
                // ถ้าไม่มี Account เชื่อมต่ออยู่แล้ว ปุ่มจะอยู่ในสถานะ resetWalletStatus() ที่ถูกเรียกไปก่อนหน้า
            }
        } catch (error) {
            console.log("No initial wallet connection found or error checking accounts:", error);
            // ในกรณีมี Error ในการตรวจสอบการเชื่อมต่อเริ่มต้น ก็ให้ปุ่มอยู่ในสถานะพร้อมเชื่อมต่อ
            resetWalletStatus(); 
        }
    }

    checkInitialConnection(); 

    // --- Event Listeners สำหรับปุ่มซื้อกระทง (ยังเป็นแค่ Alert) ---
    buyButtons.forEach(button => {
        button.addEventListener('click', async (e) => {
            if (!currentWalletAddress) { 
                alert('โปรดเชื่อมต่อ Wallet ก่อนทำการลอยกระทง');
                return;
            }
            const price = e.target.closest('.krathong-card').dataset.price;
            alert(`กำลังเตรียมทำธุรกรรม: ลอยกระทง ${price} FM...`);
        });
    });

    // --- Event Listener สำหรับปุ่มบริจาค (ยังเป็นแค่ Alert) ---
    if (donateBtn) {
        donateBtn.addEventListener('click', async () => {
            if (!currentWalletAddress) { 
                alert('โปรดเชื่อมต่อ Wallet ก่อนทำการบริจาค');
                return;
            }
            const amountInput = document.getElementById('donation-amount');
            const amount = amountInput ? amountInput.value : 0;
            if (!amount || amount <= 0) {
                alert('โปรดระบุจำนวน FM ที่ต้องการบริจาค');
                return;
            }
            alert(`กำลังเตรียมทำธุรกรรม: บริจาค ${amount} FM...`);
        });
    }


    // --- จัดการ Event จาก MetaMask (Accounts Changed, Chain Changed) ---
    if (typeof window.ethereum !== 'undefined') { 
        window.ethereum.on('accountsChanged', (accounts) => {
            if (accounts.length > 0) {
                updateWalletStatus(accounts[0]);
            } else {
                resetWalletStatus(); 
            }
        });
        window.ethereum.on('chainChanged', (chainId) => {
            console.log("Network changed to:", chainId);
            alert("มีการเปลี่ยน Network ใน MetaMask โปรดตรวจสอบความเข้ากันได้");
            // อาจจะต้องเรียก checkInitialConnection() ใหม่ หรือ reset สถานะ
            resetWalletStatus(); 
        });
    }

    // --- Placeholder สำหรับ 3D Scene (จะนำ Three.js กลับมาทีหลัง) ---
    const riverContainer = document.getElementById('river-simulation');
    if (riverContainer) {
        riverContainer.innerHTML = "<p style='color:#00e5ff;'>3D Logic goes here (Three.js/Babylon.js)</p>";
    }

});