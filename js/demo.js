/* フォールバック用デモデータ (SpaceX API が応答しない場合に使用) */
const DEMO = {

  upcoming: [
    { id: 'd1', name: 'Starlink Group 10-15', rocket: { name: 'Falcon 9' }, date_unix: Math.floor(Date.now()/1000) + 3600*6,   date_utc: new Date(Date.now()+3600*6000).toISOString(),   date_precision: 'hour' },
    { id: 'd2', name: 'Crew-11',              rocket: { name: 'Falcon 9' }, date_unix: Math.floor(Date.now()/1000) + 86400*18,  date_utc: new Date(Date.now()+86400*18000).toISOString(), date_precision: 'day' },
    { id: 'd3', name: 'Starlink Group 6-72',  rocket: { name: 'Falcon 9' }, date_unix: Math.floor(Date.now()/1000) + 86400*21,  date_utc: new Date(Date.now()+86400*21000).toISOString(), date_precision: 'day' },
    { id: 'd4', name: 'GPS III SV08',         rocket: { name: 'Falcon 9' }, date_unix: Math.floor(Date.now()/1000) + 86400*35,  date_utc: new Date(Date.now()+86400*35000).toISOString(), date_precision: 'month' },
    { id: 'd5', name: 'Starship IFT-9',       rocket: { name: 'Starship' }, date_unix: Math.floor(Date.now()/1000) + 86400*60,  date_utc: new Date(Date.now()+86400*60000).toISOString(), date_precision: 'quarter' },
  ],

  past: [
    { id: 'p1',  name: 'Starlink Group 10-14', date_utc: '2026-06-16T02:30:00.000Z', success: true  },
    { id: 'p2',  name: 'Transporter-13',       date_utc: '2026-06-10T14:00:00.000Z', success: true  },
    { id: 'p3',  name: 'Starlink Group 9-11',  date_utc: '2026-06-05T22:15:00.000Z', success: true  },
    { id: 'p4',  name: 'CRS-32',               date_utc: '2026-05-28T11:00:00.000Z', success: true  },
    { id: 'p5',  name: 'Starlink Group 10-13', date_utc: '2026-05-21T03:45:00.000Z', success: true  },
    { id: 'p6',  name: 'USSF-87',              date_utc: '2026-05-14T20:00:00.000Z', success: true  },
    { id: 'p7',  name: 'Starlink Group 8-22',  date_utc: '2026-05-07T01:30:00.000Z', success: true  },
    { id: 'p8',  name: 'Starship IFT-8',       date_utc: '2026-04-20T18:00:00.000Z', success: true  },
    { id: 'p9',  name: 'Crew-10',              date_utc: '2026-03-12T09:00:00.000Z', success: true  },
    { id: 'p10', name: 'Starlink Group 7-45',  date_utc: '2026-03-05T05:00:00.000Z', success: true  },
  ],

  /* 実際の射場座標 */
  launchpads: [
    { id: 'lp1', name: 'LC-39A (KSC)',     latitude: 28.6080,  longitude: -80.6043, locality: 'Cape Canaveral', region: 'Florida', status: 'active', launch_attempts: 180 },
    { id: 'lp2', name: 'SLC-40 (CCSFS)',   latitude: 28.5618,  longitude: -80.5772, locality: 'Cape Canaveral', region: 'Florida', status: 'active', launch_attempts: 120 },
    { id: 'lp3', name: 'SLC-4E (Vandenberg)', latitude: 34.6321, longitude: -120.6106, locality: 'Vandenberg',  region: 'California', status: 'active', launch_attempts: 80 },
    { id: 'lp4', name: 'Starbase (TX)',    latitude: 25.9972,  longitude: -97.1543, locality: 'Boca Chica',  region: 'Texas',    status: 'active', launch_attempts: 12 },
  ],

  /* 実際の着陸地点座標 */
  landpads: [
    { id: 'lnd1', name: 'LZ-1',  latitude: 28.4858, longitude: -80.5433, type: 'RTLS', status: 'active', landing_successes: 95,  landing_attempts: 97  },
    { id: 'lnd2', name: 'LZ-2',  latitude: 28.4853, longitude: -80.5443, type: 'RTLS', status: 'active', landing_successes: 30,  landing_attempts: 32  },
    { id: 'lnd3', name: 'OCISLY', latitude: 30.5,   longitude: -74.0,    type: 'ASDS', status: 'active', landing_successes: 130, landing_attempts: 135 },
    { id: 'lnd4', name: 'JRTI',   latitude: 27.8,   longitude: -118.5,   type: 'ASDS', status: 'active', landing_successes: 75,  landing_attempts: 78  },
  ],

  /* 回収船（実際の位置に近い座標） */
  ships: [
    { id: 'sh1', name: 'GO Searcher',           latitude: 28.2,   longitude: -79.8,  active: true,  roles: ['Dragon Recovery']     },
    { id: 'sh2', name: 'GO Navigator',          latitude: 27.5,   longitude: -117.5, active: true,  roles: ['Dragon Recovery']     },
    { id: 'sh3', name: 'OCISLY',                latitude: 30.5,   longitude: -74.0,  active: true,  roles: ['Drone Ship']          },
    { id: 'sh4', name: 'JRTI',                  latitude: 27.8,   longitude: -118.5, active: true,  roles: ['Drone Ship']          },
    { id: 'sh5', name: 'GO Quest',              latitude: 26.0,   longitude: -80.2,  active: true,  roles: ['Booster Recovery']    },
  ],

  /* Starlink 衛星デモ座標（軌道シミュレーション） */
  starlink: (() => {
    const sats = [];
    const count = 600;
    for (let i = 0; i < count; i++) {
      const orbit  = Math.floor(i / 60);          // 10軌道面
      const pos    = (i % 60) / 60;               // 軌道内位置
      const inc    = [53, 53, 53, 53, 70, 70, 97, 97, 43, 43][orbit] || 53;
      const raan   = orbit * 36;                  // 昇交点赤経
      const angle  = pos * 360;
      const lat    = inc * Math.sin((angle + raan * 0.1) * Math.PI / 180);
      const lng    = ((raan + angle * 0.6) % 360) - 180;
      sats.push({ latitude: lat, longitude: lng, height_km: 540 + Math.random() * 30, velocity_kms: 7.5 });
    }
    return sats;
  })(),

  rockets: [
    {
      name: 'Falcon 9', active: true, stages: 2,
      cost_per_launch: 67000000, success_rate_pct: 99,
      first_flight: '2010-06-04',
      height: { meters: 70 }, diameter: { meters: 3.7 }, mass: { kg: 549054 },
      engines: { number: 9, type: 'Merlin' },
      payload_weights: [{ id:'leo',name:'LEO',kg:22800 },{ id:'gto',name:'GTO',kg:8300 }],
      description: 'SpaceX の主力ロケット。2段式の中型ロケットで、第1段（ブースター）の垂直着陸・再使用を世界で初めて実現しました。打ち上げ後にブースターが地上またはドローン船に自律着陸し、整備後に再び打ち上げに使用されます。同じブースターが15回以上飛んだ実績もあり、打ち上げコストを劇的に削減。Starlink 衛星の打ち上げや ISS への人員・物資輸送（Crew Dragon・Dragon）に使われており、現在も世界で最も頻繁に打ち上げられているロケットです。',
      trivia: '💡 1機のブースターが最多で20回以上再使用されたことがあります。'
    },
    {
      name: 'Falcon Heavy', active: true, stages: 2,
      cost_per_launch: 97000000, success_rate_pct: 100,
      first_flight: '2018-02-06',
      height: { meters: 70 }, diameter: { meters: 12.2 }, mass: { kg: 1420788 },
      engines: { number: 27, type: 'Merlin' },
      payload_weights: [{ id:'leo',name:'LEO',kg:63800 },{ id:'gto',name:'GTO',kg:26700 }],
      description: 'Falcon 9 のブースターを3本横に束ねた大型ロケットで、現在運用中のロケットとして世界最大級の打ち上げ能力を持ちます。2018年の初飛行では、イーロン・マスク自身の赤い Tesla Roadster が「ペイロード（積み荷）」として宇宙へ打ち上げられました。3本のブースターのうち外側2本は同時に着陸する「双子着陸」を実現。重量物を深宇宙へ送り込む能力があり、NASA の月面ミッション（Artemis）でも活用されています。',
      trivia: '💡 2018年の初打ち上げで、2本のブースターが発射台に同時着陸する光景は世界中に生放送されました。'
    },
    {
      name: 'Starship', active: true, stages: 2,
      cost_per_launch: 10000000, success_rate_pct: 56,
      first_flight: '2023-04-20',
      height: { meters: 121 }, diameter: { meters: 9 }, mass: { kg: 5000000 },
      engines: { number: 39, type: 'Raptor' },
      payload_weights: [{ id:'leo',name:'LEO',kg:150000 },{ id:'gto',name:'GTO',kg:21000 }],
      description: 'SpaceX が開発中の次世代超大型ロケット。高さ121m、総推力約7,500トンで史上最大のロケットです。第1段「Super Heavy」と第2段「Starship」の両方が完全再使用を目標としており、打ち上げコストをさらに100分の1以下に下げることを目指しています。イーロン・マスクが人類の火星移住のために設計したロケットで、将来的には月面着陸（NASA Artemis）や火星有人飛行も計画されています。2024年10月には Super Heavy が発射台の機械アーム「Mechazilla」にキャッチされる歴史的偉業を達成しました。',
      trivia: '💡 Starship 1機で現在の国際宇宙ステーションより多くの貨物を宇宙へ運べます。'
    },
    {
      name: 'Falcon 1', active: false, stages: 2,
      cost_per_launch: 7000000, success_rate_pct: 40,
      first_flight: '2006-03-24',
      height: { meters: 22.25 }, diameter: { meters: 1.7 }, mass: { kg: 38555 },
      engines: { number: 1, type: 'Merlin' },
      payload_weights: [{ id:'leo',name:'LEO',kg:670 }],
      description: 'SpaceX が最初に開発した液体燃料ロケット。2006年の初打ち上げから3回連続で失敗しましたが、2008年9月の4回目の挑戦でついに軌道投入に成功。民間企業が単独開発・運用した液体燃料ロケットとして史上初めて軌道に達したロケットとなり、SpaceX の信頼性を証明しました。現在は退役していますが、この成功が Falcon 9 開発への道を開いた歴史的なロケットです。',
      trivia: '💡 3回連続失敗後、4回目の挑戦資金はほぼ底をついていました。成功しなければ SpaceX は倒産していたかもしれません。'
    }
  ],

  roadster: {
    name: "Elon Musk's Tesla Roadster",
    launch_date_utc: '2018-02-06T20:45:00.000Z',
    orbit_type: 'Heliocentric',
    apoapsis_au: 1.664, periapsis_au: 0.986,
    period_days: 557,
    speed_kph: 38300,
    earth_distance_km: 315000000,
    mars_distance_km: 180000000,
    latitude: 12.4,
    longitude: 45.2
  },

  history: [
    { event_date_utc: '2024-10-13', title: 'Super Heavy キャッチ成功', details: 'Starship IFT-5: ブースターが発射台のアームでキャッチされ、宇宙開発史上初の偉業を達成。' },
    { event_date_utc: '2023-04-20', title: 'Starship 初飛行（IFT-1）', details: 'Starship が初の打ち上げ試験。発射後数分でシステム終了。史上最大のロケットが飛翔。' },
    { event_date_utc: '2022-10-05', title: 'Falcon 9 ブースター 14 回目の飛行', details: 'B1060 が 14 回目の飛行を達成。再使用ロケットの新記録を樹立。' },
    { event_date_utc: '2020-11-15', title: 'Crew Dragon 初の運用飛行（Crew-1）', details: 'Dragon Resilience が 4 名の宇宙飛行士を ISS へ輸送。商業有人宇宙飛行の幕開け。' },
    { event_date_utc: '2020-05-30', title: 'Crew Dragon 初の有人飛行', details: '宇宙飛行士 Bob Behnken と Doug Hurley を乗せ、Demo-2 ミッション成功。9 年ぶりの米国からの有人打ち上げ。' },
    { event_date_utc: '2018-02-06', title: 'Falcon Heavy 初飛行・Tesla Roadster 打ち上げ', details: 'Falcon Heavy がデビュー。イーロン・マスクの Tesla Roadster を宇宙に打ち上げ。火星横断軌道に投入。' },
    { event_date_utc: '2017-03-30', title: 'ロケット再使用の実証', details: 'Falcon 9 B1021 が回収後の再打ち上げに成功。宇宙打ち上げコストの抜本的削減を実証。' },
    { event_date_utc: '2015-12-21', title: 'Falcon 9 第一段機体の垂直着陸成功', details: '軌道投入ミッション後、ブースターが発射台に垂直着陸。宇宙史上初の快挙。' },
    { event_date_utc: '2012-05-25', title: 'Dragon が ISS にドッキング', details: '民間宇宙船として初めて ISS へのドッキングに成功。貨物補給ミッションの先駆け。' },
    { event_date_utc: '2010-12-08', title: 'Dragon 初軌道飛行', details: 'Dragon カプセルが初の軌道飛行と回収に成功。民間初の宇宙船軌道飛行。' },
    { event_date_utc: '2008-09-28', title: 'Falcon 1 初の軌道到達', details: '4 度目の試みで初めて軌道に到達。民間単独開発のロケットとして史上初。' },
    { event_date_utc: '2002-03-14', title: 'SpaceX 設立', details: 'イーロン・マスクが $1 億ドルを投資し Space Exploration Technologies Corp. を設立。人類の多惑星種族化を目標に掲げる。' }
  ],

  crew: [
    { name: 'Anne McClain',   agency: 'NASA',      status: 'active', image: '' },
    { name: 'Nichole Mann',   agency: 'NASA',      status: 'active', image: '' },
    { name: 'Takuya Onishi',  agency: 'JAXA',      status: 'active', image: '' },
    { name: 'Ivan Vagner',    agency: 'Roscosmos', status: 'active', image: '' },
  ]
};
