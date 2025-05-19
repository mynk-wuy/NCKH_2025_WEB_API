<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, DELETE, PUT, OPTIONS"); // Cho phép các phương thức HTTP
header("Access-Control-Allow-Headers: Content-Type"); // Cho phép các header cụ thể

// Xử lý yêu cầu OPTIONS (preflight)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit; // Dừng xử lý và trả về phản hồi trống
}
require_once "../config/database.php";

// Kết nối database


// Xử lý yêu cầu
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    // Lấy danh sách người dùng
    $sql = "SELECT users.user_id, users.username, roles.role_name, users.email, users.created_at 
            FROM users 
            INNER JOIN roles ON users.role_id = roles.role_id";
    $stmt = $conn->prepare($sql);

    // Thực thi câu lệnh
    $stmt->execute();

    // Lấy kết quả
    $result = $stmt->get_result();

    // Lặp qua kết quả và xử lý dữ liệu
    $users = [];
    while ($row = $result->fetch_assoc()) {
        $users[] = $row;
    }

    // Trả về kết quả dưới dạng JSON
    echo json_encode($users);

    // Đóng statement
    $stmt->close();
} elseif ($method === 'POST') {
    
    // Nhận dữ liệu từ client
    $data = json_decode(file_get_contents("php://input"), true);
    $username = $data['username'];
    $role_id = $data['role_id'];
    $email = $data['email'];
    $password = $data['password'];
   

    // Chuẩn bị câu lệnh SQL
    $sql = "INSERT INTO users (username, password, email, role_id) VALUES (?, ?, ?, ?)";
    $stmt = $conn->prepare($sql);

    // Bind các tham số
    $stmt->bind_param("sssi", $username,$password,$email,$role_id);

    // Thực thi câu lệnh
    if ($stmt->execute()) {
        echo json_encode(["message" => "Đã thêm người dùng mới!"]);
    } else {
        echo json_encode(["error" => "Lỗi khi thêm người dùng: " . $stmt->error]);
    }

    // Đóng statement
    $stmt->close();
    
} elseif ($method === 'DELETE') {
    
    // Nhận dữ liệu từ client
    $data = json_decode(file_get_contents("php://input"), true);
    $id = $data['id'];

    // Chuẩn bị câu lệnh SQL
    $sql = "DELETE FROM users WHERE user_id = ?";
    $stmt = $conn->prepare($sql);

    // Bind tham số
    $stmt->bind_param("i", $id);

    // Thực thi câu lệnh
    if ($stmt->execute()) {
        echo json_encode(["message" => "Đã xóa tài khoản!"]);
    } else {
        echo json_encode(["error" => "Lỗi khi xóa tài khoản: " . $stmt->error]);
    }

    // Đóng statement
    $stmt->close();
    
}elseif ($method === 'PUT') {
    // Nhận dữ liệu từ client
    $data = json_decode(file_get_contents("php://input"), true);
    $user_id = $data['user_id'];
    $username = $data['username'];
    $email = $data['email'];
    $role_id = $data['role_id'];

    // Chuẩn bị câu lệnh SQL
    $sql = "UPDATE users SET username = ?, email = ?, role_id = ? WHERE user_id = ?";
    $stmt = $conn->prepare($sql);

    // Bind các tham số
    $stmt->bind_param("ssii", $username, $email, $role_id, $user_id);

    // Thực thi câu lệnh
    if ($stmt->execute()) {
        echo json_encode(["message" => "Đã cập nhật thông tin người dùng!"]);
    } else {
        echo json_encode(["error" => "Lỗi khi cập nhật thông tin người dùng: " . $stmt->error]);
    }

    // Đóng statement
    $stmt->close();
}

// Đóng kết nối
$conn->close();
?>