<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, DELETE, PUT, OPTIONS"); // Cho phép các phương thức HTTP
header("Access-Control-Allow-Headers: Content-Type"); // Cho phép các header cụ thể

// Xử lý yêu cầu OPTIONS (preflight)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit; // Dừng xử lý và trả về phản hồi trống
}
require_once "../config/database.php";// Kết nối database

// Xử lý yêu cầu GET
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $startDate = isset($_GET['start_date']) ? $_GET['start_date'] : null;
    $endDate = isset($_GET['end_date']) ? $_GET['end_date'] : null;

    // Lấy dữ liệu cảnh báo
    if ($startDate && $endDate) {
        // Tìm kiếm cảnh báo trong khoảng thời gian
        $sql = "SELECT * FROM alerts WHERE DATE(created_at) BETWEEN ? AND ? ORDER BY created_at DESC";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param("ss", $startDate, $endDate);
    } else {
        // Lấy tất cả cảnh báo
        $sql = "SELECT * FROM alerts ORDER BY created_at DESC";
        $stmt = $conn->prepare($sql);
    }

    $stmt->execute();
    $result = $stmt->get_result();
    $alerts = [];

    while ($row = $result->fetch_assoc()) {
        $alerts[] = $row;
    }

    echo json_encode($alerts);
    $stmt->close();
}

$conn->close();
?>