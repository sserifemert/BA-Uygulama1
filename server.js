const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

// HTTP sunucusu oluştur (frontend dosyalarını servis etmek için)
const server = http.createServer((req, res) => {
    let filePath = '.' + req.url;
    if (filePath === './') {
        filePath = './index.html';
    }

    const extname = String(path.extname(filePath)).toLowerCase();
    const mimeTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
    };

    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404);
                res.end('Dosya bulunamadı');
            } else {
                res.writeHead(500);
                res.end('Sunucu hatası: ' + error.code);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

// WebSocket sunucusu oluştur
const wss = new WebSocket.Server({ server });

// Bağlı kullanıcıları takip et
const clients = new Map();
let userIdCounter = 0;

// Yeni bağlantı geldiğinde
wss.on('connection', (ws) => {
    console.log('Yeni kullanıcı bağlandı');
    
    // Her kullanıcıya benzersiz bir ID ver
    const userId = ++userIdCounter;
    const userColor = getRandomColor();
    
    clients.set(ws, {
        id: userId,
        username: `Kullanıcı${userId}`,
        color: userColor
    });

    // Kullanıcıya hoş geldin mesajı gönder
    ws.send(JSON.stringify({
        type: 'welcome',
        userId: userId,
        color: userColor,
        message: 'Sohbete hoş geldiniz!'
    }));

    // Diğer kullanıcılara yeni kullanıcı katıldı bilgisi gönder
    broadcast({
        type: 'system',
        message: `Kullanıcı${userId} sohbete katıldı`,
        timestamp: new Date().toLocaleTimeString('tr-TR')
    }, ws);

    // Online kullanıcı sayısını güncelle
    broadcastUserCount();

    // Mesaj alındığında
    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data);
            const user = clients.get(ws);

            if (message.type === 'username') {
                // Kullanıcı adı değişikliği
                const oldUsername = user.username;
                user.username = message.username;
                
                broadcast({
                    type: 'system',
                    message: `${oldUsername} artık ${message.username} olarak anılıyor`,
                    timestamp: new Date().toLocaleTimeString('tr-TR')
                });
            } else if (message.type === 'chat') {
                // Normal sohbet mesajı
                broadcast({
                    type: 'chat',
                    userId: user.id,
                    username: user.username,
                    color: user.color,
                    message: message.message,
                    timestamp: new Date().toLocaleTimeString('tr-TR')
                });
            }
        } catch (error) {
            console.error('Mesaj işleme hatası:', error);
        }
    });

    // Bağlantı kapandığında
    ws.on('close', () => {
        const user = clients.get(ws);
        console.log(`Kullanıcı ayrıldı: ${user.username}`);
        
        broadcast({
            type: 'system',
            message: `${user.username} sohbetten ayrıldı`,
            timestamp: new Date().toLocaleTimeString('tr-TR')
        });
        
        clients.delete(ws);
        broadcastUserCount();
    });

    // Hata durumunda
    ws.on('error', (error) => {
        console.error('WebSocket hatası:', error);
    });
});

// Tüm bağlı kullanıcılara mesaj gönder
function broadcast(data, exclude = null) {
    const message = JSON.stringify(data);
    wss.clients.forEach((client) => {
        if (client !== exclude && client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

// Online kullanıcı sayısını tüm istemcilere gönder
function broadcastUserCount() {
    const count = clients.size;
    const message = JSON.stringify({
        type: 'usercount',
        count: count
    });
    
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

// Rastgele renk üret
function getRandomColor() {
    const colors = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', 
        '#98D8C8', '#6C5CE7', '#A29BFE', '#FD79A8',
        '#FDCB6E', '#00B894', '#0984E3', '#E17055'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
}

// Sunucuyu başlat
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Sunucu http://localhost:${PORT} adresinde çalışıyor`);
    console.log('WebSocket sunucusu hazır ve bağlantıları dinliyor...');
});