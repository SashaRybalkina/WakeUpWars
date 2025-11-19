"""
/**
 * @file skill_config.py
 * @description This file defines the configuration for skill computation.
 * It sets the window for valid results. It sets the half-life for recency
 * decay. It provides a single shared SkillConfig instance for use elsewhere.
 */
"""

from dataclasses import dataclass

@dataclass(frozen=True)
class SkillConfig:
    WINDOW_DAYS: int | None = 180 # To ignore results older than 180 days.
    HALF_LIFE_DAYS: float | None = 30 # exponential time decay so recent games count more

SKILL_CONFIG = SkillConfig()