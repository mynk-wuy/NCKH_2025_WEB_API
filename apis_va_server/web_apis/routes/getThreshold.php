<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, DELETE, PUT, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header('Content-Type: application/json'); // Định dạng phản hồi là JSON

// Xử lý yêu cầu OPTIONS (preflight)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

require_once "../config/database.php";
$conn->set_charset("utf8");

// Xử lý yêu cầu GET (lấy ngưỡng cảnh báo)
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        $query = "SELECT sensor_id, threshold FROM sensors";
        
        $result = mysqli_query($conn, $query);

        if (!$result) {
            throw new Exception("Lỗi truy vấn database: " . mysqli_error($conn));
        }      

        $thresholds = [];
        while ($row = mysqli_fetch_assoc($result)) {
            $thresholds[$row['sensor_id']] = (float) $row['threshold']; // Chuyển threshold thành số
        }

        if (empty($thresholds)) {
            http_response_code(404);
            echo json_encode(["message" => "Không có dữ liệu"]);
            exit;
        }

        echo json_encode(["success" => true, "data" => $thresholds]);

    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(["success" => false, "error" => $e->getMessage()]);
    }
}

// Đóng kết nối
mysqli_close($conn);
?>