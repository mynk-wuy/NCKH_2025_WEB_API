<?php
// Cho phép truy cập từ bất kỳ nguồn nào (có thể thay * bằng domain cụ thể nếu cần)
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

// Kiểm tra nếu là preflight request (OPTIONS), phản hồi ngay lập tức
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}
require_once "../config/database.php";

header("Content-Type: application/json");

// if (!isset($_GET['sensor_id'])) {
//     echo json_encode(["error" => "Thiếu sensor_id"]);
//     exit();
// }

// $sensor_id = $conn->real_escape_string($_GET['sensor_id']);
$sql = "SELECT sensor_id, value, recorded_at FROM sensor_data ORDER BY recorded_at DESC";
$result = $conn->query($sql);

$data = [];
while ($row = $result->fetch_assoc()) {
    $data[] = $row;
}

echo json_encode($data);
?>
