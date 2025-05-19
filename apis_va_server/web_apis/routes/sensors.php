<?php
// Bật hiển thị lỗi
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// Cho phép truy cập từ bất kỳ nguồn nào (có thể thay * bằng domain cụ thể nếu cần)
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, GET, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

// Kiểm tra nếu là preflight request (OPTIONS), phản hồi ngay lập tức
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once "../config/database.php"; // Kết nối database
$method = $_SERVER['REQUEST_METHOD']; // Lấy HTTP Method
// Xử lý yêu cầu GET (lấy danh sách cảm biến)
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $query = "SELECT sensor_id, name_sensor, location, type, created_at, donvi, threshold FROM sensors";
    $result = mysqli_query($conn, $query);

    $sensors = [];
    while ($row = mysqli_fetch_assoc($result)) {
        $sensors[] = $row;
    }

    echo json_encode($sensors);
}

// Xử lý yêu cầu POST (thêm cảm biến)
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);

    if (!$data || !isset($data['sensor_id'], $data['name_sensor'], $data['location'], $data['type'], $data['donvi'])) {
        echo json_encode(['error' => 'Dữ liệu không hợp lệ']);
        exit;
    }

    $sensorId = $data['sensor_id'];
    $nameSensor = $data['name_sensor'];
    $location = $data['location'];
    $type = $data['type'];
    $donvi = $data['donvi'];
    $threshold = isset($data['threshold']) ? $data['threshold'] : null;

    $query = "INSERT INTO sensors (sensor_id, name_sensor, location, type, donvi, threshold) VALUES (?, ?, ?, ?, ?, ?)";
    $stmt = mysqli_prepare($conn, $query);
    mysqli_stmt_bind_param($stmt, "sssssd", $sensorId, $nameSensor, $location, $type, $donvi, $threshold);

    if (mysqli_stmt_execute($stmt)) {
        echo json_encode(['message' => 'Thêm cảm biến thành công']);
    } else {
        echo json_encode(['error' => 'Lỗi khi thêm cảm biến: ' . mysqli_error($conn)]);
    }

    mysqli_stmt_close($stmt);
}

// Xử lý yêu cầu PUT (cập nhật cảm biến)
if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    $data = json_decode(file_get_contents('php://input'), true);

    if (!$data || !isset($data['sensor_id'], $data['name_sensor'], $data['location'], $data['type'], $data['threshold'], $data['donvi'])) {
        echo json_encode(['error' => 'Dữ liệu không hợp lệ']);
        exit;
    }

    $sensorId = $data['sensor_id'];
    $nameSensor = $data['name_sensor'];
    $location = $data['location'];
    $type = $data['type'];
    $donvi = $data['donvi'];
    $threshold = isset($data['threshold']) ? $data['threshold'] : null;

    $query = "UPDATE sensors SET name_sensor = ?, location = ?, type = ?, donvi = ?, threshold = ? WHERE sensor_id = ?";
    $stmt = mysqli_prepare($conn, $query);
    mysqli_stmt_bind_param($stmt, "ssssds", $nameSensor, $location, $type, $donvi, $threshold, $sensorId);

    if (mysqli_stmt_execute($stmt)) {
        echo json_encode(['message' => 'Cập nhật cảm biến thành công']);
    } else {
        echo json_encode(['error' => 'Lỗi khi cập nhật cảm biến: ' . mysqli_error($conn)]);
    }

    mysqli_stmt_close($stmt);
}

// Xử lý yêu cầu DELETE (xóa cảm biến)
if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    $data = json_decode(file_get_contents('php://input'), true);

    if (!$data || !isset($data['sensor_id'])) {
        echo json_encode(['error' => 'Dữ liệu không hợp lệ']);
        exit;
    }

    $sensorId = $data['sensor_id'];

    $query = "DELETE FROM sensors WHERE sensor_id = ?";
    $stmt = mysqli_prepare($conn, $query);
    mysqli_stmt_bind_param($stmt, "s", $sensorId);

    if (mysqli_stmt_execute($stmt)) {
        echo json_encode(['message' => 'Xóa cảm biến thành công']);
    } else {
        echo json_encode(['error' => 'Lỗi khi xóa cảm biến: ' . mysqli_error($conn)]);
    }

    mysqli_stmt_close($stmt);
}

mysqli_close($conn);
?>