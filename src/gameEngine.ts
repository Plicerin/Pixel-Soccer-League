import * as THREE from 'three';
import { Text } from 'troika-three-text';
import { OFFENSE_FORMATIONS, DEFENSE_FORMATIONS, PASS_PLAYBOOK, DEFENSE_PLAYBOOK } from './playbookData';

export const M = {
  fieldGreen:  new THREE.MeshStandardMaterial({ color: 0x2e8b2e, roughness: 0.8, metalness: 0.1 }),
  dolphinsEndZone: new THREE.MeshStandardMaterial({ color: 0x004d52, roughness: 0.8, metalness: 0.1 }),
  ninersEndZone:   new THREE.MeshStandardMaterial({ color: 0x660000, roughness: 0.8, metalness: 0.1 }),
  white:       new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0.1 }),
  goalPost:    new THREE.MeshStandardMaterial({ color: 0xf5d000, roughness: 0.3, metalness: 0.6 }),
  shadow:      new THREE.MeshStandardMaterial({ color: 0x1a5c1a, transparent: true, opacity: 0.45 }),
  blue:        new THREE.MeshStandardMaterial({ color: 0x008e97, roughness: 0.5, metalness: 0.2 }),
  red:         new THREE.MeshStandardMaterial({ color: 0xaa0000, roughness: 0.5, metalness: 0.2 }),
  orange:      new THREE.MeshStandardMaterial({ color: 0xfc4c02, roughness: 0.5, metalness: 0.2 }),
  dark:        new THREE.MeshStandardMaterial({ color: 0x005778, roughness: 0.5, metalness: 0.2 }),
  dolphinsHelmet: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2, metalness: 0.3 }),
  dolphinsVisor:  new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.1, metalness: 0.9 }),
  ninersHelmet:   new THREE.MeshStandardMaterial({ color: 0xc7a74b, roughness: 0.2, metalness: 0.5 }),
  ninersVisor:    new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.1, metalness: 0.9 }),
  dolphinsShirt:  new THREE.MeshStandardMaterial({ color: 0x008e97, roughness: 0.7, metalness: 0.0 }),
  dolphinsPants:  new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, metalness: 0.0 }),
  ninersShirt:    new THREE.MeshStandardMaterial({ color: 0xaa0000, roughness: 0.7, metalness: 0.0 }),
  ninersPants:    new THREE.MeshStandardMaterial({ color: 0xc7a74b, roughness: 0.7, metalness: 0.0 }),
};

export const TEAM_PALETTES = {
  dolphins: { shirt: M.dolphinsShirt, pants: M.dolphinsPants, helmet: M.dolphinsHelmet, visor: M.dolphinsVisor },
  niners: { shirt: M.ninersShirt, pants: M.ninersPants, helmet: M.ninersHelmet, visor: M.ninersVisor },
};

export const PLAYER_IDLE_PATTERNS = [
  ['00000000000111111000','00000000000111100000','00000001111111111000','00001111111111100000','00001111111111100000','00001111111111100000','00001111111111111000','00000001111100000000','00000001111100000000','00000001111100000000','00000001111100000000','00111111111100000000','00111000011100000000','00111000011100000000','00000000011100000000','00000000011111100000'],
];

export const PLAYER_PATTERNS = [
  ['00000000001111110000','00000000001110000000','00000111111111110000','00011111111110000000','00011100111110000000','00011100111111111111','00000000000000000000','00000000111110000000','00000000111110000000','00000111111111111111','00000111100000000111','00011111100000011100','00011100000000011100','01111100000000000000','01110000000000000000','01110000000000000000'],
  ['00000000001111110000','00000000001110000000','01111111111111110000','01110000111110000000','01110000111111111111','00000000111110000000','00000000000000000000','00000000111110000000','00000000111110000000','00000111111111111111','00000111100000000111','00011111100000000111','00011100000000000111','01111100000000000000','01110000000000000000','00000000000000000000'],
  ['00000000011111100000','00000000011100000000','00001111111111100000','00111111111100000000','00111001111100000000','00111001111111111110','00000000000000000000','00000001111100000000','00000001111100000000','00001111111111100000','00001110000111100000','00111110000111111000','11111000000000111000','11100000000000111000','00000000000000111110','00000000000000000000'],
  ['00000000000011111100','00000000000011100000','00000000111111111100','00000111111111110000','00011111111111110000','00011100111111111100','00011100000000000000','00000000111110000000','00000111111110000000','00000111111111110000','00000111100011110000','01111111100011110000','01110000000011110000','01110000000011110000','00000000000011110000','00000000000011111100'],
  ['00000000000111111000','00000000000111000000','00000001111111111000','00001111111111100000','00001111111111100000','00001111111111100000','00001111111111111000','00000001111100000000','00000001111100000000','00000001111100000000','00000001111100000000','00111111111100000000','00111000011100000000','00111000011100000000','00000000011100000000','00000000011111100000'],
  ['00000000001111110000','00000000001110000000','00000000111111110000','00000000111110000000','00000000111110000000','00000000111110000000','00000000111110000000','00000000111110000000','00000000111110000000','00000000111110000000','00000000111110000000','00011111111110000000','00011100111000000000','00011100111000000000','00000000111000000000','00000000111110000000'],
  ['00000000001111110000','00000000001110000000','00000111111111110000','00011111111110000000','00011111111110000000','00011111111110000000','00011111111111110000','00000111111000000000','00000111111110000000','00011111111111110000','00011100000011110000','00011100111111110000','00011100111000000000','00011100000000000000','00011100000000000000','00000111100000000000'],
  ['00000000000111111000','00000000000111000000','00000001111111111000','00001111111111100000','00111111111111100000','00111001111111111000','00111000000000000000','00000001111100000000','00000001111111100000','00001111111111111110','00001110000000001110','00001110000111111110','00001110000111100000','00111000000111100000','00111000000000000000','00111000000000000000'],
];

export function buildPlayerFrame(pattern: string[], palette: { shirt: THREE.Material; pants: THREE.Material; helmet: THREE.Material; visor: THREE.Material }) {
  const group = new THREE.Group();
  const voxelSize = 0.1152;
  const rows = pattern.length;
  const cols = pattern[0].length;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (pattern[r][c] === '1') {
        let mat = palette.shirt;
        if (r < 2) mat = palette.helmet;
        else if (r === 2 && c > 10 && c < 15) mat = palette.visor;
        else if (r > 9) mat = palette.pants;
        const geometry = new THREE.BoxGeometry(voxelSize, voxelSize, voxelSize * 3.0);
        const mesh = new THREE.Mesh(geometry, mat);
        mesh.castShadow = true;
        mesh.position.set((c - cols / 2) * voxelSize, (rows / 2 - r) * voxelSize, 0);
        group.add(mesh);
      }
    }
  }
  return group;
}

export function initGame(container: HTMLElement) {
  // --- Sound Manager ---
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  function playSound(freq: number, type: OscillatorType, duration: number, volume: number = 0.1) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(volume, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  }

  const sounds = {
    hike: () => playSound(150, 'square', 0.1, 0.05),
    throw: () => playSound(400, 'sine', 0.2, 0.05),
    catch: () => playSound(200, 'triangle', 0.1, 0.08),
    touchdown: () => {
      playSound(440, 'square', 0.2, 0.05);
      setTimeout(() => playSound(554, 'square', 0.2, 0.05), 200);
      setTimeout(() => playSound(659, 'square', 0.4, 0.05), 400);
    },
    incomplete: () => playSound(100, 'sawtooth', 0.3, 0.05),
    select: () => playSound(800, 'sine', 0.05, 0.02)
  };

  // --- Renderer ---
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(window.devicePixelRatio);
  
  const bannerTexts: Text[] = [];
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 1);
  renderer.domElement.style.display = 'block';
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap; // Crisper shadows
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  const dolphinsUniformPalettes = {
    home: { label: 'Home', shirt: 0x008e97, pants: 0xebedef, helmet: 0xf8f8f8, visor: 0x000000 },
    away: { label: 'Away', shirt: 0xf5f6f7, pants: 0x1497a2, helmet: 0xf8f8f8, visor: 0x000000 },
    alternate: { label: 'Alternate', shirt: 0x0b8a97, pants: 0xebedef, helmet: 0xf8f8f8, visor: 0x000000 },
  };

  function performPossessionSwap() {
    console.log('Swapping possession from', gameState.offensiveTeam);
    gameState.offensiveTeam = gameState.offensiveTeam === 'A' ? 'B' : 'A';
    console.log('Swapped to', gameState.offensiveTeam);
    ballState.pos.set(gameState.ballPos.x, 1.2, 0);
    ballState.vel.set(0, 0, 0);
    ballState.heldBy = null;
    setupFormation();
  }

  function swapSides() {
    gameState.ballPos.x = -gameState.ballPos.x;
    ballState.pos.set(gameState.ballPos.x, 1.2, 0);
    setupFormation();
  }

  const ninersUniformPalettes = {
    home: { label: 'Home', shirt: 0xaa0000, pants: 0xc7a74b, helmet: 0xc7a74b, visor: 0x000000 },
    away: { label: 'Away', shirt: 0xf5f6f7, pants: 0xc7a74b, helmet: 0xc7a74b, visor: 0x000000 },
    alternate: { label: 'Alternate', shirt: 0xff1a1a, pants: 0xc7a74b, helmet: 0xc7a74b, visor: 0x000000 },
  };

  const scoreBug = document.createElement('div');
  scoreBug.style.position = 'fixed';
  scoreBug.style.bottom = '20px';
  scoreBug.style.left = '50%';
  scoreBug.style.transform = 'translateX(-50%)';
  scoreBug.style.display = 'flex';
  scoreBug.style.alignItems = 'stretch';
  scoreBug.style.height = '62px';
  scoreBug.style.background = 'rgba(0, 0, 0, 0.85)';
  scoreBug.style.backdropFilter = 'blur(8px)';
  scoreBug.style.border = '1px solid rgba(255, 255, 255, 0.15)';
  scoreBug.style.borderRadius = '4px';
  scoreBug.style.overflow = 'hidden';
  scoreBug.style.boxShadow = '0 8px 32px rgba(0,0,0,0.5)';
  scoreBug.style.zIndex = '100';
  scoreBug.style.fontFamily = '"Inter", sans-serif';
  container.appendChild(scoreBug);

  const style = document.createElement('style');
  style.textContent = `
    @keyframes messageFlashScroll {
      0% { transform: translate(100vw, -50%) skewX(-15deg); opacity: 0; }
      15% { transform: translate(-50%, -50%) skewX(-15deg); opacity: 1; }
      20% { transform: translate(-50%, -50%) skewX(-15deg) scale(1.2); color: #ffeb3b; text-shadow: 0 0 30px #ffeb3b; }
      25% { transform: translate(-50%, -50%) skewX(-15deg) scale(1); color: #fff; text-shadow: 0 0 20px rgba(0,0,0,0.8); }
      85% { transform: translate(-50%, -50%) skewX(-15deg); opacity: 1; }
      100% { transform: translate(-100vw, -50%) skewX(-15deg); opacity: 0; }
    }
    .game-message-anim {
      animation: messageFlashScroll 2.5s cubic-bezier(0.25, 1, 0.5, 1) forwards;
    }
  `;
  document.head.appendChild(style);

  const messageOverlay = document.createElement('div');
  messageOverlay.style.position = 'fixed';
  messageOverlay.style.top = '40%';
  messageOverlay.style.left = '50%';
  messageOverlay.style.transform = 'translate(-50%, -50%) skewX(-15deg)';
  messageOverlay.style.fontFamily = '"Inter", sans-serif';
  messageOverlay.style.fontSize = '8vw';
  messageOverlay.style.fontWeight = '900';
  messageOverlay.style.color = '#fff';
  messageOverlay.style.textTransform = 'uppercase';
  messageOverlay.style.textShadow = '0 0 20px rgba(0,0,0,0.8), 0 0 40px rgba(0,0,0,0.5)';
  messageOverlay.style.pointerEvents = 'none';
  messageOverlay.style.zIndex = '200';
  messageOverlay.style.opacity = '0';
  messageOverlay.style.whiteSpace = 'nowrap';
  messageOverlay.style.textAlign = 'center';
  container.appendChild(messageOverlay);

  const hintOverlay = document.createElement('div');
  hintOverlay.style.position = 'fixed';
  hintOverlay.style.top = '40%';
  hintOverlay.style.left = '50%';
  hintOverlay.style.transform = 'translate(-50%, -50%) skewX(-15deg)';
  hintOverlay.style.fontFamily = '"Inter", sans-serif';
  hintOverlay.style.fontSize = '4vw';
  hintOverlay.style.fontWeight = '900';
  hintOverlay.style.color = '#fff';
  hintOverlay.style.textTransform = 'uppercase';
  hintOverlay.style.textShadow = '0 0 20px rgba(0,0,0,0.8), 0 0 40px rgba(0,0,0,0.5)';
  hintOverlay.style.pointerEvents = 'none';
  hintOverlay.style.zIndex = '200';
  hintOverlay.style.opacity = '0';
  hintOverlay.style.whiteSpace = 'nowrap';
  hintOverlay.style.textAlign = 'center';
  hintOverlay.textContent = 'Press [X] to run the same play';
  container.appendChild(hintOverlay);

  let lastMessage = '';


  let isPlaybookVisible = true;
  const playbookBar = document.createElement('div');
  playbookBar.style.position = 'fixed';
  playbookBar.style.top = '10px';
  playbookBar.style.left = '50%';
  playbookBar.style.transform = 'translateX(-50%)';
  playbookBar.style.width = 'min(1200px, calc(100vw - 20px))';
  playbookBar.style.display = 'flex';
  playbookBar.style.flexDirection = 'column';
  playbookBar.style.gap = '10px';
  playbookBar.style.padding = '10px';
  playbookBar.style.zIndex = '30';
  container.appendChild(playbookBar);

  const playbookHint = document.createElement('div');
  playbookHint.style.position = 'fixed';
  playbookHint.style.top = '20px';
  playbookHint.style.left = '50%';
  playbookHint.style.transform = 'translateX(-50%)';
  playbookHint.style.background = 'rgba(0, 0, 0, 0.4)';
  playbookHint.style.backdropFilter = 'blur(4px)';
  playbookHint.style.border = '1px solid rgba(255, 255, 255, 0.1)';
  playbookHint.style.padding = '6px 12px';
  playbookHint.style.borderRadius = '4px';
  playbookHint.style.color = 'rgba(255, 255, 255, 0.4)';
  playbookHint.style.fontFamily = '"Inter", sans-serif';
  playbookHint.style.fontSize = '9px';
  playbookHint.style.textTransform = 'uppercase';
  playbookHint.style.letterSpacing = '0.1em';
  playbookHint.style.pointerEvents = 'none';
  playbookHint.style.zIndex = '20';
  playbookHint.style.display = 'none';
  playbookHint.textContent = 'Press [P] for Playbook';
  container.appendChild(playbookHint);

  function createTeamSection(logoPath: string, teamName: string, color: string, isLeft: boolean) {
    const section = document.createElement('div');
    section.style.display = 'flex';
    section.style.alignItems = 'center';
    section.style.background = isLeft ? `linear-gradient(90deg, ${color} 0%, rgba(0,0,0,0) 100%)` : `linear-gradient(-90deg, ${color} 0%, rgba(0,0,0,0) 100%)`;
    section.style.padding = '0 32px';
    section.style.gap = '16px';

    const logo = document.createElement('img');
    logo.src = logoPath;
    logo.referrerPolicy = 'no-referrer';
    logo.style.height = '42px';
    logo.style.width = 'auto';
    logo.style.objectFit = 'contain';
    if (!isLeft) logo.style.transform = 'scaleX(-1)';

    const name = document.createElement('div');
    name.textContent = teamName;
    name.style.color = 'white';
    name.style.fontSize = '22px';
    name.style.fontWeight = '800';
    name.style.textTransform = 'uppercase';
    name.style.letterSpacing = '0.05em';

    const score = document.createElement('div');
    score.style.width = '70px';
    score.style.display = 'flex';
    score.style.alignItems = 'center';
    score.style.justifyContent = 'center';
    score.style.fontSize = '36px';
    score.style.fontWeight = '900';
    score.style.color = 'white';
    score.style.background = 'rgba(255,255,255,0.1)';
    score.style.height = '100%';
    score.textContent = '0';

    if (isLeft) {
      section.appendChild(logo);
      section.appendChild(name);
      section.appendChild(score);
    } else {
      section.appendChild(score);
      section.appendChild(name);
      section.appendChild(logo);
    }

    return { section, score };
  }

  const teamA = createTeamSection('/assets/miami-helmet-logo.png', 'MIA', '#008e97', true);
  const teamB = createTeamSection('/assets/sf-helmet-logo.png', 'SF', '#aa0000', false);

  const centerInfo = document.createElement('div');
  centerInfo.style.display = 'flex';
  centerInfo.style.flexDirection = 'column';
  centerInfo.style.alignItems = 'center';
  centerInfo.style.justifyContent = 'center';
  centerInfo.style.padding = '0 40px';
  centerInfo.style.minWidth = '180px';
  centerInfo.style.borderLeft = '1px solid rgba(255,255,255,0.1)';
  centerInfo.style.borderRight = '1px solid rgba(255,255,255,0.1)';

  const timerDisplay = document.createElement('div');
  timerDisplay.style.color = '#ffe7a7';
  timerDisplay.style.fontSize = '28px';
  timerDisplay.style.fontWeight = '700';
  timerDisplay.style.fontFamily = 'monospace';
  timerDisplay.textContent = '15:00';

  const qtrDisplay = document.createElement('div');
  qtrDisplay.style.color = 'white';
  qtrDisplay.style.fontSize = '14px';
  qtrDisplay.style.fontWeight = '600';
  qtrDisplay.style.opacity = '0.6';
  qtrDisplay.textContent = '1ST QTR';

  const downDistanceDisplay = document.createElement('div');
  downDistanceDisplay.style.color = '#fff';
  downDistanceDisplay.style.fontSize = '14px';
  downDistanceDisplay.style.fontWeight = '600';
  downDistanceDisplay.style.marginTop = '4px';
  downDistanceDisplay.textContent = '1ST & 10';

  centerInfo.appendChild(timerDisplay);
  centerInfo.appendChild(qtrDisplay);
  centerInfo.appendChild(downDistanceDisplay);

  scoreBug.appendChild(teamA.section);
  scoreBug.appendChild(centerInfo);
  scoreBug.appendChild(teamB.section);

  // Increase scoreBug height to accommodate new element
  scoreBug.style.height = '90px';

  let period = 1;
  let periodLength = 15 * 60;
  let timerSeconds = periodLength;

  function formatTimer(sec: number) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  function updateTimerDisplay() {
    timerDisplay.textContent = formatTimer(timerSeconds);
    const qtrSuffix = ['ST', 'ND', 'RD', 'TH'][period - 1] || 'TH';
    qtrDisplay.textContent = `${period}${qtrSuffix} QTR`;
  }

  updateTimerDisplay();

  function tickTimer() {
    if (timerSeconds > 0) {
      timerSeconds--;
      updateTimerDisplay();
    } else {
      if (period < 4) {
        period++;
        timerSeconds = periodLength;
        updateTimerDisplay();
        performPossessionSwap();
      } else {
        timerDisplay.textContent = 'FINAL';
        qtrDisplay.textContent = '';
      }
    }
  }
  const timerInterval = setInterval(tickTimer, 1000);


  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb); // Neutral sky blue
  scene.fog = new THREE.Fog(0x87ceeb, 100, 300);

  const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 350);
  const orbitCamera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  const orbitRenderTarget = new THREE.WebGLRenderTarget(256, 256);
  const broadcastCameraPosition = new THREE.Vector3(0, 46, 42);
  const broadcastCameraTarget = new THREE.Vector3(0, 0, 0);
  const closeupCameraPosition = new THREE.Vector3();
  const closeupCameraTarget = new THREE.Vector3();
  const cameraLerpPosition = new THREE.Vector3();
  const cameraModeState = { mode: 'broadcast' };
  camera.position.copy(broadcastCameraPosition);
  camera.lookAt(broadcastCameraTarget);

  const amb = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(amb);
  const skyBounce = new THREE.HemisphereLight(0xcae1ff, 0x3c5f35, 0.6);
  scene.add(skyBounce);
  const sun = new THREE.DirectionalLight(0xffffff, 1.8);
  sun.position.set(-32, 40, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.bias = -0.001;
  sun.shadow.normalBias = 0.02;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 200;
  sun.shadow.camera.left = -80;
  sun.shadow.camera.right = 80;
  sun.shadow.camera.top = 60;
  sun.shadow.camera.bottom = -60;
  sun.shadow.radius = 1;
  scene.add(sun);
  const rimLight = new THREE.DirectionalLight(0xffffff, 0.4);
  rimLight.position.set(26, 11, -18);
  scene.add(rimLight);
  const sidelineFill = new THREE.DirectionalLight(0xffffff, 0.2);
  sidelineFill.position.set(-6, 8, 28);
  scene.add(sidelineFill);
  const turfBounce = new THREE.DirectionalLight(0x9ac27d, 0.1);
  turfBounce.position.set(0, -8, 0);
  scene.add(turfBounce);

  const lightingPresets: any = {
    noon: { 
      label: 'High Noon', 
      background: 0x87ceeb, 
      fogColor: 0x87ceeb, 
      fogNear: 100, 
      fogFar: 250, 
      exposure: 1.1, 
      ambientColor: 0xffffff, 
      ambientIntensity: 0.4, 
      hemiSkyColor: 0xffffff, 
      hemiGroundColor: 0x444444, 
      hemiIntensity: 0.6, 
      sunColor: 0xfffaf0, 
      sunIntensity: 2.0, 
      sunPosition: [10, 50, 10], 
      rimColor: 0xffffff, 
      rimIntensity: 0.5, 
      rimPosition: [-20, 20, -20], 
      fillColor: 0xffffff, 
      fillIntensity: 0.3, 
      fillPosition: [0, 10, 30], 
      turfColor: 0xffffff, 
      turfIntensity: 0.1 
    },
    'late-afternoon': { 
      label: 'Golden Hour', 
      background: 0xffa07a, 
      fogColor: 0xffa07a, 
      fogNear: 50, 
      fogFar: 180, 
      exposure: 1.05, 
      ambientColor: 0xffd700, 
      ambientIntensity: 0.3, 
      hemiSkyColor: 0xffa500, 
      hemiGroundColor: 0x222222, 
      hemiIntensity: 0.5, 
      sunColor: 0xff8c00, 
      sunIntensity: 2.5, 
      sunPosition: [-40, 15, 5], 
      rimColor: 0xffd700, 
      rimIntensity: 0.8, 
      rimPosition: [30, 10, -20], 
      fillColor: 0xffa07a, 
      fillIntensity: 0.4, 
      fillPosition: [-10, 5, 20], 
      turfColor: 0xffa500, 
      turfIntensity: 0.2 
    },
    night: { 
      label: 'Stadium Lights', 
      background: 0x050510, 
      fogColor: 0x050510, 
      fogNear: 40, 
      fogFar: 130, 
      exposure: 1.0, 
      ambientColor: 0x111122, 
      ambientIntensity: 0.2, 
      hemiSkyColor: 0x222244, 
      hemiGroundColor: 0x000000, 
      hemiIntensity: 0.4, 
      sunColor: 0xccccff, 
      sunIntensity: 3.0, 
      sunPosition: [0, 40, 0], 
      rimColor: 0xaaaaff, 
      rimIntensity: 1.2, 
      rimPosition: [-30, 20, -30], 
      fillColor: 0x8888ff, 
      fillIntensity: 0.6, 
      fillPosition: [30, 20, 30], 
      turfColor: 0x4444ff, 
      turfIntensity: 0.3 
    },
  };

  function applyLightingPreset(presetKey: string) {
    const preset = lightingPresets[presetKey] || lightingPresets['late-afternoon'];
    renderer.toneMappingExposure = preset.exposure;
    scene.background = new THREE.Color(preset.background);
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.color.setHex(preset.fogColor);
      scene.fog.near = preset.fogNear;
      scene.fog.far = preset.fogFar;
    }
    skyBounce.color.setHex(preset.hemiSkyColor);
    skyBounce.groundColor.setHex(preset.hemiGroundColor);
    skyBounce.intensity = preset.hemiIntensity;
    sun.color.setHex(preset.sunColor);
    sun.intensity = preset.sunIntensity;
    sun.position.set(preset.sunPosition[0], preset.sunPosition[1], preset.sunPosition[2]);
    rimLight.color.setHex(preset.rimColor);
    rimLight.intensity = preset.rimIntensity;
    rimLight.position.set(preset.rimPosition[0], preset.rimPosition[1], preset.rimPosition[2]);
    sidelineFill.color.setHex(preset.fillColor);
    sidelineFill.intensity = preset.fillIntensity;
    sidelineFill.position.set(preset.fillPosition[0], preset.fillPosition[1], preset.fillPosition[2]);
    turfBounce.color.setHex(preset.turfColor);
    turfBounce.intensity = preset.turfIntensity;
  }

  let dolphinsRosterPlayers: any[] = [];
  let ninersRosterPlayers: any[] = [];

  function setVoxelMaterialColor(materials: any[], baseHex: number) {
    const base = new THREE.Color(baseHex);
    const shades = [
      base.clone().offsetHSL(0, 0, -0.1),
      base.clone().offsetHSL(0, 0, -0.18),
      base.clone().offsetHSL(0, 0, 0.08),
      base.clone().offsetHSL(0, 0, -0.24),
      base.clone().offsetHSL(0, 0, 0.03),
      base.clone().offsetHSL(0, 0, -0.14),
    ];
    for (let i = 0; i < Math.min(materials.length, shades.length); i += 1) {
      materials[i].color.copy(shades[i]);
    }
  }

  function recolorPlayerUniform(player: any, palette: any) {
    const allFrames = [...player.runFrames, ...player.idleFrames];
    for (const frame of allFrames) {
      for (const pixel of frame.group.children) {
        const part = pixel.userData.uniformPart || 'shirt';
        const hex = part === 'visor' ? palette.visor.color.getHex() : part === 'helmet' ? palette.helmet.color.getHex() : part === 'pants' ? palette.pants.color.getHex() : palette.shirt.color.getHex();
        if (Array.isArray(pixel.material)) {
          setVoxelMaterialColor(pixel.material, hex);
        } else if (pixel.material.color) {
          pixel.material.color.setHex(hex);
        }
      }
    }
  }

  function applyDolphinsUniformVariant(variantKey: string) {
    const variant = (dolphinsUniformPalettes as any)[variantKey] || dolphinsUniformPalettes.home;
    M.dolphinsShirt.color.setHex(variant.shirt);
    M.dolphinsPants.color.setHex(variant.pants);
    M.dolphinsHelmet.color.setHex(variant.helmet);
    M.dolphinsVisor.color.setHex(variant.visor);
    for (const player of dolphinsRosterPlayers) recolorPlayerUniform(player, TEAM_PALETTES.dolphins);
    refreshFrameInspector();
  }

  function applyNinersUniformVariant(variantKey: string) {
    const variant = (ninersUniformPalettes as any)[variantKey] || ninersUniformPalettes.home;
    M.ninersShirt.color.setHex(variant.shirt);
    M.ninersPants.color.setHex(variant.pants);
    M.ninersHelmet.color.setHex(variant.helmet);
    M.ninersVisor.color.setHex(variant.visor);
    for (const player of ninersRosterPlayers) recolorPlayerUniform(player, TEAM_PALETTES.niners);
    refreshFrameInspector();
  }

  function setCameraMode(modeKey: string) {
    cameraModeState.mode = modeKey === 'closeup' ? 'closeup' : 'broadcast';
  }

  const LIGHTING_PRESETS = {
    NOON: { sun: 1.5, amb: 0.54, sky: 0x77a9d9 },
    LATE: { sun: 1.7, amb: 0.42, sky: 0x6d7f5a },
    NIGHT: { sun: 1.95, amb: 0.23, sky: 0x0c1224 },
  };

  // --- Ball Texture ---
  const ballCanvas = document.createElement('canvas');
  ballCanvas.width = 64;
  ballCanvas.height = 32;
  const ballCtx = ballCanvas.getContext('2d')!;
  ballCtx.fillStyle = '#6b3e2e';
  ballCtx.fillRect(0, 0, 64, 32);
  ballCtx.strokeStyle = '#ffffff';
  ballCtx.lineWidth = 2;
  ballCtx.beginPath();
  ballCtx.moveTo(20, 16);
  ballCtx.lineTo(44, 16);
  for (let i = 0; i < 5; i++) {
    ballCtx.moveTo(24 + i * 4, 12);
    ballCtx.lineTo(24 + i * 4, 20);
  }
  ballCtx.stroke();
  const ballTex = new THREE.CanvasTexture(ballCanvas);

  // --- Grass Texture ---
  const grassCanvas = document.createElement('canvas');
  grassCanvas.width = 256;
  grassCanvas.height = 256;
  const grassCtx = grassCanvas.getContext('2d')!;
  
  // Base color
  grassCtx.fillStyle = '#2e8b2e'; // SeaGreen
  grassCtx.fillRect(0, 0, 256, 256);
  
  // Add texture using more contrasting colors and more circles
  grassCtx.globalAlpha = 0.3; // Increased opacity
  for (let i = 0; i < 3000; i++) { // Increased number of circles
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const size = Math.random() * 4 + 1;
    // More contrasting colors based on SeaGreen
    grassCtx.fillStyle = Math.random() > 0.5 ? '#3cb371' : '#206020';
    grassCtx.beginPath();
    grassCtx.arc(x, y, size, 0, Math.PI * 2);
    grassCtx.fill();
  }
  grassCtx.globalAlpha = 1.0; // Reset
  
  const grassTex = new THREE.CanvasTexture(grassCanvas);
  grassTex.wrapS = THREE.RepeatWrapping;
  grassTex.wrapT = THREE.RepeatWrapping;
  // Apply tiling to the texture
  grassTex.repeat.set(20, 10);

  // --- Materials ---

  const TEAM_PALETTES = {
    dolphins: { shirt: M.dolphinsShirt, pants: M.dolphinsPants, helmet: M.dolphinsHelmet, visor: M.dolphinsVisor },
    niners: { shirt: M.ninersShirt, pants: M.ninersPants, helmet: M.ninersHelmet, visor: M.ninersVisor },
  };

  const gameState = {
    status: 'PLAYING',
    scoreA: 0,
    scoreB: 0,
    period: 1,
    timer: 60,
    down: 1,
    distance: 10,
    ballPos: new THREE.Vector3(-20, 0.15, 0),
    message: 'READY',
    isLive: false,
    isResetting: false,
    isKickoff: false,
    kickoffState: 'NONE' as 'NONE' | 'READY' | 'KICKED',
    selectedKickoffPlayerIndex: 0,
    passCaught: false,
    selectedOffensePlay: 'slant-flood',
    selectedDefensePlay: 'cover-2',
    lastOffensePlay: 'slant-flood',
    lastDefensePlay: 'cover-2',
    hintDismissed: false,
    offensiveTeam: 'A' as 'A' | 'B',
    selectedReceiverIndex: 0,
    selectedDefenderIndex: 0,
    selectedDefenderOrbitRotated: false,
    isChargingPass: false,
    isPassLocked: false,
    passChargeProgress: 0,
    passChargeOffset: new THREE.Vector3(),
    screenShake: 0,
  };

  const playState = {
    activeRoutes: [] as any[],
    defenseAssignments: [] as any[],
    targetPlayer: null as any,
    ballState: 'held' as 'held' | 'thrown' | 'caught' | 'incomplete',
    throwElapsed: 0,
    throwDuration: 1.2,
    throwStart: new THREE.Vector3(),
    throwEnd: new THREE.Vector3(),
  };

  const ballState = {
    pos: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    heldBy: null as any,
    lastHeldBy: null as any,
    isFlying: false,
  };

  const keys: { [key: string]: boolean } = {};
  let lastTime = performance.now();
  let cameraMode: 'FOLLOW_BEHIND' | 'BROADCAST' | 'SIDELINE' | 'FIXED_ENDZONE' = 'BROADCAST';

  const teamAUniforms = [
    { name: 'Home', palette: TEAM_PALETTES.dolphins },
    { name: 'Away', palette: { ...TEAM_PALETTES.dolphins, shirt: M.white } },
    { name: 'Alt', palette: { ...TEAM_PALETTES.dolphins, shirt: M.orange, pants: M.white } },
  ];
  const teamBUniforms = [
    { name: 'Home', palette: TEAM_PALETTES.niners },
    { name: 'Away', palette: { ...TEAM_PALETTES.niners, shirt: M.white } },
    { name: 'Alt', palette: { ...TEAM_PALETTES.niners, shirt: M.dark } },
  ];
  let teamAUniformIndex = 0;
  let teamBUniformIndex = 0;

  function updateHUD() {
    const play = PASS_PLAYBOOK[gameState.selectedOffensePlay as keyof typeof PASS_PLAYBOOK];
    const playLabel = play ? play.label : 'NONE';
    const receivers = getEligibleReceivers();
    const target = receivers[gameState.selectedReceiverIndex];
    const canSelect = !gameState.isLive || (gameState.isLive && ballState.heldBy && ballState.heldBy.role === 'QB');
    const selectionHint = canSelect ? ' [Q/E: Target]' : '';
    const targetDisplay = target ? `TARGET: ${target.role}` : 'NO TARGET';
    
    teamA.score.textContent = gameState.scoreA.toString();
    teamB.score.textContent = gameState.scoreB.toString();
    
    const downSuffix = gameState.down === 1 ? 'ST' : gameState.down === 2 ? 'ND' : gameState.down === 3 ? 'RD' : 'TH';
    downDistanceDisplay.textContent = `${gameState.down}${downSuffix} & ${gameState.distance}`;
  }

  function refreshFrameInspector() {
    // Optional: implement if needed
  }

  // --- Field dimensions ---
  const EZONE_W = 4.8;
  const FIELD_OF_PLAY_W = 56;
  const FIELD_W = FIELD_OF_PLAY_W + EZONE_W * 2;
  const FIELD_D = 32;
  const UNITS_PER_YARD = FIELD_OF_PLAY_W / 100;
  const TEN_YARDS_UNITS = UNITS_PER_YARD * 10;
  const FIVE_YARDS_UNITS = UNITS_PER_YARD * 5;
  const RIGHT_ENDZONE_X = FIELD_W / 2 - EZONE_W;
  const GOALPOST_OFFSET = 1.15;
  const OUTLINE_W = FIELD_W + GOALPOST_OFFSET * 2;

  const fieldElements: THREE.Mesh[] = [];

  function addBox(w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.receiveShadow = true;
    m.castShadow = true;
    scene.add(m);
    return m;
  }

  function addFieldBox(w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number) {
    const m = addBox(w, h, d, mat, x, y, z);
    m.receiveShadow = true;
    fieldElements.push(m);
    return m;
  }

  const fieldGrass = addFieldBox(FIELD_W, 0.3, FIELD_D, M.fieldGreen, 0, 0, 0);
  const groundGeometry = new THREE.PlaneGeometry(1000, 1000);
  const groundMaterial = M.fieldGreen;
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.1;
  ground.receiveShadow = true; // Re-enabled after test
  scene.add(ground);
  addFieldBox(EZONE_W, 0.32, FIELD_D, M.dolphinsEndZone, -FIELD_W / 2 + EZONE_W / 2, 0.01, 0);
  addFieldBox(EZONE_W, 0.32, FIELD_D, M.ninersEndZone, FIELD_W / 2 - EZONE_W / 2, 0.01, 0);
  addFieldBox(GOALPOST_OFFSET, 0.32, FIELD_D, M.dolphinsEndZone, -FIELD_W / 2 - GOALPOST_OFFSET / 2, 0.01, 0);
  addFieldBox(GOALPOST_OFFSET, 0.32, FIELD_D, M.ninersEndZone, FIELD_W / 2 + GOALPOST_OFFSET / 2, 0.01, 0);

  for (let yard = 10; yard <= 90; yard += 10) {
    addFieldBox(0.18, 0.35, FIELD_D, M.white, -FIELD_OF_PLAY_W / 2 + yard * UNITS_PER_YARD, 0.01, 0);
  }
  for (let x = -FIELD_OF_PLAY_W / 2 + UNITS_PER_YARD; x <= FIELD_OF_PLAY_W / 2 - UNITS_PER_YARD; x += UNITS_PER_YARD) {
    addFieldBox(0.12, 0.33, 0.34, M.white, x, 0.01, -2.25);
    addFieldBox(0.12, 0.33, 0.34, M.white, x, 0.01, 2.25);
  }
  for (let x = -FIELD_OF_PLAY_W / 2 + FIVE_YARDS_UNITS; x <= FIELD_OF_PLAY_W / 2 - FIVE_YARDS_UNITS; x += FIVE_YARDS_UNITS) {
    addFieldBox(0.1, 0.33, 0.52, M.white, x, 0.01, -FIELD_D / 2 + 0.35);
    addFieldBox(0.1, 0.33, 0.52, M.white, x, 0.01, FIELD_D / 2 - 0.35);
  }
  addFieldBox(OUTLINE_W, 0.35, 0.18, M.white, 0, 0.01, -FIELD_D / 2);
  addFieldBox(OUTLINE_W, 0.35, 0.18, M.white, 0, 0.01,  FIELD_D / 2);
  addFieldBox(0.18, 0.35, FIELD_D, M.white, -FIELD_W / 2 - GOALPOST_OFFSET, 0.01, 0);
  addFieldBox(0.18, 0.35, FIELD_D, M.white, FIELD_W / 2 + GOALPOST_OFFSET, 0.01, 0);
  addFieldBox(0.18, 0.35, FIELD_D, M.white, -FIELD_W / 2 + EZONE_W, 0.01, 0);
  addFieldBox(0.18, 0.35, FIELD_D, M.white, FIELD_W / 2 - EZONE_W, 0.01, 0);

  function makeEndZoneLabelSprite(label: string, color: string = '#f5f2e8') {
    const labelLongSide = FIELD_D - 1.4;
    const labelShortSide = EZONE_W - 0.35;
    const renderWidth = 2200;
    const renderHeight = 320;
    const textWidth = 1100;
    const textHeight = 160;
    const canvas = document.createElement('canvas');
    canvas.width = renderWidth;
    canvas.height = renderHeight;
    const ctx = canvas.getContext('2d')!;
    const textCanvas = document.createElement('canvas');
    textCanvas.width = textWidth;
    textCanvas.height = textHeight;
    const textCtx = textCanvas.getContext('2d')!;
    textCtx.clearRect(0, 0, textCanvas.width, textCanvas.height);
    textCtx.fillStyle = color;
    let fontSize = Math.floor(textCanvas.height * 0.9);
    textCtx.font = `bold ${fontSize}px monospace`;
    let measuredWidth = textCtx.measureText(label).width;
    const maxTextWidth = textCanvas.width * 0.96;
    if (measuredWidth > maxTextWidth && measuredWidth > 0) {
      fontSize = Math.floor(fontSize * (maxTextWidth / measuredWidth));
      textCtx.font = `bold ${fontSize}px monospace`;
    }
    textCtx.textAlign = 'center';
    textCtx.textBaseline = 'middle';
    textCtx.fillText(label, textCanvas.width / 2, textCanvas.height / 2 + 2);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(textCanvas, 0, 0, canvas.width, canvas.height);
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(labelLongSide, labelShortSide), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.35;
    return mesh;
  }

  const crowdBlocks: any[] = [];
  const visibleCrowdBlocks: any[] = [];
  const dolphinsPhrases = ["Fins Up!", "Go Dolphins!", "Touchdown!", "Dolphins Win!"];
  const ninersPhrases = ["Go Niners!", "Faithful!", "Touchdown!", "Niners Win!"];

  function spawnWordBalloon(x: number, y: number, z: number, text: string, color: string) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.roundRect(0, 0, 512, 192, 40);
    ctx.fill();
    ctx.fillStyle = 'black';
    ctx.font = 'bold 56px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 96);
    
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture, depthTest: false });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.position.set(x, y + 1, z);
    sprite.scale.set(8, 4, 1);
    scene.add(sprite);
    
    let opacity = 1;
    const animateBalloon = () => {
      opacity -= 0.02; // Fade speed reduced by 50% (fade 100% slower)
      sprite.position.y += 0.005; // Movement speed reduced by 75%
      sprite.material.opacity = opacity;
      if (opacity > 0) {
        requestAnimationFrame(animateBalloon);
      } else {
        scene.remove(sprite);
        texture.dispose();
        spriteMat.dispose();
      }
    };
    animateBalloon();
  }

  let crowdMesh: THREE.InstancedMesh;
  function createStadium() {
    const stadiumGroup = new THREE.Group();
    scene.add(stadiumGroup);

    const stadiumColor = 0x2a3b5a; // Dark blue/purple
    const wallMat = new THREE.MeshStandardMaterial({ color: stadiumColor, roughness: 0.7 });

    const addSBox = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      m.receiveShadow = true;
      m.castShadow = true;
      stadiumGroup.add(m);
      return m;
    };

    const wallHeight = 2.4;
    const wallThickness = 1.0;
    const wallOffset = 5; 

    const wallW = FIELD_W + wallOffset * 2;
    const wallD = FIELD_D + wallOffset * 2;

    // Base Walls
    addSBox(wallW, wallHeight, wallThickness, wallMat, 0, wallHeight/2, -wallD/2);
    addSBox(wallW, wallHeight, wallThickness, wallMat, 0, wallHeight/2, wallD/2);
    addSBox(wallThickness, wallHeight, wallD, wallMat, -wallW/2, wallHeight/2, 0);
    addSBox(wallThickness, wallHeight, wallD, wallMat, wallW/2, wallHeight/2, 0);

    // Banners
    const createBannerText = (text: string, color: string) => {
      const t = new Text();
      t.text = text;
      t.fontSize = 1.0;
      t.color = color;
      t.anchorX = 'center';
      t.anchorY = 'middle';
      t.font = 'https://fonts.gstatic.com/s/roboto/v27/KFOmCnqEu92Fr1Me5WZLCzYlKw.ttf'; // Roboto
      t.sync();
      return t;
    };

    const textLeft = createBannerText('DOLPHINS', '#' + M.dolphinsShirt.color.getHexString());
    const textMiddle = createBannerText('PIXEL FOOTBALL', '#94a3b8');
    const textRight = createBannerText('49ERS', '#' + M.ninersShirt.color.getHexString());

    for (let x = -24; x <= 24; x += 24) {
      const bannerText = x === -24 ? textLeft : (x === 0 ? textMiddle : textRight);
      
      const b1 = bannerText.clone();
      (b1 as any).blinkOffset = Math.random() * 1000;
      b1.position.set(x, wallHeight/2, -wallD/2 + 0.51);
      stadiumGroup.add(b1);
      bannerTexts.push(b1);
      
      const b2 = bannerText.clone();
      (b2 as any).blinkOffset = Math.random() * 1000;
      b2.position.set(x, wallHeight/2, wallD/2 - 0.51);
      b2.rotation.y = Math.PI;
      stadiumGroup.add(b2);
      bannerTexts.push(b2);
    }

    // Add banners to side walls
    for (let z = -wallD/4; z <= wallD/4; z += 12) {
      const bLeft = textMiddle.clone();
      (bLeft as any).blinkOffset = Math.random() * 1000;
      bLeft.position.set(-wallW/2 + 0.51, wallHeight/2, z);
      bLeft.rotation.y = Math.PI / 2;
      stadiumGroup.add(bLeft);
      bannerTexts.push(bLeft);

      const bRight = textMiddle.clone();
      (bRight as any).blinkOffset = Math.random() * 1000;
      bRight.position.set(wallW/2 - 0.51, wallHeight/2, z);
      bRight.rotation.y = -Math.PI / 2;
      stadiumGroup.add(bRight);
      bannerTexts.push(bRight);
    }

    // Crowd Blocks - Using Home Team (Dolphins) Palette
    const dolphinsCrowdColors = [
      0x008e97, // Dolphins Aqua
      0xfc4c02, // Dolphins Orange
      0xffffff, // White
      0x00a2ae, // Lighter Aqua
      0xff6a33  // Lighter Orange
    ];
    const ninersCrowdColors = [
      0xaa0000, // Niners Red
      0xc7a74b, // Niners Gold
      0xffffff, // White
      0xcc0000, // Lighter Red
      0xd4b45a  // Lighter Gold
    ];
    const blockGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
    const crowdMaterial = new THREE.MeshStandardMaterial({ roughness: 0.8 });

    // Pre-calculate total crowd count
    let totalCrowdCount = 0;
    const spawnConfigs: any[] = [];
    
    const prepareSpawn = (w: number, d: number, x: number, y: number, z: number, colors: number[], team: string) => {
      const count = Math.floor((w * d) / 0.6) * 2; // *2 for layers
      totalCrowdCount += count;
      spawnConfigs.push({ w, d, x, y, z, colors, count: count / 2, team });
    };

    const tierCount = 3;
    const tierH = 5;
    const tierD = 12;
    const tierStep = 4;

    for (let i = 0; i < tierCount; i++) {
      const y = wallHeight + i * tierH;
      const dOff = i * tierStep;
      const currentW = wallW + dOff * 2 + 15;
      const currentD = wallD + dOff * 2 + 15;
      
      // Stands (Base structure)
      const standMat = new THREE.MeshStandardMaterial({ color: 0x1a2b4a });
      addSBox(currentW, 0.2, tierD, standMat, 0, y, -wallD/2 - tierD/2 - dOff);
      addSBox(currentW, 0.2, tierD, standMat, 0, y, wallD/2 + tierD/2 + dOff);
      addSBox(tierD, 0.2, currentD, standMat, -wallW/2 - tierD/2 - dOff, y, 0);
      addSBox(tierD, 0.2, currentD, standMat, wallW/2 + tierD/2 + dOff, y, 0);

      // Dolphins side (X < 0)
      prepareSpawn(currentW/2, tierD, -currentW/4, y, -wallD/2 - tierD/2 - dOff, dolphinsCrowdColors, 'dolphins');
      prepareSpawn(currentW/2, tierD, -currentW/4, y, wallD/2 + tierD/2 + dOff, dolphinsCrowdColors, 'dolphins');
      prepareSpawn(tierD, currentD, -wallW/2 - tierD/2 - dOff, y, 0, dolphinsCrowdColors, 'dolphins');
      
      // Niners side (X > 0)
      prepareSpawn(currentW/2, tierD, currentW/4, y, -wallD/2 - tierD/2 - dOff, ninersCrowdColors, 'niners');
      prepareSpawn(currentW/2, tierD, currentW/4, y, wallD/2 + tierD/2 + dOff, ninersCrowdColors, 'niners');
      prepareSpawn(tierD, currentD, wallW/2 + tierD/2 + dOff, y, 0, ninersCrowdColors, 'niners');
      
      // Structure back
      addSBox(currentW, tierH, 0.5, standMat, 0, y + tierH/2, -wallD/2 - tierD - dOff - 0.25);
      addSBox(currentW, tierH, 0.5, standMat, 0, y + tierH/2, wallD/2 + tierD + dOff + 0.25);
    }

    crowdMesh = new THREE.InstancedMesh(blockGeo, crowdMaterial, totalCrowdCount);
    crowdMesh.castShadow = true;
    crowdMesh.receiveShadow = true;
    stadiumGroup.add(crowdMesh);

    let instanceIndex = 0;
    const dummy = new THREE.Object3D();

    spawnConfigs.forEach(config => {
      const { w, d, x, y, z, colors, count, team } = config;
      for (let i = 0; i < count; i++) {
        const bx = x + (Math.random() - 0.5) * w;
        const bz = z + (Math.random() - 0.5) * d;
        
        for (let layer = 0; layer < 2; layer++) {
          const by = y + 0.2 + (layer * 0.4);
          
          dummy.position.set(bx, by, bz);
          dummy.updateMatrix();
          crowdMesh.setMatrixAt(instanceIndex, dummy.matrix);
          
          const color = new THREE.Color(colors[Math.floor(Math.random() * colors.length)]);
          crowdMesh.setColorAt(instanceIndex, color);
          
          crowdBlocks.push({
            instanceIndex,
            baseX: bx,
            baseY: by,
            baseZ: bz,
            team,
            phase: Math.random() * Math.PI * 2,
            speed: 2 + Math.random() * 4,
            jumpHeight: 0.2 + Math.random() * 0.4,
            vibeScale: 0.02 + Math.random() * 0.03
          });
          instanceIndex++;
        }
      }
    });
    crowdMesh.instanceMatrix.needsUpdate = true;
    if (crowdMesh.instanceColor) crowdMesh.instanceColor.needsUpdate = true;

    // Filter visible blocks for word balloons
    visibleCrowdBlocks.length = 0;
    crowdBlocks.forEach(b => {
      if (Math.abs(b.baseX) < 45 && Math.abs(b.baseZ) < 45) {
        visibleCrowdBlocks.push(b);
      }
    });

    // Floodlights & Flags
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
    const lightMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, emissive: 0xffffff, emissiveIntensity: 0.8 });
    const flagColors = [0xff4e00, 0x3d5a8c, 0xffcc00];

    const corners = [
      {x: -wallW/2 - 2, z: -wallD/2 - 2},
      {x: wallW/2 + 2, z: -wallD/2 - 2},
      {x: -wallW/2 - 2, z: wallD/2 + 2},
      {x: wallW/2 + 2, z: wallD/2 + 2}
    ];

    corners.forEach((c, idx) => {
      // Pole
      // addSBox(0.4, 24, 0.4, poleMat, c.x, 12, c.z);
      // Light array
      // addSBox(4, 3, 1, lightMat, c.x, 22, c.z);
      // Flag
      const fMat = new THREE.MeshStandardMaterial({ color: flagColors[idx % flagColors.length] });
      const flag = new THREE.Mesh(new THREE.BoxGeometry(3, 1.5, 0.1), fMat);
      flag.position.set(c.x + 1.5, 20, c.z);
      stadiumGroup.add(flag);
    });
  }

  createStadium();

  const dolphinsEndZoneLabel = makeEndZoneLabelSprite('DOLPHINS', '#f3f6ff');
  dolphinsEndZoneLabel.position.x = -FIELD_W / 2 + EZONE_W / 2;
  dolphinsEndZoneLabel.rotation.z = Math.PI / 2;
  scene.add(dolphinsEndZoneLabel);

  const ninersEndZoneLabel = makeEndZoneLabelSprite('49ERS', '#fff4e0');
  ninersEndZoneLabel.position.x = FIELD_W / 2 - EZONE_W / 2;
  ninersEndZoneLabel.rotation.z = -Math.PI / 2;
  scene.add(ninersEndZoneLabel);

  const losMarker = addBox(0.12, 0.36, FIELD_D, new THREE.MeshLambertMaterial({ color: 0xff7a1a }), -8.2, 0, 0);
  const firstDownMarker = addBox(0.12, 0.36, FIELD_D, new THREE.MeshLambertMaterial({ color: 0xffde2b }), -8.2 + 10 * UNITS_PER_YARD, 0, 0);

  function createFirstDownSidelineFlag(zEdge: number, pennantDirection: number = 1) {
    const group = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.096, 2.16, 0.096), new THREE.MeshLambertMaterial({ color: 0xf0edd0 }));
    pole.position.set(0, 1.08, zEdge);
    pole.castShadow = true;
    pole.receiveShadow = true;
    group.add(pole);
    const pennant = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.58, 0.084), new THREE.MeshLambertMaterial({ color: 0xdc2626 }));
    const pennantBaseX = 0.5;
    const pennantBaseY = 1.8;
    const pennantBaseZ = zEdge - 0.144 * pennantDirection;
    pennant.position.set(pennantBaseX, pennantBaseY, pennantBaseZ);
    pennant.castShadow = true;
    pennant.receiveShadow = true;
    group.add(pennant);
    const pennantTip = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.34, 0.084), new THREE.MeshLambertMaterial({ color: 0x9f1239 }));
    const pennantTipBaseX = 1.03;
    const pennantTipBaseY = 1.8;
    const pennantTipBaseZ = zEdge - 0.144 * pennantDirection;
    pennantTip.position.set(pennantTipBaseX, pennantTipBaseY, pennantTipBaseZ);
    pennantTip.castShadow = true;
    pennantTip.receiveShadow = true;
    group.add(pennantTip);
    const downCanvas = document.createElement('canvas');
    downCanvas.width = 128;
    downCanvas.height = 128;
    const downTexture = new THREE.CanvasTexture(downCanvas);
    const downLabel = new THREE.Sprite(new THREE.SpriteMaterial({ map: downTexture, transparent: true, depthWrite: false }));
    downLabel.scale.set(0.36, 0.36, 0.36);
    downLabel.position.set(pennantBaseX + 0.08, pennantBaseY, pennantBaseZ + 0.07 * pennantDirection);
    group.add(downLabel);
    group.userData = { pennant, pennantTip, pennantDirection, pennantBaseX, pennantBaseY, pennantBaseZ, pennantTipBaseX, pennantTipBaseY, pennantTipBaseZ, downCanvas, downTexture, downLabel };
    scene.add(group);
    return group;
  }

  const firstDownFlagNorth = createFirstDownSidelineFlag(-FIELD_D / 2, -1);
  const firstDownFlagSouth = createFirstDownSidelineFlag(FIELD_D / 2, 1);

  function setFirstDownFlagDown(flag: THREE.Group, down: number) {
    const data = flag.userData;
    if (!data?.downCanvas || !data?.downTexture) return;
    const ctx = data.downCanvas.getContext('2d');
    ctx.clearRect(0, 0, data.downCanvas.width, data.downCanvas.height);
    ctx.strokeStyle = '#320909';
    ctx.lineWidth = 8;
    ctx.font = 'bold 92px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const downText = `${THREE.MathUtils.clamp(Math.floor(down), 1, 4)}`;
    ctx.strokeText(downText, data.downCanvas.width / 2, data.downCanvas.height / 2 + 4);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(downText, data.downCanvas.width / 2, data.downCanvas.height / 2 + 4);
    data.downTexture.needsUpdate = true;
  }

  function animateFirstDownFlags(elapsed: number) {
    const flags = [firstDownFlagNorth, firstDownFlagSouth];
    for (const flag of flags) {
      const data = flag.userData;
      if (!data?.pennant || !data?.pennantTip) continue;
      const phaseOffset = data.pennantDirection > 0 ? 0 : Math.PI * 0.55;
      const wave = Math.sin(elapsed * 3.8 + phaseOffset);
      const flutter = Math.sin(elapsed * 9.7 + phaseOffset * 0.7);
      data.pennant.rotation.y = 0.12 * wave;
      data.pennant.rotation.z = 0.05 * flutter;
      data.pennant.position.x = data.pennantBaseX + 0.018 * wave;
      data.pennant.position.y = data.pennantBaseY + 0.014 * flutter;
      data.pennant.position.z = data.pennantBaseZ + 0.014 * data.pennantDirection * wave;
      data.pennantTip.rotation.y = 0.24 * wave;
      data.pennantTip.rotation.z = 0.09 * flutter;
      data.pennantTip.position.x = data.pennantTipBaseX + 0.04 * wave;
      data.pennantTip.position.y = data.pennantTipBaseY + 0.028 * flutter;
      data.pennantTip.position.z = data.pennantTipBaseZ + 0.03 * data.pennantDirection * wave
      if (data.downLabel) {
        data.downLabel.position.x = data.pennant.position.x + 0.08;
        data.downLabel.position.y = data.pennant.position.y + 0.01;
        data.downLabel.position.z = data.pennant.position.z + 0.07 * data.pennantDirection;
      }
    }
  }

  function makeNumberSprite(label: string) {
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, 64, 64);
    ctx.fillStyle = '#f0edd0';
    ctx.font = 'bold 38px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 32, 34);
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.8), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.21;
    return mesh;
  }

  const yardLabels: any[] = [];
  for (let i = 1; i <= 4; i += 1) yardLabels.push({ x: -FIELD_OF_PLAY_W / 2 + TEN_YARDS_UNITS * i, label: `${i * 10}` });
  yardLabels.push({ x: 0, label: '50' });
  for (let i = 1; i <= 4; i += 1) yardLabels.push({ x: TEN_YARDS_UNITS * i, label: `${50 - i * 10}` });
  for (const { x, label } of yardLabels) {
    const s = makeNumberSprite(label); s.position.x = x; s.position.z = 7; scene.add(s);
    const s2 = makeNumberSprite(label); s2.position.x = x; s2.position.z = -7; scene.add(s2);
  }

  function addGoalPost(baseX: number, direction: number) {
    const stemHeight = 3.2; const crossbarHeight = 2.9; const uprightHeight = 3.9; const crossbarWidth = 7.0; const beamThickness = 0.3; const armOffset = 0.55; const postX = baseX + direction * armOffset;
    addBox(beamThickness, stemHeight, beamThickness, M.goalPost, baseX, stemHeight / 2 + 0.15, 0);
    addBox(armOffset, beamThickness, beamThickness, M.goalPost, baseX + direction * armOffset / 2, crossbarHeight, 0);
    addBox(beamThickness, beamThickness, crossbarWidth, M.goalPost, postX, crossbarHeight, 0);
    addBox(beamThickness, uprightHeight, beamThickness, M.goalPost, postX, crossbarHeight + uprightHeight / 2, -crossbarWidth / 2);
    addBox(beamThickness, uprightHeight, beamThickness, M.goalPost, postX, crossbarHeight + uprightHeight / 2, crossbarWidth / 2);
  }
  addGoalPost(-FIELD_W / 2 - GOALPOST_OFFSET, 1);
  addGoalPost(FIELD_W / 2 + GOALPOST_OFFSET, -1);



  const PLAYER_MASK = [
    ['00000000001111110000','00000000001110000000','00000111111111110000','00011111111110000000','00011100111110000000','00011100111111111111','00000000000000000000','00000000111110000000','00000000111110000000','00000111111111111111','00000111100000000111','00011111100000011100','00011100000000011100','01111100000000000000','01110000000000000000','01110000000000000000'],
  ];


  const players: any[] = [];
  function addPlayer(x: number, z: number, team: 'A' | 'B', role: string, name: string = 'Player') {
    const palette = team === 'A' ? teamAUniforms[teamAUniformIndex].palette : teamBUniforms[teamBUniformIndex].palette;
    const group = new THREE.Group();
    // Set group at field level (y=0.15).
    group.position.set(x, 0.15, z);
    const spriteGroup = new THREE.Group();
    spriteGroup.position.y = 0.864;
    group.add(spriteGroup);
    const runFrames = PLAYER_PATTERNS.map(p => buildPlayerFrame(p, palette));
    const idleFrames = PLAYER_IDLE_PATTERNS.map(p => buildPlayerFrame(p, palette));
    runFrames.forEach(f => { f.visible = false; spriteGroup.add(f); });
    idleFrames.forEach(f => { f.visible = false; spriteGroup.add(f); });
    
    group.castShadow = true;
    group.receiveShadow = true;
    group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    const markerGeo = new THREE.TorusGeometry(1.2, 0.12, 8, 32);
    const markerMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.9 });
    const marker = new THREE.Mesh(markerGeo, markerMat);
    marker.rotation.x = -Math.PI / 2;
    // Marker at field level.
    marker.position.y = 0.01;
    marker.visible = false;
    group.add(marker);

    const glowGeo = new THREE.SphereGeometry(0.75, 16, 16);
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.5 });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    // Glow at player center height.
    glow.position.y = 0.864;
    glow.visible = false;
    group.add(glow);

    const player = {
      mesh: group,
      spriteGroup,
      runFrames,
      idleFrames,
      glow,
      team,
      role,
      name,
      state: 'IDLE',
      frame: 0,
      animTimer: 0,
      vel: new THREE.Vector3(),
      pos: new THREE.Vector3(x, 0.15, z),
      dir: team === 'A' ? 1 : -1,
      targetPos: new THREE.Vector3(x, 0.15, z),
      selectionMarker: marker,
      breathOffset: Math.random() * Math.PI * 2,
      tackleCooldown: 0,
      burstTimer: 0,
      burstCooldown: 0,
      stats: {
        // Physical
        speed: name === 'Tyreek Hill' ? 0.3 : (['WR', 'CB', 'FS', 'SS'].includes(role) ? 0.18 : (['RB', 'LB'].includes(role) ? 0.16 : 0.14)),
        acceleration: ['WR', 'CB', 'RB'].includes(role) ? 0.9 : (['LB', 'FS', 'SS'].includes(role) ? 0.7 : 0.5),
        agility: ['WR', 'CB'].includes(role) ? 1.2 : 1.0,
        strength: ['OL', 'DL'].includes(role) ? 0.9 : (['TE', 'LB'].includes(role) ? 0.7 : 0.4),
        jumping: ['WR', 'CB', 'FS', 'SS'].includes(role) ? 0.8 : (['TE', 'LB'].includes(role) ? 0.6 : 0.3),
        stamina: 0.8,
        
        // Offense
        catching: ['WR', 'TE'].includes(role) ? 0.9 : (['RB', 'CB', 'FS', 'SS'].includes(role) ? 0.6 : 0.2),
        routeRunning: ['WR'].includes(role) ? 0.9 : (['TE', 'RB'].includes(role) ? 0.7 : 0.2),
        blocking: ['OL'].includes(role) ? 0.9 : (['TE', 'FB'].includes(role) ? 0.7 : 0.2),
        carrying: ['RB', 'FB'].includes(role) ? 0.9 : (['WR', 'TE', 'QB'].includes(role) ? 0.7 : 0.4),
        throwPower: role === 'QB' ? 0.9 : 0.2,
        accuracy: role === 'QB' ? 0.88 : 0.2,
        
        // Defense
        tackle: role === 'LB' ? 0.8 : (role === 'DL' ? 0.7 : (['CB', 'FS', 'SS'].includes(role) ? 0.6 : 0.3)),
        breakTackle: ['RB', 'FB'].includes(role) ? 0.7 : (role === 'TE' ? 0.6 : (role === 'WR' ? 0.4 : 0.2)),
        coverage: ['CB', 'FS', 'SS'].includes(role) ? 0.9 : (role === 'LB' ? 0.6 : 0.2),
        blockShedding: ['DL', 'LB'].includes(role) ? 0.8 : (['FS', 'SS'].includes(role) ? 0.5 : 0.2),
        awareness: ['QB', 'LB', 'FS'].includes(role) ? 0.9 : 0.6
      }
    };
    players.push(player);
    scene.add(group);
    return player;
  }

  const offenseTeam: any[] = [];
  const defenseTeam: any[] = [];

  function getEligibleReceivers() {
    return offenseTeam.filter(p => ['WR', 'TE', 'RB', 'FB'].includes(p.role));
  }

  function setupFormation() {
    gameState.selectedReceiverIndex = 0;
    players.forEach(p => {
      scene.remove(p.mesh);
      p.mesh.traverse((child: any) => {
        if (child.isMesh) {
          if (child.geometry) child.geometry.dispose();
          if (child.material && child.material.type === 'MeshBasicMaterial') {
            child.material.dispose();
          }
        }
      });
    });
    players.length = 0;
    offenseTeam.length = 0;
    defenseTeam.length = 0;

    const los = gameState.ballPos.x;
    const offTeam = gameState.offensiveTeam;
    const defTeam = offTeam === 'A' ? 'B' : 'A';
    const offPlay = PASS_PLAYBOOK[gameState.selectedOffensePlay as keyof typeof PASS_PLAYBOOK];
    const offFormKey = offPlay ? offPlay.formation : 'shotgun';
    const offForm = OFFENSE_FORMATIONS[offFormKey as keyof typeof OFFENSE_FORMATIONS] || OFFENSE_FORMATIONS.shotgun;

    const defPlay = DEFENSE_PLAYBOOK[gameState.selectedDefensePlay as keyof typeof DEFENSE_PLAYBOOK];
    const defFormKey = defPlay ? defPlay.formation : 'base-43';
    const defForm = DEFENSE_FORMATIONS[defFormKey as keyof typeof DEFENSE_FORMATIONS] || DEFENSE_FORMATIONS['base-43'];

    // Offense
    const qb = addPlayer(los + offForm.qb.x, offForm.qb.z, offTeam, 'QB', offTeam === 'A' ? 'Tua Tagovailoa' : 'Brock Purdy');
    offenseTeam.push(qb);
    offForm.linemen.forEach((l: any) => {
      let name = 'Player';
      if (offTeam === 'A' && l.role === 'OL') name = 'Terron Armstead';
      offenseTeam.push(addPlayer(los + l.x, l.z, offTeam, l.role, name));
    });
    let wrCount = 0;
    for (let i = 0; i < offForm.receivers.length; i++) {
      const r = offForm.receivers[i];
      let name = 'Player';
      if (offTeam === 'A') {
        if (r.role === 'WR') {
          const wrNames = ['Tyreek Hill', 'Jaylen Waddle', 'Odell Beckham Jr.', 'Malik Washington'];
          name = wrNames[wrCount % wrNames.length];
          wrCount++;
        }
        else if (r.role === 'TE') name = 'Jonnu Smith';
      } else {
        if (r.role === 'WR') {
          const wrNames = ['Deebo Samuel', 'Brandon Aiyuk', 'Jauan Jennings', 'Ricky Pearsall'];
          name = wrNames[wrCount % wrNames.length];
          wrCount++;
        }
        else if (r.role === 'TE') name = 'George Kittle';
      }
      offenseTeam.push(addPlayer(los + r.x, r.z, offTeam, r.role, name));
    }
    offForm.backs.forEach((b: any) => offenseTeam.push(addPlayer(los + b.x, b.z, offTeam, b.role, b.role === 'RB' ? (offTeam === 'A' ? 'De\'Von Achane' : 'Christian McCaffrey') : 'Player')));

    // Defense
    defForm.linemen.forEach((l: any) => defenseTeam.push(addPlayer(los + l.x, l.z, defTeam, l.role, l.role === 'DL' ? (defTeam === 'B' ? 'Nick Bosa' : 'Calais Campbell') : 'Player')));
    defForm.linebackers.forEach((lb: any) => defenseTeam.push(addPlayer(los + lb.x, lb.z, defTeam, lb.role, lb.role === 'LB' ? (defTeam === 'B' ? 'Fred Warner' : 'Jordyn Brooks') : 'Player')));
    defForm.secondary.forEach((s: any) => defenseTeam.push(addPlayer(los + s.x, s.z, defTeam, s.role, s.role === 'CB' ? (defTeam === 'B' ? 'Charvarius Ward' : 'Jalen Ramsey') : 'Player')));

    updateFieldRoutes();
  }

  const routeVisuals = new THREE.Group();
  scene.add(routeVisuals);

  const ballGroup = new THREE.Group();
  const ballMesh = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), new THREE.MeshStandardMaterial({ map: ballTex, roughness: 0.6, metalness: 0.1 }));
  ballMesh.scale.set(1.4, 1, 1);
  ballMesh.castShadow = true;
  ballGroup.add(ballMesh);
  const lace = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.03, 0.03), M.white);
  lace.position.y = 0.17;
  ballGroup.add(lace);
  scene.add(ballGroup);

  const trajectoryIndicator = new THREE.Group();
  scene.add(trajectoryIndicator);
  trajectoryIndicator.visible = false;

  const MAX_TRAIL_POINTS = 30;
  const ballTrailPositions: THREE.Vector3[] = [];
  for (let i = 0; i < MAX_TRAIL_POINTS; i++) ballTrailPositions.push(new THREE.Vector3());
  
  const ballTrailGeo = new THREE.BufferGeometry().setFromPoints(ballTrailPositions);
  const ballTrailMat = new THREE.LineBasicMaterial({ 
    color: 0xffffff, 
    transparent: true, 
    opacity: 0.6,
    linewidth: 2
  });
  const ballTrailLine = new THREE.Line(ballTrailGeo, ballTrailMat);
  scene.add(ballTrailLine);
  ballTrailLine.visible = false;
  
  let trailPointCount = 0;
  let trailTimer = 0;

  const chargeLineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const chargeLineMat = new THREE.LineBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.8 });
  const chargeLine = new THREE.Line(chargeLineGeo, chargeLineMat);
  scene.add(chargeLine);
  chargeLine.visible = false;

  const chargeCircleGeo = new THREE.TorusGeometry(1.2, 0.1, 8, 32);
  const chargeCircleMat = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.8 });
  const chargeCircle = new THREE.Mesh(chargeCircleGeo, chargeCircleMat);
  chargeCircle.rotation.x = -Math.PI / 2;
  scene.add(chargeCircle);
  chargeCircle.visible = false;

  function calculatePassingAccuracy(qb: any, target: any) {
    if (!qb || !target) return 0;
    let accuracy = qb.stats.accuracy;
    const qbSpeed = qb.vel.length();
    accuracy -= qbSpeed * 0.15;
    const dist = qb.pos.distanceTo(target.pos);
    accuracy -= (dist / 120);
    defenseTeam.forEach(d => {
      const distToQB = d.pos.distanceTo(qb.pos);
      if (distToQB < 4.0) accuracy -= (4.0 - distToQB) * 0.08;
      const distToTarget = d.pos.distanceTo(target.pos);
      if (distToTarget < 5.0) accuracy -= (5.0 - distToTarget) * 0.04;
    });
    return Math.max(0.05, accuracy);
  }

  function calculateLeadPosition(qbPos: THREE.Vector3, receiver: any, speedH: number = 18) {
    if (!receiver) return new THREE.Vector3();
    const dist0 = qbPos.distanceTo(receiver.pos);
    const time0 = dist0 / speedH;
    const leadPos = receiver.pos.clone().addScaledVector(receiver.vel, time0);
    const dist1 = qbPos.distanceTo(leadPos);
    const time1 = dist1 / speedH;
    return receiver.pos.clone().addScaledVector(receiver.vel, time1);
  }

  const ROUTE_COLORS = ['#ffeb3b', '#00bcd4', '#e91e63', '#ff9800', '#cddc39'];

  setupFormation();

  function updateFieldRoutes() {
    while (routeVisuals.children.length > 0) {
      const child = routeVisuals.children[0] as any;
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
      routeVisuals.remove(child);
    }

    if (gameState.isLive) return;

    const play = (PASS_PLAYBOOK as any)[gameState.selectedOffensePlay];
    if (!play) return;

    const los = gameState.ballPos.x;
    const offForm = (OFFENSE_FORMATIONS as any)[play.formation];
    if (!offForm) return;

    play.routes.forEach((route: any, routeIdx: number) => {
      let receiverForm = null;
      const roleList = (route.role === 'RB' || route.role === 'FB') ? offForm.backs : offForm.receivers;
      
      // Find the Nth player with this role in the formation list
      let roleMatchCount = 0;
      for (const item of roleList) {
        if (item.role === route.role) {
          if (roleMatchCount === route.index) {
            receiverForm = item;
            break;
          }
          roleMatchCount++;
        }
      }
      
      if (!receiverForm) return;

      const color = new THREE.Color(ROUTE_COLORS[routeIdx % ROUTE_COLORS.length]);

      const points = [];
      // Start slightly above the player's feet
      points.push(new THREE.Vector3(los + receiverForm.x, 0.3, receiverForm.z));
      route.points.forEach((p: any) => {
        points.push(new THREE.Vector3(los + p.x, 0.3, p.z));
      });

      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({ color: color, transparent: true, opacity: 0.7 });
      const line = new THREE.Line(geometry, material);
      routeVisuals.add(line);

      const endPoint = points[points.length - 1];
      const arrowGeo = new THREE.ConeGeometry(0.2, 0.5, 8);
      const arrowMat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.7 });
      const arrow = new THREE.Mesh(arrowGeo, arrowMat);
      
      if (points.length > 1) {
        const lastDir = new THREE.Vector3().subVectors(points[points.length - 1], points[points.length - 2]).normalize();
        arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), lastDir);
      }
      
      arrow.position.copy(endPoint);
      routeVisuals.add(arrow);
    });
  }

  const playUIUpdates: (() => void)[] = [];

  function randomizePlays() {
    const offKeys = Object.keys(PASS_PLAYBOOK).filter(k => k !== 'kickoff');
    const defKeys = Object.keys(DEFENSE_PLAYBOOK).filter(k => k !== 'kickoff-return');
    gameState.selectedOffensePlay = offKeys[Math.floor(Math.random() * offKeys.length)];
    gameState.selectedDefensePlay = defKeys[Math.floor(Math.random() * defKeys.length)];
    gameState.isKickoff = false;
    playUIUpdates.forEach(u => u());
    setupFormation();
  }

  function resetBall(shouldRandomize = true) {
    gameState.isLive = false;
    gameState.isResetting = false;
    isPlaybookVisible = true;
    playbookBar.style.display = 'flex';
    playbookHint.style.display = 'none';
    if (shouldRandomize) {
      gameState.isKickoff = false;
      gameState.kickoffState = 'NONE';
    }
    ballState.isFlying = false;
    ballState.heldBy = null; // Ball starts on the ground
    ballState.lastHeldBy = null;
    ballState.vel.set(0, 0, 0);
    ballState.pos.set(gameState.ballPos.x, 0.15, 0);
    trailPointCount = 0;
    ballTrailLine.visible = false;
    
    // Randomize plays on reset
    if (shouldRandomize) randomizePlays();
  }
  resetBall();

  function buildActiveRoutes() {
    const play = PASS_PLAYBOOK[gameState.selectedOffensePlay as keyof typeof PASS_PLAYBOOK];
    if (!play) return [];
    const los = gameState.ballPos.x;
    return play.routes.map(r => {
      const playersWithRole = offenseTeam.filter(p => p.role === r.role);
      const player = playersWithRole[r.index || 0];
      return {
        player,
        waypoints: r.points.map(p => new THREE.Vector3(los + p.x, 0.15, p.z)),
        currentIndex: 0
      };
    });
  }

  function buildDefenseAssignments() {
    const play = DEFENSE_PLAYBOOK[gameState.selectedDefensePlay as keyof typeof DEFENSE_PLAYBOOK];
    if (!play) return [];
    const los = gameState.ballPos.x;
    return defenseTeam.map((p, i) => {
      const assignment: any = play.assignments[i];
      if (!assignment) return { type: 'rush' };
      if (assignment.type === 'zone') {
        return { type: 'zone', target: new THREE.Vector3(los + assignment.x!, 0.15, assignment.z!) };
      }
      if (assignment.type === 'man') {
        const receivers = getEligibleReceivers();
        const targetReceiver = receivers[assignment.receiverIndex!];
        return { type: 'man', targetReceiver };
      }
      return { type: 'rush' };
    });
  }

  function renderPlayDiagram(offPlay: any, defPlay: any) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    // Use yards directly for coordinates: -8 to 32 yards wide, -15 to 15 yards deep
    svg.setAttribute('viewBox', '-8 -15 40 30');
    svg.style.width = '100%';
    svg.style.height = '100%';
    svg.style.display = 'block';
    svg.style.backgroundColor = '#0f172a'; // Dark background for the container

    // Define Arrowhead
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    marker.setAttribute('id', 'arrowhead');
    marker.setAttribute('markerWidth', '6');
    marker.setAttribute('markerHeight', '6');
    marker.setAttribute('refX', '5');
    marker.setAttribute('refY', '3');
    marker.setAttribute('orient', 'auto');
    const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    polygon.setAttribute('points', '0 0, 6 3, 0 6');
    polygon.setAttribute('fill', 'context-stroke');
    marker.appendChild(polygon);
    defs.appendChild(marker);
    svg.appendChild(defs);

    // Field background
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('x', '-8');
    bg.setAttribute('y', '-15');
    bg.setAttribute('width', '40');
    bg.setAttribute('height', '30');
    bg.setAttribute('fill', '#143d14'); // Dark grass green
    svg.appendChild(bg);

    // Yard lines (every 5 yards)
    for (let yard = -5; yard <= 30; yard += 5) {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', String(yard));
      line.setAttribute('y1', '-15');
      line.setAttribute('x2', String(yard));
      line.setAttribute('y2', '15');
      line.setAttribute('stroke', yard === 0 ? '#fbbf24' : 'rgba(255,255,255,0.15)');
      line.setAttribute('stroke-width', yard === 0 ? '0.4' : '0.1');
      svg.appendChild(line);

      // Yard Numbers at the top
      if (yard >= 0 && yard % 10 === 0) {
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', String(yard));
        text.setAttribute('y', '-12');
        text.setAttribute('fill', 'rgba(255,255,255,0.5)');
        text.setAttribute('font-size', '2');
        text.setAttribute('font-family', 'monospace');
        text.setAttribute('text-anchor', 'middle');
        text.textContent = String(yard);
        svg.appendChild(text);
      }
    }

    // Horizontal grid lines
    for (let z = -12; z <= 12; z += 4) {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', '-8');
      line.setAttribute('y1', String(z));
      line.setAttribute('x2', '32');
      line.setAttribute('y2', String(z));
      line.setAttribute('stroke', 'rgba(255,255,255,0.05)');
      line.setAttribute('stroke-width', '0.1');
      svg.appendChild(line);
    }

    const drawPlayer = (x: number, z: number, role: string, color: string, isDef: boolean = false) => {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', String(x));
      text.setAttribute('y', String(z + 0.6)); // Adjusted for vertical alignment
      text.setAttribute('fill', color);
      text.setAttribute('font-size', '2.5');
      text.setAttribute('font-family', 'monospace');
      text.setAttribute('font-weight', 'bold');
      text.setAttribute('text-anchor', 'middle');
      
      text.textContent = isDef ? 'X' : 'O';
      g.appendChild(text);

      svg.appendChild(g);
    };

    if (offPlay) {
      const form = OFFENSE_FORMATIONS[offPlay.formation as keyof typeof OFFENSE_FORMATIONS];
      if (!form) return svg;

      // Draw QB
      drawPlayer(form.qb.x, form.qb.z, 'QB', '#3b82f6');

      // Draw Linemen
      form.linemen.forEach(l => drawPlayer(l.x, l.z, l.role, '#3b82f6'));

      // Draw Backs
      (form.backs || []).forEach(b => drawPlayer(b.x, b.z, b.role, '#3b82f6'));

      // Draw Receivers and Routes
      offPlay.routes.forEach((route: any, routeIdx: number) => {
        const color = ROUTE_COLORS[routeIdx % ROUTE_COLORS.length];
        
        let receiverPos = { x: 0, z: 0 };
        const roleList = (route.role === 'RB' || route.role === 'FB') ? form.backs : form.receivers;
        let roleMatchCount = 0;
        for (const item of roleList) {
          if (item.role === route.role) {
            if (roleMatchCount === route.index) {
              receiverPos = item;
              break;
            }
            roleMatchCount++;
          }
        }

        drawPlayer(receiverPos.x, receiverPos.z, route.role, '#3b82f6');

        let prevX = receiverPos.x;
        let prevZ = receiverPos.z;
        route.points.forEach((p: any) => {
          const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          line.setAttribute('x1', String(prevX));
          line.setAttribute('y1', String(prevZ));
          line.setAttribute('x2', String(p.x));
          line.setAttribute('y2', String(p.z));
          line.setAttribute('stroke', color);
          line.setAttribute('stroke-width', '0.4');
          line.setAttribute('marker-end', 'url(#arrowhead)');
          svg.appendChild(line);
          prevX = p.x;
          prevZ = p.z;
        });
      });
    }
    if (defPlay) {
      const form = DEFENSE_FORMATIONS[defPlay.formation as keyof typeof DEFENSE_FORMATIONS];
      if (!form) return svg;

      form.linemen.forEach(l => drawPlayer(l.x, l.z, l.role, '#ef4444', true));
      form.linebackers.forEach(lb => drawPlayer(lb.x, lb.z, lb.role, '#ef4444', true));
      form.secondary.forEach(s => drawPlayer(s.x, s.z, s.role, '#ef4444', true));

      // Draw Assignments
      defPlay.assignments.forEach((a: any, i: number) => {
        const allDef = [...form.linemen, ...form.linebackers, ...form.secondary];
        const defPos = allDef[i] || { x: 0, z: 0 };

        if (a.type === 'zone') {
          const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          c.setAttribute('cx', String(a.x));
          c.setAttribute('cy', String(a.z));
          c.setAttribute('r', '3');
          c.setAttribute('fill', 'rgba(34,197,94,0.1)');
          c.setAttribute('stroke', '#22c55e');
          c.setAttribute('stroke-width', '0.2');
          c.setAttribute('stroke-dasharray', '0.5,0.5');
          svg.appendChild(c);
        } else if (a.type === 'man') {
          const offFormKey = offPlay ? offPlay.formation : 'shotgun';
          const offForm = OFFENSE_FORMATIONS[offFormKey as keyof typeof OFFENSE_FORMATIONS] || OFFENSE_FORMATIONS.shotgun;
          const eligibleReceivers = [...offForm.receivers, ...(offForm.backs || [])];
          const targetWR = eligibleReceivers[a.receiverIndex];
          
          if (targetWR) {
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', String(defPos.x));
            line.setAttribute('y1', String(defPos.z));
            line.setAttribute('x2', String(targetWR.x));
            line.setAttribute('y2', String(targetWR.z));
            line.setAttribute('stroke', '#ef4444');
            line.setAttribute('stroke-width', '0.3');
            line.setAttribute('stroke-dasharray', '0.5,0.5');
            svg.appendChild(line);
          }
        } else if (a.type === 'rush') {
          const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          line.setAttribute('x1', String(defPos.x));
          line.setAttribute('y1', String(defPos.z));
          line.setAttribute('x2', String(defPos.x - 3));
          line.setAttribute('y2', String(defPos.z));
          line.setAttribute('stroke', '#f97316');
          line.setAttribute('stroke-width', '0.3');
          line.setAttribute('marker-end', 'url(#arrowhead)');
          svg.appendChild(line);
        }
      });
    }

    return svg;
  }

  function createPlaySelector(isOffense: boolean) {
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '8px';
    container.style.alignItems = 'center';

    const select = document.createElement('select');
    select.style.fontFamily = 'Consolas, Monaco, monospace';
    select.style.fontSize = '12px';
    select.style.background = '#0c1a2b';
    select.style.color = '#eaf0fb';
    select.style.border = '1px solid rgba(162,190,255,0.35)';
    select.style.padding = '5px 10px';
    select.style.borderRadius = '4px';
    select.style.cursor = 'pointer';
    select.style.width = '160px';
    select.style.outline = 'none';
    select.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';

    const playbook = isOffense ? PASS_PLAYBOOK : DEFENSE_PLAYBOOK;
    const currentPlayKey = isOffense ? gameState.selectedOffensePlay : gameState.selectedDefensePlay;

    Object.keys(playbook).forEach(playKey => {
      const play = (playbook as any)[playKey];
      const option = document.createElement('option');
      option.value = playKey;
      option.textContent = play.label;
      option.selected = playKey === currentPlayKey;
      select.appendChild(option);
    });

    const diagramContainer = document.createElement('div');
    diagramContainer.style.width = '240px';
    diagramContainer.style.height = '180px';
    diagramContainer.style.background = 'rgba(0,0,0,0.6)';
    diagramContainer.style.border = '1px solid rgba(162,190,255,0.4)';
    diagramContainer.style.borderRadius = '8px';
    diagramContainer.style.padding = '10px';
    diagramContainer.style.boxShadow = 'inset 0 4px 12px rgba(0,0,0,0.6)';
    diagramContainer.style.display = 'flex';
    diagramContainer.style.alignItems = 'center';
    diagramContainer.style.justifyContent = 'center';
    diagramContainer.style.marginTop = '4px';
    diagramContainer.style.position = 'relative';
    diagramContainer.style.overflow = 'hidden';

    const updateDiagram = (key: string) => {
      diagramContainer.innerHTML = '';
      const play = (playbook as any)[key];
      if (play) {
        const offPlay = isOffense ? play : null;
        const defPlay = isOffense ? null : play;
        
        const diagram = renderPlayDiagram(offPlay, defPlay);
        diagram.style.width = '100%';
        diagram.style.height = '100%';
        diagramContainer.appendChild(diagram);
      }
    };

    updateDiagram(currentPlayKey);

    const updateUI = () => {
      const currentKey = isOffense ? gameState.selectedOffensePlay : gameState.selectedDefensePlay;
      select.value = currentKey;
      updateDiagram(currentKey);
    };
    playUIUpdates.push(updateUI);

    select.onchange = () => {
      if (!gameState.isLive) {
        hintOverlay.style.opacity = '1';
        gameState.hintDismissed = false;
        const playKey = select.value;
        if (isOffense) {
          gameState.selectedOffensePlay = playKey;
          gameState.isKickoff = (playKey === 'kickoff');
          if (gameState.isKickoff) {
            gameState.kickoffState = 'READY';
            gameState.ballPos.set(-8.4, 0, 0); // Own 35-yard line (-28 + 35*0.56)
            resetBall(false); // Reset ball but don't randomize again
            gameState.selectedOffensePlay = 'kickoff'; // Ensure it stays kickoff
          }
        } else {
          gameState.selectedDefensePlay = playKey;
        }
        setupFormation();
        updateHUD();
        updateDiagram(playKey);
        isPlaybookVisible = false;
        playbookBar.style.display = 'none';
        playbookHint.style.display = 'block';
      } else {
        // Revert if live
        select.value = isOffense ? gameState.selectedOffensePlay : gameState.selectedDefensePlay;
      }
      select.blur();
    };

    container.appendChild(select);
    container.appendChild(diagramContainer);
    return container;
  }

  const playbookRows = document.createElement('div');
  playbookRows.style.display = 'flex';
  playbookRows.style.alignItems = 'flex-start';
  playbookRows.style.justifyContent = 'center';
  playbookRows.style.gap = '20px';
  playbookBar.appendChild(playbookRows);

  const offCol = document.createElement('div');
  offCol.style.display = 'flex';
  offCol.style.flexDirection = 'column';
  offCol.style.gap = '5px';
  const offLabel = document.createElement('div');
  offLabel.textContent = 'OFFENSE';
  offLabel.style.fontSize = '11px';
  offLabel.style.color = '#7fd5ff';
  offLabel.style.fontWeight = 'bold';
  offLabel.style.textAlign = 'center';
  offCol.appendChild(offLabel);
  offCol.appendChild(createPlaySelector(true));
  playbookRows.appendChild(offCol);

  // Scoreboard in the middle
  // playbookRows.appendChild(logoBar); // Removed

  const defCol = document.createElement('div');
  defCol.style.display = 'flex';
  defCol.style.flexDirection = 'column';
  defCol.style.gap = '5px';
  const defLabel = document.createElement('div');
  defLabel.textContent = 'DEFENSE';
  defLabel.style.fontSize = '11px';
  defLabel.style.color = '#ff8d8d';
  defLabel.style.fontWeight = 'bold';
  defLabel.style.textAlign = 'center';
  defCol.appendChild(defLabel);
  defCol.appendChild(createPlaySelector(false));
  playbookRows.appendChild(defCol);


  function animate() {
    requestAnimationFrame(animate);
    
    // Animate Banners
    bannerTexts.forEach((t) => {
      // Ensure visible
      t.visible = true;
      
      // Soft Neon Glow
      t.outlineWidth = 0.05;
      t.outlineColor = t.color;
      t.outlineBlur = 0.15;
    });

    if (!gameState.isLive && !gameState.hintDismissed && gameState.down >= 2) {
      if (hintOverlay.style.opacity === '0') {
        hintOverlay.style.opacity = '1';
      }
    } else {
      hintOverlay.style.opacity = '0';
    }

    if (gameState.isLive) {
      gameState.hintDismissed = false;
      hintOverlay.style.opacity = '0';
    }
    const now = performance.now();
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;
    const elapsed = now / 1000;

    if (gameState.message !== lastMessage) {
      lastMessage = gameState.message;
      if (gameState.message) {
        messageOverlay.textContent = gameState.message;
        messageOverlay.classList.remove('game-message-anim');
        // Trigger reflow
        void messageOverlay.offsetWidth;
        messageOverlay.classList.add('game-message-anim');
        messageOverlay.style.opacity = '1';
      } else {
        messageOverlay.classList.remove('game-message-anim');
        messageOverlay.style.opacity = '0';
      }
    }

    animateFirstDownFlags(elapsed);

    const qb = offenseTeam[0];
    const qbPos = qb ? qb.pos : new THREE.Vector3();

    losMarker.position.x = gameState.ballPos.x;
    firstDownMarker.position.x = gameState.ballPos.x + gameState.distance * UNITS_PER_YARD;
    firstDownFlagNorth.position.x = firstDownMarker.position.x;
    firstDownFlagSouth.position.x = firstDownMarker.position.x;
    setFirstDownFlagDown(firstDownFlagNorth, gameState.down);
    setFirstDownFlagDown(firstDownFlagSouth, gameState.down);

    if (gameState.status === 'PLAYING') {
      // FIXME: Quarter transition logic causes messages to flash frequently, investigate and fix later
      gameState.timer -= dt;
      if (gameState.timer <= 0) {
        gameState.period++;
        gameState.timer = Math.max(60, gameState.timer + 60);
        
        if (gameState.period === 3) {
          swapSides();
        }
        
        if (gameState.period > 4) {
          gameState.status = 'START';
          gameState.message = 'GAME OVER';
        } else {
          if (gameState.period === 2) {
            gameState.message = 'END OF 1ST QUARTER';
          } else if (gameState.period === 3) {
            gameState.message = 'HALFTIME';
          } else if (gameState.period === 4) {
            gameState.message = 'END OF 3RD QUARTER';
          }
        }
      }

      // Update trajectory indicator and charging logic
      if (gameState.isLive && ballState.heldBy && ballState.heldBy.role === 'QB') {
        const receivers = getEligibleReceivers();
        const target = receivers[gameState.selectedReceiverIndex];
        if (target) {
          if (gameState.isChargingPass) {
            trajectoryIndicator.visible = false;
            chargeLine.visible = true;
            
            // Increment progress - takes about 1.5 seconds to reach target
            gameState.passChargeProgress = Math.min(1.0, gameState.passChargeProgress + dt * 0.66);
            
            const startPos = ballState.pos.clone();
            // Current target point moves from offset towards receiver's LEAD position
            const leadPos = calculateLeadPosition(startPos, target);
            const currentOffset = gameState.passChargeOffset.clone().multiplyScalar(1.0 - gameState.passChargeProgress);
            const targetPoint = leadPos.clone().add(currentOffset);
            
            chargeLine.geometry.setFromPoints([startPos, targetPoint]);
            
            // Color transition: Red (0) to Green (1)
            const color = new THREE.Color().setHSL(gameState.passChargeProgress * 0.35, 1, 0.5);
            chargeLineMat.color.copy(color);

            if (gameState.passChargeProgress >= 1.0) {
              gameState.isPassLocked = true;
              chargeCircle.visible = true;
              chargeCircle.position.copy(leadPos).y = 0.1;
            } else {
              gameState.isPassLocked = false;
              chargeCircle.visible = false;
            }
          } else {
            chargeLine.visible = false;
            chargeCircle.visible = false;
            gameState.isPassLocked = false;
            trajectoryIndicator.visible = true;
            const startPos = ballState.pos.clone();
            const leadPos = calculateLeadPosition(startPos, target);
            
            // Calculate horizontal distance and time
            const dx = leadPos.x - startPos.x;
            const dz = leadPos.z - startPos.z;
            const distH = Math.sqrt(dx * dx + dz * dz);
            const speedH = 18;
            const time = distH / speedH;
            
            // Horizontal velocity
            const vel = new THREE.Vector3(dx, 0, dz).normalize().multiplyScalar(speedH);
            // Vertical velocity to hit target at y=1.2 (chest height)
            // y = y0 + vy*t - 0.5*g*t^2  => 1.2 = 1.2 + vy*t - 4.9*t^2 => vy = 4.9*t
            vel.y = 4.9 * time;
            
            const accuracy = calculatePassingAccuracy(ballState.heldBy, target);
            const color = new THREE.Color().setHSL(accuracy * 0.35, 1, 0.5); // Green to Red

            for (let i = 0; i < trajectoryIndicator.children.length; i++) {
              const t = (i / trajectoryIndicator.children.length) * time;
              const dot = trajectoryIndicator.children[i] as THREE.Mesh;
              const p = startPos.clone()
                .addScaledVector(vel, t)
                .addScaledVector(new THREE.Vector3(0, -9.8, 0), 0.5 * t * t);
              dot.position.copy(p);
              (dot.material as THREE.MeshBasicMaterial).color.copy(color);
              dot.scale.setScalar(0.5 + accuracy * 0.8);
            }
          }
        } else {
          trajectoryIndicator.visible = false;
          chargeLine.visible = false;
        }
      } else {
        trajectoryIndicator.visible = false;
        chargeLine.visible = false;
      }

      const moveSpeed = 6.5;
      const accel = 40.0;
      
      // Get camera's right vector (horizontal on screen)
      const right = new THREE.Vector3();
      right.setFromMatrixColumn(camera.matrixWorld, 0);
      right.y = 0;
      right.normalize();
      
      // Get camera's forward vector (vertical on screen)
      const forward = new THREE.Vector3();
      forward.crossVectors(right, new THREE.Vector3(0, 1, 0)).negate().normalize();

      // Fallback if camera is looking straight down/up
      if (right.lengthSq() < 0.01 || forward.lengthSq() < 0.01) {
        forward.set(0, 0, -1);
        right.set(1, 0, 0);
      }

      const targetVel = new THREE.Vector3(0, 0, 0);
      if (keys['w'] || keys['W']) targetVel.addScaledVector(forward, moveSpeed);
      if (keys['s'] || keys['S']) targetVel.addScaledVector(forward, -moveSpeed);
      if (keys['a'] || keys['A']) targetVel.addScaledVector(right, -moveSpeed);
      if (keys['d'] || keys['D']) targetVel.addScaledVector(right, moveSpeed);

      // Determine which player the user is controlling
      let controlledPlayer;
      if (gameState.isKickoff) {
        if (ballState.heldBy && ballState.heldBy.team === 'A') {
          controlledPlayer = ballState.heldBy;
        } else {
          controlledPlayer = offenseTeam[gameState.selectedKickoffPlayerIndex] || offenseTeam[0];
        }
      } else {
        controlledPlayer = (ballState.heldBy && ballState.heldBy.team === 'A') ? ballState.heldBy : qb;
      }
      const cpPos = controlledPlayer.pos;

      // Smooth acceleration for controlled player
      controlledPlayer.vel.lerp(targetVel, dt * 5.0);

      // Move controlled player
      if (controlledPlayer.vel.lengthSq() > 0.01) {
        controlledPlayer.pos.addScaledVector(controlledPlayer.vel, dt);
        controlledPlayer.pos.x = THREE.MathUtils.clamp(controlledPlayer.pos.x, -FIELD_W / 2, FIELD_W / 2);
        controlledPlayer.pos.z = THREE.MathUtils.clamp(controlledPlayer.pos.z, -FIELD_D / 2, FIELD_D / 2);
      }

      if (gameState.isLive) {
        // Kickoff Logic
        if (gameState.isKickoff && ballState.heldBy && ballState.heldBy.team === 'B') {
          // Returner AI: Run fast towards Team A's endzone (negative X)
          const returner = ballState.heldBy;
          const targetX = -FIELD_W / 2;
          const targetZ = 0;
          const dir = new THREE.Vector3(targetX - returner.pos.x, 0, targetZ - returner.pos.z).normalize();
          returner.vel.lerp(dir.multiplyScalar(9.5), dt * 6.0); // Slightly faster and more responsive
          returner.pos.addScaledVector(returner.vel, dt);
        }

        // Offense Routes
        playState.activeRoutes.forEach(route => {
          const p = route.player;
          if (!p || p === controlledPlayer) return;

          // WR AI Improvements
          if (p.role === 'WR') {
            if (p.burstTimer > 0) {
              p.burstTimer -= dt;
              p.glow.visible = true;
            } else if (p.burstCooldown > 0) {
              p.burstCooldown -= dt;
              p.glow.visible = false;
            } else if (Math.random() < 0.01) {
              p.burstTimer = 0.5;
              p.burstCooldown = 5.0;
              p.glow.visible = true;
            } else {
              p.glow.visible = false;
            }
          }

          const target = route.waypoints[route.currentIndex];
          if (target) {
            const dir = new THREE.Vector3().subVectors(target, p.pos).normalize();
            
            // Rapid direction changes
            if (p.role === 'WR' && Math.random() < 0.05) {
              dir.add(new THREE.Vector3((Math.random() - 0.5) * 0.5, 0, (Math.random() - 0.5) * 0.5)).normalize();
            }

            const speed = 5.0 + (p.role === 'WR' && p.burstTimer > 0 ? 3.0 : 0);
            p.vel.lerp(dir.multiplyScalar(speed), dt * 4.0);
            p.pos.addScaledVector(p.vel, dt);
            if (p.pos.distanceTo(target) < 0.8) {
              route.currentIndex++;
            }
          } else {
            // Keep running straight if route finished
            p.vel.lerp(new THREE.Vector3(5.0, 0, 0), dt * 2.0);
            p.pos.addScaledVector(p.vel, dt);
          }
        });

        // Offense Chasing (for interceptions)
        offenseTeam.forEach(p => {
          const ballCarrier = ballState.heldBy;
          if (ballCarrier && ballCarrier.team === 'B') {
            const dir = new THREE.Vector3().subVectors(ballCarrier.pos, p.pos).normalize();
            const speed = 4.5;
            p.vel.lerp(dir.multiplyScalar(speed), dt * 3.0);
            p.pos.addScaledVector(p.vel, dt);

            if (p.pos.distanceTo(ballCarrier.pos) < 1.0) {
              if (p.tackleCooldown <= 0) {
                const speedDiff = p.stats.speed - ballCarrier.stats.speed;
                const tackleChance = 0.5 + (p.stats.tackle * 0.4) - (ballCarrier.stats.breakTackle * 0.4) + (speedDiff * 5.0);
                
                if (Math.random() < tackleChance) {
                  gameState.message = gameState.passCaught ? 'COMPLETION!' : 'TACKLED!';
                  sounds.incomplete();
                  gameState.isLive = false;
                  gameState.screenShake = 0.4;
                  p.state = 'TACKLED';
                  ballCarrier.state = 'TACKLED';
                  // Turnover logic would go here, for now just reset
                  setTimeout(() => {
                    setupFormation();
                    resetBall();
                  }, 1500);
                } else {
                  // Broken tackle
                  p.tackleCooldown = 1.5;
                  const pushDir = new THREE.Vector3().subVectors(p.pos, ballCarrier.pos).normalize();
                  p.vel.add(pushDir.multiplyScalar(3.0));
                  ballCarrier.vel.multiplyScalar(0.7);
                  
                  if (gameState.message === '') {
                    gameState.message = 'BROKEN TACKLE!';
                    setTimeout(() => {
                      if (gameState.message === 'BROKEN TACKLE!') gameState.message = '';
                    }, 2500);
                  }
                }
              }
            }
          }
        });
        // Linemen blocking logic
        offenseTeam.forEach(off => {
          if (off.role === 'C' || off.role === 'G' || off.role === 'T') {
            let engaged = false;
            const qb = offenseTeam[0];
            
            // Find the closest defender who is rushing
            let closestRusher = null;
            let minRushDist = 5.0; // Increased engagement distance
            
            defenseTeam.forEach(def => {
              const distToOff = off.pos.distanceTo(def.pos);
              
              if (distToOff < minRushDist) {
                minRushDist = distToOff;
                closestRusher = def;
              }
            });
            
            if (closestRusher) {
              engaged = true;
              const def = closestRusher;
              
              // Push defender away from QB
              const toQB = new THREE.Vector3().subVectors(qb.pos, def.pos).normalize();
              const pushDir = new THREE.Vector3().subVectors(off.pos, def.pos).normalize();
              
              // Blend push direction to keep defender away from QB
              // Make it stickier: more weight on keeping them away
              const finalDir = pushDir.clone().lerp(toQB.negate(), 0.7).normalize();
              
              // Move OL to stay between defender and QB
              off.pos.addScaledVector(finalDir.clone().negate(), 0.6 * dt);
              // Move defender
              def.pos.addScaledVector(finalDir, 0.9 * dt);
            }
            
            // If not engaged, drop back slightly or hold ground to form pocket
            if (!engaged) {
              const distToQB = off.pos.distanceTo(qb.pos);
              if (distToQB < 3.5) { // Slightly larger pocket
                // Hold ground or slight retreat
                off.pos.x += 0.1 * dt;
              } else {
                // Move towards QB to tighten pocket
                const toQB = new THREE.Vector3().subVectors(qb.pos, off.pos).normalize();
                off.pos.addScaledVector(toQB, 0.4 * dt);
              }
            }
          }
        });

        // Defense Assignments
        defenseTeam.forEach((p, i) => {
          const assignment = playState.defenseAssignments[i];
          if (!assignment) return;

          const ballCarrier = ballState.heldBy;
          const qb = offenseTeam[0];
          
          // 1. Ball in Air: Reaction logic (Interception/Breakup)
          if (ballState.isFlying) {
            // Kickoff specific reaction: Defense (Receiving team) moves fast to ball
            if (gameState.isKickoff) {
              const pursuitDir = new THREE.Vector3().subVectors(ballState.pos, p.pos).normalize();
              pursuitDir.y = 0;
              const speed = 9.0; // Faster pursuit
              p.vel.lerp(pursuitDir.multiplyScalar(speed), dt * 8.0);
              p.pos.addScaledVector(p.vel, dt);
              return;
            }

            // Predict ball path
            const timeToImpact = p.pos.distanceTo(ballState.pos) / 12;
            const predictedBallPos = ballState.pos.clone().addScaledVector(ballState.vel, Math.min(timeToImpact, 1.0));
            predictedBallPos.y = 0;

            let reactionStrength = 0;
            if (assignment.type === 'rush') reactionStrength = 1.0;
            else if (assignment.type === 'man') {
              const targetWR = assignment.targetReceiver;
              const distToBall = p.pos.distanceTo(predictedBallPos);
              const wrToBall = targetWR ? targetWR.pos.distanceTo(predictedBallPos) : 100;
              if (distToBall < 18.0 || wrToBall < 15.0) reactionStrength = 1.0;
            } else if (assignment.type === 'zone') {
              const distToBall = p.pos.distanceTo(predictedBallPos);
              const zoneToBall = assignment.target.distanceTo(predictedBallPos);
              if (distToBall < 20.0 || zoneToBall < 18.0) reactionStrength = 1.0;
            }

            if (reactionStrength > 0) {
              // Aggressive pursuit of the ball
              const pursuitDir = new THREE.Vector3().subVectors(predictedBallPos, p.pos).normalize();
              const maxSpeed = p.stats.speed * 45; // Fast pursuit
              const speed = maxSpeed * reactionStrength;
              p.vel.lerp(pursuitDir.multiplyScalar(speed), dt * 8.0);
              p.pos.addScaledVector(p.vel, dt);
              
              // Interception attempt
              if (p.pos.distanceTo(ballState.pos) < 2.2 && ballState.pos.y < 3.5) {
                // Base chance + catching/coverage bonus
                const interceptChance = 0.05 + (p.stats.catching * 0.1) + (p.stats.coverage * 0.05);
                if (Math.random() < interceptChance * dt * 60) { // Chance to intercept per frame
                  ballState.isFlying = false;
                  ballState.heldBy = p;
                  ballState.vel.set(0,0,0);
                  gameState.message = 'INTERCEPTED!';
                  sounds.catch();
                  // Change direction for return
                  p.dir = -1; // BUG: Teams are not swapping possession after interceptions
                }
              }
              return;
            }
          }

          // 2. Ball Carrier Reaction (Tackling/Pursuit)
          if (ballCarrier && ballCarrier.team === 'A') {
            const isQB = ballCarrier.role === 'QB';
            const los = gameState.ballPos.x;
            const pastLOS = ballCarrier.pos.x > los + 1.0;
            const outOfPocket = Math.abs(ballCarrier.pos.z) > 6.0;
            const shouldBreak = !isQB || pastLOS || outOfPocket || assignment.type === 'rush';
            
            if (shouldBreak) {
              // Dynamic Pursuit: Aim for intercept point
              const dist = p.pos.distanceTo(ballCarrier.pos);
              const interceptTime = dist / 6.0;
              const interceptPos = ballCarrier.pos.clone().addScaledVector(ballCarrier.vel, interceptTime);
              
              const dir = new THREE.Vector3().subVectors(interceptPos, p.pos).normalize();
              const speed = 6.0;
              p.vel.lerp(dir.multiplyScalar(speed), dt * 5.5);
              p.pos.addScaledVector(p.vel, dt);
              
              if (p.pos.distanceTo(ballCarrier.pos) < 1.1) {
                if (p.tackleCooldown <= 0) {
                  const speedDiff = p.stats.speed - ballCarrier.stats.speed;
                  const tackleChance = 0.5 + (p.stats.tackle * 0.4) - (ballCarrier.stats.breakTackle * 0.4) + (speedDiff * 5.0);
                  
                  if (Math.random() < tackleChance) {
                    gameState.message = gameState.passCaught ? 'COMPLETION!' : 'TACKLED!';
                    sounds.incomplete();
                    gameState.isLive = false;
                    gameState.isResetting = true;
                    gameState.screenShake = 0.4;
                    p.state = 'TACKLED';
                    ballCarrier.state = 'TACKLED';
                    gameState.ballPos.x = ballCarrier.pos.x;
                    setTimeout(() => {
                      setupFormation();
                      resetBall();
                    }, 1500);
                  } else {
                    // Broken tackle
                    p.tackleCooldown = 1.5;
                    const pushDir = new THREE.Vector3().subVectors(p.pos, ballCarrier.pos).normalize();
                    p.vel.add(pushDir.multiplyScalar(3.0));
                    ballCarrier.vel.multiplyScalar(0.7);
                    
                    if (gameState.message === '') {
                      gameState.message = 'BROKEN TACKLE!';
                      setTimeout(() => {
                        if (gameState.message === 'BROKEN TACKLE!') gameState.message = '';
                      }, 2500);
                    }
                  }
                }
              }
              return;
            }
          } else if (ballCarrier && ballCarrier.team === 'B') {
            // Interception Return Logic
            if (p === ballCarrier) {
              // Run towards the endzone (negative X direction)
              const dir = new THREE.Vector3(-1, 0, 0);
              const speed = p.stats.speed * 45;
              p.vel.lerp(dir.multiplyScalar(speed), dt * 5.0);
              p.pos.addScaledVector(p.vel, dt);
            } else {
              // Block for the ball carrier
              let nearestA = null;
              let minDist = 100;
              offenseTeam.forEach(a => {
                const d = p.pos.distanceTo(a.pos);
                if (d < minDist) {
                  minDist = d;
                  nearestA = a;
                }
              });
              
              if (nearestA) {
                const dir = new THREE.Vector3().subVectors(nearestA.pos, p.pos).normalize();
                const speed = p.stats.speed * 40;
                p.vel.lerp(dir.multiplyScalar(speed), dt * 4.0);
                p.pos.addScaledVector(p.vel, dt);
              }
            }
            return;
          }

          // 3. Default Assignment Behavior
          if (assignment.type === 'rush') {
            const dir = new THREE.Vector3().subVectors(qb.pos, p.pos).normalize();
            p.vel.lerp(dir.multiplyScalar(4.8), dt * 4.0);
            p.pos.addScaledVector(p.vel, dt);
          } else if (assignment.type === 'man') {
            const wr = assignment.targetReceiver;
            if (wr) {
              // Sticky Man with Anticipation
              // Predict where WR is going based on their velocity and current route
              const predictionTime = 0.25;
              const predictedWRPos = wr.pos.clone().addScaledVector(wr.vel, predictionTime);
              
              // Stay between WR and QB (leverage), tighter coverage
              const qbToWR = new THREE.Vector3().subVectors(predictedWRPos, qb.pos).normalize();
              const leveragePos = predictedWRPos.clone().addScaledVector(qbToWR, -0.4);
              
              const dir = new THREE.Vector3().subVectors(leveragePos, p.pos).normalize();
              const dist = p.pos.distanceTo(leveragePos);
              
              const maxSpeed = p.stats.speed * 45; // ~8.1 for CBs
              let speed = maxSpeed * 0.8;
              
              // Illegal contact rule
              const los = gameState.ballPos.x;
              const past5Yards = (wr.pos.x - los) > 5.0;
              const passThrown = ballState.isFlying;
              const outOfPocket = Math.abs(qb.pos.z) > 6.0;
              const distToWR = p.pos.distanceTo(wr.pos);
              
              if (past5Yards && !passThrown && !outOfPocket && distToWR < 1.0) {
                speed = 0;
              } else {
                if (dist < 1.0) speed = wr.vel.length() + dist * 2.0;
                else if (dist > 2.0) speed = maxSpeed; // Catch up speed
              }
              
              p.vel.lerp(dir.multiplyScalar(speed), dt * (dist < 1.5 ? 12 : 6));
              p.pos.addScaledVector(p.vel, dt);
            }
          } else if (assignment.type === 'zone') {
            // Zone Logic: Squeeze nearest receiver in zone
            let bestTarget = assignment.target.clone();
            let nearestWR = null;
            let minDist = 10.0;
            
            getEligibleReceivers().forEach(wr => {
              const d = wr.pos.distanceTo(assignment.target);
              if (d < 8.0) { // If WR is in/near zone
                const distToDef = p.pos.distanceTo(wr.pos);
                if (distToDef < minDist) {
                  minDist = distToDef;
                  nearestWR = wr;
                }
              }
            });

            if (nearestWR) {
              // Position between QB and WR, tighter coverage
              const qbToWR = new THREE.Vector3().subVectors(nearestWR.pos, qb.pos).normalize();
              bestTarget = nearestWR.pos.clone().addScaledVector(qbToWR, -0.8);
            }

            const dir = new THREE.Vector3().subVectors(bestTarget, p.pos).normalize();
            const dist = p.pos.distanceTo(bestTarget);
            const maxSpeed = p.stats.speed * 42;
            const speed = dist > 1.5 ? maxSpeed : maxSpeed * 0.6;
            p.vel.lerp(dir.multiplyScalar(speed), dt * 6.0);
            p.pos.addScaledVector(p.vel, dt);
          }
        });

        players.forEach(p => {
          if (ballState.isFlying) {
            // Prevent the thrower from instantly re-catching the ball
            if (p === ballState.lastHeldBy) return;

            const distToBall = p.pos.distanceTo(ballState.pos);
            if (distToBall < 1.5) {
              // Drop chance based on catching stat. 
              // e.g., catching 0.9 -> 5% drop chance. catching 0.2 -> 40% drop chance.
              const dropChance = (1.0 - p.stats.catching) * 0.5;
              const isDrop = p.team === 'A' && Math.random() < dropChance;
              
              if (isDrop) {
                gameState.message = 'DROPPED!';
                sounds.incomplete();
                // Ball bounces a bit
                ballState.vel.set((Math.random() - 0.5) * 5, 5, (Math.random() - 0.5) * 5);
                ballState.lastHeldBy = p; // Prevent instant re-catch
              } else {
                // Check for pass breakup if caught by offense
                let isBrokenUp = false;
                if (p.team === 'A') {
                  defenseTeam.forEach(def => {
                    const distToReceiver = def.pos.distanceTo(p.pos);
                    if (distToReceiver < 2.0) {
                      // Chance to break up depends on proximity and stats
                      const statBonus = (def.stats.coverage * 0.3) + (def.stats.speed * 0.5);
                      const breakupChance = 0.20 + (2.0 - distToReceiver) * 0.30 + statBonus; // Higher chance
                      if (Math.random() < breakupChance) {
                        isBrokenUp = true;
                      }
                    }
                  });
                }

                if (isBrokenUp) {
                  gameState.message = 'BROKEN UP!';
                  sounds.incomplete();
                  // Ball bounces away with more energy
                  ballState.vel.set((Math.random() - 0.5) * 10, 7, (Math.random() - 0.5) * 10);
                  ballState.lastHeldBy = p;
                } else {
                  ballState.isFlying = false;
                  ballState.heldBy = p;
                  ballState.lastHeldBy = p;
                  
                  if (p.team === 'B') {
                    gameState.message = 'INTERCEPTED!';
                    sounds.incomplete();
                  } else {
                    gameState.passCaught = true;
                    gameState.message = 'CAUGHT!';
                    sounds.catch();
                  }
                }
              }
            }
          }

          if (p.tackleCooldown > 0) p.tackleCooldown -= dt;

          p.pos.x = THREE.MathUtils.clamp(p.pos.x, -FIELD_W / 2, FIELD_W / 2);
          p.pos.z = THREE.MathUtils.clamp(p.pos.z, -FIELD_D / 2, FIELD_D / 2);
          p.mesh.position.copy(p.pos);

          if (p.state !== 'TACKLED') {
            if (p.vel.lengthSq() > 0.1 || (p.team === 'A' && gameState.isLive)) {
              p.state = 'RUN';
              if (p.vel.x !== 0) p.dir = p.vel.x > 0 ? 1 : -1;
            } else {
              p.state = 'IDLE';
            }
          }

          const animThreshold = p.state === 'IDLE' ? 0.25 : 0.12;
          p.animTimer += dt;
          if (p.animTimer > animThreshold) {
            p.animTimer = 0;
            const frames = p.state === 'RUN' ? p.runFrames : p.idleFrames;
            p.frame = (p.frame + 1) % frames.length;
            frames.forEach((f: any, i: number) => f.visible = i === p.frame);
          }
          
          if (p.state === 'TACKLED') {
            p.spriteGroup.rotation.z = THREE.MathUtils.lerp(p.spriteGroup.rotation.z, (Math.PI / 2) * p.dir, dt * 8);
            p.spriteGroup.position.y = THREE.MathUtils.lerp(p.spriteGroup.position.y, 0.864, dt * 8);
          } else {
            p.spriteGroup.rotation.z = 0;
            p.spriteGroup.position.y = 0.864;
            const breath = p.state === 'IDLE' ? Math.sin(elapsed * 3.0 + (p as any).breathOffset) * 0.04 : 0;
            p.spriteGroup.scale.set(p.dir * (1.0 - breath * 0.3), 1.0 + breath, 1.0);
          }
        });

        // Player-to-Player Collisions (Blocking & Tackling)
        players.forEach(p1 => {
          players.forEach(p2 => {
            if (p1 === p2) return;
            const dist = p1.pos.distanceTo(p2.pos);
            if (dist < 0.85) {
              const pushDir = new THREE.Vector3().subVectors(p1.pos, p2.pos).normalize();
              const pushForce = (0.85 - dist) * 2.0;
              
              // Tackle logic (Defender hits Ball Carrier)
              if (p1.team === 'B' && ballState.heldBy === p2 && p2.team === 'A') {
                if (p1.tackleCooldown <= 0) {
                  const speedDiff = p1.stats.speed - p2.stats.speed;
                  // Base chance 50%, modified by tackle vs breakTackle, and speed difference
                  const tackleChance = 0.5 + (p1.stats.tackle * 0.4) - (p2.stats.breakTackle * 0.4) + (speedDiff * 5.0);
                  
                  if (Math.random() < tackleChance) {
                    if (!gameState.isResetting) {
                      gameState.isResetting = true;
                      gameState.message = gameState.passCaught ? 'COMPLETION!' : 'TACKLED!';
                      sounds.incomplete();
                      gameState.isLive = false;
                      performPossessionSwap();
                    }
                    gameState.screenShake = 0.4;
                    p1.state = 'TACKLED';
                    p2.state = 'TACKLED';
                    gameState.ballPos.x = p2.pos.x;
                    setTimeout(() => {
                      setupFormation();
                      resetBall();
                    }, 1500);
                  } else {
                    // Broken tackle
                    p1.tackleCooldown = 1.5; // Cooldown in seconds
                    p1.vel.add(pushDir.clone().multiplyScalar(-3.0)); // Push defender away
                    p2.vel.multiplyScalar(0.7); // Slow down ball carrier
                    
                    // Show broken tackle message briefly if not already showing something else important
                    if (gameState.message === '') {
                      gameState.message = 'BROKEN TACKLE!';
                      setTimeout(() => {
                        if (gameState.message === 'BROKEN TACKLE!') gameState.message = '';
                      }, 2500);
                    }
                  }
                }
              }
              
              // Blocking logic (Offense hits Defense)
              if (p1.team === 'A' && p2.team === 'B') {
                if (['C', 'G', 'T', 'TE', 'FB'].includes(p1.role)) {
                  p1.pos.addScaledVector(pushDir, pushForce * 0.4);
                  p2.pos.addScaledVector(pushDir, -pushForce * 0.6);
                  p1.vel.multiplyScalar(0.7);
                  p2.vel.multiplyScalar(0.7);
                }
              }
            }
          });
        });

        if (ballState.heldBy) {
          ballState.pos.copy(ballState.heldBy.pos).add(new THREE.Vector3(0.3 * ballState.heldBy.dir, 1.0, 0));
        } else if (ballState.isFlying) {
          ballState.pos.addScaledVector(ballState.vel, dt);
          ballState.vel.y -= 9.8 * dt;
          if (ballState.pos.y < 0.2) {
            ballState.pos.y = 0.2;
            ballState.isFlying = false;
            gameState.message = 'INCOMPLETE';
            sounds.incomplete();
            setTimeout(() => {
              gameState.isLive = false;
              gameState.ballPos.x = losMarker.position.x;
              setupFormation();
              resetBall();
            }, 1500);
          }
        }
        ballGroup.position.copy(ballState.pos);
        ballGroup.rotation.z += dt * 10;

        // Update Ball Trail (Solid Line)
        if (ballState.isFlying) {
          ballTrailLine.visible = true;
          trailTimer += dt;
          if (trailTimer > 0.016) { // Update ~60fps
            trailTimer = 0;
            // Shift points
            for (let i = 0; i < MAX_TRAIL_POINTS - 1; i++) {
              ballTrailPositions[i].copy(ballTrailPositions[i + 1]);
            }
            // Add new point
            ballTrailPositions[MAX_TRAIL_POINTS - 1].copy(ballState.pos);
            trailPointCount = Math.min(trailPointCount + 1, MAX_TRAIL_POINTS);
            
            // Update geometry
            ballTrailGeo.setFromPoints(ballTrailPositions);
            
            // Fade out the start of the line if it's not full yet
            if (trailPointCount < MAX_TRAIL_POINTS) {
              // Initialize points to current ball pos if we just started
              if (trailPointCount === 1) {
                for (let i = 0; i < MAX_TRAIL_POINTS; i++) {
                  ballTrailPositions[i].copy(ballState.pos);
                }
              }
            }
          }
        } else {
          // Slowly fade out or hide
          if (ballTrailLine.visible) {
            const mat = ballTrailLine.material as THREE.LineBasicMaterial;
            mat.opacity -= dt * 2;
            if (mat.opacity <= 0) {
              ballTrailLine.visible = false;
              mat.opacity = 0.6;
              trailPointCount = 0;
            }
          }
        }

        if (ballState.heldBy && ballState.heldBy.team === 'A' && ballState.pos.x > FIELD_W / 2 - EZONE_W) {
          gameState.scoreA += 7;
          gameState.message = 'TOUCHDOWN!';
          sounds.touchdown();
          gameState.isLive = false;
          gameState.isResetting = true;
          performPossessionSwap();
          setTimeout(() => {
            gameState.ballPos.x = -FIELD_W / 2 + EZONE_W + 20 * UNITS_PER_YARD;
            setupFormation();
            resetBall();
          }, 3000);
        } else if (ballState.heldBy && ballState.heldBy.team === 'B' && ballState.pos.x < -FIELD_W / 2 + EZONE_W) {
          gameState.scoreB += 7;
          gameState.message = 'PICK SIX!';
          sounds.touchdown();
          gameState.isLive = false;
          gameState.isResetting = true;
          setTimeout(() => {
            gameState.ballPos.x = -FIELD_W / 2 + EZONE_W + 20 * UNITS_PER_YARD;
            setupFormation();
            resetBall();
          }, 3000);
        }
      } else {
        players.forEach(p => {
          p.mesh.position.copy(p.pos);
          if (p === qb && p.vel.lengthSq() > 0.1) {
            p.state = 'RUN';
            if (p.vel.x !== 0) p.dir = p.vel.x > 0 ? 1 : -1;
          } else {
            p.state = 'IDLE';
          }
          const animThreshold = p.state === 'IDLE' ? 0.25 : 0.12;
          p.animTimer += dt;
          if (p.animTimer > animThreshold) {
            p.animTimer = 0;
            const frames = p.state === 'RUN' ? p.runFrames : p.idleFrames;
            p.frame = (p.frame + 1) % frames.length;
            frames.forEach((f: any, i: number) => f.visible = i === p.frame);
            if (p.state === 'RUN') {
              p.idleFrames.forEach((f: any) => f.visible = false);
            } else {
              p.runFrames.forEach((f: any) => f.visible = false);
            }
          }
          
          const breath = p.state === 'IDLE' ? Math.sin(elapsed * 2.5 + (p as any).breathOffset) * 0.025 : 0;
          p.spriteGroup.scale.set(p.dir * (1.0 - breath * 0.3), 1.0 + breath, 1.0);
          p.spriteGroup.rotation.z = 0;
          p.spriteGroup.position.y = 0.864;
        });
        // Before snap, ball stays at LOS
        ballState.pos.set(gameState.ballPos.x, 0.15, 0);
        ballGroup.position.copy(ballState.pos);
      }
    }

    if (cameraMode === 'FOLLOW_BEHIND') {
      const controlledPlayer = ballState.heldBy ? ballState.heldBy : qb;
      const cpPos = controlledPlayer.pos;
      // Always look from the negative X side (Dolphins end zone side)
      camera.position.lerp(new THREE.Vector3(cpPos.x - 20, 15, cpPos.z + 10), 0.1);
      camera.lookAt(cpPos.x + 10, 0, cpPos.z);
    } else if (cameraMode === 'BROADCAST') {
      camera.position.lerp(new THREE.Vector3(0, 55, 35), 0.05);
      camera.lookAt(0, 0, 0);
    } else if (cameraMode === 'SIDELINE') {
      camera.position.lerp(new THREE.Vector3(0, 15, 40), 0.1);
      camera.lookAt(0, 0, 0);
    } else if (cameraMode === 'FIXED_ENDZONE') {
      camera.position.lerp(new THREE.Vector3(-FIELD_W / 2 - 20, 15, 0), 0.1);
      camera.lookAt(0, 0, 0);
    }

    if (gameState.screenShake > 0) {
      gameState.screenShake -= dt;
      const shakeAmt = gameState.screenShake * 1.5;
      camera.position.x += (Math.random() - 0.5) * shakeAmt;
      camera.position.y += (Math.random() - 0.5) * shakeAmt;
      camera.position.z += (Math.random() - 0.5) * shakeAmt;
    }

    const receivers = getEligibleReceivers();
    const canSelect = !gameState.isLive || (gameState.isLive && ballState.heldBy && ballState.heldBy.role === 'QB');
    
    // Update selection markers for receivers
    receivers.forEach((p, idx) => {
      if (p.selectionMarker) {
        p.selectionMarker.visible = (canSelect && idx === gameState.selectedReceiverIndex);
        if (p.selectionMarker.visible) {
          p.selectionMarker.rotation.z += dt * 3;
          const scale = 1.2 + Math.sin(now * 0.01) * 0.3;
          p.selectionMarker.scale.set(scale, scale, scale);
          p.selectionMarker.material.opacity = 0.6 + Math.sin(now * 0.01) * 0.3;
        }
      }
    });

    // Update selection markers for kickoff coverage
    if (gameState.isKickoff && !gameState.isLive) {
      offenseTeam.forEach((p, idx) => {
        if (p.selectionMarker) {
          p.selectionMarker.visible = (idx === gameState.selectedKickoffPlayerIndex);
          if (p.selectionMarker.visible) {
            p.selectionMarker.rotation.z += dt * 3;
            const scale = 1.2 + Math.sin(now * 0.01) * 0.3;
            p.selectionMarker.scale.set(scale, scale, scale);
            p.selectionMarker.material.opacity = 0.6 + Math.sin(now * 0.01) * 0.3;
          }
        }
      });
    }

    updateHUD();
    // Animate Crowd
    const time = performance.now() * 0.001;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < crowdBlocks.length; i++) {
      const b = crowdBlocks[i];
      // Jump
      const jump = Math.max(0, Math.sin(time * b.speed + b.phase)) * b.jumpHeight;
      // Vibrate
      const vx = (Math.random() - 0.5) * b.vibeScale;
      const vz = (Math.random() - 0.5) * b.vibeScale;
      
      dummy.position.set(b.baseX + vx, b.baseY + jump, b.baseZ + vz);
      dummy.updateMatrix();
      crowdMesh.setMatrixAt(b.instanceIndex, dummy.matrix);
    }
    crowdMesh.instanceMatrix.needsUpdate = true;

    // Randomly spawn word balloons
    if (Math.random() < 0.02) { // 2% chance per frame
      const b = visibleCrowdBlocks[Math.floor(Math.random() * visibleCrowdBlocks.length)];
      if (b) {
        const phrase = b.team === 'dolphins' 
          ? dolphinsPhrases[Math.floor(Math.random() * dolphinsPhrases.length)]
          : ninersPhrases[Math.floor(Math.random() * ninersPhrases.length)];
        const color = b.team === 'dolphins' ? '#008e97' : '#aa0000';
        spawnWordBalloon(b.baseX, b.baseY + 0.5, b.baseZ, phrase, "");
      }
    }

    renderer.render(scene, camera);

    // Orbit camera
    const orbitReceivers = getEligibleReceivers();
    const target = orbitReceivers[gameState.selectedReceiverIndex];
    if (target) {
      const radius = -5;
      orbitCamera.position.x = target.pos.x + radius;
      orbitCamera.position.z = target.pos.z + radius;
      orbitCamera.position.y = target.pos.y + 2;
      orbitCamera.lookAt(target.pos);
      
      const orbitRenderer = (window as any).orbitRenderer;
      if (orbitRenderer) {
        orbitRenderer.render(scene, orbitCamera);
      }
    }

    // Orbit defense camera
    const defenders = defenseTeam;
    let defTarget = defenders[gameState.selectedDefenderIndex];
    if (defTarget) {
      const radius = gameState.selectedDefenderOrbitRotated ? -5 : 5;
      orbitCamera.position.x = defTarget.pos.x + radius;
      orbitCamera.position.z = defTarget.pos.z + radius;
      orbitCamera.position.y = defTarget.pos.y + 2;
      orbitCamera.lookAt(defTarget.pos);
      
      const orbitDefenseRenderer = (window as any).orbitDefenseRenderer;
      if (orbitDefenseRenderer) {
        orbitDefenseRenderer.render(scene, orbitCamera);
      }
    }
  }

  window.addEventListener('keydown', (e) => {
    hintOverlay.style.opacity = '0';
    gameState.hintDismissed = true;
    const key = e.key.toLowerCase();
    const code = e.code;
    
    if (key === 'x' || code === 'KeyX') {
      if (!gameState.isLive && gameState.down >= 2) {
        gameState.selectedOffensePlay = gameState.lastOffensePlay;
        gameState.selectedDefensePlay = gameState.lastDefensePlay;
        setupFormation();
        playUIUpdates.forEach(update => update());
      }
    }
    
    keys[key] = true;

    // Toggle Defensive Orbit Rotation
    if (key === 'o' || code === 'KeyO') {
      e.preventDefault();
      gameState.selectedDefenderOrbitRotated = !gameState.selectedDefenderOrbitRotated;
    }

    // Hike
    if ((key === 'h' || code === 'KeyH') && !gameState.isLive && !gameState.isResetting) {
      e.preventDefault();
      isPlaybookVisible = false;
      playbookBar.style.display = 'none';
      playbookHint.style.display = 'block';
      const offPlay = PASS_PLAYBOOK[gameState.selectedOffensePlay as keyof typeof PASS_PLAYBOOK];
      // Robust kickoff check: either the flag is set, or the play/formation is 'kickoff'
      const isKickoff = gameState.isKickoff || 
                        gameState.selectedOffensePlay === 'kickoff' || 
                        (offPlay && offPlay.formation === 'kickoff');
      
      // TODO: BUG - Kickoff mechanics reported as not working. Flagged for future investigation.
      if (isKickoff) {
        gameState.isLive = true;
        gameState.isKickoff = true;
        gameState.kickoffState = 'KICKED';
        gameState.message = 'KICK!';
        
        // Immediate launch
        ballState.isFlying = true;
        ballState.heldBy = null;
        
        // Target: Opponent's 10-yard line. 
        // 0 is 50-yard line. Opponent's endzone is at 28. 
        // 10-yard line is 28 - 5.6 = 22.4.
        const targetX = 22.4; 
        const driftRange = targetX * 0.05; // 5% drift
        const finalTargetX = targetX + (Math.random() - 0.5) * driftRange * 2;
        const finalTargetZ = (Math.random() - 0.5) * driftRange * 2;
        const targetPos = new THREE.Vector3(finalTargetX, 0.15, finalTargetZ);
        
        const time = 3.2; // Hang time
        
        // Physics: x = x0 + vx*t => vx = (x - x0)/t
        ballState.vel.x = (targetPos.x - ballState.pos.x) / time;
        ballState.vel.z = (targetPos.z - ballState.pos.z) / time;
        
        // Physics: y = y0 + vy*t - 0.5*g*t^2 => vy = (y - y0 + 0.5*g*t^2)/t
        // We want it to land at y=0. Initial y is ballState.pos.y (0.15)
        ballState.vel.y = (0 - ballState.pos.y + 0.5 * 9.8 * time * time) / time;
        
        playState.activeRoutes = buildActiveRoutes();
        playState.defenseAssignments = buildDefenseAssignments();
        updateFieldRoutes();
        sounds.throw();
      } else {
        gameState.isLive = true;
        gameState.isKickoff = false;
        gameState.status = 'PLAYING';
        gameState.message = '';
        gameState.passCaught = false;
        ballState.heldBy = offenseTeam[0]; // QB takes the snap
        playState.activeRoutes = buildActiveRoutes();
        playState.defenseAssignments = buildDefenseAssignments();
        updateFieldRoutes();
        gameState.lastOffensePlay = gameState.selectedOffensePlay;
        gameState.lastDefensePlay = gameState.selectedDefensePlay;
        sounds.hike();
      }
    }

    // Kickoff
    if ((key === 'k' || code === 'KeyK') && !gameState.isLive && !gameState.isResetting) {
      e.preventDefault();
      gameState.ballPos.set(-8.4, 0, 0); // Own 35-yard line
      resetBall(false);
      gameState.selectedOffensePlay = 'kickoff';
      gameState.selectedDefensePlay = 'kickoff-return';
      setupFormation();
      gameState.kickoffState = 'READY';
      gameState.isKickoff = true;
      gameState.message = 'KICKOFF READY';
      isPlaybookVisible = false;
      playbookBar.style.display = 'none';
      playbookHint.style.display = 'block';
      sounds.select();
    }
    
    // Pass
    if ((key === ' ' || code === 'Space') && gameState.isLive && ballState.heldBy && ballState.heldBy.role === 'QB' && !gameState.isChargingPass) {
      e.preventDefault();
      gameState.isChargingPass = true;
      gameState.passChargeProgress = 0;
      // Random offset between -20 and 20 units (yards)
      gameState.passChargeOffset.set(
        (Math.random() - 0.5) * 40,
        0,
        (Math.random() - 0.5) * 40
      );
    }

    // Cycle receivers / Kickoff player selection
    const canSelect = !gameState.isLive || (gameState.isLive && ballState.heldBy && ballState.heldBy.role === 'QB');
    if (canSelect || (gameState.isKickoff && !gameState.isLive)) {
      if (key === 'q' || code === 'KeyQ') {
        e.preventDefault();
        if (gameState.isKickoff && !gameState.isLive) {
          gameState.selectedKickoffPlayerIndex = (gameState.selectedKickoffPlayerIndex - 1 + offenseTeam.length) % offenseTeam.length;
          sounds.select();
        } else {
          const receivers = getEligibleReceivers();
          if (receivers.length > 0) {
            gameState.selectedReceiverIndex = (gameState.selectedReceiverIndex - 1 + receivers.length) % receivers.length;
            sounds.select();
            updateHUD();
          }
        }
      }
      if (key === 'e' || code === 'KeyE') {
        e.preventDefault();
        if (gameState.isKickoff && !gameState.isLive) {
          gameState.selectedKickoffPlayerIndex = (gameState.selectedKickoffPlayerIndex + 1) % offenseTeam.length;
          sounds.select();
        } else {
          const receivers = getEligibleReceivers();
          if (receivers.length > 0) {
            gameState.selectedReceiverIndex = (gameState.selectedReceiverIndex + 1) % receivers.length;
            sounds.select();
            updateHUD();
          }
        }
      }
    }

    if (key === 'r' || code === 'KeyR') {
      e.preventDefault();
      gameState.scoreA = 0;
      gameState.scoreB = 0;
      gameState.period = 1;
      gameState.timer = 60;
      gameState.ballPos.x = -FIELD_W / 2 + EZONE_W + 20 * UNITS_PER_YARD;
      gameState.isLive = false;
      isPlaybookVisible = true;
      playbookBar.style.display = 'flex';
      playbookHint.style.display = 'none';
      setupFormation();
      resetBall();
    }
    // Toggle Playbook
    if (key === 'p' || code === 'KeyP') {
      e.preventDefault();
      isPlaybookVisible = !isPlaybookVisible;
      playbookBar.style.display = isPlaybookVisible ? 'flex' : 'none';
      playbookHint.style.display = isPlaybookVisible ? 'none' : 'block';
    }
    // Play Selection
    if (key === '1') {
      gameState.selectedOffensePlay = 'slant-flood';
      gameState.isKickoff = false;
      if (!gameState.isLive) {
        setupFormation();
        isPlaybookVisible = false;
        playbookBar.style.display = 'none';
        playbookHint.style.display = 'block';
      }
    }
    if (key === '2') {
      gameState.selectedOffensePlay = 'four-verts';
      gameState.isKickoff = false;
      if (!gameState.isLive) {
        setupFormation();
        isPlaybookVisible = false;
        playbookBar.style.display = 'none';
        playbookHint.style.display = 'block';
      }
    }
  });
  window.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    keys[key] = false;
    if (key === ' ' || e.code === 'Space') {
      if (gameState.isChargingPass && ballState.heldBy) {
        gameState.isChargingPass = false;
        
        // EXECUTE THROW
        ballState.lastHeldBy = ballState.heldBy;
        ballState.heldBy = null;
        ballState.isFlying = true;
        
        const receivers = getEligibleReceivers();
        const target = receivers[gameState.selectedReceiverIndex];
        
        if (target) {
          // Target point is based on current charge progress and receiver's lead position
          const leadPos = calculateLeadPosition(ballState.pos, target);
          const currentOffset = gameState.passChargeOffset.clone().multiplyScalar(1.0 - gameState.passChargeProgress);
          const targetPos = leadPos.clone().add(currentOffset);
          
          const dx = targetPos.x - ballState.pos.x;
          const dz = targetPos.z - ballState.pos.z;
          const distH = Math.sqrt(dx * dx + dz * dz);
          const speedH = 18;
          const time = distH / speedH;
          
          const vel = new THREE.Vector3(dx, 0, dz).normalize().multiplyScalar(speedH);
          // vy = 4.9 * t to return to y=1.2 (chest height)
          vel.y = 4.9 * time;
          
          ballState.vel.copy(vel);
          sounds.throw();
        } else {
          ballState.vel.set(18, 7, 0);
        }
      }
      gameState.isChargingPass = false;
    }
  });

  animate();

  return {
    setLighting: (preset: string) => {
      const p = LIGHTING_PRESETS[preset as keyof typeof LIGHTING_PRESETS] || LIGHTING_PRESETS.NOON;
      sun.intensity = p.sun;
      amb.intensity = p.amb;
      scene.background = new THREE.Color(p.sky);
    },
    setCameraMode: (mode: 'FOLLOW_BEHIND' | 'BROADCAST' | 'SIDELINE' | 'FIXED_ENDZONE') => cameraMode = mode,
    setUniform: (team: 'A' | 'B', index: number) => {
      if (team === 'A') teamAUniformIndex = index;
      else teamBUniformIndex = index;
      setupFormation();
    },
    getPlayers: () => players.map(p => ({
      role: p.role,
      team: p.team,
      name: p.name,
      stats: p.stats
    })),
    getOrbitViewTexture: () => orbitRenderTarget.texture,
    setOrbitCanvas: (canvas: HTMLCanvasElement) => {
      const orbitRenderer = new THREE.WebGLRenderer({ canvas, antialias: true });
      orbitRenderer.setSize(256, 256);
      (window as any).orbitRenderer = orbitRenderer;
    },
    setOrbitDefenseCanvas: (canvas: HTMLCanvasElement) => {
      const orbitDefenseRenderer = new THREE.WebGLRenderer({ canvas, antialias: true });
      orbitDefenseRenderer.setSize(256, 256);
      (window as any).orbitDefenseRenderer = orbitDefenseRenderer;
    },
    getSelectedPlayerStats: () => {
      const receivers = getEligibleReceivers();
      const target = receivers[gameState.selectedReceiverIndex];
      return target ? {
        role: target.role,
        team: target.team,
        name: target.name,
        stats: target.stats
      } : null;
    },
    getSelectedDefensePlayerStats: () => {
      const defenders = defenseTeam;
      let target = defenders[gameState.selectedDefenderIndex];
      if (!target) {
        target = defenders[Math.floor(Math.random() * defenders.length)];
      }
      return target ? {
        role: target.role,
        team: target.team,
        name: target.name,
        stats: target.stats
      } : null;
    },
    selectRandomDefensePlayer: () => {
      const linebackers = defenseTeam.filter(p => p.role === 'LB');
      if (linebackers.length > 0) {
        gameState.selectedDefenderIndex = defenseTeam.indexOf(linebackers[Math.floor(Math.random() * linebackers.length)]);
      } else {
        gameState.selectedDefenderIndex = Math.floor(Math.random() * defenseTeam.length);
      }
    },
    getIsLive: () => gameState.isLive,
    performPossessionSwap,
    setGroundVisible: (visible: boolean) => {
      ground.visible = visible;
    },
    setFieldVisible: (visible: boolean) => {
      fieldElements.forEach(m => m.visible = visible);
    },
    setGrassVisible: (visible: boolean) => {
      fieldGrass.visible = visible;
    }
  };
}
