// 数理格斗小游戏（已移除定级诊断，直接开战）
const canvas = wx.createCanvas();
const ctx = canvas.getContext('2d');

const systemInfo = wx.getSystemInfoSync();
const screenWidth = systemInfo.windowWidth;
const screenHeight = systemInfo.windowHeight;

// ---------- 全局状态 ----------
let state = 'ONBOARDING';
let playerName = '';
let playerAvatar = '⚔️';
const avatars = ['⚔️', '🛡️', '🔥', '💧', '🌪️', '⭐'];
let gradeIndex = 3;
const grades = ['小班', '中班', '大班', '一年级', '二年级', '三年级'];
let cachedLevel = null;
let challengeData = null;

// 对战
let difficulty = 1;
let p1Score = 0, p2Score = 0;
let p1Quota = 10, p2Quota = 10;
let p1Time = 300, p2Time = 300;
let currentTurn = 'P1';
let currentQ = '', currentAnswer = 0;
let combatAnswer = '';
let robotAnswer = null;
let feedbackText = '⚔️ 轮到你了';
let feedbackClass = 'info';
let battleLog = [];

// 结算
let title = '', titleColor = '', sp = 0;

// 排行榜
let leaderboard = [];

// 定时器
let timerInterval = null;
let aiTimer = null;

// 自定义键盘状态
let showKeyboard = false;
let keyboardTarget = '';     // 'combat'

// 年级选择菜单
let showGradePicker = false;

// 音效实例
let audioCtx = {};

// 分享参数
let shareQuery = '';

// ---------- 本地存储 ----------
function loadCachedLevel() {
  const cached = wx.getStorageSync('math_level_cache');
  if (cached) cachedLevel = cached;
}

function saveLeaderboard() {
  const entry = { name: playerName || '无名', score: p1Score, time: p1Time, difficulty };
  let lb = wx.getStorageSync('math_leaderboard') || [];
  lb.push(entry);
  lb.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    return b.time - a.time;
  });
  if (lb.length > 20) lb = lb.slice(0, 20);
  wx.setStorageSync('math_leaderboard', lb);
  leaderboard = lb;
}

// ---------- 音效与震动 ----------
function preloadSounds() {
  const sounds = {
    correct: 'sounds/correct.mp3',
    wrong: 'sounds/wrong.mp3',
    timeout: 'sounds/timeout.mp3',
    turn: 'sounds/turn.mp3',
    robot: 'sounds/robot.mp3',
    win: 'sounds/win.mp3'
  };
  for (const key in sounds) {
    try {
      const audio = wx.createInnerAudioContext();
      audio.src = sounds[key];
      audio.autoplay = false;
      audioCtx[key] = audio;
    } catch (e) {}
  }
}

function playSound(type) {
  try {
    const audio = audioCtx[type];
    if (audio) {
      audio.stop();
      audio.seek(0);
      audio.play();
    }
  } catch (e) {}
}

function vibrate() {
  wx.vibrateShort({
    type: 'light',
    fail: () => {}
  });
}

// ---------- 工具函数 ----------
function clearTimers() {
  if (timerInterval) clearInterval(timerInterval);
  if (aiTimer) clearTimeout(aiTimer);
}

function formatTime(seconds) {
  if (isNaN(seconds)) seconds = 0;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// ---------- 题目生成 ----------
function nextQuestion() {
  let maxNum = 30, minNum = 0;
  if (difficulty === 2) { maxNum = 50; minNum = 10; }
  else if (difficulty === 3) { maxNum = 99; minNum = 10; }
  const isAdd = Math.random() < 0.5;
  let a, b;
  if (isAdd) {
    a = Math.floor(Math.random() * (maxNum - minNum + 1) + minNum);
    b = Math.floor(Math.random() * (maxNum - minNum + 1) + minNum);
    currentAnswer = a + b;
    currentQ = `${a} + ${b}`;
  } else {
    a = Math.floor(Math.random() * (maxNum - minNum + 1) + minNum);
    b = Math.floor(Math.random() * (maxNum - minNum + 1) + minNum);
    if (a < b) [a, b] = [b, a];
    currentAnswer = a - b;
    currentQ = `${a} - ${b}`;
  }
}

// ---------- 游戏流程 ----------
function switchTurn() {
  if (state !== 'MATCH') return;
  const newTurn = currentTurn === 'P1' ? 'P2' : 'P1';
  currentTurn = newTurn;
  combatAnswer = '';
  robotAnswer = null;
  feedbackText = newTurn === 'P1' ? '轮到你了' : 'AI 思考中';
  feedbackClass = 'info';
  showKeyboard = false;
  nextQuestion();
  playSound('turn');
  vibrate();
  if (newTurn === 'P2') {
    if (aiTimer) clearTimeout(aiTimer);
    aiTurn();
  }
}

function checkGameOver() {
  if (p1Quota <= 0 || p2Quota <= 0) {
    clearTimers();
    if (p1Score > p2Score) { title = '🏆 胜利！'; titleColor = '#6ee7b7'; }
    else if (p2Score > p1Score) { title = '💀 落败'; titleColor = '#fda4af'; }
    else { title = '🤝 平局'; titleColor = '#9ca3af'; }
    sp = Math.floor((p1Score * 5) + (p1Time / 6));
    state = 'SETTLEMENT';
    showKeyboard = false;
    saveLeaderboard();
    if (p1Score > p2Score) {
      playSound('win');
      vibrate();
    }
  }
}

function aiTurn() {
  if (state !== 'MATCH' || currentTurn !== 'P2') return;
  feedbackText = '🤖 AI 运算中 ...';
  feedbackClass = 'thinking';
  const thinkTime = 1500 + Math.floor(Math.random() * 1500);
  aiTimer = setTimeout(() => {
    if (currentTurn !== 'P2') return;
    const accuracy = difficulty === 1 ? 0.7 : (difficulty === 2 ? 0.8 : 0.9);
    const isCorrect = Math.random() < accuracy;
    let finalAnswer = currentAnswer;
    if (!isCorrect) {
      finalAnswer = currentAnswer + (Math.random() > 0.5 ? 1 : -1) * (Math.floor(Math.random() * 5) + 1);
      if (finalAnswer < 0) finalAnswer = currentAnswer + 2;
    }
    robotAnswer = finalAnswer;
    playSound('robot');
    vibrate();
    if (isCorrect) {
      p2Score++;
      feedbackText = '🤖 AI答对了！';
      feedbackClass = 'error';
      battleLog.push(`机器人答对: ${currentQ} = ${finalAnswer} ✅`);
      playSound('correct');
    } else {
      feedbackText = '🤖 AI失误了！';
      feedbackClass = 'success';
      battleLog.push(`机器人答错: ${currentQ} = ${finalAnswer} ❌`);
      playSound('wrong');
    }
    p2Quota--;
    checkGameOver();
    if (state === 'MATCH') switchTurn();
  }, thinkTime);
}

function submitPlayerAnswer() {
  if (currentTurn !== 'P1') return;
  const ans = parseInt(combatAnswer);
  if (isNaN(ans)) return;
  vibrate();
  if (ans === currentAnswer) {
    p1Score++;
    feedbackText = '✅ 正确！ +1分';
    feedbackClass = 'success';
    battleLog.push(`你答对: ${currentQ} = ${ans} ✅`);
    playSound('correct');
  } else {
    feedbackText = `❌ 错误！正确答案是 ${currentAnswer}`;
    feedbackClass = 'error';
    battleLog.push(`你答错: ${currentQ} 提交了 ${ans} ❌`);
    playSound('wrong');
  }
  p1Quota--;
  combatAnswer = '';
  showKeyboard = false;
  checkGameOver();
  if (state === 'MATCH') switchTurn();
}

// ---------- 初始化对战（直接进入，无需诊断） ----------
function initMatch() {
  clearTimers();
  state = 'MATCH';
  p1Score = 0; p2Score = 0;
  p1Quota = 10; p2Quota = 10;
  p1Time = 300; p2Time = 300;
  currentTurn = 'P1';
  combatAnswer = '';
  robotAnswer = null;
  battleLog = [];
  feedbackText = '⚔️ 轮到你了';
  feedbackClass = 'info';
  showKeyboard = false;
  nextQuestion();
  startTimer();
}

function startTimer() {
  timerInterval = setInterval(() => {
    if (state !== 'MATCH') return;
    if (currentTurn === 'P1') {
      if (p1Time <= 0) {
        p1Quota--;
        feedbackText = '超时！配额-1';
        feedbackClass = 'error';
        battleLog.push('你超时未答 ❌ 消耗1配额');
        playSound('timeout');
        vibrate();
        checkGameOver();
        if (state === 'MATCH') switchTurn();
      } else {
        p1Time--;
      }
    } else if (currentTurn === 'P2') {
      if (p2Time <= 0) {
        p2Quota--;
        battleLog.push('AI超时未答 ❌ 消耗1配额');
        playSound('timeout');
        checkGameOver();
        if (state === 'MATCH') switchTurn();
      } else {
        p2Time--;
      }
    }
  }, 1000);
}

function startGame() {
  if (!playerName.trim()) playerName = '无名';
  // 构建分享参数
  shareQuery = `n=${encodeURIComponent(playerName)}&d=${difficulty}`;
  // 直接使用已有难度（挑战、缓存或默认1星）
  if (challengeData) {
    difficulty = challengeData.d;
  } else if (cachedLevel) {
    difficulty = cachedLevel;
  }
  // 若无缓存且无挑战，保持默认 difficulty = 1
  initMatch();
}

// ---------- 自定义数字键盘 ----------
const keyboardLayout = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['', '0', ''],
  ['清空', '', '确认']
];

function drawKeyboard() {
  const startX = 10;
  const startY = screenHeight - 230;
  const btnW = (screenWidth - 30) / 3;
  const btnH = 40;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let row = 0; row < keyboardLayout.length; row++) {
    for (let col = 0; col < keyboardLayout[row].length; col++) {
      const key = keyboardLayout[row][col];
      if (!key) continue;
      const x = startX + col * (btnW + 5);
      const y = startY + row * (btnH + 5);
      ctx.fillStyle = key === '确认' ? '#f59e0b' : (key === '清空' ? '#ef4444' : '#334155');
      ctx.fillRect(x, y, btnW, btnH);
      ctx.font = '18px sans-serif';
      ctx.fillStyle = '#fff';
      ctx.fillText(key, x + btnW / 2, y + btnH / 2);
    }
  }
}

function handleKeyboardTouch(x, y) {
  const startX = 10;
  const startY = screenHeight - 230;
  const btnW = (screenWidth - 30) / 3;
  const btnH = 40;
  for (let row = 0; row < keyboardLayout.length; row++) {
    for (let col = 0; col < keyboardLayout[row].length; col++) {
      const key = keyboardLayout[row][col];
      if (!key) continue;
      const bx = startX + col * (btnW + 5);
      const by = startY + row * (btnH + 5);
      if (x > bx && x < bx + btnW && y > by && y < by + btnH) {
        if (key === '确认') {
          submitPlayerAnswer();
        } else if (key === '清空') {
          combatAnswer = '';
        } else {
          if (combatAnswer.length < 5) combatAnswer += key;
        }
        break;
      }
    }
  }
}

// ---------- 年级选择器 ----------
function drawGradePicker() {
  ctx.fillStyle = 'rgba(0,0,0,0.8)';
  ctx.fillRect(0, 0, screenWidth, screenHeight);
  const menuWidth = screenWidth - 80;
  const menuHeight = grades.length * 50 + 40;
  const menuX = (screenWidth - menuWidth) / 2;
  const menuY = (screenHeight - menuHeight) / 2;
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(menuX, menuY, menuWidth, menuHeight);
  ctx.fillStyle = '#fff';
  ctx.font = '18px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < grades.length; i++) {
    const itemY = menuY + 20 + i * 50;
    ctx.fillStyle = i === gradeIndex ? '#f59e0b' : '#334155';
    ctx.fillRect(menuX + 10, itemY, menuWidth - 20, 40);
    ctx.fillStyle = i === gradeIndex ? '#0f172a' : '#e2e8f0';
    ctx.fillText(grades[i], menuX + menuWidth / 2, itemY + 20);
  }
}

function handleGradePickerTouch(x, y) {
  const menuWidth = screenWidth - 80;
  const menuX = (screenWidth - menuWidth) / 2;
  const menuY = (screenHeight - (grades.length * 50 + 40)) / 2;
  for (let i = 0; i < grades.length; i++) {
    const itemY = menuY + 20 + i * 50;
    if (x > menuX + 10 && x < menuX + menuWidth - 10 && y > itemY && y < itemY + 40) {
      gradeIndex = i;
      showGradePicker = false;
      break;
    }
  }
}

// ---------- 触摸事件 ----------
wx.onTouchStart((res) => {
  const touch = res.touches[0];
  const x = touch.clientX;
  const y = touch.clientY;

  if (showGradePicker) {
    handleGradePickerTouch(x, y);
    return;
  }

  if (showKeyboard) {
    handleKeyboardTouch(x, y);
    return;
  }

  if (state === 'ONBOARDING') {
    // 名字输入
    if (x > 50 && x < screenWidth - 50 && y > 170 && y < 220) {
      wx.showModal({
        title: '输入你的名字',
        editable: true,
        placeholderText: '输入外号（中英文均可）',
        success: (res) => {
          if (res.confirm && res.content) {
            playerName = res.content.trim().substring(0, 8);
          }
        }
      });
      return;
    }
    // 头像选择
    for (let i = 0; i < avatars.length; i++) {
      const btnX = 20 + (i % 3) * 100, btnY = 380 + Math.floor(i / 3) * 60;
      if (x > btnX && x < btnX + 80 && y > btnY && y < btnY + 45) {
        playerAvatar = avatars[i];
        return;
      }
    }
    // 年级选择
    if (x > 50 && x < screenWidth - 50 && y > 500 && y < 560) {
      showGradePicker = true;
      return;
    }
    // 开始游戏（直接进入对战）
    if (x > 50 && x < screenWidth - 50 && y > 580 && y < 640) {
      startGame();
      return;
    }
    // 排行榜
    if (x > 50 && x < screenWidth - 50 && y > 650 && y < 700) {
      leaderboard = wx.getStorageSync('math_leaderboard') || [];
      state = 'LEADERBOARD';
      return;
    }
  }

  // 对战输入键盘（仅玩家回合）
  if (state === 'MATCH' && currentTurn === 'P1') {
    showKeyboard = true;
    keyboardTarget = 'combat';
    return;
  }

  if (state === 'SETTLEMENT') {
    if (x > 50 && x < screenWidth - 50 && y > 280 && y < 340) { initMatch(); return; }
    // 分享按钮
    if (x > 50 && x < screenWidth - 50 && y > 350 && y < 410) {
      wx.shareAppMessage({
        title: `${playerName} 邀你进行数学对战！`,
        query: shareQuery,
        imageUrl: ''
      });
      return;
    }
    // 排行榜
    if (x > 50 && x < screenWidth - 50 && y > 420 && y < 480) {
      leaderboard = wx.getStorageSync('math_leaderboard') || [];
      state = 'LEADERBOARD'; return;
    }
    // 返回首页
    if (x > 50 && x < screenWidth - 50 && y > 490 && y < 550) {
      state = 'ONBOARDING'; playerName = ''; clearTimers(); return;
    }
  }

  if (state === 'LEADERBOARD') {
    if (x > 50 && x < screenWidth - 50 && y > screenHeight - 100 && y < screenHeight - 40) {
      state = 'ONBOARDING'; return;
    }
  }
});

// ---------- 分享设置 ----------
wx.onShareAppMessage(() => {
  return {
    title: `${playerName} 邀你进行数学对战！`,
    query: shareQuery,
    imageUrl: ''
  };
});

// ---------- 绘制界面 ----------
function drawButton(y, text, bgColor, textColor) {
  ctx.fillStyle = bgColor;
  ctx.fillRect(50, y, screenWidth - 100, 50);
  ctx.font = 'bold 18px sans-serif';
  ctx.fillStyle = textColor;
  ctx.fillText(text, screenWidth / 2, y + 25);
}

function drawPlayerCard(x, y, name, quota, score, timeStr, active) {
  ctx.fillStyle = active ? '#3b82f6' : '#334155';
  ctx.fillRect(x, y, screenWidth / 2 - 30, 90);
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(x + 3, y + 3, screenWidth / 2 - 36, 84);
  ctx.textAlign = 'left';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillStyle = '#e2e8f0';
  ctx.fillText(name, x + 10, y + 20);
  ctx.font = '11px sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(`配额 ${quota}`, x + 10, y + 40);
  ctx.textAlign = 'right';
  ctx.font = '12px sans-serif';
  ctx.fillStyle = (timeStr.includes(':') && parseInt(timeStr.split(':')[1]) < 60) ? '#f87171' : '#e2e8f0';
  ctx.fillText(timeStr, x + screenWidth / 2 - 40, y + 20);
  ctx.textAlign = 'right';
  ctx.font = 'bold 28px sans-serif';
  ctx.fillStyle = '#fbbf24';
  ctx.fillText(score.toString(), x + screenWidth / 2 - 40, y + 65);
  ctx.textAlign = 'center';
}

function draw() {
  ctx.clearRect(0, 0, screenWidth, screenHeight);
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 0, screenWidth, screenHeight);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (state === 'ONBOARDING') {
    ctx.font = 'bold 28px sans-serif';
    ctx.fillStyle = '#f59e0b';
    ctx.fillText('🧮 数理格斗初始化', screenWidth / 2, 80);

    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('点击框输入名字', screenWidth / 2, 140);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(50, 170, screenWidth - 100, 50);
    ctx.fillStyle = '#fbbf24';
    ctx.font = '20px sans-serif';
    ctx.fillText(playerName || '（点击输入名字）', screenWidth / 2, 195);

    for (let i = 0; i < avatars.length; i++) {
      const btnX = 20 + (i % 3) * 100;
      const btnY = 380 + Math.floor(i / 3) * 60;
      ctx.fillStyle = playerAvatar === avatars[i] ? '#f59e0b' : '#0f172a';
      ctx.fillRect(btnX, btnY, 80, 45);
      ctx.font = '24px sans-serif';
      ctx.fillStyle = playerAvatar === avatars[i] ? '#0f172a' : '#e2e8f0';
      ctx.fillText(avatars[i], btnX + 40, btnY + 22);
    }

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(50, 500, screenWidth - 100, 50);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '18px sans-serif';
    ctx.fillText(`年级：${grades[gradeIndex]} （点击切换）`, screenWidth / 2, 525);

    drawButton(580, '开始游戏', '#f59e0b', '#0f172a');
    drawButton(650, '🏆 查看排行榜', '#334155', '#cbd5e1');
  }

  if (state === 'MATCH') {
    ctx.font = 'bold 18px sans-serif';
    ctx.fillStyle = '#3b82f6';
    ctx.fillText('MATH DUEL', screenWidth / 2, 30);
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#fbbf24';
    ctx.fillText(`${difficulty}星难度`, screenWidth / 2, 55);

    drawPlayerCard(50, 80, playerAvatar + ' ' + (playerName || '无名'), p1Quota, p1Score, formatTime(p1Time), currentTurn === 'P1');
    drawPlayerCard(screenWidth / 2 + 20, 80, '🤖 智算AI', p2Quota, p2Score, formatTime(p2Time), currentTurn === 'P2');

    ctx.font = '16px sans-serif';
    if (feedbackClass === 'info') ctx.fillStyle = '#93c5fd';
    else if (feedbackClass === 'success') ctx.fillStyle = '#6ee7b7';
    else if (feedbackClass === 'error') ctx.fillStyle = '#fda4af';
    else ctx.fillStyle = '#c4b5fd';
    ctx.fillText(feedbackText, screenWidth / 2, 200);

    ctx.font = 'bold 32px sans-serif';
    ctx.fillStyle = '#fbbf24';
    ctx.fillText(currentQ, screenWidth / 2, 270);

    if (currentTurn === 'P1') {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(80, 400, screenWidth - 160, 60);
      ctx.font = '24px sans-serif';
      ctx.fillStyle = '#fbbf24';
      ctx.fillText(combatAnswer || '点击输入答案', screenWidth / 2, 430);
    }

    if (robotAnswer !== null) {
      ctx.font = '18px sans-serif';
      ctx.fillStyle = feedbackClass === 'error' ? '#fda4af' : '#6ee7b7';
      ctx.fillText(`🤖 机器人答案：${robotAnswer}`, screenWidth / 2, 340);
    }

    ctx.font = '12px sans-serif';
    for (let i = 0; i < Math.min(battleLog.length, 4); i++) {
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(battleLog[battleLog.length - 1 - i], screenWidth / 2, 550 + i * 20);
    }
  }

  if (state === 'SETTLEMENT') {
    ctx.font = 'bold 34px sans-serif';
    ctx.fillStyle = titleColor;
    ctx.fillText(title, screenWidth / 2, 80);
    ctx.font = '18px sans-serif';
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText(`👤 你：${p1Score}分 / 剩${p1Time}秒`, screenWidth / 2, 140);
    ctx.fillText(`🤖 AI：${p2Score}分 / 剩${p2Time}秒`, screenWidth / 2, 170);
    ctx.font = 'bold 22px sans-serif';
    ctx.fillStyle = '#f59e0b';
    ctx.fillText(`💎 +${sp} SP`, screenWidth / 2, 210);

    drawButton(280, '🔄 再来一局', '#2563eb', 'white');
    drawButton(350, '📤 分享挑战链接', '#f59e0b', '#0f172a');
    drawButton(420, '🏆 排行榜', '#334155', '#cbd5e1');
    drawButton(490, '🏠 返回首页', '#475569', '#cbd5e1');
  }

  if (state === 'LEADERBOARD') {
    ctx.font = 'bold 28px sans-serif';
    ctx.fillStyle = '#f59e0b';
    ctx.fillText('🏆 排行榜', screenWidth / 2, 60);
    if (leaderboard.length === 0) {
      ctx.font = '16px sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('暂无记录', screenWidth / 2, 120);
    } else {
      for (let i = 0; i < Math.min(leaderboard.length, 10); i++) {
        const item = leaderboard[i];
        ctx.font = '15px sans-serif';
        ctx.fillStyle = '#e2e8f0';
        ctx.fillText(`${i+1}. ${item.name}  ${item.score}分 剩${item.time}s ${item.difficulty}星`, screenWidth / 2, 100 + i * 30);
      }
    }
    drawButton(screenHeight - 80, '← 返回首页', '#334155', '#cbd5e1');
  }

  // 仅在对战且显示键盘时绘制
  if (showKeyboard && state === 'MATCH') drawKeyboard();
  if (showGradePicker) drawGradePicker();

  requestAnimationFrame(draw);
}

// ---------- 启动 ----------
preloadSounds();
loadCachedLevel();
const launchOptions = wx.getLaunchOptionsSync();
if (launchOptions.query && launchOptions.query.pk) {
  try {
    const data = JSON.parse(decodeURIComponent(launchOptions.query.pk));
    if (data.n && data.s !== undefined && data.d) {
      challengeData = data;
    }
  } catch (e) {}
}
draw();