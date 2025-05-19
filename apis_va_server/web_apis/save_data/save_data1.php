<?php
// Hiển thị lỗi để debug
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// Cấu hình CORS
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

// Xử lý OPTIONS (preflight)
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    exit(0);
}

// Kết nối database
require_once "../config/database.php";
if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(["error" => "Database connection failed: " . $conn->connect_error]);
    exit();
}

// Nhận dữ liệu JSON từ ESP32
$rawData = file_get_contents("php://input");
error_log("📥 Received raw data: " . $rawData);


// Giải mã JSON
$data = json_decode($rawData, true);


// Trích xuất dữ liệu
$sensor_id = isset($data['sensor_id']) ? $data['sensor_id'] : '';
$value = isset($data['value']) ? floatval($data['value']) : 0.0;

error_log("✅ Processed data - sensor_id: $sensor_id, value: $value");

// Kiểm tra dữ liệu hợp lệ
if (is_numeric($value)) {
    // Lưu vào database
    $stmt = $conn->prepare("INSERT INTO sensor_data (sensor_id, value) VALUES (?, ? )");
    $stmt->bind_param("sd", $sensor_id, $value);
    echo "sensor_id: " . $sensor_id;
    if ($stmt->execute()) {
        echo json_encode(["success" => "Data saved successfully"]);
    } else {
        echo json_encode(["error" => "Failed to save data: " . $stmt->error]);
    }
    $stmt->close();
} else {
    echo json_encode(["error" => "Invalid sensor data"]);
}

// Đóng kết nối
$conn->close();
?>
