#!/usr/bin/env python
"""
Скрипт для запуска тестов с красивым выводом
"""
import subprocess
import sys
import os

def main():
    """Запуск тестов"""
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    print("=" * 60)
    print("Запуск тестов проекта ASAR")
    print("=" * 60)
    print()
    
    # Проверяем наличие pytest
    try:
        import pytest
    except ImportError:
        print("ОШИБКА: pytest не установлен!")
        print("Установите зависимости: pip install -r requirements-test.txt")
        sys.exit(1)
    
    # Запускаем тесты
    cmd = [
        sys.executable, "-m", "pytest",
        "-v",
        "--tb=short",
        "--cov=backend",
        "--cov-report=term-missing",
        "--cov-report=html"
    ]
    
    # Добавляем аргументы из командной строки
    if len(sys.argv) > 1:
        cmd.extend(sys.argv[1:])
    else:
        cmd.append("tests/")
    
    result = subprocess.run(cmd)
    
    print()
    print("=" * 60)
    if result.returncode == 0:
        print("✓ Все тесты пройдены успешно!")
    else:
        print("✗ Некоторые тесты не прошли")
    print("=" * 60)
    
    sys.exit(result.returncode)

if __name__ == "__main__":
    main()

