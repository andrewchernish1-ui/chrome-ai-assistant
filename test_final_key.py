import requests

# Final test of ElevenLabs API key
API_KEY = 'sk_2b8a35c57d80b445a5198019664c59c2f8ce51fe4436e4cc'
VOICE_ID = 'JBFqnCBsd6RMkjVDRZzb'

url = f'https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}'

headers = {
    'Accept': 'audio/mpeg',
    'Content-Type': 'application/json',
    'xi-api-key': API_KEY
}

data = {
    'text': 'Тест синтеза речи. Это работает!',
    'model_id': 'eleven_multilingual_v2',
    'voice_settings': {
        'stability': 0.5,
        'similarity_boost': 0.5
    }
}

print("🔍 Тестируем новый API ключ ElevenLabs...")

try:
    response = requests.post(url, headers=headers, json=data)
    print(f'📊 Статус код: {response.status_code}')

    if response.status_code == 200:
        print('✅ API ключ работает! Синтез речи доступен.')
        with open('final_test.mp3', 'wb') as f:
            f.write(response.content)
        print('🎵 Аудио файл сохранен как final_test.mp3')
    else:
        print('❌ API ключ не работает!')
        print(f'📝 Ответ сервера: {response.text}')
        print('💡 Возможно, нужно активировать разрешение text_to_speech для этого ключа в аккаунте ElevenLabs')

except Exception as e:
    print(f'❌ Ошибка подключения: {e}')
