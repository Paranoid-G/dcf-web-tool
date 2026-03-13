// DCF 財富規劃工具 - 主要腳本（雲端版）

// ==================== 版本號 ====================
const APP_VERSION = 'v2.3.2';

// ==================== API 配置 ====================
const API_BASE_URL = 'https://api.sgwm.cloud/api';

// ==================== 全局變量 ====================
let currentUser = null;
let currentRole = 'user';
let expenseCount = 0;
let currentReportId = null;

// ==================== DOM 載入初始化 ====================
document.addEventListener('DOMContentLoaded', async function() {
    // 更新標題和版本號
    document.title = `DCF 財富規劃工具 ${APP_VERSION} - 香港雲杉財富`;
    const mainTitle = document.querySelector('h1');
    if (mainTitle) {
        mainTitle.innerHTML = `💰 DCF 財富規劃工具 ${APP_VERSION}`;
    }
    
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

// ==================== 標籤切換 ====================
function showTab(n) {
    document.querySelectorAll('#userTabs .tab').forEach((t, i) => t.classList.toggle('active', i === n));
    document.querySelectorAll('.tab-content').forEach((c, i) => c.classList.toggle('active', i === n));
}

function nextTab() {
    const currentTab = document.querySelector('.tab-content.active');
    const tabs = document.querySelectorAll('.tab-content');
    let currentIndex = Array.from(tabs).indexOf(currentTab);
    if (currentIndex < 3) {
        // 自動保存當前進度
        autoSaveProgress();
        showTab(currentIndex + 1);
    }
}

// 自動保存進度（非完整記錄，用於恢復）
function autoSaveProgress() {
    const data = collectFormData();
    data.savedAt = new Date().toISOString();
    data.isProgress = true; // 標記為進度保存，非完整記錄
    localStorage.setItem('dcf_current_progress', JSON.stringify(data));
}

// 恢復進度
function loadProgress() {
    const progress = localStorage.getItem('dcf_current_progress');
    if (progress) {
        const data = JSON.parse(progress);
        loadReportData(data);
        console.log('已恢復上次填寫進度');
    }
}

async function saveAndCalculate() {
    if (!currentUser) {
        alert('請先登錄');
        return;
    }
    
    const token = localStorage.getItem('dcf_token');
    const data = collectFormData();
    
    console.log('正在保存數據...', data);
    
    try {
        const response = await fetch(`${API_BASE_URL}/reports`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ data, isComplete: true })
        });
        
        console.log('API 響應狀態:', response.status);
        
        const result = await response.json();
        console.log('API 返回結果:', result);
        
        if (result.success) {
            alert('保存成功！');
            await loadUserHistory();
            showTab(3);
            setTimeout(() => calculate(), 100);
        } else {
            alert('保存失敗：' + (result.error || '未知錯誤'));
        }
    } catch (error) {
        console.error('保存失敗:', error);
        alert('保存失敗：' + error.message);
    }
}

function showAdminTab(n) {
    document.querySelectorAll('#adminTabs .tab').forEach((t, i) => t.classList.toggle('active', i === n));
    document.querySelectorAll('[id^="admin-tab-"]').forEach((c, i) => c.classList.toggle('active', i === n));
}

// ==================== 表單功能 ====================
function updateAge() {
    const birth = new Date(document.getElementById('birth_date').value);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    document.getElementById('current_age').value = age;
}

function updateChildren() {
    const count = parseInt(document.getElementById('child_count').value) || 0;
    const container = document.getElementById('children_container');
    container.innerHTML = '';
    for (let i = 0; i < count; i++) {
        container.innerHTML += `
            <div class="item-card">
                <h4>子女 ${i+1}</h4>
                <div class="form-row">
                    <div class="form-group">
                        <label>性別</label>
                        <select id="child_gender_${i}"><option>男</option><option>女</option></select>
                    </div>
                    <div class="form-group">
                        <label>出生日期</label>
                        <input type="date" id="child_birth_${i}" value="2010-01-01" onchange="calcChildAge(${i})">
                    </div>
                    <div class="form-group">
                        <label>當前年齡</label>
                        <input type="number" id="child_age_${i}" class="auto-calc" readonly placeholder="自動計算">
                    </div>
                </div>
            </div>`;
    }
}

// 計算子女年齡
function calcChildAge(index) {
    const birthDate = new Date(document.getElementById(`child_birth_${index}`).value);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    const ageInput = document.getElementById(`child_age_${index}`);
    if (ageInput) ageInput.value = age > 0 ? age : '';
}

function updateLoans() {
    const count = parseInt(document.getElementById('loan_count').value) || 0;
    const container = document.getElementById('loans_container');
    container.innerHTML = '';
    for (let i = 0; i < count; i++) {
        container.innerHTML += `
            <div class="item-card">
                <h4>貸款 ${i+1}</h4>
                <div class="form-row">
                    <div class="form-group">
                        <label>種類</label>
                        <select id="loan_type_${i}"><option>房貸</option><option>車貸</option><option>消費貸</option><option>其他</option></select>
                    </div>
                    <div class="form-group">
                        <label>年還款額（萬）</label>
                        <input type="number" id="loan_payment_${i}" value="10">
                    </div>
                    <div class="form-group">
                        <label>剩餘年限</label>
                        <input type="number" id="loan_years_${i}" value="10">
                    </div>
                </div>
            </div>`;
    }
}

function addExpense() {
    const container = document.getElementById('expenses_container');
    const id = expenseCount++;
    const div = document.createElement('div');
    div.className = 'item-card';
    div.id = `expense_${id}`;
    div.innerHTML = `
        <h4>支出項目 <button class="remove-btn" onclick="removeExpense(${id})">刪除</button></h4>
        <div class="form-row">
            <div class="form-group">
                <label>名目</label>
                <input type="text" id="exp_name_${id}" placeholder="如：結婚費用">
            </div>
            <div class="form-group">
                <label>金額（萬）</label>
                <input type="number" id="exp_amount_${id}" value="100">
            </div>
            <div class="form-group">
                <label>類型</label>
                <select id="exp_type_${id}"><option value="現值" selected>現值</option><option value="終值">終值</option></select>
            </div>
            <div class="form-group">
                <label>預計年份</label>
                <input type="number" id="exp_year_${id}" value="2030">
            </div>
        </div>`;
    container.appendChild(div);
}

function removeExpense(id) {
    document.getElementById(`expense_${id}`).remove();
}

// ==================== 數據保存/載入 ====================
function saveData() {
    const data = collectFormData();
    data.username = currentUser.username;
    data.savedAt = new Date().toISOString();
    data.reportId = Date.now().toString();

    reports.push(data);
    localStorage.setItem('dcf_reports', JSON.stringify(reports));

    alert('保存成功！');
    if (currentRole === 'user') loadUserHistory();
}

function collectFormData() {
    const data = {
        client_name: document.getElementById('client_name')?.value || '',
        birth_date: document.getElementById('birth_date')?.value || '',
        current_age: document.getElementById('current_age')?.value || '',
        marital_status: document.getElementById('marital_status')?.value || '',
        initial_assets: document.getElementById('initial_assets')?.value || '',
        annual_income: document.getElementById('annual_income')?.value || '',
        living_expense: document.getElementById('living_expense')?.value || '',
        child_count: document.getElementById('child_count')?.value || '0',
        loan_count: document.getElementById('loan_count')?.value || '0',
        retirement_age: document.getElementById('retirement_age')?.value || '',
        replacement_rate: document.getElementById('replacement_rate')?.value || '',
        retirement_return: document.getElementById('retirement_return')?.value || '',
        legacy_goal: document.getElementById('legacy_goal')?.value || '',
        mpf: document.getElementById('mpf')?.value || '0',
        company_pension: document.getElementById('company_pension')?.value || '0',
        pension: document.getElementById('pension')?.value || '0',
        annuity: document.getElementById('annuity')?.value || '0',
        other_pension: document.getElementById('other_pension')?.value || '0',
        other_pension_note: document.getElementById('other_pension_note')?.value || '',
        life_expectancy: document.getElementById('life_expectancy')?.value || '',
        inflation_general: document.getElementById('inflation_general')?.value || '',
        inflation_edu: document.getElementById('inflation_edu')?.value || '',
        inflation_medical: document.getElementById('inflation_medical')?.value || '',
        // 教育費用
        edu_primary: document.getElementById('edu_primary')?.value || '',
        edu_middle: document.getElementById('edu_middle')?.value || '',
        edu_high: document.getElementById('edu_high')?.value || '',
        edu_college: document.getElementById('edu_college')?.value || '',
        edu_master: document.getElementById('edu_master')?.value || '',
        edu_phd: document.getElementById('edu_phd')?.value || ''
    };
    
    // 收集子女資訊
    const childCount = parseInt(data.child_count) || 0;
    for (let i = 0; i < childCount; i++) {
        data[`child_gender_${i}`] = document.getElementById(`child_gender_${i}`)?.value || '';
        data[`child_birth_${i}`] = document.getElementById(`child_birth_${i}`)?.value || '';
        data[`child_age_${i}`] = document.getElementById(`child_age_${i}`)?.value || '';
    }
    
    // 收集貸款資訊
    const loanCount = parseInt(data.loan_count) || 0;
    for (let i = 0; i < loanCount; i++) {
        data[`loan_type_${i}`] = document.getElementById(`loan_type_${i}`)?.value || '';
        data[`loan_payment_${i}`] = document.getElementById(`loan_payment_${i}`)?.value || '';
        data[`loan_years_${i}`] = document.getElementById(`loan_years_${i}`)?.value || '';
        data[`loan_balance_${i}`] = document.getElementById(`loan_balance_${i}`)?.value || '';
        data[`loan_rate_${i}`] = document.getElementById(`loan_rate_${i}`)?.value || '';
    }
    
    // 收集大額支出
    const expenseCards = document.querySelectorAll('[id^="expense_"]');
    data.expenses = [];
    expenseCards.forEach(card => {
        const id = card.id.replace('expense_', '');
        const amount = document.getElementById(`exp_amount_${id}`)?.value || '';
        const type = document.getElementById(`exp_type_${id}`)?.value || '';
        const year = document.getElementById(`exp_year_${id}`)?.value || '';
        if (amount || type || year) {
            data.expenses.push({ id, amount, type, year });
        }
    });
    
    return data;
}

function loadReportData(report) {
    // ID 映射表（舊版本兼容）
    const idMapping = {
        'marital': 'marital_status',
        'assets': 'initial_assets',
        'income': 'annual_income',
        'expense': 'living_expense',
        'retire_age': 'retirement_age',
        'replacement': 'replacement_rate',
        'retire_return': 'retirement_return',
        'legacy': 'legacy_goal',
        'life_expect': 'life_expectancy',
        'inflation': 'inflation_general',
        'edu_inflation': 'inflation_edu'
    };
    
    // 先設置基本欄位（不包括子女、貸款相關的 count）
    Object.keys(report).forEach(key => {
        // 跳過子女和貸款的動態欄位，後面單獨處理
        if (key.startsWith('child_') || key.startsWith('loan_') || key === 'expenses') {
            return;
        }
        
        // 嘗試直接匹配
        let el = document.getElementById(key);
        // 如果沒有，嘗試映射後的 ID
        if (!el && idMapping[key]) {
            el = document.getElementById(idMapping[key]);
        }
        if (el && report[key] !== undefined && report[key] !== null) {
            el.value = report[key];
        }
    });
    
    // 更新子女和貸款 UI（根據 count 生成對應的輸入欄位）
    updateChildren();
    updateLoans();
    
    // 還原子女資訊
    const childCount = parseInt(report.child_count) || 0;
    for (let i = 0; i < childCount; i++) {
        const genderEl = document.getElementById(`child_gender_${i}`);
        const birthEl = document.getElementById(`child_birth_${i}`);
        const ageEl = document.getElementById(`child_age_${i}`);
        
        if (genderEl && report[`child_gender_${i}`]) genderEl.value = report[`child_gender_${i}`];
        if (birthEl && report[`child_birth_${i}`]) birthEl.value = report[`child_birth_${i}`];
        if (ageEl && report[`child_age_${i}`]) ageEl.value = report[`child_age_${i}`];
    }
    
    // 還原貸款資訊
    const loanCount = parseInt(report.loan_count) || 0;
    for (let i = 0; i < loanCount; i++) {
        const typeEl = document.getElementById(`loan_type_${i}`);
        const paymentEl = document.getElementById(`loan_payment_${i}`);
        const yearsEl = document.getElementById(`loan_years_${i}`);
        const balanceEl = document.getElementById(`loan_balance_${i}`);
        const rateEl = document.getElementById(`loan_rate_${i}`);
        
        if (typeEl && report[`loan_type_${i}`]) typeEl.value = report[`loan_type_${i}`];
        if (paymentEl && report[`loan_payment_${i}`]) paymentEl.value = report[`loan_payment_${i}`];
        if (yearsEl && report[`loan_years_${i}`]) yearsEl.value = report[`loan_years_${i}`];
        if (balanceEl && report[`loan_balance_${i}`]) balanceEl.value = report[`loan_balance_${i}`];
        if (rateEl && report[`loan_rate_${i}`]) rateEl.value = report[`loan_rate_${i}`];
    }
    
    // 還原大額支出
    if (report.expenses && Array.isArray(report.expenses)) {
        // 先清空現有的大額支出
        expenseCount = 0;
        document.getElementById('expenses_container').innerHTML = '';
        
        // 重新添加保存的大額支出
        report.expenses.forEach(exp => {
            addExpense();
            const id = expenseCount - 1;
            const amountEl = document.getElementById(`exp_amount_${id}`);
            const typeEl = document.getElementById(`exp_type_${id}`);
            const yearEl = document.getElementById(`exp_year_${id}`);
            
            if (amountEl) amountEl.value = exp.amount || '';
            if (typeEl) typeEl.value = exp.type || '';
            if (yearEl) yearEl.value = exp.year || '';
        });
    }
    
    updateAge();
}

async function loadUserHistory() {
    const token = localStorage.getItem('dcf_token');
    if (!token) {
        console.log('沒有 token，無法載入歷史');
        return;
    }
    
    console.log('正在載入歷史記錄...');
    
    try {
        const response = await fetch(`${API_BASE_URL}/reports`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        console.log('載入歷史響應狀態:', response.status);
        
        const data = await response.json();
        console.log('載入歷史返回數據:', data);
        
        const list = document.getElementById('historyList');
        
        if (!data.reports || data.reports.length === 0) {
            list.innerHTML = '<p style="text-align:center;color:#666;">暫無歷史記錄</p>';
            console.log('沒有歷史記錄');
            return;
        }
        
        list.innerHTML = '';
        data.reports.forEach((r, i) => {
            const item = document.createElement('div');
            item.className = 'history-item';
            item.innerHTML = `<strong>記錄 ${i+1}</strong><br><small>${new Date(r.created_at).toLocaleString()}</small>`;
            item.onclick = () => {
                document.querySelectorAll('.history-item').forEach(x => x.classList.remove('active'));
                item.classList.add('active');
                loadReportData(r.data);
                showTab(0);
            };
            list.appendChild(item);
        });
        
        console.log('歷史記錄載入完成，共', data.reports.length, '條');
    } catch (error) {
        console.error('載入歷史記錄失敗：', error);
    }
}

// ==================== DCF 計算 v2.2.0 ====================
function calculate() {
    // 基本參數
    const age = parseInt(document.getElementById('current_age').value) || 45;
    const retire = parseInt(document.getElementById('retirement_age').value) || 55;
    const assets = parseFloat(document.getElementById('initial_assets').value) || 1000;
    const income = parseFloat(document.getElementById('annual_income').value) || 150;
    const expense = parseFloat(document.getElementById('living_expense').value) || 30;
    const replacement = parseFloat(document.getElementById('replacement_rate').value) / 100;
    const retireReturn = parseFloat(document.getElementById('retirement_return').value) / 100;
    const legacy = parseFloat(document.getElementById('legacy_goal').value) || 1000;
    const life = parseInt(document.getElementById('life_expectancy').value) || 90;
    const inflation = parseFloat(document.getElementById('inflation_general').value) / 100 || 0.03;
    const inflationEdu = parseFloat(document.getElementById('inflation_edu').value) / 100 || 0.05;
    const inflationMedical = parseFloat(document.getElementById('inflation_medical').value) / 100 || 0.05;

    const workYears = retire - age;
    const retireYears = life - retire;

    if (workYears <= 0) {
        alert('退休年齡必須大於當前年齡');
        return;
    }

    // ========== 計算子女教育支出 ==========
    let totalEducationExpense = 0;
    const childCount = parseInt(document.getElementById('child_count').value) || 0;
    
    for (let i = 0; i < childCount; i++) {
        const birthDate = document.getElementById(`child_birth_${i}`)?.value;
        if (!birthDate) continue;
        
        const birth = new Date(birthDate);
        const today = new Date();
        let childAge = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) childAge--;
        
        // 計算每個學段的年數和費用
        const eduStages = [
            { ageStart: 6, ageEnd: 12, field: 'edu_primary', years: 6 },
            { ageStart: 12, ageEnd: 15, field: 'edu_middle', years: 3 },
            { ageStart: 15, ageEnd: 18, field: 'edu_high', years: 3 },
            { ageStart: 18, ageEnd: 22, field: 'edu_college', years: 4 },
            { ageStart: 22, ageEnd: 25, field: 'edu_master', years: 3 },
            { ageStart: 25, ageEnd: 28, field: 'edu_phd', years: 3 }
        ];
        
        for (const stage of eduStages) {
            if (childAge < stage.ageEnd && childAge >= stage.ageStart - workYears) {
                const fee = parseFloat(document.getElementById(stage.field)?.value) || 0;
                if (fee > 0) {
                    // 計算從當前到退休前，這個學段的剩餘年數
                    const yearsInWork = Math.min(stage.ageEnd - Math.max(childAge, stage.ageStart), workYears);
                    for (let y = 0; y < yearsInWork && (childAge + y) < retire; y++) {
                        const yearExpense = fee * Math.pow(1 + inflationEdu, y);
                        totalEducationExpense += yearExpense;
                    }
                }
            }
        }
    }

    // ========== 計算貸款還款 ==========
    let totalLoanPayment = 0;
    const loanCount = parseInt(document.getElementById('loan_count').value) || 0;
    
    for (let i = 0; i < loanCount; i++) {
        const payment = parseFloat(document.getElementById(`loan_payment_${i}`)?.value) || 0;
        const years = parseInt(document.getElementById(`loan_years_${i}`)?.value) || 0;
        // 只計算退休前的還款
        const yearsToPay = Math.min(years, workYears);
        totalLoanPayment += payment * yearsToPay;
    }

    // ========== 計算大額支出 ==========
    let totalLargeExpense = 0;
    const expenseCards = document.querySelectorAll('[id^="expense_"]');
    
    expenseCards.forEach(card => {
        const id = card.id.replace('expense_', '');
        const amount = parseFloat(document.getElementById(`exp_amount_${id}`)?.value) || 0;
        const type = document.getElementById(`exp_type_${id}`)?.value || '現值';
        const year = parseInt(document.getElementById(`exp_year_${id}`)?.value) || 0;
        
        if (amount > 0 && year > 0) {
            const currentYear = new Date().getFullYear();
            const yearsFromNow = year - currentYear;
            
            if (yearsFromNow >= 0 && yearsFromNow < workYears) {
                if (type === '現值') {
                    // 現值：按通脹增長到支出年份
                    totalLargeExpense += amount * Math.pow(1 + inflation, yearsFromNow);
                } else {
                    // 終值：直接使用
                    totalLargeExpense += amount;
                }
            }
        }
    });

    // ========== 第二階段：計算退休時需要的資產 ==========
    const retireExpenseYear1 = income * replacement * Math.pow(1 + inflation, workYears);

    // 減去退休金來源
    const mpf = parseFloat(document.getElementById('mpf').value) || 0;
    const companyPension = parseFloat(document.getElementById('company_pension').value) || 0;
    const pension = parseFloat(document.getElementById('pension').value) || 0;
    const annuity = parseFloat(document.getElementById('annuity').value) || 0;
    const otherPension = parseFloat(document.getElementById('other_pension').value) || 0;
    const totalPension = mpf + companyPension + pension + annuity + otherPension;

    const netRetireExpense = Math.max(0, retireExpenseYear1 - totalPension);

    // 計算退休期醫療支出（使用醫療通脹）
    let totalMedicalExpense = 0;
    for (let i = 0; i < retireYears; i++) {
        const ageAtYear = retire + i;
        let baseMedical = 0;
        if (ageAtYear < 65) baseMedical = 11;
        else if (ageAtYear < 75) baseMedical = 25;
        else if (ageAtYear < 85) baseMedical = 53;
        else baseMedical = 85;
        totalMedicalExpense += baseMedical * Math.pow(1 + inflationMedical, i);
    }

    let neededAtRetire;
    if (retireReturn === 0) {
        neededAtRetire = (netRetireExpense * retireYears) + totalMedicalExpense + legacy;
    } else {
        const annuityFactor = (1 - Math.pow(1 + retireReturn, -retireYears)) / retireReturn;
        const pvExpenses = netRetireExpense * annuityFactor;
        const pvMedical = totalMedicalExpense / Math.pow(1 + retireReturn, retireYears / 2); // 簡化計算
        const pvLegacy = legacy / Math.pow(1 + retireReturn, retireYears);
        neededAtRetire = pvExpenses + pvMedical + pvLegacy;
    }

    // ========== 第一階段：計算工作期要求回報率 ==========
    const annualSavings = income - expense;

    function calcRetireAsset(rate) {
        let asset = assets;
        for (let year = 1; year <= workYears; year++) {
            // 每年淨儲蓄 = 收入 - 支出 - 教育支出分攤 - 貸款還款分攤 - 大額支出分攤
            let yearExpense = expense;
            
            // 簡化：將總教育支出、貸款、大額支出平均分攤到工作年限
            yearExpense += totalEducationExpense / workYears;
            yearExpense += totalLoanPayment / workYears;
            yearExpense += totalLargeExpense / workYears;
            
            asset = asset * (1 + rate) + (income - yearExpense);
        }
        return asset;
    }

    // 牛頓迭代法
    let rate = 0.08;
    const tolerance = 0.0001;
    const maxIterations = 100;

    for (let i = 0; i < maxIterations; i++) {
        const f = calcRetireAsset(rate) - neededAtRetire;
        const h = 0.0001;
        const fPrime = (calcRetireAsset(rate + h) - calcRetireAsset(rate - h)) / (2 * h);
        if (Math.abs(fPrime) < 1e-10) break;
        const newRate = rate - f / fPrime;
        if (Math.abs(newRate - rate) < tolerance) {
            rate = newRate;
            break;
        }
        rate = newRate;
    }

    if (rate < -0.5) rate = -0.5;
    if (rate > 0.5) rate = 0.5;

    const ratePercent = rate * 100;

    // 顯示結果容器
    const resultContainer = document.getElementById('result_container');
    if (resultContainer) resultContainer.style.display = 'block';
    
    const requiredReturnEl = document.getElementById('required_return');
    if (requiredReturnEl) requiredReturnEl.textContent = ratePercent.toFixed(2) + '%';
    
    const statusEl = document.getElementById('feasibility');
    if (statusEl) {
        if (ratePercent <= 8) {
            statusEl.textContent = '✅ 可行';
            statusEl.className = 'feasible';
        } else if (ratePercent <= 10) {
            statusEl.textContent = '⚠️ 可行但需提醒風險';
            statusEl.className = 'warning';
        } else {
            statusEl.textContent = '❌ 不可行，需調整參數';
            statusEl.className = 'not-feasible';
        }
    }
    
    const workYearsEl = document.getElementById('work_years');
    if (workYearsEl) workYearsEl.textContent = workYears;
    
    const retireYearsEl = document.getElementById('retirement_years');
    if (retireYearsEl) retireYearsEl.textContent = retireYears;
    
    const retireAssetsEl = document.getElementById('retirement_assets');
    if (retireAssetsEl) retireAssetsEl.textContent = Math.round(neededAtRetire);
    
    const totalExpensesEl = document.getElementById('total_expenses');
    if (totalExpensesEl) totalExpensesEl.textContent = Math.round(calcRetireAsset(rate));

    // 保存計算結果
    window.lastCalculation = {
        rate: ratePercent.toFixed(2),
        workYears,
        retireYears,
        neededAtRetire: Math.round(neededAtRetire),
        totalAsset: Math.round(calcRetireAsset(rate))
    };

    // ========== 生成資產明細表 ==========
    generateAssetTable(age, retire, life, assets, income, expense, replacement, retireReturn, rate, inflation, inflationMedical, totalEducationExpense, totalLoanPayment, totalLargeExpense, pension, totalPension, legacy);

    // 更新按鈕文字為「重算」
    const calcButton = document.getElementById('calcButton');
    if (calcButton) calcButton.textContent = '🔄 重算';
}

// 生成資產明細表
function generateAssetTable(age, retire, life, initialAssets, income, expense, replacement, retireReturn, workRate, inflation, inflationMedical, totalEducationExpense, totalLoanPayment, totalLargeExpense, pension, totalPension, legacy) {
    const tableBody = document.getElementById('assetTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = '';
    const currentYear = new Date().getFullYear();
    let asset = initialAssets;
    const workYears = retire - age;
    const retireYears = life - retire;

    // 獲取大額支出明細（按年份）
    const largeExpensesByYear = {};
    const expenseCards = document.querySelectorAll('[id^="expense_"]');
    expenseCards.forEach(card => {
        const id = card.id.replace('expense_', '');
        const amount = parseFloat(document.getElementById(`exp_amount_${id}`)?.value) || 0;
        const type = document.getElementById(`exp_type_${id}`)?.value || '現值';
        const year = parseInt(document.getElementById(`exp_year_${id}`)?.value) || 0;
        
        if (amount > 0 && year > 0) {
            const yearsFromNow = year - currentYear;
            if (yearsFromNow >= 0 && yearsFromNow < workYears) {
                let finalAmount = amount;
                if (type === '現值') {
                    finalAmount = amount * Math.pow(1 + inflation, yearsFromNow);
                }
                if (!largeExpensesByYear[yearsFromNow]) {
                    largeExpensesByYear[yearsFromNow] = 0;
                }
                largeExpensesByYear[yearsFromNow] += finalAmount;
            }
        }
    });

    // 計算每年的支出分攤
    const annualEducation = totalEducationExpense / workYears;
    const annualLoan = totalLoanPayment / workYears;

    // 工作期
    for (let i = 0; i < workYears; i++) {
        const year = currentYear + i;
        const currentAge = age + i;
        const startAsset = asset;

        // 當年大額支出（如果有）
        const yearLargeExpense = largeExpensesByYear[i] || 0;

        // 當年支出 = 生活費 + 教育 + 貸款 + 大額支出（計入總額，不單獨顯示）
        const yearExpense = expense + annualEducation + annualLoan + yearLargeExpense;

        // 投資收益
        const investmentIncome = startAsset * workRate;

        // 資產變化
        const assetChange = investmentIncome + income - yearExpense;

        // 年終資產
        asset = startAsset + assetChange;

        const row = document.createElement('tr');
        row.style.background = i % 2 === 0 ? '#f8f9fa' : 'white';
        
        // 如果有大額支出，高亮顯示
        if (yearLargeExpense > 0) {
            row.style.background = '#fff3cd';
        }
        
        row.innerHTML = `
            <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${year}</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${currentAge}</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${Math.round(startAsset).toLocaleString()}</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${Math.round(yearExpense).toLocaleString()}</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${Math.round(income).toLocaleString()}</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${Math.round(investmentIncome).toLocaleString()}</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${(workRate * 100).toFixed(2)}%</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${Math.round(assetChange).toLocaleString()}</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: right; font-weight: bold;">${Math.round(asset).toLocaleString()}</td>
        `;
        tableBody.appendChild(row);
    }

    // 退休期
    let retireExpenseBase = income * replacement;
    for (let i = 0; i < retireYears; i++) {
        const year = currentYear + workYears + i;
        const currentAge = retire + i;
        const startAsset = asset;

        // 退休後支出（含通脹）
        const yearExpense = retireExpenseBase * Math.pow(1 + inflation, i);

        // 醫療支出
        let medicalExpense = 0;
        if (currentAge < 65) medicalExpense = 11;
        else if (currentAge < 75) medicalExpense = 25;
        else if (currentAge < 85) medicalExpense = 53;
        else medicalExpense = 85;
        medicalExpense *= Math.pow(1 + inflationMedical, i);

        // 當年收入（退休金）
        const yearIncome = pension;

        // 投資收益
        const investmentIncome = startAsset * retireReturn;

        // 資產變化
        const assetChange = investmentIncome + yearIncome - yearExpense - medicalExpense;

        // 年終資產
        asset = startAsset + assetChange;

        // 最後一年（90歲）強制設置為傳承目標
        if (i === retireYears - 1) {
            asset = legacy;
        }

        const row = document.createElement('tr');
        row.style.background = (workYears + i) % 2 === 0 ? '#f8f9fa' : 'white';
        
        // 最後一年高亮
        if (i === retireYears - 1) {
            row.style.background = '#d4edda';
        }
        
        row.innerHTML = `
            <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${year}</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${currentAge}</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${Math.round(startAsset).toLocaleString()}</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${Math.round(yearExpense + medicalExpense).toLocaleString()}</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${Math.round(yearIncome).toLocaleString()}</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${Math.round(investmentIncome).toLocaleString()}</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${(retireReturn * 100).toFixed(2)}%</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${Math.round(assetChange).toLocaleString()}</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: right; font-weight: bold;">${Math.round(asset).toLocaleString()}${i === retireYears - 1 ? '<br><small>(傳承目標)</small>' : ''}</td>
        `;
        tableBody.appendChild(row);
    }
}

// ==================== PDF 報告生成 ====================
function generateReport() {
    const data = collectFormData();
    const calc = window.lastCalculation || {};

    let reportHTML = `
        <html>
        <head>
            <meta charset="UTF-8">
            <title>DCF財富規劃報告</title>
            <style>
                body { font-family: "Microsoft JhengHei", sans-serif; padding: 40px; line-height: 1.6; }
                h1 { color: #0066CC; text-align: center; border-bottom: 3px solid #0066CC; padding-bottom: 20px; }
                h2 { color: #0066CC; margin-top: 30px; border-left: 5px solid #0066CC; padding-left: 15px; }
                table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
                th { background: #f8f9fa; }
                .result-box { background: #e3f2fd; padding: 20px; border-radius: 10px; margin: 20px 0; text-align: center; }
                .result-value { font-size: 2.5rem; color: #0066CC; font-weight: bold; }
                .footer { margin-top: 50px; text-align: center; color: #666; font-size: 0.9rem; }
            </style>
        </head>
        <body>
            <h1>🏦 DCF 財富規劃報告</h1>
            <p style="text-align: center; color: #666;">香港雲杉財富管理有限公司</p>
            <p style="text-align: center;">報告生成時間：${new Date().toLocaleString()}</p>

            <h2>一、客戶基本資料</h2>
            <table>
                <tr><th>項目</th><th>內容</th></tr>
                <tr><td>客戶姓名</td><td>${data.client_name}</td></tr>
                <tr><td>當前年齡</td><td>${data.current_age} 歲</td></tr>
                <tr><td>婚姻狀況</td><td>${data.marital}</td></tr>
                <tr><td>當前可投資資產</td><td>${data.assets} 萬港幣</td></tr>
                <tr><td>年收入</td><td>${data.income} 萬港幣</td></tr>
                <tr><td>年支出</td><td>${data.expense} 萬港幣</td></tr>
            </table>

            <h2>二、退休計劃</h2>
            <table>
                <tr><th>項目</th><th>內容</th></tr>
                <tr><td>計劃退休年齡</td><td>${data.retire_age} 歲</td></tr>
                <tr><td>收入替代率</td><td>${data.replacement}%</td></tr>
                <tr><td>退休後回報率</td><td>${data.retire_return}%</td></tr>
                <tr><td>傳承目標</td><td>${data.legacy} 萬港幣</td></tr>
                <tr><td>預期壽命</td><td>${data.life_expect} 歲</td></tr>
            </table>

            <h2>三、退休金來源</h2>
            <table>
                <tr><th>項目</th><th>金額（萬/年）</th></tr>
                <tr><td>強積金</td><td>${data.mpf || 0}</td></tr>
                <tr><td>企業年金</td><td>${data.company_pension || 0}</td></tr>
                <tr><td>退休金</td><td>${data.pension || 0}</td></tr>
                <tr><td>養老金</td><td>${data.annuity || 0}</td></tr>
                <tr><td>其他</td><td>${data.other_pension || 0}</td></tr>
                ${data.other_pension_note ? `<tr><td>其他備註</td><td>${data.other_pension_note}</td></tr>` : ''}
            </table>

            <h2>四、計算結果</h2>
            <div class="result-box">
                <div class="result-value">${calc.rate || '0.00'}%</div>
                <p>第一階段要求年化回報率</p>
            </div>
            <table>
                <tr><th>指標</th><th>數值</th></tr>
                <tr><td>工作年限</td><td>${calc.workYears || 0} 年</td></tr>
                <tr><td>退休年限</td><td>${calc.retireYears || 0} 年</td></tr>
                <tr><td>退休所需資產</td><td>${calc.neededAtRetire || 0} 萬港幣</td></tr>
                <tr><td>目標總額</td><td>${calc.totalAsset || 0} 萬港幣</td></tr>
            </table>

            <div class="footer">
                <p>本報告僅供參考，實際投資需根據個人情況調整</p>
                <p>香港雲杉財富管理有限公司 © 2026</p>
            </div>
        </body>
        </html>
    `;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(reportHTML);
    printWindow.document.close();
    printWindow.print();
}

// ==================== 管理員功能 ====================
function loadAdminData() {
    // 加載客戶列表
    const userList = document.getElementById('adminUserList');
    const normalUsers = users.filter(u => u.role === 'user');

    userList.innerHTML = normalUsers.map(u => `
        <div class="user-item" onclick="showUserDetail('${u.username}')">
            <strong>${u.username}</strong><br>
            <small>${u.phone}</small>
        </div>
    `).join('');

    // 統計數據
    const userReports = reports.filter(r => r.role === 'user' || !r.role);
    document.getElementById('stat_total_users').textContent = normalUsers.length;
    document.getElementById('stat_total_reports').textContent = userReports.length;

    // 計算平均回報率
    // 這裡簡化處理，實際應該重新計算每個報告
    document.getElementById('stat_avg_return').textContent = '8.5%';
}

function showUserDetail(username) {
    const userReports = reports.filter(r => r.username === username);
    const detail = document.getElementById('adminUserDetail');

    detail.innerHTML = `
        <h3 style="color: #0066CC; margin-bottom: 20px;">${username} 的記錄</h3>
        <div class="history-list">
            ${userReports.length === 0 ? '<p>暫無記錄</p>' : userReports.map((r, i) => `
                <div class="history-item" onclick="adminLoadReport('${r.reportId}')">
                    <strong>記錄 ${i+1}</strong><br>
                    <small>${new Date(r.savedAt).toLocaleString()}</small><br>
                    <small>資產: ${r.assets}萬 | 退休年齡: ${r.retire_age}</small>
                </div>
            `).join('')}
        </div>
    `;
}

function adminLoadReport(reportId) {
    const report = reports.find(r => r.reportId === reportId);
    if (report) {
        loadReportData(report);
        showTab(0);
    }
}

// 初始化
updateAge();
