#!/usr/bin/env tsx
/**
 * Seed Script for SLIDE MVP
 * Creates demo data for testing the full game loop
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env');
  console.error('Required: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function seed() {
  console.log('🌱 Starting seed script...\n');

  try {
    // 1. Create demo gangs
    console.log('📋 Creating gangs...');
    const { data: playerGang, error: gangError1 } = await supabase
      .from('gangs')
      .insert({
        name: 'The Syndicate',
        tag: '[SYN]',
        color_primary: '#4a90e2',
        color_secondary: '#1a1a1a',
        member_count: 3,
        territory_count: 1,
        total_cash: 10000,
        reputation: 60
      })
      .select()
      .single();

    if (gangError1) {
      console.error('Error creating player gang:', gangError1);
      throw gangError1;
    }
    console.log(`  ✓ Created player gang: ${playerGang.name} (${playerGang.id})`);

    const { data: npcGang, error: gangError2 } = await supabase
      .from('gangs')
      .insert({
        name: 'Los Diablos',
        tag: '[DIA]',
        color_primary: '#e74c3c',
        color_secondary: '#000000',
        member_count: 4,
        territory_count: 1,
        total_cash: 15000,
        reputation: 70
      })
      .select()
      .single();

    if (gangError2) {
      console.error('Error creating NPC gang:', gangError2);
      throw gangError2;
    }
    console.log(`  ✓ Created NPC gang: ${npcGang.name} (${npcGang.id})\n`);

    // 2. Create demo users
    console.log('👤 Creating users...');
    
    // Generate random UUIDs for demo accounts (never use hardcoded UUIDs in production)
    const generateUUID = () => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    };
    
    const { data: playerUser, error: userError1 } = await supabase
      .from('users')
      .insert({
        auth_id: generateUUID(),
        username: 'demo_player',
        email: 'demo@slide.local',
        gang_id: playerGang.id,
        gang_rank: 'leader',
        cash: 10000,
        level: 5,
        reputation: 60
      })
      .select()
      .single();

    if (userError1) {
      console.error('Error creating player user:', userError1);
      throw userError1;
    }
    console.log(`  ✓ Created player: ${playerUser.username} (${playerUser.id})`);

    // Update gang leader
    await supabase
      .from('gangs')
      .update({ leader_id: playerUser.id })
      .eq('id', playerGang.id);

    const { data: npcUser, error: userError2 } = await supabase
      .from('users')
      .insert({
        auth_id: generateUUID(),
        username: 'npc_boss',
        email: 'npc@slide.local',
        gang_id: npcGang.id,
        gang_rank: 'leader',
        cash: 15000,
        level: 8,
        reputation: 70
      })
      .select()
      .single();

    if (userError2) {
      console.error('Error creating NPC user:', userError2);
      throw userError2;
    }
    console.log(`  ✓ Created NPC: ${npcUser.username} (${npcUser.id})\n`);

    await supabase
      .from('gangs')
      .update({ leader_id: npcUser.id })
      .eq('id', npcGang.id);

    // 3. Create demo blocks
    console.log('🏘️  Creating blocks...');
    const { data: playerBlock, error: blockError1 } = await supabase
      .from('blocks')
      .insert({
        address: '1234 Grove Street, Los Angeles, CA',
        city: 'Los Angeles',
        coordinates: {
          type: 'Polygon',
          coordinates: [[
            [-118.2500, 34.0500],
            [-118.2480, 34.0500],
            [-118.2480, 34.0520],
            [-118.2500, 34.0520],
            [-118.2500, 34.0500]
          ]]
        },
        center_point: {
          type: 'Point',
          coordinates: [-118.2490, 34.0510]
        },
        owner_id: playerUser.id,
        gang_id: playerGang.id,
        block_type: 'residential',
        traffic_level: 65,
        danger_level: 40,
        current_heat: 20,
        fortification_level: 1,
        income_per_hour: 150,
        grid_data: {
          width: 8,
          height: 8,
          tiles: generateDefaultGrid(8, 8)
        }
      })
      .select()
      .single();

    if (blockError1) {
      console.error('Error creating player block:', blockError1);
      throw blockError1;
    }
    console.log(`  ✓ Created player block: ${playerBlock.address} (${playerBlock.id})`);

    const { data: npcBlock, error: blockError2 } = await supabase
      .from('blocks')
      .insert({
        address: '5678 Compton Avenue, Los Angeles, CA',
        city: 'Los Angeles',
        coordinates: {
          type: 'Polygon',
          coordinates: [[
            [-118.2400, 34.0400],
            [-118.2380, 34.0400],
            [-118.2380, 34.0420],
            [-118.2400, 34.0420],
            [-118.2400, 34.0400]
          ]]
        },
        center_point: {
          type: 'Point',
          coordinates: [-118.2390, 34.0410]
        },
        owner_id: npcUser.id,
        gang_id: npcGang.id,
        block_type: 'commercial',
        traffic_level: 80,
        danger_level: 60,
        current_heat: 35,
        fortification_level: 2,
        income_per_hour: 200,
        grid_data: {
          width: 8,
          height: 8,
          tiles: generateDefaultGrid(8, 8)
        }
      })
      .select()
      .single();

    if (blockError2) {
      console.error('Error creating NPC block:', blockError2);
      throw blockError2;
    }
    console.log(`  ✓ Created NPC block: ${npcBlock.address} (${npcBlock.id})\n`);

    // 4. Create gang members
    console.log('👥 Creating gang members...');
    
    // Player members
    const playerMembers = [
      { name: 'Mike "Deadeye" Johnson', role: 'shooter', shooting_skill: 80, damage: 18 },
      { name: 'Carlos "Slick" Martinez', role: 'dealer', dealing_skill: 75, shooting_skill: 40 },
      { name: 'Rex', role: 'canine', speed: 75, defense: 8 }
    ];

    for (let i = 0; i < playerMembers.length; i++) {
      const member = playerMembers[i];
      const position = { x: 2 + i, y: 3 };

      const { data: createdMember, error: memberError } = await supabase
        .from('gang_members')
        .insert({
          gang_id: playerGang.id,
          owner_id: playerUser.id,
          name: member.name,
          role: member.role,
          shooting_skill: member.shooting_skill || 50,
          dealing_skill: member.dealing_skill || 50,
          damage: member.damage || 10,
          defense: member.defense || 5,
          speed: member.speed || 50,
          current_block_id: playerBlock.id,
          position: position,
          status: 'assigned'
        })
        .select()
        .single();

      if (memberError) {
        console.error(`Error creating member ${member.name}:`, memberError);
      } else {
        console.log(`  ✓ Created: ${createdMember.name} (${createdMember.role})`);
      }
    }

    // NPC members
    const npcMembers = [
      { name: 'Jose "El Jefe" Ramirez', role: 'shooter', shooting_skill: 85, damage: 20 },
      { name: 'Diego "Snake" Vargas', role: 'enforcer', shooting_skill: 70, defense: 10 },
      { name: 'Luis "Pusher" Hernandez', role: 'dealer', dealing_skill: 80, shooting_skill: 45 },
      { name: 'Bruno', role: 'canine', speed: 80, defense: 10 }
    ];

    for (let i = 0; i < npcMembers.length; i++) {
      const member = npcMembers[i];
      const position = { x: 5 + (i % 2), y: 4 + Math.floor(i / 2) };

      const { error: memberError } = await supabase
        .from('gang_members')
        .insert({
          gang_id: npcGang.id,
          owner_id: npcUser.id,
          name: member.name,
          role: member.role,
          shooting_skill: member.shooting_skill || 50,
          dealing_skill: member.dealing_skill || 50,
          damage: member.damage || 10,
          defense: member.defense || 5,
          speed: member.speed || 50,
          current_block_id: npcBlock.id,
          position: position,
          status: 'assigned'
        });

      if (memberError) {
        console.error(`Error creating NPC member ${member.name}:`, memberError);
      } else {
        console.log(`  ✓ Created: ${member.name} (${member.role})`);
      }
    }

    console.log('');

    // 5. Create initial inventory
    console.log('🎒 Creating inventory items...');
    const inventoryItems = [
      { item_id: 'pistol-9mm', quantity: 2 },
      { item_id: 'medkit', quantity: 5 },
      { item_id: 'lockpick', quantity: 3 },
      { item_id: 'bulletproof-vest', quantity: 1 }
    ];

    for (const item of inventoryItems) {
      const { error: invError } = await supabase
        .from('user_inventory')
        .insert({
          user_id: playerUser.id,
          item_id: item.item_id,
          quantity: item.quantity
        });

      if (invError) {
        console.error(`Error creating inventory item ${item.item_id}:`, invError);
      } else {
        console.log(`  ✓ Added: ${item.quantity}x ${item.item_id}`);
      }
    }

    console.log('');

    // 6. Create initial transactions (shoebox ledger)
    console.log('💰 Creating transactions...');
    const { error: txError } = await supabase
      .from('shoebox_ledger')
      .insert({
        user_id: playerUser.id,
        amount: 10000,
        balance_after: 10000,
        transaction_type: 'initial_balance',
        description: 'Starting cash'
      });

    if (txError) {
      console.error('Error creating transaction:', txError);
    } else {
      console.log('  ✓ Initial balance: $10,000');
    }

    console.log('');

    // Summary
    console.log('✅ Seed completed successfully!\n');
    console.log('📊 Summary:');
    console.log(`  • 2 gangs created`);
    console.log(`  • 2 users created (1 player, 1 NPC)`);
    console.log(`  • 2 blocks claimed`);
    console.log(`  • 7 gang members created`);
    console.log(`  • ${inventoryItems.length} inventory items added`);
    console.log(`  • 1 transaction logged\n`);
    console.log('🎮 Ready to play! Login as:');
    console.log(`  Username: demo_player`);
    console.log(`  (Use "demo_player" as Bearer token for now)\n`);

  } catch (error) {
    console.error('\n❌ Seed failed:', error);
    process.exit(1);
  }
}

/**
 * Generate a default grid layout
 */
function generateDefaultGrid(width: number, height: number) {
  const tiles = [];
  
  for (let y = 0; y < height; y++) {
    const row = [];
    for (let x = 0; x < width; x++) {
      // Street tiles on edges
      const isStreet = x === 0 || x === width - 1 || y === 0 || y === height - 1;
      const tileType = isStreet ? 'street' : 'building';
      
      row.push({
        x,
        y,
        type: tileType,
        terrain_bonus: {
          cover: isStreet ? 0.0 : 0.5,
          visibility: isStreet ? 1.0 : 0.6
        }
      });
    }
    tiles.push(row);
  }
  
  return tiles;
}

// Run seed
seed();
