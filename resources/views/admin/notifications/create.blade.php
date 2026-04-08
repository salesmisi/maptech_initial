<!doctype html>
<html>
<head>
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Create Notification</title>
    <style>body{font-family:system-ui,Segoe UI,Roboto,Helvetica,Arial;margin:20px}</style>
</head>
<body>
    <div style="max-width:720px;margin:0 auto">
        <h2>Create Notification</h2>
        <form id="notification-form">
            <div style="margin:8px 0">
                <label>Title</label><br>
                <input type="text" id="title" required style="width:100%;padding:8px">
            </div>
            <div style="margin:8px 0">
                <label>Message</label><br>
                <textarea id="message" rows="4" style="width:100%;padding:8px"></textarea>
            </div>
            <div style="margin:8px 0">
                <label>Target</label><br>
                <select id="target_type" style="padding:6px">
                    <option value="user">Specific User</option>
                    <option value="department">Department</option>
                </select>
                <input type="text" id="target_id" placeholder="User ID or Department ID" required style="width:100%;padding:8px;margin-top:8px">
            </div>
            <div style="margin-top:12px">
                <button type="button" id="send">Send</button>
                <span id="status" style="margin-left:12px"></span>
            </div>
        </form>
    </div>

    <script>
    document.getElementById('send').addEventListener('click', async () => {
        const title = document.getElementById('title').value;
        const message = document.getElementById('message').value;
        const target_type = document.getElementById('target_type').value;
        const target_id = document.getElementById('target_id').value;
        const status = document.getElementById('status');
        status.textContent = 'Sending...';

        try {
            await fetch('/sanctum/csrf-cookie', { credentials: 'include' });
            const res = await fetch('/api/admin/notifications', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, message, target_type, target_id })
            });
            const body = await res.json();
            if (res.ok) status.textContent = 'Sent successfully'; else status.textContent = 'Error: ' + (body.message || res.statusText);
        } catch (err) { status.textContent = 'Network error'; }
    });
    </script>
</body>
</html>
