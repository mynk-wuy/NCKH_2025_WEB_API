from flask import Flask, jsonify  
from datetime import datetime    
import json  
import pandas as pd   
import numpy as np  
import requests  
from apscheduler.schedulers.background import BackgroundScheduler  
import logging  
from flask_cors import CORS  

# Thêm imports mới
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
import numpy as np
# Initialize logger
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


app = Flask(__name__)  
CORS(app)  # Chỉ cho phép các request từ mọi nguồn đến tất cả các API  
# Biến toàn cục để lưu trữ kết quả dự đoán mới nhất  
latest_predictions = {}  

# Hàm để đọc dữ liệu từ API và cập nhật DataFrame  
def fetch_sensor_data():  
    try:  
        api_url = 'http://localhost/routes/sensor_data.php'  
        response = requests.get(api_url)  

        if response.status_code == 200:  
            json_data = response.json()  
            df = pd.DataFrame(json_data)  # Chuyển JSON thành DataFrame  
            df['recorded_at'] = pd.to_datetime(df['recorded_at'])  # Chuyển timestamp thành datetime  
            df['value'] = pd.to_numeric(df['value'])  # Đảm bảo giá trị là kiểu số  
            return df  
        else:  
            logger.error(f"Lỗi khi lấy dữ liệu từ API: {response.status_code}")  
            return None  
    except Exception as e:  
        logger.error(f"Lỗi khi lấy dữ liệu: {str(e)}")  
        return None  

# Hàm dự đoán cho 3 giờ tới  
def predict_for_next_3_hours(df, sensor_id):  
    try:  
        # Lọc dữ liệu cho cảm biến cụ thể  
        sensor_data = df[df['sensor_id'] == sensor_id].reset_index(drop=True)  
        
        if sensor_data.empty:  
            return []  
        
        # Tạo thêm features từ timestamp  
        sensor_data['hour'] = sensor_data['recorded_at'].dt.hour  
        sensor_data['minute'] = sensor_data['recorded_at'].dt.minute  
        sensor_data['day_of_week'] = sensor_data['recorded_at'].dt.dayofweek  
        
        # Chuẩn bị dữ liệu  
        features = ['hour', 'minute', 'day_of_week']  
        X = sensor_data[features].values  
        y = sensor_data['value'].values  
        
        # Chia dữ liệu thành tập train và test  
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)  
        
        # Chuẩn hóa dữ liệu  
        scaler = StandardScaler()  
        X_train_scaled = scaler.fit_transform(X_train)  
        X_test_scaled = scaler.transform(X_test)  
        
        # Huấn luyện mô hình RandomForest  
        model = RandomForestRegressor(  
            n_estimators=100,  
            max_depth=10,  
            random_state=42  
        )  
        model.fit(X_train_scaled, y_train)  
        
        # Tạo future timestamps  
        current_time = sensor_data['recorded_at'].iloc[0] 
        future_times = []  
        future_features = []  
        
        for i in range(60):  # 30 điểm dự đoán  
            future_time = current_time + pd.Timedelta(minutes=3*i)  
            future_times.append(future_time)  
            future_features.append([  
                future_time.hour,  
                future_time.minute,  
                future_time.dayofweek  
            ])  
            
        # Dự đoán  
        future_features_scaled = scaler.transform(np.array(future_features))  
        predictions = model.predict(future_features_scaled)  
        
        # Thêm nhiễu ngẫu nhiên nhỏ để tránh dự đoán tăng đều  
        # noise = np.random.normal(0, predictions.std() * 0.05, predictions.shape)  
        # predictions = predictions + noise  
        
        # Đảm bảo giá trị không âm  
        predictions = np.maximum(predictions, 0)  
        
        # Tạo DataFrame kết quả  
        forecast_df = pd.DataFrame({  
            'timestamp': future_times,  
            'predicted_value': np.round(predictions, decimals=2)  
        })  
        
        # Chuyển đổi timestamp thành chuỗi  
        forecast_df['timestamp'] = forecast_df['timestamp'].dt.strftime('%Y-%m-%d %H:%M:%S')  
        
        return forecast_df.to_dict(orient='records')  
        
    except Exception as e:  
        logger.error(f"Lỗi khi dự đoán cho cảm biến {sensor_id}: {str(e)}")  
        return []  

# Hàm sẽ được chạy mỗi 10 phút để cập nhật dự đoán  
def update_predictions():  
    global latest_predictions  
    
    try:  
        logger.info("Bắt đầu cập nhật dự đoán...")  
        # Lấy dữ liệu mới nhất  
        df = fetch_sensor_data()  
        
        if df is None:  
            logger.error("Không thể cập nhật dự đoán do lỗi khi lấy dữ liệu")  
            return  
        
        # Danh sách các cảm biến  
        sensor_ids = ['Lab001CO', 'Lab001H2', 'Lab001NH3', 'A4002CO', 'A4002H2', 'A4002NH3']  
        
        all_predictions = {}  
        
        # Dự đoán cho tất cả các cảm biến trong danh sách  
        for sensor_id in sensor_ids:  
            predictions = predict_for_next_3_hours(df, sensor_id)  
            all_predictions[sensor_id] = predictions  
        
        # Cập nhật biến toàn cục  
        latest_predictions = all_predictions  
        
        # # Lưu kết quả dự đoán vào file để backup  
        # timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')  
        # with open(f'predictions_{timestamp}.json', 'w') as f:  
        #     json.dump(all_predictions, f)  
            
        logger.info(f"Đã cập nhật dự đoán thành công lúc {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")  
    except Exception as e:  
        logger.error(f"Lỗi khi cập nhật dự đoán: {str(e)}")  

# API endpoint trả về dự đoán  
@app.route('/predict', methods=['GET'])  
def get_prediction():  
    global latest_predictions  
    
    # Kiểm tra xem đã có dự đoán chưa  
    if not latest_predictions:  
        # Nếu chưa có dự đoán, thực hiện dự đoán ngay lập tức  
        df = fetch_sensor_data()  
        if df is not None:  
            sensor_ids = ['Lab001CO', 'Lab001H2', 'Lab001NH3', 'A4002CO', 'A4002H2', 'A4002NH3']  
            for sensor_id in sensor_ids:  
                predictions = predict_for_next_3_hours(df, sensor_id)  
                latest_predictions[sensor_id] = predictions  
    
    # Trả về kết quả dự đoán mới nhất  
    return jsonify({  
        'status': 'success',   
        'predictions': latest_predictions,  
        'last_updated': datetime.now().strftime('%Y-%m-%d %H:%M:%S')  
    })  

def init_scheduler():  
    """Khởi tạo scheduler để chạy cập nhật dự đoán mỗi 1 phút"""  
    scheduler = BackgroundScheduler()  
    scheduler.add_job(func=update_predictions, trigger="interval", minutes=1)  
    scheduler.start()  
    
    # Chạy một lần ngay khi khởi động để có dữ liệu ban đầu  
    update_predictions()  
    
    # Đăng ký hàm để dừng scheduler khi ứng dụng tắt  
    import atexit  
    atexit.register(lambda: scheduler.shutdown())  

def run_flask_app():  
    """Chạy Flask app"""  
    app.run(host='0.0.0.0', port=3000)  # Chạy trên tất cả các địa chỉ IP, có thể truy cập từ Internet nếu cấu hình mạng cho phép  

# Khởi tạo scheduler trước khi chạy Flask app
init_scheduler()
# Khởi chạy Flask app  
run_flask_app()
