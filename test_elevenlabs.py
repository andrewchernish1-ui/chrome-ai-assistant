import requests

# Test ElevenLabs API key
API_KEY = '8913dc0722ac37c97af76e28c762d9585236aeef52e4a1bfce1981c75085e615'
VOICE_ID = 'JBFqnCBsd6RMkjVDRZzb'

url = f'https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}'

headers = {
    'Accept': 'audio/mpeg',
    'Content-Type': 'application/json',
    'xi-api-key': API_KEY
}

data = {
    'text': 'Hello world',
    'model_id': 'eleven_multilingual_v2',
    'voice_settings': {
        'stability': 0.5,
        'similarity_boost': 0.5
    }
}

try:
    response = requests.post(url, headers=headers, json=data)
    print(f'Status Code: {response.status_code}')

    if response.status_code == 200:
        print('✅ API key is valid!')
        with open('test_audio.mp3', 'wb') as f:
            f.write(response.content)
        print('Audio saved to test_audio.mp3')
    else:
        print('❌ API key is invalid or expired!')
        print(f'Response: {response.text}')

except Exception as e:
    print(f'❌ Error: {e}')
