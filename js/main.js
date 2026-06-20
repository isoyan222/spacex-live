/* App orchestrator */
const App = {
  upcomingLaunches: [],
  pastLaunches:     [],
  launchpads:       [],
  cdTimer:          null,

  async init() {
    GlobeManager.init();
    GlobeManager._updateOverlays('earth');
    RightPanel.init();
    this._bindNav();
    this._bindTimebar();
    this._bindHamburger();

    /* Stock chart */
    const spcxCloses = [135, 161, 168, 172, 191, 183, 178, 174.9];
    const spcxLabels = ['Jun 12','Jun 13','Jun 16','Jun 17','Jun 18','Jun 18','Jun 19','Jun 19'];
    try {
      UI.initStockChart(spcxCloses, spcxLabels);
    } catch(e) {
      console.warn('Stock chart init failed:', e.message);
      /* 500ms 後にリトライ */
      setTimeout(() => { try { UI.initStockChart(spcxCloses, spcxLabels); } catch(e2) {} }, 500);
    }

    /* Load all API data in parallel */
    await Promise.allSettled([
      this._loadLaunchpads(),
      this._loadLandpads(),
      this._loadShips(),
      this._loadCrew(),
      this._loadUpcoming(),
      this._loadPast(),
      this._loadStarlink(),
      this._loadRoadster(),
      this._loadRockets(),
      this._loadHistory(),
      this._loadCompany()
    ]);

    /* Fetch live stock prices */
    this._fetchStocks();

    /* Start countdown ticker */
    this.cdTimer = setInterval(() => UI.tickCountdowns(this.upcomingLaunches), 1000);
  },

  /* ── DATA LOADERS ── */
  async _loadLaunchpads() {
    try {
      const data = await SpaceXAPI.getLaunchpads();
      this.launchpads = data;
      GlobeManager.setLaunchpads(data);
    } catch (e) {
      GlobeManager.setLaunchpads(DEMO.launchpads);
    }
  },

  async _loadLandpads() {
    try {
      const data = await SpaceXAPI.getLandpads();
      GlobeManager.setLandpads(data);
    } catch (e) {
      GlobeManager.setLandpads(DEMO.landpads);
    }
  },

  async _loadShips() {
    try {
      const data = await SpaceXAPI.getShips();
      const withPos = data.filter(s => s.latitude != null && s.longitude != null);
      GlobeManager.setShips(withPos);
    } catch (e) {
      GlobeManager.setShips(DEMO.ships);
    }
  },

  async _loadCrew() {
    try {
      /* NASA の ISS リアルタイム乗組員 API（無料・認証不要） */
      const res  = await fetch('https://api.open-notify.org/astros.json',
        { signal: AbortSignal.timeout(6000) });
      const json = await res.json();
      const issCrew = (json.people || [])
        .filter(p => p.craft === 'ISS')
        .map(p => ({ name: p.name, agency: 'ISS 滞在中', status: 'active', image: '' }));
      UI.renderCrew(issCrew.length ? issCrew : DEMO.crew);
    } catch(e) {
      /* フォールバック: SpaceX API */
      try {
        const data = await SpaceXAPI.getCrew();
        UI.renderCrew(data);
      } catch(e2) {
        UI.renderCrew(DEMO.crew);
      }
    }
  },

  async _loadUpcoming() {
    try {
      const data = await SpaceXAPI.getUpcomingLaunches();
      this.upcomingLaunches = data.sort((a, b) => (a.date_unix || 0) - (b.date_unix || 0));
      UI.renderUpcoming(this.upcomingLaunches);
      _checkLiveBanner(this.upcomingLaunches);
      /* 5分ごとに生放送チェック */
      setInterval(() => _checkLiveBanner(this.upcomingLaunches), 300000);
    } catch (e) {
      console.warn('upcoming launches:', e);
      this.upcomingLaunches = DEMO.upcoming;
      UI.renderUpcoming(DEMO.upcoming);
      _checkLiveBanner(DEMO.upcoming);
    }
  },

  async _loadPast() {
    try {
      const data = await SpaceXAPI.getPastLaunches(40);
      this.pastLaunches = data;
      UI.renderRecent(data);
      const arcs = data.slice(0, 20).map(l => ({
        startLat: 28.5 + (Math.random()-0.5)*2, startLng: -80.6 + (Math.random()-0.5)*2,
        endLat:   28.5 + (Math.random()-0.5)*50, endLng: -80.6 + (Math.random()-0.5)*80,
        color: l.success
          ? ['rgba(0,255,136,0)','rgba(0,255,136,0.6)','rgba(0,255,136,0)']
          : ['rgba(255,64,64,0)','rgba(255,64,64,0.6)','rgba(255,64,64,0)'],
        alt: 0.35
      }));
      GlobeManager.setArcs(arcs);
    } catch (e) {
      console.warn('past launches:', e);
      UI.renderRecent(DEMO.past);
    }
  },

  async _loadStarlink() {
    try {
      const sats = await SpaceXAPI.getStarlink(900);
      const valid = sats.filter(s => s.latitude != null && s.longitude != null);
      GlobeManager.setStarlink(valid);
      document.getElementById('st-starlink').textContent = valid.length.toLocaleString();
      document.getElementById('cnt-starlink').textContent = valid.length.toLocaleString();
      UI.setGlobeStatus(`🛰 Starlink ${valid.length.toLocaleString()} 機 追跡中`);
    } catch (e) {
      /* API 失敗時はデモ衛星データを表示 */
      GlobeManager.setStarlink(DEMO.starlink);
      document.getElementById('st-starlink').textContent = '6,800+';
      document.getElementById('cnt-starlink').textContent = '6,800+';
      UI.setGlobeStatus('🛰 Starlink 6,800+ 追跡中');
      console.warn('Starlink fetch error:', e);
    }
  },

  async _loadRoadster() {
    try {
      const d = await SpaceXAPI.getRoadster().catch(() => DEMO.roadster);
      UI.renderRoadster(d);
      /* Globe に Roadster マーカーを追加（地球と火星の間を仮位置で表示） */
      if (d) {
        const roadsterPt = [{
          lat: d.latitude ?? 15,
          lng: ((d.longitude ?? 0) % 360) - 180,
          alt: 0,
          color: '#ffd700',
          r: 0.5,
          tip: `<b style="color:#ffd700">🚗 Tesla Roadster</b><br/>速度: ${Math.round(d.speed_kph || 0).toLocaleString()} km/h<br/>地球から: ${d.earth_distance_km ? (d.earth_distance_km/1e6).toFixed(2) + '億km' : '--'}`,
          type: 'roadster'
        }];
        GlobeManager._data._roadster = roadsterPt;
      }
    } catch(e) { console.warn('Roadster:', e); }
  },

  async _loadRockets() {
    try {
      const data = await SpaceXAPI.getRockets().catch(() => DEMO.rockets);
      this._rockets = data;
      UI.renderRockets(data);
    } catch(e) { UI.renderRockets(DEMO.rockets); }
  },

  async _loadHistory() {
    try {
      const data = await SpaceXAPI.getHistory().catch(() => DEMO.history);
      this._history = data;
      UI.renderHistory(data);
    } catch(e) { UI.renderHistory(DEMO.history); }
  },

  async _loadCompany() {
    try {
      const [company, core] = await Promise.allSettled([
        SpaceXAPI.getCompany(),
        SpaceXAPI.getMostReusedCore()
      ]);
      UI.renderCompany(company.value, core.value);
    } catch(e) { console.warn('Company:', e); }
  },

  async _fetchStocks() {
    const symbols = ['SPCX', 'TSLA', 'RKLB', 'ASTS'];
    for (const sym of symbols) {
      const q = await SpaceXAPI.getStockQuote(sym);
      if (q?.price) {
        UI.updateStock(sym, q.price, q.prev);
        if (sym === 'SPCX' && q.closes?.length > 1) {
          const days = ['Mon','Tue','Wed','Thu','Fri','Mon','Tue','Wed','Thu','Fri'];
          UI.initStockChart(q.closes, days.slice(0, q.closes.length));
        }
      }
    }
  },

  /* ── GLOBE INTERACTION ── */
  focusLaunch(id) {
    const l = this.upcomingLaunches.find(x => x.id === id)
           || this.pastLaunches.find(x => x.id === id);
    if (!l) return;
    const pad = this.launchpads.find(p => p.id === l.launchpad);
    if (pad?.latitude) GlobeManager.flyTo(pad.latitude, pad.longitude, 1.4);
  },

  /* ── NAV TABS ── */
  _bindNav() {
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.nav-tab, .vbtn').forEach(el => el.classList.remove('active'));
        tab.classList.add('active');
        this._switchView(tab.dataset.tab);
      });
    });
    document.querySelectorAll('.vbtn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.vbtn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._switchView(btn.dataset.globe);
      });
    });
  },

  _switchView(key) {
    /* 全オーバーレイを閉じる */
    document.getElementById('rockets-overlay')?.classList.add('hidden');
    document.getElementById('history-overlay')?.classList.add('hidden');
    document.getElementById('stock-overlay')?.classList.add('hidden');

    /* コンテンツ系タブ（ロケット/株価/歴史）かどうかで Starlink 表示を制御 */
    const isContentOverlay = ['rockets','stock','history'].includes(key);
    if (isContentOverlay) {
      /* Starlink を非表示（星空の背景は残る） */
      GlobeManager.globe?.htmlElementsData?.([]);
    } else {
      /* 地球/月/火星/Starlink タブに戻ったら Starlink を復元 */
      /* アニメーションループが次フレームで自動復元するので変数だけリセット */
      if (GlobeManager._layers.starlink && GlobeManager._data.starlink.length) {
        const deg   = (performance.now() / 5400000) * 360;
        const speed = 360 / 5400;
        const t     = performance.now() / 1000;
        const sats  = GlobeManager._data.starlink.map(s => ({
          lat: s.lat0,
          lng: ((s.lng0 + speed * t) % 360) - 180,
          alt: s.alt0
        }));
        GlobeManager.globe?.htmlElementsData?.(sats);
      }
    }

    switch (key) {
      case 'earth':
        GlobeManager.switchTexture('earth');
        GlobeManager.flyTo(0, 0, 2.5);
        UI.setGlobeStatus('🌍 地球 — リアルタイム');
        break;
      case 'moon':
        GlobeManager.switchTexture('moon');
        GlobeManager.flyTo(0, 0, 2.0);
        UI.setGlobeStatus('🌙 月 — Artemis 着陸候補地');
        break;
      case 'mars':
        GlobeManager.switchTexture('mars');
        GlobeManager.flyTo(0, 0, 2.0);
        UI.setGlobeStatus('🔴 火星 — Starship ミッション目標');
        break;
      case 'starlink':
        GlobeManager.switchTexture('earth');
        GlobeManager.flyTo(20, 10, 2.5);
        document.getElementById('lyr-starlink').checked = true;
        updateLayers();
        UI.setGlobeStatus(`🛰 Starlink ${document.getElementById('st-starlink')?.textContent || ''} 機 追跡中`);
        break;
      case 'rockets':
        document.getElementById('rockets-overlay')?.classList.remove('hidden');
        /* オーバーレイ表示後にチャートサイズを再計算 */
        requestAnimationFrame(() => {
          if (UI._rocketsChart) {
            UI._rocketsChart.resize();
          } else if (window.App?._rockets) {
            UI.renderRockets(window.App._rockets);
          }
        });
        UI.setGlobeStatus('🚀 ロケット比較');
        break;
      case 'stock':
        StockOverlay.open();
        UI.setGlobeStatus('📈 SPCX 株価 — NASDAQ');
        break;
      case 'history':
        document.getElementById('history-overlay')?.classList.remove('hidden');
        UI.setGlobeStatus('📜 SpaceX 歴史');
        break;
    }
  },

  /* ── TIME BAR ── */
  _bindTimebar() {
    document.querySelectorAll('.tb-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tb-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  },

  /* ── HAMBURGER (mobile) ── */
  _bindHamburger() {
    document.getElementById('hamburger').addEventListener('click', () => {
      document.getElementById('left-sidebar').classList.toggle('open');
    });
  }
};

function toggleRoadsterInfo() {
  document.getElementById('roadster-info')?.classList.toggle('hidden');
}

/* ── GLOBAL HELPERS (called from HTML) ── */
function updateLayers() {
  const map = {
    'lyr-starlink':   'starlink',
    'lyr-launchpads': 'launchpads',
    'lyr-landpads':   'landpads',
    'lyr-ships':      'ships',
    'lyr-arcs':       'arcs'
  };
  Object.entries(map).forEach(([id, name]) => {
    const el = document.getElementById(id);
    if (el) GlobeManager.toggleLayer(name, el.checked);
  });
}

function refreshLaunches() {
  document.getElementById('launches-list').innerHTML =
    '<div class="skel"></div><div class="skel"></div><div class="skel"></div>';
  App._loadUpcoming();
}

function toggleRotate() {
  const on  = GlobeManager.toggleRotation();
  const btn = document.getElementById('btn-rotate');
  btn.classList.toggle('active', on);
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.();
  } else {
    document.exitFullscreen?.();
  }
}

function closePopup() {
  document.getElementById('info-popup').classList.add('hidden');
}

function showPointPopup(pt) {
  if (!pt?.tip) return;
  document.getElementById('popup-body').innerHTML = `
    <div class="popup-title">${pt.type === 'starlink' ? '🛰 Starlink' : pt.tip.split('<br/>')[0].replace(/<[^>]+>/g,'')}</div>
    ${pt.tip.split('<br/>').slice(1).map(r => `<div class="popup-row">${r}</div>`).join('')}
  `;
  document.getElementById('info-popup').classList.remove('hidden');
}

function mobileTab(panel) {
  const left     = document.getElementById('left-sidebar');
  const right    = document.getElementById('right-sidebar');
  const backdrop = document.getElementById('mobile-backdrop');
  const tabs     = document.querySelectorAll('.mob-tab');

  const isLeftOpen  = left?.classList.contains('open');
  const isRightOpen = right?.classList.contains('open');

  /* 同じボタンを再タップ → 閉じる */
  if (panel === 'left'  && isLeftOpen)  { closeMobilePanels(); return; }
  if (panel === 'right' && isRightOpen) { closeMobilePanels(); return; }

  /* 地球ボタン → 全部閉じる */
  if (panel === 'globe') { closeMobilePanels(); return; }

  /* パネルを開く */
  left?.classList.toggle('open',  panel === 'left');
  right?.classList.toggle('open', panel === 'right');

  /* バックドロップを表示 */
  backdrop?.classList.add('active');

  /* アクティブタブを更新 */
  tabs.forEach((t, i) => {
    t.classList.toggle('active', ['left','globe','right'][i] === panel);
  });
}

function closeMobilePanels() {
  document.getElementById('left-sidebar')?.classList.remove('open');
  document.getElementById('right-sidebar')?.classList.remove('open');
  document.getElementById('mobile-backdrop')?.classList.remove('active');
  /* 地球ボタンをアクティブに戻す */
  document.querySelectorAll('.mob-tab').forEach((t, i) => {
    t.classList.toggle('active', i === 1); /* index 1 = 地球 */
  });
}

/* ── 打ち上げ生放送バナー ── */
function _checkLiveBanner(launches) {
  if (!launches?.length) return;
  const now    = Math.floor(Date.now() / 1000);
  const next   = launches.find(l => l.date_unix && l.date_unix > now);
  if (!next) return;
  const minsLeft = (next.date_unix - now) / 60;
  const banner   = document.getElementById('live-banner');
  if (!banner) return;
  if (minsLeft <= 60 && minsLeft > -10) {
    document.getElementById('lb-name').textContent = next.name || '打ち上げ';
    document.getElementById('lb-time').textContent =
      minsLeft > 0 ? `T- ${Math.round(minsLeft)} 分` : 'ライブ配信中！';
    const url = next.links?.webcast || 'https://www.youtube.com/@SpaceX';
    document.getElementById('lb-link').href = url;
    banner.classList.remove('hidden');
  } else {
    banner.classList.add('hidden');
  }
}

/* ── YouTube 動画再生 ── */
function playVideo(id, thumbEl) {
  const iframe = document.createElement('iframe');
  iframe.src = `https://www.youtube.com/embed/${id}?autoplay=1`;
  iframe.allow = 'autoplay; encrypted-media';
  iframe.allowFullscreen = true;
  iframe.style.cssText = 'width:100%;height:100%;border:none;border-radius:8px;';
  thumbEl.innerHTML = '';
  thumbEl.appendChild(iframe);
  thumbEl.style.cursor = 'default';
}

/* ── BOOT ── */
function _boot() {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => App.init());
  });
}
/* DOMContentLoaded が既に発火済みの場合も確実に起動 */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _boot);
} else {
  _boot();
}
