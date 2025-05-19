<?php
function authenticate() {
    $headers = getallheaders();
    if (!isset($headers['Authorization'])) {
        http_response_code(403);
        echo json_encode(["message" => "Không có quyền truy cập"]);
        exit();
    }
    // Kiểm tra token nếu có hệ thống JWT hoặc session
}
?>
