#!/usr/bin/env python3
import os
from flask import Flask, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO
from flask_jwt_extended import JWTManager
from dotenv import load_dotenv

load_dotenv()
app = Flask(__name__)

app.config.update(
    SECRET_KEY=os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production'),
    JWT_SECRET_KEY=os.getenv('JWT_SECRET_KEY', 'jwt-secret-key-change-in-production'),
    JWT_ACCESS_TOKEN_EXPIRES=900,
    JWT_REFRESH_TOKEN_EXPIRES=604800,
    SQLALCHEMY_DATABASE_URI=os.getenv('DATABASE_URL', 'postgresql://localhost/dealt_slide'),
    SQLALCHEMY_TRACK_MODIFICATIONS=False,
    REDIS_URL=os.getenv('REDIS_URL', 'redis://localhost:6379/0'),
    MAPBOX_TOKEN=os.getenv('MAPBOX_TOKEN', ''),
)

CORS(app, resources={r"/api/*": {"origins": "*"}})
jwt = JWTManager(app)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet', message_queue=app.config['REDIS_URL'])

from src.api.auth import auth_bp
from src.api.blocks import blocks_bp
from src.api.combat import combat_bp

app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(blocks_bp, url_prefix='/api/blocks')
app.register_blueprint(combat_bp, url_prefix='/api/combat')

@app.route('/health')
def health_check():
    return jsonify({'status': 'healthy', 'version': '0.1.0', 'service': 'dealt-slide-api'})

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    socketio.run(app, host='0.0.0.0', port=port)
