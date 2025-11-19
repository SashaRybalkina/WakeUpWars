"""
/**
 * @file tests_utils.py
 * @description Helper for computing a skill value from a SkillLevel object.
 */
"""

def current_skill(sl):
    if sl.totalPossible <= 0:
        return 0.0
    return min(10.0, 10.0 * sl.totalEarned / sl.totalPossible)