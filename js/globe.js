/* Globe.gl — SpaceX 3D Earth */
const GlobeManager = {
  globe: null,
  rotating: true,
  _animId: null,

  _data: { starlink: [], launchpads: [], landpads: [], ships: [] },
  _layers: { starlink: true, launchpads: true, landpads: true, ships: true, arcs: false },
  _arcs: [],
  _currentView: 'earth', /* 'earth' | 'moon' | 'mars' */

  TEXTURE_URLS: [
    /* 1st: ローカルファイル（start.bat でダウンロード済み） — 最速・最確実 */
    '/textures/earth-night.jpg',
    /* 2nd: CDN フォールバック */
    'https://cdn.jsdelivr.net/npm/globe.gl/example/img/earth-night.jpg',
    'https://unpkg.com/globe.gl/example/img/earth-night.jpg',
    /* 3rd: NASA Blue Marble（昼） */
    'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/Land_ocean_ice_cloud_hires.jpg/2048px-Land_ocean_ice_cloud_hires.jpg'
  ],

  init() {
    const el = document.getElementById('globe-mount');
    if (typeof Globe !== 'function') {
      el.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#506070;font-size:13px;">⚠️ Globe.gl 読み込み失敗 — インターネット接続を確認</div>';
      return;
    }

    this.globe = Globe()(el);

    /* 即時: Canvas 地球テクスチャ & 宇宙背景（星・月・火星・太陽） */
    this.globe.globeImageUrl(this._makeEarthCanvas());
    this.globe.backgroundImageUrl(this._makeSpaceBackground());
    /* バックグラウンドで本物写真テクスチャを試みる */
    this._tryRealTexture();

    this.globe
      .showAtmosphere(true)
      .atmosphereColor('#2277ff')
      .atmosphereAltitude(0.18)
      .showGraticules(false)
      /* 射場・着陸地点・回収船 */
      .pointsData([])
      .pointLat(d => d.lat).pointLng(d => d.lng)
      .pointAltitude(0).pointColor(d => d.color)
      .pointRadius(d => d.r || 0.4)
      .pointsMerge(false)
      .pointLabel(d => d.tip || '')
      /* 射場パルスリング */
      .ringsData([])
      .ringLat(d => d.lat).ringLng(d => d.lng)
      .ringColor(() => t => `rgba(255,96,32,${(1-t)*0.85})`)
      .ringMaxRadius(4).ringPropagationSpeed(2.5).ringRepeatPeriod(1600)
      /* 打ち上げ軌跡アーク */
      .arcsData([])
      .arcStartLat(d => d.startLat).arcStartLng(d => d.startLng)
      .arcEndLat(d => d.endLat).arcEndLng(d => d.endLng)
      .arcColor(d => d.color)
      .arcAltitude(d => d.alt || 0.35).arcStroke(0.5)
      .arcDashLength(0.4).arcDashGap(0.6).arcDashAnimateTime(2000)
      /* Starlink: HTML glowing dots */
      .htmlElementsData([])
      .htmlElement(() => {
        const el = document.createElement('div');
        el.style.cssText = 'width:5px;height:5px;border-radius:50%;background:#00ddff;box-shadow:0 0 8px 3px rgba(0,200,255,0.85);pointer-events:none;';
        return el;
      })
      .htmlLat(d => d.lat)
      .htmlLng(d => d.lng)
      .htmlAltitude(d => d.alt || 0.088)
      .htmlTransitionDuration(0);

    const ctrl = this.globe.controls();
    ctrl.autoRotate      = true;
    ctrl.autoRotateSpeed = 0.25;
    ctrl.enableDamping   = false;
    ctrl.enableRotate    = true;
    ctrl.enableZoom      = true;
    ctrl.enablePan       = false;

    this.globe.onPointClick(pt => showPointPopup(pt));
    this.globe.onGlobeClick(() => closePopup());

    /* DOM レイアウトが確定してからサイズと初期視点を設定 */
    setTimeout(() => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w > 0 && h > 0) this.globe.width(w).height(h);
      const isMobile = window.innerWidth <= 800;
      this.globe.pointOfView({ lat: 0, lng: 0, altitude: isMobile ? 4.0 : 2.5 }, 0);
      el.querySelectorAll('div').forEach(d => { d.style.pointerEvents = 'none'; });
    }, 300);

    /* 天体オーバーレイのクリックハンドラー */
    this._initOverlayClicks();

    window.addEventListener('resize', () => {
      this.globe.width(el.clientWidth).height(el.clientHeight);
    });

    /* アニメーション開始 */
    this._startAnimation();
  },

  /* ── Starlink アニメーション（80ms 毎に経度を更新） ── */
  _startAnimation() {
    const PERIOD_MS = 5400 * 1000; // 90分
    let lastT = 0;

    const frame = (ts) => {
      this._animId = requestAnimationFrame(frame);
      if (ts - lastT < 80) return;
      lastT = ts;
      /* 地球ビュー以外では衛星を非表示 */
      if (this._currentView !== 'earth' || !this._layers.starlink || !this._data.starlink.length || !this.globe) return;

      const deg = (ts / PERIOD_MS) * 360;
      const sats = this._data.starlink.map(s => ({
        lat: s.lat0,
        lng: ((s.lng0 + deg * s.speed) % 360) - 180,
        alt: s.alt0
      }));
      this.globe.htmlElementsData(sats);
    };
    requestAnimationFrame(frame);
  },

  /* ── 静的ポイント再構築 ── */
  _rebuildStaticPoints() {
    if (!this.globe) return;
    const pts = [];

    if (this._layers.launchpads) {
      this._data.launchpads.forEach(p => {
        const lat = p.latitude ?? p.lat, lng = p.longitude ?? p.lng;
        if (lat == null) return;
        pts.push({
          lat, lng,
          color: p.status === 'active' ? '#ff6020' : '#804030', r: 0.5,
          tip: `<b style="color:#ff6020">🚀 ${p.name}</b><br/>${p.locality||''}, ${p.region||''}<br/>打ち上げ: ${p.launch_attempts ?? '--'}回`,
          type: 'launchpad'
        });
      });
    }
    if (this._layers.landpads) {
      this._data.landpads.forEach(p => {
        const lat = p.latitude ?? p.lat, lng = p.longitude ?? p.lng;
        if (lat == null) return;
        pts.push({
          lat, lng,
          color: p.status === 'active' ? '#00ff88' : '#208050', r: 0.45,
          tip: `<b style="color:#00ff88">🎯 ${p.name}</b><br/>${p.type ?? '--'}<br/>着陸成功: ${p.landing_successes ?? 0}回`,
          type: 'landpad'
        });
      });
    }
    if (this._layers.ships) {
      this._data.ships.forEach(s => {
        const lat = s.latitude ?? s.lat, lng = s.longitude ?? s.lng;
        if (lat == null) return;
        pts.push({
          lat, lng,
          color: s.active ? '#b060ff' : '#6030a0', r: 0.42,
          tip: `<b style="color:#b060ff">🚢 ${s.name}</b><br/>${(s.roles||[]).join(', ') || '--'}`,
          type: 'ship'
        });
      });
    }
    this.globe.pointsData(pts);
  },

  _rebuildRings() {
    if (!this.globe) return;
    if (!this._layers.launchpads) { this.globe.ringsData([]); return; }
    const rings = this._data.launchpads
      .filter(p => p.status === 'active')
      .map(p => ({ lat: p.latitude ?? p.lat, lng: p.longitude ?? p.lng }))
      .filter(r => r.lat != null);
    this.globe.ringsData(rings);
  },

  /* ── セッター ── */
  setStarlink(sats) {
    this._data.starlink = sats.map((s, i) => ({
      lat0: s.latitude ?? s.lat ?? 0,
      lng0: s.longitude ?? s.lng ?? 0,
      alt0: ((s.height_km || 550) / 6371),
      speed: 1 + (i % 3) * 0.02   // 軌道面によって速度を微妙にずらして自然に見せる
    }));
  },

  setLaunchpads(pads) { this._data.launchpads = pads; this._rebuildStaticPoints(); this._rebuildRings(); },
  setLandpads(pads)   { this._data.landpads   = pads; this._rebuildStaticPoints(); },
  setShips(ships)     { this._data.ships       = ships; this._rebuildStaticPoints(); },

  setArcs(arcs) {
    this._arcs = arcs;
    if (this._layers.arcs && this.globe) this.globe.arcsData(arcs);
  },

  toggleLayer(name, on) {
    this._layers[name] = on;
    if (name === 'starlink' && !on && this.globe) this.globe.htmlElementsData([]);
    else if (name === 'starlink' && on) { /* animation loop が更新 */ }
    else this._rebuildStaticPoints();
    if (name === 'launchpads') this._rebuildRings();
    if (name === 'arcs' && this.globe) this.globe.arcsData(on ? this._arcs : []);
  },

  toggleRotation() {
    this.rotating = !this.rotating;
    if (this.globe) this.globe.controls().autoRotate = this.rotating;
    return this.rotating;
  },

  flyTo(lat, lng, alt = 1.8, ms = 1400) {
    if (this.globe) this.globe.pointOfView({ lat, lng, altitude: alt }, ms);
  },

  switchTexture(name) {
    if (!this.globe) return;
    this._currentView = name;

    this._updateOverlays(name);

    if (name === 'earth') {
      this._setFullEmissive(false);
      this.globe.globeImageUrl(this._makeEarthCanvas());
      this._tryRealTexture();
      this.globe.atmosphereColor('#2277ff').atmosphereAltitude(0.18);
      this._rebuildStaticPoints();
      this._rebuildRings();

    } else {
      this.globe.htmlElementsData([]);
      this.globe.ringsData([]);
      this.globe.pointsData([]);

      const textures = {
        moon: 'https://upload.wikimedia.org/wikipedia/commons/e/e1/FullMoon2010.jpg',
        mars: 'https://upload.wikimedia.org/wikipedia/commons/0/02/OSIRIS_Mars_true_color.jpg'
      };
      if (textures[name]) this.globe.globeImageUrl(textures[name]);

      /* 大気を天体に合わせて調整 */
      if (name === 'moon') {
        this.globe.atmosphereColor('#334466').atmosphereAltitude(0.02);
      } else if (name === 'mars') {
        this.globe.atmosphereColor('#c06030').atmosphereAltitude(0.06);
      }

      /* テクスチャが読み込まれてから emissive を適用（黒い暗面を消す） */
      setTimeout(() => this._setFullEmissive(true), 800);

      /* 月・火星の着陸地点を表示 */
      if (name === 'moon') {
        this.globe.pointsData([
          { lat: -89.5, lng:   0.0, color: '#ffd700', r: 0.9, tip: '<b style="color:#ffd700">🌙 Artemis III 着陸候補地</b><br/>南極付近 — 永久影エリア' },
          { lat: -85.3, lng:  31.0, color: '#00ff88', r: 0.7, tip: '<b style="color:#00ff88">Shackleton Crater</b><br/>水氷確認・NASA 最有力候補' },
          { lat: -88.9, lng: -73.1, color: '#00ff88', r: 0.7, tip: '<b style="color:#00ff88">Haworth Crater</b><br/>水氷存在エリア' },
          { lat: -84.9, lng: -34.9, color: '#00bfff', r: 0.7, tip: '<b style="color:#00bfff">Nobile Crater</b><br/>揮発性物質豊富' },
          { lat:   0.7, lng:  23.4, color: '#b060ff', r: 0.6, tip: '<b style="color:#b060ff">Apollo 11 着陸地点</b><br/>Sea of Tranquility — 1969年7月' },
        ]);
      } else if (name === 'mars') {
        this.globe.pointsData([
          { lat:  -4.5, lng: 137.4, color: '#ffd700', r: 0.9, tip: '<b style="color:#ffd700">Gale Crater</b><br/>Curiosity 着陸地点 (2012)' },
          { lat:  18.4, lng:  77.5, color: '#00ff88', r: 0.9, tip: '<b style="color:#00ff88">Jezero Crater</b><br/>Perseverance 着陸地点 (2021)' },
          { lat: -30.6, lng: 254.4, color: '#b060ff', r: 1.1, tip: '<b style="color:#b060ff">⭐ Hellas Planitia</b><br/>Starship 第1候補着陸地点' },
          { lat:  19.3, lng: 326.8, color: '#ff6020', r: 0.8, tip: '<b style="color:#ff6020">Isidis Planitia</b><br/>BepiColombo 着陸地点候補' },
          { lat: -14.6, lng: 175.5, color: '#00bfff', r: 0.7, tip: '<b style="color:#00bfff">Arabia Terra</b><br/>古代河川痕跡エリア' },
        ]);
      }
    }
  },

  /* ── Canvas 地球テクスチャ（ネット不要・即時表示） ── */
  _makeEarthCanvas() {
    const W = 2048, H = 1024;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const c = cv.getContext('2d');

    /* 海 */
    const ocean = c.createLinearGradient(0, 0, 0, H);
    ocean.addColorStop(0,   '#020c1e');
    ocean.addColorStop(0.5, '#041428');
    ocean.addColorStop(1,   '#020c1e');
    c.fillStyle = ocean; c.fillRect(0, 0, W, H);

    /* 大陸 */
    const polys = [
      [[120,155],[210,140],[295,150],[325,200],[310,280],[280,340],[240,380],[190,390],[140,340],[110,280],[100,210]],
      [[225,385],[285,375],[310,420],[310,490],[295,560],[265,615],[235,620],[215,570],[205,490],[215,430]],
      [[800,130],[890,120],[920,140],[910,195],[870,230],[840,235],[810,210],[795,175]],
      [[820,225],[910,210],[960,250],[970,370],[950,480],[910,540],[860,555],[810,510],[790,420],[800,320],[815,260]],
      [[920,110],[1080,95],[1220,100],[1330,130],[1360,200],[1340,300],[1280,360],[1180,370],[1060,340],[960,280],[930,210]],
      [[1200,340],[1280,345],[1300,395],[1270,420],[1220,400],[1190,370]],
      [[1200,480],[1320,465],[1360,520],[1340,590],[1280,625],[1210,615],[1170,565],[1175,510]]
    ];
    polys.forEach(pts => {
      c.beginPath();
      c.moveTo(pts[0][0]*W/1440, pts[0][1]*H/720);
      for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0]*W/1440, pts[i][1]*H/720);
      c.closePath();
      const g = c.createLinearGradient(0, 0, W*0.3, H*0.3);
      g.addColorStop(0, '#1a3d18'); g.addColorStop(1, '#0f2510');
      c.fillStyle = g; c.fill();
    });

    /* 都市の光 */
    const clusters = [
      [175,195,40],[290,195,30],[840,170,35],[860,175,28],
      [985,175,32],[1020,175,42],[1050,185,38],[1195,330,28]
    ];
    clusters.forEach(([cx, cy, r]) => {
      const px = cx*W/1440, py = cy*H/720;
      for (let i = 0; i < r*1.5; i++) {
        const dx = (Math.random()-.5)*r*W/720;
        const dy = (Math.random()-.5)*r*H/720;
        const sz = 1.5+Math.random()*3;
        const a  = 0.4+Math.random()*0.5;
        const grd = c.createRadialGradient(px+dx,py+dy,0,px+dx,py+dy,sz*2.5);
        grd.addColorStop(0, `rgba(255,230,120,${a})`);
        grd.addColorStop(0.5, `rgba(255,160,50,${a*0.3})`);
        grd.addColorStop(1, 'transparent');
        c.fillStyle = grd;
        c.beginPath(); c.arc(px+dx,py+dy,sz*2.5,0,Math.PI*2); c.fill();
      }
    });

    /* 極冠 */
    c.fillStyle = 'rgba(190,220,255,0.2)';
    c.fillRect(0, H*0.88, W, H*0.12);
    c.fillRect(0, 0, W, H*0.05);

    return cv.toDataURL('image/jpeg', 0.92);
  },

  /* ── 宇宙背景（星・月・火星・太陽）Canvas ── */
  _makeSpaceBackground() {
    const W = 2048, H = 1024;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const c = cv.getContext('2d');

    /* 深宇宙の暗い黒 */
    c.fillStyle = '#00000a';
    c.fillRect(0, 0, W, H);

    /* 天の川（帯状のグラデーション） */
    const mw = c.createLinearGradient(0, H*0.3, W, H*0.7);
    mw.addColorStop(0,   'transparent');
    mw.addColorStop(0.2, 'rgba(140,160,220,0.04)');
    mw.addColorStop(0.5, 'rgba(160,180,255,0.07)');
    mw.addColorStop(0.8, 'rgba(140,160,220,0.04)');
    mw.addColorStop(1,   'transparent');
    c.fillStyle = mw;
    c.fillRect(0, 0, W, H);

    /* 星（4000個・大きさ・明るさをランダムに） */
    for (let i = 0; i < 4000; i++) {
      const x = Math.random() * W;
      const y = Math.random() * H;
      const r = Math.random() < 0.95 ? Math.random() * 0.8 : 0.8 + Math.random() * 0.7;
      const a = 0.3 + Math.random() * 0.7;
      /* 青白い星・黄色い星・赤い星をランダムに */
      const hue = Math.random() < 0.7 ? `rgba(255,255,255,${a})`
                : Math.random() < 0.5 ? `rgba(200,220,255,${a})`
                : Math.random() < 0.5 ? `rgba(255,240,200,${a})`
                                       : `rgba(255,200,160,${a})`;
      c.fillStyle = hue;
      c.beginPath(); c.arc(x, y, r, 0, Math.PI*2); c.fill();
    }

    /* 明るい星のグロー（20個） */
    for (let i = 0; i < 20; i++) {
      const x = Math.random() * W, y = Math.random() * H;
      const g = c.createRadialGradient(x, y, 0, x, y, 4);
      g.addColorStop(0, 'rgba(255,255,255,0.9)');
      g.addColorStop(0.3, 'rgba(255,255,255,0.3)');
      g.addColorStop(1, 'transparent');
      c.fillStyle = g;
      c.beginPath(); c.arc(x, y, 4, 0, Math.PI*2); c.fill();
    }

    /* ── 太陽（左上 — 画面外にかかるように） ── */
    const sx = W * 0.04, sy = H * 0.08;
    const sunRays = c.createRadialGradient(sx, sy, 0, sx, sy, W*0.15);
    sunRays.addColorStop(0,    'rgba(255,250,220,1)');
    sunRays.addColorStop(0.04, 'rgba(255,230,120,0.95)');
    sunRays.addColorStop(0.12, 'rgba(255,180,50,0.5)');
    sunRays.addColorStop(0.3,  'rgba(255,120,20,0.15)');
    sunRays.addColorStop(1,    'transparent');
    c.fillStyle = sunRays;
    c.fillRect(0, 0, W*0.25, H*0.35);

    /* ── 月（右上） ── */
    const mx = W * 0.82, my = H * 0.18, mr = 38;
    const moonBody = c.createRadialGradient(mx-8, my-8, 2, mx, my, mr);
    moonBody.addColorStop(0, 'rgba(235,235,245,0.95)');
    moonBody.addColorStop(0.5, 'rgba(200,200,215,0.9)');
    moonBody.addColorStop(0.85, 'rgba(170,170,188,0.85)');
    moonBody.addColorStop(1, 'rgba(140,140,160,0)');
    c.fillStyle = moonBody;
    c.beginPath(); c.arc(mx, my, mr, 0, Math.PI*2); c.fill();
    /* クレーター */
    [[-10,-6,6,0.35],[8,-10,4,0.28],[12,12,5,0.32],[-4,12,3,0.25],[15,-2,3,0.2]].forEach(([dx,dy,cr,a]) => {
      c.fillStyle = `rgba(150,150,170,${a})`;
      c.beginPath(); c.arc(mx+dx, my+dy, cr, 0, Math.PI*2); c.fill();
    });
    /* 月の光輪 */
    const moonGlow = c.createRadialGradient(mx, my, mr*0.8, mx, my, mr*1.5);
    moonGlow.addColorStop(0, 'rgba(200,210,240,0.08)');
    moonGlow.addColorStop(1, 'transparent');
    c.fillStyle = moonGlow;
    c.beginPath(); c.arc(mx, my, mr*1.5, 0, Math.PI*2); c.fill();

    /* ── 火星（右下） ── */
    const rx = W * 0.88, ry = H * 0.78, rr = 22;
    const marsBody = c.createRadialGradient(rx-5, ry-5, 2, rx, ry, rr);
    marsBody.addColorStop(0, 'rgba(210,90,50,0.95)');
    marsBody.addColorStop(0.5, 'rgba(170,55,28,0.9)');
    marsBody.addColorStop(0.85, 'rgba(130,35,15,0.85)');
    marsBody.addColorStop(1, 'rgba(100,20,5,0)');
    c.fillStyle = marsBody;
    c.beginPath(); c.arc(rx, ry, rr, 0, Math.PI*2); c.fill();
    /* 極冠 */
    c.fillStyle = 'rgba(240,240,255,0.4)';
    c.beginPath(); c.arc(rx, ry-rr*0.6, rr*0.35, 0, Math.PI); c.fill();

    return cv.toDataURL('image/jpeg', 0.95);
  },

  /* 天体オーバーレイのクリックハンドラーを設定 */
  _initOverlayClicks() {
    const moon  = document.getElementById('space-moon');
    const mars  = document.getElementById('space-mars');
    const earth = document.getElementById('space-earth-dot');
    if (moon)  moon.onclick  = () => { if (typeof App !== 'undefined') App._switchView('moon');  };
    if (mars)  mars.onclick  = () => { if (typeof App !== 'undefined') App._switchView('mars');  };
    if (earth) earth.onclick = () => { if (typeof App !== 'undefined') App._switchView('earth'); };
  },

  /* ビューに応じてオーバーレイを切り替え */
  _updateOverlays(view) {
    const moon  = document.getElementById('space-moon');
    const mars  = document.getElementById('space-mars');
    const earth = document.getElementById('space-earth-dot');
    if (!moon || !mars) return;

    if (view === 'earth') {
      /* 地球ビュー: 月（クリック可）と 火星（クリック可）を表示 */
      moon.style.display  = 'block';
      moon.style.width    = '82px';
      moon.style.height   = '82px';
      moon.style.top      = '28px';
      moon.style.right    = '44px';
      moon.style.bottom   = '';
      moon.title          = '🌙 クリックで月面ビューへ';
      mars.style.display  = 'block';
      mars.style.width    = '50px';
      mars.style.height   = '50px';
      mars.title          = '🔴 クリックで火星ビューへ';
      if (earth) earth.style.display = 'none';

    } else if (view === 'moon') {
      /* 月ビュー: 月は非表示、月から見た地球を表示、火星は小さく右下 */
      moon.style.display  = 'none';
      if (earth) {
        earth.style.display = 'block';
        earth.className     = 'space-obj earth-from-mars';
        earth.title         = '🌍 クリックで地球ビューへ';
      }
      /* 火星は月から見ると右下に小さく */
      mars.style.display  = 'block';
      mars.style.width    = '32px';
      mars.style.height   = '32px';
      mars.style.bottom   = '56px';
      mars.style.right    = '88px';
      mars.title          = '🔴 クリックで火星ビューへ';

    } else if (view === 'mars') {
      /* 火星ビュー: 火星は非表示、火星から見た地球（小さな青い点）、月は非表示 */
      moon.style.display  = 'none';
      mars.style.display  = 'none';
      if (earth) {
        earth.style.display = 'block';
        earth.className     = 'space-obj earth-from-mars from-mars';
        earth.title         = '🌍 クリックで地球ビューへ';
      }
    }
  },

  /* 月・火星の黒い暗面を消す（Globe.gl 内部の Three.js material を操作） */
  _setFullEmissive(on) {
    if (!this.globe) return;
    this.globe.scene().traverse(obj => {
      if (!obj.isMesh || !obj.material) return;
      if (obj.material.emissive === undefined) return;
      if (on) {
        obj.material.emissiveMap       = obj.material.map;
        obj.material.emissiveIntensity = 1;
      } else {
        obj.material.emissiveMap       = null;
        obj.material.emissiveIntensity = 0;
      }
      obj.material.needsUpdate = true;
    });
  },

  _tryRealTexture() {
    let i = 0;
    const next = () => {
      if (i >= this.TEXTURE_URLS.length) return;
      const url = this.TEXTURE_URLS[i];
      const img = new Image();
      /* crossOrigin なし = ブラウザのキャッシュや通常ロードが使える */
      img.onload = () => {
        if (this.globe && this._currentView === 'earth') {
          this.globe.globeImageUrl(url);
          /* バンプマップもローカルから試みる */
          this.globe.bumpImageUrl('/textures/earth-bump.png');
        }
      };
      img.onerror = () => { i++; next(); };
      img.src = url;
    };
    next();
  }
};
