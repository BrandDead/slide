// ═══════════════════════════════════════════════════════════════════════════
// DEALT/SLIDE - Gang Member Display Components (Continued)
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart,
  Target,
  Brain,
  Zap,
  Shield,
  Star,
  ChevronRight,
  Skull,
  AlertTriangle,
  Clock,
  TrendingUp,
  Award,
  Crosshair,
  DollarSign,
  MoreVertical,
  Dices,
  Eye,
  Flame
} from 'lucide-react';
import type { GangMember, MemberStats, CityRegion } from '../../types/game.types';

// ─────────────────────────────────────────────────────────────────────────────
// STAT COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

interface StatPillProps {
  icon: React.ElementType;
  value: number;
  color: string;
  label: string;
}

export const StatPill: React.FC<StatPillProps> = ({ icon: Icon, value, color, label }) => (
  <div className={`
    flex items-center gap-1.5 px-2 py-1 rounded-lg
    bg-${color}/10 border border-${color}/20
  `}>
    <Icon className={`w-3 h-3 text-${color}`} />
    <span className={`text-xs font-mono text-${color}`}>{value}</span>
    <span className="text-xs text-white/30">{label}</span>
  </div>
);

interface StatsBarProps {
  stats: MemberStats;
}

export const StatsBar: React.FC<StatsBarProps> = ({ stats }) => {
  const statItems = [
    { key: 'strength', label: 'STR', value: stats.strength, color: 'neon-red' },
    { key: 'agility', label: 'AGI', value: stats.agility, color: 'neon-green' },
    { key: 'intelligence', label: 'INT', value: stats.intelligence, color: 'neon-blue' },
    { key: 'charisma', label: 'CHA', value: stats.charisma, color: 'neon-purple' },
    { key: 'luck', label: 'LCK', value: stats.luck, color: 'neon-yellow' },
  ];
  
  return (
    <div className="flex gap-2">
      {statItems.map((stat) => (
        <div key={stat.key} className="flex-1">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-white/40">{stat.label}</span>
            <span className={`text-${stat.color} font-mono`}>{stat.value}</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <motion.div
              className={`h-full bg-${stat.color}`}
              initial={{ width: 0 }}
              animate={{ width: `${stat.value * 10}%` }}
              transition={{ duration: 0.5, delay: 0.1 }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

interface StatBlockProps {
  icon: React.ElementType;
  label: string;
  value: number;
  maxValue: number;
  color: string;
}

export const StatBlock: React.FC<StatBlockProps> = ({ icon: Icon, label, value, maxValue, color }) => (
  <div className={`
    p-4 rounded-xl bg-${color}/5 border border-${color}/20
  `}>
    <div className="flex items-center justify-between mb-2">
      <Icon className={`w-5 h-5 text-${color}`} />
      <span className={`font-mono text-xl text-${color}`}>{value}</span>
    </div>
    <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mb-2">
      <motion.div
        className={`h-full bg-gradient-to-r from-${color}/50 to-${color}`}
        initial={{ width: 0 }}
        animate={{ width: `${(value / maxValue) * 100}%` }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      />
    </div>
    <p className="text-xs text-white/40 uppercase tracking-wider">{label}</p>
  </div>
);

interface AttributeBarProps {
  label: string;
  value: number;
  color: string;
}

export const AttributeBar: React.FC<AttributeBarProps> = ({ label, value, color }) => (
  <div className="flex items-center gap-3">
    <span className="text-sm text-white/60 w-24">{label}</span>
    <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
      <motion.div
        className={`h-full bg-${color}`}
        initial={{ width: 0 }}
        animate={{ width: `${value * 10}%` }}
        transition={{ duration: 0.6 }}
      />
    </div>
    <span className={`font-mono text-sm text-${color} w-8 text-right`}>{value}</span>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// GANG MEMBER GENERATOR - Random Member Creation Display
// ─────────────────────────────────────────────────────────────────────────────

interface MemberGeneratorProps {
  onGenerate: () => void;
  onAccept: (member: GangMember) => void;
  generatedMember?: GangMember | null;
  isGenerating?: boolean;
  cost?: number;
}

export const MemberGenerator: React.FC<MemberGeneratorProps> = ({
  onGenerate,
  onAccept,
  generatedMember,
  isGenerating = false,
  cost = 5000,
}) => {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slide-dark via-slide-darker to-slide-black border border-white/10">
      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px]">
          <motion.div
            className="w-full h-full rounded-full bg-gradient-conic from-neon-purple via-neon-blue via-neon-cyan via-neon-green via-neon-yellow via-neon-orange to-neon-red opacity-20 blur-3xl"
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
          />
        </div>
        
        {/* Grid overlay */}
        <div 
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)
            `,
            backgroundSize: '30px 30px',
          }}
        />
      </div>
      
      <div className="relative p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <motion.h2 
            className="font-display text-4xl tracking-wider text-white mb-2"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            RECRUIT NEW MEMBER
          </motion.h2>
          <p className="text-white/40">Find new talent for your organization</p>
        </div>
        
        {/* Generator Display */}
        <div className="relative min-h-[400px] flex items-center justify-center">
          <AnimatePresence mode="wait">
            {isGenerating ? (
              <GeneratingAnimation key="generating" />
            ) : generatedMember ? (
              <GeneratedMemberReveal 
                key="reveal" 
                member={generatedMember} 
                onAccept={() => onAccept(generatedMember)}
              />
            ) : (
              <GeneratorIdle key="idle" cost={cost} onGenerate={onGenerate} />
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// GENERATOR STATES
// ─────────────────────────────────────────────────────────────────────────────

const GeneratorIdle: React.FC<{ cost: number; onGenerate: () => void }> = ({ cost, onGenerate }) => (
  <motion.div
    className="text-center"
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.9 }}
  >
    {/* Placeholder silhouette */}
    <div className="relative w-48 h-48 mx-auto mb-8">
      <div className="absolute inset-0 rounded-2xl border-2 border-dashed border-white/20 flex items-center justify-center">
        <div className="w-32 h-32 rounded-full bg-gradient-to-b from-white/10 to-transparent" />
      </div>
      
      {/* Question marks floating */}
      <motion.div
        className="absolute top-4 right-4 text-4xl text-white/20"
        animate={{ y: [0, -10, 0], opacity: [0.2, 0.4, 0.2] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        ?
      </motion.div>
      <motion.div
        className="absolute bottom-4 left-4 text-3xl text-white/20"
        animate={{ y: [0, -8, 0], opacity: [0.2, 0.4, 0.2] }}
        transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
      >
        ?
      </motion.div>
    </div>
    
    <motion.button
      className="group relative px-8 py-4 rounded-xl overflow-hidden"
      onClick={onGenerate}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      {/* Button gradient background */}
      <div className="absolute inset-0 bg-gradient-to-r from-neon-purple to-neon-cyan opacity-80 group-hover:opacity-100 transition-opacity" />
      
      {/* Shine effect */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
        initial={{ x: '-100%' }}
        whileHover={{ x: '100%' }}
        transition={{ duration: 0.5 }}
      />
      
      <div className="relative flex items-center gap-3">
        <Dices className="w-6 h-6 text-white" />
        <span className="font-display text-xl text-white tracking-wider">SCOUT TALENT</span>
      </div>
    </motion.button>
    
    <p className="mt-4 text-white/40 flex items-center justify-center gap-2">
      <DollarSign className="w-4 h-4 text-neon-green" />
      <span className="font-mono text-neon-green">{cost.toLocaleString()}</span>
      <span>recruitment fee</span>
    </p>
  </motion.div>
);

const GeneratingAnimation: React.FC = () => (
  <motion.div
    className="text-center"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
  >
    {/* Spinning ring */}
    <div className="relative w-48 h-48 mx-auto mb-8">
      <motion.div
        className="absolute inset-0 rounded-full border-4 border-transparent border-t-neon-purple border-r-neon-cyan"
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      />
      <motion.div
        className="absolute inset-4 rounded-full border-4 border-transparent border-b-neon-green border-l-neon-yellow"
        animate={{ rotate: -360 }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
      />
      
      {/* Center icon */}
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1, repeat: Infinity }}
        >
          <Eye className="w-12 h-12 text-neon-cyan" />
        </motion.div>
      </div>
    </div>
    
    <motion.p
      className="font-display text-2xl text-white/80"
      animate={{ opacity: [0.5, 1, 0.5] }}
      transition={{ duration: 1.5, repeat: Infinity }}
    >
      SEARCHING THE STREETS...
    </motion.p>
  </motion.div>
);

interface GeneratedMemberRevealProps {
  member: GangMember;
  onAccept: () => void;
}

const GeneratedMemberReveal: React.FC<GeneratedMemberRevealProps> = ({ member, onAccept }) => {
  const tierColors = {
    common: 'from-white/20 to-white/5',
    uncommon: 'from-neon-green/30 to-neon-green/10',
    rare: 'from-neon-blue/30 to-neon-blue/10',
    epic: 'from-neon-purple/30 to-neon-purple/10',
    legendary: 'from-neon-orange/30 via-neon-yellow/20 to-neon-red/10',
  };
  
  // Calculate tier based on total stats
  const totalStats = Object.values(member.stats).reduce((a, b) => a + b, 0);
  const tier = totalStats > 45 ? 'legendary' : totalStats > 38 ? 'epic' : totalStats > 30 ? 'rare' : totalStats > 22 ? 'uncommon' : 'common';
  
  return (
    <motion.div
      className="w-full max-w-md"
      initial={{ opacity: 0, scale: 0.8, rotateY: 90 }}
      animate={{ opacity: 1, scale: 1, rotateY: 0 }}
      transition={{ duration: 0.6, type: 'spring' }}
    >
      {/* Card */}
      <div className={`
        relative rounded-2xl overflow-hidden
        bg-gradient-to-br ${tierColors[tier]}
        border border-white/20 backdrop-blur-sm
      `}>
        {/* Rarity banner */}
        <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-black/50 backdrop-blur-sm">
          <span className="text-xs font-display uppercase tracking-wider text-white">
            {tier}
          </span>
        </div>
        
        <div className="p-6">
          {/* Avatar and name */}
          <div className="flex items-center gap-4 mb-6">
            <motion.div 
              className="w-20 h-20 rounded-xl overflow-hidden border-2 border-white/20"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3, type: 'spring' }}
            >
              {member.avatarUrl ? (
                <img src={member.avatarUrl} alt={member.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-neon-purple/50 to-neon-blue/50 flex items-center justify-center">
                  <span className="font-display text-3xl text-white">{member.name.charAt(0)}</span>
                </div>
              )}
            </motion.div>
            
            <div>
              <motion.h3 
                className="font-display text-2xl text-white"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
              >
                {member.nickname || member.name}
              </motion.h3>
              <motion.p 
                className="text-white/40"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 }}
              >
                {member.region.toUpperCase()} • Age {member.age}
              </motion.p>
            </div>
          </div>
          
          {/* Stats reveal */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            <StatsBar stats={member.stats} />
          </motion.div>
          
          {/* Special traits */}
          <motion.div 
            className="mt-4 flex flex-wrap gap-2"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
          >
            {member.skills.slice(0, 3).map((skill) => (
              <span 
                key={skill.id}
                className="px-3 py-1 rounded-full bg-white/10 text-xs text-white/60"
              >
                {skill.name}
              </span>
            ))}
          </motion.div>
          
          {/* Accept button */}
          <motion.button
            className="w-full mt-6 py-4 rounded-xl bg-gradient-to-r from-neon-green to-neon-cyan text-slide-black font-display text-xl tracking-wider"
            onClick={onAccept}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            RECRUIT
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MEMBER GRID - Display multiple members
// ─────────────────────────────────────────────────────────────────────────────

interface MemberGridProps {
  members: GangMember[];
  onSelect?: (member: GangMember) => void;
  variant?: 'compact' | 'full';
}

export const MemberGrid: React.FC<MemberGridProps> = ({ 
  members, 
  onSelect,
  variant = 'compact'
}) => {
  return (
    <div className={`
      grid gap-4
      ${variant === 'full' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4'}
    `}>
      {members.map((member, i) => (
        <motion.div
          key={member.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
        >
          <GangMemberCard
            member={member}
            variant={variant}
            onClick={() => onSelect?.(member)}
          />
        </motion.div>
      ))}
    </div>
  );
};

export default GangMemberCard;
