<?php
header('Content-Type: application/json');
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

// Thiết lập múi giờ Việt Nam
date_default_timezone_set('Asia/Ho_Chi_Minh');

// Thiết lập charset utf8
$mysqli->set_charset("utf8mb4");

// Lấy tham số last_id từ request (nếu có)
$last_id = isset($_GET['last_id']) ? (int)$_GET['last_id'] : 0;

// Chuẩn bị câu truy vấn
$query = "SELECT * FROM alerts 
          WHERE created_at >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)";

// Nếu có last_id, chỉ lấy cảnh báo mới hơn
if ($last_id > 0) {
    $query .= " AND id > ?";
}

$query .= " ORDER BY created_at DESC";

// Chuẩn bị statement
$stmt = $mysqli->prepare($query);

if ($last_id > 0) {
    $stmt->bind_param("i", $last_id);
}

// Thực thi truy vấn
if (!$stmt->execute()) {
    die(json_encode([
        'status' => 'error',
        'message' => 'Truy vấn database thất bại: ' . $stmt->error
    ]));
}

// Lấy kết quả
$result = $stmt->get_result();
$alerts = [];

while ($row = $result->fetch_assoc()) {
    // Format lại thời gian cho phù hợp
    $row['created_at'] = date('Y-m-d\TH:i:s', strtotime($row['created_at']));
    $alerts[] = $row;
}

// Đóng kết nối
$stmt->close();
$mysqli->close();

// Trả về kết quả dạng JSON
echo json_encode([
    'status' => 'success',
    'data' => $alerts,
    'timestamp' => date('Y-m-d H:i:s')
]);
?>