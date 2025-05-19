<?php
$host = "127.0.0.1"; // Địa chỉ MySQL (có thể là 127.0.0.1)
$dbname = "scada_phanquyen"; // Thay bằng tên database của bạn
$username = "manhnguyen"; // Tài khoản MySQL (mặc định XAMPP là "root")
$password = "manh09092003"; // Mật khẩu (mặc định XAMPP để trống "")

$conn = new mysqli($host, $username, $password, $dbname);

// Kiểm tra kết nối
if ($conn->connect_error) {
    die("Lỗi kết nối: " . $conn->connect_error);
}
?>
