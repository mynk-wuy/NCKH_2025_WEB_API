document.addEventListener("DOMContentLoaded", function () {
    const loginForm = document.getElementById("loginForm");
    const loginMessage = document.getElementById("loginMessage"); // Lấy phần tử thông báo

    loginForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        
        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value.trim();
        
        try {
            const response = await fetch("http://localhost/routes/auth.php", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ email, password })
            });

            if (!response.ok) {
                throw new Error("Lỗi kết nối đến server");
            }

            const result = await response.json();

            if (result.status === "success") {
                localStorage.setItem("user", JSON.stringify({
                    user_id: result.user_id,
                    role_id: result.role_id,
                    token: result.token
                }));
                window.location.href = "home.html";
            } else {
                loginMessage.textContent = "Sai email hoặc mật khẩu";
                loginMessage.style.color = "red";
            }
        } catch (error) {
            console.error("Lỗi:", error);
            loginMessage.textContent = "Lỗi hệ thống, vui lòng thử lại!";
            loginMessage.style.color = "red";
        }
    });
});
