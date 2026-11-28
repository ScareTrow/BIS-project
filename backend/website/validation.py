"""Validation shared by the JSON and multipart application endpoints."""
import math
import io
from pathlib import Path
from PIL import Image, UnidentifiedImageError

MEDIA_EXTENSIONS = {'.jpg', '.jpeg', '.jfif', '.png'}
# Phone cameras save .jpg as MPO: a JPEG with an extra preview or depth frame.
JPEG_FORMATS = {'JPEG', 'MPO'}
MAX_FILE_BYTES = 10 * 1024 * 1024
MAX_PHOTOS = 3


class UploadValidationError(ValueError):
    def __init__(self, message, status_code=400):
        super().__init__(message)
        self.status_code = status_code


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
    filename = file.filename or ''
    extension = Path(filename).suffix.lower()
    allowed = {'.pdf'} if document else MEDIA_EXTENSIONS
    if not filename or extension not in allowed:
        raise UploadValidationError('Поддерживаются только JPEG и PNG' if not document else 'Нужен PDF документ', 415)
    file.stream.seek(0, 2)
    size = file.stream.tell()
    file.stream.seek(0)
    if size == 0:
        raise UploadValidationError('Файл пуст')
    if size > MAX_FILE_BYTES:
        raise UploadValidationError('Файл слишком большой (максимум 10 МБ)', 413)
    content = file.stream.read()
    file.stream.seek(0)
    if document:
        if not content.startswith(b'%PDF-'):
            raise UploadValidationError('Недопустимое содержимое PDF', 415)
    else:
        try:
            with Image.open(io.BytesIO(content)) as image:
                expected = {'PNG'} if extension == '.png' else JPEG_FORMATS
                if image.format not in expected:
                    raise UploadValidationError('Содержимое файла не соответствует JPEG/PNG', 415)
                image.verify()
        except (UnidentifiedImageError, OSError, SyntaxError, Image.DecompressionBombError) as error:
            raise UploadValidationError('Файл не является корректным изображением JPEG/PNG', 415) from error
        if extension == '.jfif':
            # Callers name the stored file from this; .jpg is served as image/jpeg everywhere.
            filename = file.filename = filename[:-len(extension)] + '.jpg'
    return filename


def validate_photos(files):
    if not 1 <= len(files) <= MAX_PHOTOS:
        raise UploadValidationError('Приложите от 1 до 3 фотографий JPEG/PNG')
    for file in files:
        validate_upload(file)
