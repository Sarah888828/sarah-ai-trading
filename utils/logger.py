"""
로깅 설정 모듈
"""

import os
import logging
from logging.handlers import RotatingFileHandler
from config import LOG_CONFIG


def setup_logger(name=None):
    """
    로깅 설정 및 로거 반환
    
    Returns:
        logging.Logger: 설정된 로거 인스턴스
    """
    log_config = LOG_CONFIG
    log_level = getattr(logging, log_config.get("level", "INFO"))
    log_file = log_config.get("file", "logs/trading.log")

    # 로그 디렉토리 생성
    log_dir = os.path.dirname(os.path.abspath(log_file))
    os.makedirs(log_dir, exist_ok=True)

    # 루트 로거 설정
    logger = logging.getLogger(name)
    logger.setLevel(log_level)

    # 기존 핸들러 제거
    logger.handlers.clear()

    # 파일 핸들러
    file_handler = RotatingFileHandler(
        log_file,
        maxBytes=log_config.get("max_size", 10485760),
        backupCount=log_config.get("backup_count", 5),
        encoding="utf-8",
    )
    file_handler.setLevel(log_level)
    file_formatter = logging.Formatter(
        "[%(asctime)s] %(levelname)-8s %(name)s:%(lineno)d - %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )
    file_handler.setFormatter(file_formatter)
    logger.addHandler(file_handler)

    # 콘솔 핸들러
    console_handler = logging.StreamHandler()
    console_handler.setLevel(log_level)
    console_formatter = logging.Formatter(
        "%(asctime)s | %(levelname)-8s | %(message)s",
        datefmt="%H:%M:%S"
    )
    console_handler.setFormatter(console_formatter)
    logger.addHandler(console_handler)

    return logger