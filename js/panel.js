/* 右サイドバー タブパネル + ISS + 位置情報 + 通知 */
const RightPanel = {
  activeTab: 'stats',
  issInterval: null,
  notifyTimers: [],

  init() {
    this._bindTabs();
    this._startISS();
  },

  /* ── タブ切り替え ── */
  _bindTabs() {
    document.querySelectorAll('.rtab').forEach(btn => {
      btn.addEventListener('click', () => {
        const page = btn.dataset.p;
        document.querySelectorAll('.rtab').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.rpage').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`rp-${page}`)?.classList.add('active');
        this.activeTab = page;

        /* ISS タブに入ったら地球儀に ISS マーカーを追加 */
        if (page === 'iss') this._showISSOnGlobe();
      });
    });
  },

  /* ── ISS リアルタイムトラッカー ── */
  _startISS() {
    this._fetchISS();
    this.issInterval = setInterval(() => this._fetchISS(), 5000);
  },

  async _fetchISS() {
    try {
      const res = await fetch('https://api.wheretheiss.at/v1/satellites/25544',
        { signal: AbortSignal.timeout(4000) });
      const d   = await res.json();

      const lat  = +d.latitude.toFixed(3);
      const lng  = +d.longitude.toFixed(3);
      const alt  = +d.altitude.toFixed(1);
      const spd  = Math.round(d.velocity).toLocaleString();

      this._issLat = lat;
      this._issLng = lng;
      this._issAlt = alt;

      /* ISS ページ UI */
      const el = id => document.getElementById(id);
      if (el('iss-coords')) el('iss-coords').textContent = `${lat >= 0 ? lat+'°N' : Math.abs(lat)+'°S'}  ${lng >= 0 ? lng+'°E' : Math.abs(lng)+'°W'}`;
      if (el('iss-lat'))    el('iss-lat').textContent    = lat + '°';
      if (el('iss-lng'))    el('iss-lng').textContent    = lng + '°';
      if (el('iss-alt'))    el('iss-alt').textContent    = alt + ' km';
      if (el('iss-spd'))    el('iss-spd').textContent    = spd;

      /* ISS を地球儀に表示（ISS タブ表示中 or 常時） */
      this._updateISSOnGlobe(lat, lng, alt);

      /* 現在地タブが開いていれば距離を更新 */
      if (this._userLat != null) this._updateLocationData();

    } catch(e) { /* silent */ }
  },

  async _fetchISSCrew() {
    try {
      const res = await fetch('http://api.open-notify.org/astros.json',
        { signal: AbortSignal.timeout(5000) });
      const d = await res.json();
      const issCount = d.people?.filter(p => p.craft === 'ISS').length ?? d.number;
      const el = document.getElementById('iss-crew-count');
      if (el) el.innerHTML = `<span style="font-size:32px;font-weight:bold;color:var(--purple)">${issCount}</span><div style="font-size:10px;color:var(--text-muted);margin-top:4px">名が現在 ISS に滞在中</div>`;
    } catch(e) {
      const el = document.getElementById('iss-crew-count');
      if (el) el.textContent = '7名（推定）';
    }
  },

  _showISSOnGlobe() {
    if (this._issLat != null) {
      GlobeManager.flyTo(this._issLat, this._issLng, 1.5);
    }
    this._fetchISSCrew();
  },

  _issMarkerAdded: false,
  _updateISSOnGlobe(lat, lng, alt) {
    if (!GlobeManager.globe) return;
    /* ISS を地球儀に特別マーカーとして追加（pointsData に追記） */
    GlobeManager._data._iss = [{
      lat, lng, alt: alt / 6371,
      color: '#ffffff',
      r: 0.6,
      tip: `<b style="color:#fff">🛸 ISS（国際宇宙ステーション）</b><br/>高度: ${alt} km<br/>位置: ${lat.toFixed(2)}°, ${lng.toFixed(2)}°`,
      type: 'iss'
    }];
    /* 静的ポイントを再構築（ISS含む） */
    GlobeManager._rebuildWithISS();
  },

  /* ── 現在地 ── */
  _userLat: null,
  _userLng: null,

  requestLocation() {
    if (!navigator.geolocation) {
      alert('このブラウザは位置情報に対応していません');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        this._userLat = pos.coords.latitude;
        this._userLng = pos.coords.longitude;
        document.getElementById('loc-state').style.display = 'none';
        document.getElementById('loc-data').style.display  = 'block';
        document.getElementById('loc-addr').textContent =
          `緯度 ${this._userLat.toFixed(3)}°  経度 ${this._userLng.toFixed(3)}°`;
        this._updateLocationData();
        /* 地球儀をユーザー位置へ */
        GlobeManager.flyTo(this._userLat, this._userLng, 1.6);
      },
      () => alert('位置情報の取得に失敗しました。ブラウザの設定を確認してください。')
    );
  },

  _updateLocationData() {
    /* 頭上の Starlink 計算（仰角 > 10° を推定） */
    const sats = GlobeManager._data.starlink || [];
    const overhead = sats.filter(s => {
      if (!s.lat0 && !s.latitude) return false;
      const lat = s.lat0 ?? s.latitude;
      const lng = s.lng0 ?? s.longitude;
      const dlat = Math.abs(lat - this._userLat);
      const dlng = Math.abs(lng - this._userLng);
      return dlat < 25 && dlng < 35; // 大まかな「頭上」判定
    }).length;

    const el = id => document.getElementById(id);
    if (el('loc-starlink-count')) el('loc-starlink-count').textContent = overhead;

    /* ISS との距離 */
    if (this._issLat != null) {
      const R   = 6371;
      const dLat = (this._issLat - this._userLat) * Math.PI / 180;
      const dLng = (this._issLng - this._userLng) * Math.PI / 180;
      const a   = Math.sin(dLat/2)**2 + Math.cos(this._userLat * Math.PI/180) * Math.cos(this._issLat * Math.PI/180) * Math.sin(dLng/2)**2;
      const dist = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
      if (el('loc-iss-dist')) el('loc-iss-dist').textContent = dist.toLocaleString();
    }
  },

  /* ── 打ち上げ通知 ── */
  async setupNotify() {
    const perm = await Notification.requestPermission();
    const btn  = document.getElementById('notify-btn');
    const settings = document.getElementById('notify-settings');

    if (perm === 'granted') {
      btn.textContent = '✅ 通知が有効です';
      btn.classList.add('granted');
      settings.style.display = 'block';
      this._scheduleNotifications();
      new Notification('SpaceX Live', {
        body: '打ち上げ通知が有効になりました 🚀',
        icon: '/textures/icon.png'
      });
    } else {
      btn.textContent = '⚠️ 通知が拒否されました（ブラウザ設定から許可してください）';
    }
  },

  _scheduleNotifications() {
    /* タイマーをリセット */
    this.notifyTimers.forEach(t => clearTimeout(t));
    this.notifyTimers = [];

    const launches = window.App?.upcomingLaunches || [];
    const timings  = [];
    if (document.getElementById('nt-30')?.checked) timings.push(30);
    if (document.getElementById('nt-10')?.checked) timings.push(10);
    if (document.getElementById('nt-5')?.checked)  timings.push(5);

    const nextList = document.getElementById('notify-next');
    if (nextList) nextList.innerHTML = '';

    launches.slice(0, 3).forEach(l => {
      if (!l.date_unix) return;
      const msUntil = (l.date_unix - Math.floor(Date.now()/1000)) * 1000;
      if (msUntil < 0) return;

      timings.forEach(min => {
        const ms = msUntil - min * 60000;
        if (ms < 0) return;

        const t = setTimeout(() => {
          if (Notification.permission === 'granted') {
            new Notification(`🚀 打ち上げ ${min}分前`, {
              body: `${l.name} — ${l.rocket?.name || 'Falcon 9'}`,
            });
          }
        }, ms);
        this.notifyTimers.push(t);
      });

      /* 次の通知リストに追加 */
      if (nextList) {
        const date = new Date(l.date_unix * 1000).toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        nextList.innerHTML += `<div class="nn-item"><div class="nn-name">${l.name}</div><div class="nn-time">${date}</div></div>`;
      }
    });
  }
};

/* ────────────────────────────────────────
   株価オーバーレイ
──────────────────────────────────────── */
const StockOverlay = {
  bigChart: null,
  miniCharts: {},

  /* ────────────────────────────────────────
     証券会社アフィリエイトリンク設定
     ↓ ここを各社のアフィリリンクに書き換えてください
  ──────────────────────────────────────── */
  BROKERS: [
    {
      id:    'sbi',
      name:  'SBI証券で口座開設',
      desc:  '国内最大手・米国株手数料最安クラス',
      url:   'https://example.com/sbi-affiliate',   // ← SBIアフィリリンク
      cls:   'broker-sbi'
    },
    {
      id:    'rakuten',
      name:  '楽天証券で口座開設',
      desc:  '楽天ポイント連携・使いやすいアプリ',
      url:   'https://example.com/rakuten-affiliate', // ← 楽天アフィリリンク
      cls:   'broker-rakuten'
    },
  ],

  /* 旧AFFILIATE_URLは互換のため残す */
  AFFILIATE_URL: 'https://example.com/affiliate',

  /* 関連株の定義 */
  /* 期間共通ラベル */
  LABELS: {
    '5d':  ['6月13日','6月16日','6月17日','6月18日','6月19日'],
    '1mo': ['5月20日','5月27日','6月3日','6月10日','6月19日'],
    '3mo': ['3月20日','4月3日','4月17日','5月1日','5月15日','5月29日','6月19日'],
    '1y':  ['2025年7月','2025年9月','2025年11月','2026年1月','2026年3月','2026年5月','2026年6月']
  },

  RELATED: [
    { sym: 'TSLA', name: 'Tesla, Inc.', color: '#e82127', desc: '同一オーナー（Elon Musk）',
      demo: { price: 312.40, prev: 308.80, closes: [308.5,309.2,310.8,311.5,312.4] },
      history: {
        '5d':  [308.5, 309.2, 310.8, 311.5, 312.4],
        '1mo': [302.1, 303.8, 306.0, 308.5, 312.4],
        '3mo': [294.0, 297.5, 300.2, 298.0, 303.5, 308.0, 312.4],
        '1y':  [285.0, 280.5, 278.8, 285.0, 292.0, 305.5, 312.4]
      }
    },
    { sym: 'RKLB', name: 'Rocket Lab USA', color: '#00bfff', desc: '小型ロケット競合',
      demo: { price: 10.42, prev: 10.18, closes: [10.1,10.2,10.0,10.3,10.42] },
      history: {
        '5d':  [10.10, 10.20, 10.00, 10.30, 10.42],
        '1mo': [9.80,  9.60,  9.90,  10.15, 10.42],
        '3mo': [9.00,  8.80,  9.20,  9.50,  9.80,  10.10, 10.42],
        '1y':  [7.50,  7.80,  8.20,  8.60,  9.00,  9.80,  10.42]
      }
    },
    { sym: 'ASTS', name: 'AST SpaceMobile', color: '#b060ff', desc: '衛星携帯電話',
      demo: { price: 24.85, prev: 24.12, closes: [24.0,24.2,23.8,24.5,24.85] },
      history: {
        '5d':  [24.00, 24.20, 23.80, 24.50, 24.85],
        '1mo': [22.50, 22.80, 23.50, 24.10, 24.85],
        '3mo': [18.50, 19.50, 20.80, 21.50, 22.00, 23.50, 24.85],
        '1y':  [14.00, 15.50, 17.50, 18.80, 20.80, 23.00, 24.85]
      }
    },
    { sym: 'LUNR', name: 'Intuitive Machines', color: '#00ff88', desc: 'Falcon 9 で月面へ',
      demo: { price: 7.23, prev: 7.05, closes: [7.0,7.1,6.9,7.1,7.23] },
      history: {
        '5d':  [7.00, 7.10, 6.90, 7.10, 7.23],
        '1mo': [6.80, 6.70, 6.90, 7.05, 7.23],
        '3mo': [6.00, 6.20, 6.50, 6.60, 6.80, 7.00, 7.23],
        '1y':  [4.50, 5.00, 5.50, 5.80, 6.20, 6.80, 7.23]
      }
    },
  ],

  /* SPCX のデモ履歴データ（IPO 2026-06-12 〜） */
  SPCX_HISTORY: {
    '5d':  { labels: ['Jun 12','Jun 13','Jun 16','Jun 17','Jun 18','Jun 18','Jun 19','Jun 19'], data: [135,161,168,172,191,183,178,185] },
    '1mo': { labels: ['Jun 12','Jun 13','Jun 16','Jun 17','Jun 18','Jun 19'], data: [135,161,168,172,191,185] },
    '3mo': { labels: ['Jun 12','Jun 13','Jun 16','Jun 17','Jun 18','Jun 19'], data: [135,161,168,172,191,185] },
    '1y':  { labels: ['Jun 12','Jun 13','Jun 16','Jun 17','Jun 18','Jun 19'], data: [135,161,168,172,191,185] },
  },

  async open() {
    document.getElementById('stock-overlay')?.classList.remove('hidden');
    /* SPCX 買うボタンのリンクを設定 */
    const spcxBtn = document.getElementById('spcx-buy-btn');
    if (spcxBtn) spcxBtn.href = this.AFFILIATE_URL;
    this._bindPeriodBtns();
    this._renderBigChart('5d');
    this._updateStats();
    await this._buildRelatedGrid();
  },

  _bindPeriodBtns() {
    document.querySelectorAll('.sov-period').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.sov-period').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._renderBigChart(btn.dataset.r);
      });
    });
  },

  _renderBigChart(period) {
    const hist = this.SPCX_HISTORY[period] || this.SPCX_HISTORY['5d'];
    const canvas = document.getElementById('spcx-big-chart');
    if (!canvas) return;

    /* 既存チャートを破棄 */
    const ex = Chart.getChart(canvas);
    if (ex) ex.destroy();
    if (this.bigChart) { try { this.bigChart.destroy(); } catch(e) {} }

    const isUp = hist.data[hist.data.length-1] >= hist.data[0];
    const color = isUp ? '#00ff88' : '#ff4040';
    const ctx   = canvas.getContext('2d');

    this.bigChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: hist.labels,
        datasets: [{
          data: hist.data,
          borderColor: color,
          backgroundColor: isUp ? 'rgba(0,255,136,0.08)' : 'rgba(255,64,64,0.08)',
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 3,
          pointHoverRadius: 6,
          pointBackgroundColor: color
        }]
      },
      options: {
        responsive: false,
        animation: { duration: 600, easing: 'easeInOutQuart' },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0a1628',
            borderColor: '#1e3a5f',
            borderWidth: 1,
            callbacks: { label: c => `$${c.parsed.y.toFixed(2)}` }
          }
        },
        scales: {
          x: { grid: { color: 'rgba(40,80,120,0.3)' }, ticks: { color: '#fff', font: { size: 10 } } },
          y: { grid: { color: 'rgba(40,80,120,0.3)' }, ticks: { color: '#fff', font: { size: 10 }, callback: v => `$${v}` } }
        }
      }
    });
  },

  _updateStats() {
    const data = this.SPCX_HISTORY['5d'].data;
    const hi   = Math.max(...data);
    const lo   = Math.min(...data);
    const cur  = data[data.length - 1];
    const ret  = (((cur - 135) / 135) * 100).toFixed(1);

    const el = id => document.getElementById(id);
    if (el('ov-high'))    el('ov-high').textContent    = `$${hi}`;
    if (el('ov-low'))     el('ov-low').textContent     = `$${lo}`;
    if (el('ov-ipo-ret')) {
      el('ov-ipo-ret').textContent = `+${ret}%`;
      el('ov-ipo-ret').className   = 'sov-sv green';
    }
    /* メインの価格も同期 */
    const price = el('ov-spcx-price');
    const chg   = el('ov-spcx-chg');
    if (price) price.textContent = `$${cur.toFixed(2)}`;
    if (chg) {
      const d = cur - data[data.length - 2];
      const p = (d / data[data.length - 2] * 100).toFixed(2);
      chg.textContent = `${d>=0?'▲':'▼'} ${d>=0?'+':''}$${Math.abs(d).toFixed(2)} (${d>=0?'+':''}${p}%)`;
      chg.className   = `stock-chg ${d>=0?'positive':'negative'}`;
    }
  },

  /* ── 証券会社選択ポップアップ ── */
  openBroker(sym) {
    const popup = document.getElementById('broker-popup');
    const title = document.getElementById('broker-title');
    const btns  = document.getElementById('broker-btns');
    if (!popup || !btns) return;
    if (title) title.textContent = `${sym} の株を買う`;
    btns.innerHTML = this.BROKERS.map(b => `
      <a class="broker-btn ${b.cls}" href="${b.url}" target="_blank" rel="noopener noreferrer"
         onclick="StockOverlay.closeBrokerBtn()">
        <div>
          <div class="bb-name">${b.name}</div>
          <div style="font-size:10px;color:rgba(255,255,255,0.65);margin-top:2px">${b.desc}</div>
        </div>
        <span class="bb-arrow">→</span>
      </a>`).join('');
    popup.classList.remove('hidden');
  },

  closeBroker(e) {
    if (e.target === document.getElementById('broker-popup')) {
      document.getElementById('broker-popup')?.classList.add('hidden');
    }
  },

  closeBrokerBtn() {
    document.getElementById('broker-popup')?.classList.add('hidden');
  },

  /* ── 株詳細モーダル ── */
  _detailChart: null,

  openDetail(sym) {
    const stock = this.RELATED.find(s => s.sym === sym);
    if (!stock) return;

    const el  = id => document.getElementById(id);
    const modal = document.getElementById('stock-detail-modal');
    if (!modal) return;

    /* ヘッダー情報 */
    if (el('sdm-sym'))  { el('sdm-sym').textContent  = stock.sym; el('sdm-sym').style.color = stock.color; }
    if (el('sdm-name')) el('sdm-name').textContent  = stock.name;
    if (el('sdm-desc')) el('sdm-desc').textContent  = stock.desc;

    const { price, prev, closes } = stock.demo;
    const chg  = price - prev;
    const pct  = prev ? ((chg / prev) * 100) : 0;
    const isUp = chg >= 0;
    if (el('sdm-price')) el('sdm-price').textContent = `$${price.toFixed(2)}`;
    if (el('sdm-chg')) {
      el('sdm-chg').textContent = `${isUp?'▲':'▼'} ${isUp?'+':''}$${Math.abs(chg).toFixed(2)} (${isUp?'+':''}${pct.toFixed(2)}%)`;
      el('sdm-chg').className   = `sdm-chg ${isUp?'positive':'negative'}`;
    }

    /* 期間ボタン（再構築） */
    const pbar = el('sdm-periods');
    if (pbar) {
      pbar.innerHTML = ['5d','1mo','3mo','1y'].map((r,i) =>
        `<button class="sov-period${i===0?' active':''}" data-r="${r}" onclick="StockOverlay._detailPeriod('${sym}','${r}',this)">${['5日','1ヶ月','3ヶ月','1年'][i]}</button>`
      ).join('');
    }

    /* チャート（初期は5日） */
    this._renderDetailChart(sym, stock.history?.['5d'] || closes, stock.color, '5d');

    /* スタッツ */
    const hi = Math.max(...closes), lo = Math.min(...closes);
    if (el('sdm-stats')) {
      el('sdm-stats').innerHTML = `
        <div class="sdm-stat"><div class="sdm-sv">$${hi.toFixed(2)}</div><div class="sdm-sl">期間高値</div></div>
        <div class="sdm-stat"><div class="sdm-sv">$${lo.toFixed(2)}</div><div class="sdm-sl">期間安値</div></div>
        <div class="sdm-stat"><div class="sdm-sv">${(((price-closes[0])/closes[0])*100).toFixed(1)}%</div><div class="sdm-sl">期間リターン</div></div>`;
    }

    /* 買うボタン */
    const buyBtn = el('sdm-buy-btn');
    if (buyBtn) {
      buyBtn.textContent = `${stock.sym} の株を買う`;
      buyBtn.onclick = (e) => { e.preventDefault(); this.openBroker(stock.sym); };
    }

    modal.classList.remove('hidden');
  },

  _renderDetailChart(sym, closes, color, period) {
    const canvas = document.getElementById('sdm-chart');
    if (!canvas) return;
    const ex = Chart.getChart(canvas);
    if (ex) ex.destroy();
    if (this._detailChart) { try { this._detailChart.destroy(); } catch(e) {} }

    const isUp  = closes[closes.length-1] >= closes[0];
    const c     = isUp ? color : '#ff4040';
    const ctx   = canvas.getContext('2d');
    const range = period || document.querySelector('#sdm-periods .sov-period.active')?.dataset?.r || '5d';
    const labels = this.LABELS[range] || closes.map((_,i) => i + 1);

    this._detailChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{ data: closes, borderColor: c, backgroundColor: c+'22',
          borderWidth: 2, fill: true, tension: 0.4, pointRadius: 3,
          pointHoverRadius: 6, pointBackgroundColor: c }]
      },
      options: {
        responsive: false,
        animation: { duration: 500 },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0a1628', borderColor: '#1e3a5f', borderWidth: 1,
            callbacks: {
              title: items => labels[items[0].dataIndex] || '',
              label: ctx  => `$${ctx.parsed.y.toFixed(2)}`
            }
          }
        },
        scales: {
          x: {
            display: true,
            grid: { color: 'rgba(40,80,120,0.2)' },
            ticks: { color: '#ffffff', font: { size: 9 }, maxTicksLimit: 5, maxRotation: 0 }
          },
          y: {
            grid: { color: 'rgba(40,80,120,0.3)' },
            ticks: { color: '#fff', font: { size: 9 }, callback: v => `$${v}` }
          }
        }
      }
    });
  },

  _detailPeriod(sym, range, btn) {
    document.querySelectorAll('#sdm-periods .sov-period').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const stock = this.RELATED.find(s => s.sym === sym);
    if (!stock) return;
    const data = stock.history?.[range] || stock.demo.closes;
    this._renderDetailChart(sym, data, stock.color, range);

    /* スタッツも期間に合わせて更新 */
    const hi  = Math.max(...data);
    const lo  = Math.min(...data);
    const ret = (((data[data.length-1] - data[0]) / data[0]) * 100).toFixed(1);
    const el  = document.getElementById('sdm-stats');
    if (el) el.innerHTML = `
      <div class="sdm-stat"><div class="sdm-sv">$${hi.toFixed(2)}</div><div class="sdm-sl">期間高値</div></div>
      <div class="sdm-stat"><div class="sdm-sv">$${lo.toFixed(2)}</div><div class="sdm-sl">期間安値</div></div>
      <div class="sdm-stat"><div class="sdm-sv">${parseFloat(ret) >= 0 ? '+' : ''}${ret}%</div><div class="sdm-sl">期間リターン</div></div>`;
  },

  closeDetail(e) {
    if (e.target === document.getElementById('stock-detail-modal')) {
      document.getElementById('stock-detail-modal')?.classList.add('hidden');
    }
  },

  closeDetailBtn() {
    document.getElementById('stock-detail-modal')?.classList.add('hidden');
  },

  async _buildRelatedGrid() {
    const grid = document.getElementById('sov-related-grid');
    if (!grid) return;
    grid.innerHTML = this.RELATED.map(s => `
      <div class="sov-rel-card" onclick="StockOverlay.openDetail('${s.sym}')" title="${s.sym}の詳細を見る">
        <div class="sov-rel-hdr">
          <div>
            <div class="sov-rel-sym" style="color:${s.color}">${s.sym}</div>
            <div class="sov-rel-name">${s.name}</div>
            <div class="sov-rel-name" style="color:var(--accent);margin-top:2px">${s.desc}</div>
          </div>
          <div style="text-align:right">
            <div class="sov-rel-price" id="rel-price-${s.sym}">--</div>
            <div class="sov-rel-chg"  id="rel-chg-${s.sym}">--</div>
          </div>
        </div>
        <canvas class="sov-rel-canvas" id="rel-chart-${s.sym}"></canvas>
        <button class="sov-buy-btn" onclick="event.stopPropagation(); StockOverlay.openBroker('${s.sym}')">${s.sym} の株を買う</button>
      </div>`).join('');

    /* デモデータを即時表示 → API で上書き */
    this.RELATED.forEach(s => {
      this._applyStockData(s.sym, s.demo.price, s.demo.prev, s.demo.closes, s.color);
      this._fetchRelated(s); /* API からのデータで差し替えを試みる */
    });
  },

  _applyStockData(sym, price, prev, closes, color) {
    const el  = id => document.getElementById(id);
    const chg = price - prev;
    const pct = prev ? ((chg / prev) * 100) : 0;
    const isUp = chg >= 0;

    if (el(`rel-price-${sym}`)) el(`rel-price-${sym}`).textContent = `$${price.toFixed(2)}`;
    if (el(`rel-chg-${sym}`)) {
      el(`rel-chg-${sym}`).textContent  = `${isUp?'▲':'▼'} ${isUp?'+':''}${pct.toFixed(2)}%`;
      el(`rel-chg-${sym}`).style.color  = isUp ? 'var(--green)' : 'var(--red)';
    }

    const canvas = el(`rel-chart-${sym}`);
    if (!canvas || !closes?.length) return;
    const existing = Chart.getChart(canvas);
    if (existing) existing.destroy();
    if (this.miniCharts[sym]) { try { this.miniCharts[sym].destroy(); } catch(e) {} }

    const ctx = canvas.getContext('2d');
    this.miniCharts[sym] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: closes.map((_,i) => i),
        datasets: [{ data: closes, borderColor: color, borderWidth: 1.5,
          fill: false, tension: 0.4, pointRadius: 0 }]
      },
      options: {
        responsive: false,
        plugins: { legend:{display:false}, tooltip:{enabled:false} },
        scales: { x:{display:false}, y:{display:false} },
        animation: { duration: 400 }
      }
    });
  },

  async _fetchRelated(s) {
    try {
      const q = await SpaceXAPI.getStockQuote(s.sym);
      if (q?.price && q.closes?.length > 1) {
        this._applyStockData(s.sym, q.price, q.prev, q.closes, s.color);
      }
    } catch(e) { /* デモデータで表示済みなので無視 */ }
  }
};

/* ────────────────────────────────────────
   ロケット詳細モーダル
──────────────────────────────────────── */
const RocketModal = {
  _rockets: [],

  setData(rockets) { this._rockets = rockets; },

  open(name) {
    const r   = this._rockets.find(r => r.name === name);
    if (!r) return;

    const el  = id => document.getElementById(id);
    const leo = r.payload_weights?.find(p => p.id === 'leo');
    const gto = r.payload_weights?.find(p => p.id === 'gto');

    /* ヘッダー */
    if (el('rdm-name')) el('rdm-name').textContent = r.name;
    if (el('rdm-status')) {
      el('rdm-status').textContent = r.active ? '稼働中' : '退役';
      el('rdm-status').className   = `rc-status ${r.active ? 'active' : 'inactive'}`;
    }

    /* 説明文 */
    if (el('rdm-desc'))   el('rdm-desc').textContent   = r.description || '';
    if (el('rdm-trivia')) el('rdm-trivia').textContent  = r.trivia || '';
    if (!r.trivia && el('rdm-trivia')) el('rdm-trivia').style.display = 'none';
    else if (el('rdm-trivia')) el('rdm-trivia').style.display = 'block';

    /* スタッツグリッド */
    if (el('rdm-stats')) {
      el('rdm-stats').innerHTML = [
        { v: (r.height?.meters ?? '--') + ' m',                        l: '高さ' },
        { v: r.mass?.kg ? (r.mass.kg/1000).toFixed(0) + ' t' : '--',   l: '質量' },
        { v: r.engines?.number ?? '--',                                  l: 'エンジン数' },
        { v: leo ? leo.kg.toLocaleString() + ' kg' : '--',              l: 'LEO 搭載量' },
        { v: r.cost_per_launch ? '$'+(r.cost_per_launch/1e6).toFixed(0)+'M' : '--', l: 'コスト' },
        { v: (r.success_rate_pct ?? '--') + '%',                         l: '成功率' },
      ].map(s => `<div class="rdm-stat"><div class="rdm-sv">${s.v}</div><div class="rdm-sl">${s.l}</div></div>`).join('');
    }

    document.getElementById('rocket-detail-modal')?.classList.remove('hidden');
  },

  close() {
    document.getElementById('rocket-detail-modal')?.classList.add('hidden');
  },

  closeBg(e) {
    if (e.target === document.getElementById('rocket-detail-modal')) this.close();
  }
};

/* GlobeManager に ISS 対応を追加 */
GlobeManager._rebuildWithISS = function() {
  if (!this.globe) return;
  const pts = [];

  if (this._layers.launchpads) {
    this._data.launchpads.forEach(p => {
      const lat = p.latitude ?? p.lat, lng = p.longitude ?? p.lng;
      if (lat == null) return;
      pts.push({ lat, lng, alt: 0.008, color: p.status==='active'?'#ff6020':'#804030', r: 0.5,
        tip: `<b style="color:#ff6020">🚀 ${p.name}</b><br/>${p.locality||''}, ${p.region||''}<br/>打ち上げ: ${p.launch_attempts??'--'}回`, type:'launchpad' });
    });
  }
  if (this._layers.landpads) {
    this._data.landpads.forEach(p => {
      const lat = p.latitude ?? p.lat, lng = p.longitude ?? p.lng;
      if (lat == null) return;
      pts.push({ lat, lng, alt: 0.006, color: p.status==='active'?'#00ff88':'#208050', r: 0.45,
        tip: `<b style="color:#00ff88">🎯 ${p.name}</b><br/>${p.type??'--'}<br/>着陸成功: ${p.landing_successes??0}回`, type:'landpad' });
    });
  }
  if (this._layers.ships) {
    this._data.ships.forEach(s => {
      const lat = s.latitude ?? s.lat, lng = s.longitude ?? s.lng;
      if (lat == null) return;
      pts.push({ lat, lng, alt: 0.004, color: s.active?'#b060ff':'#6030a0', r: 0.42,
        tip: `<b style="color:#b060ff">🚢 ${s.name}</b><br/>${(s.roles||[]).join(',')||'--'}`, type:'ship' });
    });
  }

  /* ISS マーカー */
  if (this._data._iss) {
    pts.push(...this._data._iss);
  }

  this.globe.pointsData(pts);
};
