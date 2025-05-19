// Khởi tạo kết nối MQTT
let mqttClient = null;
const topics = {
    sensorData1: 'Lab001/sensors/data',
    sensorData2: 'A4002/sensors/data'
};

function initializeMQTT() {
    const broker = "fd553ba641bf43729bad8a7af8400930.s1.eu.hivemq.cloud";
    const port = 8884;
    const clientID = "web_" + Math.floor(Math.random() * 100000);
    const username = "NCKH2025";
    const password = "Manh09092003";

    mqttClient = new Paho.MQTT.Client(broker, port, clientID);

    mqttClient.onConnectionLost = (responseObject) => {
        if (responseObject.errorCode !== 0) {
            console.log("Mất kết nối: " + responseObject.errorMessage);
            updateMQTTStatus("Mất kết nối", "error");
            setTimeout(initializeMQTT, 5000);
        }
    };

    mqttClient.onMessageArrived = async (message) => {
        console.log("Nhận dữ liệu từ topic:", message.destinationName);
        try {
            const sensorData = JSON.parse(message.payloadString);
            processSensorData(message.destinationName, sensorData);
        } catch (e) {
            console.error("Lỗi xử lý dữ liệu cảm biến:", e);
        }
    };

    mqttClient.connect({
        useSSL: true,
        userName: username,
        password: password,
        onSuccess: () => {
            console.log("Connected to MQTT broker");
            updateMQTTStatus("Đã kết nối", "success");
            mqttClient.subscribe(topics.sensorData1);
            mqttClient.subscribe(topics.sensorData2);
            console.log("Subscribed to:", topics.sensorData1, topics.sensorData2);
        },
        onFailure: (error) => {
            console.log("Kết nối thất bại:", error.errorMessage);
            updateMQTTStatus("Kết nối thất bại", "error");
            setTimeout(initializeMQTT, 5000);
        }
    });
}

// Chỉnh sửa hàm processSensorData để sửa lỗi khi gọi triggerAlert
async function processSensorData(topic, sensorData) {
    console.log("Dữ liệu cảm biến:", sensorData);
    // Đảm bảo đã có ngưỡng trước khi so sánh
    const currentThresholds = thresholds; // Sử dụng biến toàn cục thresholds

    if (topic === topics.sensorData1) {
        const CO = sensorData.Lab001CO;
        const H2 = sensorData.Lab001H2;
        const NH3 = sensorData.Lab001NH3;
        console.log("Lab001CO:", CO, "Lab001H2:", H2, "Lab001NH3:", NH3);

        // Kiểm tra ngưỡng
        console.log("Ngưỡng hiện tại:", currentThresholds);
        if (CO > currentThresholds.Lab001CO) {
            console.warn(`Cảnh báo: Lab001CO vượt ngưỡng! (${CO} > ${currentThresholds.Lab001CO})`);
            triggerAlert('CO', CO, currentThresholds.Lab001CO, 'Lab001');
            alert(`Cảnh báo: Lab001CO vượt ngưỡng! (${CO} > ${currentThresholds.Lab001CO})`);
        }
        if (H2 > currentThresholds.Lab001H2) {
            console.warn(`Cảnh báo: Lab001H2 vượt ngưỡng! (${H2} > ${currentThresholds.Lab001H2})`);
            triggerAlert('H2', H2, currentThresholds.Lab001H2, 'Lab001');
            alert(`Cảnh báo: Lab001H2 vượt ngưỡng! (${H2} > ${currentThresholds.Lab001H2})`);
        }
        if (NH3 > currentThresholds.Lab001NH3) {
            console.warn(`Cảnh báo: Lab001NH3 vượt ngưỡng! (${NH3} > ${currentThresholds.Lab001NH3})`);
            triggerAlert('NH3', NH3, currentThresholds.Lab001NH3, 'Lab001');
            alert(`Cảnh báo: Lab001NH3 vượt ngưỡng! (${NH3} > ${currentThresholds.Lab001NH3})`);
        }
    }
    else if (topic === topics.sensorData2) {
        const CO = sensorData.A4002CO;
        const H2 = sensorData.A4002H2;
        const NH3 = sensorData.A4002NH3;
        console.log("A4002CO:", CO, "A4002H2:", H2, "A4002NH3:", NH3);

        // Kiểm tra ngưỡng
        console.log("Ngưỡng hiện tại:", currentThresholds);
        if (CO > currentThresholds.A4002CO) {
            console.warn(`Cảnh báo: A4002CO vượt ngưỡng! (${CO} > ${currentThresholds.A4002CO})`);
            triggerAlert('CO', CO, currentThresholds.A4002CO, 'A4002');
        }
        if (H2 > currentThresholds.A4002H2) {
            console.warn(`Cảnh báo: A4002H2 vượt ngưỡng! (${H2} > ${currentThresholds.A4002H2})`);
            triggerAlert('H2', H2, currentThresholds.A4002H2, 'A4002');
        }
        if (NH3 > currentThresholds.A4002NH3) {
            console.warn(`Cảnh báo: A4002NH3 vượt ngưỡng! (${NH3} > ${currentThresholds.A4002NH3})`);
            triggerAlert('NH3', NH3, currentThresholds.A4002NH3, 'A4002');
        }
    }
}

// Hàm lấy ngưỡng từ API
let thresholds = {
    Lab001CO: 500,
    Lab001H2: 500,
    Lab001NH3: 500,
    A4002CO: 400,
    A4002H2: 600,
    A4002NH3: 500
};

async function fetchThresholds() {
    try {
        const response = await fetch("http://localhost/routes/getThreshold.php");
        const data = await response.json();

        if (data.success) {
            thresholds = data.data;
            console.log("Ngưỡng cảm biến cập nhật:", thresholds);
            return thresholds;
        } else {
            console.error("Lỗi khi lấy ngưỡng:", data.message);
        }
    } catch (error) {
        console.error("Lỗi kết nối API:", error);
    }
    return thresholds; // Trả về giá trị hiện có nếu lỗi
}
// Hàm lưu cảnh báo vào MySQL
async function saveAlertToDatabase(location, gasType, value, threshold, severity) {
    try {
        // Xác định sensor_id từ location và gasType
        const sensor_id = `${location}${gasType}`;
        
        // Tạo message
        const message = `Nồng độ ${gasType} vượt quá ngưỡng: ${value}ppm`;
        
        // Chuẩn bị dữ liệu gửi đi
        const alertData = {
            sensor_id: sensor_id,
            alert_type: 'nồng độ khí cao',
            severity: severity,
            message: message,          
        };
        
        // Gọi API để lưu cảnh báo
        const response = await fetch('http://localhost/routes/saveAlert.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(alertData),
            credentials: 'omit' // Hoặc 'include' nếu cần cookie
        });
        
        const result = await response.json();
        
        if (result.success) {
            console.log(`Đã lưu cảnh báo ${sensor_id} vào cơ sở dữ liệu`);
        } else {
            console.error('Lỗi khi lưu cảnh báo:', result.message);
        }
    } catch (error) {
        console.error('Lỗi kết nối API saveAlert:', error);
    }
}

// Hàm xử lý cảnh báo
function triggerAlert(gasType, value, threshold, location) {
    // Xác định location nếu không được truyền vào
    if (!location) {
        // Xác định location dựa trên topic hiện tại và gasType
        if (gasType.includes('Lab001')) {
            location = 'Lab001';
        } else if (gasType.includes('A4002')) {
            location = 'A4002';
        }
    }
    
    // Xác định mức độ nghiêm trọng dựa trên % vượt ngưỡng
    let severity;
    const percentOverThreshold = (value / threshold) * 100;
    
    if (percentOverThreshold >= 150) {
        severity = 'high';
    } else {
        severity = 'medium';
    } 
    
    // Hiển thị thông báo cho người dùng
    const alertMessage = `🚨 CẢNH BÁO: ${gasType} tại ${location} vượt ngưỡng (${value} > ${threshold})`;
    showNotification(alertMessage);
    
    // Lưu cảnh báo vào cơ sở dữ liệu
    saveAlertToDatabase(location, gasType, value, threshold, severity);
}

// Hàm hiển thị thông báo
function showNotification(message) {
    console.log(message);
    const notification = document.createElement('div');
    notification.className = 'alert-toast';
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 5000);
}

// Cập nhật trạng thái MQTT
function updateMQTTStatus(message, type) {
    const statusElement = document.getElementById("mqttStatus");
    if (!statusElement) return;

    statusElement.textContent = message;
    statusElement.className = `status-value ${type === "success" ? "status-on" : "status-off"}`;
}

export { initializeMQTT, fetchThresholds, saveAlertToDatabase };
