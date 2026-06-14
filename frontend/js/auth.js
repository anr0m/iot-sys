document.addEventListener('DOMContentLoaded', () => {
    // Перевіряємо, чи юзер вже залогінений
    if (localStorage.getItem('jwt_token')) {
        window.location.href = 'pages/dashboard.html';
        return;
    }

    const authForm = document.getElementById('authForm');
    const toggleBtn = document.getElementById('toggleBtn');
    const authTitle = document.getElementById('authTitle');
    const authSubtitle = document.getElementById('authSubtitle');
    const submitBtn = document.getElementById('submitBtn');
    const alertBox = document.getElementById('alertBox');

    let isLoginMode = true;

    // Перемикання між Логіном та Реєстрацією
    toggleBtn.addEventListener('click', () => {
        isLoginMode = !isLoginMode;
        alertBox.className = 'alert'; // Ховаємо помилки при перемиканні
        
        if (isLoginMode) {
            authTitle.textContent = 'Вхід у систему';
            authSubtitle.textContent = 'Введіть свої дані для доступу до девайсів';
            submitBtn.textContent = 'Увійти';
            document.getElementById('toggleText').textContent = 'Немає акаунту? ';
            toggleBtn.textContent = 'Зареєструватися';
        } else {
            authTitle.textContent = 'Реєстрація';
            authSubtitle.textContent = 'Створіть новий акаунт';
            submitBtn.textContent = 'Створити акаунт';
            document.getElementById('toggleText').textContent = 'Вже є акаунт? ';
            toggleBtn.textContent = 'Увійти';
        }
    });

    // Обробка відправки форми
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        
        // Вимикаємо кнопку під час запиту
        submitBtn.disabled = true;
        submitBtn.textContent = 'Зачекайте...';
        alertBox.className = 'alert'; 

        const endpoint = isLoginMode ? '/auth/login' : '/auth/register';

        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Сталася помилка');
            }

            // Якщо це реєстрація, ми отримуємо тільки { success, user }.
            // Тому автоматично логінимо юзера (або просимо залогінитись).
            // Для зручності, при реєстрації просто перемикаємо його на логін з повідомленням.
            if (!isLoginMode) {
                isLoginMode = true;
                toggleBtn.click(); // Імітуємо клік для перемикання інтерфейсу
                showAlert('Реєстрація успішна! Тепер ви можете увійти.', 'success');
                document.getElementById('password').value = ''; // Очищаємо пароль
                return;
            }

            // Якщо це логін
            if (data.token) {
                localStorage.setItem('jwt_token', data.token);
                localStorage.setItem('user_role', data.user.role);
                localStorage.setItem('user_id', String(data.user.id));
                window.location.href = 'pages/dashboard.html';
            }

        } catch (error) {
            showAlert(error.message, 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = isLoginMode ? 'Увійти' : 'Створити акаунт';
        }
    });

    function showAlert(message, type) {
        alertBox.textContent = message;
        alertBox.className = `alert ${type}`;
        // Додаємо стилі для success динамічно, бо в CSS є тільки error
        if (type === 'success') {
            alertBox.style.backgroundColor = 'rgba(46, 160, 67, 0.1)';
            alertBox.style.color = 'var(--success)';
            alertBox.style.border = '1px solid rgba(46, 160, 67, 0.2)';
            alertBox.style.display = 'block';
        } else {
            alertBox.style.cssText = ''; // Скидаємо inline стилі для error (вони є в css)
        }
    }
});