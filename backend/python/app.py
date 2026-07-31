"""
DEALT/SLIDE - Main Flask Application
Entry point for the backend API server
"""

import os
import logging
from flask import Flask, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.DEBUG if os.getenv('FLASK_DEBUG', 'False') == 'True' else logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def create_app():
    """Application factory"""
    app = Flask(__name__)
    
    # Configuration
    app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')
    app.config['SUPABASE_URL'] = os.getenv('SUPABASE_URL')
    app.config['SUPABASE_SERVICE_ROLE_KEY'] = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
    app.config['MAPBOX_ACCESS_TOKEN'] = os.getenv('MAPBOX_ACCESS_TOKEN')
    app.config['DATABASE_URL'] = os.getenv('DATABASE_URL')
    
    # CORS configuration
    cors_origins = os.getenv('CORS_ORIGINS', 'http://localhost:5173').split(',')
    CORS(app, resources={
        r"/api/*": {
            "origins": cors_origins,
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"],
            "supports_credentials": True
        }
    })
    
    # Health check endpoint
    @app.route('/health', methods=['GET'])
    def health_check():
        """Health check endpoint"""
        return jsonify({
            'status': 'healthy',
            'service': 'slide-backend',
            'version': '1.0.0'
        })
    
    @app.route('/', methods=['GET'])
    def index():
        """Root endpoint"""
        return jsonify({
            'message': 'SLIDE Backend API',
            'version': '1.0.0',
            'docs': '/api/docs',
            'health': '/health'
        })
    
    # Register blueprints
    
    # Auth blueprint (JWT authentication)
    try:
        from middleware.auth import auth_bp
        app.register_blueprint(auth_bp)
        logger.info("✓ Registered auth blueprint")
    except Exception as e:
        logger.error(f"✗ Failed to register auth blueprint: {e}")
    
    try:
        from api.blocks import blocks_bp
        app.register_blueprint(blocks_bp)
        logger.info("✓ Registered blocks blueprint")
    except Exception as e:
        logger.error(f"✗ Failed to register blocks blueprint: {e}")
    
    # Register other blueprints as they're implemented
    try:
        from api.combat import combat_bp
        app.register_blueprint(combat_bp)
        logger.info("✓ Registered combat blueprint")
    except ImportError:
        logger.warning("Combat blueprint not found - will be implemented")
    except Exception as e:
        logger.error(f"✗ Failed to register combat blueprint: {e}")
    
    try:
        from api.world import world_bp
        app.register_blueprint(world_bp)
        logger.info("✓ Registered world blueprint")
    except ImportError:
        logger.warning("World blueprint not found - will be implemented")
    except Exception as e:
        logger.error(f"✗ Failed to register world blueprint: {e}")
    
    try:
        from api.inventory import inventory_bp
        app.register_blueprint(inventory_bp)
        logger.info("✓ Registered inventory blueprint")
    except ImportError:
        logger.warning("Inventory blueprint not found - will be implemented")
    except Exception as e:
        logger.error(f"✗ Failed to register inventory blueprint: {e}")
    
    try:
        from api.driveby import driveby_bp
        app.register_blueprint(driveby_bp)
        logger.info("✓ Registered driveby blueprint")
    except ImportError:
        logger.warning("Driveby blueprint not found - will be implemented")
    except Exception as e:
        logger.error(f"✗ Failed to register driveby blueprint: {e}")
    
    # Paid access entitlement status (read-only for authenticated players)
    try:
        from api.entitlements import entitlements_bp
        app.register_blueprint(entitlements_bp)
        logger.info("✓ Registered entitlements blueprint")
    except ImportError:
        logger.warning("Entitlements blueprint not found - paid access disabled")
    except Exception as e:
        logger.error(f"✗ Failed to register entitlements blueprint: {e}")

    # NPC gang AI blueprint
    try:
        from api.npc import npc_bp
        app.register_blueprint(npc_bp)
        logger.info("✓ Registered npc blueprint")
    except ImportError:
        logger.warning("NPC blueprint not found - will be implemented")
    except Exception as e:
        logger.error(f"✗ Failed to register npc blueprint: {e}")

    # Art generation blueprint
    try:
        from routes.art import art_bp
        app.register_blueprint(art_bp)
        logger.info("✓ Registered art blueprint")
    except ImportError:
        logger.warning("Art blueprint not found - will be implemented")
    except Exception as e:
        logger.error(f"✗ Failed to register art blueprint: {e}")
    
    # Initialize world tick scheduler
    try:
        from services.scheduler import scheduler_manager
        scheduler_manager.init_app(app)
        logger.info("✓ World tick scheduler started")
    except ImportError:
        logger.warning("APScheduler not installed — scheduler disabled")
    except Exception as e:
        logger.warning(f"Scheduler init skipped: {e}")
    
    # Error handlers
    @app.errorhandler(404)
    def not_found(error):
        return jsonify({'error': 'Not found'}), 404
    
    @app.errorhandler(500)
    def internal_error(error):
        logger.error(f"Internal error: {error}")
        return jsonify({'error': 'Internal server error'}), 500
    
    return app

# Create app instance
app = create_app()

if __name__ == '__main__':
    host = os.getenv('HOST', '0.0.0.0')
    port = int(os.getenv('PORT', 5000))
    debug = os.getenv('FLASK_DEBUG', 'True') == 'True'
    
    logger.info(f"Starting SLIDE Backend API on {host}:{port}")
    logger.info(f"Debug mode: {debug}")
    logger.info(f"Supabase configured: {bool(app.config['SUPABASE_URL'])}")
    logger.info(f"Mapbox configured: {bool(app.config['MAPBOX_ACCESS_TOKEN'])}")
    
    app.run(
        host=host,
        port=port,
        debug=debug
    )
