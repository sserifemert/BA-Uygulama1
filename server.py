import asyncio
import websockets
import json
import random
from datetime import datetime
from http.server import HTTPServer, SimpleHTTPRequestHandler
from threading import Thread
import os

# Bağlı kullanıcıları sakla
connected_clients = {}
user_id_counter = 0

# Rastgele renk üret
def get_random_color():
    colors = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', 
        '#98D8C8', '#6C5CE7', '#A29BFE', '#FD79A8',
        '#FDCB6E', '#00B894', '#0984E3', '#E17055'
    ]
    return random.choice(colors)

# Şu anki zamanı Türkçe formatında al
def get_timestamp():
    return datetime.now().strftime('%H:%M:%S')

# Tüm kullanıcılara mesaj gönder (broadcast)
async def broadcast(message, exclude=None):
    """Bağlı tüm kullanıcılara mesaj gönder"""
    if connected_clients:
        # JSON'a çevir
        message_json = json.dumps(message, ensure_ascii=False)
        
        # Tüm bağlı kullanıcılara gönder
        tasks = []
        for websocket in connected_clients:
            if websocket != exclude:
                tasks.append(websocket.send(message_json))
        
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

# Online kullanıcı sayısını gönder
async def broadcast_user_count():
    """Tüm kullanıcılara online sayısını bildir"""
    message = {
        'type': 'usercount',
        'count': len(connected_clients)
    }
    await broadcast(message)

# WebSocket bağlantı işleyicisi
async def handle_client(websocket):
    global user_id_counter
    
    # Yeni kullanıcıya ID ve renk ata
    user_id_counter += 1
    user_id = user_id_counter
    user_color = get_random_color()
    username = f"Kullanıcı{user_id}"
    
    # Kullanıcıyı kaydet
    connected_clients[websocket] = {
        'id': user_id,
        'username': username,
        'color': user_color
    }
    
    print(f"✅ Yeni kullanıcı bağlandı: {username}")
    
    try:
        # Hoş geldin mesajı gönder
        welcome_message = {
            'type': 'welcome',
            'userId': user_id,
            'color': user_color,
            'message': 'Sohbete hoş geldiniz!'
        }
        await websocket.send(json.dumps(welcome_message, ensure_ascii=False))
        
        # Diğer kullanıcılara bildir
        join_message = {
            'type': 'system',
            'message': f'{username} sohbete katıldı',
            'timestamp': get_timestamp()
        }
        await broadcast(join_message, exclude=websocket)
        
        # Online sayısını güncelle
        await broadcast_user_count()
        
        # Mesajları dinle
        async for message in websocket:
            try:
                data = json.loads(message)
                user_info = connected_clients[websocket]
                
                if data['type'] == 'username':
                    # Kullanıcı adı değişikliği
                    old_username = user_info['username']
                    new_username = data['username']
                    user_info['username'] = new_username
                    
                    name_change_message = {
                        'type': 'system',
                        'message': f'{old_username} artık {new_username} olarak anılıyor',
                        'timestamp': get_timestamp()
                    }
                    await broadcast(name_change_message)
                    print(f"📝 {old_username} -> {new_username}")
                    
                elif data['type'] == 'chat':
                    # Sohbet mesajı
                    chat_message = {
                        'type': 'chat',
                        'userId': user_info['id'],
                        'username': user_info['username'],
                        'color': user_info['color'],
                        'message': data['message'],
                        'timestamp': get_timestamp()
                    }
                    await broadcast(chat_message)
                    print(f"💬 {user_info['username']}: {data['message']}")
                    
            except json.JSONDecodeError:
                print("⚠️  Hatalı JSON formatı")
            except Exception as e:
                print(f"❌ Mesaj işleme hatası: {e}")
                
    except websockets.exceptions.ConnectionClosed:
        if websocket in connected_clients:
             print(f"🔌 Bağlantı kapandı: {connected_clients[websocket]['username']}")
    except Exception as e:
        print(f"❌ Bağlantı hatası: {e}")
    finally:
        # Kullanıcı ayrıldı
        if websocket in connected_clients:
            user_info = connected_clients[websocket]
            
            leave_message = {
                'type': 'system',
                'message': f'{user_info["username"]} sohbetten ayrıldı',
                'timestamp': get_timestamp()
            }
            
            # Kullanıcıyı listeden çıkar
            del connected_clients[websocket]
            
            # Diğerlerine bildir
            await broadcast(leave_message)
            await broadcast_user_count()
            
            print(f"👋 {user_info['username']} ayrıldı")

# HTTP sunucusu için handler
class MyHTTPRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=os.path.dirname(__file__), **kwargs)
    
    def log_message(self, format, *args):
        # HTTP loglarını sustur
        pass

# HTTP sunucusunu ayrı thread'de çalıştır
def start_http_server(port=8000):
    server = HTTPServer(('0.0.0.0', port), MyHTTPRequestHandler)
    print(f"🌐 HTTP Sunucu http://localhost:{port} adresinde başlatıldı")
    server.serve_forever()

# Ana fonksiyon
async def main():
    # HTTP sunucusunu başlat (frontend dosyalarını servis etmek için)
    http_thread = Thread(target=start_http_server, args=(8000,), daemon=True)
    http_thread.start()
    
    # WebSocket sunucusunu başlat
    print("=" * 60)
    print("🚀 WebSocket Sohbet Sunucusu Başlatılıyor...")
    print("=" * 60)
    
    async with websockets.serve(handle_client, "0.0.0.0", 8765):
        print(f"✅ WebSocket sunucusu ws://localhost:8765 adresinde çalışıyor")
        print(f"✅ Web arayüzü: http://localhost:8000")
        print("=" * 60)
        print("📊 Sunucu hazır ve bağlantıları dinliyor...")
        print("🛑 Durdurmak için Ctrl+C'ye basın")
        print("=" * 60)
        
        # Sonsuza kadar çalış
        await asyncio.Future()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n")
        print("=" * 60)
        print("🛑 Sunucu kapatılıyor...")
        print("👋 Görüşmek üzere!")
        print("=" * 60)