(function () {
  'use strict';

  /* ========================= 基础设置 ========================= */
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const TAU = Math.PI * 2;
  const SERIF = 'Georgia, "Songti SC", serif';

  const CFG = {
    maxMana: 100,
    manaDrain: 1,         // 移动时每秒扣 1 点
    dashCost: 10,         // 冲刺消耗
    dashRecharge: 0.85,   // 冲刺充能时间
    hurtDamage: 30,       // 石像鬼 / 暗影幽魂伤害
    thornDamage: 15,      // 魔法荆棘伤害
    hurtIframe: 1.0,
    speed: 215,
    dashSpeed: 640,
    dashTime: 0.18,
    comboWindow: 3.0,     // 连击判定窗口（秒）
    comboBonus: 10,       // 每级连击额外回蓝
    lanternDrain: 1.2,    // 开灯时每秒额外耗蓝
    frostRadius: 150,     // 冰霜新星范围
    frostFreeze: 3        // 冰冻时长（秒）
  };

  /* ========================= 关卡配置 ========================= */
  const levels = {
    1: {
      title: '第一关 · 古堡外围',
      theme: 'castle',
      target: 3,
      common: 3,
      rare: 0,
      frost: 0,
      bounds: { left: 190, right: 610, top: 190, bottom: 460 },
      walled: true,
      fog: false,
      fogOn: 240,
      fogOff: 150,
      fogDark: 0.95,
      ghost: false,
      thorns: 0,
      campfires: 0,
      boss: false,
      gargoyles: [
        { a: { x: 245, y: 325 }, b: { x: 555, y: 325 }, speed: 78, t: 0.2, dir: 1 }
      ],
      hint: '方向键移动 · 空格冲刺 · F 开关提灯 · R 重开'
    },
    2: {
      title: '第二关 · 迷雾森林',
      theme: 'forest',
      target: 6,
      common: 4,
      rare: 2,
      frost: 0,
      bounds: { left: 44, right: 756, top: 120, bottom: 560 },
      walled: false,
      fog: true,
      fogOn: 255,
      fogOff: 132,
      fogDark: 0.97,
      ghost: false,
      thorns: 5,
      campfires: 0,
      boss: false,
      gargoyles: [
        { a: { x: 120, y: 255 }, b: { x: 680, y: 255 }, speed: 158, t: 0.1, dir: 1 },
        { a: { x: 410, y: 165 }, b: { x: 410, y: 520 }, speed: 138, t: 0.7, dir: -1 }
      ],
      hint: 'F 开关提灯：开灯视野大但持续耗蓝 · 小心荆棘'
    },
    3: {
      title: '第三关 · 古堡大厅',
      theme: 'castlehall',
      target: 9,
      common: 7,
      rare: 2,
      frost: 2,
      bounds: { left: 44, right: 756, top: 120, bottom: 560 },
      walled: false,
      fog: false,
      fogOn: 250,
      fogOff: 140,
      fogDark: 0.96,
      ghost: true,
      thorns: 0,
      campfires: 0,
      boss: false,
      gargoyles: [
        { a: { x: 120, y: 235 }, b: { x: 680, y: 235 }, speed: 148, t: 0.35, dir: 1 },
        { a: { x: 650, y: 300 }, b: { x: 650, y: 535 }, speed: 126, t: 0.55, dir: -1 }
      ],
      hint: '拾取雪花符文后按 Q 释放冰霜新星 · 小心幽魂'
    },
    4: {
      title: '第四关 · 魔王之厅',
      theme: 'throne',
      target: 12,
      common: 9,
      rare: 3,
      frost: 0,
      bounds: { left: 44, right: 756, top: 120, bottom: 560 },
      walled: false,
      fog: true,
      fogOn: 220,
      fogOff: 104,
      fogDark: 0.997,
      ghost: false,
      thorns: 0,
      campfires: 2,
      boss: true,
      gargoyles: [],
      hint: '踩篝火回满魔力 · 集齐符文后 10 秒内冲进传送门'
    }
  };

  let currentLevel = 1;

  /* ========================= 工具函数 ========================= */
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const rand = (a, b) => a + Math.random() * (b - a);

  function circleRectHit(cx, cy, r, rect) {
    const nx = clamp(cx, rect.x, rect.x + rect.w);
    const ny = clamp(cy, rect.y, rect.y + rect.h);
    const dx = cx - nx;
    const dy = cy - ny;
    return dx * dx + dy * dy < r * r;
  }

  function drawTriangle(r, rot) {
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const ang = rot + i * TAU / 3 - Math.PI / 2;
      const x = Math.cos(ang) * r;
      const y = Math.sin(ang) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  }

  /* ========================= DOM 引用 ========================= */
  const ui = {
    manaPanel: document.getElementById('manaPanel'),
    liquid: document.getElementById('liquid'),
    manaValue: document.getElementById('manaValue'),
    dashPips: document.getElementById('dashPips'),
    frostBadge: document.getElementById('frostBadge'),
    runeTrack: document.getElementById('runeTrack'),
    runeCount: document.getElementById('runeCount'),
    talentChips: document.getElementById('talentChips'),
    chapterLabel: document.getElementById('chapterLabel'),
    hint: document.getElementById('hint'),
    comboBadge: document.getElementById('comboBadge'),
    comboText: document.getElementById('comboText'),
    comboBar: document.getElementById('comboBar'),
    overlay: document.getElementById('overlay'),
    overTitle: document.getElementById('overTitle'),
    overSub: document.getElementById('overSub'),
    endingParticles: document.getElementById('endingParticles'),
    talentCards: document.getElementById('talentCards'),
    restartBtn: document.getElementById('restartBtn'),
    cover: document.getElementById('cover'),
    coverStart: document.getElementById('coverStart')
  };

  /* ========================= 场景（按章节主题预渲染） ========================= */
  const sceneCache = {};

  function sceneCanvas() {
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    return cv;
  }

  /* 地面石板 */
  function paintFlagstones(c, top, opt) {
    const base = c.createLinearGradient(0, top, 0, H);
    base.addColorStop(0, opt.a);
    base.addColorStop(0.5, opt.b);
    base.addColorStop(1, opt.c);
    c.fillStyle = base;
    c.fillRect(0, top, W, H - top);

    const rowH = 78;
    let row = 0;
    for (let y = top; y < H; y += rowH) {
      let x = -40 + (row % 2) * 46;
      while (x < W) {
        const w = 82 + Math.random() * 46;
        const h = rowH - 7;

        c.fillStyle = 'rgba(' + opt.stone + ', ' + (0.05 + Math.random() * 0.06).toFixed(3) + ')';
        c.fillRect(x + 3, y + 3, w, h);
        c.strokeStyle = 'rgba(8, 6, 18, 0.55)';
        c.lineWidth = 1.5;
        c.strokeRect(x + 3, y + 3, w, h);

        c.strokeStyle = opt.hi;
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(x + 5, y + 5);
        c.lineTo(x + w - 2, y + 5);
        c.stroke();

        if (Math.random() < (opt.crack || 0.3)) {
          c.strokeStyle = 'rgba(6, 4, 14, 0.6)';
          c.beginPath();
          const cx = x + 10 + Math.random() * (w - 20);
          c.moveTo(cx, y + 8);
          c.lineTo(cx + (Math.random() - 0.5) * 16, y + h * 0.5);
          c.lineTo(cx + (Math.random() - 0.5) * 22, y + h - 6);
          c.stroke();
        }

        x += w + 6;
      }
      row++;
    }

    // 苔痕
    for (let i = 0; i < (opt.mossCount || 26); i++) {
      const x = Math.random() * W;
      const y = top + Math.random() * (H - top);
      const r = 8 + Math.random() * 20;
      const mg = c.createRadialGradient(x, y, 0, x, y, r);
      mg.addColorStop(0, opt.moss);
      mg.addColorStop(1, opt.mossFade);
      c.fillStyle = mg;
      c.beginPath();
      c.arc(x, y, r, 0, TAU);
      c.fill();
    }
  }

  /* 地面魔法阵纹 */
  function paintFloorSigil(c, x, y, r) {
    c.save();
    c.translate(x, y);
    c.strokeStyle = 'rgba(150, 120, 255, 0.10)';
    c.lineWidth = 2;
    c.beginPath(); c.arc(0, 0, r, 0, TAU); c.stroke();
    c.beginPath(); c.arc(0, 0, r * 0.72, 0, TAU); c.stroke();
    c.setLineDash([10, 13]);
    c.beginPath(); c.arc(0, 0, r * 0.87, 0, TAU); c.stroke();
    c.setLineDash([]);
    for (let i = 0; i < 3; i++) {
      c.save();
      c.rotate(i * TAU / 3);
      c.beginPath();
      c.moveTo(0, -r * 0.72);
      c.lineTo(r * 0.62, r * 0.36);
      c.lineTo(-r * 0.62, r * 0.36);
      c.closePath();
      c.stroke();
      c.restore();
    }
    c.restore();
  }

  /* 第一章：古城堡前庭 */
  function paintCastle(c) {
    const sky = c.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#0b0918');
    sky.addColorStop(0.45, '#151028');
    sky.addColorStop(1, '#07050f');
    c.fillStyle = sky;
    c.fillRect(0, 0, W, H);

    // 月光
    const moon = c.createRadialGradient(W / 2, 26, 8, W / 2, 26, 360);
    moon.addColorStop(0, 'rgba(196, 208, 255, 0.26)');
    moon.addColorStop(0.45, 'rgba(140, 150, 255, 0.08)');
    moon.addColorStop(1, 'rgba(120, 120, 255, 0)');
    c.fillStyle = moon;
    c.fillRect(0, 0, W, 340);

    // 城堡后墙
    const wallH = 124;
    const wallG = c.createLinearGradient(0, 0, 0, wallH);
    wallG.addColorStop(0, '#191732');
    wallG.addColorStop(0.55, '#211f3a');
    wallG.addColorStop(1, '#121022');
    c.fillStyle = wallG;
    c.fillRect(0, 0, W, wallH);

    c.strokeStyle = 'rgba(9, 7, 20, 0.8)';
    c.lineWidth = 1;
    for (let row = 0; row < 5; row++) {
      const y = row * 25;
      c.beginPath(); c.moveTo(0, y + 0.5); c.lineTo(W, y + 0.5); c.stroke();
      const off = row % 2 ? 36 : 0;
      for (let x = off; x < W; x += 72) {
        c.beginPath(); c.moveTo(x + 0.5, y); c.lineTo(x + 0.5, y + 25); c.stroke();
      }
    }

    // 墙沿高光
    const edge = c.createLinearGradient(0, wallH - 14, 0, wallH + 10);
    edge.addColorStop(0, 'rgba(0, 0, 0, 0)');
    edge.addColorStop(0.55, 'rgba(150, 140, 240, 0.20)');
    edge.addColorStop(1, 'rgba(0, 0, 0, 0)');
    c.fillStyle = edge;
    c.fillRect(0, wallH - 14, W, 24);

    // 中央拱门
    const gateW = 134;
    const gateX = W / 2;
    c.save();
    c.beginPath();
    c.moveTo(gateX - gateW / 2, wallH);
    c.lineTo(gateX - gateW / 2, 54);
    c.quadraticCurveTo(gateX, -14, gateX + gateW / 2, 54);
    c.lineTo(gateX + gateW / 2, wallH);
    c.closePath();
    const gateG = c.createLinearGradient(0, 20, 0, wallH);
    gateG.addColorStop(0, 'rgba(58, 34, 96, 0.95)');
    gateG.addColorStop(1, 'rgba(12, 8, 26, 0.98)');
    c.fillStyle = gateG;
    c.fill();
    c.strokeStyle = 'rgba(160, 130, 240, 0.42)';
    c.lineWidth = 2;
    c.stroke();
    const gateLight = c.createLinearGradient(0, 40, 0, wallH);
    gateLight.addColorStop(0, 'rgba(170, 130, 255, 0.20)');
    gateLight.addColorStop(1, 'rgba(170, 130, 255, 0)');
    c.fillStyle = gateLight;
    c.fill();
    c.restore();

    // 两侧旗帜
    [206, W - 206].forEach(function (bx) {
      c.save();
      c.translate(bx, 34);

      c.fillStyle = 'rgba(12, 9, 24, 0.9)';
      c.fillRect(-17, -18, 34, 4);

      const ban = c.createLinearGradient(0, 0, 0, 104);
      ban.addColorStop(0, '#4a1f52');
      ban.addColorStop(1, '#1e0c2c');
      c.fillStyle = ban;
      c.beginPath();
      c.moveTo(-14, 0);
      c.lineTo(14, 0);
      c.lineTo(14, 84);
      c.lineTo(6, 92);
      c.lineTo(0, 84);
      c.lineTo(-6, 92);
      c.lineTo(-14, 84);
      c.closePath();
      c.fill();
      c.strokeStyle = 'rgba(214, 176, 96, 0.5)';
      c.lineWidth = 1.2;
      c.stroke();

      c.strokeStyle = 'rgba(230, 200, 130, 0.6)';
      c.beginPath(); c.arc(0, 40, 9, 0, TAU); c.stroke();
      c.beginPath(); c.moveTo(0, 31); c.lineTo(0, 49); c.stroke();

      c.restore();
    });

    // 地面
    paintFlagstones(c, 124, {
      a: '#2a2540',
      b: '#211d36',
      c: '#151228',
      stone: '150, 140, 210',
      hi: 'rgba(196, 186, 255, 0.10)',
      crack: 0.3,
      moss: 'rgba(60, 110, 80, 0.16)',
      mossFade: 'rgba(40, 80, 60, 0)',
      mossCount: 26
    });

    paintFloorSigil(c, W / 2, (124 + H) / 2 + 20, 172);
  }

  /* 第二章：幽影森林 */
  function paintForest(c) {
    const bg = c.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#08110f');
    bg.addColorStop(0.32, '#0c1d1b');
    bg.addColorStop(0.7, '#0a1714');
    bg.addColorStop(1, '#060e0c');
    c.fillStyle = bg;
    c.fillRect(0, 0, W, H);

    // 林间散射光
    const haze = c.createRadialGradient(W / 2, 70, 24, W / 2, 70, 460);
    haze.addColorStop(0, 'rgba(130, 220, 195, 0.13)');
    haze.addColorStop(0.5, 'rgba(80, 170, 150, 0.05)');
    haze.addColorStop(1, 'rgba(60, 150, 130, 0)');
    c.fillStyle = haze;
    c.fillRect(0, 0, W, 420);

    // 苔草地
    const ground = c.createLinearGradient(0, 110, 0, H);
    ground.addColorStop(0, '#1b2f23');
    ground.addColorStop(0.45, '#16251a');
    ground.addColorStop(1, '#0a120e');
    c.fillStyle = ground;
    c.fillRect(0, 110, W, H - 110);

    // 林间小径
    const path = c.createRadialGradient(W * 0.5, H * 0.56, 20, W * 0.5, H * 0.56, 300);
    path.addColorStop(0, 'rgba(96, 78, 52, 0.18)');
    path.addColorStop(0.6, 'rgba(80, 64, 42, 0.09)');
    path.addColorStop(1, 'rgba(60, 48, 32, 0)');
    c.fillStyle = path;
    c.fillRect(0, 110, W, H - 110);

    // 草叶
    for (let i = 0; i < 520; i++) {
      const x = Math.random() * W;
      const y = 112 + Math.random() * (H - 112);
      const h = 4 + Math.random() * 8;
      const g1 = 120 + Math.random() * 80 | 0;
      c.strokeStyle = 'rgba(' + (60 + Math.random() * 50 | 0) + ', ' + g1 + ', ' +
        (80 + Math.random() * 50 | 0) + ', ' + (0.10 + Math.random() * 0.16).toFixed(2) + ')';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(x, y);
      c.quadraticCurveTo(x + (Math.random() - 0.5) * 5, y - h * 0.6, x + (Math.random() - 0.5) * 9, y - h);
      c.stroke();
    }

    // 碎石与落叶
    for (let i = 0; i < 70; i++) {
      const x = Math.random() * W;
      const y = 112 + Math.random() * (H - 112);
      c.fillStyle = Math.random() < 0.5
        ? 'rgba(120, 120, 110, 0.16)'
        : 'rgba(150, 110, 60, 0.14)';
      c.beginPath();
      c.ellipse(x, y, 1.5 + Math.random() * 3, 1 + Math.random() * 2, Math.random() * TAU, 0, TAU);
      c.fill();
    }

    // 边缘树冠
    function canopy(x, y, r, c1, c2) {
      for (let i = 0; i < 9; i++) {
        const a = Math.random() * TAU;
        const d = Math.random() * r * 0.6;
        const rr = r * (0.42 + Math.random() * 0.4);
        const cx = x + Math.cos(a) * d;
        const cy = y + Math.sin(a) * d * 0.7;
        const g = c.createRadialGradient(cx - rr * 0.3, cy - rr * 0.4, rr * 0.1, cx, cy, rr);
        g.addColorStop(0, c1);
        g.addColorStop(1, c2);
        c.fillStyle = g;
        c.beginPath();
        c.ellipse(cx, cy, rr, rr * 0.8, 0, 0, TAU);
        c.fill();
      }
    }

    canopy(28, 34, 150, 'rgba(52, 96, 68, 0.95)', 'rgba(10, 26, 20, 0.95)');
    canopy(W - 28, 26, 158, 'rgba(44, 88, 62, 0.95)', 'rgba(8, 22, 17, 0.96)');
    canopy(-10, H - 24, 168, 'rgba(40, 80, 58, 0.9)', 'rgba(6, 18, 14, 0.96)');
    canopy(W + 10, H - 16, 172, 'rgba(42, 84, 60, 0.9)', 'rgba(6, 18, 14, 0.96)');
    canopy(W / 2, -44, 132, 'rgba(46, 90, 64, 0.85)', 'rgba(8, 20, 16, 0.95)');

    // 树干
    function trunk(x, w, h, lean) {
      const g = c.createLinearGradient(x - w, 0, x + w, 0);
      g.addColorStop(0, '#100c09');
      g.addColorStop(0.45, '#2a2018');
      g.addColorStop(1, '#0c0907');
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(x - w, h);
      c.quadraticCurveTo(x - w * 0.6 + lean, h * 0.45, x - w * 0.5, -30);
      c.lineTo(x + w * 0.5, -30);
      c.quadraticCurveTo(x + w * 0.6 + lean, h * 0.45, x + w, h);
      c.closePath();
      c.fill();

      c.strokeStyle = 'rgba(90, 70, 50, 0.18)';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(x - w * 0.2, h);
      c.quadraticCurveTo(x - w * 0.1, h * 0.5, x - w * 0.15, -20);
      c.stroke();
    }

    trunk(56, 16, 190, -10);
    trunk(W - 60, 18, 210, 8);
    trunk(338, 9, 96, 4);
    trunk(474, 8, 84, -4);

    // 发光蘑菇
    for (let i = 0; i < 11; i++) {
      const x = 30 + Math.random() * (W - 60);
      const y = 140 + Math.random() * (H - 210);
      const r = 6 + Math.random() * 4;

      const gl = c.createRadialGradient(x, y - r, 0, x, y - r, r * 3.6);
      gl.addColorStop(0, 'rgba(140, 255, 225, 0.20)');
      gl.addColorStop(1, 'rgba(90, 220, 190, 0)');
      c.fillStyle = gl;
      c.beginPath(); c.arc(x, y - r, r * 3.6, 0, TAU); c.fill();

      c.strokeStyle = 'rgba(200, 214, 196, 0.6)';
      c.lineWidth = 1.6;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - r); c.stroke();

      c.fillStyle = 'rgba(120, 245, 220, 0.85)';
      c.beginPath(); c.ellipse(x, y - r, r, r * 0.6, 0, Math.PI, TAU); c.fill();
    }
  }

  /* 第三章：古堡大厅 */
  function paintHall(c) {
    const bg = c.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#07130f');
    bg.addColorStop(0.4, '#0c1f18');
    bg.addColorStop(1, '#050d0a');
    c.fillStyle = bg;
    c.fillRect(0, 0, W, H);

    // 石墙
    const wallH = 128;
    const wallG = c.createLinearGradient(0, 0, 0, wallH);
    wallG.addColorStop(0, '#141c1a');
    wallG.addColorStop(0.6, '#1c2723');
    wallG.addColorStop(1, '#0e1614');
    c.fillStyle = wallG;
    c.fillRect(0, 0, W, wallH);

    c.strokeStyle = 'rgba(8, 14, 12, 0.8)';
    c.lineWidth = 1;
    for (let row = 0; row < 5; row++) {
      const y = row * 26;
      c.beginPath(); c.moveTo(0, y + 0.5); c.lineTo(W, y + 0.5); c.stroke();
      const off = row % 2 ? 38 : 0;
      for (let x = off; x < W; x += 76) {
        c.beginPath(); c.moveTo(x + 0.5, y); c.lineTo(x + 0.5, y + 26); c.stroke();
      }
    }

    // 墙沿高光
    const edge = c.createLinearGradient(0, wallH - 12, 0, wallH + 10);
    edge.addColorStop(0, 'rgba(0, 0, 0, 0)');
    edge.addColorStop(0.55, 'rgba(150, 210, 190, 0.14)');
    edge.addColorStop(1, 'rgba(0, 0, 0, 0)');
    c.fillStyle = edge;
    c.fillRect(0, wallH - 12, W, 22);

    // 三扇哥特高窗，透入幽冷月光
    [168, W / 2, W - 168].forEach(function (wx) {
      const glow = c.createRadialGradient(wx, 88, 12, wx, 88, 190);
      glow.addColorStop(0, 'rgba(150, 235, 214, 0.15)');
      glow.addColorStop(1, 'rgba(90, 180, 160, 0)');
      c.fillStyle = glow;
      c.fillRect(wx - 190, 0, 380, 300);

      c.save();
      c.beginPath();
      c.moveTo(wx - 30, 124);
      c.lineTo(wx - 30, 66);
      c.quadraticCurveTo(wx, 20, wx + 30, 66);
      c.lineTo(wx + 30, 124);
      c.closePath();
      const wg = c.createLinearGradient(0, 24, 0, 124);
      wg.addColorStop(0, 'rgba(182, 246, 228, 0.34)');
      wg.addColorStop(1, 'rgba(58, 122, 108, 0.10)');
      c.fillStyle = wg;
      c.fill();
      c.strokeStyle = 'rgba(148, 200, 182, 0.34)';
      c.lineWidth = 3;
      c.stroke();

      c.strokeStyle = 'rgba(16, 30, 26, 0.85)';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(wx, 26); c.lineTo(wx, 124);
      c.moveTo(wx - 30, 84); c.lineTo(wx + 30, 84);
      c.stroke();
      c.restore();
    });

    // 地面
    paintFlagstones(c, wallH, {
      a: '#202a26',
      b: '#1a231f',
      c: '#0d1412',
      stone: '140, 156, 148',
      hi: 'rgba(186, 208, 196, 0.08)',
      crack: 0.42,
      moss: 'rgba(56, 112, 82, 0.17)',
      mossFade: 'rgba(36, 78, 56, 0)',
      mossCount: 30
    });

    // 中央红毯
    const carpet = c.createLinearGradient(0, wallH, 0, H);
    carpet.addColorStop(0, 'rgba(88, 26, 42, 0.26)');
    carpet.addColorStop(1, 'rgba(46, 12, 24, 0.10)');
    c.fillStyle = carpet;
    c.beginPath();
    c.moveTo(W / 2 - 92, wallH);
    c.lineTo(W / 2 + 92, wallH);
    c.lineTo(W / 2 + 142, H);
    c.lineTo(W / 2 - 142, H);
    c.closePath();
    c.fill();

    // 大厅巨柱
    drawPillar(c, 56, 528, 26, 412, -0.012);
    drawPillar(c, W - 56, 528, 26, 412, 0.012);

    paintFloorSigil(c, W * 0.5, H * 0.63, 152);
  }


  function drawPillar(c, x, y, r, h, lean) {
    c.save();
    c.translate(x, y);
    c.rotate(lean);

    c.fillStyle = 'rgba(0, 0, 0, 0.35)';
    c.beginPath();
    c.ellipse(6, 6, r * 1.2, r * 0.45, 0, 0, TAU);
    c.fill();

    const g = c.createLinearGradient(-r, 0, r, 0);
    g.addColorStop(0, '#2b2640');
    g.addColorStop(0.4, '#484058');
    g.addColorStop(1, '#221d33');
    c.fillStyle = g;
    c.fillRect(-r, -h, r * 2, h);

    c.strokeStyle = 'rgba(12, 8, 22, 0.55)';
    c.lineWidth = 2;
    for (let i = -2; i <= 2; i++) {
      c.beginPath();
      c.moveTo(i * r * 0.38, -h + 6);
      c.lineTo(i * r * 0.38, -4);
      c.stroke();
    }

    // 断口
    c.beginPath();
    c.moveTo(-r, -h);
    c.lineTo(-r * 0.4, -h - 12);
    c.lineTo(r * 0.2, -h - 4);
    c.lineTo(r, -h - 14);
    c.lineTo(r, -h + 4);
    c.lineTo(-r, -h + 4);
    c.closePath();
    c.fillStyle = '#241f36';
    c.fill();

    // 柱础
    c.fillStyle = 'rgba(72, 64, 92, 0.9)';
    c.fillRect(-r - 3, -6, r * 2 + 6, 8);

    c.restore();
  }

  /* 统一暗角与顶部压暗 */
  function paintVignette(c) {
    const band = c.createLinearGradient(0, 0, 0, 150);
    band.addColorStop(0, 'rgba(4, 2, 12, 0.72)');
    band.addColorStop(1, 'rgba(4, 2, 12, 0)');
    c.fillStyle = band;
    c.fillRect(0, 0, W, 150);

    const vig = c.createRadialGradient(W / 2, H / 2, H * 0.32, W / 2, H / 2, H * 0.86);
    vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vig.addColorStop(1, 'rgba(2, 0, 8, 0.82)');
    c.fillStyle = vig;
    c.fillRect(0, 0, W, H);
  }

  /* 第四关：魔王之厅（古堡大厅的暗红变体） */
  function paintThrone(c) {
    paintHall(c);

    // 暗红压暗
    const tint = c.createLinearGradient(0, 0, 0, H);
    tint.addColorStop(0, 'rgba(46, 6, 12, 0.56)');
    tint.addColorStop(0.55, 'rgba(22, 2, 8, 0.48)');
    tint.addColorStop(1, 'rgba(8, 0, 3, 0.64)');
    c.fillStyle = tint;
    c.fillRect(0, 0, W, H);

    // 高背王座剪影
    c.save();
    c.translate(W / 2, 148);
    c.fillStyle = 'rgba(10, 2, 4, 0.92)';
    c.beginPath();
    c.moveTo(-54, 120);
    c.lineTo(-54, -34);
    c.quadraticCurveTo(-50, -64, -26, -58);
    c.lineTo(-18, -90);
    c.lineTo(0, -66);
    c.lineTo(18, -90);
    c.lineTo(26, -58);
    c.quadraticCurveTo(50, -64, 54, -34);
    c.lineTo(54, 120);
    c.closePath();
    c.fill();
    c.strokeStyle = 'rgba(150, 30, 36, 0.35)';
    c.lineWidth = 2;
    c.stroke();
    c.restore();

    // 王座两侧血色烛光
    [W / 2 - 120, W / 2 + 120].forEach(function (cx, i) {
      const gl = c.createRadialGradient(cx, 150, 2, cx, 150, 90);
      gl.addColorStop(0, 'rgba(255, 90, 60, 0.20)');
      gl.addColorStop(1, 'rgba(160, 30, 20, 0)');
      c.fillStyle = gl;
      c.beginPath();
      c.arc(cx, 150, 90, 0, TAU);
      c.fill();

      c.fillStyle = 'rgba(30, 22, 18, 0.9)';
      c.fillRect(cx - 3, 150, 6, 30);
      c.fillStyle = 'rgba(255, 170, 90, 0.95)';
      c.beginPath();
      c.ellipse(cx, 146 - i * 2, 3.6, 8, 0, 0, TAU);
      c.fill();
    });
  }

  /* 统一的墨绿调与暗灰石砖叠层 */
  function paintStoneOverlay(c) {
    const tint = c.createLinearGradient(0, 0, 0, H);
    tint.addColorStop(0, 'rgba(8, 26, 20, 0.44)');
    tint.addColorStop(0.45, 'rgba(10, 32, 24, 0.26)');
    tint.addColorStop(1, 'rgba(4, 16, 12, 0.48)');
    c.fillStyle = tint;
    c.fillRect(0, 0, W, H);

    const rowH = 66;
    let row = 0;
    for (let y = -6; y < H; y += rowH) {
      let x = -46 + (row % 2) * 54;
      while (x < W + 40) {
        const w = 88 + Math.random() * 44;

        c.fillStyle = 'rgba(58, 64, 62, ' + (0.05 + Math.random() * 0.05).toFixed(3) + ')';
        c.fillRect(x + 2, y + 2, w - 4, rowH - 8);

        c.strokeStyle = 'rgba(12, 16, 15, ' + (0.16 + Math.random() * 0.12).toFixed(3) + ')';
        c.lineWidth = 1.2;
        c.strokeRect(x + 2, y + 2, w - 4, rowH - 8);

        c.strokeStyle = 'rgba(150, 164, 156, 0.05)';
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(x + 4, y + 4);
        c.lineTo(x + w - 6, y + 4);
        c.stroke();

        if (Math.random() < 0.28) {
          const mx = x + 8 + Math.random() * (w - 16);
          const my = y + rowH - 12;
          const rr = 14 + Math.random() * 12;
          const mg = c.createRadialGradient(mx, my, 0, mx, my, rr);
          mg.addColorStop(0, 'rgba(64, 120, 82, 0.16)');
          mg.addColorStop(1, 'rgba(40, 80, 56, 0)');
          c.fillStyle = mg;
          c.beginPath();
          c.arc(mx, my, rr, 0, TAU);
          c.fill();
        }

        x += w + 5;
      }
      row++;
    }
  }

  function createScene(theme) {
    if (sceneCache[theme]) return sceneCache[theme];

    const cv = sceneCanvas();
    const c = cv.getContext('2d');
    if (theme === 'castle') paintCastle(c);
    else if (theme === 'forest') paintForest(c);
    else if (theme === 'castlehall') paintHall(c);
    else paintThrone(c);
    paintStoneOverlay(c);
    paintVignette(c);

    sceneCache[theme] = cv;
    return cv;
  }

  /* 预渲染发光光斑，避免每帧创建径向渐变造成掉帧 */
  function glowSprite(size, inner, mid, outer) {
    const cv = document.createElement('canvas');
    cv.width = size;
    cv.height = size;
    const g = cv.getContext('2d');
    const r = size / 2;
    const grad = g.createRadialGradient(r, r, 0, r, r, r);
    grad.addColorStop(0, inner);
    grad.addColorStop(0.35, mid);
    grad.addColorStop(1, outer);
    g.fillStyle = grad;
    g.beginPath();
    g.arc(r, r, r, 0, TAU);
    g.fill();
    return cv;
  }

  /* 飘落的树叶粒子（三章通用） */
  function createLeaves(count) {
    const colors = [
      'rgba(92, 132, 74, 0.85)',
      'rgba(126, 146, 70, 0.82)',
      'rgba(152, 112, 54, 0.82)',
      'rgba(70, 110, 82, 0.85)'
    ];
    return Array.from({ length: count }, function () {
      return {
        x: Math.random() * W,
        y: Math.random() * (H + 40),
        vy: 16 + Math.random() * 30,
        sway: 14 + Math.random() * 30,
        ph: Math.random() * TAU,
        spin: 0.5 + Math.random() * 1.4,
        size: 2.4 + Math.random() * 2.8,
        color: colors[Math.floor(Math.random() * colors.length)]
      };
    });
  }

  /* 场景中的动态元素（火把、萤火虫、雾气、落叶） */
  function createSceneFx(theme) {
    if (theme === 'castle') {
      return {
        theme: theme,
        leaves: createLeaves(22),
        torches: [
          { x: 122, y: 150, s: 1.0 },
          { x: 400, y: 148, s: 1.2 },
          { x: 678, y: 150, s: 0.95 }
        ],
        dust: Array.from({ length: 22 }, function () {
          return {
            x: Math.random() * W,
            y: Math.random() * H,
            sp: 4 + Math.random() * 10,
            ph: Math.random() * TAU,
            s: 0.8 + Math.random() * 1.4
          };
        })
      };
    }

    if (theme === 'forest') {
      return {
        theme: theme,
        leaves: createLeaves(30),
        sprite: glowSprite(30, 'rgba(210, 255, 220, 0.95)', 'rgba(130, 240, 185, 0.30)', 'rgba(90, 210, 160, 0)'),
        flies: Array.from({ length: 26 }, function () {
          return {
            x: 60 + Math.random() * (W - 120),
            y: 150 + Math.random() * (H - 230),
            rx: 18 + Math.random() * 46,
            ry: 12 + Math.random() * 30,
            sx: 0.3 + Math.random() * 0.7,
            sy: 0.25 + Math.random() * 0.6,
            ph: Math.random() * TAU,
            blink: 1.2 + Math.random() * 2.4
          };
        })
      };
    }

    // 第三章：大厅 —— 幽绿薄雾 + 漂浮微尘
    return {
      theme: theme,
      leaves: createLeaves(18),
      moteSprite: glowSprite(14, 'rgba(196, 246, 230, 0.9)', 'rgba(120, 204, 184, 0.32)', 'rgba(80, 160, 142, 0)'),
      fog: Array.from({ length: 6 }, function () {
        return {
          x: Math.random() * W,
          y: 160 + Math.random() * (H - 220),
          r: 120 + Math.random() * 90,
          a: 0.05 + Math.random() * 0.04,
          ph: Math.random() * TAU
        };
      }),
      dust: Array.from({ length: 18 }, function () {
        return {
          x: Math.random() * W,
          y: Math.random() * H,
          sp: 3 + Math.random() * 8,
          ph: Math.random() * TAU,
          s: 0.7 + Math.random() * 1.3
        };
      })
    };
  }

  /* ========================= 状态 ========================= */
  let game = null;
  let overlayAction = null;
  let dashBuffer = 0;          // 冲刺输入缓冲（秒），避免按早一点就丢输入
  const kb = new Set();

  const COMMON_RUNE = {
    size: 14, gain: 20,
    fill: '#8ceaff', stroke: '#eafdff',
    glow: 'rgba(120, 232, 255, 0.45)',
    glowFaint: 'rgba(90, 200, 255, 0.12)',
    solid: 'rgba(140, 240, 255, 0.9)'
  };
  const RARE_RUNE = {
    size: 17, gain: 50,
    fill: '#f2b32a', stroke: '#fff3c0',
    glow: 'rgba(255, 200, 80, 0.48)',
    glowFaint: 'rgba(255, 200, 80, 0.12)',
    solid: 'rgba(255, 205, 90, 0.95)'
  };
  const FROST_RUNE = {
    size: 16, gain: 0,
    fill: '#9fe8ff', stroke: '#eafcff',
    glow: 'rgba(140, 220, 255, 0.55)',
    glowFaint: 'rgba(110, 195, 255, 0.16)',
    solid: 'rgba(170, 235, 255, 0.95)'
  };

  /* ========================= Roguelite 天赋 ========================= */
  const TALENTS = [
    {
      id: 'boots', name: '疾风之靴',
      desc: '移动速度提升 20%',
      apply: function (b) { b.speedMul *= 1.2; }
    },
    {
      id: 'affinity', name: '魔力亲和',
      desc: '冲刺不再消耗魔力',
      apply: function (b) { b.dashFree = true; }
    },
    {
      id: 'shadow', name: '影步护体',
      desc: '冲刺结束后额外获得 0.35 秒无敌',
      apply: function (b) { b.dashInvulnExtra = Math.max(b.dashInvulnExtra, 0.35); }
    },
    {
      id: 'resonance', name: '符文共鸣',
      desc: '拾取符文恢复的魔力提升 50%',
      apply: function (b) { b.runeGainMul *= 1.5; }
    },
    {
      id: 'barkskin', name: '荆棘之肤',
      desc: '受到的所有伤害降低 30%',
      apply: function (b) { b.damageMul *= 0.7; }
    },
    {
      id: 'haste', name: '迅捷充能',
      desc: '冲刺充能速度提升 40%',
      apply: function (b) { b.rechargeMul *= 1.4; }
    }
  ];

  function createBonuses() {
    return {
      speedMul: 1,
      dashFree: false,
      dashInvulnExtra: 0,
      runeGainMul: 1,
      damageMul: 1,
      rechargeMul: 1
    };
  }

  let bonuses = createBonuses();
  let takenTalents = [];
  let frostCharges = 0;

  function createPlayer(bounds, maxCharges) {
    return {
      x: (bounds.left + bounds.right) / 2,
      y: (bounds.top + bounds.bottom) / 2,
      dir: { x: 0, y: 1 },
      facing: 1,
      moving: false,
      dashTime: 0,
      dashCharges: maxCharges,
      maxCharges: maxCharges,
      dashTimer: 0,
      dashDir: { x: 0, y: 1 },
      dashInvuln: 0,
      hurtTimer: 0,
      trail: []
    };
  }

  function createGargoyles(ch) {
    return ch.gargoyles.map(function (d) {
      return {
        a: d.a,
        b: d.b,
        t: d.t,
        dir: d.dir,
        speed: d.speed,
        len: Math.hypot(d.b.x - d.a.x, d.b.y - d.a.y),
        x: d.a.x,
        y: d.a.y,
        phase: Math.random() * TAU,
        flapTimer: 0,
        frozen: 0
      };
    });
  }

  function createRunes(ch) {
    const b = ch.bounds;
    const sx = (b.left + b.right) / 2;
    const sy = (b.top + b.bottom) / 2;
    const gap = ch.walled ? 66 : 76;
    const runes = [];

    const groups = [];
    if (ch.common > 0) groups.push({ def: COMMON_RUNE, count: ch.common, rare: false, kind: 'rune' });
    if (ch.rare > 0) groups.push({ def: RARE_RUNE, count: ch.rare, rare: true, kind: 'rune' });
    if (ch.frost > 0) groups.push({ def: FROST_RUNE, count: ch.frost, rare: false, kind: 'frost' });

    groups.forEach(function (group) {
      for (let i = 0; i < group.count; i++) {
        let pos = null;

        for (let attempt = 0; attempt < 300; attempt++) {
          const x = rand(b.left + 24, b.right - 24);
          const y = rand(b.top + 24, b.bottom - 24);

          if (Math.hypot(x - sx, y - sy) < 95) continue;
          if (runes.some(function (r) { return Math.hypot(x - r.x, y - r.y) < gap; })) continue;

          pos = { x: x, y: y };
          break;
        }

        if (!pos) {
          pos = { x: rand(b.left + 30, b.right - 30), y: rand(b.top + 30, b.bottom - 30) };
        }

        runes.push({
          x: pos.x,
          y: pos.y,
          size: group.def.size,
          gain: group.def.gain,
          fill: group.def.fill,
          stroke: group.def.stroke,
          glow: group.def.glow,
          glowFaint: group.def.glowFaint,
          solid: group.def.solid,
          rare: group.rare,
          kind: group.kind,
          symbol: Math.floor(Math.random() * 3),
          seed: Math.random() * TAU,
          alive: true
        });
      }
    });

    return runes;
  }

  function createThorns(ch, runes) {
    const list = [];
    if (!ch.thorns) return list;

    const b = ch.bounds;
    const sx = (b.left + b.right) / 2;
    const sy = (b.top + b.bottom) / 2;

    for (let i = 0; i < ch.thorns; i++) {
      let pos = null;

      for (let attempt = 0; attempt < 250; attempt++) {
        const x = rand(b.left + 30, b.right - 30);
        const y = rand(b.top + 30, b.bottom - 30);

        if (Math.hypot(x - sx, y - sy) < 100) continue;
        if (runes.some(function (r) { return Math.hypot(x - r.x, y - r.y) < 52; })) continue;
        if (list.some(function (t) { return Math.hypot(x - t.x, y - t.y) < 78; })) continue;

        pos = { x: x, y: y };
        break;
      }

      if (!pos) pos = { x: rand(b.left + 40, b.right - 40), y: rand(b.top + 40, b.bottom - 40) };

      list.push({ x: pos.x, y: pos.y, cd: 0, seed: Math.random() * TAU });
    }

    return list;
  }

  function createBoss(b) {
    return {
      x: b.left + 90,
      y: b.top + 90,
      speed: 46,
      phase: Math.random() * TAU,
      frozen: 0,
      enraged: false,
      trail: [],
      trailTimer: 0
    };
  }

  function createCampfires(ch, runes) {
    const list = [];
    if (!ch.campfires) return list;

    const b = ch.bounds;
    const sx = (b.left + b.right) / 2;
    const sy = (b.top + b.bottom) / 2;

    for (let i = 0; i < ch.campfires; i++) {
      let pos = null;

      for (let attempt = 0; attempt < 250; attempt++) {
        const x = rand(b.left + 60, b.right - 60);
        const y = rand(b.top + 60, b.bottom - 60);

        if (Math.hypot(x - sx, y - sy) < 120) continue;
        if (runes.some(function (r) { return Math.hypot(x - r.x, y - r.y) < 56; })) continue;
        if (list.some(function (f) { return Math.hypot(x - f.x, y - f.y) < 190; })) continue;

        pos = { x: x, y: y };
        break;
      }

      if (!pos) pos = { x: rand(b.left + 60, b.right - 60), y: rand(b.top + 60, b.bottom - 60) };

      list.push({ x: pos.x, y: pos.y, cd: 0, phase: Math.random() * TAU });
    }

    return list;
  }

  /* ========================= 流程控制 ========================= */
  function startGame() {
    bonuses = createBonuses();
    takenTalents = [];
    frostCharges = 0;
    currentLevel = 1;
    ui.cover.classList.add('hide');
    ui.coverStart.blur();
    startLevel(1);
  }

  function showCover() {
    if (!game) return;
    game.state = 'title';
    ui.cover.classList.remove('hide');
    ui.coverStart.blur();
  }

  function startLevel(level) {
    currentLevel = level;
    const ch = levels[level];
    const bounds = ch.bounds;
    const maxCharges = level >= 3 ? 2 : 1;

    game = {
      level: level,
      state: 'playing',
      time: 0,
      mana: CFG.maxMana,
      collected: 0,
      target: ch.target,
      bounds: bounds,
      walled: ch.walled,
      fog: ch.fog,
      fogDark: ch.fogDark,
      fogOnR: ch.fogOn,
      fogOffR: ch.fogOff,
      lanternOn: true,
      frostCharges: frostCharges,
      stepTimer: 0,
      combo: 0,
      comboTimer: 0,
      popups: [],
      runes: [],
      thorns: [],
      campfires: [],
      gargoyles: createGargoyles(ch),
      demon: ch.ghost
        ? { x: bounds.right - 90, y: bounds.top + 90, speed: 62, phase: Math.random() * TAU, frozen: 0 }
        : null,
      boss: ch.boss ? createBoss(bounds) : null,
      altar: null,
      portal: null,
      escapeTimer: 0,
      nova: null,
      trailTimer: 0,
      banner: { text: ch.title, timer: 2.6 },
      player: createPlayer(bounds, maxCharges)
    };

    game.runes = createRunes(ch);
    game.thorns = createThorns(ch, game.runes);
    game.campfires = createCampfires(ch, game.runes);
    game.scene = createScene(ch.theme);
    game.sceneFx = createSceneFx(ch.theme);

    kb.clear();
    dashBuffer = 0;
    overlayAction = null;

    ui.overlay.className = 'overlay';
    ui.endingParticles.innerHTML = '';
    ui.chapterLabel.textContent = ch.title;
    ui.hint.textContent = ch.hint + ' · M 静音';
    buildRuneSlots(ch.target);
    buildDashPips(maxCharges);
    buildTalentChips();
    syncHUD();
  }

  function endGame(kind, reason) {
    game.state = kind;
    syncHUD();

    ui.overlay.className = 'overlay show ' + kind;
    ui.restartBtn.textContent = '重新开始';
    overlayAction = startGame;

    if (kind === 'win') {
      ui.overlay.className = 'overlay show win true-end';
      ui.overTitle.textContent = 'True Ending';
      ui.overSub.innerHTML = '提灯之光驱散了古堡的阴霾，破晓的黎明终于降临。<br>你封印了深渊，成为了这片大地真正的守护者。';
      spawnEndingParticles();
    } else {
      ui.endingParticles.innerHTML = '';
      ui.overTitle.textContent = reason || '魔力枯竭，游戏结束';
      ui.overSub.textContent = '止步于「' + levels[currentLevel].title + '」 · 本次收集符文 ' + game.collected + ' 枚';
    }
  }

  /* 通关结算的金色上升光粒 */
  function spawnEndingParticles() {
    const host = ui.endingParticles;
    host.innerHTML = '';

    for (let i = 0; i < 36; i++) {
      const dot = document.createElement('span');
      const size = 2 + Math.random() * 5;

      dot.style.left = (8 + Math.random() * 84).toFixed(2) + '%';
      dot.style.width = size.toFixed(1) + 'px';
      dot.style.height = size.toFixed(1) + 'px';
      dot.style.opacity = (0.35 + Math.random() * 0.55).toFixed(2);
      dot.style.animationDuration = (6 + Math.random() * 7).toFixed(2) + 's';
      dot.style.animationDelay = (-Math.random() * 8).toFixed(2) + 's';
      dot.style.setProperty('--drift', (Math.random() * 90 - 45).toFixed(1) + 'px');

      host.appendChild(dot);
    }
  }

  function completeChapter() {
    game.state = 'clear';
    syncHUD();
    showTalents();
  }

  /* 关卡间三选一天赋 */
  function showTalents() {
    game.state = 'talent';
    overlayAction = null;

    // 从未获取的天赋中随机抽三张
    const pool = TALENTS.filter(function (t) {
      return takenTalents.indexOf(t.id) === -1;
    });
    const picks = [];
    while (picks.length < 3 && pool.length > 0) {
      const i = Math.floor(Math.random() * pool.length);
      picks.push(pool.splice(i, 1)[0]);
    }

    ui.talentCards.innerHTML = '';
    picks.forEach(function (t) {
      const card = document.createElement('div');
      card.className = 'talent-card';

      const icon = document.createElement('div');
      icon.className = 'talent-icon';

      const name = document.createElement('div');
      name.className = 'talent-name';
      name.textContent = t.name;

      const desc = document.createElement('div');
      desc.className = 'talent-desc';
      desc.textContent = t.desc;

      card.appendChild(icon);
      card.appendChild(name);
      card.appendChild(desc);

      card.addEventListener('click', function () {
        t.apply(bonuses);
        takenTalents.push(t.id);
        startLevel(game.level + 1);
      });

      ui.talentCards.appendChild(card);
    });

    ui.overlay.className = 'overlay show talent';
    ui.overTitle.textContent = '天赋抉择';
    if (game.level === 1) {
      ui.overSub.textContent = '通过第一关 · 选择一项被动天赋，它将伴你走完余下旅程';
    } else if (game.level === 2) {
      ui.overSub.textContent = '通过第二关 · 选择一项被动天赋继续深入';
    } else {
      ui.overSub.textContent = '通过第三关 · 最终关的魔王正在黑暗中等待';
    }
  }

  function syncHUD() {
    const p = game.player;
    const ratio = clamp(game.mana / CFG.maxMana, 0, 1);

    ui.liquid.style.height = (ratio * 100).toFixed(1) + '%';
    ui.manaValue.textContent = String(Math.ceil(game.mana));
    ui.manaPanel.classList.toggle('low', ratio <= 0.3);

    const slots = ui.runeTrack.children;
    const lit = Math.min(game.collected, game.target);
    for (let i = 0; i < slots.length; i++) {
      slots[i].classList.toggle('lit', i < lit);
    }
    ui.runeCount.textContent = game.collected + ' / ' + game.target;

    const pips = ui.dashPips.children;
    for (let i = 0; i < pips.length; i++) {
      pips[i].classList.toggle('ready', i < p.dashCharges);
    }

    // 冰霜充能
    if (ui.frostBadge) {
      const n = game.frostCharges;
      ui.frostBadge.textContent = '冰霜 x' + n;
      ui.frostBadge.classList.toggle('empty', n <= 0);
      ui.frostBadge.classList.toggle('ready', n > 0);
    }

    // 连击提示
    const comboOn = game.combo >= 2 && game.comboTimer > 0;
    ui.comboBadge.classList.toggle('show', comboOn);
    if (comboOn) {
      ui.comboText.textContent = 'COMBO x' + game.combo;
      ui.comboBar.style.width = (game.comboTimer / CFG.comboWindow * 100).toFixed(0) + '%';
    }
  }

  function buildRuneSlots(count) {
    ui.runeTrack.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const wrap = document.createElement('div');
      wrap.className = 'slot-wrap';
      const slot = document.createElement('div');
      slot.className = 'slot';
      wrap.appendChild(slot);
      ui.runeTrack.appendChild(wrap);
    }
  }

  function buildDashPips(count) {
    ui.dashPips.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const pip = document.createElement('div');
      pip.className = 'dash-pip';
      ui.dashPips.appendChild(pip);
    }
  }

  function buildTalentChips() {
    ui.talentChips.innerHTML = '';
    takenTalents.forEach(function (id) {
      const talent = TALENTS.find(function (t) { return t.id === id; });
      if (!talent) return;
      const chip = document.createElement('div');
      chip.className = 'chip';
      chip.textContent = talent.name;
      ui.talentChips.appendChild(chip);
    });
  }

  function playerRect() {
    const p = game.player;
    return { x: p.x - 12, y: p.y - 11, w: 24, h: 26 };
  }

  function placeAltar() {
    const b = game.bounds;
    const inset = game.walled ? 72 : 82;
    const corners = [
      { x: b.left + inset, y: b.top + inset },
      { x: b.right - inset, y: b.top + inset },
      { x: b.left + inset, y: b.bottom - inset },
      { x: b.right - inset, y: b.bottom - inset }
    ];

    let best = corners[0];
    let bestDist = -1;

    corners.forEach(function (c) {
      const d = Math.hypot(c.x - game.player.x, c.y - game.player.y);
      if (d > bestDist) {
        bestDist = d;
        best = c;
      }
    });

    return { x: best.x, y: best.y, r: game.walled ? 44 : 50 };
  }

  /* ========================= 更新 ========================= */
  function update(dt) {
    const g = game;
    if (g.state !== 'playing') return;

    g.time += dt;

    if (g.banner) {
      g.banner.timer -= dt;
      if (g.banner.timer <= 0) g.banner = null;
    }

    const p = g.player;
    p.hurtTimer = Math.max(0, p.hurtTimer - dt);
    p.dashInvuln = Math.max(0, p.dashInvuln - dt);

    // 连击窗口倒计时
    if (g.comboTimer > 0) {
      g.comboTimer -= dt;
      if (g.comboTimer <= 0) {
        g.comboTimer = 0;
        g.combo = 0;
      }
    }

    // Combo 飘字
    if (g.popups.length) {
      g.popups.forEach(function (pop) { pop.life -= dt; });
      g.popups = g.popups.filter(function (pop) { return pop.life > 0; });
    }

    // 冲刺充能恢复
    if (p.dashCharges < p.maxCharges) {
      p.dashTimer += dt;
      if (p.dashTimer >= CFG.dashRecharge / bonuses.rechargeMul) {
        p.dashTimer = 0;
        p.dashCharges += 1;
      }
    }

    // 输入（方向键）
    let ix = 0;
    let iy = 0;
    if (kb.has('up')) iy -= 1;
    if (kb.has('down')) iy += 1;
    if (kb.has('left')) ix -= 1;
    if (kb.has('right')) ix += 1;

    let len = Math.hypot(ix, iy);
    p.moving = len > 0;

    // 冲刺：消耗魔力与一次充能，短暂无敌 + 拖尾（带输入缓冲）
    if (dashBuffer > 0) {
      dashBuffer = Math.max(0, dashBuffer - dt);
      const cost = bonuses.dashFree ? 0 : CFG.dashCost;
      if (p.dashCharges > 0 && g.mana >= cost) {
        dashBuffer = 0;
        if (p.dashCharges === p.maxCharges) p.dashTimer = 0;
        p.dashCharges -= 1;
        g.mana -= cost;
        p.dashTime = CFG.dashTime;
        p.dashInvuln = bonuses.dashInvulnExtra;
        p.dashDir = len > 0
          ? { x: ix / len, y: iy / len }
          : { x: p.dir.x, y: p.dir.y };

        if (g.mana <= 0) {
          g.mana = 0;
          endGame('lose');
          return;
        }
      }
    }

    if (len > 0) {
      ix /= len;
      iy /= len;
      len = 1;
      p.dir.x = ix;
      p.dir.y = iy;
      if (ix > 0.1) p.facing = 1;
      else if (ix < -0.1) p.facing = -1;
    }

    const dashing = p.dashTime > 0;
    let vx = 0;
    let vy = 0;
    if (dashing) {
      p.dashTime = Math.max(0, p.dashTime - dt);
      vx = p.dashDir.x * CFG.dashSpeed;
      vy = p.dashDir.y * CFG.dashSpeed;
    } else {
      vx = ix * CFG.speed * bonuses.speedMul;
      vy = iy * CFG.speed * bonuses.speedMul;
    }

    const b = g.bounds;
    p.x = clamp(p.x + vx * dt, b.left, b.right);
    p.y = clamp(p.y + vy * dt, b.top, b.bottom);

    // 只有移动（含冲刺）才消耗魔力
    const movingNow = dashing || len > 0;
    if (movingNow) {
      g.mana -= CFG.manaDrain * dt;
      if (g.mana <= 0) {
        g.mana = 0;
        endGame('lose');
        return;
      }
    }

    // 提灯点亮时持续耗蓝
    if (g.lanternOn) {
      g.mana -= CFG.lanternDrain * dt;
      if (g.mana <= 0) {
        g.mana = 0;
        endGame('lose');
        return;
      }
    }

    // 冰霜新星扩散动画
    if (g.nova) {
      g.nova.t += dt;
      if (g.nova.t > 0.65) g.nova = null;
    }

    // 石板上的脚步声，按移动节奏触发
    if (movingNow) {
      g.stepTimer -= dt;
      if (g.stepTimer <= 0) {
        playFootstep(dashing);
        g.stepTimer = dashing ? 0.15 : 0.34;
      }
    } else {
      g.stepTimer = 0;
    }

    // 残影采样
    g.trailTimer -= dt;
    if (movingNow && g.trailTimer <= 0) {
      g.trailTimer = dashing ? 0.02 : 0.05;
      p.trail.push({
        x: p.x,
        y: p.y,
        f: p.facing,
        t: g.time,
        sway: Math.sin(g.time * 9) * 3
      });
      if (p.trail.length > 24) p.trail.shift();
    }
    if (p.trail.length) {
      p.trail = p.trail.filter(function (tr) { return g.time - tr.t <= 0.42; });
    }

    updateGargoyles(dt);
    if (g.state !== 'playing') return;

    updateDemon(dt);
    if (g.state !== 'playing') return;

    updateThorns(dt);
    if (g.state !== 'playing') return;

    updateCampfires(dt);
    if (g.state !== 'playing') return;

    updateBoss(dt);
    if (g.state !== 'playing') return;

    checkRunes();

    if (g.level < 4) {
      // 集齐目标符文 → 祭坛浮现
      if (g.collected >= g.target && !g.altar) {
        g.altar = placeAltar();
      }

      // 走进祭坛 → 进入天赋抉择
      if (g.altar &&
          Math.hypot(p.x - g.altar.x, p.y - g.altar.y) < g.altar.r + 8) {
        completeChapter();
        return;
      }
    } else {
      // 最终关：集齐符文 → 传送门出现，魔王狂暴
      if (g.collected >= g.target && !g.portal) {
        g.portal = placeAltar();
        g.escapeTimer = 10;
        if (g.boss) g.boss.enraged = true;
        g.banner = { text: '传送门已开启 · 10 秒内冲进去', timer: 2.6 };
      }

      if (g.portal) {
        g.escapeTimer -= dt;

        if (Math.hypot(p.x - g.portal.x, p.y - g.portal.y) < g.portal.r + 10) {
          endGame('win');
          return;
        }
        if (g.escapeTimer <= 0) {
          endGame('lose', '传送门已关闭，魔王吞噬了你的光');
          return;
        }
      }
    }

    syncHUD();
  }

  function updateGargoyles(dt) {
    const g = game;
    const box = playerRect();

    g.gargoyles.forEach(function (m) {
      m.flapTimer = Math.max(0, m.flapTimer - dt);
      m.frozen = Math.max(0, m.frozen - dt);

      if (m.frozen > 0) return;

      // 沿固定直线巡逻，端点转向时翅膀扇动
      m.t += m.dir * (m.speed / m.len) * dt;
      if (m.t >= 1) {
        m.t = 1;
        m.dir = -1;
        m.flapTimer = 0.5;
      } else if (m.t <= 0) {
        m.t = 0;
        m.dir = 1;
        m.flapTimer = 0.5;
      }
      m.x = m.a.x + (m.b.x - m.a.x) * m.t;
      m.y = m.a.y + (m.b.y - m.a.y) * m.t;

      const invuln = g.player.dashTime > 0 || g.player.dashInvuln > 0 || g.player.hurtTimer > 0;
      if (!invuln && circleRectHit(m.x, m.y, 17, box)) {
        g.player.hurtTimer = CFG.hurtIframe;
        g.mana -= Math.round(CFG.hurtDamage * bonuses.damageMul);
        if (g.mana <= 0) {
          g.mana = 0;
          endGame('lose');
        }
      }
    });
  }

  function updateDemon(dt) {
    const g = game;
    if (!g.demon) return;

    const d = g.demon;
    const p = g.player;
    d.frozen = Math.max(0, (d.frozen || 0) - dt);
    if (d.frozen > 0) return;

    const dx = p.x - d.x;
    const dy = p.y - d.y;
    const dist = Math.hypot(dx, dy) || 1;

    // 缓慢追踪玩家
    d.x += dx / dist * d.speed * dt;
    d.y += dy / dist * d.speed * dt;

    const b = g.bounds;
    d.x = clamp(d.x, b.left + 18, b.right - 18);
    d.y = clamp(d.y, b.top + 18, b.bottom - 18);

    const touchDist = Math.hypot(p.x - d.x, p.y - d.y);
    const invuln = p.dashTime > 0 || p.dashInvuln > 0 || p.hurtTimer > 0;
    if (!invuln && touchDist < 22) {
      p.hurtTimer = CFG.hurtIframe;
      g.mana -= Math.round(CFG.hurtDamage * bonuses.damageMul);
      if (g.mana <= 0) {
        g.mana = 0;
        endGame('lose');
      }
    }
  }

  function updateThorns(dt) {
    const g = game;
    const p = g.player;

    g.thorns.forEach(function (th) {
      th.cd = Math.max(0, th.cd - dt);
      if (th.cd > 0) return;

      if (Math.hypot(p.x - th.x, p.y - th.y) < 22) {
        th.cd = 1.2;
        g.mana -= Math.round(CFG.thornDamage * bonuses.damageMul);
        p.hurtTimer = Math.max(p.hurtTimer, 0.35);
        if (g.mana <= 0) {
          g.mana = 0;
          endGame('lose');
        }
      }
    });
  }

  function updateCampfires(dt) {
    const g = game;
    const p = g.player;

    g.campfires.forEach(function (f) {
      f.cd = Math.max(0, f.cd - dt);
      if (f.cd > 0) return;

      if (Math.hypot(p.x - f.x, p.y - f.y) < 34) {
        f.cd = 8;
        g.mana = CFG.maxMana;
        g.popups.push({
          text: '篝火',
          sub: '魔力回满',
          x: f.x,
          y: f.y,
          life: 1.2,
          maxLife: 1.2
        });
      }
    });
  }

  /* 魔王幽魂：不可击杀，持续追击 */
  function updateBoss(dt) {
    const g = game;
    if (!g.boss) return;

    const b = g.boss;
    const p = g.player;
    b.frozen = Math.max(0, b.frozen - dt);
    b.phase += dt;

    // 黑红粒子拖尾
    b.trailTimer -= dt;
    if (b.trailTimer <= 0) {
      b.trailTimer = 0.045;
      b.trail.push({
        x: b.x + rand(-14, 14),
        y: b.y + rand(-8, 20),
        t: 0,
        r: 7 + Math.random() * 12
      });
    }
    b.trail.forEach(function (part) { part.t += dt; });
    b.trail = b.trail.filter(function (part) { return part.t < 0.85; });

    if (b.frozen > 0) return;

    const dx = p.x - b.x;
    const dy = p.y - b.y;
    const dist = Math.hypot(dx, dy) || 1;
    const speed = b.enraged ? b.speed * 2.1 : b.speed;

    b.x += dx / dist * speed * dt;
    b.y += dy / dist * speed * dt;

    const bd = g.bounds;
    b.x = clamp(b.x, bd.left + 20, bd.right - 20);
    b.y = clamp(b.y, bd.top + 20, bd.bottom - 20);

    const invuln = p.dashTime > 0 || p.dashInvuln > 0 || p.hurtTimer > 0;
    if (!invuln && Math.hypot(p.x - b.x, p.y - b.y) < 48) {
      p.hurtTimer = CFG.hurtIframe;
      g.mana -= Math.round(CFG.hurtDamage * bonuses.damageMul);
      if (g.mana <= 0) {
        g.mana = 0;
        endGame('lose');
      }
    }
  }

  /* F：提灯开关 */
  function toggleLantern() {
    const g = game;
    if (!g || g.state !== 'playing') return;

    g.lanternOn = !g.lanternOn;
    flashHint(g.lanternOn
      ? '提灯已点亮 · 视野扩大，持续耗蓝'
      : '提灯已熄灭 · 视野缩小，不再耗蓝');
  }

  /* Q：冰霜新星 */
  function castFrostNova() {
    const g = game;
    if (!g || g.state !== 'playing' || g.frostCharges <= 0) {
      if (g && g.state === 'playing') flashHint('还没有冰霜充能 · 拾取蓝色雪花符文');
      return;
    }

    g.frostCharges -= 1;
    frostCharges = g.frostCharges;

    const p = g.player;
    g.nova = { x: p.x, y: p.y, t: 0 };

    g.gargoyles.forEach(function (m) {
      if (Math.hypot(m.x - p.x, m.y - p.y) <= CFG.frostRadius) {
        m.frozen = CFG.frostFreeze;
      }
    });

    if (g.demon && Math.hypot(g.demon.x - p.x, g.demon.y - p.y) <= CFG.frostRadius) {
      g.demon.frozen = CFG.frostFreeze;
    }

    if (g.boss && Math.hypot(g.boss.x - p.x, g.boss.y - p.y) <= CFG.frostRadius) {
      g.boss.frozen = 1.2;
    }

    syncHUD();
  }

  function checkRunes() {
    const g = game;
    const box = playerRect();

    g.runes.forEach(function (r) {
      if (!r.alive) return;
      if (!circleRectHit(r.x, r.y, r.size * 0.9, box)) return;

      r.alive = false;

      // 雪花符文：获得冰霜新星充能，不计入收集进度
      if (r.kind === 'frost') {
        frostCharges = Math.min(3, frostCharges + 1);
        g.frostCharges = frostCharges;
        g.popups.push({
          text: '冰霜新星',
          sub: '按 Q 释放',
          x: r.x,
          y: r.y,
          life: 1.4,
          maxLife: 1.4
        });
        syncHUD();
        return;
      }

      g.collected += 1;

      // 连击：3 秒内连续拾取，连击越高回蓝越多
      if (g.comboTimer > 0) g.combo += 1;
      else g.combo = 1;
      g.comboTimer = CFG.comboWindow;

      const comboBonus = Math.min((g.combo - 1) * CFG.comboBonus, 30);
      const gain = Math.round((r.gain + comboBonus) * bonuses.runeGainMul);
      g.mana = Math.min(CFG.maxMana, g.mana + gain);

      if (g.combo >= 2) {
        g.popups.push({
          text: 'Combo x' + g.combo + '!',
          sub: '+' + gain + ' 魔力',
          x: r.x,
          y: r.y,
          life: 1.2,
          maxLife: 1.2
        });
      }
    });
  }

  /* ========================= 绘制 ========================= */
  function render() {
    const g = game;

    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(g.scene, 0, 0);

    drawWalls();
    drawSceneFx(g.sceneFx);

    if (g.altar) drawAltar();

    g.runes.forEach(drawRune);
    g.thorns.forEach(drawThorn);
    drawTrail();
    g.gargoyles.forEach(drawGargoyle);
    if (g.demon) drawDemon(g.demon);
    drawMage();
    if (g.nova) drawNova();

    if (g.fog) drawFog();
    g.campfires.forEach(drawCampfire);   // 篝火与魔王穿透黑暗，始终可见
    if (g.boss) drawBoss(g.boss);
    if (g.portal) drawPortal();
    drawComboPopups();
    if (g.banner) drawBanner();
  }

  /* ---------- Combo 飘字特效 ---------- */
  function drawComboPopups() {
    game.popups.forEach(function (pop) {
      const k = 1 - pop.life / pop.maxLife;      // 0 → 1
      const alpha = Math.min(1, (1 - k) * 2.2);
      const rise = k * 46;
      const scale = 1 + Math.max(0, 0.35 - k * 2.4);

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(pop.x, pop.y - rise);
      ctx.scale(scale, scale);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      ctx.font = 'bold 22px ' + SERIF;
      ctx.fillStyle = '#ffe27a';
      ctx.shadowColor = 'rgba(255, 180, 60, 0.95)';
      ctx.shadowBlur = 18;
      ctx.fillText(pop.text, 0, 0);

      ctx.shadowBlur = 0;
      ctx.font = '12px ' + SERIF;
      ctx.fillStyle = 'rgba(200, 255, 220, 0.9)';
      ctx.fillText(pop.sub, 0, 20);

      ctx.restore();
    });
  }

  /* ---------- 场景动态元素 ---------- */
  function drawSceneFx(fx) {
    if (!fx) return;
    const t = game.time;

    drawLeaves(fx.leaves, t);

    if (fx.theme === 'castle') {
      // 漂浮微尘
      fx.dust.forEach(function (d) {
        const x = (d.x + t * d.sp) % (W + 40) - 20;
        const y = d.y + Math.sin(t * 0.8 + d.ph) * 14;
        ctx.fillStyle = 'rgba(210, 200, 255, 0.20)';
        ctx.beginPath();
        ctx.arc(x, y, d.s, 0, TAU);
        ctx.fill();
      });

      // 壁灯火把
      fx.torches.forEach(function (p, i) {
        const fl = 0.78 + 0.22 * Math.sin(t * 8 + i * 2.1) * Math.sin(t * 3.3 + i);
        const sc = p.s;

        ctx.save();
        ctx.translate(p.x, p.y);

        // 铁架
        ctx.fillStyle = '#241d2e';
        ctx.fillRect(-2.5, 0, 5, 22);
        ctx.beginPath();
        ctx.ellipse(0, 0, 9 * sc, 4 * sc, 0, 0, TAU);
        ctx.fillStyle = '#3a2c1e';
        ctx.fill();

        // 火光
        const glow = ctx.createRadialGradient(0, -8, 2, 0, -8, 100 * sc);
        glow.addColorStop(0, 'rgba(255, 176, 96, ' + (0.22 * fl).toFixed(3) + ')');
        glow.addColorStop(0.45, 'rgba(255, 140, 60, ' + (0.09 * fl).toFixed(3) + ')');
        glow.addColorStop(1, 'rgba(255, 120, 40, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(0, -8, 100 * sc, 0, TAU);
        ctx.fill();

        // 火焰
        ctx.shadowColor = 'rgba(255, 170, 70, 0.9)';
        ctx.shadowBlur = 16 * sc;
        ctx.fillStyle = 'rgba(255, 190, 100, 0.95)';
        ctx.beginPath();
        ctx.moveTo(-5 * sc, -2);
        ctx.quadraticCurveTo(-2 * sc, -14 - fl * 8, Math.sin(t * 5 + i) * 2, (-24 - fl * 12) * sc);
        ctx.quadraticCurveTo(3 * sc, -14 - fl * 6, 5 * sc, -2);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = 'rgba(255, 246, 214, 0.92)';
        ctx.beginPath();
        ctx.ellipse(0, -8 * sc, 1.8 * sc, 5 * sc, 0, 0, TAU);
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.restore();
      });
      return;
    }

    if (fx.theme === 'forest') {
      // 萤火虫
      fx.flies.forEach(function (f) {
        const x = f.x + Math.sin(t * f.sx + f.ph) * f.rx;
        const y = f.y + Math.cos(t * f.sy + f.ph) * f.ry;
        const a = 0.28 + 0.72 * Math.abs(Math.sin(t * f.blink + f.ph));

        ctx.globalAlpha = a;
        ctx.drawImage(fx.sprite, x - 15, y - 15, 30, 30);
        ctx.globalAlpha = 1;

        ctx.fillStyle = 'rgba(238, 255, 228, ' + a.toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(x, y, 1.4, 0, TAU);
        ctx.fill();
      });
      return;
    }

    // 大厅：幽绿薄雾 + 漂浮光尘
    fx.fog.forEach(function (f) {
      const x = f.x + Math.sin(t * 0.16 + f.ph) * 64;
      const y = f.y + Math.cos(t * 0.11 + f.ph) * 26;
      const g = ctx.createRadialGradient(x, y, 0, x, y, f.r);
      g.addColorStop(0, 'rgba(96, 168, 142, ' + (f.a + 0.02).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(60, 120, 100, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, f.r, 0, TAU);
      ctx.fill();
    });

    fx.dust.forEach(function (d) {
      const x = (d.x + t * d.sp) % (W + 40) - 20;
      const y = d.y + Math.sin(t * 0.7 + d.ph) * 16;
      ctx.globalAlpha = 0.28 + 0.22 * Math.sin(t * 1.6 + d.ph);
      ctx.drawImage(fx.moteSprite, x - 7 * d.s, y - 7 * d.s, 14 * d.s, 14 * d.s);
      ctx.globalAlpha = 1;
    });
  }

  /* ---------- 飘落树叶 ---------- */
  function drawLeaves(leaves, t) {
    if (!leaves) return;
    leaves.forEach(function (l) {
      const y = ((l.y + t * l.vy) % (H + 40)) - 20;
      const x = l.x + Math.sin(t * 0.6 + l.ph) * l.sway;
      const rot = l.ph + t * l.spin;
      const flip = 0.3 + 0.7 * Math.abs(Math.cos(t * 1.4 + l.ph));

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.scale(flip, 1);
      ctx.fillStyle = l.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, l.size, l.size * 0.48, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(20, 40, 24, 0.35)';
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(-l.size * 0.8, 0);
      ctx.lineTo(l.size * 0.8, 0);
      ctx.stroke();
      ctx.restore();
    });
  }

  /* ---------- 第一章的小地图围墙 ---------- */
  function drawWalls() {
    if (!game.walled) return;

    const b = game.bounds;
    const x = b.left - 22;
    const y = b.top - 22;
    const w = b.right - b.left + 44;
    const h = b.bottom - b.top + 44;

    ctx.save();

    // 场地外暗化
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.rect(b.left - 20, b.top - 20, b.right - b.left + 40, b.bottom - b.top + 40);
    ctx.fillStyle = 'rgba(4, 2, 12, 0.58)';
    ctx.fill('evenodd');

    // 石墙带
    const wallG = ctx.createLinearGradient(0, y, 0, y + h);
    wallG.addColorStop(0, 'rgba(88, 94, 88, 0.96)');
    wallG.addColorStop(0.5, 'rgba(56, 62, 58, 0.96)');
    wallG.addColorStop(1, 'rgba(30, 35, 32, 0.97)');
    ctx.strokeStyle = wallG;
    ctx.lineWidth = 14;
    ctx.strokeRect(x, y, w, h);

    // 墙体高光与暗边
    ctx.strokeStyle = 'rgba(186, 196, 182, 0.18)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x - 6.5, y - 6.5, w + 13, h + 13);
    ctx.strokeStyle = 'rgba(6, 10, 8, 0.7)';
    ctx.strokeRect(x + 6.5, y + 6.5, w - 13, h - 13);

    // 墙面苔藓（固定位置，避免每帧闪烁）
    for (let i = 0; i < 16; i++) {
      const f1 = Math.abs(Math.sin(i * 12.9898 + 4.1));
      const f2 = Math.abs(Math.sin(i * 78.233 + 1.7));
      const mx = x + 12 + f1 * (w - 24);
      const my = y + 8 + f2 * 6;
      const mg = ctx.createRadialGradient(mx, my, 0, mx, my, 10 + f1 * 8);
      mg.addColorStop(0, 'rgba(72, 132, 88, 0.30)');
      mg.addColorStop(1, 'rgba(46, 92, 62, 0)');
      ctx.fillStyle = mg;
      ctx.beginPath();
      ctx.arc(mx, my, 18, 0, TAU);
      ctx.fill();
    }
    for (let i = 0; i < 12; i++) {
      const f1 = Math.abs(Math.sin(i * 26.651 + 2.3));
      const f2 = Math.abs(Math.sin(i * 41.723 + 0.9));
      const mx = x + 8 + f2 * 6;
      const my = y + 14 + f1 * (h - 28);
      const mg = ctx.createRadialGradient(mx, my, 0, mx, my, 9 + f2 * 7);
      mg.addColorStop(0, 'rgba(72, 132, 88, 0.26)');
      mg.addColorStop(1, 'rgba(46, 92, 62, 0)');
      ctx.fillStyle = mg;
      ctx.beginPath();
      ctx.arc(mx, my, 16, 0, TAU);
      ctx.fill();
    }

    // 垛口
    ctx.fillStyle = 'rgba(58, 64, 58, 0.95)';
    for (let cx = x - 4; cx < x + w - 6; cx += 30) {
      ctx.fillRect(cx, y - 15, 13, 12);
      ctx.fillRect(cx, y + h + 3, 13, 12);
    }
    for (let cy = y - 4; cy < y + h - 6; cy += 30) {
      ctx.fillRect(x - 15, cy, 12, 13);
      ctx.fillRect(x + w + 3, cy, 12, 13);
    }

    // 内侧微光边
    ctx.strokeStyle = 'rgba(132, 190, 154, 0.26)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.left - 15, b.top - 15, b.right - b.left + 30, b.bottom - b.top + 30);

    ctx.restore();
  }

  /* ---------- 祭坛：多层旋转魔法阵 ---------- */
  function drawAltar() {
    const a = game.altar;
    const t = game.time;
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.2);

    ctx.save();
    ctx.translate(a.x, a.y);

    const halo = ctx.createRadialGradient(0, 0, 10, 0, 0, a.r * 1.9);
    halo.addColorStop(0, 'rgba(70, 255, 185, ' + (0.26 + 0.12 * pulse) + ')');
    halo.addColorStop(1, 'rgba(70, 255, 185, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, a.r * 1.9, 0, TAU);
    ctx.fill();

    // 外层：刻度环
    ctx.save();
    ctx.rotate(t * 0.45);
    ctx.shadowColor = 'rgba(80, 255, 185, 0.9)';
    ctx.shadowBlur = 14;
    ctx.strokeStyle = 'rgba(120, 255, 205, 0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, a.r, 0, TAU);
    ctx.stroke();

    for (let i = 0; i < 24; i++) {
      const ang = i / 24 * TAU;
      ctx.beginPath();
      ctx.moveTo(Math.cos(ang) * a.r * 0.86, Math.sin(ang) * a.r * 0.86);
      ctx.lineTo(Math.cos(ang) * a.r * 0.98, Math.sin(ang) * a.r * 0.98);
      ctx.strokeStyle = i % 3 === 0 ? 'rgba(190, 255, 225, 0.9)' : 'rgba(90, 230, 175, 0.45)';
      ctx.lineWidth = i % 3 === 0 ? 2 : 1;
      ctx.stroke();
    }
    ctx.restore();

    // 中层：反向旋转的双三角 + 内圆
    ctx.save();
    ctx.rotate(-t * 0.8);
    ctx.shadowColor = 'rgba(90, 230, 255, 0.8)';
    ctx.shadowBlur = 12;
    ctx.strokeStyle = 'rgba(130, 240, 255, 0.8)';
    ctx.lineWidth = 2;
    drawTriangle(a.r * 0.78, 0);
    drawTriangle(a.r * 0.78, Math.PI / 3);
    ctx.beginPath();
    ctx.arc(0, 0, a.r * 0.56, 0, TAU);
    ctx.stroke();
    ctx.restore();

    // 内层：虚线小环
    ctx.save();
    ctx.rotate(t * 1.4);
    ctx.strokeStyle = 'rgba(210, 255, 240, 0.75)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 9]);
    ctx.beginPath();
    ctx.arc(0, 0, a.r * 0.34, 0, TAU);
    ctx.stroke();
    ctx.restore();

    // 核心
    const coreR = 8 + pulse * 4;
    const core = ctx.createRadialGradient(0, 0, 0, 0, 0, coreR * 2.4);
    core.addColorStop(0, 'rgba(245, 255, 250, 1)');
    core.addColorStop(0.35, 'rgba(110, 255, 200, 0.9)');
    core.addColorStop(1, 'rgba(70, 255, 180, 0)');
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(0, 0, coreR * 2.4, 0, TAU);
    ctx.fill();

    // 上升粒子
    for (let i = 0; i < 10; i++) {
      const prog = (t * 0.5 + i / 10) % 1;
      const ang = i * 2.399 + t * 0.3;
      const dist = a.r * (1.15 - prog * 0.9);
      ctx.fillStyle = 'rgba(150, 255, 215, ' + (1 - prog) * 0.8 + ')';
      ctx.beginPath();
      ctx.arc(Math.cos(ang) * dist, Math.sin(ang) * dist - prog * 10, 1.6, 0, TAU);
      ctx.fill();
    }

    ctx.restore();

    // 提示文字
    ctx.save();
    ctx.font = '15px ' + SERIF;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(150, 255, 215, ' + (0.6 + 0.4 * pulse) + ')';
    ctx.shadowColor = 'rgba(80, 255, 190, 0.9)';
    ctx.shadowBlur = 12;
    ctx.fillText('祭坛已开启', a.x, a.y + a.r + 26);
    ctx.restore();
  }

  /* ---------- 逃生传送门 ---------- */
  function drawPortal() {
    const a = game.portal;
    const t = game.time;
    const pulse = 0.5 + 0.5 * Math.sin(t * 3.2);

    ctx.save();
    ctx.translate(a.x, a.y);

    const halo = ctx.createRadialGradient(0, 0, 6, 0, 0, a.r * 2.6);
    halo.addColorStop(0, 'rgba(170, 210, 255, ' + (0.30 + 0.16 * pulse).toFixed(3) + ')');
    halo.addColorStop(0.45, 'rgba(110, 140, 255, 0.16)');
    halo.addColorStop(1, 'rgba(80, 90, 255, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, a.r * 2.6, 0, TAU);
    ctx.fill();

    const swirl = ctx.createRadialGradient(0, 0, 2, 0, 0, a.r);
    swirl.addColorStop(0, 'rgba(240, 246, 255, 0.95)');
    swirl.addColorStop(0.35, 'rgba(130, 180, 255, 0.75)');
    swirl.addColorStop(0.7, 'rgba(80, 90, 220, 0.45)');
    swirl.addColorStop(1, 'rgba(40, 30, 120, 0.1)');
    ctx.fillStyle = swirl;
    ctx.beginPath();
    ctx.arc(0, 0, a.r, 0, TAU);
    ctx.fill();

    ctx.save();
    ctx.rotate(t * 1.6);
    ctx.strokeStyle = 'rgba(210, 236, 255, 0.85)';
    ctx.lineWidth = 2.4;
    ctx.setLineDash([14, 12]);
    ctx.beginPath();
    ctx.arc(0, 0, a.r * 0.82, 0, TAU);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.rotate(-t * 2.2);
    ctx.strokeStyle = 'rgba(160, 200, 255, 0.7)';
    ctx.lineWidth = 1.6;
    ctx.setLineDash([6, 14]);
    ctx.beginPath();
    ctx.arc(0, 0, a.r * 0.58, 0, TAU);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.shadowColor = 'rgba(160, 210, 255, 0.95)';
    ctx.shadowBlur = 20 + pulse * 12;
    ctx.beginPath();
    ctx.arc(0, 0, 4 + pulse * 2, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();

    // 文字与倒计时
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 15px ' + SERIF;
    ctx.fillStyle = 'rgba(210, 235, 255, ' + (0.7 + 0.3 * pulse).toFixed(3) + ')';
    ctx.shadowColor = 'rgba(140, 190, 255, 0.9)';
    ctx.shadowBlur = 14;
    ctx.fillText('逃 生 传 送 门', a.x, a.y + a.r + 26);

    ctx.font = 'bold 26px ' + SERIF;
    ctx.fillStyle = '#ffe9b0';
    ctx.shadowColor = 'rgba(255, 140, 60, 0.95)';
    ctx.shadowBlur = 18;
    ctx.fillText(Math.max(0, game.escapeTimer).toFixed(1) + 's', a.x, a.y + a.r + 54);
    ctx.restore();
  }

  /* ---------- 篝火 ---------- */
  function drawCampfire(f) {
    const t = game.time;
    const pulse = 0.6 + 0.4 * Math.sin(t * 8 + f.phase);

    ctx.save();
    ctx.translate(f.x, f.y);

    const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, 82);
    glow.addColorStop(0, 'rgba(255, 190, 90, ' + (0.22 * pulse).toFixed(3) + ')');
    glow.addColorStop(0.5, 'rgba(255, 130, 40, ' + (0.10 * pulse).toFixed(3) + ')');
    glow.addColorStop(1, 'rgba(255, 100, 20, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 82, 0, TAU);
    ctx.fill();

    // 石圈
    ctx.fillStyle = 'rgba(60, 60, 56, 0.9)';
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * TAU;
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * 20, Math.sin(a) * 12, 4.4, 3.2, a, 0, TAU);
      ctx.fill();
    }

    // 木柴
    ctx.strokeStyle = 'rgba(70, 44, 26, 0.95)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-8, 6);
    ctx.lineTo(7, -2);
    ctx.moveTo(-7, -2);
    ctx.lineTo(8, 7);
    ctx.stroke();

    // 火焰
    const h = 16 + pulse * 8;
    ctx.shadowColor = 'rgba(255, 150, 40, 0.9)';
    ctx.shadowBlur = 18;
    ctx.fillStyle = 'rgba(255, 140, 40, 0.9)';
    ctx.beginPath();
    ctx.moveTo(-7, 4);
    ctx.quadraticCurveTo(-9, -h * 0.45, Math.sin(t * 9 + f.phase) * 3, -h);
    ctx.quadraticCurveTo(9, -h * 0.45, 7, 4);
    ctx.quadraticCurveTo(0, 9, -7, 4);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 236, 150, 0.95)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 3.4, h * 0.42, 0, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;

    // 冷却环
    if (f.cd > 0) {
      ctx.strokeStyle = 'rgba(255, 220, 160, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, 27, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - f.cd / 8));
      ctx.stroke();
    }

    ctx.restore();
  }

  /* ---------- 符文：萤火虫形态 ---------- */
  function drawRune(r) {
    if (!r.alive) return;
    if (r.kind === 'frost') {
      drawFrostRune(r);
      return;
    }

    const t = game.time;
    const bob = Math.sin(t * 1.8 + r.seed) * 3.5;
    const drift = Math.sin(t * 0.9 + r.seed) * 2.4;
    const cx = r.x + drift;
    const cy = r.y + bob;
    const size = r.size;

    ctx.save();
    ctx.translate(cx, cy);

    // 光晕
    const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 3.4);
    halo.addColorStop(0, r.glow);
    halo.addColorStop(0.55, r.glowFaint);
    halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, size * 3.4, 0, TAU);
    ctx.fill();

    // 拖尾光点
    for (let i = 0; i < 3; i++) {
      const px = -(i + 1) * (5 + size * 0.26) + Math.sin(t * 2.2 + r.seed + i) * 2;
      const py = size * 0.5 + (i + 1) * 2.6 + Math.cos(t * 1.9 + i) * 2;
      ctx.fillStyle = r.solid;
      ctx.globalAlpha = 0.42 - i * 0.11;
      ctx.beginPath();
      ctx.arc(px, py, Math.max(1, 2.6 - i * 0.6), 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 翅膀（左右各一，快速扇动）
    const flap = 0.55 + 0.45 * Math.abs(Math.sin(t * 15 + r.seed));
    ctx.save();
    ctx.rotate(Math.sin(t * 1.1 + r.seed) * 0.22);
    for (let side = -1; side <= 1; side += 2) {
      const wg = ctx.createLinearGradient(0, 0, side * size * 1.5, -size);
      wg.addColorStop(0, 'rgba(230, 255, 255, 0.08)');
      wg.addColorStop(0.6, r.rare ? 'rgba(255, 236, 176, 0.34)' : 'rgba(190, 244, 255, 0.30)');
      wg.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = wg;
      ctx.strokeStyle = r.rare ? 'rgba(255, 234, 170, 0.55)' : 'rgba(198, 246, 255, 0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(side * size * 0.92, -size * 0.42, size * 0.86, size * 0.5 * flap,
        side * 0.6, 0, TAU);
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(side * size * 1.3, -size * 0.55);
      ctx.stroke();
    }
    ctx.restore();

    // 虫体
    const bodyG = ctx.createLinearGradient(0, -size * 0.9, 0, size);
    bodyG.addColorStop(0, r.stroke);
    bodyG.addColorStop(0.5, r.fill);
    bodyG.addColorStop(1, r.rare ? '#d98a12' : '#1f9fd8');
    ctx.fillStyle = bodyG;
    ctx.shadowColor = r.solid;
    ctx.shadowBlur = r.rare ? 20 : 14;
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 0.6, size * 0.86, 0, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;

    // 腹部环节
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 0.9;
    for (let i = 1; i <= 2; i++) {
      ctx.beginPath();
      ctx.arc(0, size * 0.18 * i, size * 0.44 - i * 1.4, 0.2, Math.PI - 0.2);
      ctx.stroke();
    }

    // 头部与触角
    ctx.fillStyle = r.stroke;
    ctx.beginPath();
    ctx.arc(0, -size * 0.72, size * 0.26, 0, TAU);
    ctx.fill();

    ctx.strokeStyle = r.stroke;
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(-size * 0.12, -size * 0.9);
    ctx.quadraticCurveTo(-size * 0.5, -size * 1.3, -size * 0.72, -size * 1.2);
    ctx.moveTo(size * 0.12, -size * 0.9);
    ctx.quadraticCurveTo(size * 0.5, -size * 1.3, size * 0.72, -size * 1.2);
    ctx.stroke();

    // 尾灯核心
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.shadowColor = r.stroke;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(0, size * 0.12, size * 0.2, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.restore();
  }

  /* ---------- 雪花符文 ---------- */
  function drawFrostRune(r) {
    const t = game.time;
    const bob = Math.sin(t * 1.8 + r.seed) * 3.5;
    const size = r.size;

    ctx.save();
    ctx.translate(r.x, r.y + bob);

    // 冰蓝光晕
    const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 3.2);
    halo.addColorStop(0, 'rgba(150, 225, 255, 0.42)');
    halo.addColorStop(0.55, 'rgba(110, 195, 255, 0.14)');
    halo.addColorStop(1, 'rgba(90, 170, 255, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, size * 3.2, 0, TAU);
    ctx.fill();

    ctx.rotate(t * 0.8 + r.seed);
    ctx.strokeStyle = r.stroke;
    ctx.shadowColor = r.solid;
    ctx.shadowBlur = 14;
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';

    for (let i = 0; i < 6; i++) {
      ctx.save();
      ctx.rotate(i * Math.PI / 3);

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -size);
      ctx.moveTo(0, -size * 0.58);
      ctx.lineTo(-size * 0.24, -size * 0.78);
      ctx.moveTo(0, -size * 0.58);
      ctx.lineTo(size * 0.24, -size * 0.78);
      ctx.stroke();

      ctx.restore();
    }

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.2, 0, TAU);
    ctx.fill();

    ctx.restore();
  }

  /* ---------- 魔法荆棘 ---------- */
  function drawThorn(th) {
    const t = game.time;
    const pulse = 0.5 + 0.5 * Math.sin(t * 2 + th.seed);

    ctx.save();
    ctx.translate(th.x, th.y);

    const aura = ctx.createRadialGradient(0, 0, 2, 0, 0, 28);
    aura.addColorStop(0, 'rgba(190, 90, 255, ' + (0.22 + 0.12 * pulse) + ')');
    aura.addColorStop(1, 'rgba(120, 40, 200, 0)');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, 0, 28, 0, TAU);
    ctx.fill();

    ctx.rotate(th.seed + t * 0.3);

    // 尖刺
    ctx.fillStyle = '#5b2a86';
    ctx.strokeStyle = 'rgba(205, 140, 255, 0.75)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      ctx.rotate(TAU / 8);
      ctx.beginPath();
      ctx.moveTo(-3.5, 6);
      ctx.lineTo(0, 18 + pulse * 2);
      ctx.lineTo(3.5, 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // 荆棘核心
    ctx.beginPath();
    ctx.arc(0, 0, 6.5, 0, TAU);
    ctx.fillStyle = '#2d1145';
    ctx.fill();
    ctx.strokeStyle = 'rgba(190, 120, 255, 0.85)';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    ctx.restore();
  }

  /* ---------- 石像鬼 ---------- */
  function drawWing(side, lift) {
    ctx.save();
    ctx.scale(side, 1);

    const topY = -10 - lift;

    // 翼膜
    ctx.beginPath();
    ctx.moveTo(8, -4);
    ctx.bezierCurveTo(19, topY - 10, 32, topY - 2, 36, 5 - lift * 0.4);
    ctx.bezierCurveTo(30, 1 - lift * 0.2, 25, 7, 18, 13);
    ctx.quadraticCurveTo(12, 7, 8, -4);
    ctx.closePath();
    const wingG = ctx.createLinearGradient(8, topY, 32, 13);
    wingG.addColorStop(0, 'rgba(96, 104, 128, 0.96)');
    wingG.addColorStop(0.5, 'rgba(58, 64, 84, 0.96)');
    wingG.addColorStop(1, 'rgba(30, 34, 48, 0.96)');
    ctx.fillStyle = wingG;
    ctx.fill();
    ctx.strokeStyle = 'rgba(18, 20, 30, 0.9)';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // 翼骨
    ctx.strokeStyle = 'rgba(24, 27, 38, 0.8)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(9, -3);
    ctx.quadraticCurveTo(19, topY - 4, 34, 2 - lift * 0.3);
    ctx.moveTo(9, -3);
    ctx.lineTo(21, 8);
    ctx.moveTo(9, -3);
    ctx.quadraticCurveTo(13, 6, 17, 12);
    ctx.stroke();

    // 翼尖小爪
    ctx.fillStyle = '#4e5466';
    ctx.beginPath();
    ctx.moveTo(34, 2 - lift * 0.3);
    ctx.lineTo(40, -4 - lift * 0.4);
    ctx.lineTo(36, 5 - lift * 0.25);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  function drawGargoyle(m) {
    const t = game.time;
    const bob = Math.sin(t * 2.4 + m.phase) * 3;

    const boost = m.flapTimer > 0 ? Math.min(1, m.flapTimer / 0.35) : 0;
    const flap = Math.sin(t * (7 + 18 * boost) + m.phase);
    const lift = flap * (5 + 11 * boost);

    ctx.save();
    ctx.translate(m.x, m.y + bob);

    // 投影
    ctx.fillStyle = 'rgba(0, 0, 0, 0.34)';
    ctx.beginPath();
    ctx.ellipse(0, 28 - bob, 17, 5, 0, 0, TAU);
    ctx.fill();

    // 尾巴
    ctx.strokeStyle = '#2b2f3a';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-1, 12);
    ctx.quadraticCurveTo(-15, 16, -20, 7);
    ctx.stroke();
    ctx.fillStyle = '#5a6070';
    ctx.beginPath();
    ctx.moveTo(-20, 7);
    ctx.lineTo(-28, 3);
    ctx.lineTo(-20, -1);
    ctx.closePath();
    ctx.fill();

    drawWing(-1, lift);
    drawWing(1, lift);

    // 躯干
    const body = ctx.createLinearGradient(-12, -22, 12, 18);
    body.addColorStop(0, '#7d8394');
    body.addColorStop(0.45, '#545a6a');
    body.addColorStop(1, '#292c37');
    ctx.fillStyle = body;
    ctx.strokeStyle = '#161821';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-11, 13);
    ctx.quadraticCurveTo(-18, 2, -15, -7);
    ctx.quadraticCurveTo(-12, -16, 0, -18);
    ctx.quadraticCurveTo(12, -16, 15, -7);
    ctx.quadraticCurveTo(18, 2, 11, 13);
    ctx.quadraticCurveTo(0, 18, -11, 13);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 胸甲石纹
    ctx.strokeStyle = 'rgba(22, 24, 33, 0.7)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-9, -4);
    ctx.quadraticCurveTo(-4, -8, 0, -6);
    ctx.quadraticCurveTo(4, -8, 9, -4);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-8, 2);
    ctx.quadraticCurveTo(0, 6, 8, 2);
    ctx.stroke();

    // 腹部裂纹
    ctx.strokeStyle = 'rgba(14, 16, 24, 0.8)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(-4, 5);
    ctx.lineTo(-1, 8);
    ctx.lineTo(-3, 11);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(6, 9);
    ctx.lineTo(3, 12);
    ctx.stroke();

    // 手臂
    ctx.strokeStyle = '#3d4251';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-12, 0);
    ctx.quadraticCurveTo(-17, 7, -16, 13);
    ctx.moveTo(12, 0);
    ctx.quadraticCurveTo(17, 7, 16, 13);
    ctx.stroke();

    // 利爪
    ctx.strokeStyle = '#c7cdda';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-16, 13);
    ctx.lineTo(-19, 18);
    ctx.moveTo(-14, 14);
    ctx.lineTo(-15, 19);
    ctx.moveTo(16, 13);
    ctx.lineTo(19, 18);
    ctx.moveTo(14, 14);
    ctx.lineTo(15, 19);
    ctx.stroke();

    // 头部
    const headG = ctx.createLinearGradient(-9, -30, 9, -10);
    headG.addColorStop(0, '#868c9c');
    headG.addColorStop(1, '#414654');
    ctx.fillStyle = headG;
    ctx.strokeStyle = '#171a23';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-8, -13);
    ctx.quadraticCurveTo(-9, -23, 0, -24);
    ctx.quadraticCurveTo(9, -23, 8, -13);
    ctx.quadraticCurveTo(4, -9, 0, -9);
    ctx.quadraticCurveTo(-4, -9, -8, -13);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 眉骨
    ctx.strokeStyle = 'rgba(20, 22, 30, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-7, -19);
    ctx.lineTo(-2, -17.5);
    ctx.moveTo(7, -19);
    ctx.lineTo(2, -17.5);
    ctx.stroke();

    // 恶魔角
    ctx.fillStyle = '#3f4452';
    ctx.strokeStyle = '#15171f';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-7, -22);
    ctx.quadraticCurveTo(-14, -27, -13, -34);
    ctx.quadraticCurveTo(-9, -29, -4, -24);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(7, -22);
    ctx.quadraticCurveTo(14, -27, 13, -34);
    ctx.quadraticCurveTo(9, -29, 4, -24);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 獠牙
    ctx.fillStyle = '#d6dae4';
    ctx.beginPath();
    ctx.moveTo(-3.4, -12);
    ctx.lineTo(-2.4, -8.5);
    ctx.lineTo(-1.4, -12);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(3.4, -12);
    ctx.lineTo(2.4, -8.5);
    ctx.lineTo(1.4, -12);
    ctx.closePath();
    ctx.fill();

    // 红眼
    const eyePulse = 0.7 + 0.3 * Math.sin(t * 6 + m.phase);
    ctx.shadowColor = 'rgba(255, 50, 60, 0.95)';
    ctx.shadowBlur = 16 * eyePulse;
    ctx.fillStyle = 'rgb(255, ' + Math.round(64 + 70 * eyePulse) + ', 74)';
    ctx.beginPath();
    ctx.ellipse(-4.2, -16.6, 2.5, 1.9, -0.2, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(4.2, -16.6, 2.5, 1.9, 0.2, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = 'rgba(255, 232, 224, 0.9)';
    ctx.beginPath();
    ctx.arc(-4.6, -17.1, 0.8, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(3.8, -17.1, 0.8, 0, TAU);
    ctx.fill();

    // 苔藓
    ctx.fillStyle = 'rgba(86, 132, 86, 0.32)';
    ctx.beginPath();
    ctx.ellipse(-11, 4, 5, 3, 0.4, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(9, 10, 4, 2.4, -0.3, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(2, -22.5, 3.4, 1.6, 0.2, 0, TAU);
    ctx.fill();

    // 脚爪
    ctx.fillStyle = '#2a2d35';
    ctx.strokeStyle = 'rgba(198, 204, 216, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(-7, 15, 4.4, 2.6, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(7, 15, 4.4, 2.6, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  /* ---------- 暗影幽魂（缓慢追踪） ---------- */
  function drawDemon(d) {
    const t = game.time;
    const bob = Math.sin(t * 1.6 + d.phase) * 4;
    const swayA = Math.sin(t * 2.6) * 4;
    const swayB = Math.cos(t * 3.1) * 4;

    ctx.save();
    ctx.translate(d.x, d.y + bob);

    // 冷白气场
    const aura = ctx.createRadialGradient(0, -2, 4, 0, -2, 46);
    aura.addColorStop(0, 'rgba(200, 240, 255, 0.22)');
    aura.addColorStop(0.5, 'rgba(150, 210, 240, 0.10)');
    aura.addColorStop(1, 'rgba(120, 190, 230, 0)');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, -2, 46, 0, TAU);
    ctx.fill();

    // 幽灵轮廓（主形与残影共用）
    function ghostPath() {
      ctx.beginPath();
      ctx.moveTo(0, -21);
      ctx.bezierCurveTo(9, -21, 12, -14, 11, -6);
      ctx.quadraticCurveTo(13, 2, 12, 8);
      ctx.lineTo(11, 12 + swayB * 0.4);
      ctx.quadraticCurveTo(8, 9, 6, 15 - swayA * 0.3);
      ctx.quadraticCurveTo(3, 20, 0, 14 + swayB * 0.3);
      ctx.quadraticCurveTo(-3, 20, -6, 15 + swayA * 0.3);
      ctx.quadraticCurveTo(-8, 9, -11, 12 - swayB * 0.4);
      ctx.lineTo(-12, 8);
      ctx.quadraticCurveTo(-13, 2, -11, -6);
      ctx.bezierCurveTo(-12, -14, -9, -21, 0, -21);
      ctx.closePath();
    }

    // 向上飘散的残影
    for (let i = 3; i >= 1; i--) {
      ctx.save();
      ctx.globalAlpha = 0.17 - i * 0.035;
      ctx.translate(Math.sin(t * 2 + i) * 3, -i * 5.5);
      const k = 1 - i * 0.05;
      ctx.scale(k, k);
      ghostPath();
      ctx.fillStyle = 'rgba(214, 242, 255, 0.7)';
      ctx.fill();
      ctx.restore();
    }

    // 主体
    ghostPath();
    const bodyG = ctx.createLinearGradient(0, -22, 0, 18);
    bodyG.addColorStop(0, 'rgba(238, 252, 255, 0.68)');
    bodyG.addColorStop(0.45, 'rgba(198, 232, 250, 0.36)');
    bodyG.addColorStop(1, 'rgba(150, 200, 232, 0.03)');
    ctx.fillStyle = bodyG;
    ctx.fill();
    ctx.strokeStyle = 'rgba(224, 248, 255, 0.42)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // 体内幽光
    const inner = ctx.createRadialGradient(0, -6, 0, 0, -6, 18);
    inner.addColorStop(0, 'rgba(190, 240, 255, 0.16)');
    inner.addColorStop(1, 'rgba(150, 210, 255, 0)');
    ctx.fillStyle = inner;
    ctx.beginPath();
    ctx.arc(0, -6, 18, 0, TAU);
    ctx.fill();

    // 空眼眶
    ctx.fillStyle = 'rgba(16, 30, 46, 0.85)';
    ctx.beginPath();
    ctx.ellipse(-3.6, -11, 2.4, 3.2, -0.15, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(3.6, -11, 2.4, 3.2, 0.15, 0, TAU);
    ctx.fill();

    const eyeGlow = 0.5 + 0.5 * Math.sin(t * 3.4 + d.phase);
    ctx.fillStyle = 'rgba(198, 242, 255, ' + (0.55 + 0.35 * eyeGlow).toFixed(2) + ')';
    ctx.shadowColor = 'rgba(160, 230, 255, 0.9)';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(-3.6, -10.6, 0.9, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(3.6, -10.6, 0.9, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;

    // 微张的嘴
    ctx.fillStyle = 'rgba(20, 36, 52, 0.55)';
    ctx.beginPath();
    ctx.ellipse(0, -4.4, 1.5, 2.1, 0, 0, TAU);
    ctx.fill();

    // 飘动的手臂
    ctx.strokeStyle = 'rgba(214, 244, 255, 0.46)';
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-10, -4);
    ctx.quadraticCurveTo(-16, 2, -16, 9 + swayA * 0.5);
    ctx.moveTo(10, -4);
    ctx.quadraticCurveTo(16, 2, 16, 9 + swayB * 0.5);
    ctx.stroke();

    // 指尖
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = 'rgba(226, 248, 255, 0.4)';
    ctx.beginPath();
    ctx.moveTo(-16, 9 + swayA * 0.5);
    ctx.lineTo(-18.5, 13 + swayA * 0.4);
    ctx.moveTo(-16, 9 + swayA * 0.5);
    ctx.lineTo(-14.5, 13.5);
    ctx.moveTo(16, 9 + swayB * 0.5);
    ctx.lineTo(18.5, 13 + swayB * 0.4);
    ctx.moveTo(16, 9 + swayB * 0.5);
    ctx.lineTo(14.5, 13.5);
    ctx.stroke();

    // 尾摆飘散的光点
    for (let i = 0; i < 4; i++) {
      const k = (t * 0.6 + i * 0.25 + d.phase * 0.1) % 1;
      const px = Math.sin(t * 1.6 + i * 1.7) * 9;
      const py = 14 - k * 26;
      ctx.fillStyle = 'rgba(214, 246, 255, ' + ((1 - k) * 0.5).toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(px, py, 1.2, 0, TAU);
      ctx.fill();
    }

    ctx.restore();
  }

  /* ---------- 主角 ---------- */
  function drawCloak(wave, sway) {
    // 外袍
    const cg = ctx.createLinearGradient(-16, -14, 14, 24);
    cg.addColorStop(0, '#42549f');
    cg.addColorStop(0.32, '#28356f');
    cg.addColorStop(0.72, '#182050');
    cg.addColorStop(1, '#0c1130');

    ctx.beginPath();
    ctx.moveTo(-9, -9);
    ctx.quadraticCurveTo(-14, 2, -16 + sway * 0.35, 20);
    ctx.lineTo(-10, 23 + wave * 0.35);
    ctx.lineTo(-5 + sway * 0.2, 19.5);
    ctx.lineTo(0, 24 - wave * 0.35);
    ctx.lineTo(6 + sway * 0.2, 19.5);
    ctx.lineTo(11, 23 + wave * 0.25);
    ctx.quadraticCurveTo(15 + sway * 0.35, 18, 15 + sway * 0.3, 11);
    ctx.quadraticCurveTo(13, 2, 9, -9);
    ctx.quadraticCurveTo(0, -15, -9, -9);
    ctx.closePath();
    ctx.fillStyle = cg;
    ctx.fill();
    ctx.strokeStyle = 'rgba(212, 178, 106, 0.42)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // 左肩受光面
    ctx.beginPath();
    ctx.moveTo(-7, -6);
    ctx.quadraticCurveTo(-10, 6, -11 + sway * 0.25, 18);
    ctx.quadraticCurveTo(-6, 19, -2, 16.5);
    ctx.quadraticCurveTo(-4, 6, -3, -6);
    ctx.closePath();
    ctx.fillStyle = 'rgba(126, 156, 255, 0.10)';
    ctx.fill();

    // 腰带与铜扣
    ctx.fillStyle = '#2a1d18';
    ctx.fillRect(-10, 3, 20, 4);
    ctx.fillStyle = '#c9a24a';
    ctx.fillRect(-2.2, 2.2, 5, 5.6);
    ctx.fillStyle = '#6f4a16';
    ctx.fillRect(-0.4, 4, 1.8, 2.2);

    // 胸前搭扣
    ctx.fillStyle = '#d9b25c';
    ctx.beginPath();
    ctx.moveTo(0, -8.4);
    ctx.lineTo(2.8, -5.8);
    ctx.lineTo(0, -3.2);
    ctx.lineTo(-2.8, -5.8);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(90, 60, 20, 0.6)';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // 衣褶
    ctx.strokeStyle = 'rgba(8, 12, 34, 0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-5, -3);
    ctx.quadraticCurveTo(-6, 8, -4.5, 18.5);
    ctx.moveTo(4.5, -3);
    ctx.quadraticCurveTo(5.5, 8, 4.5, 18.5);
    ctx.stroke();

    // 靴子
    ctx.fillStyle = '#131a33';
    ctx.beginPath();
    ctx.ellipse(-6.4, 22.6, 4, 2.4, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(6.4, 22.6, 4, 2.4, 0, 0, TAU);
    ctx.fill();
  }

  /* ---------- 幽蓝提灯 ---------- */
  function drawLantern() {
    const t = game.time;
    const flick = 0.78 + 0.22 * Math.sin(t * 9.1) * Math.sin(t * 4.3 + 1.7);
    const swing = Math.sin(t * 2.1) * 0.06;
    const lum = game.lanternOn ? 1 : 0.38;

    ctx.save();
    ctx.translate(15.2, 4.2);

    // 地面光斑
    ctx.save();
    ctx.translate(2, 32);
    ctx.scale(1, 0.28);
    const pool = ctx.createRadialGradient(0, 0, 2, 0, 0, 46);
    pool.addColorStop(0, 'rgba(96, 220, 255, ' + (0.20 * flick * lum).toFixed(3) + ')');
    pool.addColorStop(0.55, 'rgba(60, 170, 255, ' + (0.09 * flick * lum).toFixed(3) + ')');
    pool.addColorStop(1, 'rgba(40, 140, 255, 0)');
    ctx.fillStyle = pool;
    ctx.beginPath();
    ctx.arc(0, 0, 46, 0, TAU);
    ctx.fill();
    ctx.restore();

    ctx.rotate(swing);

    // 提梁
    ctx.strokeStyle = '#8f7c4c';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(0, 5.4, 5.4, Math.PI, TAU);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 226, 150, 0.35)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(0, 5.4, 4.4, Math.PI, TAU);
    ctx.stroke();

    // 灯焰光晕
    const gy = 21;
    const gr = 24 + flick * 8;
    const halo = ctx.createRadialGradient(0, gy, 0, 0, gy, gr);
    halo.addColorStop(0, 'rgba(170, 245, 255, ' + (0.30 * flick * lum).toFixed(3) + ')');
    halo.addColorStop(0.45, 'rgba(80, 200, 255, ' + (0.14 * flick * lum).toFixed(3) + ')');
    halo.addColorStop(1, 'rgba(60, 170, 255, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, gy, gr, 0, TAU);
    ctx.fill();

    // 顶盖
    ctx.fillStyle = '#3a3426';
    ctx.beginPath();
    ctx.moveTo(-8.6, 12.4);
    ctx.lineTo(-5.4, 8.6);
    ctx.lineTo(5.4, 8.6);
    ctx.lineTo(8.6, 12.4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(210, 178, 108, 0.75)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 玻璃灯罩
    ctx.beginPath();
    ctx.moveTo(-6.4, 12.4);
    ctx.lineTo(6.4, 12.4);
    ctx.lineTo(6.4, 26);
    ctx.quadraticCurveTo(6.4, 30.4, 0, 30.4);
    ctx.quadraticCurveTo(-6.4, 30.4, -6.4, 26);
    ctx.closePath();
    const glass = ctx.createLinearGradient(0, 12, 0, 30);
    glass.addColorStop(0, 'rgba(150, 235, 255, ' + (0.22 * flick * lum).toFixed(3) + ')');
    glass.addColorStop(1, 'rgba(60, 150, 220, ' + (0.10 * flick * lum).toFixed(3) + ')');
    ctx.fillStyle = glass;
    ctx.fill();
    ctx.strokeStyle = 'rgba(150, 220, 250, 0.5)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // 金属护条
    ctx.strokeStyle = 'rgba(70, 62, 42, 0.95)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-4.6, 12.8);
    ctx.lineTo(-4.6, 28.4);
    ctx.moveTo(4.6, 12.8);
    ctx.lineTo(4.6, 28.4);
    ctx.stroke();

    // 幽蓝火焰
    const fh = 6.4 + flick * 3.2 * lum;
    ctx.shadowColor = 'rgba(120, 235, 255, 0.95)';
    ctx.shadowBlur = (14 + flick * 10) * lum;
    ctx.fillStyle = 'rgba(150, 240, 255, ' + (0.95 * lum).toFixed(3) + ')';
    ctx.beginPath();
    ctx.moveTo(-3.1, 26.4);
    ctx.quadraticCurveTo(-3.4, 22, Math.sin(t * 7) * 0.8, 26.4 - fh);
    ctx.quadraticCurveTo(3.4, 22, 3.1, 26.4);
    ctx.quadraticCurveTo(0, 29.2, -3.1, 26.4);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(246, 255, 255, 0.98)';
    ctx.beginPath();
    ctx.ellipse(0, 24.8, 1.5, 2.6 + flick, 0, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;

    // 底座
    ctx.fillStyle = '#332d20';
    ctx.beginPath();
    ctx.moveTo(-8.4, 30.4);
    ctx.lineTo(8.4, 30.4);
    ctx.lineTo(6.8, 34);
    ctx.lineTo(-6.8, 34);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(210, 178, 108, 0.7)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 玻璃高光
    ctx.fillStyle = 'rgba(255, 255, 255, ' + (0.28 * flick).toFixed(3) + ')';
    ctx.beginPath();
    ctx.ellipse(-3.4, 18, 1.1, 4.2, 0.12, 0, TAU);
    ctx.fill();

    ctx.restore();
  }

  function drawHatAndHead(sway, t) {
    // 兜帽
    ctx.fillStyle = '#0e1530';
    ctx.beginPath();
    ctx.moveTo(-8.6, -5.5);
    ctx.quadraticCurveTo(-9.6, -17, 0, -20.4);
    ctx.quadraticCurveTo(9.6, -17, 8.6, -5.5);
    ctx.quadraticCurveTo(4, -1.6, 0, -1.6);
    ctx.quadraticCurveTo(-4, -1.6, -8.6, -5.5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(120, 150, 255, 0.22)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 面部
    ctx.fillStyle = '#e8c39a';
    ctx.beginPath();
    ctx.ellipse(0, -11.6, 5.4, 6.2, 0, 0, TAU);
    ctx.fill();

    // 鬓发
    ctx.fillStyle = '#2b1d16';
    ctx.beginPath();
    ctx.ellipse(-4.6, -14.4, 2, 3.4, 0.3, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(4.6, -14.4, 2, 3.4, -0.3, 0, TAU);
    ctx.fill();

    // 帽檐投影
    ctx.fillStyle = 'rgba(52, 34, 26, 0.30)';
    ctx.beginPath();
    ctx.ellipse(0, -14.4, 5.2, 3.2, 0, 0, TAU);
    ctx.fill();

    // 眼睛
    const eye = 0.75 + 0.25 * Math.sin(t * 3);
    ctx.fillStyle = 'rgba(172, 244, 255, ' + eye.toFixed(2) + ')';
    ctx.shadowColor = 'rgba(120, 220, 255, 0.9)';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.ellipse(-2.2, -11.6, 1.4, 1.6, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(2.2, -11.6, 1.4, 1.6, 0, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;

    // 嘴
    ctx.strokeStyle = 'rgba(120, 70, 60, 0.55)';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(-1.4, -8.4);
    ctx.quadraticCurveTo(0, -7.6, 1.4, -8.4);
    ctx.stroke();

    // 帽檐
    const brim = ctx.createLinearGradient(0, -21, 0, -16);
    brim.addColorStop(0, '#3a4b98');
    brim.addColorStop(1, '#1b234c');
    ctx.fillStyle = brim;
    ctx.beginPath();
    ctx.ellipse(0, -18.6, 12.8, 4.4, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(134, 164, 255, 0.45)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 帽身（微弯帽尖）
    const tip = sway * 0.55;
    const hat = ctx.createLinearGradient(-9, -20, 10, -44);
    hat.addColorStop(0, '#465ab8');
    hat.addColorStop(0.55, '#2a3672');
    hat.addColorStop(1, '#161d44');
    ctx.beginPath();
    ctx.moveTo(-8.6, -19.4);
    ctx.quadraticCurveTo(-6.6, -30, tip - 2, -42);
    ctx.quadraticCurveTo(tip + 1, -45, tip + 3, -41.5);
    ctx.quadraticCurveTo(5.4, -30, 8.6, -19.4);
    ctx.closePath();
    ctx.fillStyle = hat;
    ctx.fill();
    ctx.strokeStyle = 'rgba(142, 172, 255, 0.5)';
    ctx.lineWidth = 1.1;
    ctx.stroke();

    // 帽带
    ctx.strokeStyle = 'rgba(210, 172, 92, 0.9)';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-8.2, -21.4);
    ctx.quadraticCurveTo(0, -23.2, 8.2, -21.4);
    ctx.stroke();

    // 帽尖星饰
    const twinkle = 0.6 + 0.4 * Math.sin(t * 3.2);
    ctx.save();
    ctx.translate(tip + 2.6, -45.5);
    ctx.rotate(t * 0.5);
    ctx.fillStyle = 'rgba(255, 226, 140, ' + (0.75 + 0.25 * twinkle).toFixed(2) + ')';
    ctx.shadowColor = 'rgba(255, 210, 110, 0.95)';
    ctx.shadowBlur = 6 + twinkle * 10;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      const rr = i % 2 ? 1.2 : 3.2;
      const px = Math.cos(a) * rr;
      const py = Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  /* ---------- 魔王幽魂 ---------- */
  function drawBoss(b) {
    const t = game.time;
    const bob = Math.sin(t * 1.4 + b.phase) * 6;
    const raged = b.enraged;
    const frozen = b.frozen > 0;

    // 黑红粒子拖尾
    b.trail.forEach(function (p) {
      const k = 1 - p.t / 0.85;
      const r = p.r * (1 + p.t * 1.4);
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      g.addColorStop(0, 'rgba(150, 18, 28, ' + (0.45 * k).toFixed(3) + ')');
      g.addColorStop(0.5, 'rgba(80, 0, 14, ' + (0.25 * k).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(20, 0, 4, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, TAU);
      ctx.fill();
    });

    ctx.save();
    ctx.translate(b.x, b.y + bob);

    // 压迫气场
    const aura = ctx.createRadialGradient(0, 0, 8, 0, 0, 112);
    aura.addColorStop(0, frozen
      ? 'rgba(140, 220, 255, 0.25)'
      : (raged ? 'rgba(220, 30, 30, 0.34)' : 'rgba(160, 16, 30, 0.22)'));
    aura.addColorStop(0.55, frozen ? 'rgba(90, 160, 220, 0.10)' : 'rgba(90, 0, 16, 0.12)');
    aura.addColorStop(1, 'rgba(40, 0, 8, 0)');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, 0, 112, 0, TAU);
    ctx.fill();

    // 巨大幽魂身形
    ctx.save();
    ctx.scale(2.9, 2.9);
    const bodyG = ctx.createLinearGradient(0, -24, 0, 20);
    bodyG.addColorStop(0, 'rgba(58, 40, 54, 0.94)');
    bodyG.addColorStop(0.45, 'rgba(34, 12, 20, 0.9)');
    bodyG.addColorStop(1, 'rgba(12, 2, 6, 0.2)');
    ctx.fillStyle = bodyG;
    ctx.strokeStyle = frozen ? 'rgba(170, 230, 255, 0.6)' : 'rgba(190, 40, 46, 0.5)';
    ctx.lineWidth = 1.2;

    ctx.beginPath();
    ctx.moveTo(0, -21);
    ctx.bezierCurveTo(9, -21, 12, -14, 11, -6);
    ctx.quadraticCurveTo(13, 2, 12, 8);
    ctx.lineTo(11, 13 + Math.sin(t * 2.2) * 2);
    ctx.quadraticCurveTo(8, 9, 6, 16 - Math.sin(t * 2.7) * 2);
    ctx.quadraticCurveTo(3, 21, 0, 14 + Math.sin(t * 3.1) * 2);
    ctx.quadraticCurveTo(-3, 21, -6, 16 + Math.sin(t * 2.4) * 2);
    ctx.quadraticCurveTo(-8, 9, -11, 13 - Math.sin(t * 2.9) * 2);
    ctx.lineTo(-12, 8);
    ctx.quadraticCurveTo(-13, 2, -11, -6);
    ctx.bezierCurveTo(-12, -14, -9, -21, 0, -21);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 尖冠
    ctx.fillStyle = 'rgba(18, 6, 10, 0.95)';
    ctx.strokeStyle = 'rgba(200, 46, 52, 0.55)';
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 4.5 - 3, -19);
      ctx.lineTo(i * 5.2, -27 - Math.abs(i) * 1.2);
      ctx.lineTo(i * 4.5 + 3, -19);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // 兜帽阴影
    ctx.fillStyle = 'rgba(3, 0, 2, 0.96)';
    ctx.beginPath();
    ctx.ellipse(0, -10, 8.5, 7.5, 0, 0, TAU);
    ctx.fill();
    ctx.restore();

    // 红眼
    const glow = 0.65 + 0.35 * Math.sin(t * 4.5 + b.phase);
    ctx.shadowColor = 'rgba(255, 40, 50, 0.95)';
    ctx.shadowBlur = 26 * glow;
    ctx.fillStyle = frozen ? 'rgba(190, 240, 255, 0.95)' : 'rgb(255, 58, 62)';
    ctx.beginPath();
    ctx.ellipse(-11, -38, 5.4, 3.8, 0.12, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(11, -38, 5.4, 3.8, -0.12, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;

    // 利爪
    ctx.strokeStyle = frozen ? 'rgba(200, 245, 255, 0.7)' : 'rgba(230, 90, 90, 0.55)';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-30, -6);
    ctx.quadraticCurveTo(-48, 10, -48, 28 + Math.sin(t * 2.1) * 4);
    ctx.moveTo(30, -6);
    ctx.quadraticCurveTo(48, 10, 48, 28 + Math.cos(t * 2.3) * 4);
    ctx.stroke();

    if (frozen) {
      const ice = ctx.createRadialGradient(0, 0, 6, 0, 0, 70);
      ice.addColorStop(0, 'rgba(200, 245, 255, 0.18)');
      ice.addColorStop(1, 'rgba(130, 210, 255, 0)');
      ctx.fillStyle = ice;
      ctx.beginPath();
      ctx.arc(0, 0, 70, 0, TAU);
      ctx.fill();
    }

    ctx.restore();
  }

  /* ---------- 冰霜新星 ---------- */
  function drawNova() {
    const n = game.nova;
    const k = clamp(n.t / 0.65, 0, 1);
    const r = 24 + (CFG.frostRadius - 24) * (1 - Math.pow(1 - k, 2));
    const alpha = 1 - k;

    ctx.save();
    ctx.translate(n.x, n.y);

    const ring = ctx.createRadialGradient(0, 0, r * 0.72, 0, 0, r);
    ring.addColorStop(0, 'rgba(150, 230, 255, 0)');
    ring.addColorStop(0.72, 'rgba(160, 235, 255, ' + (0.5 * alpha).toFixed(3) + ')');
    ring.addColorStop(1, 'rgba(110, 200, 255, 0)');
    ctx.fillStyle = ring;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fill();

    ctx.strokeStyle = 'rgba(210, 248, 255, ' + (0.85 * alpha).toFixed(3) + ')';
    ctx.lineWidth = 2.4;
    ctx.shadowColor = 'rgba(140, 225, 255, 0.9)';
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.stroke();

    for (let i = 0; i < 14; i++) {
      const ang = i / 14 * TAU + k * 0.8;
      const rr = r * (0.75 + Math.sin(i * 2.3) * 0.12);
      ctx.fillStyle = 'rgba(235, 252, 255, ' + (alpha * 0.85).toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(Math.cos(ang) * rr, Math.sin(ang) * rr, 2.4, 0, TAU);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    ctx.restore();
  }

  function drawMage() {
    const p = game.player;
    const t = game.time;
    const dashing = p.dashTime > 0;
    const moving = p.moving;

    let alpha = 1;
    if (dashing) alpha = 0.55;
    else if (p.hurtTimer > 0) alpha = Math.floor(t * 18) % 2 === 0 ? 0.3 : 1;

    const bob = moving ? Math.sin(t * 11) * 1.6 : Math.sin(t * 2.2) * 0.8;
    const wave = moving ? Math.sin(t * 9) * 3.2 : Math.sin(t * 2.4) * 1.1;
    const sway = moving ? Math.sin(t * 5) * 5 : Math.sin(t * 1.6) * 1.5;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(p.x, p.y);

    // 地面投影
    ctx.fillStyle = 'rgba(0, 0, 0, 0.36)';
    ctx.beginPath();
    ctx.ellipse(0, 25, 15, 5, 0, 0, TAU);
    ctx.fill();

    // 提灯光晕（随开关动态变化）
    const lit = game.lanternOn;
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.6);
    const orbX = p.facing > 0 ? 17 : -17;
    const orbY = 18;
    const haloR = (lit ? 38 : 20) + pulse * (lit ? 12 : 5);
    const halo = ctx.createRadialGradient(orbX, orbY, 0, orbX, orbY, haloR);
    halo.addColorStop(0, 'rgba(140, 240, 255, ' + (lit ? (0.15 + 0.08 * pulse) : 0.05).toFixed(3) + ')');
    halo.addColorStop(1, 'rgba(80, 200, 255, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(orbX, orbY, haloR, 0, TAU);
    ctx.fill();

    ctx.scale(p.facing, 1);
    ctx.translate(0, bob);

    drawCloak(wave, sway);
    drawHatAndHead(sway, t);
    drawLantern();

    // 提灯手臂
    ctx.strokeStyle = '#243066';
    ctx.lineWidth = 4.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(4, 1);
    ctx.quadraticCurveTo(9, 5.5, 13.6, 6);
    ctx.stroke();

    // 袖口金边
    ctx.strokeStyle = 'rgba(214, 178, 104, 0.5)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(3.4, 0.4);
    ctx.quadraticCurveTo(9, 5.6, 13.8, 6.4);
    ctx.stroke();

    // 手
    ctx.fillStyle = '#e8c39a';
    ctx.beginPath();
    ctx.arc(14.6, 6.4, 2.9, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.beginPath();
    ctx.arc(13.7, 5.6, 1.2, 0, TAU);
    ctx.fill();

    ctx.restore();
  }

  /* ---------- 残影 ---------- */
  function drawTrail() {
    const t = game.time;

    game.player.trail.forEach(function (tr) {
      const age = (t - tr.t) / 0.42;
      if (age < 0 || age > 1) return;

      ctx.save();
      ctx.globalAlpha = (1 - age) * 0.3;
      ctx.translate(tr.x, tr.y);
      ctx.scale(tr.f, 1);

      ctx.fillStyle = '#3d4fa5';
      ctx.beginPath();
      ctx.moveTo(-9, -8);
      ctx.lineTo(-15, 21);
      ctx.quadraticCurveTo(0, 25, 15, 21);
      ctx.lineTo(9, -8);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(-9, -18);
      ctx.lineTo(tr.sway, -41);
      ctx.lineTo(9, -18);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    });
  }

  /* ---------- 迷雾 / 黑暗（Canvas 遮罩） ---------- */
  function drawFog() {
    const p = game.player;
    const t = game.time;
    const base = game.lanternOn ? game.fogOnR : game.fogOffR;
    const radius = base + Math.sin(t * 1.4) * 10;
    const dark = game.fogDark || 0.97;
    const finalLevel = game.level === 4;

    const grad = ctx.createRadialGradient(p.x, p.y, radius * 0.2, p.x, p.y, radius);
    grad.addColorStop(0, 'rgba(6, 3, 16, 0)');
    grad.addColorStop(0.5, 'rgba(6, 3, 16, ' + (dark * 0.3).toFixed(3) + ')');
    grad.addColorStop(0.78, 'rgba(5, 2, 12, ' + (dark * 0.84).toFixed(3) + ')');
    grad.addColorStop(1, 'rgba(3, 1, 6, ' + dark.toFixed(3) + ')');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // 最终关：暗红压迫
    if (finalLevel) {
      const red = ctx.createRadialGradient(p.x, p.y, radius * 0.45, p.x, p.y, radius * 2.2);
      red.addColorStop(0, 'rgba(90, 8, 16, 0)');
      red.addColorStop(1, 'rgba(62, 0, 10, 0.38)');
      ctx.fillStyle = red;
      ctx.fillRect(0, 0, W, H);
    }

    // 漂浮的雾团
    ctx.save();
    for (let i = 0; i < 5; i++) {
      const ang = t * 0.25 + i * 1.7;
      const dist = 150 + Math.sin(t * 0.8 + i) * 40;
      const x = p.x + Math.cos(ang) * dist;
      const y = p.y + Math.sin(ang) * dist * 0.7;
      const r = 90 + Math.sin(t + i) * 20;
      const fg = ctx.createRadialGradient(x, y, 0, x, y, r);
      fg.addColorStop(0, finalLevel ? 'rgba(140, 24, 30, 0.10)' : 'rgba(80, 50, 140, 0.10)');
      fg.addColorStop(1, finalLevel ? 'rgba(120, 16, 24, 0)' : 'rgba(80, 50, 140, 0)');
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  /* ---------- 章节横幅 ---------- */
  function drawBanner() {
    const b = game.banner;
    const alpha = Math.min(1, b.timer / 0.7);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '22px ' + SERIF;
    ctx.fillStyle = '#dccdff';
    ctx.shadowColor = 'rgba(140, 100, 255, 0.9)';
    ctx.shadowBlur = 18;
    ctx.fillText(b.text, W / 2, 168);

    ctx.shadowBlur = 0;
    ctx.font = '12px ' + SERIF;
    ctx.fillStyle = 'rgba(175, 155, 230, 0.85)';
    ctx.fillText('收集 ' + game.target + ' 枚符文', W / 2, 198);
    ctx.restore();
  }

  /* ========================= 音效（Web Audio 合成） ========================= */
  const audio = {
    ctx: null,
    master: null,
    sfx: null,
    ambient: null,
    noise: null,
    muted: false,
    ambientStarted: false
  };
  let hintTimer = 0;

  function initAudio() {
    if (audio.ctx) {
      if (audio.ctx.state === 'suspended') audio.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;

    const ac = new AC();
    audio.ctx = ac;

    audio.master = ac.createGain();
    audio.master.gain.value = 0.85;
    audio.master.connect(ac.destination);

    audio.sfx = ac.createGain();
    audio.sfx.gain.value = 0.7;
    audio.sfx.connect(audio.master);

    audio.ambient = ac.createGain();
    audio.ambient.gain.value = 0.85;
    audio.ambient.connect(audio.master);

    // 白噪声缓冲，供脚步 / 风 / 蝉鸣共用
    const len = Math.floor(ac.sampleRate * 2);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    audio.noise = buf;

    startAmbient();
    if (ac.state === 'suspended') ac.resume();
  }

  /* 风吹树叶的底噪 + 蝉鸣 */
  function startAmbient() {
    const ac = audio.ctx;
    if (!ac || audio.ambientStarted) return;
    audio.ambientStarted = true;

    // 风：低通噪声，音量缓慢起伏
    const wind = ac.createBufferSource();
    wind.buffer = audio.noise;
    wind.loop = true;

    const windFilter = ac.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.value = 520;
    windFilter.Q.value = 0.7;

    const windGain = ac.createGain();
    windGain.gain.value = 0.12;

    const windLfo = ac.createOscillator();
    windLfo.type = 'sine';
    windLfo.frequency.value = 0.12;
    const windLfoGain = ac.createGain();
    windLfoGain.gain.value = 0.055;
    windLfo.connect(windLfoGain);
    windLfoGain.connect(windGain.gain);

    wind.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(audio.ambient);
    wind.start();
    windLfo.start();

    // 树叶沙沙：高频噪声，轻轻摆动
    const leaf = ac.createBufferSource();
    leaf.buffer = audio.noise;
    leaf.loop = true;

    const leafFilter = ac.createBiquadFilter();
    leafFilter.type = 'highpass';
    leafFilter.frequency.value = 2600;

    const leafGain = ac.createGain();
    leafGain.gain.value = 0.022;

    const leafLfo = ac.createOscillator();
    leafLfo.type = 'sine';
    leafLfo.frequency.value = 0.19;
    const leafLfoGain = ac.createGain();
    leafLfoGain.gain.value = 0.018;
    leafLfo.connect(leafLfoGain);
    leafLfoGain.connect(leafGain.gain);

    leaf.connect(leafFilter);
    leafFilter.connect(leafGain);
    leafGain.connect(audio.ambient);
    leaf.start();
    leafLfo.start();

    scheduleCicada();
  }

  function scheduleCicada() {
    const delay = 2400 + Math.random() * 4600;
    setTimeout(function () {
      if (audio.ctx && !audio.muted && !document.hidden) playCicada();
      scheduleCicada();
    }, delay);
  }

  /* 蝉鸣：带通噪声的快速脉冲串 */
  function playCicada() {
    const ac = audio.ctx;
    if (!ac) return;

    const t0 = ac.currentTime + 0.03;
    const pulses = 5 + Math.floor(Math.random() * 4);
    const gap = 0.062 + Math.random() * 0.02;

    const src = ac.createBufferSource();
    src.buffer = audio.noise;
    src.loop = true;

    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 3800 + Math.random() * 1400;
    bp.Q.value = 11;

    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    for (let i = 0; i < pulses; i++) {
      const pt = t0 + i * gap;
      g.gain.setValueAtTime(0.0001, pt);
      g.gain.linearRampToValueAtTime(0.05, pt + 0.012);
      g.gain.linearRampToValueAtTime(0.0001, pt + gap * 0.8);
    }

    src.connect(bp);
    bp.connect(g);
    g.connect(audio.ambient);
    src.start(t0, Math.random() * 1.4, pulses * gap + 0.05);
  }

  /* 踩在石板上的脚步声 */
  function playFootstep(dash) {
    if (!audio.ctx || audio.muted) return;
    const ac = audio.ctx;
    const t0 = ac.currentTime;

    // 鞋底与石板的摩擦噪声
    const src = ac.createBufferSource();
    src.buffer = audio.noise;
    src.playbackRate.value = 0.85 + Math.random() * 0.35;

    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = (dash ? 520 : 380) + Math.random() * 260;
    bp.Q.value = 1.5;

    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1700;

    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(dash ? 0.13 : 0.17, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);

    src.connect(bp);
    bp.connect(lp);
    lp.connect(g);
    g.connect(audio.sfx);
    src.start(t0, Math.random() * 1.5, 0.16);

    // 落地的低频闷响
    const osc = ac.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(118 + Math.random() * 26, t0);
    osc.frequency.exponentialRampToValueAtTime(56, t0 + 0.09);

    const og = ac.createGain();
    og.gain.setValueAtTime(0.0001, t0);
    og.gain.exponentialRampToValueAtTime(0.055, t0 + 0.006);
    og.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.1);

    osc.connect(og);
    og.connect(audio.sfx);
    osc.start(t0);
    osc.stop(t0 + 0.12);
  }

  function flashHint(text) {
    ui.hint.textContent = text;
    clearTimeout(hintTimer);
    hintTimer = setTimeout(function () {
      if (game) ui.hint.textContent = levels[currentLevel].hint + ' · M 静音';
    }, 1600);
  }

  function toggleMute() {
    if (!audio.ctx) {
      initAudio();
      return;
    }
    audio.muted = !audio.muted;
    audio.master.gain.setTargetAtTime(audio.muted ? 0 : 0.85, audio.ctx.currentTime, 0.04);
    flashHint(audio.muted ? '声音已关闭 · 按 M 恢复' : '声音已开启 · 按 M 静音');
  }

  /* ========================= 输入 ========================= */
  // 用 KeyboardEvent.code 识别按键，避免输入法、大小写、键盘布局导致按键丢失
  function keyId(e) {
    switch (e.code) {
      case 'ArrowUp': return 'up';
      case 'ArrowDown': return 'down';
      case 'ArrowLeft': return 'left';
      case 'ArrowRight': return 'right';
      case 'Space': return 'space';
      case 'KeyR': return 'r';
      case 'KeyM': return 'm';
      case 'KeyF': return 'f';
      case 'KeyQ': return 'q';
      default: break;
    }
    // 兼容不支持 code 的环境
    const k = (e.key || '').toLowerCase();
    if (k === 'arrowup' || k === 'up') return 'up';
    if (k === 'arrowdown' || k === 'down') return 'down';
    if (k === 'arrowleft' || k === 'left') return 'left';
    if (k === 'arrowright' || k === 'right') return 'right';
    if (k === ' ' || k === 'space' || k === 'spacebar') return 'space';
    if (k === 'r') return 'r';
    if (k === 'm') return 'm';
    if (k === 'f') return 'f';
    if (k === 'q') return 'q';
    return null;
  }

  // 捕获阶段监听，焦点在按钮等元素上时也能第一时间收到按键
  window.addEventListener('keydown', function (e) {
    const id = keyId(e);

    // 封面页：空格 / 回车 / R 开始游戏
    if (game && game.state === 'title' && (id === 'space' || id === 'r' || e.code === 'Enter')) {
      e.preventDefault();
      initAudio();
      startGame();
      return;
    }

    // 静音切换
    if (id === 'm') {
      e.preventDefault();
      if (!e.repeat) toggleMute();
      return;
    }

    // 提灯开关
    if (id === 'f') {
      e.preventDefault();
      if (!e.repeat) toggleLantern();
      return;
    }

    // 冰霜新星
    if (id === 'q') {
      e.preventDefault();
      if (!e.repeat) castFrostNova();
      return;
    }

    if (!id) return;
    if (id !== 'r') e.preventDefault();

    if (id === 'space' && !e.repeat) dashBuffer = 0.18;
    if (id === 'r' && !e.repeat && game && game.state !== 'playing') startGame();

    kb.add(id);
  }, true);

  window.addEventListener('keyup', function (e) {
    const id = keyId(e);
    if (!id) return;
    if (id !== 'r') e.preventDefault();
    kb.delete(id);
  }, true);

  function clearKeys() {
    kb.clear();
    dashBuffer = 0;
  }

  window.addEventListener('blur', clearKeys);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) clearKeys();
  });

  ui.restartBtn.addEventListener('click', function () {
    ui.restartBtn.blur();          // 避免焦点留在按钮上，空格被按钮吃掉
    if (overlayAction) overlayAction();
  });

  ui.coverStart.addEventListener('click', function () {
    initAudio();
    startGame();
  });

  /* ========================= 主循环 ========================= */
  let lastTime = 0;

  function frame(ts) {
    if (!lastTime) lastTime = ts;
    const dt = Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;

    update(dt);
    render();

    requestAnimationFrame(frame);
  }

  startGame();
  showCover();
  requestAnimationFrame(frame);
})();
