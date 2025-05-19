import { initializeMQTT, fetchThresholds } from "../js/hamcanhbao.js";
document.addEventListener("DOMContentLoaded", async function () {
    // Kiểm tra thông tin người dùng từ localStorage
    const user = JSON.parse(localStorage.getItem("user"));
    if (!user) {
        window.location.href = "login.html";
        return;
    }

    // Hiển thị vai trò người dùng
    displayUserRole(user.role_id);
    // Phân quyền dựa trên role_id
    handleUserRole(user.role_id);
    await fetchThresholds(); // Lấy ngưỡng cảm biến từ API
    initializeMQTT(); // Khởi tạo MQTT
    // Khởi chạy lần đầu với role_id
    fetchSensors(user.role_id);
});

function displayUserRole(role_id) {
    const roleElement = document.getElementById("user-role");
    if (!roleElement) return;
    
    const roles = { 
        1: "Super Admin", 
        2: "Admin Trạm 1", 
        3: "Admin Trạm 2", 
        4: "Viewer" 
    };
    
    roleElement.textContent = "Vai trò: " + (roles[role_id] || "Không xác định");
}

function handleUserRole(role_id) {
    const restrictedLinks = {
        2: ["quanlyuser.html", "giamsat2.html", "dieukhien2.html"],
        3: ["quanlyuser.html", "giamsat1.html", "dieukhien1.html"],
        4: ["quanlyuser.html", "dieukhien2.html", "dieukhien1.html", "device.html", "report.html"]
    };

    document.querySelectorAll(".menu a, .menu .subnavbtn").forEach(item => {
        const href = item.getAttribute("href");
        if (restrictedLinks[role_id]?.includes(href)) {
            item.style.display = "none";
        }
    });
}

// Biến để quản lý danh sách cảm biến
let sensors = [];

// API URL
const SENSOR_API_URL = "http://localhost/routes/sensors.php";

// Hiển thị danh sách cảm biến
function renderSensors(sensorList) {
    const sensorListElement = document.getElementById("sensor-list");
    if (sensorListElement) {
        sensorListElement.innerHTML = "";
        sensorList.forEach((sensor, index) => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${sensor.sensor_id}</td>
                <td>${sensor.name_sensor}</td>
                <td>${sensor.location}</td>
                <td>${sensor.type}</td>
                <td>${sensor.created_at}</td>
                <td>${sensor.threshold}</td>
                <td>${sensor.donvi}</td>
                <td>
                    <button class="edit-btn" onclick="openEditSensorModal('${sensor.sensor_id}')">Sửa</button>
                    <button class="delete-btn" onclick="openDeleteSensorModal('${sensor.sensor_id}')">Xóa</button>
                </td>
            `;
            sensorListElement.appendChild(row);
        });
    }
}

// Lấy danh sách cảm biến từ API và lọc theo quyền
async function fetchSensors(role_id) {
    try {
        const response = await fetch(SENSOR_API_URL, { method: "GET" });
        let allSensors = await response.json();
        
        // Lọc cảm biến theo role_id
        if (role_id === 2) {
            sensors = allSensors.filter(sensor => sensor.sensor_id.startsWith("Lab001"));
        } else if (role_id === 3) {
            sensors = allSensors.filter(sensor => sensor.sensor_id.startsWith("A4002"));
        } else {
            sensors = allSensors;
        }

        console.log("Danh sách cảm biến (sau khi lọc):", sensors);
        renderSensors(sensors);
    } catch (error) {
        console.error("Lỗi khi lấy danh sách cảm biến:", error);
    }
}

// Mở modal thêm cảm biến
const addSensorBtn = document.getElementById("add-sensor-btn");
if (addSensorBtn) {
    addSensorBtn.addEventListener("click", () => {
        document.getElementById("add-sensor-modal").style.display = "block";
    });
}

// Đóng modal thêm cảm biến
const cancelAddSensorBtn = document.getElementById("cancel-add-sensor");
if (cancelAddSensorBtn) {
    cancelAddSensorBtn.addEventListener("click", () => {
        document.getElementById("add-sensor-modal").style.display = "none";
    });
}

// Xử lý thêm cảm biến
const addSensorForm = document.getElementById("add-sensor-form");
if (addSensorForm) {
    addSensorForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        // Lấy role_id từ localStorage
        const user = JSON.parse(localStorage.getItem("user"));
        const role_id = user.role_id;

        // Kiểm tra dữ liệu đầu vào
        if (
            document.getElementById("sensor-id").value === "" ||
            document.getElementById("sensor-name").value === "" ||
            document.getElementById("sensor-location").value === "" ||
            document.getElementById("sensor-type").value === "" ||
            document.getElementById("sensor-donvi").value === ""
        ) {
            alert("Vui lòng nhập đầy đủ thông tin");
            return;
        }

        // Lấy giá trị từ form
        const sensorId = document.getElementById("sensor-id").value;
        const nameSensor = document.getElementById("sensor-name").value;
        const locationValue = document.getElementById("sensor-location").value;
        const type = document.getElementById("sensor-type").value;
        const donvi = document.getElementById("sensor-donvi").value;

        // Kiểm tra sensor_id theo role_id
        if (role_id === 2 && !sensorId.startsWith("Lab001")) {
            alert("Admin Trạm 1 chỉ có thể thêm cảm biến với sensor_id bắt đầu bằng 'Lab001'.");
            return;
        } else if (role_id === 3 && !sensorId.startsWith("A4002")) {
            alert("Admin Trạm 2 chỉ có thể thêm cảm biến với sensor_id bắt đầu bằng 'A4002'.");
            return;
        }

        // Xác định vị trí dựa trên giá trị
        let location;
        if (locationValue === "1") {
            location = "Hà Nội";
        } else if (locationValue === "2") {
            location = "Thái Nguyên";
        } else {
            alert("Vị trí không hợp lệ");
            return;
        }

        // Tạo đối tượng cảm biến mới
        const newSensor = {
            sensor_id: sensorId,
            name_sensor: nameSensor,
            location: location,
            type: type,
            donvi: donvi,
        };

        try {
            const response = await fetch(SENSOR_API_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newSensor)
            });

            const result = await response.json();
            if (result.message) {
                fetchSensors(role_id);
                document.getElementById("add-sensor-modal").style.display = "none";
                addSensorForm.reset();
                alert(result.message);
            } else {
                alert("Lỗi khi thêm cảm biến: " + (result.error || "Không xác định"));
            }
        } catch (error) {
            console.error("Lỗi khi thêm cảm biến:", error);
            alert("Đã xảy ra lỗi khi thêm cảm biến. Vui lòng thử lại sau.");
        }
    });
}

// Mở modal chỉnh sửa cảm biến
let sensorIdToEdit = null;
function openEditSensorModal(sensorId) {
    const sensor = sensors.find(s => s.sensor_id === sensorId);
    if (!sensor) {
        console.error("Không tìm thấy cảm biến với ID:", sensorId);
        alert("Không tìm thấy cảm biến!");
        return;
    }

    sensorIdToEdit = sensorId;

    document.getElementById("edit-sensor-id").value = sensor.sensor_id;
    document.getElementById("edit-sensor-name").value = sensor.name_sensor;
    document.getElementById("edit-sensor-location").value = sensor.location;
    document.getElementById("edit-sensor-type").value = sensor.type;
    document.getElementById("edit-sensor-donvi").value = sensor.donvi;

    document.getElementById("edit-sensor-modal").style.display = "block";
}

// Đóng modal chỉnh sửa cảm biến
const cancelEditBtn = document.getElementById("cancel-edit-sensor");
if (cancelEditBtn) {
    cancelEditBtn.addEventListener("click", () => {
        document.getElementById("edit-sensor-modal").style.display = "none";
    });
}

// Xử lý chỉnh sửa cảm biến
const editSensorForm = document.getElementById("edit-sensor-form");
if (editSensorForm) {
    editSensorForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        // Lấy role_id từ localStorage
        const user = JSON.parse(localStorage.getItem("user"));
        const role_id = user.role_id;

        if (
            document.getElementById("edit-sensor-location").value === "" ||
            document.getElementById("edit-sensor-type").value === "" ||
            document.getElementById("edit-sensor-donvi").value === ""
        ) {
            alert("Vui lòng nhập đầy đủ thông tin");
            return;
        }

        const sensorId = document.getElementById("edit-sensor-id").value;
        const nameSensor = document.getElementById("edit-sensor-name").value;
        const locationValue = document.getElementById("edit-sensor-location").value;
        const type = document.getElementById("edit-sensor-type").value;
        const threshold = document.getElementById("edit-sensor-threshold").value;
        const donvi = document.getElementById("edit-sensor-donvi").value;

        // Kiểm tra sensor_id theo role_id
        if (role_id === 2 && !sensorId.startsWith("Lab001")) {
            alert("Admin Trạm 1 chỉ có thể chỉnh sửa cảm biến với sensor_id bắt đầu bằng 'Lab001'.");
            return;
        } else if (role_id === 3 && !sensorId.startsWith("A4002")) {
            alert("Admin Trạm 2 chỉ có thể chỉnh sửa cảm biến với sensor_id bắt đầu bằng 'A4002'.");
            return;
        }

        let location;
        if (locationValue === "1") {
            location = "Phòng Lab-ĐHGTVT";
        } else if (locationValue === "2") {
            location = "Tòa A4-ĐHGTVT";
        } else {
            alert("Vị trí không hợp lệ");
            return;
        }

        const updatedSensor = {
            sensor_id: sensorId,
            name_sensor: nameSensor,
            location: location,
            type: type,
            threshold: threshold,
            donvi: donvi
        };

        try {
            const response = await fetch(SENSOR_API_URL, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updatedSensor)
            });

            const result = await response.json();
            if (result.message) {
                fetchSensors(role_id);
                document.getElementById("edit-sensor-modal").style.display = "none";
                editSensorForm.reset();
                alert(result.message);
            } else {
                alert("Lỗi khi cập nhật cảm biến: " + (result.error || "Không xác định"));
            }
        } catch (error) {
            console.error("Lỗi khi cập nhật cảm biến:", error);
            alert("Đã xảy ra lỗi khi cập nhật cảm biến. Vui lòng thử lại sau.");
        }
    });
}

// Mở modal xác nhận xóa
let sensorIdToDelete = null;
function openDeleteSensorModal(sensorId) {
    const sensor = sensors.find(s => s.sensor_id === sensorId);
    if (!sensor) {
        console.error("Không tìm thấy cảm biến với ID:", sensorId);
        alert("Không tìm thấy cảm biến!");
        return;
    }

    sensorIdToDelete = sensorId;

    const deleteMessage = document.getElementById("delete-sensor-message");
    if (deleteMessage) {
        deleteMessage.textContent = `Bạn có chắc chắn muốn xóa cảm biến ${sensor.sensor_id} không?`;
        document.getElementById("delete-sensor-modal").style.display = "block";
    }

    const cancelDeleteBtn = document.getElementById("cancel-delete-sensor");
    if (cancelDeleteBtn) {
        cancelDeleteBtn.addEventListener("click", () => {
            document.getElementById("delete-sensor-modal").style.display = "none";
        });
    }
}

// Xử lý xóa cảm biến
const confirmDeleteSensorBtn = document.getElementById("confirm-delete-sensor");
if (confirmDeleteSensorBtn) {
    confirmDeleteSensorBtn.addEventListener("click", async () => {
        // Lấy role_id từ localStorage
        const user = JSON.parse(localStorage.getItem("user"));
        const role_id = user.role_id;

        // Kiểm tra sensor_id theo role_id
        if (role_id === 2 && !sensorIdToDelete.startsWith("Lab001")) {
            alert("Admin Trạm 1 chỉ có thể xóa cảm biến với sensor_id bắt đầu bằng 'Lab001'.");
            return;
        } else if (role_id === 3 && !sensorIdToDelete.startsWith("A4002")) {
            alert("Admin Trạm 2 chỉ có thể xóa cảm biến với sensor_id bắt đầu bằng 'A4002'.");
            return;
        }

        try {
            const response = await fetch(SENSOR_API_URL, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sensor_id: sensorIdToDelete })
            });

            const result = await response.json();
            if (result.message) {
                fetchSensors(role_id);
                document.getElementById("delete-sensor-modal").style.display = "none";
                alert(result.message);
            } else {
                alert("Lỗi khi xóa cảm biến: " + (result.error || "Không xác định"));
            }
        } catch (error) {
            console.error("Lỗi khi xóa cảm biến:", error);
            alert("Đã xảy ra lỗi khi xóa cảm biến. Vui lòng thử lại sau.");
        }
    });
}

// Tìm kiếm cảm biến
const searchInput = document.getElementById("search");
if (searchInput) {
    searchInput.addEventListener("input", (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const filteredSensors = sensors.filter(sensor =>
            sensor.sensor_id.toLowerCase().includes(searchTerm) ||
            sensor.name_sensor.toLowerCase().includes(searchTerm)
        );
        renderSensors(searchTerm === "" ? sensors : filteredSensors);
    });
}
// Làm cho các hàm có thể truy cập toàn cục
window.openEditSensorModal = openEditSensorModal;
window.openDeleteSensorModal = openDeleteSensorModal;