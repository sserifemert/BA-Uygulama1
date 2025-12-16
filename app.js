// WebSocket bağlantısı
let ws;
let userId;
let userColor;
let username = '';

// DOM elementleri
const messagesDiv = document.getElementById('messages');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const statusSpan = document.getElementById('status');
const userCountSpan = document.getElementById('userCount');
const usernameInput = document.getElementById('usernameInput');
const setUsernameBtn = document.getElementById('setUsernameBtn');

// WebSocket bağlantısını başlat
function connect() {
    // WebSocket sunucusuna bağlan (production'da wss:// kullanın)
    ws = new WebSocket(`ws://${window.location.host}`);

    ws.onopen = () => {
        console.log('WebSocket bağlantısı kuruldu');
        updateStatus('connected', 'Bağlandı ✓');
        messageInput.disabled = false;
        sendBtn.disabled = false;
    };

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            handleMessage(data);
        } catch (error) {
            console.error('Mesaj ayrıştırma hatası:', error);
        }
    };

    ws.onclose = () => {
        console.log('WebSocket bağlantısı kapandı');
        updateStatus('disconnected', 'Bağlantı Kesildi ✗');
        messageInput.disabled = true;
        sendBtn.disabled = true;
        
        // 3 saniye sonra yeniden bağlanmayı dene
        setTimeout(() => {
            console.log('Yeniden bağlanılıyor...');
            updateStatus('connecting', 'Bağlanıyor...');
            connect();
        }, 3000);
    };

    ws.onerror = (error) => {
        console.error('WebSocket hatası:', error);
        updateStatus('disconnected', 'Hata ✗');
    };
}

// Mesaj işleme
function handleMessage(data) {
    switch (data.type) {
        case 'welcome':
            userId = data.userId;
            userColor = data.color;
            username = `Kullanıcı${userId}`;
            usernameInput.value = username;
            addSystemMessage(data.message);
            break;
            
        case 'chat':
            addChatMessage(data);
            break;
            
        case 'system':
            addSystemMessage(data.message);
            break;
            
        case 'usercount':
            userCountSpan.textContent = data.count;
            break;
    }
}

// Sohbet mesajı ekle
function addChatMessage(data) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${data.userId === userId ? 'own' : 'other'}`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    if (data.userId !== userId) {
        const usernameSpan = document.createElement('div');
        usernameSpan.className = 'message-username';
        usernameSpan.textContent = data.username;
        usernameSpan.style.color = data.color;
        contentDiv.appendChild(usernameSpan);
    }
    
    const textDiv = document.createElement('div');
    textDiv.className = 'message-text';
    textDiv.textContent = data.message;
    contentDiv.appendChild(textDiv);
    
    const timeDiv = document.createElement('div');
    timeDiv.className = 'message-time';
    timeDiv.textContent = data.timestamp;
    contentDiv.appendChild(timeDiv);
    
    messageDiv.appendChild(contentDiv);
    
    // Hoş geldin mesajını kaldır
    const welcomeMsg = messagesDiv.querySelector('.welcome-message');
    if (welcomeMsg) {
        welcomeMsg.remove();
    }
    
    messagesDiv.appendChild(messageDiv);
    scrollToBottom();
}

// Sistem mesajı ekle
function addSystemMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'system-message';
    messageDiv.textContent = message;
    
    const welcomeMsg = messagesDiv.querySelector('.welcome-message');
    if (welcomeMsg) {
        welcomeMsg.remove();
    }
    
    messagesDiv.appendChild(messageDiv);
    scrollToBottom();
}

// Mesaj gönder
function sendMessage() {
    const message = messageInput.value.trim();
    
    if (message && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'chat',
            message: message
        }));
        
        messageInput.value = '';
        messageInput.focus();
    }
}

// Kullanıcı adını değiştir
function setUsername() {
    const newUsername = usernameInput.value.trim();
    
    if (newUsername && newUsername !== username && ws.readyState === WebSocket.OPEN) {
        username = newUsername;
        ws.send(JSON.stringify({
            type: 'username',
            username: newUsername
        }));
    }
}

// Bağlantı durumunu güncelle
function updateStatus(status, text) {
    statusSpan.textContent = text;
    statusSpan.className = `connection-status ${status}`;
}

// En alta kaydır
function scrollToBottom() {
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Event listeners
sendBtn.addEventListener('click', sendMessage);

messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

setUsernameBtn.addEventListener('click', setUsername);

usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        setUsername();
    }
});

// Sayfa yüklendiğinde bağlan
connect();