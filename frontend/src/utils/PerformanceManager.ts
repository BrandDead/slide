// PerformanceManager.ts - Integrated from GLM-4.6 optimizations
// Handles FPS monitoring, object pooling, memory management, and battery optimization

// ============ TYPES ============
export interface PerformanceMetrics {
  fps: number;
  frameTime: number;
  memoryUsage: number;
  drawCalls: number;
  activeObjects: number;
  timestamp: number;
}

export interface PoolableObject {
  reset(): void;
  isActive: boolean;
}

// ============ PERFORMANCE MONITOR ============
export class PerformanceMonitor {
  private frameCount = 0;
  private lastTime = performance.now();
  private fps = 60;
  private frameTime = 16.67;
  private memoryUsage = 0;
  private drawCalls = 0;
  private callbacks: Array<(metrics: PerformanceMetrics) => void> = [];
  private frameStart = 0;

  constructor() {
    this.startMonitoring();
  }

  private startMonitoring(): void {
    const monitor = () => {
      const currentTime = performance.now();
      const deltaTime = currentTime - this.lastTime;
      
      this.frameCount++;
      
      if (deltaTime >= 1000) {
        this.fps = Math.round((this.frameCount * 1000) / deltaTime);
        this.frameCount = 0;
        this.lastTime = currentTime;
        this.collectMetrics();
      }
      
      requestAnimationFrame(monitor);
    };
    monitor();
  }

  private collectMetrics(): void {
    // Get memory usage if available
    if ('memory' in performance) {
      const mem = (performance as any).memory;
      this.memoryUsage = Math.round(mem.usedJSHeapSize / 1048576); // MB
    }
    
    const metrics: PerformanceMetrics = {
      fps: this.fps,
      frameTime: this.frameTime,
      memoryUsage: this.memoryUsage,
      drawCalls: this.drawCalls,
      activeObjects: 0,
      timestamp: Date.now()
    };
    
    this.callbacks.forEach(cb => cb(metrics));
  }

  onFrameStart(): void {
    this.frameStart = performance.now();
  }

  onFrameEnd(): void {
    this.frameTime = performance.now() - this.frameStart;
  }

  setDrawCalls(count: number): void {
    this.drawCalls = count;
  }

  subscribe(callback: (metrics: PerformanceMetrics) => void): () => void {
    this.callbacks.push(callback);
    return () => {
      const index = this.callbacks.indexOf(callback);
      if (index > -1) this.callbacks.splice(index, 1);
    };
  }

  getMetrics(): PerformanceMetrics {
    return {
      fps: this.fps,
      frameTime: this.frameTime,
      memoryUsage: this.memoryUsage,
      drawCalls: this.drawCalls,
      activeObjects: 0,
      timestamp: Date.now()
    };
  }
}

// ============ OBJECT POOL ============
export class ObjectPool<T extends PoolableObject> {
  private pool: T[] = [];
  private active: T[] = [];
  private createFn: () => T;
  private maxSize: number;

  constructor(createFn: () => T, initialSize = 50, maxSize = 500) {
    this.createFn = createFn;
    this.maxSize = maxSize;
    
    // Pre-warm the pool
    for (let i = 0; i < initialSize; i++) {
      const obj = createFn();
      obj.isActive = false;
      this.pool.push(obj);
    }
  }

  acquire(): T {
    let obj: T;
    
    if (this.pool.length > 0) {
      obj = this.pool.pop()!;
    } else if (this.active.length < this.maxSize) {
      obj = this.createFn();
    } else {
      // Reuse oldest active object
      obj = this.active.shift()!;
      obj.reset();
    }
    
    obj.isActive = true;
    this.active.push(obj);
    return obj;
  }

  release(obj: T): void {
    const index = this.active.indexOf(obj);
    if (index > -1) {
      this.active.splice(index, 1);
    }
    
    obj.reset();
    obj.isActive = false;
    this.pool.push(obj);
  }

  releaseAll(): void {
    while (this.active.length > 0) {
      const obj = this.active.pop()!;
      obj.reset();
      obj.isActive = false;
      this.pool.push(obj);
    }
  }

  getActiveCount(): number {
    return this.active.length;
  }

  getPoolSize(): number {
    return this.pool.length;
  }
}

// ============ POOLABLE BULLET ============
export class PoolableBullet implements PoolableObject {
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  speed = 0;
  isPlayer = true;
  isActive = false;
  damage = 10;

  reset(): void {
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.speed = 0;
    this.isPlayer = true;
    this.isActive = false;
    this.damage = 10;
  }

  initialize(x: number, y: number, targetX: number, targetY: number, speed: number, isPlayer: boolean): void {
    this.x = x;
    this.y = y;
    this.speed = speed;
    this.isPlayer = isPlayer;
    
    const dx = targetX - x;
    const dy = targetY - y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    this.vx = (dx / dist) * speed;
    this.vy = (dy / dist) * speed;
  }

  update(): boolean {
    this.x += this.vx;
    this.y += this.vy;
    
    // Return false if bullet is off screen
    return this.x > -50 && this.x < 900 && this.y > -50 && this.y < 700;
  }
}

// ============ POOLABLE PARTICLE ============
export class PoolableParticle implements PoolableObject {
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  life = 0;
  maxLife = 60;
  size = 5;
  color = '#ffffff';
  alpha = 1;
  isActive = false;

  reset(): void {
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.life = 0;
    this.alpha = 1;
    this.isActive = false;
  }

  initialize(x: number, y: number, color: string): void {
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * 6;
    this.vy = (Math.random() - 0.5) * 6;
    this.color = color;
    this.life = 0;
    this.maxLife = 30 + Math.random() * 30;
    this.size = 2 + Math.random() * 4;
    this.alpha = 1;
  }

  update(): boolean {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += 0.1; // Gravity
    this.life++;
    this.alpha = 1 - (this.life / this.maxLife);
    
    return this.life < this.maxLife;
  }
}

// ============ PARTICLE SYSTEM ============
export class ParticleSystem {
  private pool: ObjectPool<PoolableParticle>;
  private particles: PoolableParticle[] = [];
  private emissionRate = 1.0;

  constructor(initialSize = 100) {
    this.pool = new ObjectPool<PoolableParticle>(
      () => new PoolableParticle(),
      initialSize
    );
  }

  emit(x: number, y: number, count: number, color: string): void {
    const actualCount = Math.floor(count * this.emissionRate);
    
    for (let i = 0; i < actualCount; i++) {
      const particle = this.pool.acquire();
      particle.initialize(x, y, color);
      this.particles.push(particle);
    }
  }

  update(): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i];
      
      if (!particle.update()) {
        this.pool.release(particle);
        this.particles.splice(i, 1);
      }
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    for (const particle of this.particles) {
      ctx.globalAlpha = particle.alpha;
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  setEmissionRate(rate: number): void {
    this.emissionRate = Math.max(0, Math.min(1, rate));
  }

  clear(): void {
    this.pool.releaseAll();
    this.particles = [];
  }

  getActiveCount(): number {
    return this.particles.length;
  }
}

// ============ OPTIMIZED GAME LOOP ============
export class OptimizedGameLoop {
  private targetFPS = 60;
  private targetFrameTime: number;
  private lastFrameTime = 0;
  private accumulatedTime = 0;
  private isRunning = false;
  private isLowPowerMode = false;
  private animationId: number | null = null;
  
  private updateFn: (deltaTime: number) => void;
  private renderFn: () => void;
  private performanceMonitor: PerformanceMonitor;

  constructor(
    updateFn: (deltaTime: number) => void,
    renderFn: () => void,
    performanceMonitor: PerformanceMonitor
  ) {
    this.updateFn = updateFn;
    this.renderFn = renderFn;
    this.performanceMonitor = performanceMonitor;
    this.targetFrameTime = 1000 / this.targetFPS;
    
    this.setupAdaptivePerformance();
  }

  private setupAdaptivePerformance(): void {
    this.performanceMonitor.subscribe((metrics) => {
      if (metrics.fps < 40 && !this.isLowPowerMode) {
        this.enterLowPowerMode();
      } else if (metrics.fps > 55 && this.isLowPowerMode) {
        this.exitLowPowerMode();
      }
    });
  }

  private enterLowPowerMode(): void {
    this.isLowPowerMode = true;
    this.setTargetFPS(30);
    console.log('Entering low power mode (30 FPS)');
  }

  private exitLowPowerMode(): void {
    this.isLowPowerMode = false;
    this.setTargetFPS(60);
    console.log('Exiting low power mode (60 FPS)');
  }

  setTargetFPS(fps: number): void {
    this.targetFPS = fps;
    this.targetFrameTime = 1000 / fps;
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastFrameTime = performance.now();
    this.loop(this.lastFrameTime);
  }

  stop(): void {
    this.isRunning = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  private loop = (currentTime: number): void => {
    if (!this.isRunning) return;

    this.performanceMonitor.onFrameStart();

    const deltaTime = currentTime - this.lastFrameTime;
    this.lastFrameTime = currentTime;
    this.accumulatedTime += deltaTime;

    // Clamp delta to prevent spiral of death
    const clampedDelta = Math.min(deltaTime, 100);

    // Fixed timestep updates
    while (this.accumulatedTime >= this.targetFrameTime) {
      this.updateFn(this.targetFrameTime / 1000);
      this.accumulatedTime -= this.targetFrameTime;
    }

    // Render
    this.renderFn();

    this.performanceMonitor.onFrameEnd();

    this.animationId = requestAnimationFrame(this.loop);
  };
}

// ============ BATTERY OPTIMIZER ============
export class BatteryOptimizer {
  private isPageVisible = true;
  private isLowBattery = false;
  private onPauseCallbacks: Array<() => void> = [];
  private onResumeCallbacks: Array<() => void> = [];

  constructor() {
    this.setupVisibilityHandling();
    this.setupBatteryMonitoring();
  }

  private setupVisibilityHandling(): void {
    document.addEventListener('visibilitychange', () => {
      this.isPageVisible = !document.hidden;
      
      if (this.isPageVisible) {
        this.onResumeCallbacks.forEach(cb => cb());
      } else {
        this.onPauseCallbacks.forEach(cb => cb());
      }
    });
  }

  private setupBatteryMonitoring(): void {
    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        this.checkBatteryLevel(battery.level);
        
        battery.addEventListener('levelchange', () => {
          this.checkBatteryLevel(battery.level);
        });
      });
    }
  }

  private checkBatteryLevel(level: number): void {
    const wasLowBattery = this.isLowBattery;
    this.isLowBattery = level < 0.2;
    
    if (this.isLowBattery && !wasLowBattery) {
      console.log('Low battery detected - reducing performance');
    }
  }

  onPause(callback: () => void): void {
    this.onPauseCallbacks.push(callback);
  }

  onResume(callback: () => void): void {
    this.onResumeCallbacks.push(callback);
  }

  isVisible(): boolean {
    return this.isPageVisible;
  }

  shouldReducePerformance(): boolean {
    return this.isLowBattery;
  }
}

// ============ ASSET MANAGER WITH LAZY LOADING ============
export class AssetManager {
  private assets = new Map<string, HTMLImageElement | AudioBuffer>();
  private loadingPromises = new Map<string, Promise<any>>();
  private loadedCount = 0;
  private totalCount = 0;

  async preloadCritical(assetUrls: string[]): Promise<void> {
    this.totalCount = assetUrls.length;
    
    const promises = assetUrls.map(url => this.loadAsset(url, 'high'));
    await Promise.all(promises);
  }

  async loadAsset(url: string, priority: 'high' | 'medium' | 'low' = 'medium'): Promise<any> {
    if (this.assets.has(url)) {
      return this.assets.get(url);
    }

    if (this.loadingPromises.has(url)) {
      return this.loadingPromises.get(url);
    }

    const promise = this.fetchAsset(url);
    this.loadingPromises.set(url, promise);

    const asset = await promise;
    this.assets.set(url, asset);
    this.loadingPromises.delete(url);
    this.loadedCount++;

    return asset;
  }

  private async fetchAsset(url: string): Promise<any> {
    if (url.endsWith('.png') || url.endsWith('.jpg') || url.endsWith('.webp')) {
      return this.loadImage(url);
    } else if (url.endsWith('.mp3') || url.endsWith('.wav')) {
      return this.loadAudio(url);
    } else {
      const response = await fetch(url);
      return response.json();
    }
  }

  private loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  }

  private async loadAudio(url: string): Promise<AudioBuffer> {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const audioContext = new AudioContext();
    return audioContext.decodeAudioData(arrayBuffer);
  }

  getAsset<T>(url: string): T | undefined {
    return this.assets.get(url) as T | undefined;
  }

  getLoadProgress(): number {
    return this.totalCount > 0 ? this.loadedCount / this.totalCount : 1;
  }

  unloadAsset(url: string): void {
    this.assets.delete(url);
  }

  clearAll(): void {
    this.assets.clear();
    this.loadingPromises.clear();
  }
}

// ============ STORAGE MANAGER ============
export class StorageManager {
  private dbName = 'DealtSlideGame';
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains('saves')) {
          db.createObjectStore('saves', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('offlineQueue')) {
          db.createObjectStore('offlineQueue', { keyPath: 'id', autoIncrement: true });
        }
      };
    });
  }

  async saveGame(saveId: string, gameState: any): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['saves'], 'readwrite');
      const store = transaction.objectStore('saves');
      
      const request = store.put({
        id: saveId,
        state: gameState,
        timestamp: Date.now()
      });
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async loadGame(saveId: string): Promise<any | null> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['saves'], 'readonly');
      const store = transaction.objectStore('saves');
      
      const request = store.get(saveId);
      
      request.onsuccess = () => resolve(request.result?.state || null);
      request.onerror = () => reject(request.error);
    });
  }

  async saveSetting(key: string, value: any): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['settings'], 'readwrite');
      const store = transaction.objectStore('settings');
      
      const request = store.put({ key, value });
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getSetting(key: string): Promise<any | null> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['settings'], 'readonly');
      const store = transaction.objectStore('settings');
      
      const request = store.get(key);
      
      request.onsuccess = () => resolve(request.result?.value || null);
      request.onerror = () => reject(request.error);
    });
  }

  async queueOfflineAction(action: any): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['offlineQueue'], 'readwrite');
      const store = transaction.objectStore('offlineQueue');
      
      const request = store.add({
        action,
        timestamp: Date.now()
      });
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getOfflineQueue(): Promise<any[]> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['offlineQueue'], 'readonly');
      const store = transaction.objectStore('offlineQueue');
      
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async clearOfflineQueue(): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['offlineQueue'], 'readwrite');
      const store = transaction.objectStore('offlineQueue');
      
      const request = store.clear();
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

// ============ EXPORT SINGLETON INSTANCES ============
export const performanceMonitor = new PerformanceMonitor();
export const batteryOptimizer = new BatteryOptimizer();
export const assetManager = new AssetManager();
export const storageManager = new StorageManager();
