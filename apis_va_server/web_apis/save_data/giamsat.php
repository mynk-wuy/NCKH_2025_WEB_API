<?php
// Cấu hình kết nối
$host     = 'localhost';
$user     = 'root';
$password = 'manh09092003'; // Thông thường XAMPP mặc định không có mật khẩu
$db       = 'GiamSatKhiThai';
$port     = 3306; // Nếu bạn thay đổi port, cập nhật lại ở đây

// Tạo kết nối
$conn = new mysqli($host, $user, $password, $db, $port);

// Kiểm tra kết nối
if ($conn->connect_error) {
    die("Kết nối thất bại: " . $conn->connect_error);
}

echo "Kết nối thành công!";
$sql = "SELECT*  FROM khithai";
    $result = $conn->query($sql);
    // $result = $conn->query("SHOW COLUMNS FROM k61_khai_demxu");
    // while ($row = $result->fetch_assoc()) {
    //     echo $row['Field'] . "<br>";
    // }
    $users = array();
    // Kiểm tra và hiển thị dữ liệu
    if ($result->num_rows > 0) {
        while ($row = $result->fetch_assoc()) {
            $users[] = $row;
        }
    }
    echo json_encode($users);
    // Đóng kết nối
    $conn->close();
?>
