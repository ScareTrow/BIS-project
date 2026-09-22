"""Validation shared by the JSON and multipart application endpoints."""
import math
from pathlib import Path
from werkzeug.utils import secure_filename

MEDIA_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.mp4', '.webm', '.mov', '.avi', '.mkv', '.m4v'}
MAX_FILE_BYTES = 50 * 1024 * 1024


def coordinates(latitude, longitude):
    if isinstance(latitude, bool) or isinstance(longitude, bool):
        raise ValueError('Invalid coordinates')
    try:
        latitude, longitude = float(latitude), float(longitude)
    except (ValueError, TypeError):
        raise ValueError('Invalid coordinates') from None
    if not math.isfinite(latitude) or not math.isfinite(longitude):
        raise ValueError('Invalid coordinates')
    if not -90 <= latitude <= 90 or not -180 <= longitude <= 180:
        raise ValueError('Invalid coordinates')
    return latitude, longitude


def validate_upload(file, *, document=False):
    filename = secure_filename(file.filename or '')
    extension = Path(filename).suffix.lower()
    allowed = {'.pdf'} if document else MEDIA_EXTENSIONS
    if not filename or extension not in allowed:
        raise ValueError('Unsupported file extension')
    file.stream.seek(0, 2)
    size = file.stream.tell()
    file.stream.seek(0)
    if size == 0:
        raise ValueError('Empty files are not accepted')
    if size > MAX_FILE_BYTES:
        raise ValueError('Maximum file size is 50 MB')
    return filename
