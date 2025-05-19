import { initializeMQTT, fetchThresholds } from "../js/hamcanhbao.js";
document.addEventListener("DOMContentLoaded", async function () {
    // Kiểm tra thông tin người dùng từ localStorage
    const user = JSON.parse(localStorage.getItem("user"));
    if (!user) {
        // Nếu không có thông tin người dùng, chuyển hướng về trang đăng nhập
        window.location.href = "login.html";
        return;
    }
    // Hiển thị tên người dùng
    displayUserRole(user.role_id);
    // Phân quyền dựa trên role_id
    handleUserRole(user.role_id);
    // Khởi tạo kết nối MQTT và các chức năng khác   
    await fetchThresholds(); // Lấy ngưỡng cảm biến từ API
    initializeMQTT();
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

// Xử lý quyền truy cập dựa trên vai trò
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

// Biến để quản lý danh sách người dùng
let users = [];

// API URL (thay đổi nếu cần)
const API_URL = "http://localhost/routes/getUsers.php"; // Đường dẫn đến file PHP xử lý API

// Hiển thị danh sách người dùng
function renderUsers(userList) {
    const userListElement = document.getElementById("user-list");
    if (userListElement) {
        userListElement.innerHTML = "";
        userList.forEach((user, index) => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${user.username}</td>
                <td>${user.role_name}</td>
                <td>${user.email}</td>
                <td>${user.created_at}</td>  
                <td>
                    <div class="action-btn">
                        <button class="edit-btn" onclick="openEditModal(${user.user_id})">Sửa</button>
                        <button class="delete-btn" onclick="openDeleteModal(${user.user_id})">Xóa</button>
                   </div>
                </td>
                
            `;
            userListElement.appendChild(row);
        });
    }
}

// Lấy danh sách người dùng từ API
async function fetchUsers() {
    try {
        const response = await fetch(API_URL, { method: "GET" });
        users = await response.json();
        console.log(users); // Kiểm tra dữ liệu trả về
        renderUsers(users);
    } catch (error) {
        console.error("Lỗi khi lấy danh sách người dùng:", error);
    }
}

// Mở modal thêm người dùng
const addUserBtn = document.getElementById("add-user-btn");
if (addUserBtn) {
    addUserBtn.addEventListener("click", () => {
        document.getElementById("add-user-modal").style.display = "block";
    });
}

// Đóng modal thêm người dùng
const cancelAddBtn = document.getElementById("cancel-add");
if (cancelAddBtn) {
    cancelAddBtn.addEventListener("click", () => {
        document.getElementById("add-user-modal").style.display = "none";
    });
}

// Xử lý form thêm người dùng
const addUserForm = document.getElementById("add-user-form");
if (addUserForm) {
    addUserForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        // Lấy giá trị từ form
        const username = document.getElementById("username").value;
        const email = document.getElementById("email").value;
        const password = document.getElementById("password").value;
        const confirmPassword = document.getElementById("confirm-password").value;
        const role_id = document.getElementById("role").value; // Sửa từ 'role' thành 'role_id' để phù hợp với code PHP

        // Kiểm tra mật khẩu nhập lại
        if (password !== confirmPassword) {
            alert("Mật khẩu không khớp!");
            return;
        }

        // Tạo đối tượng người dùng mới
        const newUser = {
            username: username,
            role_id: role_id,
            email: email,
            password: password, // Thêm trường password

        };

        try {
            // Gửi yêu cầu POST đến API
            const response = await fetch(API_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newUser)
            });

            // Xử lý phản hồi từ server
            const result = await response.json();
            if (result.message) {
                // Nếu thành công, cập nhật lại danh sách người dùng
                fetchUsers();
                // Đóng modal và reset form
                document.getElementById("add-user-modal").style.display = "none";
                addUserForm.reset();
                // Hiển thị thông báo thành công
                alert(result.message);
            } else {
                // Nếu có lỗi, hiển thị thông báo lỗi
                alert("Lỗi khi thêm người dùng: " + (result.error || "Không xác định"));
            }
        } catch (error) {
            // Xử lý lỗi nếu có
            console.error("Lỗi khi thêm người dùng:", error);
            alert("Đã xảy ra lỗi khi thêm người dùng. Vui lòng thử lại sau.");
        }
    });
}

// Mở modal xác nhận xóa
let userIdToDelete = null;
function openDeleteModal(id) {

    //console.log("Danh sách người dùng:", users); // Kiểm tra dữ liệu trong mảng users
    const user = users.find(u => u.user_id === id); // Sửa từ u.id thành u.user_id
    if (!user) {
        console.error("Không tìm thấy người dùng với id:", id);
        alert("Không tìm thấy người dùng!");
        return;
    }
   
    if (user.role_name === "Super Admin") {
        alert("Không thể xóa Super Admin");

    }
    else {
        userIdToDelete = id;
        const deleteMessage = document.getElementById("delete-message");
        if (deleteMessage) {
            deleteMessage.textContent = `Bạn có chắc chắn muốn xóa tài khoản ${user.username} không?`;

            document.getElementById("delete-confirm-modal").style.display = "block";

        }
    }
}

// Đóng modal xác nhận xóa
const cancelDeleteBtn = document.getElementById("cancel-delete");
if (cancelDeleteBtn) {
    cancelDeleteBtn.addEventListener("click", () => {
        document.getElementById("delete-confirm-modal").style.display = "none";
    });
}

// Xác nhận xóa người dùng
const confirmDeleteBtn = document.getElementById("confirm-delete");
if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener("click", async () => {

        try {
            const response = await fetch(API_URL, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: userIdToDelete })
            });
            const result = await response.json();
            if (result.message) {
                fetchUsers(); // Cập nhật lại danh sách
                document.getElementById("delete-confirm-modal").style.display = "none";
                alert(result.message);
            } else {
                alert("Lỗi khi xóa người dùng: " + (result.error || "Không xác định"));
            }
        } catch (error) {
            console.error("Lỗi khi xóa người dùng:", error);
        }
    });
}


let userIdToEdit = null;
// Mở modal chỉnh sửa người dùng
function openEditModal(id) {
    const user = users.find(u => u.user_id === id);
    if (!user) {
        console.error("Không tìm thấy người dùng với id:", id);
        alert("Không tìm thấy người dùng!");
        return;
    }

    userIdToEdit = id;
    // Hiển thị modal
    document.getElementById("edit-user-modal").style.display = "block";
    // Điền thông tin người dùng vào form
    document.getElementById("edit-username").value = user.username;
    document.getElementById("edit-email").value = user.email;
    document.getElementById("edit-role").value = user.role_id;

    // Hiển thị modal
    document.getElementById("edit-user-modal").style.display = "block";
}

// Đóng modal chỉnh sửa
const cancelEditBtn = document.getElementById("cancel-edit");
if (cancelEditBtn) {
    cancelEditBtn.addEventListener("click", () => {
        document.getElementById("edit-user-modal").style.display = "none";
    });
}
// Xử lý form chỉnh sửa người dùng
const editUserForm = document.getElementById("edit-user-form");
if (editUserForm) {
    editUserForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        // Lấy giá trị từ form
        const username = document.getElementById("edit-username").value;
        const email = document.getElementById("edit-email").value;
        const role_id = document.getElementById("edit-role").value;

        // Tạo đối tượng người dùng cập nhật
        const updatedUser = {
            user_id: userIdToEdit,
            username: username,
            email: email,
            role_id: role_id
        };

        try {
            // Gửi yêu cầu PUT hoặc POST đến API
            const response = await fetch(API_URL, {
                method: "PUT", // Hoặc "POST" tùy vào API của bạn
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updatedUser)
            });

            // Xử lý phản hồi từ server
            const result = await response.json();
            if (result.message) {
                fetchUsers(); // Cập nhật lại danh sách
                document.getElementById("edit-user-modal").style.display = "none";
                alert(result.message);
            } else {
                alert("Lỗi khi cập nhật người dùng: " + (result.error || "Không xác định"));
            }
        } catch (error) {
            console.error("Lỗi khi cập nhật người dùng:", error);
            alert("Đã xảy ra lỗi khi cập nhật người dùng. Vui lòng thử lại sau.");
        }
    });
}

// Tìm kiếm người dùng
const searchInput = document.getElementById("search");
if (searchInput) {
    searchInput.addEventListener("input", (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const filteredUsers = users.filter(user =>
            user.username.toLowerCase().includes(searchTerm) ||
            user.email.toLowerCase().includes(searchTerm)
        );
        renderUsers(searchTerm === "" ? users : filteredUsers);
    });
}
window.openDeleteModal = openDeleteModal;
window.openEditModal = openEditModal;
// Khởi chạy lần đầu
fetchUsers();