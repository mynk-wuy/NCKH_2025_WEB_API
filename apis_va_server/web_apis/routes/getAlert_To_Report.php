<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Max-Age: 3600");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once "../config/database.php";

if (!$conn) {
    echo json_encode(["error" => "Không thể kết nối đến cơ sở dữ liệu"]);
    exit;
}

$time_range = isset($_GET['time_range']) ? $_GET['time_range'] : 'day';
$sensor_type = isset($_GET['sensor_type']) ? $_GET['sensor_type'] : 'all';

// Sử dụng created_at thay vì recorded_at
switch ($time_range) {
    case 'day':
        $time_condition = "created_at >= NOW() - INTERVAL 1 DAY";
        break;
    case 'week':
        $time_condition = "created_at >= NOW() - INTERVAL 1 WEEK";
        break;
    case 'month':
        $time_condition = "created_at >= NOW() - INTERVAL 1 MONTH";
        break;
    default:
        $time_condition = "created_at >= NOW() - INTERVAL 1 DAY";
}

try {
    if ($sensor_type !== 'all') {
        $stmt = $conn->prepare("SELECT sensor_id, alert_type, severity, message, created_at FROM alerts 
                              WHERE $time_condition AND sensor_id LIKE CONCAT('%', ?) 
                              ORDER BY created_at ASC");
        $stmt->bind_param("s", $sensor_type);
    } else {
        $stmt = $conn->prepare("SELECT sensor_id, alert_type, severity, message, created_at FROM alerts 
                              WHERE $time_condition 
                              ORDER BY created_at ASC");
    }
    
    $stmt->execute();
    $result = $stmt->get_result();
    
    $alerts = [];
    while ($row = $result->fetch_assoc()) {
        $alerts[] = $row;
    }
    
    echo json_encode($alerts);
    
} catch (Exception $e) {
    echo json_encode(["error" => "Lỗi khi truy vấn dữ liệu: " . $e->getMessage()]);
}

$conn->close();
?>