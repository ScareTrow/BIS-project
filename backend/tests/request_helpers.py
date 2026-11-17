"""Real multipart photo requests used by workflow tests."""
import io
import json

from PIL import Image


def png_bytes():
    image = io.BytesIO()
    Image.new('RGB', (2, 2), 'white').save(image, format='PNG')
    return image.getvalue()


def post_request(client, fields, path='/api/applications'):
    data = {key: json.dumps(value) if isinstance(value, (list, dict)) else str(value)
            for key, value in fields.items()}
    data['media_files'] = (io.BytesIO(png_bytes()), 'proof.png')
    return client.post(path, data=data, content_type='multipart/form-data')
