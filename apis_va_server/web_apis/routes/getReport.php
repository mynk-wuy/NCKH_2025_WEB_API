<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, DELETE, PUT, OPTIONS"); // Cho phép các phương thức HTTP
header("Access-Control-Allow-Headers: Content-Type"); // Cho phép các header cụ thể

// Xử lý yêu cầu OPTIONS (preflight)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit; // Dừng xử lý và trả về phản hồi trống
}
require_once "../config/database.php";// Kết nối database

// Lấy tham số từ query
$time_range = isset($_GET['time_range']) ? $_GET['time_range'] : 'day';
$sensor_type = isset($_GET['sensor_type']) ? $_GET['sensor_type'] : 'all';

// Xác định khoảng thời gian
$time_condition = "";
switch ($time_range) {
    case 'day':
        $time_condition = "recorded_at >= NOW() - INTERVAL 1 DAY";
        break;
    case 'week':
        $time_condition = "recorded_at >= NOW() - INTERVAL 1 WEEK";
        break;
    case 'month':
        $time_condition = "recorded_at >= NOW() - INTERVAL 1 MONTH";
        break;
    default:
        $time_condition = "recorded_at >= NOW() - INTERVAL 1 DAY";
}

// Xác định loại cảm biến
$sensor_condition = "";
if ($sensor_type !== 'all') {
    $sensor_condition = "AND sensor_id LIKE '%$sensor_type'";
}

// Truy vấn dữ liệu
$query = "SELECT sensor_id, value, recorded_at FROM sensor_data WHERE $time_condition $sensor_condition ORDER BY recorded_at ASC";
$result = mysqli_query($conn, $query);

$data = [];
while ($row = mysqli_fetch_assoc($result)) {
    $data[] = $row;
}

echo json_encode($data);

mysqli_close($conn);
?>