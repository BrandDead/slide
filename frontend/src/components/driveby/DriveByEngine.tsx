// DriveByEngine.tsx - GTA-Style First-Person Drive-By Shooter
// Cinematic urban warfare with parallax backgrounds, particle effects, screen shake
import React, { useState, useEffect, useRef, useCallback } from 'react';

// ============ TYPES ============
type TargetType = 'gang' | 'civilian' | 'leader';
type BlockDensity = 'empty' | 'normal' | 'hot';

interface Target {
  id: number;
  type: TargetType;
  x: number;
  y: number;
  width: number;
  height: number;
  health: number;
  maxHealth: number;
  bounty: number;
  isShooting: boolean;
  lastShotTime: number;
  velocityX: number;
  sprite: string;
  hitFlash: number;
  deathAnim: number;
}

interface Bullet {
  id: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  speed: number;
  isPlayer: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  type: 'spark' | 'blood' | 'smoke' | 'shell' | 'glass';
}

interface Block {
  type: BlockDensity;
  gangCount: number;
  civilianCount: number;
  style: 'miami' | 'nyc' | 'la' | 'detroit';
}

interface GameStats {
  kills: number;
  civilianHits: number;
  accuracy: number;
  shotsHit: number;
  shotsFired: number;
  blocksCleared: number;
  moneyEarned: number;
}

// ============ CONSTANTS ============
const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;
const CAR_SPEED = 3;
const BULLET_SPEED = 15;
const SHOT_COOLDOWN = 250;
const ENEMY_SHOT_COOLDOWN = 1200;
const MAX_AMMO = 30;
const BLOCK_LENGTH = 2500;
const HEAT_RAID_THRESHOLD = 100;
const CIVILIAN_HEAT_PENALTY = 15;

// Character drawing colors by type
const GANG_COLORS = ['#cc2222', '#aa1111', '#dd3333', '#bb0000', '#ff2222'];
const CIVILIAN_COLORS = ['#4488aa', '#558899', '#336677', '#447799', '#5599bb'];
const LEADER_COLOR = '#ffcc00';

// ============ IMAGE PRELOADER ============
const preloadImages = (urls: string[]): Promise<Record<string, HTMLImageElement>> => {
  return Promise.all(
    urls.map(url => new Promise<[string, HTMLImageElement]>((resolve) => {
      const img = new Image();
      img.onload = () => resolve([url, img]);
      img.onerror = () => resolve([url, img]);
      img.src = url;
    }))
  ).then(entries => Object.fromEntries(entries));
};

// ============ MAIN COMPONENT ============
const DriveByEngine: React.FC<{ onExit?: () => void; onComplete?: (stats: GameStats) => void }> = ({ 
  onExit, 
  onComplete 
}) => {
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'paused' | 'gameover' | 'victory'>('menu');
  const [score, setScore] = useState(0);
  const [heat, setHeat] = useState(0);
  const [carHealth, setCarHealth] = useState(100);
  const [ammo, setAmmo] = useState(MAX_AMMO);
  const [currentBlock, setCurrentBlock] = useState(0);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [targets, setTargets] = useState<Target[]>([]);
  const [bullets, setBullets] = useState<Bullet[]>([]);
  const [crosshair, setCrosshair] = useState({ x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2 });
  const [stats, setStats] = useState<GameStats>({
    kills: 0, civilianHits: 0, accuracy: 0, shotsHit: 0, shotsFired: 0, blocksCleared: 0, moneyEarned: 0
  });
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameLoopRef = useRef<number>(0);
  const lastShotRef = useRef(0);
  const blockPosRef = useRef(0);
  const parallaxRef = useRef({ bg: 0, mid: 0, fg: 0 });
  const particlesRef = useRef<Particle[]>([]);
  const shakeRef = useRef({ x: 0, y: 0, intensity: 0 });
  const muzzleFlashRef = useRef(0);
  const imagesRef = useRef<Record<string, HTMLImageElement>>({});
  const damageFlashRef = useRef(0);

  // Preload images
  useEffect(() => {
    preloadImages([
      '/assets/skyline_layer.jpg',
      '/assets/street_bg_layer.jpg',
      '/assets/street_fg_layer.jpg',
      '/assets/bg_driveby.jpg',
    ]).then(imgs => {
      imagesRef.current = imgs;
    });
  }, []);

  // ============ PARTICLE SYSTEM ============
  const addParticles = useCallback((x: number, y: number, type: Particle['type'], count: number) => {
    const newParticles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 4 + 1;
      let color = '#ffaa00';
      let size = 2;
      let life = 20;

      switch (type) {
        case 'spark':
          color = ['#ffff00', '#ffaa00', '#ff6600', '#ffffff'][Math.floor(Math.random() * 4)];
          size = Math.random() * 3 + 1;
          life = 15 + Math.random() * 10;
          break;
        case 'blood':
          color = ['#cc0000', '#990000', '#ff2222', '#880000'][Math.floor(Math.random() * 4)];
          size = Math.random() * 4 + 2;
          life = 20 + Math.random() * 15;
          break;
        case 'smoke':
          color = `rgba(${100 + Math.random() * 50}, ${100 + Math.random() * 50}, ${100 + Math.random() * 50}, 0.5)`;
          size = Math.random() * 8 + 4;
          life = 30 + Math.random() * 20;
          break;
        case 'shell':
          color = '#ccaa44';
          size = 3;
          life = 40;
          break;
        case 'glass':
          color = ['#aaddff', '#88ccee', '#ffffff'][Math.floor(Math.random() * 3)];
          size = Math.random() * 3 + 1;
          life = 25;
          break;
      }

      newParticles.push({
        x, y,
        vx: Math.cos(angle) * speed * (type === 'shell' ? 0.5 : 1),
        vy: Math.sin(angle) * speed - (type === 'shell' ? 2 : 0),
        life, maxLife: life,
        color, size, type
      });
    }
    particlesRef.current = [...particlesRef.current, ...newParticles].slice(-200);
  }, []);

  // ============ SCREEN SHAKE ============
  const triggerShake = useCallback((intensity: number) => {
    shakeRef.current.intensity = Math.max(shakeRef.current.intensity, intensity);
  }, []);

  // ============ GAME INITIALIZATION ============
  const initGame = useCallback(() => {
    setScore(0);
    setHeat(0);
    setCarHealth(100);
    setAmmo(MAX_AMMO);
    setCurrentBlock(0);
    setTargets([]);
    setBullets([]);
    blockPosRef.current = 0;
    parallaxRef.current = { bg: 0, mid: 0, fg: 0 };
    particlesRef.current = [];
    shakeRef.current = { x: 0, y: 0, intensity: 0 };
    muzzleFlashRef.current = 0;
    damageFlashRef.current = 0;
    setStats({ kills: 0, civilianHits: 0, accuracy: 0, shotsHit: 0, shotsFired: 0, blocksCleared: 0, moneyEarned: 0 });

    const newBlocks: Block[] = [];
    const styles: Block['style'][] = ['miami', 'nyc', 'la', 'detroit'];
    
    for (let i = 0; i < 10; i++) {
      const difficulty = Math.min(i / 10, 0.7);
      const rand = Math.random();
      let type: BlockDensity;
      let gangCount: number;
      let civilianCount: number;
      
      if (rand < 0.3 - difficulty * 0.2) {
        type = 'empty';
        gangCount = Math.floor(Math.random() * 3) + 2;
        civilianCount = Math.floor(Math.random() * 2) + 1;
      } else if (rand < 0.7) {
        type = 'normal';
        gangCount = Math.floor(Math.random() * 5) + 8;
        civilianCount = Math.floor(Math.random() * 5) + 3;
      } else {
        type = 'hot';
        gangCount = Math.floor(Math.random() * 10) + 15;
        civilianCount = Math.floor(Math.random() * 8) + 5;
      }
      
      newBlocks.push({ type, gangCount, civilianCount, style: styles[i % styles.length] });
    }
    
    setBlocks(newBlocks);
    setGameState('playing');
  }, []);

  // ============ SPAWN TARGETS ============
  const spawnTargets = useCallback((block: Block) => {
    const newTargets: Target[] = [];
    let id = Date.now();

    for (let i = 0; i < block.gangCount; i++) {
      const isLeader = i === 0 && Math.random() < 0.15;
      newTargets.push({
        id: id++,
        type: isLeader ? 'leader' : 'gang',
        x: Math.random() * (GAME_WIDTH - 100) + 50,
        y: GAME_HEIGHT * 0.35 + Math.random() * (GAME_HEIGHT * 0.25),
        width: 30,
        height: 55,
        health: isLeader ? 150 : 50,
        maxHealth: isLeader ? 150 : 50,
        bounty: isLeader ? 500 : Math.floor(Math.random() * 150) + 50,
        isShooting: false,
        lastShotTime: 0,
        velocityX: (Math.random() - 0.5) * 2,
        sprite: isLeader ? 'leader' : 'gang',
        hitFlash: 0,
        deathAnim: 0,
      });
    }

    for (let i = 0; i < block.civilianCount; i++) {
      newTargets.push({
        id: id++,
        type: 'civilian',
        x: Math.random() * (GAME_WIDTH - 100) + 50,
        y: GAME_HEIGHT * 0.4 + Math.random() * (GAME_HEIGHT * 0.2),
        width: 25,
        height: 50,
        health: 30,
        maxHealth: 30,
        bounty: -500,
        isShooting: false,
        lastShotTime: 0,
        velocityX: (Math.random() - 0.5) * 3,
        sprite: 'civilian',
        hitFlash: 0,
        deathAnim: 0,
      });
    }

    setTargets(newTargets);
  }, []);

  // ============ SHOOTING ============
  const shoot = useCallback((x: number, y: number) => {
    if (gameState !== 'playing' || ammo <= 0) return;
    
    const now = Date.now();
    if (now - lastShotRef.current < SHOT_COOLDOWN) return;
    
    lastShotRef.current = now;
    setAmmo(prev => prev - 1);
    setStats(prev => ({ ...prev, shotsFired: prev.shotsFired + 1 }));

    playSound('shoot');
    muzzleFlashRef.current = 6;
    triggerShake(3);

    // Shell casing particle
    addParticles(GAME_WIDTH * 0.68, GAME_HEIGHT * 0.7, 'shell', 1);
    // Muzzle sparks
    addParticles(GAME_WIDTH * 0.72, GAME_HEIGHT * 0.68, 'spark', 3);

    setBullets(prev => [...prev, {
      id: now,
      x: GAME_WIDTH * 0.7,
      y: GAME_HEIGHT * 0.75,
      targetX: x,
      targetY: y,
      speed: BULLET_SPEED,
      isPlayer: true
    }]);
  }, [gameState, ammo, addParticles, triggerShake]);

  // ============ AUDIO ============
  const audioCtxRef = useRef<AudioContext | null>(null);
  
  const playSound = useCallback((type: 'shoot' | 'hit' | 'miss' | 'death' | 'damage') => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const ctx = audioCtxRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    switch (type) {
      case 'shoot':
        osc.frequency.setValueAtTime(900, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.35, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
        osc.type = 'sawtooth';
        break;
      case 'hit':
        osc.frequency.setValueAtTime(250, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        osc.type = 'square';
        break;
      case 'death':
        osc.frequency.setValueAtTime(400, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.35);
        gain.gain.setValueAtTime(0.5, ctx.currentTime);
        osc.type = 'sawtooth';
        break;
      case 'damage':
        osc.frequency.setValueAtTime(120, ctx.currentTime);
        gain.gain.setValueAtTime(0.35, ctx.currentTime);
        osc.type = 'sine';
        break;
    }
    
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  }, []);

  // ============ DRAW CHARACTER ============
  const drawCharacter = useCallback((ctx: CanvasRenderingContext2D, target: Target) => {
    const cx = target.x + target.width / 2;
    const cy = target.y;
    const h = target.height;
    const w = target.width;

    ctx.save();

    // Hit flash effect
    if (target.hitFlash > 0) {
      ctx.globalAlpha = 0.5 + (target.hitFlash / 10) * 0.5;
    }

    let bodyColor: string;
    let pantsColor: string;
    let skinColor: string;

    if (target.type === 'leader') {
      bodyColor = LEADER_COLOR;
      pantsColor = '#333333';
      skinColor = '#8B6914';
    } else if (target.type === 'gang') {
      bodyColor = GANG_COLORS[target.id % GANG_COLORS.length];
      pantsColor = '#222222';
      skinColor = '#7a5c3a';
    } else {
      bodyColor = CIVILIAN_COLORS[target.id % CIVILIAN_COLORS.length];
      pantsColor = '#3a3a5a';
      skinColor = '#9a7a5a';
    }

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + h, w * 0.6, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Legs
    ctx.fillStyle = pantsColor;
    ctx.fillRect(cx - w * 0.25, cy + h * 0.55, w * 0.2, h * 0.4);
    ctx.fillRect(cx + w * 0.05, cy + h * 0.55, w * 0.2, h * 0.4);

    // Shoes
    ctx.fillStyle = '#111111';
    ctx.fillRect(cx - w * 0.3, cy + h * 0.9, w * 0.25, h * 0.1);
    ctx.fillRect(cx + w * 0.05, cy + h * 0.9, w * 0.25, h * 0.1);

    // Body / Torso
    ctx.fillStyle = bodyColor;
    const bodyGrad = ctx.createLinearGradient(cx, cy + h * 0.2, cx, cy + h * 0.6);
    bodyGrad.addColorStop(0, bodyColor);
    bodyGrad.addColorStop(1, darkenColor(bodyColor, 0.3));
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.roundRect(cx - w * 0.35, cy + h * 0.2, w * 0.7, h * 0.4, 3);
    ctx.fill();

    // Arms
    ctx.fillStyle = bodyColor;
    ctx.fillRect(cx - w * 0.5, cy + h * 0.22, w * 0.18, h * 0.3);
    ctx.fillRect(cx + w * 0.32, cy + h * 0.22, w * 0.18, h * 0.3);

    // Hands
    ctx.fillStyle = skinColor;
    ctx.beginPath();
    ctx.arc(cx - w * 0.42, cy + h * 0.52, 4, 0, Math.PI * 2);
    ctx.arc(cx + w * 0.42, cy + h * 0.52, 4, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.fillStyle = skinColor;
    ctx.beginPath();
    ctx.arc(cx, cy + h * 0.12, w * 0.3, 0, Math.PI * 2);
    ctx.fill();

    // Hair/hat
    if (target.type === 'gang' || target.type === 'leader') {
      ctx.fillStyle = target.type === 'leader' ? '#ffdd44' : '#222222';
      ctx.beginPath();
      ctx.ellipse(cx, cy + h * 0.05, w * 0.35, w * 0.15, 0, 0, Math.PI * 2);
      ctx.fill();
      // Bandana/headband
      ctx.fillStyle = target.type === 'leader' ? '#ff0000' : '#cc0000';
      ctx.fillRect(cx - w * 0.32, cy + h * 0.08, w * 0.64, 3);
    }

    // Eyes
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx - 5, cy + h * 0.1, 3, 2);
    ctx.fillRect(cx + 2, cy + h * 0.1, 3, 2);
    ctx.fillStyle = '#000000';
    ctx.fillRect(cx - 4, cy + h * 0.1, 2, 2);
    ctx.fillRect(cx + 3, cy + h * 0.1, 2, 2);

    // Gang indicator - red dot above head
    if (target.type === 'gang' || target.type === 'leader') {
      ctx.fillStyle = target.type === 'leader' ? '#ffd700' : '#ff3333';
      ctx.shadowColor = target.type === 'leader' ? '#ffd700' : '#ff3333';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(cx, cy - 8, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Gun in hand for gang members
    if (target.type !== 'civilian' && target.isShooting) {
      ctx.fillStyle = '#333333';
      ctx.fillRect(cx + w * 0.35, cy + h * 0.42, 12, 4);
      ctx.fillRect(cx + w * 0.35 + 8, cy + h * 0.38, 3, 8);
      // Muzzle flash when shooting
      ctx.fillStyle = '#ffff00';
      ctx.shadowColor = '#ffaa00';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(cx + w * 0.35 + 14, cy + h * 0.44, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Health bar
    if (target.health < target.maxHealth) {
      const barW = w * 1.2;
      const barH = 4;
      const barX = cx - barW / 2;
      const barY = cy - 16;
      
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
      ctx.fillStyle = '#ff0000';
      ctx.fillRect(barX, barY, barW, barH);
      ctx.fillStyle = target.type === 'civilian' ? '#00aaff' : '#00ff88';
      ctx.fillRect(barX, barY, (barW * target.health) / target.maxHealth, barH);
    }

    // Hit flash overlay
    if (target.hitFlash > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${target.hitFlash / 10})`;
      ctx.beginPath();
      ctx.arc(cx, cy + h * 0.4, w * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }, []);

  // ============ GAME LOOP ============
  useEffect(() => {
    if (gameState !== 'playing') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let lastTime = 0;

    const gameLoop = (timestamp: number) => {
      // deltaTime available for future frame-rate-independent animations
      const _dt = timestamp - lastTime; void _dt;
      lastTime = timestamp;

      // Update parallax
      parallaxRef.current.bg += CAR_SPEED * 0.3;
      parallaxRef.current.mid += CAR_SPEED * 0.6;
      parallaxRef.current.fg += CAR_SPEED;
      blockPosRef.current += CAR_SPEED;

      // Update screen shake
      if (shakeRef.current.intensity > 0) {
        shakeRef.current.x = (Math.random() - 0.5) * shakeRef.current.intensity * 2;
        shakeRef.current.y = (Math.random() - 0.5) * shakeRef.current.intensity * 2;
        shakeRef.current.intensity *= 0.85;
        if (shakeRef.current.intensity < 0.3) shakeRef.current.intensity = 0;
      }

      // Update muzzle flash
      if (muzzleFlashRef.current > 0) muzzleFlashRef.current--;
      if (damageFlashRef.current > 0) damageFlashRef.current--;

      // Update particles
      particlesRef.current = particlesRef.current.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.15; // gravity
        p.life--;
        if (p.type === 'smoke') {
          p.size *= 1.02;
          p.vy -= 0.3;
        }
        return p.life > 0;
      });

      // Check block transition
      if (blockPosRef.current >= BLOCK_LENGTH) {
        blockPosRef.current = 0;
        const nextBlock = currentBlock + 1;
        
        if (nextBlock >= blocks.length) {
          setGameState('victory');
          if (onComplete) onComplete(stats);
          return;
        }
        
        setCurrentBlock(nextBlock);
        setStats(prev => ({ ...prev, blocksCleared: prev.blocksCleared + 1 }));
        spawnTargets(blocks[nextBlock]);
        setAmmo(MAX_AMMO);
      }

      // Update targets
      setTargets(prev => prev.map(target => {
        let newTarget = { ...target };
        
        newTarget.x += newTarget.velocityX;
        if (newTarget.x < 50 || newTarget.x > GAME_WIDTH - 50) {
          newTarget.velocityX *= -1;
        }

        // Decay hit flash
        if (newTarget.hitFlash > 0) newTarget.hitFlash -= 0.5;

        // Gang members shoot back
        if (target.type !== 'civilian') {
          const now = Date.now();
          if (Math.random() < 0.02 && now - target.lastShotTime > ENEMY_SHOT_COOLDOWN) {
            newTarget.isShooting = true;
            newTarget.lastShotTime = now;
            
            setBullets(prev => [...prev, {
              id: now + target.id,
              x: target.x + target.width / 2,
              y: target.y + target.height / 2,
              targetX: GAME_WIDTH * 0.5 + (Math.random() - 0.5) * 200,
              targetY: GAME_HEIGHT * 0.8,
              speed: BULLET_SPEED * 0.6,
              isPlayer: false
            }]);
          } else if (now - target.lastShotTime > 300) {
            newTarget.isShooting = false;
          }
        }

        return newTarget;
      }));

      // Update bullets and check collisions
      setBullets(prev => {
        const remaining: Bullet[] = [];
        
        prev.forEach(bullet => {
          const dx = bullet.targetX - bullet.x;
          const dy = bullet.targetY - bullet.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist < bullet.speed) {
            if (bullet.isPlayer) {
              setTargets(targets => {
                let hit = false;
                const updated = targets.map(target => {
                  if (hit) return target;
                  if (bullet.targetX > target.x && bullet.targetX < target.x + target.width &&
                      bullet.targetY > target.y && bullet.targetY < target.y + target.height) {
                    hit = true;
                    const isHeadshot = bullet.targetY < target.y + target.height * 0.3;
                    const damage = isHeadshot ? 100 : 50;
                    const newHealth = target.health - damage;
                    
                    // Blood particles
                    addParticles(bullet.targetX, bullet.targetY, 'blood', isHeadshot ? 12 : 6);
                    
                    if (newHealth <= 0) {
                      playSound('death');
                      addParticles(target.x + target.width / 2, target.y + target.height / 2, 'blood', 15);
                      if (target.type === 'civilian') {
                        setHeat(h => Math.min(100, h + CIVILIAN_HEAT_PENALTY));
                        setStats(s => ({ ...s, civilianHits: s.civilianHits + 1 }));
                      } else {
                        setScore(s => s + target.bounty);
                        setStats(s => ({ 
                          ...s, 
                          kills: s.kills + 1, 
                          shotsHit: s.shotsHit + 1,
                          moneyEarned: s.moneyEarned + target.bounty 
                        }));
                      }
                      return null;
                    }
                    
                    playSound('hit');
                    setStats(s => ({ ...s, shotsHit: s.shotsHit + 1 }));
                    return { ...target, health: newHealth, hitFlash: 8 };
                  }
                  return target;
                }).filter(Boolean) as Target[];
                
                if (!hit) {
                  // Miss - spark on ground/wall
                  addParticles(bullet.targetX, bullet.targetY, 'spark', 4);
                }
                
                return updated;
              });
            } else {
              // Enemy bullet hits player
              setCarHealth(h => {
                const newHealth = h - 10;
                if (newHealth <= 0) {
                  setGameState('gameover');
                  if (onComplete) onComplete(stats);
                }
                playSound('damage');
                triggerShake(5);
                damageFlashRef.current = 8;
                addParticles(
                  GAME_WIDTH * 0.3 + Math.random() * GAME_WIDTH * 0.4,
                  GAME_HEIGHT * 0.6 + Math.random() * 100,
                  'glass', 5
                );
                return Math.max(0, newHealth);
              });
            }
            return;
          }
          
          remaining.push({
            ...bullet,
            x: bullet.x + (dx / dist) * bullet.speed,
            y: bullet.y + (dy / dist) * bullet.speed
          });
        });
        
        return remaining;
      });

      // Check raid threshold
      if (heat >= HEAT_RAID_THRESHOLD) {
        setGameState('gameover');
        if (onComplete) onComplete(stats);
        return;
      }

      // Render
      render(ctx);

      gameLoopRef.current = requestAnimationFrame(gameLoop);
    };

    if (blocks.length > 0 && targets.length === 0) {
      spawnTargets(blocks[0]);
    }

    gameLoopRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    };
  }, [gameState, currentBlock, blocks, heat, stats, spawnTargets, playSound, onComplete, addParticles, triggerShake, drawCharacter]);

  // ============ RENDERING ============
  const render = useCallback((ctx: CanvasRenderingContext2D) => {
    const block = blocks[currentBlock];
    
    ctx.save();
    
    // Apply screen shake
    if (shakeRef.current.intensity > 0) {
      ctx.translate(shakeRef.current.x, shakeRef.current.y);
    }

    // === BACKGROUND: Dark sky with city glow ===
    const skyGrad = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT * 0.45);
    skyGrad.addColorStop(0, '#050510');
    skyGrad.addColorStop(0.4, '#0a0a1a');
    skyGrad.addColorStop(0.7, '#151525');
    skyGrad.addColorStop(1, '#1a1020');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // === SKYLINE LAYER (slowest parallax) ===
    const skyImg = imagesRef.current['/assets/skyline_layer.jpg'];
    if (skyImg && skyImg.complete && skyImg.naturalWidth > 0) {
      const skyW = GAME_WIDTH * 2;
      const skyH = GAME_HEIGHT * 0.35;
      const skyX = -(parallaxRef.current.bg % skyW);
      ctx.globalAlpha = 0.5;
      ctx.drawImage(skyImg, skyX, GAME_HEIGHT * 0.05, skyW, skyH);
      ctx.drawImage(skyImg, skyX + skyW, GAME_HEIGHT * 0.05, skyW, skyH);
      ctx.globalAlpha = 1;
    } else {
      // Fallback: procedural skyline
      ctx.fillStyle = '#1a1a2a';
      for (let i = 0; i < 15; i++) {
        const x = ((i * 80) - (parallaxRef.current.bg % 80) + GAME_WIDTH) % (GAME_WIDTH + 80) - 40;
        const h = 60 + Math.sin(i * 0.8) * 30;
        ctx.fillRect(x, GAME_HEIGHT * 0.35 - h, 60, h + 20);
      }
    }

    // === BUILDINGS LAYER (medium parallax) ===
    const bgImg = imagesRef.current['/assets/street_bg_layer.jpg'];
    if (bgImg && bgImg.complete && bgImg.naturalWidth > 0) {
      const bgW = GAME_WIDTH * 2;
      const bgH = GAME_HEIGHT * 0.45;
      const bgX = -(parallaxRef.current.mid % bgW);
      ctx.drawImage(bgImg, bgX, GAME_HEIGHT * 0.15, bgW, bgH);
      ctx.drawImage(bgImg, bgX + bgW, GAME_HEIGHT * 0.15, bgW, bgH);
    } else {
      // Fallback: procedural buildings
      for (let i = 0; i < 12; i++) {
        const x = ((i * 100) - (parallaxRef.current.mid % 100) + GAME_WIDTH) % (GAME_WIDTH + 100) - 50;
        const h = 80 + Math.sin(i * 0.7) * 40;
        
        // Building body
        const bGrad = ctx.createLinearGradient(x, GAME_HEIGHT * 0.35 - h, x, GAME_HEIGHT * 0.55);
        bGrad.addColorStop(0, '#1a1a28');
        bGrad.addColorStop(1, '#252535');
        ctx.fillStyle = bGrad;
        ctx.fillRect(x, GAME_HEIGHT * 0.35 - h, 80, h + GAME_HEIGHT * 0.2);
        
        // Windows with warm glow
        for (let w = 0; w < 4; w++) {
          for (let wh = 0; wh < 4; wh++) {
            if (Math.sin(i + w + wh * 2.1) > 0.1) {
              const windowOn = Math.sin(i * 3.7 + w * 1.3 + wh * 2.1) > 0;
              ctx.fillStyle = windowOn 
                ? `rgba(255, ${180 + Math.random() * 40}, ${80 + Math.random() * 40}, 0.7)` 
                : 'rgba(20, 20, 40, 0.8)';
              ctx.fillRect(x + 8 + w * 18, GAME_HEIGHT * 0.35 - h + 12 + wh * 22, 10, 14);
            }
          }
        }
      }
    }

    // === STREET / SIDEWALK ===
    // Road
    const roadGrad = ctx.createLinearGradient(0, GAME_HEIGHT * 0.55, 0, GAME_HEIGHT);
    roadGrad.addColorStop(0, '#2a2a35');
    roadGrad.addColorStop(0.3, '#222230');
    roadGrad.addColorStop(1, '#1a1a25');
    ctx.fillStyle = roadGrad;
    ctx.fillRect(0, GAME_HEIGHT * 0.55, GAME_WIDTH, GAME_HEIGHT * 0.45);

    // Sidewalk curb
    ctx.fillStyle = '#3a3a4a';
    ctx.fillRect(0, GAME_HEIGHT * 0.55, GAME_WIDTH, 6);

    // Road markings
    ctx.fillStyle = 'rgba(255, 255, 100, 0.15)';
    for (let i = 0; i < 20; i++) {
      const x = ((i * 80) - (parallaxRef.current.fg % 80) + GAME_WIDTH) % (GAME_WIDTH + 80) - 40;
      ctx.fillRect(x, GAME_HEIGHT * 0.72, 40, 3);
    }

    // Street light pools
    for (let i = 0; i < 5; i++) {
      const x = ((i * 250) - (parallaxRef.current.mid % 250) + GAME_WIDTH) % (GAME_WIDTH + 250) - 125;
      const lightGrad = ctx.createRadialGradient(x, GAME_HEIGHT * 0.5, 0, x, GAME_HEIGHT * 0.5, 120);
      lightGrad.addColorStop(0, 'rgba(255, 180, 80, 0.08)');
      lightGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = lightGrad;
      ctx.fillRect(x - 120, GAME_HEIGHT * 0.38, 240, 200);
      
      // Light pole
      ctx.fillStyle = '#333340';
      ctx.fillRect(x - 2, GAME_HEIGHT * 0.3, 4, GAME_HEIGHT * 0.25);
      ctx.fillStyle = '#ffcc66';
      ctx.shadowColor = '#ffaa44';
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(x, GAME_HEIGHT * 0.3, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Parked cars
    for (let i = 0; i < 8; i++) {
      const x = ((i * 150) - (parallaxRef.current.fg % 150) + GAME_WIDTH) % (GAME_WIDTH + 150) - 75;
      const carColors = ['#1a1a2a', '#2a1a1a', '#1a2a1a', '#2a2a1a', '#1a1a3a'];
      ctx.fillStyle = carColors[i % carColors.length];
      
      // Car body
      ctx.beginPath();
      ctx.roundRect(x, GAME_HEIGHT * 0.58, 65, 22, 3);
      ctx.fill();
      // Car roof
      ctx.fillRect(x + 12, GAME_HEIGHT * 0.55, 35, 12);
      // Windows
      ctx.fillStyle = 'rgba(100, 150, 200, 0.15)';
      ctx.fillRect(x + 14, GAME_HEIGHT * 0.555, 14, 8);
      ctx.fillRect(x + 32, GAME_HEIGHT * 0.555, 14, 8);
      // Wheels
      ctx.fillStyle = '#111115';
      ctx.beginPath();
      ctx.arc(x + 14, GAME_HEIGHT * 0.6 + 2, 5, 0, Math.PI * 2);
      ctx.arc(x + 52, GAME_HEIGHT * 0.6 + 2, 5, 0, Math.PI * 2);
      ctx.fill();
      // Tail lights
      ctx.fillStyle = 'rgba(255, 0, 0, 0.4)';
      ctx.fillRect(x, GAME_HEIGHT * 0.59, 3, 6);
    }

    // === DRAW TARGETS ===
    targets.forEach(target => {
      drawCharacter(ctx, target);
    });

    // === DRAW BULLETS ===
    bullets.forEach(bullet => {
      if (bullet.isPlayer) {
        // Player bullet - bright tracer
        ctx.fillStyle = '#ffff44';
        ctx.shadowColor = '#ffaa00';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        
        // Tracer trail
        const dx = bullet.targetX - bullet.x;
        const dy = bullet.targetY - bullet.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const trailLen = 15;
        ctx.strokeStyle = 'rgba(255, 200, 50, 0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(bullet.x, bullet.y);
        ctx.lineTo(
          bullet.x - (dx / dist) * trailLen,
          bullet.y - (dy / dist) * trailLen
        );
        ctx.stroke();
      } else {
        // Enemy bullet - red tracer
        ctx.fillStyle = '#ff3333';
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        
        ctx.strokeStyle = 'rgba(255, 50, 50, 0.3)';
        ctx.lineWidth = 2;
        const dx = bullet.targetX - bullet.x;
        const dy = bullet.targetY - bullet.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        ctx.beginPath();
        ctx.moveTo(bullet.x, bullet.y);
        ctx.lineTo(bullet.x - (dx / dist) * 12, bullet.y - (dy / dist) * 12);
        ctx.stroke();
      }
    });

    // === DRAW PARTICLES ===
    particlesRef.current.forEach(p => {
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      
      if (p.type === 'smoke') {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'shell') {
        ctx.fillRect(p.x - 1, p.y - 2, 3, 5);
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    });

    // === CAR INTERIOR FRAME ===
    // Left pillar
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, GAME_WIDTH * 0.08, GAME_HEIGHT);
    // Gradient edge
    const leftGrad = ctx.createLinearGradient(GAME_WIDTH * 0.08, 0, GAME_WIDTH * 0.15, 0);
    leftGrad.addColorStop(0, 'rgba(10, 10, 10, 0.9)');
    leftGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = leftGrad;
    ctx.fillRect(GAME_WIDTH * 0.08, 0, GAME_WIDTH * 0.07, GAME_HEIGHT);

    // Right pillar
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(GAME_WIDTH * 0.92, 0, GAME_WIDTH * 0.08, GAME_HEIGHT);
    const rightGrad = ctx.createLinearGradient(GAME_WIDTH * 0.92, 0, GAME_WIDTH * 0.85, 0);
    rightGrad.addColorStop(0, 'rgba(10, 10, 10, 0.9)');
    rightGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = rightGrad;
    ctx.fillRect(GAME_WIDTH * 0.85, 0, GAME_WIDTH * 0.07, GAME_HEIGHT);

    // Top frame
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT * 0.04);

    // Dashboard
    const dashGrad = ctx.createLinearGradient(0, GAME_HEIGHT * 0.78, 0, GAME_HEIGHT);
    dashGrad.addColorStop(0, 'rgba(10, 10, 10, 0.3)');
    dashGrad.addColorStop(0.2, 'rgba(15, 15, 15, 0.85)');
    dashGrad.addColorStop(1, '#0d0d0d');
    ctx.fillStyle = dashGrad;
    ctx.fillRect(0, GAME_HEIGHT * 0.78, GAME_WIDTH, GAME_HEIGHT * 0.22);

    // Dashboard details
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(GAME_WIDTH * 0.1, GAME_HEIGHT * 0.88, GAME_WIDTH * 0.3, 3);
    ctx.fillStyle = '#222222';
    ctx.beginPath();
    ctx.arc(GAME_WIDTH * 0.25, GAME_HEIGHT * 0.92, 15, 0, Math.PI * 2);
    ctx.fill();

    // Gun
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(GAME_WIDTH * 0.58, GAME_HEIGHT * 0.74, 110, 12);
    ctx.fillRect(GAME_WIDTH * 0.58, GAME_HEIGHT * 0.72, 15, 16);
    ctx.fillRect(GAME_WIDTH * 0.66, GAME_HEIGHT * 0.68, 12, 20);
    // Gun barrel
    ctx.fillStyle = '#333333';
    ctx.fillRect(GAME_WIDTH * 0.68, GAME_HEIGHT * 0.74, 60, 8);
    // Gun grip
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(GAME_WIDTH * 0.6, GAME_HEIGHT * 0.75, 20, 25);

    // Muzzle flash
    if (muzzleFlashRef.current > 0) {
      const flashIntensity = muzzleFlashRef.current / 6;
      ctx.globalAlpha = flashIntensity;
      
      const flashGrad = ctx.createRadialGradient(
        GAME_WIDTH * 0.73, GAME_HEIGHT * 0.72, 0,
        GAME_WIDTH * 0.73, GAME_HEIGHT * 0.72, 40
      );
      flashGrad.addColorStop(0, '#ffffff');
      flashGrad.addColorStop(0.3, '#ffff88');
      flashGrad.addColorStop(0.6, '#ffaa00');
      flashGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = flashGrad;
      ctx.fillRect(GAME_WIDTH * 0.68, GAME_HEIGHT * 0.65, 100, 60);
      
      // Screen flash
      ctx.fillStyle = `rgba(255, 200, 100, ${flashIntensity * 0.05})`;
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
      
      ctx.globalAlpha = 1;
    }

    // Damage flash (red vignette)
    if (damageFlashRef.current > 0) {
      const dmgAlpha = damageFlashRef.current / 8;
      const vignette = ctx.createRadialGradient(
        GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH * 0.2,
        GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH * 0.6
      );
      vignette.addColorStop(0, 'transparent');
      vignette.addColorStop(1, `rgba(200, 0, 0, ${dmgAlpha * 0.4})`);
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    }

    // === CROSSHAIR ===
    ctx.strokeStyle = 'rgba(255, 50, 50, 0.8)';
    ctx.lineWidth = 1.5;
    // Outer circle
    ctx.beginPath();
    ctx.arc(crosshair.x, crosshair.y, 18, 0, Math.PI * 2);
    ctx.stroke();
    // Cross lines with gap
    ctx.beginPath();
    ctx.moveTo(crosshair.x - 25, crosshair.y);
    ctx.lineTo(crosshair.x - 8, crosshair.y);
    ctx.moveTo(crosshair.x + 8, crosshair.y);
    ctx.lineTo(crosshair.x + 25, crosshair.y);
    ctx.moveTo(crosshair.x, crosshair.y - 25);
    ctx.lineTo(crosshair.x, crosshair.y - 8);
    ctx.moveTo(crosshair.x, crosshair.y + 8);
    ctx.lineTo(crosshair.x, crosshair.y + 25);
    ctx.stroke();
    // Center dot
    ctx.fillStyle = '#ff3333';
    ctx.beginPath();
    ctx.arc(crosshair.x, crosshair.y, 2, 0, Math.PI * 2);
    ctx.fill();

    // === HUD ===
    ctx.shadowBlur = 0;
    
    // HUD background strip
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(10, 10, 200, 110);
    ctx.strokeStyle = 'rgba(255, 50, 50, 0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(10, 10, 200, 110);

    ctx.font = 'bold 16px Rajdhani, Orbitron, sans-serif';
    ctx.textAlign = 'left';
    
    // Score
    ctx.fillStyle = '#00ff88';
    ctx.fillText(`$ ${score.toLocaleString()}`, 20, 34);
    
    // Car health
    ctx.fillStyle = carHealth > 50 ? '#ffffff' : carHealth > 25 ? '#ffaa00' : '#ff3333';
    ctx.fillText(`CAR  ${carHealth}%`, 20, 56);
    // Car health bar
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(100, 46, 100, 6);
    ctx.fillStyle = carHealth > 50 ? '#00ff88' : carHealth > 25 ? '#ffaa00' : '#ff3333';
    ctx.fillRect(100, 46, carHealth, 6);
    
    // Ammo
    ctx.fillStyle = ammo > 10 ? '#ffffff' : ammo > 5 ? '#ffaa00' : '#ff3333';
    ctx.fillText(`AMMO  ${ammo}/${MAX_AMMO}`, 20, 78);
    
    // Block
    ctx.fillStyle = '#aaaaaa';
    ctx.font = 'bold 13px Rajdhani, sans-serif';
    ctx.fillText(`BLOCK ${currentBlock + 1}/${blocks.length}`, 20, 98);
    
    // Block progress bar
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(100, 88, 100, 4);
    ctx.fillStyle = '#ff4444';
    ctx.fillRect(100, 88, (blockPosRef.current / BLOCK_LENGTH) * 100, 4);

    // Heat meter (top right)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(GAME_WIDTH - 220, 10, 210, 55);
    ctx.strokeStyle = 'rgba(255, 50, 50, 0.2)';
    ctx.strokeRect(GAME_WIDTH - 220, 10, 210, 55);
    
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(GAME_WIDTH - 210, 22, 190, 14);
    const heatColor = heat > 80 ? '#ff0000' : heat > 50 ? '#ff6600' : heat > 25 ? '#ffaa00' : '#00ff88';
    ctx.fillStyle = heatColor;
    ctx.fillRect(GAME_WIDTH - 210, 22, (heat / 100) * 190, 14);
    
    if (heat > 80) {
      ctx.shadowColor = '#ff0000';
      ctx.shadowBlur = 10;
    }
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px Rajdhani, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`HEAT ${heat}%`, GAME_WIDTH - 18, 34);
    ctx.shadowBlur = 0;

    // Zone type
    if (block) {
      ctx.fillStyle = block.type === 'hot' ? '#ff3333' : block.type === 'normal' ? '#ffaa00' : '#00ff88';
      ctx.font = 'bold 13px Oswald, sans-serif';
      ctx.fillText(`${block.type.toUpperCase()} ZONE`, GAME_WIDTH - 18, 56);
    }

    ctx.restore();
  }, [blocks, currentBlock, targets, bullets, crosshair, score, carHealth, ammo, heat, drawCharacter]);

  // ============ EVENT HANDLERS ============
  const handlePointerMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (gameState !== 'playing') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0]?.clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0]?.clientY : e.clientY;
    
    if (clientX === undefined) return;
    
    const scaleX = GAME_WIDTH / rect.width;
    const scaleY = GAME_HEIGHT / rect.height;
    
    setCrosshair({
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    });
  }, [gameState]);

  const handlePointerDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    handlePointerMove(e);
    shoot(crosshair.x, crosshair.y);
  }, [handlePointerMove, shoot, crosshair]);

  // ============ RENDER UI ============
  return (
    <div style={styles.container}>
      <canvas
        ref={canvasRef}
        width={GAME_WIDTH}
        height={GAME_HEIGHT}
        style={styles.canvas}
        onMouseMove={handlePointerMove}
        onMouseDown={handlePointerDown}
        onTouchMove={handlePointerMove}
        onTouchStart={handlePointerDown}
      />

      {/* Menu Overlay */}
      {gameState === 'menu' && (
        <div style={styles.overlay}>
          <div style={styles.menuBg} />
          <div style={styles.menuContent}>
            <h1 style={styles.title}>DRIVE-BY</h1>
            <p style={styles.subtitle}>STREET WARFARE</p>
            <div style={styles.divider} />
            <div style={styles.instructions}>
              <p style={styles.instructionItem}><span style={styles.instructionIcon}>+</span> Move cursor to aim</p>
              <p style={styles.instructionItem}><span style={{...styles.instructionIcon, color: '#ff3333'}}>!</span> Click/tap to shoot</p>
              <p style={styles.instructionItem}><span style={{...styles.instructionIcon, color: '#ff3333'}}>X</span> Red dots = Gang (SHOOT)</p>
              <p style={styles.instructionItem}><span style={{...styles.instructionIcon, color: '#00aaff'}}>-</span> No dots = Civilians (AVOID)</p>
              <p style={styles.instructionItem}><span style={{...styles.instructionIcon, color: '#ffaa00'}}>~</span> Too much heat = RAID</p>
            </div>
            <button style={styles.startButton} onClick={initGame}>
              START MISSION
            </button>
            {onExit && <button style={styles.exitButton} onClick={onExit}>BACK</button>}
          </div>
        </div>
      )}

      {/* Game Over */}
      {gameState === 'gameover' && (
        <div style={styles.overlay}>
          <div style={styles.menuBg} />
          <div style={styles.menuContent}>
            <h1 style={{ ...styles.title, color: '#ff3333' }}>MISSION FAILED</h1>
            <p style={styles.subtitle}>{heat >= 100 ? 'BLOCK RAIDED BY POLICE' : 'YOUR CAR WAS DESTROYED'}</p>
            <div style={styles.divider} />
            <div style={styles.statsBlock}>
              <div style={styles.statRow}><span style={styles.statLabel}>SCORE</span><span style={{...styles.statValue, color: '#00ff88'}}>${score.toLocaleString()}</span></div>
              <div style={styles.statRow}><span style={styles.statLabel}>KILLS</span><span style={styles.statValue}>{stats.kills}</span></div>
              <div style={styles.statRow}><span style={styles.statLabel}>CIVILIAN HITS</span><span style={{...styles.statValue, color: '#ff6666'}}>{stats.civilianHits}</span></div>
              <div style={styles.statRow}><span style={styles.statLabel}>ACCURACY</span><span style={styles.statValue}>{stats.shotsFired > 0 ? Math.round((stats.shotsHit / stats.shotsFired) * 100) : 0}%</span></div>
            </div>
            <button style={styles.startButton} onClick={initGame}>TRY AGAIN</button>
            {onExit && <button style={styles.exitButton} onClick={onExit}>BACK</button>}
          </div>
        </div>
      )}

      {/* Victory */}
      {gameState === 'victory' && (
        <div style={styles.overlay}>
          <div style={styles.menuBg} />
          <div style={styles.menuContent}>
            <h1 style={{ ...styles.title, color: '#00ff88' }}>MISSION COMPLETE</h1>
            <p style={styles.subtitle}>ALL BLOCKS CLEARED</p>
            <div style={styles.divider} />
            <div style={styles.statsBlock}>
              <div style={styles.statRow}><span style={styles.statLabel}>TOTAL EARNED</span><span style={{...styles.statValue, color: '#00ff88'}}>${score.toLocaleString()}</span></div>
              <div style={styles.statRow}><span style={styles.statLabel}>KILLS</span><span style={styles.statValue}>{stats.kills}</span></div>
              <div style={styles.statRow}><span style={styles.statLabel}>BLOCKS CLEARED</span><span style={styles.statValue}>{stats.blocksCleared}</span></div>
              <div style={styles.statRow}><span style={styles.statLabel}>ACCURACY</span><span style={styles.statValue}>{stats.shotsFired > 0 ? Math.round((stats.shotsHit / stats.shotsFired) * 100) : 0}%</span></div>
            </div>
            <button style={styles.startButton} onClick={initGame}>PLAY AGAIN</button>
            {onExit && <button style={styles.exitButton} onClick={onExit}>BACK</button>}
          </div>
        </div>
      )}
    </div>
  );
};

// ============ HELPER FUNCTIONS ============
function darkenColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, ((num >> 16) & 0xFF) * (1 - amount));
  const g = Math.max(0, ((num >> 8) & 0xFF) * (1 - amount));
  const b = Math.max(0, (num & 0xFF) * (1 - amount));
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

// ============ STYLES ============
const styles: { [key: string]: React.CSSProperties } = {
  container: {
    position: 'relative',
    width: '100%',
    maxWidth: '800px',
    margin: '0 auto',
    backgroundColor: '#050505',
    borderRadius: '8px',
    overflow: 'hidden',
    boxShadow: '0 0 40px rgba(0, 0, 0, 0.8)',
  },
  canvas: {
    width: '100%',
    height: 'auto',
    display: 'block',
    cursor: 'crosshair',
  },
  overlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    zIndex: 10,
  },
  menuBg: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(180deg, rgba(0,0,0,0.95) 0%, rgba(10,5,15,0.92) 50%, rgba(0,0,0,0.95) 100%)',
    backdropFilter: 'blur(8px)',
  },
  menuContent: {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    maxWidth: '360px',
    width: '100%',
  },
  title: {
    fontSize: '3.5rem',
    fontWeight: 900,
    color: '#ffffff',
    textShadow: '0 0 30px rgba(255, 50, 50, 0.4), 0 2px 4px rgba(0,0,0,0.8)',
    margin: 0,
    fontFamily: "'Bebas Neue', 'Oswald', sans-serif",
    letterSpacing: '6px',
  },
  subtitle: {
    fontSize: '1rem',
    color: 'rgba(255,255,255,0.4)',
    margin: '6px 0 0',
    fontFamily: "'Oswald', sans-serif",
    letterSpacing: '4px',
    textTransform: 'uppercase' as const,
  },
  divider: {
    width: '60px',
    height: '2px',
    background: 'linear-gradient(90deg, transparent, #ff3333, transparent)',
    margin: '20px 0',
  },
  instructions: {
    textAlign: 'left' as const,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: '24px',
    lineHeight: 2,
    width: '100%',
  },
  instructionItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '0.9rem',
    fontFamily: "'Rajdhani', sans-serif",
    margin: 0,
  },
  instructionIcon: {
    width: '24px',
    height: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '4px',
    fontSize: '14px',
    color: '#00ff88',
    fontWeight: 700,
    flexShrink: 0,
  },
  statsBlock: {
    width: '100%',
    marginBottom: '24px',
  },
  statRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 0',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    fontFamily: "'Rajdhani', sans-serif",
  },
  statLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: '0.9rem',
    fontFamily: "'Oswald', sans-serif",
    letterSpacing: '2px',
  },
  statValue: {
    color: '#ffffff',
    fontSize: '1.1rem',
    fontWeight: 700,
  },
  startButton: {
    padding: '14px 48px',
    fontSize: '1.1rem',
    fontWeight: 700,
    color: '#ffffff',
    background: 'linear-gradient(135deg, #cc0000, #ff3333)',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    marginBottom: '12px',
    fontFamily: "'Oswald', sans-serif",
    letterSpacing: '3px',
    textTransform: 'uppercase' as const,
    boxShadow: '0 4px 20px rgba(255, 50, 50, 0.3)',
    transition: 'all 0.2s',
    width: '100%',
  },
  exitButton: {
    padding: '10px 30px',
    fontSize: '0.9rem',
    color: 'rgba(255,255,255,0.5)',
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '4px',
    cursor: 'pointer',
    fontFamily: "'Oswald', sans-serif",
    letterSpacing: '2px',
    textTransform: 'uppercase' as const,
    width: '100%',
  },
};

export default DriveByEngine;
