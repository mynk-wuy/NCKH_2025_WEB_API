<?php
require_once "../config/database.php";
require_once "../models/Role.php";
require_once "../middleware/auth.php";

authenticate();

$database = new Database();
$db = $database->getConnection();
$role = new Role($db);

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $roles = $db->query("SELECT * FROM roles")->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode($roles);
}
?>
