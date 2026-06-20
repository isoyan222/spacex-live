/* UI rendering & helpers */
const UI = {
  stockChart: null,

  /* ── COUNTDOWN ── */
  countdown(unix) {
    if (!unix) return 'TBD';
    const diff = unix - Math.floor(Date.now() / 1000);
    if (diff < 0) return '打ち上げ済み';
    const d = Math.floor(diff / 86400);
    const h = Math.floor((diff % 86400) / 3600);
    const m = Math.floor((diff % 3600) / 60);
    const s = diff % 60;
    if (d > 0)  return `T- ${d}d ${h}h ${m}m`;
    if (h > 0)  return `T- ${h}h ${m}m ${s}s`;
    return `T- ${m}m ${s}s`;
  },

  fmtDate(utc) {
    if (!utc) return 'TBD';
    return new Date(utc).toLocaleDateString('ja-JP', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  },

  /* ── UPCOMING LAUNCHES ── */
  renderUpcoming(launches) {
    /* 左サイドバー + 右サイドバー打ち上げタブ の両方に描画 */
    ['launches-list', 'launches-list-r'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      if (!launches?.length) { el.innerHTML = '<div class="empty-text">打ち上げ予定なし</div>'; return; }
      el.innerHTML = launches.slice(0, 8).map(l => {
        const isTentative = l.date_precision === 'quarter' || l.date_precision === 'half' || l.date_precision === 'year';
        const badgeClass  = l.date_precision === 'hour' ? 'lc-confirmed' : isTentative ? 'lc-tentative' : 'lc-upcoming';
        const badgeText   = l.date_precision === 'hour' ? '確定' : isTentative ? '未定' : '予定';
        return `<div class="launch-card" onclick="App.focusLaunch('${l.id}')">
          <div class="lc-name">${l.name}</div>
          <div class="lc-rocket">🚀 ${l.rocket?.name || 'Falcon 9'}</div>
          <div class="lc-countdown" id="cd-${l.id}" data-unix="${l.date_unix}">
            ${isTentative ? this.fmtDate(l.date_utc) : this.countdown(l.date_unix)}
          </div>
          <span class="lc-badge ${badgeClass}">${badgeText}</span>
        </div>`;
      }).join('');
    });
  },

  tickCountdowns(launches) {
    launches.slice(0, 8).forEach(l => {
      const el = document.getElementById(`cd-${l.id}`);
      const isTentative = l.date_precision === 'quarter' || l.date_precision === 'half' || l.date_precision === 'year';
      if (el && !isTentative) el.textContent = this.countdown(l.date_unix);
    });
  },

  /* ── RECENT LAUNCHES ── */
  renderRecent(launches) {
    const el = document.getElementById('recent-list');
    if (!launches?.length) { el.innerHTML = '<div class="empty-text">データなし</div>'; return; }

    el.innerHTML = launches.slice(0, 15).map(l => {
      const ok = l.success === true  ? '<span class="rc-ok">✓ 成功</span>' : '';
      const ng = l.success === false ? '<span class="rc-fail">✗ 失敗</span>' : '';
      const na = l.success == null   ? '<span class="rc-na">--</span>' : '';
      return `<div class="recent-card">
        <div class="rc-name">${l.name}</div>
        <div class="rc-meta"><span>${this.fmtDate(l.date_utc)}</span>${ok}${ng}${na}</div>
      </div>`;
    }).join('');

    const total = launches.length;
    const ok    = launches.filter(l => l.success === true).length;
    document.getElementById('st-launches').textContent = total;
    document.getElementById('st-rate').textContent =
      total ? `${Math.round(ok / total * 100)}%` : '--%';
  },

  /* ── CREW ── */
  renderCrew(crew) {
    const el     = document.getElementById('crew-list');
    const active = crew.filter(c => c.status === 'active');
    document.getElementById('st-crew').textContent = active.length;

    if (!active.length) { el.innerHTML = '<div class="empty-text">データなし</div>'; return; }

    el.innerHTML = active.slice(0, 6).map(c => {
      const avatar = c.image
        ? `<img class="crew-avatar" src="${c.image}" alt="${c.name}" onerror="this.outerHTML='<div class=crew-initial>${c.name[0]}</div>'">`
        : `<div class="crew-initial">${c.name[0]}</div>`;
      return `<div class="crew-card">
        ${avatar}
        <div class="crew-info">
          <div class="crew-name">${c.name}</div>
          <div class="crew-agency">${c.agency || '--'}</div>
        </div>
        <div class="crew-dot active"></div>
      </div>`;
    }).join('');
  },

  /* ── STOCK CHART ── */
  initStockChart(closes, labels) {
    const canvas = document.getElementById('price-chart');
    if (!canvas) return;
    /* canvas に登録済みの全チャートを破棄（複数呼び出し時の衝突を防ぐ） */
    const existing = Chart.getChart(canvas);
    if (existing) existing.destroy();
    if (this.stockChart) { try { this.stockChart.destroy(); } catch(e) {} }
    this.stockChart = null;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    this.stockChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels || closes.map((_, i) => i + 1),
        datasets: [{
          data: closes,
          borderColor: '#00ff88',
          backgroundColor: 'rgba(0,255,136,0.07)',
          borderWidth: 1.5,
          fill: true,
          tension: 0.4,
          pointRadius: 2,
          pointHoverRadius: 4,
          pointBackgroundColor: '#00ff88'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 600 },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0a1628',
            borderColor: '#1e3a5f',
            borderWidth: 1,
            callbacks: { label: ctx => `$${ctx.parsed.y.toFixed(2)}` }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(40,80,120,0.35)' },
            ticks: { color: '#ffffff', font: { size: 9, weight: '500' }, maxTicksLimit: 5 }
          },
          y: {
            grid: { color: 'rgba(40,80,120,0.35)' },
            ticks: { color: '#ffffff', font: { size: 9, weight: '500' }, callback: v => `$${v}` }
          }
        }
      }
    });
  },

  updateStock(symbol, price, prev) {
    if (!price) return;
    const change = (price && prev) ? price - prev : 0;
    const pct    = (prev && change) ? (change / prev * 100) : 0;
    const sign   = change >= 0 ? '+' : '';
    const cls    = change >= 0 ? 'positive' : 'negative';
    const arrow  = change >= 0 ? '▲' : '▼';

    if (symbol === 'SPCX') {
      document.getElementById('sp-price').textContent  = `$${price.toFixed(2)}`;
      document.getElementById('sp-chg').textContent    = `${arrow} ${sign}$${Math.abs(change).toFixed(2)} (${sign}${pct.toFixed(2)}%)`;
      document.getElementById('sp-chg').className      = `stock-chg ${cls}`;
      document.getElementById('nt-spcx').textContent   = `$${price.toFixed(2)}`;
      document.getElementById('nt-spcx-chg').textContent = `${arrow}${sign}${pct.toFixed(2)}%`;
      document.getElementById('nt-spcx-chg').className   = `t-chg ${cls}`;
    }
    if (symbol === 'TSLA') {
      document.getElementById('rs-tsla').textContent = `$${price.toFixed(2)}`;
      document.getElementById('nt-tsla').textContent = `$${price.toFixed(2)}`;
    }
    if (symbol === 'RKLB') {
      document.getElementById('rs-rklb').textContent = `$${price.toFixed(2)}`;
      document.getElementById('nt-rklb').textContent = `$${price.toFixed(2)}`;
    }
    if (symbol === 'ASTS') {
      document.getElementById('rs-asts').textContent = `$${price.toFixed(2)}`;
    }
  },

  setGlobeStatus(txt) {
    const el = document.getElementById('globe-status');
    if (el) el.textContent = txt;
  },

  /* ── 🚗 Roadster（ビッグカード） ── */
  renderRoadster(d) {
    const card = document.getElementById('roadster-card');
    if (!card || !d) return;

    const fmtKm    = n => n ? (n / 1e6).toFixed(2) + '億km' : '--';
    const fmtSpeed = n => n ? Math.round(n).toLocaleString() + ' km/h' : '--';
    const days = d.launch_date_utc
      ? Math.floor((Date.now() - new Date(d.launch_date_utc)) / 86400000).toLocaleString()
      : '--';

    card.innerHTML = `
      <div class="rd-days">
        <span class="rd-days-num">${days}</span>
        <span class="rd-days-label">打ち上げからの日数（2018年2月6日～）</span>
      </div>
      <div class="rd-big-grid">
        <div class="rd-big-cell">
          <div class="rd-big-val earth">${fmtKm(d.earth_distance_km)}</div>
          <div class="rd-big-lbl">🌍 地球からの距離</div>
        </div>
        <div class="rd-big-cell">
          <div class="rd-big-val mars">${fmtKm(d.mars_distance_km)}</div>
          <div class="rd-big-lbl">🔴 火星からの距離</div>
        </div>
        <div class="rd-big-cell">
          <div class="rd-big-val speed">${fmtSpeed(d.speed_kph)}</div>
          <div class="rd-big-lbl">⚡ 現在の速度</div>
        </div>
        <div class="rd-big-cell">
          <div class="rd-big-val orbit">${d.period_days ? Math.round(d.period_days) + ' 日' : '--'}</div>
          <div class="rd-big-lbl">🔄 軌道周期</div>
        </div>
      </div>
      <div style="font-size:9px;color:var(--text-dim);text-align:center">Orbit: ${d.orbit_type || 'Heliocentric'}</div>`;
  },

  /* ── 🚀 ロケット比較 ── */
  renderRockets(rockets) {
    const grid = document.getElementById('rockets-cards');
    if (!grid || !rockets?.length) return;

    const COLORS = { 'Falcon 9': '#00bfff', 'Falcon Heavy': '#b060ff', 'Starship': '#ff6020', 'Falcon 1': '#00ff88' };

    /* RocketModal にデータを渡す */
    if (typeof RocketModal !== 'undefined') RocketModal.setData(rockets);

    grid.innerHTML = rockets.map(r => {
      const color  = COLORS[r.name] || '#888';
      const leo    = r.payload_weights?.find(p => p.id === 'leo');
      const gto    = r.payload_weights?.find(p => p.id === 'gto');
      const status = r.active ? '<span class="rc-status active">稼働中</span>' : '<span class="rc-status inactive">退役</span>';
      return `
        <div class="rocket-card" style="border-top: 3px solid ${color}" onclick="RocketModal.open('${r.name.replace(/'/g,'\\\'')}')" title="${r.name} の詳細を見る">
          <div class="rc-name">${r.name}</div>
          ${status}
          <div style="font-size:9px;color:var(--accent);margin:-2px 0 6px;opacity:0.7">タップで詳細説明を見る →</div>
          <div class="rc-stat-row"><span class="rc-stat-label">高さ</span><span class="rc-stat-val">${r.height?.meters ?? '--'} m</span></div>
          <div class="rc-stat-row"><span class="rc-stat-label">質量</span><span class="rc-stat-val">${r.mass?.kg ? (r.mass.kg / 1000).toFixed(0) + ' t' : '--'}</span></div>
          <div class="rc-stat-row"><span class="rc-stat-label">エンジン数</span><span class="rc-stat-val">${r.engines?.number ?? '--'}</span></div>
          <div class="rc-stat-row"><span class="rc-stat-label">LEO 搭載量</span><span class="rc-stat-val">${leo ? leo.kg.toLocaleString() + ' kg' : '--'}</span></div>
          <div class="rc-stat-row"><span class="rc-stat-label">GTO 搭載量</span><span class="rc-stat-val">${gto ? gto.kg.toLocaleString() + ' kg' : '--'}</span></div>
          <div class="rc-stat-row"><span class="rc-stat-label">打ち上げコスト</span><span class="rc-stat-val">${r.cost_per_launch ? '$' + (r.cost_per_launch / 1e6).toFixed(0) + 'M' : '--'}</span></div>
          <div class="rc-stat-row"><span class="rc-stat-label">成功率</span><span class="rc-stat-val" style="color:var(--green)">${r.success_rate_pct ?? '--'}%</span></div>
          <div class="rc-stat-row"><span class="rc-stat-label">初飛行</span><span class="rc-stat-val">${r.first_flight ?? '--'}</span></div>
        </div>`;
    }).join('');

    /* 高さ比較チャート */
    const canvas = document.getElementById('rockets-chart');
    if (!canvas) return;
    const existing = Chart.getChart(canvas);
    if (existing) existing.destroy();
    if (this._rocketsChart) { try { this._rocketsChart.destroy(); } catch(e) {} }

    const heights = rockets.map(r => r.height?.meters ?? 0);
    const labels  = rockets.map(r => r.name);
    /* 半透明の色で見やすく */
    const bgColors  = rockets.map(r => (COLORS[r.name] || '#888') + 'aa');
    const brdColors = rockets.map(r => COLORS[r.name] || '#888');

    const ctx = canvas.getContext('2d');
    this._rocketsChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          data: heights,
          backgroundColor: bgColors,
          borderColor: brdColors,
          borderWidth: 2,
          borderRadius: 6,
          borderSkipped: false
        }]
      },
      options: {
        responsive: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: c => `${c.parsed.y} m` } }
        },
        scales: {
          x: {
            grid: { color: 'rgba(40,80,120,0.3)' },
            ticks: { color: '#ffffff', font: { size: 11, weight: '600' } }
          },
          y: {
            grid: { color: 'rgba(40,80,120,0.3)' },
            min: 0,
            ticks: { color: '#ffffff', font: { size: 10 }, callback: v => v + 'm' }
          }
        }
      }
    });
  },

  /* ── 📜 歴史タイムライン ── */
  renderHistory(items) {
    const tl = document.getElementById('history-timeline');
    if (!tl || !items?.length) return;

    const sorted = [...items].sort((a, b) => new Date(b.event_date_utc) - new Date(a.event_date_utc));
    tl.innerHTML = sorted.map(h => {
      const date = h.event_date_utc
        ? new Date(h.event_date_utc).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })
        : '--';
      return `
        <div class="ht-item">
          <div class="ht-date">${date}</div>
          <div class="ht-title">${h.title}</div>
          <div class="ht-detail">${h.details ?? ''}</div>
        </div>`;
    }).join('');
  },

  /* ── 会社情報を統計に反映 ── */
  renderCompany(company, coreData) {
    /* 打ち上げ総数は company.launch_vehicles から */
    if (company?.launch_vehicles) {
      document.getElementById('st-launches').textContent =
        (company.launches?.toLocaleString() ?? '--');
    }
    if (coreData?.serial) {
      const el = document.getElementById('st-crew');
      /* コア情報を宇宙飛行士数の下に追記 */
      const section = el?.closest('.stat-cell');
      if (section) {
        section.title = `最多再使用コア: ${coreData.serial} (${coreData.reuse_count}回)`;
      }
    }
  }
};
