document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('jwt_token');
    const role = localStorage.getItem('user_role');
    const currentUserId = parseInt(localStorage.getItem('user_id'), 10);

    if (!token || role !== 'admin') {
        window.location.href = 'dashboard.html';
        return;
    }

    const statUsers = document.getElementById('statUsers');
    const statDevices = document.getElementById('statDevices');
    const statOnline = document.getElementById('statOnline');
    const usersTableBody = document.getElementById('usersTableBody');
    const devicesTableBody = document.getElementById('devicesTableBody');
    const adminAlert = document.getElementById('adminAlert');
    const ownersModal = document.getElementById('ownersModal');
    const ownersInput = document.getElementById('ownersInput');
    const ownersModalDevice = document.getElementById('ownersModalDevice');
    const saveOwnersBtn = document.getElementById('saveOwnersBtn');

    let dashboardData = null;
    let editingDeviceId = null;

    function showAlert(message, isError = true) {
        adminAlert.textContent = message;
        adminAlert.className = isError ? 'alert error' : 'alert success';
        adminAlert.classList.remove('hidden');
        setTimeout(() => adminAlert.classList.add('hidden'), 4000);
    }

    async function apiRequest(url, options = {}) {
        const response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                ...(options.headers || {})
            }
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'Помилка запиту');
        }
        return data;
    }

    function renderUsers(users) {
        usersTableBody.innerHTML = users.map(u => {
            const isBlocked = Boolean(u.is_blocked);
            const isSelf = u.id === currentUserId;
            return `
                <tr>
                    <td style="color: var(--text-secondary); font-size: 0.9rem;">${u.id}</td>
                    <td style="font-weight: 500;">${u.username}${isSelf ? ' <span style="color:var(--accent)">(ви)</span>' : ''}</td>
                    <td>
                        <select class="role-select" data-user-id="${u.id}" ${isSelf ? 'disabled' : ''}>
                            <option value="user" ${u.role === 'user' ? 'selected' : ''}>user</option>
                            <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>admin</option>
                        </select>
                    </td>
                    <td>
                        <span class="badge ${isBlocked ? 'blocked' : 'active'}">
                            ${isBlocked ? 'Заблоковано' : 'Активний'}
                        </span>
                    </td>
                    <td style="color: var(--text-secondary); font-size: 0.9rem;">
                        ${new Date(u.created_at).toLocaleString()}
                    </td>
                    <td class="actions-cell">
                        <button class="btn-sm ${isBlocked ? 'btn-success' : 'btn-warning'}"
                            data-action="toggle-block" data-user-id="${u.id}" data-blocked="${isBlocked}"
                            ${isSelf ? 'disabled' : ''}>
                            ${isBlocked ? 'Розблокувати' : 'Заблокувати'}
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    function renderDevices(devices) {
        devicesTableBody.innerHTML = devices.length === 0
            ? '<tr><td colspan="5" style="text-align:center;">Немає пристроїв</td></tr>'
            : devices.map(d => `
                <tr>
                    <td style="font-weight: 600; color: var(--accent);">${d.device_id}</td>
                    <td>
                        <span class="status ${d.is_online ? 'online' : 'offline'}">
                            <div class="status-dot"></div> ${d.is_online ? 'Online' : 'Offline'}
                        </span>
                    </td>
                    <td style="color: var(--text-secondary); font-size: 0.9rem;">
                        ${d.last_seen ? new Date(d.last_seen).toLocaleString() : '—'}
                    </td>
                    <td>${d.owners || '<span style="color:var(--text-secondary)">Немає власника</span>'}</td>
                    <td class="actions-cell">
                        <button class="btn-sm" data-action="edit-owners" data-device-id="${d.device_id}"
                            data-owner-ids="${d.owner_ids || ''}">Власники</button>
                        <button class="btn-sm btn-warning" data-action="clear-history" data-device-id="${d.device_id}">
                            Очистити історію
                        </button>
                        <button class="btn-sm btn-danger" data-action="delete-device" data-device-id="${d.device_id}">
                            Видалити
                        </button>
                    </td>
                </tr>
            `).join('');
    }

    async function loadDashboard() {
        const { success, stats, users, devices } = await apiRequest(`${CONFIG.API_BASE_URL}/admin/dashboard`);
        if (!success) return;

        dashboardData = { users, devices };
        statUsers.textContent = stats.totalUsers;
        statDevices.textContent = stats.totalDevices;
        statOnline.textContent = stats.onlineDevices;
        renderUsers(users);
        renderDevices(devices);
    }

    async function toggleBlock(userId, currentlyBlocked) {
        await apiRequest(`${CONFIG.API_BASE_URL}/admin/users/${userId}/block`, {
            method: 'PATCH',
            body: JSON.stringify({ blocked: !currentlyBlocked })
        });
        showAlert(currentlyBlocked ? 'Користувача розблоковано' : 'Користувача заблоковано', false);
        await loadDashboard();
    }

    async function changeRole(userId, newRole) {
        await apiRequest(`${CONFIG.API_BASE_URL}/admin/users/${userId}/role`, {
            method: 'PATCH',
            body: JSON.stringify({ role: newRole })
        });
        showAlert('Роль оновлено', false);
        await loadDashboard();
    }

    function openOwnersModal(deviceId, ownerIds) {
        editingDeviceId = deviceId;
        ownersModalDevice.textContent = `Пристрій: ${deviceId}`;
        ownersInput.value = ownerIds || '';
        ownersModal.classList.remove('hidden');
    }

    async function saveOwners() {
        const raw = ownersInput.value.trim();
        const user_ids = raw
            ? raw.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n))
            : [];

        await apiRequest(`${CONFIG.API_BASE_URL}/admin/devices/${encodeURIComponent(editingDeviceId)}/owners`, {
            method: 'PUT',
            body: JSON.stringify({ user_ids })
        });
        ownersModal.classList.add('hidden');
        showAlert('Власників оновлено', false);
        await loadDashboard();
    }

    async function clearHistory(deviceId) {
        if (!confirm(`Очистити всю історію даних пристрою "${deviceId}" з InfluxDB?`)) return;

        await apiRequest(`${CONFIG.API_BASE_URL}/admin/devices/${encodeURIComponent(deviceId)}/history`, {
            method: 'DELETE'
        });
        showAlert('Історію очищено', false);
    }

    async function deleteDevice(deviceId) {
        if (!confirm(`Видалити пристрій "${deviceId}" з бази даних?`)) return;

        const clearHistory = confirm('Також очистити історію даних з InfluxDB?');

        await apiRequest(
            `${CONFIG.API_BASE_URL}/admin/devices/${encodeURIComponent(deviceId)}?clearHistory=${clearHistory}`,
            { method: 'DELETE' }
        );
        showAlert('Пристрій видалено', false);
        await loadDashboard();
    }

    usersTableBody.addEventListener('click', async (e) => {
        const btn = e.target.closest('[data-action="toggle-block"]');
        if (!btn) return;
        try {
            await toggleBlock(parseInt(btn.dataset.userId, 10), btn.dataset.blocked === 'true');
        } catch (err) {
            showAlert(err.message);
            await loadDashboard();
        }
    });

    usersTableBody.addEventListener('change', async (e) => {
        const select = e.target.closest('.role-select');
        if (!select || select.disabled) return;
        const userId = parseInt(select.dataset.userId, 10);
        const newRole = select.value;
        const prevUser = dashboardData?.users.find(u => u.id === userId);
        if (prevUser && prevUser.role === newRole) return;

        try {
            await changeRole(userId, newRole);
        } catch (err) {
            showAlert(err.message);
            await loadDashboard();
        }
    });

    devicesTableBody.addEventListener('click', async (e) => {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        const action = btn.dataset.action;
        const deviceId = btn.dataset.deviceId;

        try {
            if (action === 'edit-owners') {
                openOwnersModal(deviceId, btn.dataset.ownerIds);
            } else if (action === 'clear-history') {
                await clearHistory(deviceId);
            } else if (action === 'delete-device') {
                await deleteDevice(deviceId);
            }
        } catch (err) {
            showAlert(err.message);
        }
    });

    saveOwnersBtn.addEventListener('click', async () => {
        try {
            await saveOwners();
        } catch (err) {
            showAlert(err.message);
        }
    });

    ownersModal.addEventListener('click', (e) => {
        if (e.target === ownersModal || e.target.dataset.action === 'close-owners') {
            ownersModal.classList.add('hidden');
        }
    });

    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.removeItem('jwt_token');
        localStorage.removeItem('user_role');
        localStorage.removeItem('user_id');
        window.location.href = '../index.html';
    });

    loadDashboard().catch(err => {
        alert(err.message);
        window.location.href = 'dashboard.html';
    });
});
