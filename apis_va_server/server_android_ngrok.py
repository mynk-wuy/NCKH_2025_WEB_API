from flask import Flask, jsonify, request
from flask_mysqldb import MySQL
from flask_cors import CORS
from pyngrok import ngrok
from datetime import datetime
import paho.mqtt.client as mqtt
import threading
import json
import os
import MySQLdb
import logging
import re
import bcrypt

# Cấu hình logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Hỗ trợ CORS cho tất cả routes

# Cấu hình từ biến môi trường hoặc sử dụng giá trị mặc định
app.config['MYSQL_HOST'] = os.environ.get('MYSQL_HOST', 'localhost')
app.config['MYSQL_USER'] = os.environ.get('MYSQL_USER', 'manhnguyen')
app.config['MYSQL_PASSWORD'] = os.environ.get('MYSQL_PASSWORD', 'manh09092003')
app.config['MYSQL_DB'] = os.environ.get('MYSQL_DB', 'scada_phanquyen')
mysql = MySQL(app)

# Cấu hình MQTT
MQTT_BROKER = os.environ.get('MQTT_BROKER', "fd553ba641bf43729bad8a7af8400930.s1.eu.hivemq.cloud")
MQTT_PORT = int(os.environ.get('MQTT_PORT', 8883))
MQTT_USER = os.environ.get('MQTT_USER', "NCKH2025")
MQTT_PASSWORD = os.environ.get('MQTT_PASSWORD', "Manh09092003")
MQTT_TOPIC1 = os.environ.get('MQTT_TOPIC1', "A4002/sensors/data")
MQTT_TOPIC2 = os.environ.get('MQTT_TOPIC2', "Lab001/sensors/data")

# Biến toàn cục để lưu trạng thái MQTT
mqtt_client = None
mqtt_connected = False
mqtt_last_message_time = None

def get_db_connection():
    """Tạo và trả về kết nối database mới"""
    return MySQLdb.connect(
        host=app.config['MYSQL_HOST'],
        user=app.config['MYSQL_USER'],
        passwd=app.config['MYSQL_PASSWORD'],
        db=app.config['MYSQL_DB'],
        charset="utf8mb4"
    )

def save_to_database(data):
    """Lưu dữ liệu vào database"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # Lưu dữ liệu các sensor
        sensors_to_save = [
            ("A4002CO", data.get("A4002CO")),
            ("Lab001CO", data.get("Lab001CO")),
            ("A4002H2", data.get("A4002H2")),
            ("Lab001H2", data.get("Lab001H2")),
            ("A4002NH3", data.get("A4002NH3")),
            ("Lab001NH3", data.get("Lab001NH3"))
        ]

        for sensor_id, value in sensors_to_save:
            if value is not None:
                cur.execute("""
                    INSERT INTO sensor_data (sensor_id, value) 
                    VALUES (%s, %s)
                """, (sensor_id, value))

        conn.commit()
        logger.info("✅ Đã lưu dữ liệu vào database")

    except Exception as e:
        logger.error(f"❌ Lỗi khi lưu database: {e}")
        if 'conn' in locals():
            conn.rollback()
    finally:
        if 'cur' in locals():
            cur.close()
        if 'conn' in locals():
            conn.close()

# Cập nhật hàm callback MQTT để phù hợp với cả v5 và v3.1.1
def on_connect(client, userdata, flags, rc, properties=None):
    """Callback khi kết nối MQTT thành công"""
    global mqtt_connected
    if rc == 0:
        mqtt_connected = True
        logger.info(f"✅ Kết nối MQTT thành công! Mã: {rc}")
        client.subscribe(MQTT_TOPIC1)
        client.subscribe(MQTT_TOPIC2)
    else:
        mqtt_connected = False
        logger.error(f"❌ Kết nối MQTT thất bại! Mã lỗi: {rc}")

def on_disconnect(client, userdata, rc, reasoncode=None, properties=None):
    """Callback khi ngắt kết nối MQTT"""
    global mqtt_connected
    mqtt_connected = False
    logger.warning(f"⚠️ Đã ngắt kết nối MQTT. Mã: {rc}")

def on_message(client, userdata, msg):
    """Callback khi nhận message MQTT"""
    global mqtt_last_message_time
    mqtt_last_message_time = datetime.now()
    
    try:
        payload = msg.payload.decode('utf-8')
        data = json.loads(payload)
        logger.info(f"📥 Nhận dữ liệu từ {msg.topic}: {data}")
        save_to_database(data)
        
    except json.JSONDecodeError as e:
        logger.error(f"❌ Lỗi giải mã JSON: {e}")
    except UnicodeDecodeError as e:
        logger.error(f"❌ Lỗi giải mã UTF-8: {e}")
    except Exception as e:
        logger.error(f"❌ Lỗi xử lý message: {e}")

def start_mqtt_client():
    """Khởi tạo và chạy MQTT client"""
    global mqtt_client
    
    # Sử dụng Client bình thường thay vì chỉ định CallbackAPIVersion
    mqtt_client = mqtt.Client(client_id="scada_server", protocol=mqtt.MQTTv5)
    mqtt_client.username_pw_set(MQTT_USER, MQTT_PASSWORD)
    mqtt_client.tls_set()
    
    mqtt_client.on_connect = on_connect
    mqtt_client.on_disconnect = on_disconnect
    mqtt_client.on_message = on_message
    
    try:
        mqtt_client.connect(MQTT_BROKER, MQTT_PORT, 60)
        logger.info("Đang kết nối đến MQTT broker...")
        mqtt_client.loop_forever()
    except Exception as e:
        logger.error(f"❌ Lỗi MQTT client: {e}")
    finally:
        # Chỉ disconnect nếu client đã được kết nối
        if mqtt_client and mqtt_connected:
            mqtt_client.disconnect()

@app.route('/api/mqtt/status', methods=['GET'])
def get_mqtt_status():
    """API trả về trạng thái kết nối MQTT"""
    status = {
        "connected": mqtt_connected,
        "last_message": mqtt_last_message_time.strftime('%Y-%m-%d %H:%M:%S') if mqtt_last_message_time else None,
        "broker": MQTT_BROKER,
        "topics": [MQTT_TOPIC1, MQTT_TOPIC2]
    }
    return jsonify(status)

@app.route('/api/sensor/data', methods=['GET'])
def get_sensor_data():
    """Lấy dữ liệu sensor từ database"""
    try:
        limit = request.args.get('limit', default=10000, type=int)
        sensor_id = request.args.get('sensor_id', default=None, type=str)
        
        cur = mysql.connection.cursor()
        
        if sensor_id:
            cur.execute("""
                SELECT data_id, sensor_id, value, recorded_at 
                FROM sensor_data 
                WHERE sensor_id = %s
                ORDER BY recorded_at DESC 
                LIMIT %s
            """, (sensor_id, limit))
        else:
            cur.execute("""
                SELECT data_id, sensor_id, value, recorded_at 
                FROM sensor_data 
                ORDER BY recorded_at DESC 
                LIMIT %s
            """, (limit,))
        
        rows = cur.fetchall()
        
        sensor_data = [{
            "data_id": row[0],
            "sensor_id": row[1],
            "value": float(row[2]),
            "recorded_at": row[3].strftime('%Y-%m-%d %H:%M:%S') if isinstance(row[3], datetime) else str(row[3])
        } for row in rows]
        
        return jsonify({
            "success": True,
            "count": len(sensor_data),
            "data": sensor_data
        })
    
    except Exception as e:
        logger.error(f"Lỗi khi lấy dữ liệu sensor: {e}")
        return jsonify({"success": False, "error": str(e)}), 500
    finally:
        if 'cur' in locals():
            cur.close()

@app.route('/api/users', methods=['GET'])
def get_users():
    """Lấy danh sách users"""
    try:
        cur = mysql.connection.cursor()
        cur.execute("""
            SELECT user_id, username, password, email, role_id 
            FROM users
        """)
        rows = cur.fetchall()
        
        users = [{
            "user_id": row[0],
            "username": row[1],
            "password": row[2],
            "email": row[3],
            "role_id": row[4]
        } for row in rows]
        
        return jsonify({
            "success": True,
            "count": len(users),
            "users": users
        })    
    except Exception as e:
        logger.error(f"Lỗi khi lấy danh sách users: {e}")
        return jsonify({"success": False, "error": str(e)}), 500
    finally:
        if 'cur' in locals():
            cur.close()

@app.route('/api/devices', methods=['GET', 'POST'])
def quanlydevices():
    try:
        with mysql.connection.cursor() as cursor:
            if request.method == 'GET':
                cursor.execute("""
                    SELECT sensor_id, name_sensor, location, type, created_at, donvi, threshold 
                    FROM sensors
                """)
                sensors = [
                    {
                        "sensor_id": row[0],
                        "name_sensor": row[1],
                        "location": row[2],
                        "type": row[3],
                        "created_at": row[4].strftime('%Y-%m-%d %H:%M:%S') if isinstance(row[4], datetime) else str(row[4]),
                        "donvi": row[5],
                        "threshold": float(row[6]) if row[6] is not None else None
                    }
                    for row in cursor.fetchall()
                ]
                return jsonify(sensors)

            elif request.method == 'POST':
                data = request.get_json()
                required_fields = ['sensor_id', 'name_sensor', 'location', 'type', 'donvi']
                if not data or not all(field in data for field in required_fields):
                    return jsonify({'error': 'Thiếu thông tin cần thiết'}), 400

                sensor_id = data['sensor_id']

                # Kiểm tra sensor_id đã tồn tại
                cursor.execute("SELECT COUNT(*) FROM sensors WHERE sensor_id = %s", (sensor_id,))
                if cursor.fetchone()[0] > 0:
                    return jsonify({'error': 'Mã cảm biến đã tồn tại'}), 409

                cursor.execute("""
                    INSERT INTO sensors (sensor_id, name_sensor, location, type, donvi, threshold)
                    VALUES (%s, %s, %s, %s, %s, %s)
                """, (
                    sensor_id,
                    data['name_sensor'],
                    data['location'],
                    data['type'],
                    data['donvi'],
                    data.get('threshold')
                ))
                mysql.connection.commit()
                return jsonify({'message': 'Đã thêm cảm biến mới!'}), 201

    except Exception as e:
        logger.error(f"Lỗi khi xử lý API quanlydevices: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/devices/<string:sensor_id>', methods=['PUT', 'DELETE'])
def device_detail(sensor_id):
    try:
        with mysql.connection.cursor() as cursor:
            # Kiểm tra cảm biến tồn tại
            cursor.execute("SELECT COUNT(*) FROM sensors WHERE sensor_id = %s", (sensor_id,))
            if cursor.fetchone()[0] == 0:
                return jsonify({'error': 'Không tìm thấy cảm biến'}), 404

            if request.method == 'PUT':
                data = request.get_json()
                required_fields = ['name_sensor', 'location', 'type', 'donvi']
                if not data or not all(field in data for field in required_fields):
                    return jsonify({'error': 'Thiếu thông tin cần thiết'}), 400

                cursor.execute("""
                    UPDATE sensors
                    SET name_sensor = %s, location = %s, type = %s, donvi = %s, threshold = %s
                    WHERE sensor_id = %s
                """, (
                    data['name_sensor'],
                    data['location'],
                    data['type'],
                    data['donvi'],
                    data.get('threshold'),
                    sensor_id
                ))
                mysql.connection.commit()
                return jsonify({'message': 'Đã cập nhật cảm biến thành công!'})

            elif request.method == 'DELETE':
                cursor.execute("DELETE FROM sensors WHERE sensor_id = %s", (sensor_id,))
                mysql.connection.commit()
                return '', 204  # No Content

    except Exception as e:
        logger.error(f"Lỗi khi xử lý cảm biến {sensor_id}: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/quanlyusers', methods=['GET', 'POST'])
def quanlyusers():
    try:
        with mysql.connection.cursor() as cursor:
            if request.method == 'GET':
                # Lấy danh sách người dùng
                cursor.execute("""
                    SELECT users.user_id, users.username, roles.role_name, users.email, users.created_at 
                    FROM users 
                    INNER JOIN roles ON users.role_id = roles.role_id
                """)
                users = [
                    {
                        "user_id": row[0],
                        "username": row[1],
                        "role_name": row[2],
                        "email": row[3],
                        "created_at": row[4].strftime('%Y-%m-%d %H:%M:%S') if isinstance(row[4], datetime) else str(row[4])
                    }
                    for row in cursor.fetchall()
                ]
                return jsonify(users)

            elif request.method == 'POST':
                data = request.get_json()
                if not data:
                    return jsonify({"error": "Không có dữ liệu được gửi"}), 400

                # Validate dữ liệu đầu vào
                username = data.get('username')
                role_id = data.get('role_id')
                email = data.get('email')
                password = data.get('password')

                if not all([username, role_id, email, password]):
                    return jsonify({"error": "Thiếu thông tin cần thiết"}), 400

                if not re.match(r"[^@]+@[^@]+\.[^@]+", email):
                    return jsonify({"error": "Email không hợp lệ"}), 400

                

                try:
                    cursor.execute("""
                        INSERT INTO users (username, password, email, role_id) 
                        VALUES (%s, %s, %s, %s)
                    """, (username, password, email, role_id))
                    mysql.connection.commit()
                    return jsonify({"message": "Đã thêm người dùng mới!"}), 201
                except Exception as e:
                    mysql.connection.rollback()
                    raise e

    except Exception as e:
        logger.error(f"Lỗi khi xử lý API quanlyusers: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/quanlyusers/<int:user_id>', methods=['PUT', 'DELETE'])
def user_detail(user_id):
    try:
        with mysql.connection.cursor() as cursor:
            # Kiểm tra user tồn tại
            cursor.execute("SELECT COUNT(*) FROM users WHERE user_id = %s", (user_id,))
            if cursor.fetchone()[0] == 0:
                return jsonify({"error": "Không tìm thấy người dùng"}), 404
                
            if request.method == 'PUT':
                data = request.get_json()
                if not data:
                    return jsonify({"error": "Không có dữ liệu được gửi"}), 400

                # Validate dữ liệu
                username = data.get('username')
                email = data.get('email')
                role_id = data.get('role_id')

                if not all([username, email, role_id]):
                    return jsonify({"error": "Thiếu thông tin cần thiết"}), 400

                if not re.match(r"[^@]+@[^@]+\.[^@]+", email):
                    return jsonify({"error": "Email không hợp lệ"}), 400

                try:
                    cursor.execute("""
                        UPDATE users 
                        SET username = %s, email = %s, role_id = %s 
                        WHERE user_id = %s
                    """, (username, email, role_id, user_id))
                    mysql.connection.commit()
                    return jsonify({"message": "Đã cập nhật thông tin người dùng!"})
                except Exception as e:
                    mysql.connection.rollback()
                    raise e

            elif request.method == 'DELETE':
                try:
                    cursor.execute("DELETE FROM users WHERE user_id = %s", (user_id,))
                    mysql.connection.commit()
                    return '', 204  # Status code 204 (No Content) cho DELETE
                except Exception as e:
                    mysql.connection.rollback()
                    raise e

    except Exception as e:
        logger.error(f"Lỗi khi xử lý user {user_id}: {e}")
        return jsonify({"error": str(e)}), 500

def run_flask_app():
    """Chạy Flask app"""
    try:
        # Kiểm tra nếu có biến môi trường DISABLE_NGROK
        should_use_ngrok = os.environ.get('DISABLE_NGROK', 'False').lower() != 'true'
        
        if should_use_ngrok:
            try:
                public_url = ngrok.connect(5000).public_url
                logger.info(f"""
                🚀 API đã sẵn sàng với ngrok:
                - MQTT Status: {public_url}/api/mqtt/status
                - Sensor Data: {public_url}/api/sensor/data
                - Users Data: {public_url}/api/users
                - Device: {public_url}/api/devices
                - Quanlyusers: {public_url}/api/quanlyusers
                """)
            except Exception as e:
                logger.warning(f"Không thể kết nối ngrok: {e}")
                logger.info("""
                🚀 API đã sẵn sàng tại địa chỉ localhost:5000:
                - MQTT Status: http://localhost:5000/api/mqtt/status
                - Sensor Data: http://localhost:5000/api/sensor/data
                - Users Data: http://localhost:5000/api/users
                - Device: http://localhost:5000/api/devices
                - Quanlyusers: http://localhost:5000/api/quanlyusers
                """)
        else:
            logger.info("""
            🚀 API đã sẵn sàng tại địa chỉ localhost:5000:
            - MQTT Status: http://localhost:5000/api/mqtt/status
            - Sensor Data: http://localhost:5000/api/sensor/data
            - Users Data: http://localhost:5000/api/users
            - Device: http://localhost:5000/api/devices
            - Quanlyusers: http://localhost:5000/api/quanlyusers
            """)
            
        logger.info(f"""
        📡 Đang lắng nghe dữ liệu từ MQTT:
          - Topic 1: {MQTT_TOPIC1}
          - Topic 2: {MQTT_TOPIC2}
        """)
            
        # Trong môi trường production, nên tắt debug mode
        is_debug = os.environ.get('FLASK_DEBUG', 'False').lower() == 'true'
        app.run(host='0.0.0.0', port=5000, debug=is_debug)
    except Exception as e:
        logger.error(f"Lỗi khi khởi chạy Flask app: {e}")

if __name__ == '__main__':
    # Khởi chạy MQTT client trong thread riêng
    mqtt_thread = threading.Thread(target=start_mqtt_client, daemon=True)
    mqtt_thread.start()
    
    # Khởi chạy Flask app
    run_flask_app()
