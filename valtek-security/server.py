#!/usr/bin/env python3
"""
============================================
VALTEK SECURITY — Servidor Backend (Python 3)
REST API + Base de Datos SQLite + Envío de Email SMTP + Servidor Web
============================================
"""

import os
import sys
import json
import sqlite3
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import parse_qs, urlparse
import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), 'valtek.db')
PORT = 8080

# ─────────────────────────────────────────────
# Base de Datos SQLite — Inicialización
# ─────────────────────────────────────────────
def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Tabla de Usuarios Enrolados
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            run TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            phone TEXT,
            email TEXT NOT NULL,
            role TEXT NOT NULL,
            enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Tabla de Registros de Acceso
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS access_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            run TEXT NOT NULL,
            user_name TEXT,
            status TEXT NOT NULL,
            reader TEXT DEFAULT 'P1',
            relay TEXT DEFAULT 'RELAY_1',
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Insertar usuarios demo si la tabla está vacía
    cursor.execute('SELECT COUNT(*) FROM users')
    if cursor.fetchone()[0] == 0:
        demo_users = [
            ('12345678-5', 'Juan Pérez González (P1)', '+56 9 1234 5678', 'juan.perez@colegio.cl', 'Alumno'),
            ('23456789-0', 'Ana Gómez Rojas', '+56 9 2345 6789', 'ana.gomez@colegio.cl', 'Docente'),
            ('11111111-1', 'Carlos Muñoz Soto', '+56 9 3456 7890', 'carlos.munoz@colegio.cl', 'Administrativo'),
            ('9876543-K', 'María Fernanda López', '+56 9 4567 8901', 'maria.lopez@colegio.cl', 'Apoderado')
        ]
        cursor.executemany(
            'INSERT INTO users (run, name, phone, email, role) VALUES (?, ?, ?, ?, ?)',
            demo_users
        )
        conn.commit()
        print('[SQLite] Base de datos inicializada con usuarios demo.')
        
    conn.close()

# ─────────────────────────────────────────────
# Helper Envío de Correo Real SMTP
# ─────────────────────────────────────────────
def send_real_email(to_email, user_name, run, role, smtp_config=None):
    """
    Envía un correo real con el pase QR utilizando SMTP.
    Si no hay credenciales SMTP configuradas, simula la entrega y devuelve éxito.
    """
    clean_run = run.replace('.', '').replace('-', '').upper()
    qr_url = f"https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=https://portal.sidiv.registrocivil.cl/docstatus?RUN={clean_run}%26type=CI"
    
    subject = f"🔑 Tu Pase Digital de Acceso QR — Valtek Security ({user_name})"
    
    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {{ font-family: 'Segoe UI', Arial, sans-serif; background-color: #0a0e1a; color: #e2e8f0; margin: 0; padding: 20px; }}
        .card {{ max-width: 520px; margin: 0 auto; background: #1e293b; border: 2px solid #3b82f6; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }}
        .header {{ background: linear-gradient(135deg, #3b82f6, #2563eb); color: #ffffff; padding: 16px 24px; text-align: center; font-weight: 800; font-size: 18px; }}
        .body {{ padding: 24px; text-align: center; }}
        .qr-box {{ background: #ffffff; padding: 12px; border-radius: 12px; display: inline-block; margin: 16px 0; box-shadow: 0 4px 15px rgba(0,0,0,0.3); }}
        .user-name {{ font-size: 20px; font-weight: 800; color: #ffffff; margin: 8px 0 4px 0; }}
        .run-tag {{ font-family: monospace; font-size: 16px; color: #60a5fa; font-weight: 700; }}
        .role-badge {{ display: inline-block; background: rgba(59,130,246,0.2); color: #60a5fa; border: 1px solid #3b82f6; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; text-transform: uppercase; margin-top: 8px; }}
        .footer {{ background: #0f172a; padding: 12px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #334155; }}
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">COLEGIO VALTEK — PASE DIGITAL DE ACCESO</div>
        <div class="body">
          <p style="color:#94a3b8; font-size:14px;">Presente este código QR en el lector P1 de la entrada para abrir la puerta de forma automática.</p>
          <div class="qr-box">
            <img src="{qr_url}" alt="Código QR de Acceso" width="200" height="200">
          </div>
          <div class="user-name">{user_name}</div>
          <div class="run-tag">RUN: {run}</div>
          <div><span class="role-badge">{role}</span></div>
        </div>
        <div class="footer">
          Valtek Security — Control de Acceso Escolar Autónomo
        </div>
      </div>
    </body>
    </html>
    """

    if not smtp_config or not smtp_config.get('host') or not smtp_config.get('user'):
        print(f"[Email Simulación Backend] Correo preparado para {to_email} para {user_name} (RUN: {run})")
        return {"success": True, "mode": "simulated", "message": f"Correo preparado y enviado a {to_email}"}
        
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = smtp_config.get("sender", "notificaciones@valteksecurity.cl")
        msg["To"] = to_email
        msg.attach(MIMEText(html_body, "html"))

        host = smtp_config.get("host")
        port = int(smtp_config.get("port", 587))
        username = smtp_config.get("user")
        password = smtp_config.get("password")

        with smtplib.SMTP(host, port) as server:
            server.starttls()
            server.login(username, password)
            server.sendmail(msg["From"], [to_email], msg.as_string())

        print(f"[SMTP Real] Correo entregado exitosamente a {to_email}")
        return {"success": True, "mode": "smtp_real", "message": f"Email SMTP entregado a {to_email}"}
    except Exception as e:
        print(f"[SMTP Error] Fallo al enviar email: {str(e)}")
        return {"success": False, "error": str(e)}

# ─────────────────────────────────────────────
# Request Handler HTTP + REST API
# ─────────────────────────────────────────────
class ValtekRequestHandler(SimpleHTTPRequestHandler):
    
    def _send_json(self, data, code=200):
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        parsed_url = urlparse(self.path)
        path = parsed_url.path

        if path == '/api/users':
            conn = sqlite3.connect(DB_PATH)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute('SELECT run, name, phone, email, role, enrolled_at FROM users ORDER BY id DESC')
            rows = cursor.fetchall()
            users = [dict(row) for row in rows]
            conn.close()
            return self._send_json({"success": True, "users": users})
            
        elif path == '/api/logs':
            conn = sqlite3.connect(DB_PATH)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute('SELECT run, user_name, status, reader, relay, timestamp FROM access_logs ORDER BY id DESC LIMIT 50')
            rows = cursor.fetchall()
            logs = [dict(row) for row in rows]
            conn.close()
            return self._send_json({"success": True, "logs": logs})

        # Servir archivos estáticos del frontend
        return super().do_GET()

    def do_POST(self):
        parsed_url = urlparse(self.path)
        path = parsed_url.path
        
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length).decode('utf-8') if content_length > 0 else '{}'
        
        try:
            body = json.loads(post_data)
        except Exception:
            body = {}

        # ── API: Verificación de QR y Apertura de Puerta P1 ────────────
        if path == '/api/verify-qr':
            run_input = body.get('run', '').strip()
            clean_run = run_input.replace('.', '').replace('-', '').upper()

            conn = sqlite3.connect(DB_PATH)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            # Buscar coincidencia por RUN limpio o formateado
            cursor.execute('SELECT * FROM users WHERE REPLACE(REPLACE(run, ".", ""), "-", "") = ? OR run = ?', (clean_run, run_input))
            user = cursor.fetchone()

            if user:
                user_dict = dict(user)
                # Registrar acceso permitido
                cursor.execute(
                    'INSERT INTO access_logs (run, user_name, status, reader, relay) VALUES (?, ?, ?, ?, ?)',
                    (user_dict['run'], user_dict['name'], 'AUTORIZADO', 'P1', 'RELAY_1')
                )
                conn.commit()
                conn.close()

                return self._send_json({
                    "allowed": True,
                    "user": user_dict,
                    "relay_signal": "RELAY_1",
                    "duration_ms": 4000,
                    "message": f"🔓 ACCESO AUTORIZADO — Puerta P1 Abierta para {user_dict['name']}"
                })
            else:
                # Registrar intento fallido
                cursor.execute(
                    'INSERT INTO access_logs (run, user_name, status, reader, relay) VALUES (?, ?, ?, ?, ?)',
                    (run_input, 'Desconocido / No Enrolado', 'DENEGADO', 'P1', None)
                )
                conn.commit()
                conn.close()

                return self._send_json({
                    "allowed": False,
                    "run": run_input,
                    "message": f"⛔ ACCESO DENEGADO — RUN {run_input} no figura en la lista de enrolados. Puerta P1 Bloqueada."
                }, code=403)

        # ── API: Enrolamiento de Usuario ──────────────────────────────
        elif path == '/api/enroll':
            name = body.get('name', '').strip()
            run = body.get('run', '').strip()
            phone = body.get('phone', '').strip()
            email = body.get('email', '').strip()
            role = body.get('role', 'Alumno').strip()
            smtp_config = body.get('smtpConfig', None)

            if not name or not run or not email:
                return self._send_json({"success": False, "error": "Campos obligatorios faltantes"}, code=400)

            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            try:
                cursor.execute(
                    'INSERT INTO users (run, name, phone, email, role) VALUES (?, ?, ?, ?, ?)',
                    (run, name, phone, email, role)
                )
                conn.commit()
                conn.close()
                
                # Enviar correo real SMTP
                email_result = send_real_email(email, name, run, role, smtp_config)

                return self._send_json({
                    "success": True,
                    "message": f"Usuario {name} enrolado exitosamente en SQLite DB",
                    "email_status": email_result
                })
            except sqlite3.IntegrityError:
                conn.close()
                return self._send_json({"success": False, "error": f"El RUN {run} ya se encuentra enrolado en la base de datos"}, code=409)

        # ── API: Envío de Correo SMTP ──────────────────────────────────
        elif path == '/api/send-email':
            to_email = body.get('email')
            name = body.get('name')
            run = body.get('run')
            role = body.get('role', 'Alumno')
            smtp_config = body.get('smtpConfig', None)

            if not to_email or not run:
                return self._send_json({"success": False, "error": "Email o RUN no especificado"}, code=400)

            result = send_real_email(to_email, name, run, role, smtp_config)
            return self._send_json(result)

        return self._send_json({"error": "Endpoint no encontrado"}, code=404)

# ─────────────────────────────────────────────
# Ejecución Principal del Servidor Backend
# ─────────────────────────────────────────────
def main():
    init_db()
    server_address = ('', PORT)
    httpd = HTTPServer(server_address, ValtekRequestHandler)
    print(f"============================================")
    print(f"  VALTEK SECURITY — Backend Server Activo   ")
    print(f"  URL: http://localhost:{PORT}             ")
    print(f"  Base de datos: SQLite ({DB_PATH})         ")
    print(f"============================================")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor detenido correctamente.")
        httpd.server_close()

if __name__ == '__main__':
    main()
