const today = new Date().toISOString().split('T')[0];
let cid = null;

const API_BASE = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
  ? (window.location.origin.startsWith('http://localhost') && !window.location.port
    ? 'https://shivkrupa-snacks.firwithrj.workers.dev'
    : '')
  : (window.location.origin.startsWith('file://')
    ? 'https://shivkrupa-snacks.firwithrj.workers.dev'
    : '');
let navHist = [];
let borrowers = [];
let cashflow = [];

// Offline Synchronization Queue & Local Caching Setup
let syncQueue = [];
try {
  syncQueue = JSON.parse(localStorage.getItem('sync_queue') || '[]');
} catch (e) {
  syncQueue = [];
}

function saveSyncQueue() {
  localStorage.setItem('sync_queue', JSON.stringify(syncQueue));
}

function saveCache() {
  localStorage.setItem('cached_borrowers', JSON.stringify(borrowers));
  localStorage.setItem('cached_cashflow', JSON.stringify(cashflow));
}

function renderActivePage() {
  const activePage = document.querySelector('.page.active');
  if (!activePage) return;
  const id = activePage.id;
  if (id === 'page-dashboard') updateDashboard();
  else if (id === 'page-borrowers') renderBorrowers();
  else if (id === 'page-pending') renderPending();
  else if (id === 'page-cashflow') renderCashflowPage();
  else if (id === 'page-profile') renderProfile();
}

let isSyncing = false;
async function triggerSync() {
  if (isSyncing || !navigator.onLine || syncQueue.length === 0) return;
  isSyncing = true;
  
  const failedToSync = [];
  
  for (const item of syncQueue) {
    try {
      // If this request depends on a temp borrower ID that has not yet succeeded, pause it
      if (item.options && item.options.body) {
        const bodyObj = JSON.parse(item.options.body);
        if (bodyObj.borrower_id && String(bodyObj.borrower_id).startsWith('temp_')) {
          failedToSync.push(item);
          continue;
        }
      }
      
      const url = API_BASE + item.path;
      const res = await fetch(url, item.options);
      if (!res.ok) {
        if (res.status >= 400 && res.status < 500) {
          console.warn(`Discarding invalid queued request to ${item.path}: Status ${res.status}`);
          continue;
        }
        throw new Error(`Server returned ${res.status}`);
      }
      
      const resData = await res.json().catch(() => ({}));
      
      // If adding borrower succeeded, map their temporary ID to the real database ID
      if (item.path === '/api/borrowers' && item.options.method === 'POST') {
        const tempId = item.tempId;
        const realId = resData.id;
        if (tempId && realId) {
          syncQueue.forEach(q => {
            if (q.options && q.options.body) {
              try {
                const bodyObj = JSON.parse(q.options.body);
                if (bodyObj.borrower_id === tempId) {
                  bodyObj.borrower_id = realId;
                  q.options.body = JSON.stringify(bodyObj);
                }
              } catch (e) {}
            }
          });
          
          borrowers.forEach(b => {
            if (b.id === tempId) {
              b.id = realId;
              (b.transactions || []).forEach(t => {
                if (t.borrower_id === tempId) t.borrower_id = realId;
              });
            }
          });
          
          if (cid === tempId) cid = realId;
          saveCache();
        }
      }
    } catch (err) {
      console.error(`Sync error on item ${item.id}:`, err);
      failedToSync.push(item);
    }
  }
  
  syncQueue = failedToSync;
  saveSyncQueue();
  isSyncing = false;
  
  if (syncQueue.length === 0) {
    showToast('All offline changes synced!');
    await fetchAllData(true);
  }
}

function queueSync(path, options, tempId = null) {
  if (options.method === 'DELETE' && path.startsWith('/api/borrowers/temp_')) {
    const targetTempId = path.split('/').pop();
    syncQueue = syncQueue.filter(q => !(q.path === '/api/borrowers' && q.tempId === targetTempId));
    saveSyncQueue();
    return;
  }
  if (options.method === 'DELETE' && path.startsWith('/api/cashflow/temp_')) {
    const targetTempId = path.split('/').pop();
    syncQueue = syncQueue.filter(q => !(q.path === '/api/cashflow' && q.tempId === targetTempId));
    saveSyncQueue();
    return;
  }
  
  syncQueue.push({
    id: Date.now() + Math.random().toString(36).substr(2, 5),
    path,
    options,
    tempId
  });
  saveSyncQueue();
  triggerSync();
}

async function fetchAllData(silent = false) {
  if (!navigator.onLine) return;
  try {
    const [bRes, cRes] = await Promise.all([
      fetch(API_BASE + '/api/borrowers').then(r => {
        if (!r.ok) throw new Error();
        return r.json();
      }),
      fetch(API_BASE + '/api/cashflow').then(r => {
        if (!r.ok) throw new Error();
        return r.json();
      })
    ]);
    
    const tempBorrowers = borrowers.filter(b => String(b.id).startsWith('temp_'));
    const tempCashflow = cashflow.filter(cf => String(cf.id).startsWith('temp_'));
    
    bRes.forEach(serverB => {
      const localB = borrowers.find(b => b.id === serverB.id);
      if (localB) {
        const localTempTxns = (localB.transactions || []).filter(t => String(t.id).startsWith('temp_'));
        if (localTempTxns.length > 0) {
          serverB.transactions = [...localTempTxns, ...(serverB.transactions || [])];
        }
      }
    });

    borrowers = [...tempBorrowers, ...bRes];
    cashflow = [...tempCashflow, ...cRes];
    
    saveCache();
    renderActivePage();
  } catch (err) {
    console.error('Background fetch failed:', err);
    if (!silent) {
      showToast('Offline mode active. Displaying cached data.');
    }
  }
}

// Automatically trigger sync when connection is restored
window.addEventListener('online', () => {
  showToast('Network connection restored.');
  triggerSync();
});

// Periodic background sync and poll for new data every 8 seconds
setInterval(() => {
  if (navigator.onLine) {
    triggerSync();
    fetchAllData(true);
  }
}, 8000);

function stats(b) {
  const transactions = b.transactions || [];
  const tb = transactions.filter(t => t.type === 'borrow').reduce((s, t) => s + t.amount, 0);
  const tr = transactions.filter(t => t.type === 'received').reduce((s, t) => s + t.amount, 0);
  return { tb, tr, pending: tb - tr };
}

function fmt(n) {
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

function fmtD(d) {
  if (!d) return '-';
  const parts = d.split('-');
  if (parts.length < 3) return d;
  const [y, m, day] = parts;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return parseInt(day) + ' ' + months[parseInt(m) - 1];
}

function initials(name) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function showPage(name, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-pill').forEach(b => b.classList.remove('active'));
  
  const targetPage = document.getElementById('page-' + name);
  if (targetPage) targetPage.classList.add('active');
  
  if (btn) btn.classList.add('active');
  
  document.getElementById('back-btn').style.display = 'none';
  document.getElementById('fab-wrap').style.display = 'block';
  document.getElementById('main-nav').style.display = 'flex';
  document.getElementById('tb-title').textContent = 'Shivkrupa Snacks';
  document.getElementById('tb-sub').textContent = 'Track every transaction';
  
  if (name === 'dashboard') updateDashboard();
  if (name === 'borrowers') renderBorrowers();
  if (name === 'pending') renderPending();
  if (name === 'cashflow') renderCashflowPage();
}

function openProfile(id) {
  cid = id;
  const activeNav = document.querySelector('.nav-pill.active');
  if (activeNav) navHist.push(activeNav);
  
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-profile').classList.add('active');
  document.getElementById('back-btn').style.display = 'flex';
  document.getElementById('fab-wrap').style.display = 'none';
  document.getElementById('main-nav').style.display = 'none';
  renderProfile();
}

function goBack() {
  showPage('borrowers', null);
  const prev = navHist.pop();
  document.querySelectorAll('.nav-pill').forEach(b => b.classList.remove('active'));
  if (prev) {
    prev.classList.add('active');
  } else {
    document.getElementById('nav-btn-borrowers').classList.add('active');
  }
}

function renderProfile() {
  const b = borrowers.find(x => x.id === cid);
  if (!b) return;
  const { tb, tr, pending } = stats(b);
  document.getElementById('tb-title').textContent = b.name;
  document.getElementById('tb-sub').textContent = b.phone;
  
  document.getElementById('profile-hero').innerHTML = `
    <div class="ph-avatar">${initials(b.name)}</div>
    <div class="ph-name">${b.name}</div>
    <div class="ph-phone"><i class="ti ti-phone" style="font-size:13px" aria-hidden="true"></i>${b.phone}${b.address ? ' &nbsp;·&nbsp; ' + b.address : ''}</div>
    <div class="ph-stats-row">
      <div class="ph-stat"><div class="ph-stat-label">Borrowed</div><div class="ph-stat-val" style="color:var(--coral)">${fmt(tb)}</div></div>
      <div class="ph-stat"><div class="ph-stat-label">Received</div><div class="ph-stat-val" style="color:var(--em)">${fmt(tr)}</div></div>
      <div class="ph-stat"><div class="ph-stat-label">Pending</div><div class="ph-stat-val" style="color:var(--amber)">${fmt(pending)}</div></div>
    </div>`;
    
  const transactions = b.transactions || [];
  const sorted = [...transactions].sort((a, z) => z.date.localeCompare(a.date) || z.id - a.id);
  const el = document.getElementById('profile-txns');
  
  el.innerHTML = sorted.length ? sorted.map(t => `
    <div class="txn-item">
      <div class="txn-icon-wrap"><i class="ti ${t.type === 'borrow' ? 'ti-arrow-up-right ti-borrow' : 'ti-arrow-down-left ti-received'}" aria-hidden="true"></i></div>
      <div class="txn-info" style="flex: 1; min-width: 0;">
        <div class="txn-name" style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
          <span style="font-weight: 500;">${t.item || 'Payment'}${t.qty && t.qty > 1 ? ' × ' + t.qty : ''}</span>
          ${t.defect_detected && t.defect_detected !== 'none' ? `<span class="badge" style="background: rgba(235, 94, 85, 0.15); color: var(--coral); font-size: 8px; font-weight: 600; padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(235, 94, 85, 0.3); text-transform: uppercase;">Defect: ${t.defect_detected}</span>` : ''}
        </div>
        <div class="txn-date">${fmtD(t.date)}${t.remarks ? ' · ' + t.remarks : ''}</div>
      </div>
      <div class="txn-amount ${t.type === 'borrow' ? 'debit' : 'credit'}">${t.type === 'borrow' ? '−' : '+'}${fmt(t.amount)}</div>
    </div>`).join('') : '<div class="empty-state"><i class="ti ti-file-off" aria-hidden="true"></i><p>No transactions yet</p></div>';
}

function renderBorrowers() {
  const nm = (document.getElementById('s-name').value || '').toLowerCase();
  const ph = document.getElementById('s-phone').value || '';
  const it = (document.getElementById('s-item').value || '').toLowerCase();
  let list = borrowers;
  
  if (nm) list = list.filter(b => b.name.toLowerCase().includes(nm));
  if (ph) list = list.filter(b => b.phone.includes(ph));
  if (it) list = list.filter(b => (b.transactions || []).some(t => t.item && t.item.toLowerCase().includes(it)));
  
  const el = document.getElementById('borrower-list');
  if (!list.length) {
    el.innerHTML = '<div class="empty-state"><i class="ti ti-users-off" aria-hidden="true"></i><p>No borrowers found</p></div>';
    return;
  }
  
  el.innerHTML = list.map(b => {
    const { tb, pending } = stats(b);
    const transactions = b.transactions || [];
    const last = transactions.length ? transactions[0] : null; // index_agg returns sorted DESC
    return `<div class="card" onclick="openProfile(${b.id})">
      <div class="card-row">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:38px;height:38px;border-radius:10px;background:var(--bg);box-shadow:var(--raised-sm);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:500;color:var(--gold);flex-shrink:0">${initials(b.name)}</div>
          <div><div class="card-name">${b.name}</div><div class="card-phone"><i class="ti ti-phone" style="font-size:11px" aria-hidden="true"></i>${b.phone}</div></div>
        </div>
        <span class="badge ${pending > 0 ? 'badge-pending' : 'badge-clear'}">${pending > 0 ? 'Due' : 'Clear'}</span>
      </div>
      <div class="card-divider"></div>
      <div class="card-amounts">
        <div class="amt-item"><div class="amt-label">Borrowed</div><div class="amt-val" style="color:var(--coral)">${fmt(tb)}</div></div>
        <div class="amt-item"><div class="amt-label">Pending</div><div class="amt-val" style="color:var(--amber)">${fmt(pending)}</div></div>
        <div class="amt-item"><div class="amt-label">Last txn</div><div class="amt-val" style="font-size:12px;color:var(--ink2)">${last ? fmtD(last.date) : '-'}</div></div>
      </div></div>`;
  }).join('');
}

function renderPending() {
  const list = borrowers.filter(b => stats(b).pending > 0).sort((a, b) => stats(b).pending - stats(a).pending);
  const el = document.getElementById('pending-list');
  if (!list.length) {
    el.innerHTML = '<div class="empty-state"><i class="ti ti-circle-check" aria-hidden="true"></i><p>No pending dues — all clear!</p></div>';
    return;
  }
  
  el.innerHTML = list.map(b => {
    const { tb, pending } = stats(b);
    return `<div class="card" onclick="openProfile(${b.id})">
      <div class="card-row">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:38px;height:38px;border-radius:10px;background:var(--bg);box-shadow:var(--raised-sm);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:500;color:var(--gold);flex-shrink:0">${initials(b.name)}</div>
          <div><div class="card-name">${b.name}</div><div class="card-phone"><i class="ti ti-phone" style="font-size:11px" aria-hidden="true"></i>${b.phone}</div></div>
        </div>
        <span class="badge badge-pending">${fmt(pending)}</span>
      </div>
      <div class="card-divider"></div>
      <div class="card-amounts">
        <div class="amt-item"><div class="amt-label">Total borrowed</div><div class="amt-val" style="color:var(--coral)">${fmt(tb)}</div></div>
        <div class="amt-item"><div class="amt-label">Pending</div><div class="amt-val" style="color:var(--amber)">${fmt(pending)}</div></div>
        <div class="amt-item"><div class="amt-label">Action</div><div class="amt-val" style="font-size:12px;color:var(--gold)">Remind →</div></div>
      </div></div>`;
  }).join('');
}

function calcCashflowStats() {
  let ti = 0, ci = 0, oi = 0;
  let te = 0, ce = 0, oe = 0;
  
  cashflow.forEach(x => {
    const amt = parseFloat(x.amount) || 0;
    if (x.type === 'income') {
      ti += amt;
      if (x.payment_method === 'cash') ci += amt;
      else oi += amt;
    } else if (x.type === 'expense') {
      te += amt;
      if (x.payment_method === 'cash') ce += amt;
      else oe += amt;
    }
  });
  return {
    totalIncome: ti, cashIncome: ci, onlineIncome: oi,
    totalExpense: te, cashExpense: ce, onlineExpense: oe,
    balance: ti - te
  };
}

function updateDashboard() {
  // 1. Borrower Ledger Stats
  const allT = borrowers.flatMap(b => (b.transactions || []).map(t => ({ ...t, bn: b.name })));
  const tb = allT.filter(t => t.type === 'borrow').reduce((s, t) => s + t.amount, 0);
  const tp = borrowers.reduce((s, b) => s + stats(b).pending, 0);
  const tod = allT.filter(t => t.date === today);
  const todAmt = tod.filter(t => t.type === 'borrow').reduce((s, t) => s + t.amount, 0);
  const mn = today.slice(0, 7);
  const monAmt = allT.filter(t => t.type === 'borrow' && t.date.startsWith(mn)).reduce((s, t) => s + t.amount, 0);
  
  document.getElementById('s1').innerHTML = `
    <div class="stat-well"><div class="stat-well-label">Total borrowed</div><div class="stat-well-val coral">${fmt(tb)}</div></div>
    <div class="stat-well"><div class="stat-well-label">Total pending</div><div class="stat-well-val amber">${fmt(tp)}</div></div>`;
    
  document.getElementById('s2').innerHTML = `
    <div class="stat-well"><div class="stat-well-label">Borrowers</div><div class="stat-well-val gold">${borrowers.length}</div></div>
    <div class="stat-well"><div class="stat-well-label">Today</div><div class="stat-well-val em">${fmt(todAmt)}</div></div>
    <div class="stat-well"><div class="stat-well-label">This month</div><div class="stat-well-val">${fmt(monAmt)}</div></div>`;
    
  // 2. Cashflow summary stats
  const cf = calcCashflowStats();
  document.getElementById('cf-dash-stats').innerHTML = `
    <div class="stat-well">
      <div class="stat-well-label">Total Income</div>
      <div class="stat-well-val em">${fmt(cf.totalIncome)}</div>
      <div class="sub-stat-well">
        <div class="sub-stat-row"><span>Cash:</span><span>${fmt(cf.cashIncome)}</span></div>
        <div class="sub-stat-row"><span>Online:</span><span>${fmt(cf.onlineIncome)}</span></div>
      </div>
    </div>
    <div class="stat-well">
      <div class="stat-well-label">Total Expense</div>
      <div class="stat-well-val coral">${fmt(cf.totalExpense)}</div>
      <div class="sub-stat-well">
        <div class="sub-stat-row"><span>Cash:</span><span>${fmt(cf.cashExpense)}</span></div>
        <div class="sub-stat-row"><span>Online:</span><span>${fmt(cf.onlineExpense)}</span></div>
      </div>
    </div>
    <div class="stat-well">
      <div class="stat-well-label">Total Balance</div>
      <div class="stat-well-val ${cf.balance >= 0 ? 'em' : 'coral'}">${fmt(cf.balance)}</div>
      <div class="sub-stat-well">
        <div class="sub-stat-row" style="font-weight: 500;"><span>Status:</span><span>${cf.balance >= 0 ? 'Surplus' : 'Deficit'}</span></div>
      </div>
    </div>`;

  // 3. Date Range analyzer
  const s = document.getElementById('dr-start').value, e = document.getElementById('dr-end').value;
  let rHtml = '<div style="font-size:12px;color:var(--ink3);padding:6px 0">Set a date range above to analyse transactions</div>';
  
  if (s && e) {
    const rd = allT.filter(t => t.date >= s && t.date <= e);
    const rb = rd.filter(t => t.type === 'borrow').reduce((sum, t) => sum + t.amount, 0);
    const rr = rd.filter(t => t.type === 'received').reduce((sum, t) => sum + t.amount, 0);
    rHtml = `
      <div class="range-row"><span style="color:var(--ink2)">Borrowed in range</span><span style="color:var(--coral);font-weight:500">${fmt(rb)}</span></div>
      <div class="range-row"><span style="color:var(--ink2)">Received in range</span><span style="color:var(--em);font-weight:500">${fmt(rr)}</span></div>
      <div class="range-row"><span style="color:var(--ink2)">Net outstanding</span><span style="color:var(--amber);font-weight:500">${fmt(rb - rr)}</span></div>
      <div class="range-row"><span style="color:var(--ink2)">Transactions</span><span style="font-weight:500;color:var(--ink)">${rd.length}</span></div>`;
  }
  document.getElementById('range-card').innerHTML = rHtml;
  
  const rec = allT.sort((a, z) => z.date.localeCompare(a.date) || z.id - a.id).slice(0, 6);
  document.getElementById('dash-txns').innerHTML = rec.length ? `<div class="txn-list">${rec.map(t => `
    <div class="txn-item">
      <div class="txn-icon-wrap"><i class="ti ${t.type === 'borrow' ? 'ti-arrow-up-right ti-borrow' : 'ti-arrow-down-left ti-received'}" aria-hidden="true"></i></div>
      <div class="txn-info"><div class="txn-name">${t.bn} · ${t.item || 'Payment'}</div><div class="txn-date">${fmtD(t.date)}</div></div>
      <div class="txn-amount ${t.type === 'borrow' ? 'debit' : 'credit'}">${t.type === 'borrow' ? '−' : '+'}${fmt(t.amount)}</div>
    </div>`).join('')}</div>` : '<div class="empty-state"><i class="ti ti-file-off" aria-hidden="true"></i><p>No transactions yet</p></div>';
}

function renderCashflowPage() {
  const cf = calcCashflowStats();
  
  document.getElementById('cf-stats-row').innerHTML = `
    <div class="stat-well">
      <div class="stat-well-label">Total Income</div>
      <div class="stat-well-val em" style="font-size:18px;">${fmt(cf.totalIncome)}</div>
      <div class="sub-stat-well">
        <div class="sub-stat-row"><span>Cash:</span><span>${fmt(cf.cashIncome)}</span></div>
        <div class="sub-stat-row"><span>Online:</span><span>${fmt(cf.onlineIncome)}</span></div>
      </div>
    </div>
    <div class="stat-well">
      <div class="stat-well-label">Total Expense</div>
      <div class="stat-well-val coral" style="font-size:18px;">${fmt(cf.totalExpense)}</div>
      <div class="sub-stat-well">
        <div class="sub-stat-row"><span>Cash:</span><span>${fmt(cf.cashExpense)}</span></div>
        <div class="sub-stat-row"><span>Online:</span><span>${fmt(cf.onlineExpense)}</span></div>
      </div>
    </div>
    <div class="stat-well">
      <div class="stat-well-label">Total Balance</div>
      <div class="stat-well-val ${cf.balance >= 0 ? 'em' : 'coral'}" style="font-size:18px;">${fmt(cf.balance)}</div>
      <div class="sub-stat-well">
        <div class="sub-stat-row" style="font-weight: 500;"><span>Status:</span><span>${cf.balance >= 0 ? 'Surplus' : 'Deficit'}</span></div>
      </div>
    </div>`;

  const q = (document.getElementById('cf-search-desc').value || '').toLowerCase();
  const typeFilter = document.getElementById('cf-filter-type').value;
  const methodFilter = document.getElementById('cf-filter-method').value;

  let list = cashflow;
  if (q) list = list.filter(x => (x.description || '').toLowerCase().includes(q));
  if (typeFilter !== 'all') list = list.filter(x => x.type === typeFilter);
  if (methodFilter !== 'all') list = list.filter(x => x.payment_method === methodFilter);

  const el = document.getElementById('cashflow-list');
  if (!list.length) {
    el.innerHTML = '<div class="empty-state"><i class="ti ti-file-off" aria-hidden="true"></i><p>No transactions found</p></div>';
    return;
  }

  el.innerHTML = `<div class="txn-list">${list.map(x => `
    <div class="txn-item">
      <div class="txn-icon-wrap">
        <i class="ti ${x.type === 'income' ? 'ti-arrow-down-left ti-received' : 'ti-arrow-up-right ti-borrow'}" aria-hidden="true"></i>
      </div>
      <div class="txn-info" style="flex:1; min-width:0;">
        <div class="txn-name" style="display:flex; align-items:center; gap:6px; flex-wrap: wrap;">
          <span style="font-weight: 500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width: 140px;">${x.description || (x.type === 'income' ? 'Income' : 'Expense')}</span>
          <span class="badge ${x.payment_method === 'cash' ? 'badge-cash' : 'badge-online'}" style="font-size:8px; padding:2px 6px;">${x.payment_method.toUpperCase()}</span>
          <span class="badge ${x.type === 'income' ? 'badge-income' : 'badge-expense'}" style="font-size:8px; padding:2px 6px;">${x.type.toUpperCase()}</span>
        </div>
        <div class="txn-date">${fmtD(x.date)}</div>
      </div>
      <div style="display:flex; align-items:center; gap:8px;">
        <div class="txn-amount ${x.type === 'income' ? 'credit' : 'debit'}" style="font-weight: 600;">
          ${x.type === 'income' ? '+' : '−'}${fmt(x.amount)}
        </div>
        <button onclick="deleteCashflowItem(${x.id})" style="background:transparent; border:none; color:var(--coral); cursor:pointer; font-size:14px; padding:4px;" title="Delete"><i class="ti ti-trash"></i></button>
      </div>
    </div>`).join('')}</div>`;
}

// REST API Mutation Triggers

async function addBorrower() {
  const name = document.getElementById('n-name').value.trim();
  const phone = document.getElementById('n-phone').value.trim();
  if (!name || !phone) { showToast('Name and phone are required'); return; }
  const open = parseFloat(document.getElementById('n-open').value) || 0;
  const address = document.getElementById('n-addr').value.trim();
  const notes = document.getElementById('n-notes').value.trim();

  const tempId = 'temp_b_' + Date.now();
  
  // Optimistically update local array and render
  const newB = {
    id: tempId,
    name,
    phone,
    address,
    notes,
    created_at: new Date().toISOString(),
    transactions: []
  };
  
  if (open > 0) {
    newB.transactions.push({
      id: 'temp_txn_open_' + Date.now(),
      type: 'borrow',
      amount: open,
      date: today,
      item: 'Opening balance',
      qty: 1,
      remarks: 'Opening balance',
      created_at: new Date().toISOString()
    });
  }
  
  borrowers.push(newB);
  saveCache();
  
  closeModal('add-modal');
  ['n-name', 'n-phone', 'n-addr', 'n-open', 'n-notes'].forEach(x => document.getElementById(x).value = '');
  
  renderActivePage();
  updateDashboard();
  
  try {
    if (!navigator.onLine) {
      queueSync('/api/borrowers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, address, notes, opening_balance: open })
      }, tempId);
      showToast('Offline. Borrower saved locally.');
      return;
    }
    
    const res = await fetch(API_BASE + '/api/borrowers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, address, notes, opening_balance: open })
    });
    
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to create borrower');
    }
    
    const serverB = await res.json();
    
    // Replace the temp borrower with the real borrower
    borrowers = borrowers.map(b => b.id === tempId ? serverB : b);
    if (cid === tempId) cid = serverB.id;
    
    saveCache();
    renderActivePage();
    updateDashboard();
    showToast('Borrower added successfully');
  } catch (err) {
    console.error(err);
    if (err.message && (err.message.includes('required') || err.message.includes('400'))) {
      borrowers = borrowers.filter(b => b.id !== tempId);
      saveCache();
      renderActivePage();
      showToast(err.message);
    } else {
      queueSync('/api/borrowers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, address, notes, opening_balance: open })
      }, tempId);
      showToast('Connection saved. Syncing in background.');
    }
  }
}

async function addBorrowTxn() {
  const amt = parseFloat(document.getElementById('b-amt').value);
  if (!amt || amt <= 0) { showToast('Enter a valid amount'); return; }
  const date = document.getElementById('b-date').value || today;
  const item = document.getElementById('b-item').value || 'Item';
  const qty = parseInt(document.getElementById('b-qty').value) || 1;
  const remarks = document.getElementById('b-rem').value;
  const defectVal = document.getElementById('b-defect').value;
  const defect = defectVal !== 'none' ? defectVal : null;

  const tempTxnId = 'temp_txn_' + Date.now();
  const borrower = borrowers.find(b => b.id === cid);
  if (!borrower) return;
  
  const tempTxn = {
    id: tempTxnId,
    type: 'borrow',
    amount: amt,
    date,
    item,
    qty,
    remarks,
    defect_detected: defect,
    created_at: new Date().toISOString()
  };
  
  // Optimistically push
  borrower.transactions = [tempTxn, ...(borrower.transactions || [])];
  saveCache();
  
  closeModal('borrow-modal');
  ['b-amt', 'b-item', 'b-qty', 'b-rem'].forEach(x => document.getElementById(x).value = '');
  document.getElementById('b-defect').value = 'none';
  
  renderActivePage();
  updateDashboard();
  
  try {
    if (!navigator.onLine) {
      queueSync('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ borrower_id: cid, type: 'borrow', date, item, qty, amount: amt, remarks, defect_detected: defect })
      });
      showToast('Offline. Transaction saved locally.');
      return;
    }
    
    const res = await fetch(API_BASE + '/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ borrower_id: cid, type: 'borrow', date, item, qty, amount: amt, remarks, defect_detected: defect })
    });
    
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to add transaction');
    }
    
    const serverTxn = await res.json();
    borrower.transactions = borrower.transactions.map(t => t.id === tempTxnId ? serverTxn : t);
    saveCache();
    renderActivePage();
    updateDashboard();
    showToast('Borrow recorded');
  } catch (err) {
    console.error(err);
    if (err.message && err.message.includes('400')) {
      borrower.transactions = borrower.transactions.filter(t => t.id !== tempTxnId);
      saveCache();
      renderActivePage();
      showToast(err.message);
    } else {
      queueSync('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ borrower_id: cid, type: 'borrow', date, item, qty, amount: amt, remarks, defect_detected: defect })
      });
      showToast('Connection saved. Syncing in background.');
    }
  }
}

async function addReceiveTxn() {
  const amt = parseFloat(document.getElementById('r-amt').value);
  if (!amt || amt <= 0) { showToast('Enter a valid amount'); return; }
  const date = document.getElementById('r-date').value || today;
  const item = document.getElementById('r-item').value || '';
  const remarks = document.getElementById('r-rem').value;
  const defectVal = document.getElementById('r-defect').value;
  const defect = defectVal !== 'none' ? defectVal : null;

  const tempTxnId = 'temp_txn_' + Date.now();
  const borrower = borrowers.find(b => b.id === cid);
  if (!borrower) return;
  
  const tempTxn = {
    id: tempTxnId,
    type: 'received',
    amount: amt,
    date,
    item,
    qty: 1,
    remarks,
    defect_detected: defect,
    created_at: new Date().toISOString()
  };
  
  borrower.transactions = [tempTxn, ...(borrower.transactions || [])];
  saveCache();
  
  closeModal('receive-modal');
  ['r-amt', 'r-item', 'r-rem'].forEach(x => document.getElementById(x).value = '');
  document.getElementById('r-defect').value = 'none';
  
  renderActivePage();
  updateDashboard();
  
  try {
    if (!navigator.onLine) {
      queueSync('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ borrower_id: cid, type: 'received', date, item, qty: 1, amount: amt, remarks, defect_detected: defect })
      });
      showToast('Offline. Payment saved locally.');
      return;
    }
    
    const res = await fetch(API_BASE + '/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ borrower_id: cid, type: 'received', date, item, qty: 1, amount: amt, remarks, defect_detected: defect })
    });
    
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to record payment');
    }
    
    const serverTxn = await res.json();
    borrower.transactions = borrower.transactions.map(t => t.id === tempTxnId ? serverTxn : t);
    saveCache();
    renderActivePage();
    updateDashboard();
    showToast('Payment recorded');
  } catch (err) {
    console.error(err);
    if (err.message && err.message.includes('400')) {
      borrower.transactions = borrower.transactions.filter(t => t.id !== tempTxnId);
      saveCache();
      renderActivePage();
      showToast(err.message);
    } else {
      queueSync('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ borrower_id: cid, type: 'received', date, item, qty: 1, amount: amt, remarks, defect_detected: defect })
      });
      showToast('Connection saved. Syncing in background.');
    }
  }
}

async function addIncome() {
  const date = document.getElementById('in-date').value || today;
  const amt = parseFloat(document.getElementById('in-amt').value);
  if (!amt || amt <= 0) { showToast('Enter a valid amount'); return; }
  const method = document.getElementById('in-method').value;
  const desc = document.getElementById('in-desc').value.trim() || 'Income';

  const tempId = 'temp_cf_' + Date.now();
  const tempCf = {
    id: tempId,
    type: 'income',
    amount: amt,
    date,
    payment_method: method,
    description: desc,
    created_at: new Date().toISOString()
  };
  
  cashflow = [tempCf, ...cashflow];
  saveCache();
  
  closeModal('income-modal');
  ['in-amt', 'in-desc'].forEach(x => document.getElementById(x).value = '');
  
  renderActivePage();
  updateDashboard();
  
  try {
    if (!navigator.onLine) {
      queueSync('/api/cashflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'income', amount: amt, date, payment_method: method, description: desc })
      }, tempId);
      showToast('Offline. Income saved locally.');
      return;
    }
    
    const res = await fetch(API_BASE + '/api/cashflow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'income', amount: amt, date, payment_method: method, description: desc })
    });
    
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to record income');
    }
    
    const serverCf = await res.json();
    cashflow = cashflow.map(x => x.id === tempId ? serverCf : x);
    saveCache();
    renderActivePage();
    updateDashboard();
    showToast('Income recorded successfully');
  } catch (err) {
    console.error(err);
    if (err.message && err.message.includes('400')) {
      cashflow = cashflow.filter(x => x.id !== tempId);
      saveCache();
      renderActivePage();
      showToast(err.message);
    } else {
      queueSync('/api/cashflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'income', amount: amt, date, payment_method: method, description: desc })
      }, tempId);
      showToast('Connection saved. Syncing in background.');
    }
  }
}

async function addExpense() {
  const date = document.getElementById('ex-date').value || today;
  const amt = parseFloat(document.getElementById('ex-amt').value);
  if (!amt || amt <= 0) { showToast('Enter a valid amount'); return; }
  const method = document.getElementById('ex-method').value;
  const desc = document.getElementById('ex-desc').value.trim();
  if (!desc) { showToast('Description is required for expenses'); return; }

  const tempId = 'temp_cf_' + Date.now();
  const tempCf = {
    id: tempId,
    type: 'expense',
    amount: amt,
    date,
    payment_method: method,
    description: desc,
    created_at: new Date().toISOString()
  };
  
  cashflow = [tempCf, ...cashflow];
  saveCache();
  
  closeModal('expense-modal');
  ['ex-amt', 'ex-desc'].forEach(x => document.getElementById(x).value = '');
  
  renderActivePage();
  updateDashboard();
  
  try {
    if (!navigator.onLine) {
      queueSync('/api/cashflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'expense', amount: amt, date, payment_method: method, description: desc })
      }, tempId);
      showToast('Offline. Expense saved locally.');
      return;
    }
    
    const res = await fetch(API_BASE + '/api/cashflow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'expense', amount: amt, date, payment_method: method, description: desc })
    });
    
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to record expense');
    }
    
    const serverCf = await res.json();
    cashflow = cashflow.map(x => x.id === tempId ? serverCf : x);
    saveCache();
    renderActivePage();
    updateDashboard();
    showToast('Expense recorded successfully');
  } catch (err) {
    console.error(err);
    if (err.message && err.message.includes('400')) {
      cashflow = cashflow.filter(x => x.id !== tempId);
      saveCache();
      renderActivePage();
      showToast(err.message);
    } else {
      queueSync('/api/cashflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'expense', amount: amt, date, payment_method: method, description: desc })
      }, tempId);
      showToast('Connection saved. Syncing in background.');
    }
  }
}

async function deleteCashflowItem(id) {
  if (!confirm("Are you sure you want to delete this cashflow record?")) return;
  
  cashflow = cashflow.filter(x => x.id !== id);
  saveCache();
  
  renderActivePage();
  updateDashboard();
  
  try {
    if (String(id).startsWith('temp_')) {
      syncQueue = syncQueue.filter(q => q.tempId !== id);
      saveSyncQueue();
      showToast('Offline record removed.');
      return;
    }
    
    if (!navigator.onLine) {
      queueSync(`/api/cashflow/${id}`, { method: 'DELETE' });
      showToast('Offline. Deletion queued.');
      return;
    }
    
    const res = await fetch(API_BASE + `/api/cashflow/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete cashflow record');
    showToast('Record deleted successfully');
  } catch (err) {
    console.error(err);
    queueSync(`/api/cashflow/${id}`, { method: 'DELETE' });
    showToast('Connection saved. Syncing deletion in background.');
  }
}

async function deleteCurrentBorrower() {
  if (!confirm("Are you sure you want to delete this borrower? All history will be deleted permanently.")) return;
  
  const targetId = cid;
  borrowers = borrowers.filter(b => b.id !== targetId);
  saveCache();
  
  goBack();
  updateDashboard();
  
  try {
    if (String(targetId).startsWith('temp_')) {
      syncQueue = syncQueue.filter(q => q.tempId !== targetId);
      saveSyncQueue();
      showToast('Offline borrower removed.');
      return;
    }
    
    if (!navigator.onLine) {
      queueSync(`/api/borrowers/${targetId}`, { method: 'DELETE' });
      showToast('Offline. Deletion queued.');
      return;
    }
    
    const res = await fetch(API_BASE + `/api/borrowers/${targetId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete borrower');
    showToast('Borrower deleted successfully');
  } catch (err) {
    console.error(err);
    queueSync(`/api/borrowers/${targetId}`, { method: 'DELETE' });
    showToast('Connection saved. Syncing deletion in background.');
  }
}

function callBorrower() {
  const b = borrowers.find(x => x.id === cid);
  if (b && b.phone) {
    window.open(`tel:${b.phone}`);
  } else {
    showToast('No phone number available');
  }
}

function whatsappBorrower() {
  const b = borrowers.find(x => x.id === cid);
  if (b && b.phone) {
    const { pending } = stats(b);
    const msg = encodeURIComponent(`Hi ${b.name}, just a friendly reminder about your outstanding dues of ₹${Math.round(pending).toLocaleString('en-IN')} with Shivkrupa Snacks. Please verify and settle. Thank you!`);
    window.open(`https://wa.me/${b.phone.startsWith('+') ? b.phone : '+91' + b.phone}?text=${msg}`);
  } else {
    showToast('No phone number available');
  }
}

function exportData(type) {
  if (type === 'excel') {
    let csv = 'Borrower Name,Phone,Transaction ID,Type,Date,Item,Quantity,Amount,Remarks\n';
    borrowers.forEach(b => {
      (b.transactions || []).forEach(t => {
        csv += `"${b.name}","${b.phone}","${t.id}","${t.type}","${t.date}","${t.item || ''}",${t.qty || 1},${t.amount},"${t.remarks || ''}"\n`;
      });
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `borrower_ledger_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('CSV exported successfully');
  } else if (type === 'pdf') {
    window.print();
  }
}

// Modal and Toast Helpers
function openModal(id) {
  const m = { 
    'borrow-modal': 'b-date', 
    'receive-modal': 'r-date',
    'income-modal': 'in-date',
    'expense-modal': 'ex-date'
  };
  if (m[id]) document.getElementById(m[id]).value = today;
  document.getElementById(id).classList.add('open');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2400);
}

function showReport(type) {
  const el = document.getElementById('report-content');
  const allT = borrowers.flatMap(b => (b.transactions || []).map(t => ({ ...t, bn: b.name, bid: b.id })));
  let html = '';
  
  if (type === 'daily') {
    const t = allT.filter(x => x.date === today);
    const rb = t.filter(x => x.type === 'borrow').reduce((s, x) => s + x.amount, 0);
    const rr = t.filter(x => x.type === 'received').reduce((s, x) => s + x.amount, 0);
    html = `<div class="report-result">
      <div style="font-size:13px;font-weight:500;color:var(--ink2);margin-bottom:10px">Daily — ${fmtD(today)}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
        <div class="stat-well" style="padding:10px 12px"><div class="stat-well-label">Borrowed</div><div class="stat-well-val coral" style="font-size:16px">${fmt(rb)}</div></div>
        <div class="stat-well" style="padding:10px 12px"><div class="stat-well-label">Received</div><div class="stat-well-val em" style="font-size:16px">${fmt(rr)}</div></div>
      </div>
      ${t.length ? `<div class="txn-list">${t.map(x => `<div class="txn-item"><div class="txn-icon-wrap"><i class="ti ${x.type === 'borrow' ? 'ti-arrow-up-right ti-borrow' : 'ti-arrow-down-left ti-received'}" aria-hidden="true"></i></div><div class="txn-info"><div class="txn-name">${x.bn} · ${x.item || 'Payment'}</div><div class="txn-date">${fmtD(x.date)}</div></div><div class="txn-amount ${x.type === 'borrow' ? 'debit' : 'credit'}">${x.type === 'borrow' ? '−' : '+'}${fmt(x.amount)}</div></div>`).join('')}</div>` : '<div class="empty-state"><i class="ti ti-calendar-off" aria-hidden="true"></i><p>No activity today</p></div>'}
    </div>`;
  } else if (type === 'monthly') {
    const mn = today.slice(0, 7);
    const t = allT.filter(x => x.date.startsWith(mn));
    const rb = t.filter(x => x.type === 'borrow').reduce((s, x) => s + x.amount, 0);
    const rr = t.filter(x => x.type === 'received').reduce((s, x) => s + x.amount, 0);
    html = `<div class="report-result">
      <div style="font-size:13px;font-weight:500;color:var(--ink2);margin-bottom:10px">Monthly — ${mn}</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px">
        <div class="stat-well" style="padding:10px 12px"><div class="stat-well-label">Borrowed</div><div class="stat-well-val coral" style="font-size:16px">${fmt(rb)}</div></div>
        <div class="stat-well" style="padding:10px 12px"><div class="stat-well-label">Received</div><div class="stat-well-val em" style="font-size:16px">${fmt(rr)}</div></div>
        <div class="stat-well" style="padding:10px 12px"><div class="stat-well-label">Net</div><div class="stat-well-val amber" style="font-size:16px">${fmt(rb - rr)}</div></div>
      </div>
      ${t.length ? `<div class="txn-list">${t.map(x => `<div class="txn-item"><div class="txn-icon-wrap"><i class="ti ${x.type === 'borrow' ? 'ti-arrow-up-right ti-borrow' : 'ti-arrow-down-left ti-received'}" aria-hidden="true"></i></div><div class="txn-info"><div class="txn-name">${x.bn} · ${x.item || 'Payment'}</div><div class="txn-date">${fmtD(x.date)}</div></div><div class="txn-amount ${x.type === 'borrow' ? 'debit' : 'credit'}">${x.type === 'borrow' ? '−' : '+'}${fmt(x.amount)}</div></div>`).join('')}</div>` : '<div class="empty-state"><p>No activity this month</p></div>'}
    </div>`;
  } else if (type === 'borrower') {
    html = `<div class="report-result"><div style="font-size:13px;font-weight:500;color:var(--ink2);margin-bottom:12px">All borrowers</div>${borrowers.map(b => {
      const { tb, tr, pending } = stats(b);
      return `<div style="padding:10px 0;border-bottom:1px solid var(--shadow-dark);display:flex;align-items:center;gap:10px">
      <div style="width:34px;height:34px;border-radius:8px;background:var(--bg);box-shadow:var(--raised-sm);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:500;color:var(--gold);flex-shrink:0">${initials(b.name)}</div>
      <div style="flex:1"><div style="font-size:13px;font-weight:500">${b.name}</div><div style="font-size:11px;color:var(--ink3)">${fmt(tb)} borrowed · ${fmt(tr)} received</div></div>
      <span class="badge ${pending > 0 ? 'badge-pending' : 'badge-clear'}">${pending > 0 ? fmt(pending) : 'Clear'}</span></div>`;
    }).join('')}</div>`;
  } else if (type === 'pending') {
    const list = borrowers.filter(b => stats(b).pending > 0);
    const tot = list.reduce((s, b) => s + stats(b).pending, 0);
    html = `<div class="report-result"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><div style="font-size:13px;font-weight:500;color:var(--ink2)">Pending dues</div><span class="badge badge-pending">${fmt(tot)} total</span></div>${list.length ? list.map(b => {
      const { pending } = stats(b);
      return `<div style="padding:10px 0;border-bottom:1px solid var(--shadow-dark);display:flex;align-items:center;gap:10px">
      <div style="width:34px;height:34px;border-radius:8px;background:var(--bg);box-shadow:var(--raised-sm);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:500;color:var(--gold);flex-shrink:0">${initials(b.name)}</div>
      <div style="flex:1"><div style="font-size:13px;font-weight:500">${b.name}</div><div style="font-size:11px;color:var(--ink3)">${b.phone}</div></div>
      <span class="badge badge-pending">${fmt(pending)}</span></div>`;
    }).join('') : '<div class="empty-state"><i class="ti ti-circle-check" aria-hidden="true"></i><p>No pending dues!</p></div>'}
    </div>`;
  }
  el.innerHTML = html;
}

// Initializer
document.querySelectorAll('.modal-bg').forEach(m => m.addEventListener('click', e => {
  if (e.target === m) m.classList.remove('open');
}));

// Theme toggling helpers
function initTheme() {
  const saved = localStorage.getItem('theme') || 'dark'; // default to dark
  document.documentElement.setAttribute('data-theme', saved);
  updateThemeIcon(saved);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  updateThemeIcon(next);
}

function updateThemeIcon(theme) {
  const icon = document.getElementById('theme-icon');
  if (!icon) return;
  if (theme === 'dark') {
    icon.className = 'ti ti-sun';
  } else {
    icon.className = 'ti ti-moon';
  }
}

// Set date default and fetch
async function init() {
  initTheme();
  document.getElementById('dr-start').value = today.slice(0, 8) + '01';
  document.getElementById('dr-end').value = today;
  
  // 1. Load from local cache immediately (instantly render UI!)
  try {
    borrowers = JSON.parse(localStorage.getItem('cached_borrowers') || '[]');
    cashflow = JSON.parse(localStorage.getItem('cached_cashflow') || '[]');
  } catch (e) {
    borrowers = [];
    cashflow = [];
  }
  
  // Initial UI render from cache
  updateDashboard();
  renderActivePage();
  
  // 2. Fetch fresh data silently in the background
  await fetchAllData(true);
  
  // 3. Trigger initial sync queue run if offline changes exist
  if (syncQueue.length > 0) {
    triggerSync();
  }
}

init();
