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

$data = json_decode(file_get_contents("php://input"), true);

if (!isset($data['email']) || !isset($data['password'])) {
    echo json_encode(["message" => "Thiếu email hoặc mật khẩu"]);
    exit;
}

$email = $data['email'];
$password = $data['password'];

$sql = "SELECT user_id, username, password, role_id FROM users WHERE email = ?";
$stmt = $conn->prepare($sql);
$stmt->bind_param("s", $email);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows > 0) {
    $user = $result->fetch_assoc();
    
    // So sánh trực tiếp mật khẩu (do không mã hóa)
    if ($password === $user['password']) {
        $token = bin2hex(random_bytes(16)); // Tạo token tạm thời
        echo json_encode(["status" => "success", "token" => $token, "user_id" => $user['user_id'], "role_id" => $user['role_id']]);
    } else {
        echo json_encode(["message" => "Sai email hoặc mật khẩu"]);
    }
} else {
    echo json_encode(["message" => "Sai email hoặc mật khẩu"]);
}
?>
