document.addEventListener("DOMContentLoaded", () => {
    const userRoleSpan = document.getElementById("user-role");
    const logoutButton = document.getElementById("logout");

    // Kiểm tra dữ liệu người dùng trong localStorage
    const user = JSON.parse(localStorage.getItem("user"));

    if (!user) {
        window.location.href = "login.html"; // Chuyển hướng nếu chưa đăng nhập
        return;
    }

    // Danh sách vai trò
    const roleNames = {
        1: "Admin",
        2: "Nhân viên",
        3: "Khách"
    };

    userRoleSpan.textContent = `Vai trò: ${roleNames[user.role_id] || "Không xác định"}`;

    // Hiển thị phân quyền dựa trên vai trò
    if (user.role_id === 1) {
        document.getElementById("admin-panel").style.display = "block";
    } else if (user.role_id === 2) {
        document.getElementById("employee-panel").style.display = "block";
    } else if (user.role_id === 3) {
        document.getElementById("guest-panel").style.display = "block";
    }

    // Xử lý đăng xuất
    logoutButton.addEventListener("click", () => {
        localStorage.removeItem("user");
        window.location.href = "login.html";
    });

    // Tạo bản đồ với Leaflet
    const mapContainer = document.getElementById("map");
    if (!mapContainer) {
        console.error("Không tìm thấy phần tử #map");
        return;
    }

    const map = L.map("map").setView([21.0285, 105.8542], 6);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors"
    }).addTo(map);

    // Danh sách trạm giám sát
    const stations = [
        { id: "HN001", name: "Trạm Hà Nội", lat: 21.0285, lng: 105.8542, sensors: ["CO", "NH3", "SO2"] },
        { id: "TN002", name: "Trạm Thái Nguyên", lat: 21.5927, lng: 105.8442, sensors: ["CO", "NH3", "SO2"] }
    ];

    stations.forEach((station) => {
        const marker = L.marker([station.lat, station.lng]).addTo(map);
        let sensorList = station.sensors
            .map(
                (sensor) => `<li onclick="viewSensor('${station.id}', '${sensor}')">${sensor}</li>`
            )
            .join("");

        marker.bindPopup(`<b>${station.name}</b><br><ul>${sensorList}</ul>`);
    });
});

// Chuyển đến trang chi tiết cảm biến
function viewSensor(stationId, sensorName) {
    window.location.href = `sensor_details.html?station=${stationId}&sensor=${encodeURIComponent(sensorName)}`;
}
