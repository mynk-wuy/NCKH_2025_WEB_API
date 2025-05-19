// Biến toàn cục
let mqttClient = null;

// Các topic MQTT
const topics = {
    fanStatus: 'A4002/fan/status',     // Topic nhận trạng thái quạt từ ESP32
    ledStatus: 'A4002/led/status',     // Đã sửa thành A4002/led/status để phù hợp
    fanControl: 'A4002/fan/control',   // Topic gửi lệnh điều khiển quạt tới ESP32
    ledControl: 'A4002/led/control',   // Topic gửi lệnh điều khiển đèn tới ESP32
    sensorData1: 'Lab001/sensors/data',  // Thêm topic nhận dữ liệu cảm biến từ ESP32
    sensorData2: 'A4002/sensors/data', // Thêm topic nhận dữ liệu cảm biến từ ESP32
    modeControl: 'A4002/mode/control' // Topic gửi lệnh điều khiển chế độ tới ESP32
};

// Kiểm tra người dùng và khởi tạo khi trang tải
document.addEventListener("DOMContentLoaded", async function () {
    // Kiểm tra thông tin người dùng từ localStorage
    const user = JSON.parse(localStorage.getItem("user"));

    if (!user || !user.role_id) {
        window.location.href = "login.html";
        return;
    }

    // Hiển thị vai trò và phân quyền
    displayUserRole(user.role_id);
    handleUserRole(user.role_id);

    // Khởi tạo giao diện
    document.getElementById("control-link")?.classList.add("active");
    initializeDateTime();

    // Đặt trạng thái ban đầu cho radio button
    const autoRadio = document.querySelector('input[name="controlMode"][value="auto"]');
    if (autoRadio) {
        autoRadio.checked = true;
        toggleMode('auto'); // Gọi hàm để đồng bộ trạng thái
    }

    // Kết nối MQTT
    initializeMQTT();
    await fetchThresholds();
    // Cập nhật thời gian mỗi giây
    setInterval(updateTimestamp, 1000);

    // Thêm event listeners cho các nút điều khiển
    const fanSwitch = document.getElementById('fanSwitch');
    const ledSwitch = document.getElementById('ledSwitch');

    if (fanSwitch) {
        fanSwitch.addEventListener('change', function () {
            updateDeviceControl('fan', this.checked);
        });
    }

    if (ledSwitch) {
        ledSwitch.addEventListener('change', function () {
            updateDeviceControl('led', this.checked);
        });
    }
});

// Hàm hiển thị thông tin vai trò
function displayUserRole(role_id) {
    const roleElement = document.getElementById("user-role");
    if (!roleElement) return;

    const roles = {
        1: "Super Admin",
        2: "Admin Trạm 1",
        3: "Admin Trạm 2",
        4: "Viewer",
    };

    roleElement.textContent = `Vai trò: ${roles[role_id] || "Không xác định"}`;
}

// Hàm phân quyền
function handleUserRole(role_id) {
    const restrictedLinks = {
        2: ["quanlyuser.html", "giamsat2.html", "dieukhien2.html"],
        3: ["quanlyuser.html", "giamsat1.html", "dieukhien1.html"],
        4: ["quanlyuser.html", "dieukhien2.html", "dieukhien1.html", "device.html", "report.html"],
    };

    const menuItems = document.querySelectorAll(".menu a, .menu .subnavbtn");

    if (role_id === 1) {
        menuItems.forEach(item => (item.style.display = "block"));
        const mapContainer = document.getElementById("mapContainer");
        const detailedInfo = document.getElementById("detailedInfo");
        if (mapContainer) mapContainer.style.display = "block";
        if (detailedInfo) detailedInfo.style.display = "block";
    } else if (restrictedLinks[role_id]) {
        menuItems.forEach(item => {
            const href = item.getAttribute("href");
            item.style.display = restrictedLinks[role_id].includes(href) ? "none" : "block";
        });
    } else {
        window.location.href = "login.html";
    }
}
// Lấy ngưỡng từ API
let thresholds = {
    A4002CO: 400,
    A4002H2: 500,
    A4002NH3: 500,
    Lab001CO: 400,
    Lab001H2: 500,
    Lab001NH3: 500,
};

// Hàm lấy ngưỡng từ API (async/await)
async function fetchThresholds() {
    try {
        const response = await fetch("http://localhost/routes/getThreshold.php");
        const data = await response.json();

        if (data.success) {
            thresholds = data.data;
            console.log("Ngưỡng cảm biến:", thresholds);
            return thresholds;
        } else {
            console.error("Lỗi khi lấy ngưỡng:", data.message);
            return thresholds; // Trả về giá trị mặc định nếu có lỗi
        }
    } catch (error) {
        console.error("Lỗi kết nối API:", error);
        return thresholds; // Trả về giá trị mặc định nếu có lỗi
    }
}

// Khởi tạo kết nối MQTT
function initializeMQTT() {
    const broker = "fd553ba641bf43729bad8a7af8400930.s1.eu.hivemq.cloud";
    const port = 8884;
    const clientID = "web_" + Math.floor(Math.random() * 100000);
    const username = "NCKH2025";
    const password = "Manh09092003";

    mqttClient = new Paho.MQTT.Client(broker, port, clientID);

    mqttClient.onConnectionLost = function (responseObject) {
        if (responseObject.errorCode !== 0) {
            console.log("Mất kết nối: " + responseObject.errorMessage);
            updateMQTTStatus("Mất kết nối", "error");
            setTimeout(initializeMQTT, 5000);
        }
    };

    mqttClient.onMessageArrived = async function (message) {
        console.log("Received message:", message.payloadString, "from topic:", message.destinationName);

        // Xử lý trạng thái thiết bị
        if (message.destinationName === topics.fanStatus) {
            const fanSwitch = document.getElementById('fanSwitch');
            const fanStatus = document.getElementById('fanStatus');
            const status = message.payloadString === 'ON';

            if (fanSwitch) {
                fanSwitch.checked = status;
            }

            if (fanStatus) {
                fanStatus.textContent = status ? 'BẬT' : 'TẮT';
                fanStatus.className = `status-value ${status ? 'status-on' : 'status-off'}`;
            }
        } else if (message.destinationName === topics.ledStatus) {
            const ledSwitch = document.getElementById('ledSwitch');
            const ledStatus = document.getElementById('ledStatus');
            const status = message.payloadString === 'ON';

            if (ledSwitch) {
                ledSwitch.checked = status;
            }

            if (ledStatus) {
                ledStatus.textContent = status ? 'BẬT' : 'TẮT';
                ledStatus.className = `status-value ${status ? 'status-on' : 'status-off'}`;
            }
        }
        // Thêm phần xử lý dữ liệu cảm biến
        else if (message.destinationName === topics.sensorData1) {
            try {
                const sensorData = JSON.parse(message.payloadString);
                console.log("Dữ liệu cảm biến:", sensorData);

                const CO = sensorData.Lab001CO;
                const H2 = sensorData.Lab001H2;
                const NH3 = sensorData.Lab001NH3;
                console.log("Lab001CO:", CO, "Lab001H2:", H2, "Lab001NH3:", NH3);
                
                // Đảm bảo đã có ngưỡng trước khi so sánh
                const currentThresholds = thresholds; // Sử dụng biến toàn cục thresholds

                // Kiểm tra ngưỡng
                console.log("Ngưỡng hiện tại:", currentThresholds);
                if (CO > currentThresholds.Lab001CO) {
                    console.warn(`Cảnh báo: CO vượt ngưỡng! (${CO} > ${currentThresholds.Lab001CO})`);
                    triggerAlert('CO', CO, currentThresholds.Lab001CO);
                }
                if (H2 > currentThresholds.Lab001H2) {
                    console.warn(`Cảnh báo: H2 vượt ngưỡng! (${H2} > ${currentThresholds.Lab001H2})`);
                    triggerAlert('H2', H2, currentThresholds.Lab001H2);
                }
                if (NH3 > currentThresholds.Lab001NH3) {
                    console.warn(`Cảnh báo: NH3 vượt ngưỡng! (${NH3} > ${currentThresholds.Lab001NH3})`);
                    triggerAlert('NH3', NH3, currentThresholds.Lab001NH3);
                }

                
            } catch (e) {
                console.error("Lỗi xử lý dữ liệu cảm biến:", e);
            }
        }
        else if (message.destinationName === topics.sensorData2) {
            try {
                const sensorData = JSON.parse(message.payloadString);
                console.log("Dữ liệu cảm biến:", sensorData);

                const CO = sensorData.A4002CO;
                const H2 = sensorData.A4002H2;
                const NH3 = sensorData.A4002NH3;
                console.log("A4002CO:", CO, "A4002H2:", H2, "A4002NH3:", NH3);

                // Đảm bảo đã có ngưỡng trước khi so sánh
                const currentThresholds = await fetchThresholds();

                // Kiểm tra ngưỡng
                console.log("Ngưỡng hiện tại:", currentThresholds);
                if (CO > currentThresholds.A4002CO) {
                    console.warn(`Cảnh báo: CO vượt ngưỡng! (${CO} > ${currentThresholds.A4002CO})`);
                    triggerAlert('CO', CO, currentThresholds.A4002CO);
                }
                if (H2 > currentThresholds.A4002H2) {
                    console.warn(`Cảnh báo: H2 vượt ngưỡng! (${H2} > ${currentThresholds.A4002H2})`);
                    triggerAlert('H2', H2, currentThresholds.A4002H2);
                }
                if (NH3 > currentThresholds.A4002NH3) {
                    console.warn(`Cảnh báo: NH3 vượt ngưỡng! (${NH3} > ${currentThresholds.A4002NH3})`);
                    triggerAlert('NH3', NH3, currentThresholds.A4002NH3);
                }

                
            } catch (e) {
                console.error("Lỗi xử lý dữ liệu cảm biến:", e);
            }
        }
    };



    mqttClient.connect({
        useSSL: true,
        userName: username,
        password: password,
        onSuccess: function () {
            console.log("Connected to MQTT broker");
            updateMQTTStatus("Đã kết nối", "success");
            // Đăng ký các topic trạng thái thiết bị
            mqttClient.subscribe(topics.fanStatus);
            mqttClient.subscribe(topics.ledStatus);
            mqttClient.subscribe(topics.sensorData1); // Thêm dòng này
            mqttClient.subscribe(topics.sensorData2); // Thêm dòng này
            mqttClient.subscribe(topics.modeControl); // Thêm dòng này
        },
        onFailure: function (error) {
            console.log("Failed to connect: " + error.errorMessage);
            updateMQTTStatus("Kết nối thất bại", "error");
            setTimeout(initializeMQTT, 5000);
        }
    });
}

// Hàm xử lý cảnh báo
function triggerAlert(gasType, value, threshold) {
    // Có thể mở rộng: hiển thị thông báo trên giao diện
    const alertMessage = `CẢNH BÁO: ${gasType} vượt ngưỡng (${value} > ${threshold})`;
    showNotification(alertMessage);

    // Gửi lệnh điều khiển tự động nếu cần
    // if (document.querySelector('input[name="controlMode"][value="auto"]')?.checked) {
    //     handleAutoControl(gasType, true);
    // }
}

// Hàm hiển thị thông báo
function showNotification(message) {
    // Triển khai theo nhu cầu: console.log, toast notification, popup...
    console.log(message);
    // Ví dụ với toast notification:
    const notification = document.createElement('div');
    notification.className = 'alert-toast';
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 5000);
}
// Cập nhật trạng thái kết nối MQTT
function updateMQTTStatus(message, type) {
    const statusElement = document.getElementById("mqttStatus");
    if (!statusElement) return;

    statusElement.textContent = message;
    statusElement.className = `status-value ${type === "success" ? "status-on" : "status-off"}`;
}

// Hàm mới: Gửi lệnh điều khiển thiết bị qua MQTT
function updateDeviceControl(device, isOn) {
    const statusElement = document.getElementById(`${device}Status`);
    const mode = document.querySelector('input[name="controlMode"]:checked')?.value;

    if (!statusElement || mode !== 'manual') return;

    // Cập nhật hiển thị trạng thái
    statusElement.textContent = isOn ? 'BẬT' : 'TẮT';
    statusElement.className = `status-value ${isOn ? 'status-on' : 'status-off'}`;

    // Gửi lệnh qua MQTT
    const topic = device === 'fan' ? topics.fanControl : topics.ledControl;
    const message = isOn ? 'ON' : 'OFF';

    if (mqttClient && mqttClient.isConnected()) {
        const mqttMessage = new Paho.MQTT.Message(message);
        mqttMessage.destinationName = topic;
        mqttMessage.qos = 1;
        mqttMessage.retained = false;

        mqttClient.send(mqttMessage);
        console.log(`Đã gửi lệnh ${message} tới ${topic}`);
    } else {
        console.error("MQTT client không được kết nối");
        updateMQTTStatus("MQTT không kết nối", "error");
    }

    updateTimestamp();
}

// Chuyển đổi chế độ điều khiển
function toggleMode(mode) {
    const controlCards = document.querySelectorAll('.control-card');
    const modeStatus = document.getElementById('modeStatus');

    if (!modeStatus) return;

    modeStatus.textContent = mode === 'manual' ? 'BẰNG TAY' : 'TỰ ĐỘNG';

    controlCards.forEach(card => {
        if (mode === 'auto') {
            card.classList.add('disabled');
        } else {
            card.classList.remove('disabled');
        }
    });

    // Gửi thông tin chế độ tới ESP32 nếu cần
    if (mqttClient && mqttClient.isConnected()) {
        const modeMessage = new Paho.MQTT.Message(mode.toUpperCase());
        modeMessage.destinationName = 'A4002/mode/control';
        modeMessage.qos = 1;
        modeMessage.retained = false;
        mqttClient.send(modeMessage);
    }
}

// Cập nhật thời gian
function updateTimestamp() {
    const updateTime = document.getElementById('updateTime');
    if (updateTime) {
        updateTime.textContent = new Date().toLocaleString('vi-VN');
    }
}

// Khởi tạo hiển thị thời gian
function initializeDateTime() {
    updateTimestamp();
}