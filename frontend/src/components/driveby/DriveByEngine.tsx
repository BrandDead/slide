// DriveByEngine.tsx - First-Person Shooter from Passenger Seat
// Integrated from Qwen3-Coder:480B with enhancements
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

// Gang member appearances
const GANG_SPRITES = ['🔫', '🗡️', '💀', '😈', '👊'];
const CIVILIAN_SPRITES = ['👔', '👩', '🧓', '🏃', '🚶'];
const LEADER_SPRITE = '👑';

// ============ MAIN COMPONENT ============
const DriveByEngine: React.FC<{ onExit?: () => void; onComplete?: (stats: GameStats) => void }> = ({ 
  onExit, 
  onComplete 
}) => {
  // Game state
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
  
  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameLoopRef = useRef<number>(0);
  const lastShotRef = useRef(0);
  const blockPosRef = useRef(0);
  const parallaxRef = useRef({ bg: 0, mid: 0, fg: 0 });

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
    setStats({ kills: 0, civilianHits: 0, accuracy: 0, shotsHit: 0, shotsFired: 0, blocksCleared: 0, moneyEarned: 0 });

    // Generate blocks with varying difficulty
    const newBlocks: Block[] = [];
    const styles: Block['style'][] = ['miami', 'nyc', 'la', 'detroit'];
    
    for (let i = 0; i < 10; i++) {
      const difficulty = Math.min(i / 10, 0.7); // Increases over time
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
      
      newBlocks.push({
        type,
        gangCount,
        civilianCount,
        style: styles[i % styles.length]
      });
    }
    
    setBlocks(newBlocks);
    setGameState('playing');
  }, []);

  // ============ SPAWN TARGETS ============
  const spawnTargets = useCallback((block: Block) => {
    const newTargets: Target[] = [];
    let id = Date.now();

    // Spawn gang members
    for (let i = 0; i < block.gangCount; i++) {
      const isLeader = i === 0 && Math.random() < 0.15;
      newTargets.push({
        id: id++,
        type: isLeader ? 'leader' : 'gang',
        x: Math.random() * (GAME_WIDTH - 100) + 50,
        y: GAME_HEIGHT * 0.4 + Math.random() * (GAME_HEIGHT * 0.25),
        width: 50,
        height: 70,
        health: isLeader ? 150 : 50,
        maxHealth: isLeader ? 150 : 50,
        bounty: isLeader ? 500 : Math.floor(Math.random() * 150) + 50,
        isShooting: false,
        lastShotTime: 0,
        velocityX: (Math.random() - 0.5) * 2,
        sprite: isLeader ? LEADER_SPRITE : GANG_SPRITES[Math.floor(Math.random() * GANG_SPRITES.length)]
      });
    }

    // Spawn civilians
    for (let i = 0; i < block.civilianCount; i++) {
      newTargets.push({
        id: id++,
        type: 'civilian',
        x: Math.random() * (GAME_WIDTH - 100) + 50,
        y: GAME_HEIGHT * 0.45 + Math.random() * (GAME_HEIGHT * 0.2),
        width: 40,
        height: 60,
        health: 30,
        maxHealth: 30,
        bounty: -500,
        isShooting: false,
        lastShotTime: 0,
        velocityX: (Math.random() - 0.5) * 3,
        sprite: CIVILIAN_SPRITES[Math.floor(Math.random() * CIVILIAN_SPRITES.length)]
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

    // Play sound effect
    playSound('shoot');

    setBullets(prev => [...prev, {
      id: now,
      x: GAME_WIDTH * 0.7,
      y: GAME_HEIGHT * 0.75,
      targetX: x,
      targetY: y,
      speed: BULLET_SPEED,
      isPlayer: true
    }]);
  }, [gameState, ammo]);

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
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        osc.type = 'sawtooth';
        break;
      case 'hit':
        osc.frequency.setValueAtTime(300, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        osc.type = 'square';
        break;
      case 'death':
        osc.frequency.setValueAtTime(500, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.5, ctx.currentTime);
        osc.type = 'sawtooth';
        break;
      case 'damage':
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        osc.type = 'sine';
        break;
    }
    
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
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
      const deltaTime = timestamp - lastTime;
      lastTime = timestamp;

      // Update parallax
      parallaxRef.current.bg += CAR_SPEED * 0.3;
      parallaxRef.current.mid += CAR_SPEED * 0.6;
      parallaxRef.current.fg += CAR_SPEED;
      blockPosRef.current += CAR_SPEED;

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
        
        // Reload between blocks
        setAmmo(MAX_AMMO);
      }

      // Update targets
      setTargets(prev => prev.map(target => {
        let newTarget = { ...target };
        
        // Movement
        newTarget.x += newTarget.velocityX;
        if (newTarget.x < 50 || newTarget.x > GAME_WIDTH - 50) {
          newTarget.velocityX *= -1;
        }

        // Gang members shoot back
        if (target.type !== 'civilian') {
          const now = Date.now();
          if (Math.random() < 0.02 && now - target.lastShotTime > ENEMY_SHOT_COOLDOWN) {
            newTarget.isShooting = true;
            newTarget.lastShotTime = now;
            
            // Enemy fires at player
            setBullets(prev => [...prev, {
              id: now + target.id,
              x: target.x + target.width / 2,
              y: target.y + target.height / 2,
              targetX: GAME_WIDTH * 0.5 + (Math.random() - 0.5) * 150,
              targetY: GAME_HEIGHT * 0.8,
              speed: BULLET_SPEED * 0.6,
              isPlayer: false
            }]);
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
            // Bullet reached destination
            if (bullet.isPlayer) {
              // Check target hits
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
                    
                    if (newHealth <= 0) {
                      playSound('death');
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
                    return { ...target, health: newHealth };
                  }
                  return target;
                }).filter(Boolean) as Target[];
                
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

    // Spawn initial targets
    if (blocks.length > 0 && targets.length === 0) {
      spawnTargets(blocks[0]);
    }

    gameLoopRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    };
  }, [gameState, currentBlock, blocks, heat, stats, spawnTargets, playSound, onComplete]);

  // ============ RENDERING ============
  const render = useCallback((ctx: CanvasRenderingContext2D) => {
    const block = blocks[currentBlock];
    
    // Clear
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Sky gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT * 0.5);
    skyGrad.addColorStop(0, '#0f0f23');
    skyGrad.addColorStop(1, '#1a1a2e');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT * 0.5);

    // Background buildings (slowest parallax)
    ctx.fillStyle = '#2d2d44';
    for (let i = 0; i < 12; i++) {
      const x = ((i * 100) - (parallaxRef.current.bg % 100) + GAME_WIDTH) % (GAME_WIDTH + 100) - 50;
      const h = 100 + Math.sin(i * 0.7) * 40;
      ctx.fillRect(x, GAME_HEIGHT * 0.35 - h, 80, h + GAME_HEIGHT * 0.15);
      
      // Neon windows
      ctx.fillStyle = i % 3 === 0 ? '#ff006e' : '#00f0ff';
      for (let w = 0; w < 4; w++) {
        for (let wh = 0; wh < 3; wh++) {
          if (Math.sin(i + w + wh) > 0) {
            ctx.fillRect(x + 10 + w * 18, GAME_HEIGHT * 0.35 - h + 15 + wh * 25, 8, 12);
          }
        }
      }
      ctx.fillStyle = '#2d2d44';
    }

    // Mid-ground (parked cars, signs)
    ctx.fillStyle = '#3d3d5c';
    for (let i = 0; i < 15; i++) {
      const x = ((i * 120) - (parallaxRef.current.mid % 120) + GAME_WIDTH) % (GAME_WIDTH + 120) - 60;
      // Parked car
      ctx.fillRect(x, GAME_HEIGHT * 0.52, 70, 35);
      ctx.fillStyle = '#222';
      ctx.fillRect(x + 10, GAME_HEIGHT * 0.52 + 5, 50, 20);
      ctx.fillStyle = '#3d3d5c';
    }

    // Foreground sidewalk
    ctx.fillStyle = '#4a4a6a';
    ctx.fillRect(0, GAME_HEIGHT * 0.58, GAME_WIDTH, GAME_HEIGHT * 0.42);
    
    // Sidewalk lines
    ctx.fillStyle = '#3a3a5a';
    for (let i = 0; i < 25; i++) {
      const x = ((i * 50) - (parallaxRef.current.fg % 50) + GAME_WIDTH) % (GAME_WIDTH + 50) - 25;
      ctx.fillRect(x, GAME_HEIGHT * 0.58, 30, 4);
    }

    // Draw targets
    targets.forEach(target => {
      // Health bar
      if (target.health < target.maxHealth) {
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(target.x, target.y - 12, target.width, 6);
        ctx.fillStyle = '#00ff88';
        ctx.fillRect(target.x, target.y - 12, (target.width * target.health) / target.maxHealth, 6);
      }

      // Target body
      ctx.font = `${target.height * 0.7}px Arial`;
      ctx.textAlign = 'center';
      ctx.fillText(target.sprite, target.x + target.width / 2, target.y + target.height * 0.7);

      // Indicator
      if (target.type === 'gang' || target.type === 'leader') {
        ctx.fillStyle = target.type === 'leader' ? '#ffd700' : '#ff3333';
        ctx.beginPath();
        ctx.arc(target.x + target.width / 2, target.y - 20, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Draw bullets
    bullets.forEach(bullet => {
      ctx.fillStyle = bullet.isPlayer ? '#ffff00' : '#ff0000';
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, 4, 0, Math.PI * 2);
      ctx.fill();
      
      // Trail
      ctx.strokeStyle = bullet.isPlayer ? 'rgba(255,255,0,0.3)' : 'rgba(255,0,0,0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(bullet.x, bullet.y);
      ctx.lineTo(bullet.x - (bullet.targetX - bullet.x) * 0.3, bullet.y - (bullet.targetY - bullet.y) * 0.3);
      ctx.stroke();
    });

    // Car interior overlay
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, GAME_WIDTH * 0.15, GAME_HEIGHT);
    ctx.fillRect(GAME_WIDTH * 0.85, 0, GAME_WIDTH * 0.15, GAME_HEIGHT);
    ctx.fillRect(0, GAME_HEIGHT * 0.78, GAME_WIDTH, GAME_HEIGHT * 0.22);

    // Dashboard
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, GAME_HEIGHT * 0.82, GAME_WIDTH, GAME_HEIGHT * 0.18);

    // Gun
    ctx.fillStyle = '#333';
    ctx.fillRect(GAME_WIDTH * 0.6, GAME_HEIGHT * 0.72, 100, 15);
    ctx.fillRect(GAME_WIDTH * 0.68, GAME_HEIGHT * 0.65, 15, 25);

    // Crosshair
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(crosshair.x - 15, crosshair.y);
    ctx.lineTo(crosshair.x + 15, crosshair.y);
    ctx.moveTo(crosshair.x, crosshair.y - 15);
    ctx.lineTo(crosshair.x, crosshair.y + 15);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(crosshair.x, crosshair.y, 20, 0, Math.PI * 2);
    ctx.stroke();

    // HUD
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px Orbitron, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`💰 $${score.toLocaleString()}`, 20, 30);
    ctx.fillText(`🚗 ${carHealth}%`, 20, 55);
    ctx.fillText(`🔫 ${ammo}/${MAX_AMMO}`, 20, 80);
    ctx.fillText(`📍 Block ${currentBlock + 1}/${blocks.length}`, 20, 105);

    // Heat meter
    ctx.fillStyle = '#333';
    ctx.fillRect(GAME_WIDTH - 220, 20, 200, 25);
    ctx.fillStyle = heat > 80 ? '#ff0000' : heat > 50 ? '#ff9900' : '#00ff88';
    ctx.fillRect(GAME_WIDTH - 220, 20, (heat / 100) * 200, 25);
    ctx.strokeStyle = '#fff';
    ctx.strokeRect(GAME_WIDTH - 220, 20, 200, 25);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(`🔥 HEAT ${heat}%`, GAME_WIDTH - 25, 38);

    // Block type indicator
    if (block) {
      ctx.fillStyle = block.type === 'hot' ? '#ff3333' : block.type === 'normal' ? '#ffaa00' : '#00ff88';
      ctx.font = 'bold 16px Arial';
      ctx.fillText(`${block.type.toUpperCase()} ZONE`, GAME_WIDTH - 25, 65);
    }
  }, [blocks, currentBlock, targets, bullets, crosshair, score, carHealth, ammo, heat]);

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
          <h1 style={styles.title}>🚗 DRIVE-BY</h1>
          <p style={styles.subtitle}>Eliminate gang members. Spare civilians.</p>
          <div style={styles.instructions}>
            <p>🎯 Move cursor to aim</p>
            <p>🔫 Click/tap to shoot</p>
            <p>💀 Red dots = Gang members (SHOOT)</p>
            <p>👔 No dots = Civilians (DON'T SHOOT)</p>
            <p>🔥 Too much heat = RAID</p>
          </div>
          <button style={styles.startButton} onClick={initGame}>START MISSION</button>
          {onExit && <button style={styles.exitButton} onClick={onExit}>← BACK</button>}
        </div>
      )}

      {/* Game Over */}
      {gameState === 'gameover' && (
        <div style={styles.overlay}>
          <h1 style={{ ...styles.title, color: '#ff3333' }}>MISSION FAILED</h1>
          <p style={styles.subtitle}>{heat >= 100 ? 'BLOCK RAIDED!' : 'CAR DESTROYED!'}</p>
          <div style={styles.stats}>
            <p>💰 Score: ${score.toLocaleString()}</p>
            <p>💀 Kills: {stats.kills}</p>
            <p>😢 Civilian Hits: {stats.civilianHits}</p>
            <p>🎯 Accuracy: {stats.shotsFired > 0 ? Math.round((stats.shotsHit / stats.shotsFired) * 100) : 0}%</p>
          </div>
          <button style={styles.startButton} onClick={initGame}>TRY AGAIN</button>
          {onExit && <button style={styles.exitButton} onClick={onExit}>← BACK</button>}
        </div>
      )}

      {/* Victory */}
      {gameState === 'victory' && (
        <div style={styles.overlay}>
          <h1 style={{ ...styles.title, color: '#00ff88' }}>MISSION COMPLETE!</h1>
          <div style={styles.stats}>
            <p>💰 Total: ${score.toLocaleString()}</p>
            <p>💀 Kills: {stats.kills}</p>
            <p>📍 Blocks Cleared: {stats.blocksCleared}</p>
            <p>🎯 Accuracy: {stats.shotsFired > 0 ? Math.round((stats.shotsHit / stats.shotsFired) * 100) : 0}%</p>
          </div>
          <button style={styles.startButton} onClick={initGame}>PLAY AGAIN</button>
          {onExit && <button style={styles.exitButton} onClick={onExit}>← BACK</button>}
        </div>
      )}
    </div>
  );
};

// ============ STYLES ============
const styles: { [key: string]: React.CSSProperties } = {
  container: {
    position: 'relative',
    width: '100%',
    maxWidth: '800px',
    margin: '0 auto',
    backgroundColor: '#0d0d0d',
    borderRadius: '12px',
    overflow: 'hidden',
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
    backgroundColor: 'rgba(0,0,0,0.9)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
  },
  title: {
    fontSize: '3rem',
    fontWeight: 900,
    color: '#00f0ff',
    textShadow: '0 0 30px rgba(0,240,255,0.5)',
    margin: 0,
  },
  subtitle: {
    fontSize: '1.2rem',
    color: 'rgba(255,255,255,0.7)',
    margin: '10px 0 20px',
  },
  instructions: {
    textAlign: 'left' as const,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: '20px',
    lineHeight: 1.8,
  },
  stats: {
    textAlign: 'left' as const,
    color: '#fff',
    fontSize: '1.2rem',
    marginBottom: '20px',
    lineHeight: 2,
  },
  startButton: {
    padding: '15px 40px',
    fontSize: '1.2rem',
    fontWeight: 700,
    color: '#000',
    background: 'linear-gradient(135deg, #00ff88, #00f0ff)',
    border: 'none',
    borderRadius: '30px',
    cursor: 'pointer',
    marginBottom: '15px',
  },
  exitButton: {
    padding: '10px 30px',
    fontSize: '1rem',
    color: '#fff',
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.3)',
    borderRadius: '20px',
    cursor: 'pointer',
  },
};

export default DriveByEngine;
