<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json");

// Xử lý CORS preflight request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Kết nối database
require_once "../config/database.php";

if (!$conn) {
    echo json_encode(["error" => "Database connection failed"]);
    http_response_code(500);
    exit;
}

// Lấy và xử lý tham số thời gian
$start_time = isset($_GET['start_time']) ? $_GET['start_time'] : date('Y-m-d H:i:s', strtotime('-10 minutes'));
$end_time = isset($_GET['end_time']) ? $_GET['end_time'] : date('Y-m-d H:i:s');

// Truy vấn dữ liệu với Prepared Statement
$sql = "SELECT sensor_id, value, recorded_at FROM sensor_data WHERE recorded_at BETWEEN ? AND ? AND sensor_id LIKE ? ORDER BY recorded_at ASC";

$stmt = $conn->prepare($sql);
$search_pattern = "Lab%"; // Tìm kiếm sensor_id chứa "Lab"
$stmt->bind_param("sss", $start_time, $end_time, $search_pattern);

if ($stmt->execute()) {
    $result = $stmt->get_result();
    $data = [];

    while ($row = $result->fetch_assoc()) {
        $data[] = $row;
    }

    echo json_encode($data);
    http_response_code(200);
} else {
    echo json_encode(["error" => "Query execution failed"]);
    http_response_code(500);
}

// Đóng kết nối
$stmt->close();
$conn->close();
?>
