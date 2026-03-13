// DCF 財富規劃工具 v2.3.0 - 主要腳本（雲端版）

// ==================== API 配置 ====================
const API_BASE_URL = 'https://api.sgwm.cloud/api';

// ==================== 全局變量 ====================
let currentUser = null;
let currentRole = 'user';
let expenseCount = 0;
let currentReportId = null;

// ==================== DOM 載入初始化 ====================
document.addEventListener('DOMContentLoaded', async function() {
    const fillDateEl = document.getElementById('fill_date');
    if (fillDateEl) {
        fillDateEl.value = new Date().toLocaleDateString('zh-CN');
    }
    
    // 檢查本地 token
    const token = localStorage.getItem('dcf_token');
    if (token) {
        try {
            const response = await fetch(`${API_BASE_URL}/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.user) {
                currentUser = data.user;
                currentRole = data.user.role;
                showMainApp();
            }
        } catch (error) {
            console.error('自動登錄失敗：', error);
            localStorage.removeItem('dcf_token');
        }
    }
});

// ==================== 年齡計算 ====================
function calcAge() {
    const birthDate = new Date(document.getElementById('birth_date').value);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    const ageInput = document.getElementById('current_age');
    if (ageInput) ageInput.value = age > 0 ? age : '';
}

// ==================== 登錄/註冊 ====================
function showRegister() {
    document.getElementById('loginForm').classList.add('hidden');
    document.getElementById('registerForm').classList.remove('hidden');
    document.getElementById('loginTitle').textContent = '用戶註冊';
}

function showLogin() {
    document.getElementById('registerForm').classList.add('hidden');
    document.getElementById('loginForm').classList.remove('hidden');
    document.getElementById('loginTitle').textContent = '用戶登錄';
}

async function register() {
    const username = document.getElementById('regUsername').value;
    const phone = document.getElementById('regPhone').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    const password2 = document.getElementById('regPassword2').value;

    if (!username || !phone || !email || !password) {
        alert('請填寫所有必填項');
        return;
    }
    if (password.length < 6) {
        alert('密碼至少6位');
        return;
    }
    if (password !== password2) {
        alert('兩次密碼不一致');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, phone, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('註冊成功！請登錄');
            showLogin();
        } else {
            alert(data.error || '註冊失敗');
        }
    } catch (error) {
        alert('註冊失敗：' + error.message);
    }
}

async function login() {
    const account = document.getElementById('loginAccount').value;
    const password = document.getElementById('loginPassword').value;

    if (!account || !password) {
        alert('請填寫賬號和密碼');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: account, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            localStorage.setItem('dcf_token', data.token);
            localStorage.setItem('dcf_user', JSON.stringify(data.user));
            
            currentUser = data.user;
            currentRole = data.user.role;
            showMainApp();
        } else {
            alert(data.error || '登錄失敗');
        }
    } catch (error) {
        alert('登錄失敗：' + error.message);
    }
}

function logout() {
    currentUser = null;
    currentRole = 'user';
    localStorage.removeItem('dcf_token');
    localStorage.removeItem('dcf_user');
    document.getElementById('mainApp').classList.add('hidden');
    document.getElementById('loginPage').classList.remove('hidden');
}

function showMainApp() {
    document.getElementById('loginPage').classList.add('hidden');
    document.getElementById('mainApp').classList.remove('hidden');
    
    document.getElementById('currentUser').textContent = `歡迎，${currentUser.username}`;
    document.getElementById('userRole').textContent = currentUser.role === 'admin' ? '管理員' : '普通用戶';

    if (currentUser.role === 'admin') {
        document.getElementById('userTabs').classList.add('hidden');
        document.getElementById('adminTabs').classList.remove('hidden');
        loadAdminData();
    } else {
        document.getElementById('userTabs').classList.remove('hidden');
        document.getElementById('adminTabs').classList.add('hidden');
        loadUserHistory();
        loadProgress();
    }
}

// ==================== Tab 切換 ====================
function showTab(n) {
    document.querySelectorAll('#userTabs .tab').forEach((t, i) => t.classList.toggle('active', i === n));
    document.querySelectorAll('.tab-content').forEach((c, i) => c.classList.toggle('active', i === n));
}

function nextTab() {
    const currentTab = document.querySelector('.tab-content.active');
    const tabs = document.querySelectorAll('.tab-content');
    let currentIndex = Array.from(tabs).indexOf(currentTab);
    if (currentIndex < 3) {
        autoSaveProgress();
        showTab(currentIndex + 1);
    }
}

// 自動保存進度
async function autoSaveProgress() {
    if (!currentUser) return;
    
    const token = localStorage.getItem('dcf_token');
    const data = collectFormData();
    
    try {
        await fetch(`${API_BASE_URL}/progress`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ data })
        });
    } catch (error) {
        console.error('自動保存失敗：', error);
    }
}

// 恢復進度
async function loadProgress() {
    const token = localStorage.getItem('dcf_token');
    if (!token) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/progress`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        
        if (data.progress) {
            loadReportData(data.progress);
            console.log('已恢復上次填寫進度');
        }
    } catch (error) {
        console.error('恢復進度失敗：', error);
    }
}

async function saveAndCalculate() {
    if (!currentUser) {
        alert('請先登錄');
        return;
    }
    
    const token = localStorage.getItem('dcf_token');
    const data = collectFormData();
    
    try {
        const response = await fetch(`${API_BASE_URL}/reports`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ data, isComplete: true })
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert('保存成功！');
            loadUserHistory();
            showTab(3);
            setTimeout(() => calculate(), 100);
        } else {
            alert(result.error || '保存失敗');
        }
    } catch (error) {
        alert('保存失敗：' + error.message);
    }
}

function showAdminTab(n) {
    document.querySelectorAll('#adminTabs .tab').forEach((t, i) => t.classList.toggle('active', i === n));
    document.querySelectorAll('[id^="admin-tab-"]').forEach((c, i) => c.classList.toggle('active', i === n));
}

// 其他函數保持不變...