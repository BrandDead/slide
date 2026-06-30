import time
import logging
from npc_ai import NPCGang, NPC_GANG_NAMES, NPC_FACTIONS
from db import get_db_connection

logger = logging.getLogger(__name__)

def spawn_npc_gangs(db_conn, num_gangs=3):
    """Spawns NPC gangs into unclaimed blocks."""
    logger.info(f"Attempting to spawn {num_gangs} NPC gangs...")
    cursor = db_conn.cursor()
    
    # Find unclaimed blocks
    cursor.execute("SELECT id FROM blocks WHERE owner_id IS NULL LIMIT %s", (num_gangs * 2,))
    unclaimed_blocks = cursor.fetchall()
    
    if not unclaimed_blocks:
        logger.info("No unclaimed blocks available for NPC gangs.")
        return

    spawned = 0
    for i in range(min(num_gangs, len(unclaimed_blocks))):
        block_id = unclaimed_blocks[i][0]
        gang_name = NPC_GANG_NAMES[i % len(NPC_GANG_NAMES)]
        faction = NPC_FACTIONS[i % len(NPC_FACTIONS)]
        
        gang = NPCGang(name=gang_name, faction=faction)
        
        # In a real scenario, we'd create a dummy profile for the NPC gang
        # and assign the block to them. For now, we just log it.
        logger.info(f"Spawned NPC Gang '{gang.name}' at block {block_id}")
        
        # Example SQL to claim block for NPC (assuming a system user 'NPC_SYSTEM'):
        # cursor.execute("UPDATE blocks SET owner_id = 'NPC_SYSTEM', metadata = jsonb_set(metadata, '{npc_gang}', %s) WHERE id = %s", 
        #                (json.dumps({'name': gang.name, 'aggression': gang.aggression}), block_id))
        
        spawned += 1
        
    db_conn.commit()
    logger.info(f"Successfully spawned {spawned} NPC gangs.")

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    # conn = get_db_connection()
    # spawn_npc_gangs(conn)
    print("AI Spawner ready.")
