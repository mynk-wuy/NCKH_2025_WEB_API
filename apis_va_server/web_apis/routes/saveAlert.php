<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, DELETE, PUT, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json; charset=UTF-8");

// Xử lý OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Nhận dữ liệu từ client
$data = json_decode(file_get_contents("php://input"));

// Kiểm tra dữ liệu hợp lệ
if (!empty($data->sensor_id) &&
    !empty($data->alert_type) &&
    !empty($data->severity) &&
    !empty($data->message)) {
    
    require_once "../config/database.php";

    // Kiểm tra kết nối
    if ($conn->connect_error) {
        http_response_code(500);
        echo json_encode([
            "success" => false,
            "message" => "Lỗi kết nối database: " . $conn->connect_error
        ]);
        exit();
    }

    // Chuẩn bị câu lệnh SQL
    $sql = "INSERT INTO alerts (sensor_id, alert_type, severity, message) 
            VALUES (?, ?, ?, ?)";

    $stmt = $conn->prepare($sql);
    
    if ($stmt === false) {
        http_response_code(500);
        echo json_encode([
            "success" => false,
            "message" => "Lỗi chuẩn bị câu lệnh: " . $conn->error
        ]);
        $conn->close();
        exit();
    }

    // Bind các tham số
    $stmt->bind_param("ssss", 
        $data->sensor_id, 
        $data->alert_type, 
        $data->severity, 
        $data->message
    );

    // Thực thi
    if ($stmt->execute()) {
        http_response_code(201);
        echo json_encode([
            "success" => true,
            "message" => "Cảnh báo đã được lưu thành công."
        ]);
    } else {
        http_response_code(503);
        echo json_encode([
            "success" => false,
            "message" => "Không thể lưu cảnh báo: " . $stmt->error
        ]);
    }

    // Đóng kết nối
    $stmt->close();
    $conn->close();
} else {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "Dữ liệu không hợp lệ. Thiếu thông tin bắt buộc."
    ]);
}
?>