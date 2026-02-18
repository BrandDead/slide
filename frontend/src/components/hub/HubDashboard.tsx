// ═══════════════════════════════════════════════════════════════════════════
// DEALT/SLIDE - Main Hub Dashboard
// Sleek Neon Noir aesthetic with smoke effects and glowing accents
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Map, 
  Users, 
  Crosshair, 
  FlaskConical, 
  Wallet, 
  Settings,
  Bell,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Shield,
  Zap,
  DollarSign,
  Target,
  Car
} from 'lucide-react';
import { useGameStore } from '../../stores/gameStore';

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export const HubDashboard: React.FC = () => {
  const { user, gang, ownedBlocks, members, activeView, setActiveView } = useGameStore();
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Update time every minute
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Quick stats
  const totalIncome = ownedBlocks.reduce((sum, b) => sum + b.incomePerTick, 0);
  const totalHeat = ownedBlocks.reduce((sum, b) => sum + b.heatLevel, 0) / Math.max(ownedBlocks.length, 1);
  const activeMembers = members.filter(m => m.status === 'active').length;
  
  return (
    <div className="relative min-h-screen bg-slide-black overflow-hidden">
      {/* Background Effects */}
      <BackgroundEffects />
      
      {/* Main Content */}
      <div className="relative z-10 p-6 max-w-7xl mx-auto">
        {/* Header */}
        <Header 
          gangName={gang?.name || 'Start Your Gang'} 
          gangTag={gang?.tag}
          cash={user?.cash || 0}
          time={currentTime}
        />
        
        {/* Quick Stats Bar */}
        <QuickStatsBar 
          blocks={ownedBlocks.length}
          members={activeMembers}
          income={totalIncome}
          heat={totalHeat}
        />
        
        {/* Main Navigation Grid */}
        <NavigationGrid onNavigate={setActiveView} />
        
        {/* Activity Feed */}
        <ActivityFeed />
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// BACKGROUND EFFECTS
// ─────────────────────────────────────────────────────────────────────────────

const BackgroundEffects: React.FC = () => (
  <>
    {/* Noise texture overlay */}
    <div className="absolute inset-0 opacity-[0.03] bg-noise pointer-events-none" />
    
    {/* Grid pattern */}
    <div 
      className="absolute inset-0 opacity-30 pointer-events-none"
      style={{
        backgroundImage: `
          linear-gradient(rgba(255,45,85,0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,45,85,0.03) 1px, transparent 1px)
        `,
        backgroundSize: '50px 50px',
      }}
    />
    
    {/* Ambient glow spots */}
    <div className="absolute top-0 left-1/4 w-96 h-96 bg-neon-red/5 rounded-full blur-3xl" />
    <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-neon-blue/5 rounded-full blur-3xl" />
    <div className="absolute top-1/2 right-0 w-64 h-64 bg-neon-purple/5 rounded-full blur-3xl" />
    
    {/* Smoke effect - bottom */}
    <div 
      className="absolute bottom-0 left-0 right-0 h-64 pointer-events-none"
      style={{
        background: 'linear-gradient(to top, rgba(10,10,15,0.9) 0%, transparent 100%)',
      }}
    />
    
    {/* Scan line animation */}
    <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-10">
      <motion.div
        className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-cyan to-transparent"
        animate={{ y: ['0%', '100vh'] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
      />
    </div>
  </>
);

// ─────────────────────────────────────────────────────────────────────────────
// HEADER
// ─────────────────────────────────────────────────────────────────────────────

interface HeaderProps {
  gangName: string;
  gangTag?: string;
  cash: number;
  time: Date;
}

const Header: React.FC<HeaderProps> = ({ gangName, gangTag, cash, time }) => (
  <motion.header 
    className="flex items-center justify-between mb-8"
    initial={{ opacity: 0, y: -20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5 }}
  >
    {/* Gang Identity */}
    <div className="flex items-center gap-4">
      {/* Gang Logo/Avatar */}
      <div className="relative">
        <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-neon-red/20 to-neon-purple/20 border border-neon-red/30 flex items-center justify-center overflow-hidden">
          {gangTag ? (
            <span className="font-display text-2xl text-neon-red">{gangTag}</span>
          ) : (
            <Shield className="w-8 h-8 text-neon-red/50" />
          )}
        </div>
        {/* Online indicator */}
        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-neon-green rounded-full border-2 border-slide-black animate-pulse" />
      </div>
      
      {/* Gang Name & Time */}
      <div>
        <h1 className="font-display text-3xl tracking-wider text-white">
          {gangName}
        </h1>
        <p className="text-sm text-white/40 font-mono">
          {time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} • 
          {time.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
        </p>
      </div>
    </div>
    
    {/* Cash & Actions */}
    <div className="flex items-center gap-4">
      {/* Cash Display */}
      <motion.div 
        className="flex items-center gap-2 px-5 py-3 rounded-xl bg-slide-dark/80 border border-neon-green/20 backdrop-blur-sm"
        whileHover={{ scale: 1.02, borderColor: 'rgba(48,209,88,0.5)' }}
      >
        <DollarSign className="w-5 h-5 text-neon-green" />
        <span className="font-mono text-xl text-neon-green">
          {cash.toLocaleString()}
        </span>
      </motion.div>
      
      {/* Notifications */}
      <motion.button
        className="relative p-3 rounded-xl bg-slide-dark/80 border border-white/10 backdrop-blur-sm"
        whileHover={{ scale: 1.05, borderColor: 'rgba(255,255,255,0.2)' }}
        whileTap={{ scale: 0.95 }}
      >
        <Bell className="w-5 h-5 text-white/60" />
        <span className="absolute -top-1 -right-1 w-5 h-5 bg-neon-red rounded-full text-xs flex items-center justify-center">
          3
        </span>
      </motion.button>
      
      {/* Settings */}
      <motion.button
        className="p-3 rounded-xl bg-slide-dark/80 border border-white/10 backdrop-blur-sm"
        whileHover={{ scale: 1.05, rotate: 90, borderColor: 'rgba(255,255,255,0.2)' }}
        whileTap={{ scale: 0.95 }}
      >
        <Settings className="w-5 h-5 text-white/60" />
      </motion.button>
    </div>
  </motion.header>
);

// ─────────────────────────────────────────────────────────────────────────────
// QUICK STATS BAR
// ─────────────────────────────────────────────────────────────────────────────

interface QuickStatsBarProps {
  blocks: number;
  members: number;
  income: number;
  heat: number;
}

const QuickStatsBar: React.FC<QuickStatsBarProps> = ({ blocks, members, income, heat }) => {
  const stats = [
    { label: 'Blocks', value: blocks, icon: Map, color: 'neon-blue', trend: '+2' },
    { label: 'Crew', value: members, icon: Users, color: 'neon-purple', trend: null },
    { label: '$/hr', value: `$${income.toLocaleString()}`, icon: TrendingUp, color: 'neon-green', trend: '+12%' },
    { label: 'Heat', value: heat.toFixed(1), icon: AlertTriangle, color: heat > 3 ? 'neon-red' : 'neon-orange', trend: heat > 3 ? 'HIGH' : null },
  ];
  
  return (
    <motion.div 
      className="grid grid-cols-4 gap-4 mb-8"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
    >
      {stats.map((stat, i) => (
        <motion.div
          key={stat.label}
          className={`
            relative p-4 rounded-2xl bg-slide-dark/60 border border-white/5
            backdrop-blur-sm overflow-hidden group
          `}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: 0.1 + i * 0.05 }}
          whileHover={{ 
            scale: 1.02, 
            borderColor: `var(--${stat.color})`,
            transition: { duration: 0.2 }
          }}
        >
          {/* Background glow on hover */}
          <div className={`
            absolute inset-0 bg-gradient-to-br from-${stat.color}/10 to-transparent 
            opacity-0 group-hover:opacity-100 transition-opacity duration-300
          `} />
          
          <div className="relative flex items-center justify-between">
            <div>
              <p className="text-xs text-white/40 uppercase tracking-wider mb-1">{stat.label}</p>
              <p className={`text-2xl font-display text-${stat.color}`}>{stat.value}</p>
            </div>
            <div className={`p-2 rounded-lg bg-${stat.color}/10`}>
              <stat.icon className={`w-5 h-5 text-${stat.color}`} />
            </div>
          </div>
          
          {stat.trend && (
            <div className={`
              absolute top-2 right-2 px-2 py-0.5 rounded text-xs font-mono
              ${stat.trend === 'HIGH' ? 'bg-neon-red/20 text-neon-red' : 'bg-neon-green/20 text-neon-green'}
            `}>
              {stat.trend}
            </div>
          )}
        </motion.div>
      ))}
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// NAVIGATION GRID
// ─────────────────────────────────────────────────────────────────────────────

interface NavigationGridProps {
  onNavigate: (view: string) => void;
}

const NavigationGrid: React.FC<NavigationGridProps> = ({ onNavigate }) => {
  const navItems = [
    {
      id: 'map',
      title: 'TERRITORY',
      subtitle: 'Claim & defend blocks',
      icon: Map,
      color: 'from-neon-blue to-neon-cyan',
      glowColor: 'neon-blue',
      large: true,
    },
    {
      id: 'slide',
      title: 'SLIDE',
      subtitle: 'Grid combat',
      icon: Target,
      color: 'from-neon-red to-neon-orange',
      glowColor: 'neon-red',
      large: true,
    },
    {
      id: 'driveby',
      title: 'DRIVE-BY',
      subtitle: 'FPS action',
      icon: Car,
      color: 'from-neon-purple to-neon-pink',
      glowColor: 'neon-purple',
      large: false,
    },
    {
      id: 'dealer',
      title: 'DEALT',
      subtitle: 'Move product',
      icon: DollarSign,
      color: 'from-neon-green to-neon-mint',
      glowColor: 'neon-green',
      large: false,
    },
    {
      id: 'alchemy',
      title: 'COOK',
      subtitle: 'Lab operations',
      icon: FlaskConical,
      color: 'from-neon-yellow to-neon-orange',
      glowColor: 'neon-yellow',
      large: false,
    },
    {
      id: 'gang',
      title: 'CREW',
      subtitle: 'Manage your people',
      icon: Users,
      color: 'from-neon-cyan to-neon-blue',
      glowColor: 'neon-cyan',
      large: false,
    },
  ];
  
  return (
    <motion.div 
      className="grid grid-cols-4 gap-4 mb-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.2 }}
    >
      {navItems.map((item, i) => (
        <motion.button
          key={item.id}
          onClick={() => onNavigate(item.id)}
          className={`
            relative overflow-hidden rounded-2xl border border-white/10
            backdrop-blur-sm group
            ${item.large ? 'col-span-2 row-span-2' : 'col-span-1'}
            ${item.large ? 'min-h-[200px]' : 'min-h-[100px]'}
          `}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.2 + i * 0.05 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          {/* Background gradient */}
          <div className={`
            absolute inset-0 bg-gradient-to-br ${item.color} opacity-10
            group-hover:opacity-20 transition-opacity duration-300
          `} />
          
          {/* Glow effect on hover */}
          <div className={`
            absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500
            shadow-${item.glowColor}
          `} style={{
            boxShadow: `inset 0 0 40px var(--${item.glowColor}, rgba(255,255,255,0.1))`
          }} />
          
          {/* Content */}
          <div className="relative h-full p-6 flex flex-col justify-between">
            <div className={`
              w-12 h-12 rounded-xl bg-gradient-to-br ${item.color} 
              flex items-center justify-center
              ${item.large ? 'w-16 h-16' : ''}
            `}>
              <item.icon className={`text-white ${item.large ? 'w-8 h-8' : 'w-6 h-6'}`} />
            </div>
            
            <div className="text-left">
              <h3 className={`
                font-display tracking-wider text-white
                ${item.large ? 'text-3xl' : 'text-xl'}
              `}>
                {item.title}
              </h3>
              <p className="text-sm text-white/40">{item.subtitle}</p>
            </div>
            
            {/* Arrow indicator */}
            <ChevronRight className={`
              absolute bottom-4 right-4 text-white/20 
              group-hover:text-white/60 group-hover:translate-x-1
              transition-all duration-300
              ${item.large ? 'w-8 h-8' : 'w-6 h-6'}
            `} />
          </div>
          
          {/* Corner accent */}
          <div className={`
            absolute top-0 right-0 w-20 h-20 
            bg-gradient-to-bl ${item.color} opacity-5
            rounded-bl-full
          `} />
        </motion.button>
      ))}
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// ACTIVITY FEED
// ─────────────────────────────────────────────────────────────────────────────

const ActivityFeed: React.FC = () => {
  const activities = [
    { id: 1, type: 'income', message: 'Block income: +$2,450', time: '2m ago', icon: DollarSign, color: 'neon-green' },
    { id: 2, type: 'combat', message: 'Drive-by on 145th St successful', time: '15m ago', icon: Crosshair, color: 'neon-red' },
    { id: 3, type: 'member', message: 'Lil Marco gained +50 XP', time: '1h ago', icon: Zap, color: 'neon-purple' },
    { id: 4, type: 'warning', message: 'Heat rising on MLK Blvd', time: '2h ago', icon: AlertTriangle, color: 'neon-orange' },
  ];
  
  return (
    <motion.div
      className="rounded-2xl bg-slide-dark/40 border border-white/5 backdrop-blur-sm overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.4 }}
    >
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
        <h2 className="font-display text-xl tracking-wider text-white/80">RECENT ACTIVITY</h2>
        <button className="text-sm text-neon-blue hover:text-neon-cyan transition-colors">
          View All
        </button>
      </div>
      
      {/* Activity Items */}
      <div className="divide-y divide-white/5">
        {activities.map((activity, i) => (
          <motion.div
            key={activity.id}
            className="px-6 py-4 flex items-center gap-4 hover:bg-white/5 transition-colors cursor-pointer"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.5 + i * 0.05 }}
          >
            <div className={`p-2 rounded-lg bg-${activity.color}/10`}>
              <activity.icon className={`w-5 h-5 text-${activity.color}`} />
            </div>
            <div className="flex-1">
              <p className="text-white/80">{activity.message}</p>
            </div>
            <span className="text-sm text-white/30 font-mono">{activity.time}</span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

export default HubDashboard;
