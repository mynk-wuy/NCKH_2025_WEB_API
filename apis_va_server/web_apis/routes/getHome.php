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


// Truy vấn dữ liệu cảm biến
$query = "
    SELECT 
        sensor_id,
        value,
        recorded_at
    FROM (
        SELECT 
            sensor_id,
            value,
            recorded_at,
            ROW_NUMBER() OVER (PARTITION BY sensor_id ORDER BY recorded_at DESC) as row_num
        FROM sensor_data
        WHERE sensor_id IN ('Lab001CO', 'Lab001NH3', 'Lab001H2', 'A4002CO', 'A4002NH3', 'A4002H2')
    ) ranked_sensors
    WHERE row_num = 1
    ORDER BY recorded_at DESC";

$result = mysqli_query($conn, $query);

if (!$result) {
    die(json_encode(['error' => 'Lỗi truy vấn: ' . mysqli_error($conn)]));
}

// Nhóm dữ liệu theo trạm
$stations = [
    'Lab001' => ['name' => 'Trạm 1', 'address' => 'Phòng Lab - ĐHGTVT', 'sensors' => []],
    'A4002' => ['name' => 'Trạm 2', 'address' => 'Tòa A4 - ĐHGTVT', 'sensors' => []]
];

while ($row = mysqli_fetch_assoc($result)) {
    $sensorId = $row['sensor_id'];
    
    // Xác định mã trạm và độ dài
    if (strncmp($sensorId, 'Lab001', 6) === 0) {
        $stationId = 'Lab001';
        $stationLength = 6;
    } elseif (strncmp($sensorId, 'A4002', 5) === 0) {
        $stationId = 'A4002';
        $stationLength = 5;
    } else {
        continue; // Bỏ qua nếu không khớp với mã trạm nào
    }

    // Tách loại cảm biến
    $sensorType = substr($sensorId, $stationLength);

    // Lưu dữ liệu vào mảng
    $stations[$stationId]['sensors'][$sensorType] = [
        'value' => $row['value'],
        'recorded_at' => $row['recorded_at']
    ];
}

// Chuyển thành mảng để trả về JSON
$output = array_values($stations);
echo json_encode($output);

// Đóng kết nối
mysqli_close($conn);
?>