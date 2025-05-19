<?php
// Đặt header để chấp nhận và trả về dữ liệu JSON
header('Content-Type: application/json');
header('Accept: application/json');

// Lấy dữ liệu từ yêu cầu POST
$input_data = json_decode(file_get_contents("php://input"), true);

// Kiểm tra xem dữ liệu có hợp lệ không
if (isset($input_data['sensor_id']) && isset($input_data['predictions'])) {
    $sensor_id = $input_data['sensor_id'];
    $predictions = $input_data['predictions'];
    
    // Hiển thị kết quả dự đoán dưới dạng JSON
    echo json_encode([
        'status' => 'success',
        'message' => 'Dữ liệu dự đoán nhận thành công',
        'sensor_id' => $sensor_id,
        'predictions' => $predictions
    ]);
} else {
    // Nếu thiếu dữ liệu thì trả về thông báo lỗi
    echo json_encode([
        'status' => 'error',
        'message' => 'Dữ liệu không hợp lệ'
    ]);
}
?>
