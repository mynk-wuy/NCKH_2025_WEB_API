import { initializeMQTT, fetchThresholds } from "../js/hamcanhbao.js";
document.addEventListener("DOMContentLoaded", async function () {
    const user = JSON.parse(localStorage.getItem("user"));

    if (!user) {
        window.location.href = "login.html";
        return;
    }

    displayUserRole(user.role_id);
    handleUserRole(user.role_id, user.user_id);
    document.getElementById("home-link").classList.add("active");

    const mapContainer = document.getElementById("map");
    if (!mapContainer) {
        console.error("Không tìm thấy phần tử #map");
        return;
    }

    const map = L.map("map").setView([21.027897003957904, 105.80293436442608], 18);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors"
    }).addTo(map);

    const stations = [
        { id: "Lab001", name: "Trạm 1: Phòng Lab - ĐHGTVT", lat: 21.027554146449187, lng: 105.80153455213535, page: "giamsat1.html", sensors: [] },
        { id: "A4002", name: "Trạm 2: Tòa A4 - ĐHGTVT", lat: 21.027241, lng: 105.803466, page: "giamsat2.html", sensors: [] }
    ];

    // Thêm giá trị cảm biến vào stations
    
    stations.forEach((station) => {
        if (user.role_id === 1 || (user.role_id === 2 && station.id === "Lab001") || (user.role_id === 3 && station.id === "A4002") || user.role_id === 4) {
            const marker = L.marker([station.lat, station.lng]).addTo(map);
            let sensorList = station.sensors
                .map(sensor => `<li onclick="viewSensor('${station.id}', '${sensor}', '${station.page}')">${sensor}</li>`)
                .join("");
            const popupContent = `<b>${station.name}</b><br><ul>${sensorList}</ul>`;
            marker.bindPopup(popupContent);

            marker.on('click', function () {
                viewSensor(station.id, "all", station.page);
            });

            marker.on('mouseover', function () {
                this.openPopup();
            });

            marker.on('mouseout', function () {
                this.closePopup();
            });
        }
    });
   
    await fetchThresholds(); // Lấy ngưỡng cảm biến từ API
    initializeMQTT();
    // Gọi hàm fetchSensorData ngay lập tức và lặp lại mỗi 5 giây
    fetchSensorData(user.role_id);
    setInterval(() => fetchSensorData(user.role_id), 5000); // Cập nhật mỗi 5 giây
});
// // Add this function to update sensor values
//     function updateStationSensors(stationId, sensorData) {
//         const station = stations.find(s => s.id === stationId);
//         if (!station) return;

//         const coValue = sensorData.CO?.value || 'N/A';
//         const nh3Value = sensorData.NH3?.value || 'N/A';
//         const h2Value = sensorData.H2?.value || 'N/A';

//         station.sensors = [
//             `CO: ${coValue} ppb`,
//             `NH3: ${nh3Value} ppb`,
//             `H2: ${h2Value} ppb`
//         ];

//         // Update markers and popups
//         updateMapMarkers();
//     }
//     // Add function to update map markers
//     function updateMapMarkers() {
//         stations.forEach((station) => {
//             if (!station.marker) return;

//             const sensorList = station.sensors
//                 .map(sensor => `<li onclick="viewSensor('${station.id}', '${sensor}', '${station.page}')">${sensor}</li>`)
//                 .join("");

//             const popupContent = `<b>${station.name}</b><br><ul>${sensorList}</ul>`;
//             station.marker.getPopup().setContent(popupContent);
//         });
//     }
function displayUserRole(role_id) {
    const roleElement = document.getElementById("user-role");
    if (!roleElement) return;
    const roles = { 1: "Super Admin", 2: "Admin Trạm 1", 3: "Admin Trạm 2", 4: "Viewer" };
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

function viewSensor(stationId, sensorName, page) {
    window.location.href = `${page}?station=${stationId}&sensor=${encodeURIComponent(sensorName)}`;
}

function fetchSensorData(role_id) {
    fetch('http://localhost/routes/getHome.php') // Thay bằng URL API thực tế
        .then(response => response.json())
        .then(data => {
            const tbody = document.querySelector(".station-table tbody");
            tbody.innerHTML = "";

            data.forEach(station => {
                const stationId = station.name === "Trạm 1" ? "Lab001" : "A4002";
                console.log("Station ID:", stationId); // Debugging log
                console.log("Station name:", station.name); // Debugging log
                console.log("covalue:", station.sensors); // Debugging log
                //updateStationSensors(stationId, station.sensors); // Cập nhật cảm biến cho trạm
                if (role_id === 1 || (role_id === 2 && stationId === "Lab001") || (role_id === 3 && stationId === "A4002") || role_id === 4) {
                   
                    const tr = document.createElement("tr");

                    tr.innerHTML += `<td>${station.name}</td>`;
                    tr.innerHTML += `<td>${station.address}</td>`;
                    tr.innerHTML += `<td><span class="status active">Hoạt động</span></td>`; // Giả định trạng thái

                    // Cảm biến CO
                    const coValue = station.sensors.CO ? station.sensors.CO.value : "N/A";
                    tr.innerHTML += `<td><span class="sensor-value">${coValue} ppb</span></td>`;

                    // Cảm biến NH3
                    const nh3Value = station.sensors.NH3 ? station.sensors.NH3.value : "N/A";
                    const nh3Status = station.sensors.NH3 && station.sensors.NH3.value > 500 ? 'warning' : '';
                    tr.innerHTML += `<td><span class="sensor-value">${nh3Value} ppb</span></td>`;

                    // Cảm biến H2
                    const h2Value = station.sensors.H2 ? station.sensors.H2.value : "N/A";
                    tr.innerHTML += `<td><span class="sensor-value">${h2Value} ppb</span></td>`;

                    // Thời gian cập nhật (lấy từ cảm biến đầu tiên có dữ liệu)
                    const updateTime = station.sensors.CO ? new Date(station.sensors.CO.recorded_at).toLocaleString('vi-VN') :
                        station.sensors.NH3 ? new Date(station.sensors.NH3.recorded_at).toLocaleString('vi-VN') :
                            station.sensors.H2 ? new Date(station.sensors.H2.recorded_at).toLocaleString('vi-VN') : "N/A";
                    tr.innerHTML += `<td>${updateTime}</td>`;

                    tbody.appendChild(tr);
                }
            });
        })
        .catch(error => {
            console.error("Lỗi khi lấy dữ liệu cảm biến:", error);
            const tbody = document.querySelector(".station-table tbody");
            tbody.innerHTML = `<tr><td colspan="7">Không thể tải dữ liệu cảm biến</td></tr>`;
        });
}

